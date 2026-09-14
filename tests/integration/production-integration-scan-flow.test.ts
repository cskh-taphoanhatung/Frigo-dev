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
import { sha256Hex } from '../../src/worker/utils/session';
import { SqliteD1 } from '../helpers/sqlite-d1';

const vision = vi.fn();
const receiptScan = vi.fn();
vi.mock('@frigo/ai', () => ({ AIRouter: class {
  vision = vision;
  receiptScan = receiptScan;
} }));

const USER_ID = 'integration-scan-user';
const HOUSEHOLD_ID = 'integration-scan-household';
const SECRET = 'integration-scan-secret-that-is-long-enough';
const IMAGE = 'aGVsbG8=';

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', authMiddleware);
app.route('/', inventoryRoutes);
app.route('/', scanRoutes);

describe('production Qwen queue to T13 inventory authority', () => {
  let db: SqliteD1;
  let token: string;

  beforeEach(async () => {
    db = new SqliteD1();
    db.seed(`INSERT INTO users (id, email) VALUES ('${USER_ID}', 'integration-scan@example.test');
      INSERT INTO households (id, name, created_by)
        VALUES ('${HOUSEHOLD_ID}', 'Integration scan', '${USER_ID}');
      INSERT INTO household_members (id, household_id, user_id, role)
        VALUES ('integration-scan-member', '${HOUSEHOLD_ID}', '${USER_ID}', 'owner');`);
    await backfillLegacyInventory(db, HOUSEHOLD_ID);
    await executeInventoryAdoption(db, { householdId: HOUSEHOLD_ID, actorId: USER_ID }, {}, '2026-09-15T00:00:00Z');
    token = await signJwt({ sub: USER_ID, hid: HOUSEHOLD_ID, typ: 'access',
      exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET);
    vision.mockReset();
    receiptScan.mockReset();
  });

  afterEach(() => db.close());

  async function enqueue(scanId: string, scanType: 'fridge' | 'receipt') {
    const requestFingerprint = await sha256Hex(`${scanType}\nimage/jpeg\n${IMAGE}`);
    db.seed(`INSERT INTO scans
      (id, user_id, household_id, status, scan_type, request_fingerprint, image_mime_type)
      VALUES ('${scanId}', '${USER_ID}', '${HOUSEHOLD_ID}', 'pending', '${scanType}',
        '${requestFingerprint}', 'image/jpeg')`);
    const message: ScanQueueMessage = {
      type: 'scan.process.v1', jobId: `job-${scanId}`, scanId, userId: USER_ID,
      householdId: HOUSEHOLD_ID, scanType, imageBase64: IMAGE,
      mimeType: 'image/jpeg', idempotencyKey: `command-${scanId}`, requestFingerprint,
    };
    await processScanJob({ DB: db, ENVIRONMENT: 'test' } as unknown as Env, message);
    return requestFingerprint;
  }

  async function confirm(scanId: string) {
    const [line] = db.query<{ id: string }>('SELECT id FROM scan_items WHERE scan_id = ?', scanId);
    const response = await app.fetch(new Request(`https://integration.example/scans/${scanId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ id: line.id }] }),
    }), { DB: db, ENVIRONMENT: 'test', JWT_SECRET: SECRET, WEEK_SCHEMA_MODE: 'legacy' } as Env);
    return { status: response.status, json: await response.json() as Record<string, unknown> };
  }

  it('preserves receipt fingerprint and raw evidence through confirmation and idempotent replay', async () => {
    receiptScan.mockResolvedValue({
      merchant_name: 'Integration Market', purchase_date: '2026-09-15', total_amount_vnd: 12000,
      items: [{ raw_name: 'Cà chua', canonical_id: 'TOMATO', estimated_quantity: 2, unit: 'piece',
        confidence: 0.11, category: 'vegetable', storage: 'pantry', total_price_vnd: 12000 }],
    });
    const fingerprint = await enqueue('integration-receipt', 'receipt');

    expect(await confirm('integration-receipt')).toMatchObject({ status: 200, json: { success: true } });
    expect(db.query(`SELECT request_fingerprint, image_mime_type, status FROM scans
      WHERE id = 'integration-receipt'`)).toEqual([{
      request_fingerprint: fingerprint, image_mime_type: 'image/jpeg', status: 'confirmed',
    }]);
    expect(db.query(`SELECT ocr_raw_name, ocr_quantity, ocr_unit, ocr_confidence,
      ocr_canonical_id, ocr_category, ocr_storage, review_state FROM scan_items`)).toEqual([{
      ocr_raw_name: 'Cà chua', ocr_quantity: 2, ocr_unit: 'piece', ocr_confidence: 0.11,
      ocr_canonical_id: 'TOMATO', ocr_category: 'vegetable', ocr_storage: 'pantry',
      review_state: 'CONFIRMED',
    }]);
    expect(db.query('SELECT source_type, source_id FROM inventory_lots')).toEqual([{
      source_type: 'RECEIPT', source_id: 'integration-receipt',
    }]);
    expect(db.query('SELECT source_type FROM inventory_observations')).toEqual([{ source_type: 'RECEIPT' }]);

    const beforeReplay = {
      lots: db.query('SELECT * FROM inventory_lots ORDER BY id'),
      commands: db.query('SELECT * FROM inventory_commands ORDER BY id'),
      events: db.query('SELECT * FROM inventory_events ORDER BY id'),
      observations: db.query('SELECT * FROM inventory_observations ORDER BY id'),
    };
    const replay = await confirm('integration-receipt');
    expect(replay).toMatchObject({ status: 200, json: { success: true, idempotentReplay: true } });
    expect({
      lots: db.query('SELECT * FROM inventory_lots ORDER BY id'),
      commands: db.query('SELECT * FROM inventory_commands ORDER BY id'),
      events: db.query('SELECT * FROM inventory_events ORDER BY id'),
      observations: db.query('SELECT * FROM inventory_observations ORDER BY id'),
    }).toEqual(beforeReplay);
  });

  it('keeps fridge provenance as SCAN after the async queue path', async () => {
    vision.mockResolvedValue({ items: [{ raw_name: 'Trứng gà', canonical_id: 'CHICKEN_EGG',
      estimated_quantity: 6, unit: 'piece', confidence: 0, category: 'egg', storage: 'fridge' }] });
    await enqueue('integration-fridge', 'fridge');

    expect(await confirm('integration-fridge')).toMatchObject({ status: 200, json: { success: true } });
    expect(db.query('SELECT source_type, source_id FROM inventory_lots')).toEqual([{
      source_type: 'SCAN', source_id: 'integration-fridge',
    }]);
    expect(db.query('SELECT source_type FROM inventory_observations')).toEqual([{ source_type: 'SCAN' }]);
    expect(db.query('SELECT confidence, ocr_confidence FROM scan_items')).toEqual([{
      confidence: 0, ocr_confidence: 0,
    }]);
  });
});
