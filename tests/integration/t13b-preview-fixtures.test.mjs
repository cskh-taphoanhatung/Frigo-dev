import { afterEach, describe, expect, it, vi } from 'vitest';
import { seedPlannerPreview, createPreviewControls } from '../../scripts/planner-preview-fixtures.mjs';
import {
  seedT13ReviewEvidence, seedT13ScenarioEvidence, t13PreviewState,
  T13_PREVIEW_SCENARIO_IDS,
} from '../../scripts/t13-preview-fixtures.mjs';
import { executeInventoryAdoption } from '../../packages/db/src/inventory-adoption-executor';
import { SqliteD1 } from '../helpers/sqlite-d1';
import { seedT13ReconciliationEvidence } from '../../scripts/t13-reconciliation-fixtures.mjs';
import { recordInventoryObservation } from '../../packages/db/src/inventory-observations';
import { fetchWorker } from '../helpers/worker-fetch.mjs';

vi.mock('../../src/worker/services/email', () => ({ sendEmail: vi.fn(), buildOtpEmail: vi.fn() }));

let db;
afterEach(() => db?.close());

describe('T13B isolated browser evidence fixtures', () => {
  it('keeps all browser controls out of the production worker', async () => {
    for (const name of ['t13-scans', 't13-scenarios', 't13-state', 't13-operator-requests', 't13-reconciliation']) {
      const response = await fetchWorker(new Request(`https://example.test/__preview/${name}`, { method: 'POST' }),
        { ENVIRONMENT: 'production', APP_URL: 'https://example.test',
          DB: {}, CACHE: {}, AI: {}, IMAGES: {}, SCAN_QUEUE: {}, SCAN_QUEUE_MODE: 'async',
          QWEN_API_KEY: 'isolated-test-qwen-key',
          JWT_SECRET: 'isolated-test-signing-secret'.repeat(2), OTP_HASH_SECRET: 'isolated-test-otp-secret',
          TURNSTILE_SITE_KEY: 'isolated-test-site', TURNSTILE_SECRET_KEY: 'isolated-test-key' });
      expect(response.status).toBe(404);
    }
  });

  it('records actionable synthetic observations without mutating stock and keeps controls same-origin', async () => {
    db = new SqliteD1();
    seedPlannerPreview(db);
    await executeInventoryAdoption(db, { householdId: 'planner-preview-household', actorId: 'planner-preview-user' }, {}, new Date().toISOString());
    const stock = db.query('SELECT * FROM inventory_lots ORDER BY id');
    const seed = () => seedT13ReconciliationEvidence(db, 'planner-preview-household', 'planner-preview-user', recordInventoryObservation);
    const ids = await seed();
    expect((await seed()).observationIds).toEqual(ids.observationIds);
    expect(db.query('SELECT * FROM inventory_lots ORDER BY id')).toEqual(stock);
    expect(db.query('SELECT id FROM inventory_observations')).toHaveLength(2);
    const controls = createPreviewControls({ getDatabase: () => db, resetDatabase: () => {}, seedReconciliation: seed });
    for (const name of ['t13-operator-requests', 't13-reconciliation']) {
      const denied = await controls(new Request(`http://localhost/__preview/${name}`, {
        method: 'POST', headers: { Origin: 'https://foreign.example' },
      }));
      expect(denied.status).toBe(403);
      const get = await controls(new Request(`http://localhost/__preview/${name}`, { headers: { Origin: 'http://localhost' } }));
      expect(get.status).toBe(405);
    }
  });
  it('retains real unknown/zero/low confidence without changing stock and seeds idempotently', () => {
    db = new SqliteD1();
    seedPlannerPreview(db);
    const stock = db.query('SELECT * FROM inventory_items ORDER BY id');
    const ids = seedT13ReviewEvidence(db, 'planner-preview-household', 'planner-preview-user');
    expect(db.query('SELECT ocr_confidence FROM scan_items WHERE scan_id = ? ORDER BY id', ids.fridge))
      .toEqual([null, 0, 0.11, 0.9].map((ocr_confidence) => ({ ocr_confidence })));
    const scans = db.query('SELECT * FROM scans ORDER BY id');
    const items = db.query('SELECT * FROM scan_items ORDER BY id');
    seedT13ReviewEvidence(db, 'planner-preview-household', 'planner-preview-user');
    expect(db.query('SELECT * FROM scans ORDER BY id')).toEqual(scans);
    expect(db.query('SELECT * FROM scan_items ORDER BY id')).toEqual(items);
    expect(db.query('SELECT * FROM inventory_items ORDER BY id')).toEqual(stock);
    expect(db.query('SELECT id FROM inventory_lots')).toEqual([]);
  });

  it('keeps the synthetic control behind the existing same-origin POST fence', async () => {
    db = new SqliteD1();
    seedPlannerPreview(db);
    const control = createPreviewControls({ getDatabase: () => db, resetDatabase: () => {} });
    const denied = await control(new Request('http://localhost/__preview/t13-scans', {
      method: 'POST', headers: { Origin: 'https://foreign.example' },
    }));
    expect(denied?.status).toBe(403);
    expect(db.query('SELECT id FROM scans')).toEqual([]);
    const allowed = await control(new Request('http://localhost/__preview/t13-scans', {
      method: 'POST', headers: { Origin: 'http://localhost' },
    }));
    expect(allowed?.status).toBe(200);
    expect(db.query('SELECT id FROM scans')).toHaveLength(3);
  });

  it('seeds deterministic scenario evidence without changing stock beyond its fixed legacy rows', () => {
    db = new SqliteD1();
    seedPlannerPreview(db);
    const before = db.query('SELECT id, quantity, unit FROM inventory_items ORDER BY id');
    const ids = seedT13ScenarioEvidence(db, 'planner-preview-household', 'planner-preview-user');
    expect(ids).toEqual(T13_PREVIEW_SCENARIO_IDS);
    expect(db.query('SELECT id, quantity, unit FROM inventory_items ORDER BY id')).toEqual([
      ...before,
      { id: ids.legacyTomato, quantity: 3, unit: 'piece' },
      { id: ids.terminalLegacyItem, quantity: 0, unit: 'pack' },
    ].sort((a, b) => a.id.localeCompare(b.id)));
    expect(db.query('SELECT id, status FROM scans WHERE id GLOB ? ORDER BY id', 't13b-preview-*')).toEqual([
      { id: ids.confirmedEmpty, status: 'confirmed' },
      { id: ids.receiptMissingHeader, status: 'ready' },
      { id: ids.receiptPurchase, status: 'ready' },
    ]);
    expect(db.query('SELECT merchant_name, invoice_number, purchase_date, total_amount_vnd FROM scans WHERE id = ?', ids.receiptPurchase))
      .toEqual([{ merchant_name: 'Cửa hàng A', invoice_number: 'A-2026-001', purchase_date: '2026-09-10', total_amount_vnd: 42000 }]);
    expect(db.query('SELECT merchant_name, invoice_number, purchase_date, total_amount_vnd FROM scans WHERE id = ?', ids.receiptMissingHeader))
      .toEqual([{ merchant_name: null, invoice_number: null, purchase_date: null, total_amount_vnd: null }]);
    expect(db.query('SELECT canonical_id, ocr_confidence FROM scan_items WHERE id = ?', ids.receiptMissingHeaderUnknown))
      .toEqual([{ canonical_id: null, ocr_confidence: 0.11 }]);
    const snapshot = t13PreviewState(db, 'planner-preview-household');
    expect(snapshot.scanItems).toContainEqual({
      id: ids.receiptMissingHeaderUnknown, scanId: ids.receiptMissingHeader, rawName: 'Thực phẩm bí ẩn B',
      canonicalId: null, estimatedQuantity: 1, unit: 'pack', totalPriceVnd: null,
      rawEvidence: { rawName: 'Thực phẩm bí ẩn B', quantity: 1, unit: 'pack' },
      confidence: 0.11, reviewState: 'PENDING', isConfirmed: false,
    });
    db.seed(`INSERT INTO households (id, name, created_by) VALUES ('foreign-preview-household', 'Foreign', 'planner-preview-user');
      INSERT INTO scans (id, user_id, household_id, status, scan_type)
      VALUES ('t13b-preview-foreign-scan', 'planner-preview-user', 'foreign-preview-household', 'ready', 'fridge');`);
    expect(t13PreviewState(db, 'planner-preview-household').scans.map(({ id }) => id))
      .not.toContain('t13b-preview-foreign-scan');
    seedT13ScenarioEvidence(db, 'planner-preview-household', 'planner-preview-user');
    expect(t13PreviewState(db, 'planner-preview-household')).toEqual(snapshot);
  });

  it('exposes only bounded household evidence through same-origin preview controls', async () => {
    db = new SqliteD1();
    seedPlannerPreview(db);
    const control = createPreviewControls({ getDatabase: () => db, resetDatabase: () => {} });
    const origin = 'http://localhost';
    const denied = await control(new Request(`${origin}/__preview/t13-scenarios`, {
      method: 'POST', headers: { Origin: 'https://foreign.example' },
    }));
    expect(denied?.status).toBe(403);
    expect(db.query('SELECT id FROM scans')).toEqual([]);
    const seeded = await control(new Request(`${origin}/__preview/t13-scenarios?name=attacker`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: 'DROP TABLE scans', name: 'attacker' }),
    }));
    expect(seeded?.status).toBe(200);
    expect(await seeded?.json()).toEqual(T13_PREVIEW_SCENARIO_IDS);
    const state = await control(new Request(`${origin}/__preview/t13-state`, { method: 'POST', headers: { Origin: origin } }));
    expect(state?.status).toBe(200);
    const body = await state?.json();
    expect(body).toMatchObject({ fixture: 't13b-preview-e2e-v1', householdId: 'planner-preview-household' });
    expect(body.scans).toHaveLength(3);
    expect(body.scanItems).toHaveLength(2);
    expect(body.adoption).toEqual({ active: false, sourceInventoryVersion: null, mappedLotCount: 0 });
    expect(JSON.stringify(body).toLowerCase()).not.toMatch(/session|token|secret|jwt|password|sql|attacker/);
    expect(await control(new Request(`${origin}/api/v1/t13-state`, { method: 'POST', headers: { Origin: origin } }))).toBeNull();
    const getOnly = await control(new Request(`${origin}/__preview/t13-state`, { method: 'GET', headers: { Origin: origin } }));
    expect(getOnly?.status).toBe(405);
  });

  it('reports an adopted scenario with a bounded receipt summary', async () => {
    db = new SqliteD1();
    seedPlannerPreview(db);
    const ids = seedT13ScenarioEvidence(db, 'planner-preview-household', 'planner-preview-user');
    const adoption = await executeInventoryAdoption(db, {
      householdId: 'planner-preview-household', actorId: 'planner-preview-user',
    }, {
      terminalEvidence: [{ legacyItemId: ids.terminalLegacyItem, state: 'DISCARDED', reason: 'Kiểm tra thử nghiệm' }],
    }, '2026-09-13T00:00:00.000Z');
    const state = t13PreviewState(db, 'planner-preview-household');
    expect(state.adoption).toEqual({
      active: true, sourceInventoryVersion: adoption.result.sourceInventoryVersion,
      mappedLotCount: adoption.result.mappedLotCount,
    });
    expect(state.lots).toContainEqual(expect.objectContaining({
      sourceId: ids.legacyTomato, quantityMilli: 3000, unit: 'piece', sourceType: 'LEGACY_BACKFILL',
    }));
    expect(JSON.stringify(state)).not.toContain('result_json');
  });
});
