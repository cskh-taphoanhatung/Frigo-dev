import { afterEach, describe, expect, it } from 'vitest';
import { seedPlannerPreview, createPreviewControls } from '../../scripts/planner-preview-fixtures.mjs';
import { seedT13ReviewEvidence } from '../../scripts/t13-preview-fixtures.mjs';
import { SqliteD1 } from '../helpers/sqlite-d1';

let db;
afterEach(() => db?.close());

describe('T13B isolated browser evidence fixtures', () => {
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
});
