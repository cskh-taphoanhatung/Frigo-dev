import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteD1 } from '../helpers/sqlite-d1';

const migrationFiles = () => readdirSync('migrations')
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort();

function applyRange(db: SqliteD1, first: number, last: number) {
  for (const file of migrationFiles().filter((name) => {
    const number = Number(name.slice(0, 4));
    return number >= first && number <= last;
  })) {
    db.seed(readFileSync(`migrations/${file}`, 'utf8'));
  }
}

describe('production 0023 to T13 migration bridge', () => {
  const databases: SqliteD1[] = [];
  const database = () => {
    const db = new SqliteD1({ migrate: false });
    databases.push(db);
    return db;
  };
  afterEach(() => databases.splice(0).forEach((db) => db.close()));

  it('keeps a populated production-shaped database intact while applying only 0024-0033', () => {
    const db = database();
    applyRange(db, 1, 23);
    db.seed(`INSERT INTO scans
        (id, user_id, household_id, status, scan_type, request_fingerprint, image_mime_type)
      VALUES
        ('bridge-receipt', 'demo_user_01', 'demo_household_01', 'ready', 'receipt', 'fingerprint-receipt', 'image/png'),
        ('bridge-fridge', 'demo_user_01', 'demo_household_01', 'ready', 'fridge', 'fingerprint-fridge', 'image/jpeg');
      INSERT INTO scan_items
        (id, scan_id, raw_name, canonical_id, estimated_quantity, unit, confidence, category, storage, is_confirmed)
      VALUES
        ('bridge-missing', 'bridge-receipt', 'Unknown confidence', NULL, 1, 'piece', 0.9, 'other', 'pantry', 0),
        ('bridge-zero', 'bridge-receipt', 'Zero confidence', NULL, 2, 'piece', 0, 'other', 'fridge', 0),
        ('bridge-low', 'bridge-fridge', 'Low confidence', 'TOMATO', 3, 'piece', 0.11, 'vegetable', 'fridge', 0),
        ('bridge-confirmed', 'bridge-fridge', 'Historical confirmed', NULL, 1, 'piece', 0.9, 'other', 'fridge', 1);`);

    const before = {
      scans: db.query(`SELECT id, user_id, household_id, status, scan_type, request_fingerprint,
        image_mime_type FROM scans WHERE id LIKE 'bridge-%' ORDER BY id`),
      items: db.query(`SELECT id, scan_id, raw_name, canonical_id, estimated_quantity, unit,
        confidence, category, storage, is_confirmed FROM scan_items WHERE id LIKE 'bridge-%' ORDER BY id`),
      inventory: db.query(`SELECT id, household_id, ingredient_id, name, quantity, unit, storage,
        expiry_date, opened_at, expiry_kind, expiry_source, version FROM inventory_items ORDER BY id`),
      events: db.query(`SELECT id, household_id, inventory_item_id, event_type, quantity_delta,
        unit, reason, metadata, created_at FROM inventory_events ORDER BY id`),
    };

    applyRange(db, 24, 33);

    expect(db.query(`SELECT id, user_id, household_id, status, scan_type, request_fingerprint,
      image_mime_type FROM scans WHERE id LIKE 'bridge-%' ORDER BY id`)).toEqual(before.scans);
    expect(db.query(`SELECT id, scan_id, raw_name, canonical_id, estimated_quantity, unit,
      confidence, category, storage, is_confirmed FROM scan_items WHERE id LIKE 'bridge-%' ORDER BY id`))
      .toEqual(before.items);
    expect(db.query(`SELECT id, household_id, ingredient_id, name, quantity, unit, storage,
      expiry_date, opened_at, expiry_kind, expiry_source, version FROM inventory_items ORDER BY id`))
      .toEqual(before.inventory);
    expect(db.query(`SELECT id, household_id, inventory_item_id, event_type, quantity_delta,
      unit, reason, metadata, created_at FROM inventory_events ORDER BY id`)).toEqual(before.events);

    expect(db.query(`SELECT id, ocr_raw_name, ocr_quantity, ocr_unit, ocr_confidence,
      ocr_canonical_id, ocr_category, ocr_storage, reviewed_expiry_date, reviewed_expiry_kind,
      review_state FROM scan_items WHERE id LIKE 'bridge-%' ORDER BY id`)).toEqual([
      { id: 'bridge-confirmed', ocr_raw_name: null, ocr_quantity: null, ocr_unit: null,
        ocr_confidence: null, ocr_canonical_id: null, ocr_category: null, ocr_storage: null,
        reviewed_expiry_date: null, reviewed_expiry_kind: null, review_state: 'CONFIRMED' },
      { id: 'bridge-low', ocr_raw_name: 'Low confidence', ocr_quantity: 3, ocr_unit: 'piece',
        ocr_confidence: null, ocr_canonical_id: null, ocr_category: null, ocr_storage: null,
        reviewed_expiry_date: null, reviewed_expiry_kind: null, review_state: 'PENDING' },
      { id: 'bridge-missing', ocr_raw_name: 'Unknown confidence', ocr_quantity: 1, ocr_unit: 'piece',
        ocr_confidence: null, ocr_canonical_id: null, ocr_category: null, ocr_storage: null,
        reviewed_expiry_date: null, reviewed_expiry_kind: null, review_state: 'PENDING' },
      { id: 'bridge-zero', ocr_raw_name: 'Zero confidence', ocr_quantity: 2, ocr_unit: 'piece',
        ocr_confidence: null, ocr_canonical_id: null, ocr_category: null, ocr_storage: null,
        reviewed_expiry_date: null, reviewed_expiry_kind: null, review_state: 'PENDING' },
    ]);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
    expect(db.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
  });

  it('uses 35 unique contiguous migration numbers with production fingerprint at 0023', () => {
    const files = migrationFiles();
    const numbers = files.map((name) => name.slice(0, 4));
    expect(files).toHaveLength(35);
    expect(new Set(numbers).size).toBe(35);
    expect(numbers).toEqual(Array.from({ length: 35 }, (_, index) => String(index + 1).padStart(4, '0')));
    expect(files[22]).toBe('0023_scan_request_fingerprint.sql');
    expect(files[23]).toBe('0024_inventory_truth_foundation.sql');
    expect(files[32]).toBe('0033_scan_evidence_completeness.sql');
    expect(files[33]).toBe('0034_global_recipe_catalog_parity.sql');
    expect(files.at(-1)).toBe('0035_recipe_media_layer.sql');
  });
});
