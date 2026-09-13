import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { executeInventoryAdoption } from '../../packages/db/src/inventory-adoption-executor';
import { backfillLegacyInventory } from '../../packages/db/src/inventory-truth';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { inventoryRoutes } from '../../src/worker/routes/inventory';
import { inventoryTruthRoutes } from '../../src/worker/routes/inventory-truth';
import type { AuthContext, Env } from '../../src/worker/types';
import { signJwt } from '../../src/worker/utils/jwt';
import { SqliteD1 } from '../helpers/sqlite-d1';

// T13R-A P1-2 (review P1-2): an ordinary free-form rename of a lot must not
// erase its established canonical identity. Only a name that itself resolves
// to a canonical ingredient may (re)establish identity; an unrecognised
// display name is a label, not a remap to "unmapped".

const scope = { householdId: 'identity-household', actorId: 'identity-user' };
const secret = 'test-only-t13r-a-canonical-identity-secret';
const now = '2026-09-13T10:00:00Z';

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', authMiddleware);
app.route('/', inventoryRoutes);
app.route('/', inventoryTruthRoutes);

let db: SqliteD1;
let token: string;

beforeEach(async () => {
  db = new SqliteD1();
  db.seed(`INSERT INTO users(id) VALUES ('identity-user');
    INSERT INTO households(id, name, created_by) VALUES ('identity-household', 'Identity', 'identity-user');
    INSERT INTO household_members(id, household_id, user_id, role)
      VALUES ('identity-member', 'identity-household', 'identity-user', 'owner');
    INSERT INTO inventory_items(id, household_id, ingredient_id, name, quantity, unit, category, storage, version)
      VALUES ('stock-chicken', 'identity-household', 'CHICKEN_BREAST', 'Ức gà', 300, 'g', 'meat', 'fridge', 1),
             ('stock-unmapped', 'identity-household', NULL, 'Bánh nhà làm', 2, 'piece', 'other', 'pantry', 1);`);
  token = await signJwt({ sub: scope.actorId, hid: scope.householdId, typ: 'access',
    exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
});
afterEach(() => db.close());

async function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const response = await app.fetch(new Request(`https://identity.example${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, ENVIRONMENT: 'test', JWT_SECRET: secret, WEEK_SCHEMA_MODE: 'legacy' });
  return { status: response.status, json: await response.json() as Record<string, any> };
}

const projection = (id: string) => db.query<{ ingredient_id: string | null; name: string; quantity: number; unit: string; version: number }>(
  'SELECT ingredient_id, name, quantity, unit, version FROM inventory_items WHERE id = ?', id)[0];
const lot = (legacyId: string) => db.query<{ ingredient_id: string | null; raw_name: string; quantity_milli: number; source_type: string; version: number }>(
  'SELECT ingredient_id, raw_name, quantity_milli, source_type, version FROM inventory_lots WHERE legacy_item_id = ?', legacyId)[0];

describe.each(['legacy', 'native'] as const)('T13R-A P1-2 canonical identity survives a free-form rename (%s authority)', (mode) => {
  beforeEach(async () => {
    if (mode === 'native') {
      await backfillLegacyInventory(db, scope.householdId);
      await executeInventoryAdoption(db, scope, {}, now);
    }
  });

  // 'Thịt gà đã kiểm tra' is the independent review's counterexample and matches
  // no alias; 'Ức gà nhà mua' is the task's example and happens to contain an
  // alias. Both are display labels and both must keep CHICKEN_BREAST.
  it.each(['Thịt gà đã kiểm tra', 'Ức gà nhà mua'])('keeps CHICKEN_BREAST under the free-form rename %j', async (name) => {
    const before = projection('stock-chicken');
    const response = await request('PATCH', '/inventory/stock-chicken', { name, version: 1 });
    expect(response.status).toBe(200);
    expect(response.json.item).toMatchObject({ ingredientId: 'CHICKEN_BREAST', name, quantity: 300, unit: 'g', version: 2 });
    expect(projection('stock-chicken')).toEqual({ ...before, ingredient_id: 'CHICKEN_BREAST', name, version: 2 });
    if (mode === 'native') {
      expect(lot('stock-chicken')).toMatchObject({ ingredient_id: 'CHICKEN_BREAST', raw_name: name,
        quantity_milli: 300000, source_type: 'LEGACY_BACKFILL' });
      const detail = await request('GET', '/inventory/lots/stock-chicken');
      expect(detail.json.lot).toMatchObject({ ingredientId: 'CHICKEN_BREAST', name, quantityMilli: 300000 });
    }
  });

  it('keeps identity across a rename combined with other metadata edits', async () => {
    const response = await request('PATCH', '/inventory/stock-chicken', {
      name: 'Thịt gà đã kiểm tra', unit: 'kg', category: 'other', storage: 'freezer', expiryDate: '2030-12-31', version: 1,
    });
    expect(response.status).toBe(200);
    // Identity and stock are conserved; the adopted projection keeps the
    // canonical unit (300 g) while the legacy row converts (0.3 kg).
    expect(projection('stock-chicken')).toMatchObject(mode === 'native'
      ? { ingredient_id: 'CHICKEN_BREAST', name: 'Thịt gà đã kiểm tra', unit: 'g', quantity: 300 }
      : { ingredient_id: 'CHICKEN_BREAST', name: 'Thịt gà đã kiểm tra', unit: 'kg', quantity: 0.3 });
    if (mode === 'native') expect(lot('stock-chicken')).toMatchObject({ ingredient_id: 'CHICKEN_BREAST', quantity_milli: 300000 });
  });

  it('a name that resolves to a different canonical ingredient is an explicit remap and is honoured', async () => {
    const response = await request('PATCH', '/inventory/stock-chicken', { name: 'Đậu phụ', version: 1 });
    expect(response.status).toBe(200);
    expect(projection('stock-chicken')).toMatchObject({ ingredient_id: 'TOFU', name: 'Đậu phụ' });
    if (mode === 'native') expect(lot('stock-chicken')).toMatchObject({ ingredient_id: 'TOFU' });
  });

  it('an unmapped item stays unmapped under a free-form rename and gains identity only from a recognised name', async () => {
    expect((await request('PATCH', '/inventory/stock-unmapped', { name: 'Bánh bà ngoại', version: 1 })).status).toBe(200);
    expect(projection('stock-unmapped')).toMatchObject({ ingredient_id: null, name: 'Bánh bà ngoại', version: 2 });
    expect((await request('PATCH', '/inventory/stock-unmapped', { name: 'Trứng gà', version: 2 })).status).toBe(200);
    expect(projection('stock-unmapped')).toMatchObject({ ingredient_id: 'CHICKEN_EGG', name: 'Trứng gà', version: 3 });
  });

  it('a metadata-only PATCH without a name never touches identity', async () => {
    expect((await request('PATCH', '/inventory/stock-chicken', { storage: 'freezer', version: 1 })).status).toBe(200);
    expect(projection('stock-chicken')).toMatchObject({ ingredient_id: 'CHICKEN_BREAST', name: 'Ức gà' });
  });

  it('replays the identity-preserving rename idempotently and rejects stale versions', async () => {
    const headers = { 'Idempotency-Key': 'rename-key-1' };
    const first = await request('PATCH', '/inventory/stock-chicken', { name: 'Thịt gà đã kiểm tra', version: 1 }, headers);
    expect(first.status).toBe(200);
    const committed = db.query('SELECT * FROM inventory_items WHERE id = ?', 'stock-chicken');
    const replay = await request('PATCH', '/inventory/stock-chicken', { name: 'Thịt gà đã kiểm tra', version: 1 }, headers);
    expect(replay.status).toBe(200);
    expect(replay.json).toMatchObject({ success: true, idempotentReplay: true,
      item: { ingredientId: 'CHICKEN_BREAST', name: 'Thịt gà đã kiểm tra', quantity: 300, unit: 'g', version: 2 } });
    expect(db.query('SELECT * FROM inventory_items WHERE id = ?', 'stock-chicken')).toEqual(committed);
    expect((await request('PATCH', '/inventory/stock-chicken', { name: 'Khác', version: 1 })).status).toBe(409);
    expect(projection('stock-chicken')).toMatchObject({ ingredient_id: 'CHICKEN_BREAST', name: 'Thịt gà đã kiểm tra', version: 2 });
  });
});
