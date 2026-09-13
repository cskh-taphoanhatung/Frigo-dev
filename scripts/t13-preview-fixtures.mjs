// Synthetic evidence only, imported exclusively by the isolated Node preview.
export const T13_PREVIEW_SCAN_IDS = Object.freeze({
  receipt: 't13b-preview-receipt',
  undated: 't13b-preview-undated',
  fridge: 't13b-preview-fridge',
});

export const T13_PREVIEW_SCENARIO_IDS = Object.freeze({
  legacyTomato: 't13b-preview-legacy-tomato',
  terminalLegacyItem: 't13b-preview-legacy-terminal',
  receiptPurchase: 't13b-preview-receipt-purchase-a',
  receiptPurchaseTomato: 't13b-preview-receipt-purchase-a-tomato',
  receiptMissingHeader: 't13b-preview-receipt-missing-header-b',
  receiptMissingHeaderUnknown: 't13b-preview-receipt-missing-header-b-unknown',
  confirmedEmpty: 't13b-preview-confirmed-empty',
});

export function seedT13ReviewEvidence(db, householdId, userId) {
  const ids = T13_PREVIEW_SCAN_IDS;
  const lines = [
    ['Cà chua', 4, 'piece', null, 18000],
    ['Sữa tươi', 1, 'l', 0, null],
    ['Nhãn hàng chưa nhận diện', 1, 'pack', 0.11, null],
    ['Cà rốt', 2, 'piece', 0.9, 12000],
  ];
  db.seed('BEGIN IMMEDIATE');
  try {
    for (const [kind, id] of Object.entries(ids)) {
      if (db.query('SELECT id FROM scans WHERE id = ?', id).length) continue;
      db.execute(`INSERT INTO scans (id,user_id,household_id,status,scan_type,merchant_name,purchase_date)
        VALUES (?, ?, ?, 'ready', ?, ?, ?)`, [id, userId, householdId,
        kind === 'fridge' ? 'fridge' : 'receipt', kind === 'receipt' ? 'Cửa hàng thử nghiệm' : null,
        kind === 'receipt' ? '2026-09-12' : null]);
      lines.forEach(([name, quantity, unit, confidence, price], index) => {
        // Legacy confidence is NOT NULL; nullable OCR confidence is the API evidence.
        db.execute(`INSERT INTO scan_items
          (id,scan_id,raw_name,estimated_quantity,unit,confidence,category,storage,total_price_vnd,
           ocr_raw_name,ocr_quantity,ocr_unit,ocr_confidence)
          VALUES (?, ?, ?, ?, ?, ?, 'other', 'fridge', ?, ?, ?, ?, ?)`,
        [`${id}-${index}`, id, name, quantity, unit, confidence ?? 0.9,
          kind === 'receipt' ? price : null, name, quantity, unit, confidence]);
      });
    }
    db.seed('COMMIT');
  } catch (error) {
    db.seed('ROLLBACK');
    throw error;
  }
  return ids;
}

// Fixed browser fixtures only. This must not accept caller-provided names, SQL, or values.
export function seedT13ScenarioEvidence(db, householdId, userId) {
  const ids = T13_PREVIEW_SCENARIO_IDS;
  if (db.query('SELECT id FROM scans WHERE id = ?', ids.receiptPurchase).length) return ids;
  db.seed('BEGIN IMMEDIATE');
  try {
    db.execute(`INSERT INTO inventory_items
      (id, household_id, ingredient_id, name, quantity, unit, category, storage, version) VALUES
      (?, ?, 'TOMATO', 'Cà chua cũ', 3, 'piece', 'vegetable', 'fridge', 1),
      (?, ?, NULL, 'Hộp thực phẩm đã hết', 0, 'pack', 'other', 'pantry', 1)`,
    [ids.legacyTomato, householdId, ids.terminalLegacyItem, householdId]);
    db.execute(`INSERT INTO scans
      (id, user_id, household_id, status, scan_type, merchant_name, invoice_number, purchase_date, total_amount_vnd)
      VALUES (?, ?, ?, 'ready', 'receipt', 'Cửa hàng A', 'A-2026-001', '2026-09-10', 42000),
        (?, ?, ?, 'ready', 'receipt', NULL, NULL, NULL, NULL),
        (?, ?, ?, 'confirmed', 'fridge', NULL, NULL, NULL, NULL)`,
    [ids.receiptPurchase, userId, householdId, ids.receiptMissingHeader, userId, householdId,
      ids.confirmedEmpty, userId, householdId]);
    db.execute(`INSERT INTO scan_items
      (id, scan_id, raw_name, canonical_id, estimated_quantity, unit, confidence, category, storage,
       total_price_vnd, ocr_raw_name, ocr_quantity, ocr_unit, ocr_confidence)
      VALUES (?, ?, 'Cà chua OCR A', 'TOMATO', 2, 'piece', 0.9, 'vegetable', 'fridge', 42000,
        'Cà chua OCR A', 2, 'piece', 0.9),
        (?, ?, 'Thực phẩm bí ẩn B', NULL, 1, 'pack', 0.11, 'other', 'pantry', NULL,
        'Thực phẩm bí ẩn B', 1, 'pack', 0.11)`,
    [ids.receiptPurchaseTomato, ids.receiptPurchase, ids.receiptMissingHeaderUnknown, ids.receiptMissingHeader]);
    db.seed('COMMIT');
  } catch (error) {
    db.seed('ROLLBACK');
    throw error;
  }
  return ids;
}

function boundedEventEvidence(metadata) {
  try {
    const parsed = JSON.parse(metadata);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const scanId = typeof parsed.scanId === 'string' ? parsed.scanId : null;
    const scanItemId = typeof parsed.scanItemId === 'string' ? parsed.scanItemId : null;
    const sourceQuantity = typeof parsed.sourceQuantity === 'number' ? parsed.sourceQuantity : null;
    const sourceUnit = typeof parsed.sourceUnit === 'string' ? parsed.sourceUnit : null;
    return scanId || scanItemId || sourceQuantity !== null || sourceUnit
      ? { scanId, scanItemId, sourceQuantity, sourceUnit }
      : null;
  } catch {
    return null;
  }
}

/** Bounded evidence inspector for the isolated browser fixture, never a database API. */
export function t13PreviewState(db, householdId) {
  const scanFilter = `FROM scans WHERE household_id = ? AND id GLOB 't13b-preview-*'`;
  const scans = db.query(`SELECT id, status, scan_type, merchant_name, invoice_number, purchase_date, total_amount_vnd
    ${scanFilter} ORDER BY id LIMIT 16`, householdId).map((row) => ({
    id: row.id, status: row.status, scanType: row.scan_type, merchantName: row.merchant_name,
    invoiceNumber: row.invoice_number, purchaseDate: row.purchase_date, totalAmountVnd: row.total_amount_vnd,
  }));
  const scanItems = db.query(`SELECT i.id, i.scan_id, i.raw_name, i.canonical_id, i.estimated_quantity, i.unit,
      i.total_price_vnd, i.ocr_raw_name, i.ocr_quantity, i.ocr_unit, i.ocr_confidence, i.review_state, i.is_confirmed
    FROM scan_items i JOIN scans s ON s.id = i.scan_id
    WHERE s.household_id = ? AND s.id GLOB 't13b-preview-*' ORDER BY i.id LIMIT 64`, householdId)
    .map((row) => ({
      id: row.id, scanId: row.scan_id, rawName: row.raw_name, canonicalId: row.canonical_id,
      estimatedQuantity: row.estimated_quantity, unit: row.unit, totalPriceVnd: row.total_price_vnd,
      rawEvidence: { rawName: row.ocr_raw_name, quantity: row.ocr_quantity, unit: row.ocr_unit },
      confidence: row.ocr_confidence, reviewState: row.review_state, isConfirmed: Boolean(row.is_confirmed),
    }));
  const lots = db.query(`SELECT id, ingredient_id, raw_name, quantity_milli, canonical_unit, state, source_type,
      source_id, purchased_at, expiry_at, estimated_expiry_at, expiry_kind, version
    FROM inventory_lots WHERE household_id = ? ORDER BY id LIMIT 64`, householdId)
    .map((row) => ({
      id: row.id, ingredientId: row.ingredient_id, rawName: row.raw_name, quantityMilli: row.quantity_milli,
      unit: row.canonical_unit, state: row.state, sourceType: row.source_type, sourceId: row.source_id,
      purchasedAt: row.purchased_at, expiryAt: row.expiry_at, estimatedExpiryAt: row.estimated_expiry_at,
      expiryKind: row.expiry_kind, version: row.version,
    }));
  const events = db.query(`SELECT id, event_type, inventory_item_id, quantity_delta, unit, metadata
    FROM inventory_events WHERE household_id = ? ORDER BY id LIMIT 64`, householdId).map((row) => ({
    id: row.id, eventType: row.event_type, inventoryItemId: row.inventory_item_id,
    quantityDelta: row.quantity_delta, unit: row.unit, evidence: boundedEventEvidence(row.metadata),
  }));
  const adoption = db.query(`SELECT source_inventory_version, result_json
    FROM inventory_adoption_receipts WHERE household_id = ? LIMIT 1`, householdId)[0];
  let adoptionSummary = { active: false, sourceInventoryVersion: null, mappedLotCount: 0 };
  if (adoption) {
    try {
      const result = JSON.parse(adoption.result_json);
      adoptionSummary = {
        active: true,
        sourceInventoryVersion: adoption.source_inventory_version,
        mappedLotCount: Number.isInteger(result?.mappedLotCount) ? result.mappedLotCount : 0,
      };
    } catch {
      adoptionSummary = { active: true, sourceInventoryVersion: adoption.source_inventory_version, mappedLotCount: 0 };
    }
  }
  return { fixture: 't13b-preview-e2e-v1', householdId, scans, scanItems, lots, events, adoption: adoptionSummary };
}
