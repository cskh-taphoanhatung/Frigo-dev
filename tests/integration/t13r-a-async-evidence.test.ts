import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SqliteD1 } from '../helpers/sqlite-d1';
import { processScanJob, type ScanQueueMessage } from '../../src/worker/services/scan-queue';
import type { Env } from '../../src/worker/types';

// T13R-A P1-1: the configured production ingestion path (SCAN_QUEUE_MODE=async)
// must persist the same T13 source evidence the synchronous route persists.
// These assertions read the durable scan_items row, not a DTO.

const vision = vi.fn();
const receiptScan = vi.fn();
vi.mock('@frigo/ai', () => ({ AIRouter: class {
  vision = vision;
  receiptScan = receiptScan;
} }));

type Confidence = number | undefined;
const CONFIDENCE_CASES: ReadonlyArray<[label: string, confidence: Confidence]> = [
  ['0', 0], ['0.11', 0.11], ['0.9', 0.9], ['missing', undefined],
];

function fridgeItem(confidence: Confidence) {
  return {
    raw_name: 'Cà chua bi', estimated_quantity: 3, unit: 'piece',
    ...(confidence === undefined ? {} : { confidence }),
    category: 'vegetable', storage: 'freezer',
  };
}

function receiptItem(confidence: Confidence) {
  return {
    raw_name: 'Trung ga OCR', estimated_quantity: 10, unit: 'piece',
    ...(confidence === undefined ? {} : { confidence }),
    category: 'egg', storage: 'pantry', unit_price_vnd: 3500, total_price_vnd: 35000,
  };
}

describe('T13R-A P1-1 async scan ingestion retains T13 source evidence', () => {
  let db: SqliteD1;
  let env: Env;
  const message: ScanQueueMessage = {
    type: 'scan.process.v1', jobId: 'job-evidence', scanId: 'scan-evidence', userId: 'user-a',
    householdId: 'house-a', scanType: 'fridge', imageBase64: 'aGVsbG8=', idempotencyKey: 'command-evidence',
  };
  const rows = () => db.query(`SELECT raw_name, canonical_id, estimated_quantity, unit, confidence, category, storage,
      is_confirmed, review_state, unit_price_vnd, total_price_vnd,
      ocr_raw_name, ocr_quantity, ocr_unit, ocr_confidence
    FROM scan_items WHERE scan_id = ? ORDER BY id`, message.scanId);

  beforeEach(() => {
    db = new SqliteD1();
    db.seed(`INSERT INTO users (id,email) VALUES ('user-a','evidence@example.com');
      INSERT INTO households (id,name,created_by) VALUES ('house-a','A','user-a');
      INSERT INTO scans (id,user_id,household_id,status,scan_type)
        VALUES ('scan-evidence','user-a','house-a','pending','fridge');`);
    env = { DB: db, ENVIRONMENT: 'test' } as unknown as Env;
    vision.mockReset();
    receiptScan.mockReset();
  });
  afterEach(() => db.close());

  it.each(CONFIDENCE_CASES)('async fridge persists raw evidence for confidence %s', async (_label, confidence) => {
    vision.mockResolvedValue({ items: [fridgeItem(confidence)] });
    await processScanJob(env, message);
    expect(db.query('SELECT status FROM scans WHERE id = ?', message.scanId)).toEqual([{ status: 'ready' }]);
    expect(rows()).toEqual([{
      raw_name: 'Cà chua bi', canonical_id: 'TOMATO', estimated_quantity: 3, unit: 'piece',
      // Legacy NOT NULL column keeps its historical filler only when the provider reported nothing.
      confidence: confidence ?? 0.9,
      category: 'vegetable', storage: 'freezer', is_confirmed: 0, review_state: 'PENDING',
      unit_price_vnd: null, total_price_vnd: null,
      ocr_raw_name: 'Cà chua bi', ocr_quantity: 3, ocr_unit: 'piece',
      // The T13 truth column: exact provider confidence, NULL when none was reported.
      ocr_confidence: confidence ?? null,
    }]);
  });

  it.each(CONFIDENCE_CASES)('async receipt persists raw evidence for confidence %s', async (_label, confidence) => {
    db.seed("UPDATE scans SET scan_type = 'receipt'");
    receiptScan.mockResolvedValue({
      merchant_name: 'Bach Hoa', invoice_number: 'INV-1', purchase_date: '2026-09-12', total_amount_vnd: 35000,
      items: [receiptItem(confidence)],
    });
    await processScanJob(env, { ...message, scanType: 'receipt' });
    expect(db.query('SELECT status, merchant_name, purchase_date FROM scans WHERE id = ?', message.scanId))
      .toEqual([{ status: 'ready', merchant_name: 'Bach Hoa', purchase_date: '2026-09-12' }]);
    expect(rows()).toEqual([{
      raw_name: 'Trung ga OCR', canonical_id: null, estimated_quantity: 10, unit: 'piece',
      confidence: confidence ?? 0.9,
      category: 'egg', storage: 'pantry', is_confirmed: 0, review_state: 'PENDING',
      unit_price_vnd: 3500, total_price_vnd: 35000,
      ocr_raw_name: 'Trung ga OCR', ocr_quantity: 10, ocr_unit: 'piece',
      ocr_confidence: confidence ?? null,
    }]);
  });

  it('a receipt line without confidence is a valid unknown-confidence line, not a persistence failure', async () => {
    db.seed("UPDATE scans SET scan_type = 'receipt'");
    receiptScan.mockResolvedValue({ items: [receiptItem(undefined), { ...receiptItem(0.42), raw_name: 'Sua tuoi' }] });
    await expect(processScanJob(env, { ...message, scanType: 'receipt' })).resolves.toBeUndefined();
    expect(db.query('SELECT status FROM scans WHERE id = ?', message.scanId)).toEqual([{ status: 'ready' }]);
    expect(db.query('SELECT status, error_code FROM scan_queue_jobs WHERE id = ?', message.jobId))
      .toEqual([{ status: 'ready', error_code: null }]);
    expect(db.query('SELECT ocr_confidence, confidence FROM scan_items WHERE scan_id = ? ORDER BY id', message.scanId))
      .toEqual([{ ocr_confidence: null, confidence: 0.9 }, { ocr_confidence: 0.42, confidence: 0.42 }]);
  });
});
