import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_dev, unstable_splitSqlQuery } from 'wrangler';

// T13 real workerd/D1 proof. Everything here runs against the real migrations
// (0001-0031), the real CHECK constraints and triggers, and the REAL scan
// confirm / inventory truth Hono handlers — not a reimplementation.

let worker;
let directory;
const token = randomUUID();
const now = '2026-09-11T10:00:00Z';
const scope = { householdId: '', actorId: '' };
const foreign = { householdId: '', actorId: '' };

async function batch(statements) {
  const response = await worker.fetch('http://localhost/', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-token': token },
    body: JSON.stringify({ statements: statements.map((statement) =>
      typeof statement === 'string' ? { sql: statement } : statement) }),
  });
  return { status: response.status, ...await response.json() };
}

async function post(pathname, body) {
  const response = await worker.fetch(`http://localhost/${pathname}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-token': token },
    body: JSON.stringify(body),
  });
  return { status: response.status, ...await response.json() };
}

const query = async (sql, values = []) => (await batch([{ sql, values }])).results[0].results;

async function seedHousehold(target, label) {
  const id = randomUUID();
  target.householdId = `household-${id}`;
  target.actorId = `actor-${id}`;
  expect(await batch([
    { sql: 'INSERT INTO users(id) VALUES (?)', values: [target.actorId] },
    { sql: 'INSERT INTO households(id,name,created_by) VALUES (?, ?, ?)', values: [target.householdId, label, target.actorId] },
    { sql: "INSERT INTO household_members(id,household_id,user_id,role) VALUES (?, ?, ?, 'owner')",
      values: [`member-${id}`, target.householdId, target.actorId] },
  ])).toMatchObject({ status: 200 });
  expect(await post('adopt', { scope: target, now })).toMatchObject({ status: 200 });
}

async function seedScan(options) {
  const owner = options.scope ?? scope;
  await batch([
    { sql: `INSERT INTO scans (id, user_id, household_id, status, scan_type, merchant_name, purchase_date)
        VALUES (?, ?, ?, 'ready', ?, ?, ?)`,
      values: [options.scanId, owner.actorId, owner.householdId, options.scanType,
        options.merchant ?? null, options.purchaseDate ?? null] },
    ...options.lines.map((line) => ({
      sql: `INSERT INTO scan_items (id, scan_id, raw_name, canonical_id, estimated_quantity, unit,
        confidence, category, storage, unit_price_vnd, total_price_vnd,
        ocr_raw_name, ocr_quantity, ocr_unit, ocr_confidence)
        VALUES (?, ?, ?, NULL, ?, ?, 0.9, 'other', 'fridge', ?, ?, ?, ?, ?, ?)`,
      values: [line.id, options.scanId, line.rawName, line.quantity, line.unit,
        line.unitPriceVnd ?? null, line.totalPriceVnd ?? null,
        line.rawName, line.quantity, line.unit, line.confidence ?? null],
    })),
  ]);
}

const confirm = (scanId, items, owner = scope) =>
  post('scan-confirm', { scope: owner, scanId, items });

const lotsOf = (householdId) => query(
  `SELECT id, source_type, source_id, purchased_at, currency, amount_minor, minor_digits,
     expiry_at, estimated_expiry_at, expiry_kind, quantity_milli, raw_name
   FROM inventory_lots WHERE household_id = ? ORDER BY id`, [householdId]);

beforeAll(async () => {
  directory = mkdtempSync(path.join(tmpdir(), 'frigo-t13-d1-'));
  const config = path.join(directory, 'wrangler.json');
  writeFileSync(config, JSON.stringify({ name: 'frigo-t13-local-proof', compatibility_date: '2025-03-01' }));
  worker = await unstable_dev(path.resolve('tests/helpers/inventory-lot-d1-worker.ts'), {
    config, ip: '127.0.0.1', port: 0, inspectorPort: 0, local: true, persist: false,
    logLevel: 'error', vars: { TEST_TOKEN: token },
    experimental: {
      disableExperimentalWarning: true, disableDevRegistry: true, forceLocal: true, watch: false,
      d1Databases: [{ binding: 'DB', database_name: 't13-isolated-test', database_id: '00000000-0000-0000-0000-000000000031' }],
    },
  });
  // Fresh 0001 -> 0031 replay on real D1.
  for (const file of readdirSync('migrations').filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
    const result = await batch(unstable_splitSqlQuery(readFileSync(`migrations/${file}`, 'utf8')));
    expect(result, file).toMatchObject({ status: 200 });
  }
  await seedHousehold(scope, 'T13 D1');
  await seedHousehold(foreign, 'T13 D1 foreign');
}, 120_000);

afterAll(async () => {
  await worker?.stop();
  if (directory) rmSync(directory, { recursive: true, force: true });
});

describe('T13 real local D1 receipt/vision truth (no remote binding)', () => {
  it('1. receipt confirmation creates a RECEIPT lot readable through T11 authority', async () => {
    await seedScan({ scanId: 'd1-receipt-1', scanType: 'receipt',
      lines: [{ id: 'd1-line-1', rawName: 'Ca chua', quantity: 3, unit: 'piece' }] });
    const result = await confirm('d1-receipt-1', [
      { id: 'd1-line-1', rawName: 'Ca chua', estimatedQuantity: 3, unit: 'piece' },
    ]);
    expect(result).toMatchObject({ status: 200 });
    expect(result.body.success).toBe(true);

    const lot = (await lotsOf(scope.householdId)).find((entry) => entry.raw_name === 'Ca chua');
    expect(lot.source_type).toBe('RECEIPT');
    expect(lot.source_id).toBe('d1-receipt-1');

    const read = await post('read', { scope, lot: { lotId: lot.id } });
    expect(read.status).toBe(200);
    expect(read.lot).toMatchObject({ lotId: lot.id, sourceType: 'RECEIPT' });
  });

  it('2. receipt purchase facts are persisted exactly by the real schema', async () => {
    await seedScan({ scanId: 'd1-receipt-2', scanType: 'receipt', purchaseDate: '2026-09-10',
      merchant: 'WinMart',
      lines: [{ id: 'd1-line-2', rawName: 'Thit heo', quantity: 2, unit: 'kg', totalPriceVnd: 85000 }] });
    expect(await confirm('d1-receipt-2', [
      { id: 'd1-line-2', rawName: 'Thit heo', estimatedQuantity: 2, unit: 'kg' },
    ])).toMatchObject({ status: 200 });

    const lot = (await lotsOf(scope.householdId)).find((entry) => entry.raw_name === 'Thit heo');
    expect(lot.purchased_at).toBe('2026-09-10');
    expect(lot.currency).toBe('VND');
    expect(lot.amount_minor).toBe(85000);
    expect(lot.minor_digits).toBe(0);
  });

  it('3. missing purchase facts stay NULL rather than fabricated', async () => {
    await seedScan({ scanId: 'd1-receipt-3', scanType: 'receipt',
      lines: [{ id: 'd1-line-3', rawName: 'Hanh tay', quantity: 2, unit: 'piece' }] });
    expect(await confirm('d1-receipt-3', [
      { id: 'd1-line-3', rawName: 'Hanh tay', estimatedQuantity: 2, unit: 'piece' },
    ])).toMatchObject({ status: 200 });

    const lot = (await lotsOf(scope.householdId)).find((entry) => entry.raw_name === 'Hanh tay');
    expect(lot.purchased_at).toBeNull();
    expect(lot.amount_minor).toBeNull();
    expect(lot.currency).toBeNull();
  });

  it('4. estimated vs known expiry are distinguished under the real 0023 CHECK', async () => {
    await seedScan({ scanId: 'd1-receipt-4', scanType: 'receipt',
      lines: [
        { id: 'd1-line-4a', rawName: 'Sua tuoi', quantity: 1, unit: 'l' },
        { id: 'd1-line-4b', rawName: 'Sua chua', quantity: 4, unit: 'piece' },
      ] });
    expect(await confirm('d1-receipt-4', [
      // No date supplied: default shelf life is an estimate.
      { id: 'd1-line-4a', rawName: 'Sua tuoi', estimatedQuantity: 1, unit: 'l' },
      // Explicit date: a dated fact.
      { id: 'd1-line-4b', rawName: 'Sua chua', estimatedQuantity: 4, unit: 'piece', expiryDate: '2026-09-30' },
    ])).toMatchObject({ status: 200 });

    const lots = await lotsOf(scope.householdId);
    const estimated = lots.find((entry) => entry.raw_name === 'Sua tuoi');
    expect(estimated.expiry_kind).toBe('ESTIMATED');
    expect(estimated.expiry_at).toBeNull();
    expect(estimated.estimated_expiry_at).not.toBeNull();

    const known = lots.find((entry) => entry.raw_name === 'Sua chua');
    expect(known.expiry_kind).toBe('KNOWN');
    expect(known.expiry_at).toBe('2026-09-30');
    expect(known.estimated_expiry_at).toBeNull();
  });

  it('5. raw OCR evidence survives a correction in the real 0031 columns', async () => {
    await seedScan({ scanId: 'd1-receipt-5', scanType: 'receipt',
      lines: [{ id: 'd1-line-5', rawName: 'Thit ga', quantity: 2, unit: 'kg' }] });
    expect(await confirm('d1-receipt-5', [
      { id: 'd1-line-5', rawName: 'Thit ga', estimatedQuantity: 1.2, unit: 'kg' },
    ])).toMatchObject({ status: 200 });

    const [line] = await query(
      'SELECT estimated_quantity, ocr_quantity, ocr_raw_name, review_state FROM scan_items WHERE id = ?',
      ['d1-line-5']);
    expect(line.estimated_quantity).toBe(1.2);
    expect(line.ocr_quantity).toBe(2);
    expect(line.review_state).toBe('CONFIRMED');
  });

  it('6. observation evidence reaches reconciliation and an authoritative result', async () => {
    await seedScan({ scanId: 'd1-fridge-6', scanType: 'fridge',
      lines: [{ id: 'd1-line-6', rawName: 'Ca rot', quantity: 5, unit: 'piece' }] });
    expect(await confirm('d1-fridge-6', [
      { id: 'd1-line-6', rawName: 'Ca rot', estimatedQuantity: 5, unit: 'piece' },
    ])).toMatchObject({ status: 200 });

    const [observation] = await query(
      'SELECT id, source_type, source_ref, status, version FROM inventory_observations WHERE source_ref = ?',
      ['d1-fridge-6:d1-line-6']);
    expect(observation.source_type).toBe('SCAN');
    expect(observation.status).toBe('OPEN');

    // The additive UX route lists it with the deterministic planner verdict.
    const list = await post('observations-route', { scope, path: '/inventory/observations' });
    expect(list.status).toBe(200);
    const listed = list.body.observations.find((entry) => entry.observationId === observation.id);
    expect(listed).toBeTruthy();
    expect(listed.dataSource).toBe('scan');

    // Decide it through the real route; the T10 executor composes T09.
    const decision = await post('observations-route', {
      scope, method: 'POST',
      path: `/inventory/observations/${observation.id}/decision`,
      payload: {
        decisionKey: `d1-dismiss-${observation.id}`, observationId: observation.id,
        expectedObservationVersion: observation.version, decisionType: 'DISMISS',
      },
    });
    expect(decision.status).toBe(201);
    expect((await query('SELECT status FROM inventory_observations WHERE id = ?', [observation.id]))[0].status)
      .toBe('RECONCILED');
  });

  it('7. confirmation replay after response loss duplicates neither stock nor evidence', async () => {
    await seedScan({ scanId: 'd1-receipt-7', scanType: 'receipt',
      lines: [{ id: 'd1-line-7', rawName: 'Khoai tay', quantity: 4, unit: 'piece' }] });
    const items = [{ id: 'd1-line-7', rawName: 'Khoai tay', estimatedQuantity: 4, unit: 'piece' }];

    expect(await confirm('d1-receipt-7', items)).toMatchObject({ status: 200 });
    const afterFirst = (await lotsOf(scope.householdId)).filter((entry) => entry.raw_name === 'Khoai tay');
    expect(afterFirst).toHaveLength(1);

    const replay = await confirm('d1-receipt-7', items);
    expect(replay.status).toBe(200);
    expect(replay.body.idempotentReplay).toBe(true);

    expect((await lotsOf(scope.householdId)).filter((entry) => entry.raw_name === 'Khoai tay'))
      .toEqual(afterFirst);
    expect(await query('SELECT id FROM inventory_observations WHERE source_ref = ?', ['d1-receipt-7:d1-line-7']))
      .toHaveLength(1);
  });

  it('8. a concurrent second confirmation loses without duplicating stock', async () => {
    await seedScan({ scanId: 'd1-receipt-8', scanType: 'receipt',
      lines: [{ id: 'd1-line-8', rawName: 'Bap cai', quantity: 2, unit: 'piece' }] });
    const items = [{ id: 'd1-line-8', rawName: 'Bap cai', estimatedQuantity: 2, unit: 'piece' }];

    const [first, second] = await Promise.all([
      confirm('d1-receipt-8', items),
      confirm('d1-receipt-8', items),
    ]);
    // Both requests are answered; exactly one mutation exists.
    expect([first.status, second.status]).toEqual([200, 200]);
    const created = (await lotsOf(scope.householdId)).filter((entry) => entry.raw_name === 'Bap cai');
    expect(created).toHaveLength(1);
    expect(created[0].quantity_milli).toBe(2000);
    expect(await query('SELECT id FROM inventory_observations WHERE source_ref = ?', ['d1-receipt-8:d1-line-8']))
      .toHaveLength(1);
  });

  it('9. cross-tenant lot/observation access is refused by the real handlers', async () => {
    const lots = await lotsOf(scope.householdId);
    const lot = lots[0];
    const foreignLotRead = await post('observations-route', {
      scope: foreign, path: `/inventory/lots/${lot.id}`,
    });
    expect(foreignLotRead.status).toBe(404);

    const foreignList = await post('observations-route', { scope: foreign, path: '/inventory/observations' });
    expect(foreignList.status).toBe(200);
    expect(foreignList.body.observations).toEqual([]);

    // A's data is untouched by B's attempts.
    expect((await lotsOf(foreign.householdId)).length).toBe(0);
  });

  it('10. a MOVE/CORRECT is visible in the very next T11 authority read', async () => {
    await seedScan({ scanId: 'd1-receipt-10', scanType: 'receipt',
      lines: [{ id: 'd1-line-10', rawName: 'Dau phu', quantity: 2, unit: 'piece' }] });
    expect(await confirm('d1-receipt-10', [
      { id: 'd1-line-10', rawName: 'Dau phu', estimatedQuantity: 2, unit: 'piece' },
    ])).toMatchObject({ status: 200 });

    const lot = (await lotsOf(scope.householdId)).find((entry) => entry.raw_name === 'Dau phu');
    const pantry = (await query(
      "SELECT id FROM storage_locations WHERE household_id = ? AND type = 'PANTRY' AND is_default = 1",
      [scope.householdId]))[0];

    const before = await post('read', { scope, lot: { lotId: lot.id } });
    const moved = await post('command', {
      scope, key: `d1-move-${lot.id}`, now,
      input: { type: 'MOVE', lotId: lot.id, expectedVersion: before.lot.version, storageLocationId: pantry.id },
    });
    expect(moved.status).toBe(200);

    const after = await post('read', { scope, lot: { lotId: lot.id } });
    expect(after.lot.storage).toBe('pantry');
    expect(after.lot.version).toBeGreaterThan(before.lot.version);
    // Provenance is not disturbed by a later mutation.
    expect(after.lot.sourceType).toBe('RECEIPT');
  });

  it('11. the 0031 review-state trigger fails closed on real D1', async () => {
    const halfConfirmed = await batch([{
      sql: `INSERT INTO scan_items (id, scan_id, raw_name, estimated_quantity, unit, confidence,
        is_confirmed, review_state) VALUES (?, ?, 'x', 1, 'piece', 0.5, 0, 'CONFIRMED')`,
      values: [`bad-${randomUUID()}`, 'd1-receipt-1'],
    }]);
    expect(halfConfirmed.status).toBe(409);
  });
});

describe('T13B-A real D1 purchase-lot and correction provenance regressions', () => {
  const fullLots = (owner) => query(
    'SELECT * FROM inventory_lots WHERE household_id = ? ORDER BY id', [owner.householdId]);

  async function household() {
    const owner = {};
    await seedHousehold(owner, 'T13B-A isolated regression');
    return owner;
  }

  async function manualTomatoes(owner) {
    const [location] = await query(
      "SELECT id FROM storage_locations WHERE household_id = ? AND type = 'PANTRY' AND is_default = 1",
      [owner.householdId]);
    const lotId = `manual-${randomUUID()}`;
    expect(await post('command', { scope: owner, key: `seed-${lotId}`, now, input: {
      type: 'CREATE', lotId, ingredientId: 'TOMATO', rawName: 'Cà chua', quantity: 3,
      unit: 'piece', storageLocationId: location.id, sourceType: 'MANUAL', sourceId: 'old-manual-entry',
      purchasedAt: '2026-09-01', purchasePrice: { currency: 'VND', amountMinor: 30000, minorDigits: 0 },
      openedAt: '2026-09-02T08:30:00Z', expiryAt: '2026-09-20', expiryKind: 'USE_BY',
    } })).toMatchObject({ status: 200, replayed: false });
    return (await fullLots(owner))[0];
  }

  async function receipt(owner, overrides = {}) {
    const scanId = `t13b-${randomUUID()}`;
    const lineId = `${scanId}-line`;
    await seedScan({ scope: owner, scanId, scanType: 'receipt', purchaseDate: '2026-09-12',
      lines: [{ id: lineId, rawName: 'T0MAT0 OCR', quantity: 20, unit: 'pack', totalPriceVnd: 42000 }],
      ...overrides });
    const items = [{ id: lineId, rawName: 'Cà chua', estimatedQuantity: 2, unit: 'piece',
      storage: 'freezer', expiryDate: '2026-10-20', expiryEstimated: true }];
    return { scanId, lineId, items };
  }

  async function authorityEvidence(owner, scanId) {
    const rows = await query(`SELECT c.id, c.client_key, c.command_type, c.fingerprint,
        c.result_json, e.metadata, e.inventory_item_id
      FROM inventory_commands c JOIN inventory_events e ON e.command_id = c.id
      WHERE c.household_id = ? ORDER BY c.id, e.id`, [owner.householdId]);
    return rows.map((row) => ({ ...row, command: JSON.parse(row.fingerprint).command,
      result: JSON.parse(row.result_json), event: JSON.parse(row.metadata) }))
      .filter((row) => row.command.scanEvidence?.scanId === scanId);
  }

  async function state(owner) {
    const tables = ['inventory_lots', 'inventory_items', 'inventory_commands', 'inventory_events',
      'inventory_observations', 'scans'];
    const result = await batch([
      ...tables.map((table) => ({ sql: `SELECT * FROM ${table} WHERE household_id = ? ORDER BY id`,
        values: [owner.householdId] })),
      { sql: 'SELECT inventory_version FROM households WHERE id = ?', values: [owner.householdId] },
      { sql: `SELECT si.* FROM scan_items si JOIN scans s ON s.id = si.scan_id
          WHERE s.household_id = ? ORDER BY si.id`, values: [owner.householdId] },
    ]);
    expect(result.status).toBe(200);
    return result.results.map((entry) => entry.results);
  }

  async function assertReadable(owner, quantities) {
    const read = await post('read', { scope: owner });
    expect(read).toMatchObject({ status: 200, mode: 'native', parity: [] });
    expect(read.authority.items.map((lot) => lot.quantity).sort((a, b) => a - b))
      .toEqual([...quantities].sort((a, b) => a - b));
    expect(read.authority.items.reduce((total, lot) => total + lot.quantity, 0))
      .toBe(quantities.reduce((total, quantity) => total + quantity, 0));
    return read.authority.items;
  }

  it('A. manual tomato 3 + receipt B 2 preserves the entire old lot and purchases, with T11 total 5 and immutable replay', async () => {
    const owner = await household();
    const old = await manualTomatoes(owner);
    const [oldProjection] = await query('SELECT * FROM inventory_items WHERE id = ?', [old.legacy_item_id]);
    expect(oldProjection).toBeDefined();
    const purchase = await receipt(owner);
    expect(await confirm(purchase.scanId, purchase.items, owner)).toMatchObject({ status: 200, body: { success: true } });

    const lots = await fullLots(owner);
    expect(lots).toHaveLength(2);
    expect(lots.find((lot) => lot.id === old.id)).toEqual(old);
    expect(await query('SELECT * FROM inventory_items WHERE id = ?', [old.legacy_item_id])).toEqual([oldProjection]);
    const added = lots.find((lot) => lot.id !== old.id);
    const [freezer] = await query(
      "SELECT id FROM storage_locations WHERE household_id = ? AND type = 'FREEZER' AND is_default = 1",
      [owner.householdId]);
    expect(added).toMatchObject({ ingredient_id: 'TOMATO', quantity_milli: 2000, canonical_unit: 'piece',
      source_type: 'RECEIPT', source_id: purchase.scanId, purchased_at: '2026-09-12',
      currency: 'VND', amount_minor: 42000, minor_digits: 0, opened_at: null,
      storage_location_id: freezer.id, expiry_kind: 'ESTIMATED', expiry_at: null,
      estimated_expiry_at: '2026-10-20', version: 1 });
    await assertReadable(owner, [3, 2]);

    const evidence = await authorityEvidence(owner, purchase.scanId);
    expect(evidence).toHaveLength(1);
    const expectedEvidence = { scanId: purchase.scanId, sourceType: 'RECEIPT', lines: [{
      scanItemId: purchase.lineId, raw: { rawName: 'T0MAT0 OCR', quantity: 20, unit: 'pack' },
      confirmed: { name: 'Cà chua', quantity: 2, unit: 'piece', storage: 'freezer',
        expiryAt: null, estimatedExpiryAt: '2026-10-20', expiryKind: 'ESTIMATED' }, corrected: true,
    }] };
    expect(evidence[0].command_type).toBe('CREATE');
    expect(evidence[0].inventory_item_id).toBe(added.legacy_item_id);
    expect(evidence[0].command.scanEvidence).toEqual(expectedEvidence);
    expect(evidence[0].event.fingerprint).toBe(evidence[0].fingerprint);
    expect(JSON.parse(evidence[0].event.fingerprint).command.scanEvidence).toEqual(expectedEvidence);
    expect(evidence[0].event).not.toHaveProperty('scanEvidence');
    expect(evidence[0].event.after.id).toBe(added.id);
    expect(await query(`SELECT raw_name, estimated_quantity, unit, ocr_raw_name, ocr_quantity, ocr_unit
      FROM scan_items WHERE id = ?`, [purchase.lineId])).toEqual([{
      raw_name: 'Cà chua', estimated_quantity: 2, unit: 'piece',
      ocr_raw_name: 'T0MAT0 OCR', ocr_quantity: 20, ocr_unit: 'pack',
    }]);
    expect(await query(`SELECT raw_name, quantity, unit, storage, expiry_date, expiry_kind
      FROM inventory_observations WHERE household_id = ?`, [owner.householdId])).toEqual([{
      raw_name: 'T0MAT0 OCR', quantity: 2, unit: 'piece', storage: 'freezer',
      expiry_date: '2026-10-20', expiry_kind: 'ESTIMATED',
    }]);

    const committed = await state(owner);
    for (const items of [purchase.items, [{ ...purchase.items[0], rawName: 'Changed after confirmation',
      estimatedQuantity: 99, storage: 'pantry', expiryDate: '2027-01-01' }]]) {
      expect(await confirm(purchase.scanId, items, owner))
        .toMatchObject({ status: 200, body: { success: true, idempotentReplay: true } });
      expect(await state(owner)).toEqual(committed);
    }
    expect(await post('command', { scope: owner, key: evidence[0].client_key,
      input: evidence[0].command, now })).toMatchObject({ status: 200, replayed: true });
    expect(await post('command', { scope: owner, key: evidence[0].client_key, now,
      input: { ...evidence[0].command, scanEvidence: { ...expectedEvidence, lines: [{
        ...expectedEvidence.lines[0], raw: { ...expectedEvidence.lines[0].raw, rawName: 'Altered OCR' },
      }] } } })).toMatchObject({ status: 409, error: 'IDEMPOTENCY_CONFLICT' });
    expect(await state(owner)).toEqual(committed);
  });

  it('B. receipt A and receipt B keep distinguishable purchase lots and exact first-receipt authority', async () => {
    const owner = await household();
    const a = await receipt(owner, { purchaseDate: '2026-09-03' });
    expect(await batch([{ sql: 'UPDATE scan_items SET total_price_vnd = 21000 WHERE id = ?', values: [a.lineId] }]))
      .toMatchObject({ status: 200 });
    a.items[0] = { ...a.items[0], estimatedQuantity: 3, storage: 'fridge', expiryDate: '2026-09-22', expiryEstimated: false };
    expect(await confirm(a.scanId, a.items, owner)).toMatchObject({ status: 200 });
    const [old] = await fullLots(owner);
    const oldEvidence = await authorityEvidence(owner, a.scanId);
    expect(oldEvidence).toHaveLength(1);
    expect(old).toMatchObject({ source_type: 'RECEIPT', source_id: a.scanId, purchased_at: '2026-09-03',
      amount_minor: 21000, quantity_milli: 3000, expiry_kind: 'KNOWN', expiry_at: '2026-09-22' });

    const b = await receipt(owner);
    expect(await confirm(b.scanId, b.items, owner)).toMatchObject({ status: 200 });
    const lots = await fullLots(owner);
    expect(lots).toHaveLength(2);
    expect(lots.find((lot) => lot.source_id === a.scanId)).toEqual(old);
    expect(lots.find((lot) => lot.source_id === b.scanId)).toMatchObject({ source_type: 'RECEIPT',
      purchased_at: '2026-09-12', currency: 'VND', amount_minor: 42000, minor_digits: 0,
      quantity_milli: 2000, expiry_at: null, estimated_expiry_at: '2026-10-20', expiry_kind: 'ESTIMATED' });
    expect(await authorityEvidence(owner, a.scanId)).toEqual(oldEvidence);
    expect(await authorityEvidence(owner, b.scanId)).toHaveLength(1);
    await assertReadable(owner, [3, 2]);
  });

  it('C. fridge SCAN still adds through CORRECT on the existing lot, without replacing its provenance or purchase facts', async () => {
    const owner = await household();
    const old = await manualTomatoes(owner);
    const scan = await receipt(owner, { scanType: 'fridge' });
    expect(await confirm(scan.scanId, scan.items, owner)).toMatchObject({ status: 200 });
    const [after] = await fullLots(owner);
    const read = await assertReadable(owner, [5]);
    expect(after.id).toBe(old.id);
    expect(read[0]).toMatchObject({ lotId: old.id, sourceType: 'MANUAL', storage: 'pantry' });
    for (const field of ['source_type', 'source_id', 'purchased_at', 'currency', 'amount_minor', 'minor_digits',
      'opened_at', 'storage_location_id', 'expiry_at', 'estimated_expiry_at', 'expiry_kind', 'created_at']) {
      expect(after[field], field).toEqual(old[field]);
    }
    expect(after.quantity_milli).toBe(5000);
    expect(after.version).toBe(old.version + 1);
    const evidence = await authorityEvidence(owner, scan.scanId);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].command_type).toBe('CORRECT');
    expect(evidence[0].command.scanEvidence).toMatchObject({ scanId: scan.scanId, sourceType: 'SCAN', lines: [{
      scanItemId: scan.lineId, raw: { rawName: 'T0MAT0 OCR', quantity: 20, unit: 'pack' },
      confirmed: { name: 'Cà chua', quantity: 2, unit: 'piece', storage: 'freezer',
        expiryKind: 'ESTIMATED', expiryAt: null, estimatedExpiryAt: '2026-10-20' }, corrected: true,
    }] });
    expect(JSON.parse(evidence[0].event.fingerprint).command.scanEvidence).toEqual(evidence[0].command.scanEvidence);
    expect(await query('SELECT source_type, raw_name FROM inventory_observations WHERE household_id = ?',
      [owner.householdId])).toEqual([{ source_type: 'SCAN', raw_name: 'T0MAT0 OCR' }]);
    const committed = await state(owner);
    expect(await confirm(scan.scanId, scan.items, owner)).toMatchObject({ status: 200, body: { idempotentReplay: true } });
    expect(await state(owner)).toEqual(committed);
  });

  it.each(['receipt', 'fridge'])('%s missing OCR and manual-added lines retain null raw evidence rather than reviewed names', async (scanType) => {
    const owner = await household();
    const scan = await receipt(owner, { scanType });
    expect(await batch([{ sql: `UPDATE scan_items SET raw_name = 'Previously reviewed label',
      ocr_raw_name = NULL, ocr_quantity = NULL, ocr_unit = NULL WHERE id = ?`, values: [scan.lineId] }]))
      .toMatchObject({ status: 200 });
    const items = [...scan.items, { id: 'draft_manual', rawName: 'Trứng gà',
      estimatedQuantity: 1, unit: 'piece', storage: 'fridge', expiryDate: '2026-09-25' }];
    expect(await confirm(scan.scanId, items, owner)).toMatchObject({ status: 200 });
    const evidence = await authorityEvidence(owner, scan.scanId);
    expect(evidence).toHaveLength(2);
    const lines = evidence.flatMap((entry) => entry.command.scanEvidence.lines);
    expect(lines.map((line) => line.scanItemId).sort()).toEqual([scan.lineId, null].sort());
    for (const entry of evidence) {
      expect(JSON.parse(entry.event.fingerprint).command.scanEvidence).toEqual(entry.command.scanEvidence);
      expect(entry.command.scanEvidence.sourceType).toBe(scanType === 'receipt' ? 'RECEIPT' : 'SCAN');
    }
    for (const line of lines) expect(line).toMatchObject({
      raw: { rawName: null, quantity: null, unit: null }, corrected: false,
    });
    expect(await query('SELECT raw_name FROM inventory_observations WHERE household_id = ?', [owner.householdId]))
      .toEqual([{ raw_name: null }, { raw_name: null }]);
  });

  it('receipt stock with an incompatible old unit creates its own lot instead of forcing an unsupported conversion', async () => {
    const owner = await household();
    const old = await manualTomatoes(owner);
    const purchase = await receipt(owner);
    purchase.items[0] = { ...purchase.items[0], estimatedQuantity: 0.5, unit: 'kg' };
    expect(await confirm(purchase.scanId, purchase.items, owner)).toMatchObject({ status: 200 });
    const lots = await fullLots(owner);
    expect(lots).toHaveLength(2);
    expect(lots.find((lot) => lot.id === old.id)).toEqual(old);
    expect(lots.find((lot) => lot.id !== old.id)).toMatchObject({ quantity_milli: 500000,
      canonical_unit: 'g', source_type: 'RECEIPT', source_id: purchase.scanId, amount_minor: 42000 });
    expect(await post('read', { scope: owner })).toMatchObject({ status: 200, parity: [] });
  });

  it('concurrent receipt confirmations against existing stock commit only one new lot, command, event and observation', async () => {
    const owner = await household();
    const old = await manualTomatoes(owner);
    const purchase = await receipt(owner);
    const responses = await Promise.all([confirm(purchase.scanId, purchase.items, owner),
      confirm(purchase.scanId, purchase.items, owner)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(responses.every((response) => response.body.success)).toBe(true);
    expect((await fullLots(owner)).find((lot) => lot.id === old.id)).toEqual(old);
    await assertReadable(owner, [3, 2]);
    expect(await authorityEvidence(owner, purchase.scanId)).toHaveLength(1);
    expect(await query('SELECT id FROM inventory_commands WHERE household_id = ?', [owner.householdId])).toHaveLength(2);
    expect(await query('SELECT id FROM inventory_events WHERE household_id = ?', [owner.householdId])).toHaveLength(2);
    expect(await query('SELECT id FROM inventory_observations WHERE household_id = ?', [owner.householdId])).toHaveLength(1);
  });

  it('discarding the first confirmation response still replays the committed receipt without any third lot or metadata rewrite', async () => {
    const owner = await household();
    await manualTomatoes(owner);
    const purchase = await receipt(owner);
    // The caller never consumes the first response body; D1 has already committed.
    await worker.fetch('http://localhost/scan-confirm', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-token': token },
      body: JSON.stringify({ scope: owner, scanId: purchase.scanId, items: purchase.items }) });
    expect(await query('SELECT status FROM scans WHERE id = ?', [purchase.scanId])).toEqual([{ status: 'confirmed' }]);
    const committed = await state(owner);
    expect(await confirm(purchase.scanId, purchase.items, owner))
      .toMatchObject({ status: 200, body: { success: true, idempotentReplay: true } });
    expect(await state(owner)).toEqual(committed);
    await assertReadable(owner, [3, 2]);
    expect(await authorityEvidence(owner, purchase.scanId)).toHaveLength(1);
  });

  it.each(['event', 'observation', 'completion'])('a real D1 %s failure rolls back every receipt lot, review, command, event and observation', async (failureAt) => {
    const owner = await household();
    await manualTomatoes(owner);
    const purchase = await receipt(owner);
    const secondLine = `${purchase.scanId}-second`;
    const rejectedLine = `${purchase.scanId}-rejected`;
    expect(await batch([secondLine, rejectedLine].map((id) => ({
      sql: `INSERT INTO scan_items (id, scan_id, raw_name, estimated_quantity, unit, confidence,
        ocr_raw_name, ocr_quantity, ocr_unit) VALUES (?, ?, 'Tofu OCR', 1, 'piece', 0.9, 'Tofu OCR', 1, 'piece')`,
      values: [id, purchase.scanId],
    })))).toMatchObject({ status: 200 });
    const items = [...purchase.items,
      { id: secondLine, rawName: 'Đậu phụ', estimatedQuantity: 1, unit: 'piece', expiryDate: '2026-09-26' },
      { id: rejectedLine, rawName: 'Rejected line', estimatedQuantity: 1, unit: 'piece', rejected: true }];
    const before = await state(owner);
    const trigger = `t13b_abort_${failureAt}`;
    const target = failureAt === 'event' ? 'BEFORE INSERT ON inventory_events'
      : failureAt === 'observation' ? 'BEFORE INSERT ON inventory_observations' : 'BEFORE UPDATE OF status ON scans';
    const predicate = failureAt === 'completion'
      ? `NEW.id = '${purchase.scanId}' AND NEW.status = 'confirmed'`
      : `NEW.household_id = '${owner.householdId}'${failureAt === 'event'
        ? " AND json_extract(NEW.metadata, '$.after.rawName') = 'Đậu phụ'" : ''}`;
    expect(await batch([`CREATE TRIGGER ${trigger} ${target} WHEN ${predicate}
      BEGIN SELECT RAISE(ABORT, 'T13B-A injected ${failureAt} failure'); END`])).toMatchObject({ status: 200 });
    try {
      expect(await confirm(purchase.scanId, items, owner))
        .toMatchObject({ status: 500, body: { code: 'DATABASE_ERROR' } });
      expect(await state(owner)).toEqual(before);
    } finally {
      expect(await batch([`DROP TRIGGER ${trigger}`])).toMatchObject({ status: 200 });
    }
    expect(await confirm(purchase.scanId, items, owner)).toMatchObject({ status: 200 });
    expect(await fullLots(owner)).toHaveLength(3);
    const evidence = await authorityEvidence(owner, purchase.scanId);
    expect(evidence).toHaveLength(2);
    expect(evidence.flatMap((entry) => entry.command.scanEvidence.lines.map((line) => line.scanItemId)).sort())
      .toEqual([purchase.lineId, secondLine].sort());
    expect(await query('SELECT is_confirmed, review_state FROM scan_items WHERE id = ?', [rejectedLine]))
      .toEqual([{ is_confirmed: 0, review_state: 'REJECTED' }]);
    expect(await query('SELECT id FROM inventory_observations WHERE household_id = ?', [owner.householdId])).toHaveLength(2);
    expect(await post('read', { scope: owner })).toMatchObject({ status: 200, parity: [] });
  });
});
