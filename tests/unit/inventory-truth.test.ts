import { describe, expect, it } from 'vitest';
import {
  checkLegacyLotParity,
  defaultStorageLocations,
  InventoryLotSchema,
  legacyInventoryToLot,
  projectInventoryLots,
  StorageLocationSchema,
  toLotQuantity,
  type InventoryLot,
  type LegacyInventoryRow,
} from '../../packages/domain/src/inventory-truth';
import { CURRENCY_MINOR_DIGITS } from '../../packages/recipes/src/shopping-catalog';

const householdId = 'household-a';
const timestamp = '2026-09-09T10:00:00Z';
const locations = defaultStorageLocations(householdId, timestamp, timestamp);
const row = (patch: Partial<LegacyInventoryRow> = {}): LegacyInventoryRow => ({
  id: 'legacy-a', household_id: householdId, ingredient_id: 'CHICKEN_EGG', name: 'Egg',
  quantity: 10, unit: 'piece', storage: 'fridge', expiry_date: null, opened_at: null,
  expiry_kind: 'unknown', expiry_source: 'unknown', version: 4,
  created_at: timestamp, updated_at: timestamp, ...patch,
});
const lot = (patch: Partial<InventoryLot> = {}): InventoryLot => ({ ...legacyInventoryToLot(row()), ...patch });
const codes = (lots: InventoryLot[], rows = [row()], storage = locations) =>
  checkLegacyLotParity(householdId, rows, lots, storage).issues.map((issue) => issue.code);

describe('T08 storage, quantity and money contracts', () => {
  it('creates deterministic household-scoped defaults and accepts a custom freezer name', () => {
    expect(locations).toEqual(defaultStorageLocations(householdId, timestamp, timestamp));
    expect(locations.map((location) => [location.type, location.sortOrder, location.isDefault])).toEqual([
      ['FRIDGE', 0, true], ['FREEZER', 1, true], ['PANTRY', 2, true],
    ]);
    expect(StorageLocationSchema.parse({ ...locations[1], id: 'second', name: 'Garage Freezer', isDefault: false }).name)
      .toBe('Garage Freezer');
    expect(defaultStorageLocations('household-b', timestamp, timestamp).map((location) => location.id))
      .not.toEqual(locations.map((location) => location.id));
  });

  it.each([{ householdId: '' }, { name: '  ' }, { sortOrder: -1 }, { isDefault: 2 }, { type: 'WARM' }])(
    'rejects an invalid storage location %j', (patch) => {
      expect(StorageLocationSchema.safeParse({ ...locations[0], ...patch }).success).toBe(false);
    },
  );

  it.each([
    [1, 'piece', 1000, 'piece'], [0.5, 'piece', 500, 'piece'], [100, 'g', 100000, 'g'],
    [0.000001, 'kg', 1, 'g'], [0.2, 'kg', 200000, 'g'], [1.25, 'l', 1250000, 'ml'],
    [0, 'ml', 0, 'ml'], [0.1, 'pack', 100, 'pack'], [1, 'bunch', 1000, 'bunch'], [0.5, 'slice', 500, 'slice'],
  ])('converts %s %s exactly to %s milli-%s', (quantity, unit, quantityMilli, canonicalUnit) => {
    expect(toLotQuantity(quantity as number, unit as string)).toEqual({ quantityMilli, canonicalUnit });
  });

  it.each([
    [-1, 'g'], [NaN, 'piece'], [Infinity, 'piece'], [0.0001, 'piece'],
    [0.1 + 0.2, 'piece'], [Number.MAX_SAFE_INTEGER, 'g'], [1, 'pcs'], [1, 'oz'], [1, ''],
  ])('rejects unrepresentable quantity %s %s instead of rounding or guessing', (quantity, unit) => {
    expect(() => toLotQuantity(quantity as number, unit as string)).toThrow();
  });

  it('accepts a valid lot, nullable canonical identity and zero but not unknown quantity', () => {
    expect(InventoryLotSchema.parse(lot())).toMatchObject({ quantityMilli: 10000, legacyVersion: 4, version: 1 });
    expect(InventoryLotSchema.parse(lot({ ingredientId: null, quantityMilli: 0 })).quantityMilli).toBe(0);
    expect(InventoryLotSchema.safeParse({ ...lot(), quantityMilli: null }).success).toBe(false);
    expect(InventoryLotSchema.safeParse(lot({ ingredientId: 'not_canonical' })).success).toBe(false);
  });

  it.each(Object.entries(CURRENCY_MINOR_DIGITS))('matches T05 currency scale for %s', (currency, minorDigits) => {
    const parsed = InventoryLotSchema.parse({ ...lot(), purchasePrice: { currency, amountMinor: 238, minorDigits } });
    expect(parsed.purchasePrice).toEqual({ currency, amountMinor: 238, minorDigits });
    expect(InventoryLotSchema.safeParse({ ...lot(), purchasePrice: { currency, amountMinor: 238, minorDigits: minorDigits + 1 } }).success).toBe(false);
  });

  it.each([
    { currency: 'USD', amountMinor: 4.99, minorDigits: 2 },
    { currency: 'USD', amountMinor: -1, minorDigits: 2 },
    { currency: 'JPY', amountMinor: Number.MAX_SAFE_INTEGER + 1, minorDigits: 0 },
    { currency: 'XXX', amountMinor: 0, minorDigits: 0 },
    { currency: 'VND', amountMinor: 238 },
  ])('rejects invalid money semantics %j', (purchasePrice) => {
    expect(InventoryLotSchema.safeParse({ ...lot(), purchasePrice }).success).toBe(false);
  });

  it('distinguishes unknown money from an explicitly supplied zero minor amount', () => {
    expect(lot().purchasePrice).toBeNull();
    expect(InventoryLotSchema.parse(lot({ purchasePrice: { currency: 'JPY', amountMinor: 0, minorDigits: 0 } })).purchasePrice?.amountMinor).toBe(0);
  });
});

describe('T08 legacy facts and expiry provenance', () => {
  it('preserves unknown fields without manufacturing purchase, opening, price or expiry', () => {
    expect(legacyInventoryToLot(row())).toMatchObject({
      sourceType: 'LEGACY_BACKFILL', sourceId: 'legacy-a', state: 'ACTIVE', legacyVersion: 4,
      purchasedAt: null, openedAt: null, expiryAt: null, estimatedExpiryAt: null,
      expiryKind: 'UNKNOWN', purchasePrice: null, legacyExpiryAt: null,
    });
  });

  it.each([
    ['unknown', 'unknown', 'UNKNOWN'], ['use_by', 'unknown', 'UNKNOWN'],
    ['use_by', 'invented-source', 'UNKNOWN'], ['best_before', 'user', 'BEST_BEFORE'],
    ['use_by', 'ocr', 'USE_BY'], ['best_before', 'imported', 'BEST_BEFORE'],
    ['estimated', 'user', 'ESTIMATED'], ['use_by', 'estimated', 'ESTIMATED'],
  ])('maps %s/%s without inventing verification', (expiry_kind, expiry_source, expiryKind) => {
    const result = legacyInventoryToLot(row({ expiry_kind, expiry_source, expiry_date: '2026-09-15' }));
    expect(result.expiryKind).toBe(expiryKind);
    expect(result.legacyExpiryAt).toBe('2026-09-15');
    expect(result.legacyExpiryKind).toBe(expiry_kind);
    expect(result.legacyExpirySource).toBe(expiry_source);
    if (expiryKind === 'UNKNOWN') expect([result.expiryAt, result.estimatedExpiryAt]).toEqual([null, null]);
    if (expiryKind === 'ESTIMATED') expect([result.expiryAt, result.estimatedExpiryAt]).toEqual([null, '2026-09-15']);
  });

  it('preserves invalid historical dates raw instead of normalizing them to today', () => {
    const result = legacyInventoryToLot(row({ expiry_date: '2026-02-30', expiry_kind: 'use_by', expiry_source: 'user', opened_at: 'yesterday' }));
    expect(result).toMatchObject({ expiryKind: 'UNKNOWN', expiryAt: null, estimatedExpiryAt: null, legacyExpiryAt: '2026-02-30', openedAt: null, legacyOpenedAt: 'yesterday' });
    expect(legacyInventoryToLot(row({ opened_at: timestamp })).openedAt).toBe(timestamp);
  });

  it.each([
    { expiryKind: 'KNOWN' }, { expiryAt: '2026-09-15' },
    { expiryKind: 'ESTIMATED', expiryAt: '2026-09-15', estimatedExpiryAt: '2026-09-15' },
    { expiryKind: 'KNOWN', expiryAt: '2026-02-30' }, { legacyVersion: null },
    { sourceId: null }, { sourceId: '  ' }, { sourceType: 'GUESS' },
  ])('rejects contradictory expiry/provenance %j', (patch) => {
    expect(InventoryLotSchema.safeParse({ ...lot(), ...patch }).success).toBe(false);
  });
});

describe('T08 compatibility projection', () => {
  it('aggregates 10 + 6 eggs deterministically without changing the input', () => {
    const a = lot();
    const b = legacyInventoryToLot(row({ id: 'legacy-b', quantity: 6 }));
    const before = JSON.stringify([a, b]);
    const projected = projectInventoryLots(householdId, [b, a]);
    expect(projected).toEqual(projectInventoryLots(householdId, [a, b]));
    expect(projected).toHaveLength(1);
    expect(projected[0]).toMatchObject({ ingredientId: 'CHICKEN_EGG', totalAvailableQuantity: 16, totalQuantityMilli: '16000', canonicalUnit: 'piece', lotCount: 2 });
    expect(JSON.stringify([a, b])).toBe(before);
  });

  it('keeps incompatible dimensions, unknown identity and contextual packages separate', () => {
    const lots = [
      lot({ id: 'g', canonicalUnit: 'g' }), lot({ id: 'ml', canonicalUnit: 'ml' }),
      lot({ id: 'pack-a', canonicalUnit: 'pack' }), lot({ id: 'pack-b', canonicalUnit: 'pack' }),
      lot({ id: 'unknown-a', ingredientId: null }), lot({ id: 'unknown-b', ingredientId: null }),
    ];
    expect(projectInventoryLots(householdId, lots)).toHaveLength(6);
  });

  it('does exact decimal addition and excludes inactive stock', () => {
    expect(projectInventoryLots(householdId, [
      lot({ quantityMilli: 100 }), lot({ id: 'b', quantityMilli: 200 }),
      lot({ id: 'consumed', state: 'CONSUMED' }), lot({ id: 'discarded', state: 'DISCARDED' }),
    ])[0]).toMatchObject({ totalAvailableQuantity: 0.3, totalQuantityMilli: '300', lotCount: 2 });
  });

  it('separates known and estimated expiry and ignores depleted dates', () => {
    const result = projectInventoryLots(householdId, [
      lot({ id: 'depleted', quantityMilli: 0, expiryKind: 'KNOWN', expiryAt: '2026-09-01' }),
      lot({ id: 'known', expiryKind: 'BEST_BEFORE', expiryAt: '2026-09-15' }),
      lot({ id: 'estimated', expiryKind: 'ESTIMATED', estimatedExpiryAt: '2026-09-10' }),
      lot({ id: 'unknown', legacyExpiryAt: '2026-09-02' }),
    ])[0];
    expect(result).toMatchObject({ nearestExpiry: '2026-09-15', nearestEstimatedExpiry: '2026-09-10' });
  });

  it('rejects duplicate IDs, foreign households and numeric precision loss', () => {
    expect(() => projectInventoryLots(householdId, [lot(), lot()])).toThrow('Duplicate');
    expect(() => projectInventoryLots('other', [lot()])).toThrow('household');
    expect(() => projectInventoryLots(householdId, [lot({ quantityMilli: Number.MAX_SAFE_INTEGER })])).toThrow('exactly');
    expect(() => projectInventoryLots(householdId, [lot({ quantityMilli: -1 })])).toThrow();
  });
});

describe('T08 diagnostic legacy parity', () => {
  it('proves exact synthetic quantity parity and accepts an unchanged customized default ID', () => {
    expect(checkLegacyLotParity(householdId, [row()], [lot()], locations)).toEqual({ ok: true, issues: [] });
    const custom = { ...locations[0], id: 'custom-default' };
    expect(checkLegacyLotParity(householdId, [row()], [lot({ storageLocationId: custom.id })], [custom]).ok).toBe(true);
  });

  it('reports missing and duplicate legacy lots with row identifiers', () => {
    const missing = checkLegacyLotParity(householdId, [row()], [], locations);
    expect(missing.issues).toContainEqual(expect.objectContaining({ code: 'MISSING_LOT', legacyItemId: 'legacy-a' }));
    expect(codes([lot(), lot({ id: 'duplicate' })])).toContain('DUPLICATE_LEGACY_LOT');
  });

  it.each([
    [{ quantityMilli: 9000 }, 'QUANTITY_MISMATCH'], [{ householdId: 'other' }, 'HOUSEHOLD_MISMATCH'],
    [{ ingredientId: 'TOMATO' }, 'INGREDIENT_MISMATCH'], [{ canonicalUnit: 'oz' }, 'INVALID_UNIT'],
    [{ quantityMilli: -1 }, 'NEGATIVE_QUANTITY'], [{ storageLocationId: 'absent' }, 'ORPHAN_LOCATION'],
    [{ sourceId: 'absent' }, 'INVALID_PROVENANCE'], [{ sourceType: 'INVALID' }, 'INVALID_PROVENANCE'],
    [{ state: 'CONSUMED' }, 'STATE_MISMATCH'], [{ legacyExpiryAt: '2026-09-10' }, 'EXPIRY_MISMATCH'],
    [{ legacyVersion: 3 }, 'LEGACY_VERSION_MISMATCH'], [{ rawName: 'Other food' }, 'LEGACY_METADATA_MISMATCH'],
    [{ purchasedAt: '2026-09-09' }, 'INVALID_PROVENANCE'],
  ])('diagnoses corrupted lot %j as %s', (patch, code) => {
    expect(codes([{ ...lot(), ...patch } as InventoryLot])).toContain(code);
  });

  it('detects foreign locations and mismatched storage bucket', () => {
    expect(codes([lot()], [row()], locations.map((location) => ({ ...location, householdId: 'other' })))).toContain('HOUSEHOLD_MISMATCH');
    expect(codes([lot({ storageLocationId: locations[1].id })])).toContain('LOCATION_MISMATCH');
  });

  it('rejects corrupt legacy quantities and source shapes with actionable diagnostics', () => {
    expect(codes([lot()], [row({ quantity: -1 })])).toContain('NEGATIVE_QUANTITY');
    expect(codes([lot()], [row({ quantity: 0.0001 })])).toContain('UNREPRESENTABLE_QUANTITY');
    expect(codes([lot()], [row({ unit: 'oz' })])).toContain('INVALID_UNIT');
    expect(codes([lot()], [row({ household_id: 'other' })])).toContain('HOUSEHOLD_MISMATCH');
    expect(codes([lot()], [row({ version: 0 })])).toContain('INVALID_LEGACY_ROW');
    expect(codes([null as unknown as InventoryLot])).toContain('INVALID_LOT');
  });
});
