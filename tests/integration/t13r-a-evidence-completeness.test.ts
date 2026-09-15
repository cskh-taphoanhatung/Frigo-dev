import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeInventoryAdoption } from '../../packages/db/src/inventory-adoption-executor';
import { backfillLegacyInventory } from '../../packages/db/src/inventory-truth';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { inventoryRoutes } from '../../src/worker/routes/inventory';
import { scanRoutes } from '../../src/worker/routes/scans';
import { processScanJob, type ScanQueueMessage } from '../../src/worker/services/scan-queue';
import type { AuthContext, Env } from '../../src/worker/types';
import { signJwt } from '../../src/worker/utils/jwt';
import { SqliteD1 } from '../helpers/sqlite-d1';

// T13R-A P2-A / P2-B. Real migrations (0001-0033), real route handlers, real
// queue processor. Assertions read durable scan_items rows and the GET scan DTO.

const vision = vi.fn();
const receiptScan = vi.fn();
vi.mock('@frigo/ai', () => ({ AIRouter: class {
  vision = vision;
  receiptScan = receiptScan;
} }));

const scope = { householdId: 'evidence-household', actorId: 'evidence-user' };
const secret = 'test-only-t13r-a-evidence-completeness-secret';
const now = '2026-09-13T10:00:00Z';

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', authMiddleware);
app.route('/', inventoryRoutes);
app.route('/', scanRoutes);

let db: SqliteD1;
let token: string;

beforeEach(async () => {
  db = new SqliteD1();
  db.seed(`INSERT INTO users(id) VALUES ('evidence-user');
    INSERT INTO households(id, name, created_by) VALUES ('evidence-household', 'Evidence', 'evidence-user');
    INSERT INTO household_members(id, household_id, user_id, role)
      VALUES ('evidence-member', 'evidence-household', 'evidence-user', 'owner');`);
  token = await signJwt({ sub: scope.actorId, hid: scope.householdId, typ: 'access',
    exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
  vision.mockReset();
  receiptScan.mockReset();
});
afterEach(() => db.close());

async function request(method: string, path: string, body?: unknown) {
  const response = await app.fetch(new Request(`https://evidence.example${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, ENVIRONMENT: 'test', JWT_SECRET: secret, WEEK_SCHEMA_MODE: 'legacy', AI_MOCK_MODE: 'true' });
  return { status: response.status, json: await response.json() as Record<string, any> };
}

const visionItem = {
  raw_name: 'Cà chua bi', estimated_quantity: 3, unit: 'piece', confidence: 0.42,
  category: 'vegetable', storage: 'freezer',
};
const receiptItem = {
  raw_name: 'Thực phẩm bí ẩn OCR', estimated_quantity: 1, unit: 'l', category: 'dairy', storage: 'pantry',
  unit_price_vnd: 32000, total_price_vnd: 32000,
};

const EVIDENCE_COLUMNS = `ocr_raw_name, ocr_quantity, ocr_unit, ocr_confidence, ocr_canonical_id, ocr_category, ocr_storage,
  reviewed_expiry_date, reviewed_expiry_kind, review_state`;
const evidenceRows = (scanId: string) =>
  db.query(`SELECT ${EVIDENCE_COLUMNS} FROM scan_items WHERE scan_id = ? ORDER BY id`, scanId);

describe('T13R-A P2-A raw category/storage/canonical evidence is retained by every writer', () => {
  it('sync fridge and sync receipt persist the ingested mapping as immutable evidence', async () => {
    vision.mockResolvedValue({ items: [visionItem] });
    receiptScan.mockResolvedValue({ merchant_name: 'Bách Hóa', purchase_date: '2026-09-12', items: [receiptItem] });
    const fridge = await request('POST', '/scans/fridge', { imageBase64: 'aGVsbG8=' });
    expect(fridge.status).toBe(200);
    const receipt = await request('POST', '/scans/receipt', { imageBase64: 'aGVsbG8=' });
    expect(receipt.status).toBe(200);
    expect(evidenceRows(fridge.json.scan.id)).toEqual([{
      ocr_raw_name: 'Cà chua bi', ocr_quantity: 3, ocr_unit: 'piece', ocr_confidence: 0.42,
      ocr_canonical_id: 'TOMATO', ocr_category: 'vegetable', ocr_storage: 'freezer',
      reviewed_expiry_date: null, reviewed_expiry_kind: null, review_state: 'PENDING',
    }]);
    expect(evidenceRows(receipt.json.receipt.id)).toEqual([{
      ocr_raw_name: 'Thực phẩm bí ẩn OCR', ocr_quantity: 1, ocr_unit: 'l', ocr_confidence: null,
      ocr_canonical_id: null, ocr_category: 'dairy', ocr_storage: 'pantry',
      reviewed_expiry_date: null, reviewed_expiry_kind: null, review_state: 'PENDING',
    }]);
  });

  it.each(['fridge', 'receipt'] as const)('async %s persists the same evidence as the synchronous route', async (scanType) => {
    db.seed(`INSERT INTO scans (id,user_id,household_id,status,scan_type)
      VALUES ('async-${scanType}','evidence-user','evidence-household','pending','${scanType}');`);
    vision.mockResolvedValue({ items: [visionItem] });
    receiptScan.mockResolvedValue({ items: [receiptItem] });
    const message: ScanQueueMessage = { type: 'scan.process.v1', jobId: `job-${scanType}`, scanId: `async-${scanType}`,
      userId: scope.actorId, householdId: scope.householdId, scanType, imageBase64: 'aGVsbG8=' };
    await processScanJob({ DB: db, ENVIRONMENT: 'test' } as unknown as Env, message);
    expect(evidenceRows(`async-${scanType}`)).toEqual([scanType === 'fridge' ? {
      ocr_raw_name: 'Cà chua bi', ocr_quantity: 3, ocr_unit: 'piece', ocr_confidence: 0.42,
      ocr_canonical_id: 'TOMATO', ocr_category: 'vegetable', ocr_storage: 'freezer',
      reviewed_expiry_date: null, reviewed_expiry_kind: null, review_state: 'PENDING',
    } : {
      ocr_raw_name: 'Thực phẩm bí ẩn OCR', ocr_quantity: 1, ocr_unit: 'l', ocr_confidence: null,
      ocr_canonical_id: null, ocr_category: 'dairy', ocr_storage: 'pantry',
      reviewed_expiry_date: null, reviewed_expiry_kind: null, review_state: 'PENDING',
    }]);
  });

  it('confirmation rewrites the working mapping but leaves the retained evidence intact and readable', async () => {
    vision.mockResolvedValue({ items: [visionItem] });
    const fridge = await request('POST', '/scans/fridge', { imageBase64: 'aGVsbG8=' });
    const scanId = fridge.json.scan.id as string;
    const [line] = fridge.json.scan.items;
    expect((await request('POST', `/scans/${scanId}/confirm`, { items: [{
      id: line.id, rawName: 'Đậu phụ', estimatedQuantity: 2, unit: 'piece', category: 'other', storage: 'pantry',
    }] })).status).toBe(200);
    expect(db.query(`SELECT canonical_id, category, storage, ${EVIDENCE_COLUMNS} FROM scan_items WHERE id = ?`, line.id))
      .toEqual([{
        canonical_id: 'TOFU', category: 'other', storage: 'pantry',
        ocr_raw_name: 'Cà chua bi', ocr_quantity: 3, ocr_unit: 'piece', ocr_confidence: 0.42,
        ocr_canonical_id: 'TOMATO', ocr_category: 'vegetable', ocr_storage: 'freezer',
        reviewed_expiry_date: null, reviewed_expiry_kind: 'UNKNOWN', review_state: 'CONFIRMED',
      }]);
    const reloaded = await request('GET', `/scans/${scanId}`);
    expect(reloaded.json.scan.items[0]).toMatchObject({
      canonicalId: 'TOFU', category: 'other', storage: 'pantry', reviewState: 'CONFIRMED',
      rawEvidence: { rawName: 'Cà chua bi', estimatedQuantity: 3, unit: 'piece',
        canonicalId: 'TOMATO', category: 'vegetable', storage: 'freezer' },
    });
  });
});

describe('T13R-A P2-B confirmed expiry survives a reload as exactly what was accepted', () => {
  async function seedReady(scanId: string, scanType: 'fridge' | 'receipt') {
    db.seed(`INSERT INTO scans (id, user_id, household_id, status, scan_type, purchase_date)
        VALUES ('${scanId}', 'evidence-user', 'evidence-household', 'ready', '${scanType}',
          ${scanType === 'receipt' ? "'2026-09-12'" : 'NULL'});
      INSERT INTO scan_items (id, scan_id, raw_name, canonical_id, estimated_quantity, unit, confidence, category, storage,
          ocr_raw_name, ocr_quantity, ocr_unit, ocr_confidence, ocr_canonical_id, ocr_category, ocr_storage)
        VALUES ('${scanId}-known', '${scanId}', 'Cà chua', 'TOMATO', 2, 'piece', 0.9, 'vegetable', 'fridge',
                'Cà chua', 2, 'piece', 0.9, 'TOMATO', 'vegetable', 'fridge'),
               ('${scanId}-estimated', '${scanId}', 'Đậu phụ', 'TOFU', 1, 'piece', 0.9, 'other', 'fridge',
                'Đậu phụ', 1, 'piece', 0.9, 'TOFU', 'other', 'fridge'),
               ('${scanId}-unknown', '${scanId}', 'Trứng gà', 'CHICKEN_EGG', 6, 'piece', 0.9, 'egg', 'fridge',
                'Trứng gà', 6, 'piece', 0.9, 'CHICKEN_EGG', 'egg', 'fridge'),
               ('${scanId}-rejected', '${scanId}', 'Vết bẩn', NULL, 1, 'piece', 0.9, 'other', 'fridge',
                'Vết bẩn', 1, 'piece', 0.2, NULL, 'other', 'fridge');`);
  }

  const confirmation = (scanId: string) => ({ items: [
    { id: `${scanId}-known`, expiryDate: '2030-12-31', expiryEstimated: false },
    { id: `${scanId}-estimated`, expiryDate: '2026-09-20', expiryEstimated: true },
    { id: `${scanId}-unknown` },
    { id: `${scanId}-rejected`, rejected: true },
  ] });

  it.each([
    ['fridge', 'legacy'], ['receipt', 'legacy'], ['fridge', 'native'], ['receipt', 'native'],
  ] as const)('%s scan in %s authority mode round-trips KNOWN / ESTIMATED / UNKNOWN and never invents rejected expiry', async (scanType, mode) => {
    if (mode === 'native') {
      await backfillLegacyInventory(db, scope.householdId);
      await executeInventoryAdoption(db, scope, {}, now);
    }
    const scanId = `expiry-${scanType}-${mode}`;
    await seedReady(scanId, scanType);
    const confirmed = await request('POST', `/scans/${scanId}/confirm`, confirmation(scanId));
    expect(confirmed.status).toBe(200);
    expect(db.query(`SELECT id, review_state, reviewed_expiry_date, reviewed_expiry_kind
      FROM scan_items WHERE scan_id = ? ORDER BY id`, scanId)).toEqual([
      { id: `${scanId}-estimated`, review_state: 'CONFIRMED', reviewed_expiry_date: '2026-09-20', reviewed_expiry_kind: 'ESTIMATED' },
      { id: `${scanId}-known`, review_state: 'CONFIRMED', reviewed_expiry_date: '2030-12-31', reviewed_expiry_kind: 'KNOWN' },
      { id: `${scanId}-rejected`, review_state: 'REJECTED', reviewed_expiry_date: null, reviewed_expiry_kind: null },
      { id: `${scanId}-unknown`, review_state: 'CONFIRMED', reviewed_expiry_date: null, reviewed_expiry_kind: 'UNKNOWN' },
    ]);
    // Reload: the DTO the review pages hydrate from must carry the accepted expiry, not absence.
    const reloaded = await request('GET', `/scans/${scanId}`);
    expect(reloaded.status).toBe(200);
    const byId = new Map(reloaded.json.scan.items.map((item: any) => [item.id, item]));
    expect(byId.get(`${scanId}-known`)).toMatchObject({ reviewState: 'CONFIRMED', expiryDate: '2030-12-31', expiryEstimated: false, expiryKind: 'KNOWN' });
    expect(byId.get(`${scanId}-estimated`)).toMatchObject({ reviewState: 'CONFIRMED', expiryDate: '2026-09-20', expiryEstimated: true, expiryKind: 'ESTIMATED' });
    expect(byId.get(`${scanId}-unknown`)).toMatchObject({ reviewState: 'CONFIRMED', expiryKind: 'UNKNOWN' });
    expect(byId.get(`${scanId}-unknown`)).not.toHaveProperty('expiryDate');
    expect(byId.get(`${scanId}-rejected`)).toMatchObject({ reviewState: 'REJECTED' });
    expect(byId.get(`${scanId}-rejected`)).not.toHaveProperty('expiryDate');
    expect(byId.get(`${scanId}-rejected`)).not.toHaveProperty('expiryKind');
    // Stock authority agrees with what the review now reports.
    const inventory = await request('GET', '/inventory');
    const stock = new Map((inventory.json.items ?? inventory.json).map((row: any) => [row.name, row]));
    expect(stock.get('Cà chua')).toMatchObject({ expiryDate: '2030-12-31' });
    expect(stock.get('Vết bẩn')).toBeUndefined();
  });

  it('a pending line exposes no reviewed expiry', async () => {
    await seedReady('expiry-pending', 'fridge');
    const scan = await request('GET', '/scans/expiry-pending');
    for (const item of scan.json.scan.items) {
      expect(item.reviewState).toBe('PENDING');
      expect(item).not.toHaveProperty('expiryDate');
      expect(item).not.toHaveProperty('expiryKind');
    }
  });
});
