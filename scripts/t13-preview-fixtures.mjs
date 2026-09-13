// Synthetic evidence only, imported exclusively by the isolated Node preview.
export function seedT13ReviewEvidence(db, householdId, userId) {
  const ids = { receipt: 't13b-preview-receipt', undated: 't13b-preview-undated', fridge: 't13b-preview-fridge' };
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
