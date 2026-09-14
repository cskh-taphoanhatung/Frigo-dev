import { z } from 'zod';
import { convertQuantity, Quantity, QuantityRangeError } from './quantity';
import { isStandardUnit } from './units';
import { CanonicalIngredientIdSchema } from './foundation';

const Identity = z.string().min(1).refine((value) => value === value.trim() && !value.includes('\0'));
const NonnegativeInteger = z.number().int().safe().nonnegative();
const CalendarDate = z.string().date();
const Instant = z.string().datetime({ offset: true }).refine((value) => Number.isFinite(Date.parse(value)));
const StorageType = z.enum(['FRIDGE', 'FREEZER', 'PANTRY']);
const CanonicalUnit = z.enum(['g', 'ml', 'piece', 'pack', 'bunch', 'slice']);
const SourceType = z.enum(['LEGACY_BACKFILL', 'MANUAL', 'SCAN', 'SHOPPING', 'RECEIPT']);
const Currency = z.enum(['VND', 'JPY', 'USD', 'EUR']);
// Kept local to avoid a domain -> recipes runtime dependency; tests enforce T05 parity.
const CURRENCY_MINOR_DIGITS = { VND: 0, JPY: 0, USD: 2, EUR: 2 } as const;
const PurchasePrice = z.object({
  currency: Currency,
  amountMinor: NonnegativeInteger,
  minorDigits: NonnegativeInteger,
}).strict().refine((price) => price.minorDigits === CURRENCY_MINOR_DIGITS[price.currency], {
  path: ['minorDigits'], message: 'Currency minor-unit scale mismatch',
});

export const StorageLocationSchema = z.object({
  id: Identity,
  householdId: Identity,
  type: StorageType,
  name: z.string().refine((value) => value.trim().length > 0),
  sortOrder: NonnegativeInteger,
  isDefault: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
}).strict();
export type StorageLocation = z.infer<typeof StorageLocationSchema>;

export const InventoryLotSchema = z.object({
  id: Identity,
  householdId: Identity,
  ingredientId: CanonicalIngredientIdSchema.nullable(),
  rawName: z.string(),
  quantityMilli: NonnegativeInteger,
  canonicalUnit: CanonicalUnit,
  storageLocationId: Identity,
  state: z.enum(['ACTIVE', 'CONSUMED', 'DISCARDED']),
  purchasedAt: CalendarDate.nullable(),
  openedAt: Instant.nullable(),
  expiryAt: CalendarDate.nullable(),
  estimatedExpiryAt: CalendarDate.nullable(),
  expiryKind: z.enum(['KNOWN', 'BEST_BEFORE', 'USE_BY', 'ESTIMATED', 'UNKNOWN']),
  sourceType: SourceType,
  sourceId: Identity.nullable(),
  version: z.number().int().safe().positive(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  purchasePrice: PurchasePrice.nullable(),
  legacyExpiryAt: z.string().nullable(),
  legacyExpiryKind: z.string().nullable(),
  legacyExpirySource: z.string().nullable(),
  legacyOpenedAt: z.string().nullable(),
  legacyVersion: z.number().int().safe().positive().nullable(),
}).strict().superRefine((lot, ctx) => {
  if (lot.sourceType !== 'MANUAL' && lot.sourceId === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceId'], message: 'Source reference required' });
  }
  if (lot.sourceType === 'LEGACY_BACKFILL' && lot.legacyVersion === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['legacyVersion'], message: 'Legacy source revision required' });
  }
  const validExpiry = lot.expiryKind === 'UNKNOWN'
    ? lot.expiryAt === null && lot.estimatedExpiryAt === null
    : lot.expiryKind === 'ESTIMATED'
      ? lot.expiryAt === null && lot.estimatedExpiryAt !== null
      : lot.expiryAt !== null && lot.estimatedExpiryAt === null;
  if (!validExpiry) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['expiryKind'], message: 'Expiry evidence mismatch' });
  }
});
export type InventoryLot = z.infer<typeof InventoryLotSchema>;

export interface LegacyInventoryRow {
  id: string;
  household_id: string;
  ingredient_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  storage: string;
  expiry_date: string | null;
  opened_at: string | null;
  expiry_kind: string;
  expiry_source: string;
  version: number;
  created_at: string;
  updated_at: string;
}

const LegacyRowSchema = z.object({
  id: Identity,
  household_id: Identity,
  ingredient_id: CanonicalIngredientIdSchema.nullable(),
  name: z.string(),
  quantity: z.number(),
  unit: z.string(),
  storage: z.enum(['fridge', 'freezer', 'pantry']),
  expiry_date: z.string().nullable(),
  opened_at: z.string().nullable(),
  expiry_kind: z.string(),
  expiry_source: z.string(),
  version: z.number().int().safe().positive(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

export function defaultStorageLocationId(householdId: string, type: StorageLocation['type']): string {
  return `t08-location:${Identity.parse(householdId)}:${StorageType.parse(type)}`;
}

export function defaultStorageLocations(householdId: string, createdAt: string, updatedAt: string): StorageLocation[] {
  const names = { FRIDGE: 'Fridge', FREEZER: 'Freezer', PANTRY: 'Pantry' } as const;
  return StorageType.options.map((type, sortOrder) => StorageLocationSchema.parse({
    id: defaultStorageLocationId(householdId, type), householdId, type, name: names[type],
    sortOrder, isDefault: true, createdAt, updatedAt,
  }));
}

export function legacyLotId(id: string): string {
  return `t08-legacy:${Identity.parse(id)}`;
}

class LotQuantityError extends QuantityRangeError {
  constructor(readonly code: string, message: string) { super(message); }
}

export function toLotQuantity(quantity: number, unit: string): Pick<InventoryLot, 'quantityMilli' | 'canonicalUnit'> {
  if (!isStandardUnit(unit)) throw new LotQuantityError('INVALID_UNIT', 'Unsupported legacy unit');
  if (!Number.isFinite(quantity)) throw new LotQuantityError('UNREPRESENTABLE_QUANTITY', 'Quantity must be finite');
  if (quantity < 0) throw new LotQuantityError('NEGATIVE_QUANTITY', 'Quantity must be nonnegative');
  const canonicalUnit = unit === 'kg' ? 'g' : unit === 'l' ? 'ml' : unit;
  const exact = convertQuantity(Quantity.from(quantity), unit, canonicalUnit).multiply(Quantity.from(1000));
  if (exact.compare(Quantity.from(Number.MAX_SAFE_INTEGER)) > 0) {
    throw new LotQuantityError('UNREPRESENTABLE_QUANTITY', 'Milli-quantity exceeds safe integer range');
  }
  const quantityMilli = exact.toNumber();
  if (!Number.isSafeInteger(quantityMilli) || exact.compare(Quantity.from(quantityMilli)) !== 0) {
    throw new LotQuantityError('UNREPRESENTABLE_QUANTITY', 'Quantity requires sub-milli precision');
  }
  return { quantityMilli, canonicalUnit };
}

export function legacyInventoryToLot(input: LegacyInventoryRow): InventoryLot {
  const row = LegacyRowSchema.parse(input);
  const quantity = toLotQuantity(row.quantity, row.unit);
  const date = CalendarDate.safeParse(row.expiry_date);
  const opened = Instant.safeParse(row.opened_at);
  let expiryKind: InventoryLot['expiryKind'] = 'UNKNOWN';
  if (date.success) {
    if (row.expiry_kind === 'estimated' || row.expiry_source === 'estimated') expiryKind = 'ESTIMATED';
    else if (['user', 'ocr', 'imported'].includes(row.expiry_source)) {
      if (row.expiry_kind === 'best_before') expiryKind = 'BEST_BEFORE';
      if (row.expiry_kind === 'use_by') expiryKind = 'USE_BY';
    }
  }
  return InventoryLotSchema.parse({
    id: legacyLotId(row.id), householdId: row.household_id, ingredientId: row.ingredient_id,
    rawName: row.name, ...quantity,
    storageLocationId: defaultStorageLocationId(row.household_id, StorageType.parse(row.storage.toUpperCase())),
    state: 'ACTIVE', purchasedAt: null, openedAt: opened.success ? opened.data : null,
    expiryAt: date.success && expiryKind !== 'UNKNOWN' && expiryKind !== 'ESTIMATED' ? date.data : null,
    estimatedExpiryAt: date.success && expiryKind === 'ESTIMATED' ? date.data : null,
    expiryKind, sourceType: 'LEGACY_BACKFILL', sourceId: row.id, version: 1,
    createdAt: row.created_at, updatedAt: row.updated_at, purchasePrice: null,
    legacyExpiryAt: row.expiry_date, legacyExpiryKind: row.expiry_kind,
    legacyExpirySource: row.expiry_source, legacyOpenedAt: row.opened_at,
    legacyVersion: row.version,
  });
}

export interface InventoryLotProjection {
  householdId: string;
  ingredientId: string | null;
  canonicalUnit: InventoryLot['canonicalUnit'];
  totalQuantityMilli: string;
  totalAvailableQuantity: number;
  lotCount: number;
  nearestExpiry: string | null;
  nearestEstimatedExpiry: string | null;
  lotIds: string[];
}

function compareText(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }

export function projectInventoryLots(householdId: string, lots: readonly InventoryLot[]): InventoryLotProjection[] {
  Identity.parse(householdId);
  const groups = new Map<string, InventoryLot[]>();
  const ids = new Set<string>();
  for (const lot of z.array(InventoryLotSchema).parse(lots)) {
    if (lot.householdId !== householdId) throw new Error('Inventory lot household mismatch');
    if (ids.has(lot.id)) throw new Error('Duplicate inventory lot ID');
    ids.add(lot.id);
    if (lot.state !== 'ACTIVE') continue;
    const canPool = lot.ingredientId !== null && ['g', 'ml', 'piece'].includes(lot.canonicalUnit);
    const key = JSON.stringify([lot.ingredientId, lot.canonicalUnit, canPool ? null : lot.id]);
    const group = groups.get(key) ?? [];
    group.push(lot);
    groups.set(key, group);
  }
  return [...groups.entries()].sort(([a], [b]) => compareText(a, b)).map(([, group]) => {
    let total = 0n;
    let exact = Quantity.from(0);
    for (const lot of group) {
      total += BigInt(lot.quantityMilli);
      exact = exact.add(Quantity.from(lot.quantityMilli));
    }
    // Decimal round-trip is the explicit compatibility boundary, not binary float equality.
    const totalAvailableQuantity = Number(`${total / 1000n}.${(total % 1000n).toString().padStart(3, '0')}`);
    if (!Number.isFinite(totalAvailableQuantity)
      || Quantity.from(totalAvailableQuantity).multiply(Quantity.from(1000)).compare(exact) !== 0) {
      throw new QuantityRangeError('Aggregate cannot be represented exactly by the compatibility quantity');
    }
    const available = group.filter((lot) => lot.quantityMilli > 0);
    const confirmed = available.flatMap((lot) => lot.expiryAt === null ? [] : [lot.expiryAt]).sort(compareText);
    const estimated = available.flatMap((lot) => lot.estimatedExpiryAt === null ? [] : [lot.estimatedExpiryAt]).sort(compareText);
    return {
      householdId, ingredientId: group[0].ingredientId, canonicalUnit: group[0].canonicalUnit,
      totalQuantityMilli: total.toString(), totalAvailableQuantity, lotCount: group.length,
      nearestExpiry: confirmed[0] ?? null, nearestEstimatedExpiry: estimated[0] ?? null,
      lotIds: group.map((lot) => lot.id).sort(compareText),
    };
  });
}

export interface LegacyLotParityIssue {
  code: string;
  legacyItemId?: string;
  lotId?: string;
  detail: string;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export function checkLegacyLotParity(
  householdId: string,
  legacyRows: readonly LegacyInventoryRow[],
  lots: readonly InventoryLot[],
  locations: readonly StorageLocation[],
): { ok: boolean; issues: LegacyLotParityIssue[] } {
  const issues: LegacyLotParityIssue[] = [];
  const report = (code: string, detail: string, legacyItemId?: string, lotId?: string) => {
    issues.push({ code, detail, ...(legacyItemId === undefined ? {} : { legacyItemId }), ...(lotId === undefined ? {} : { lotId }) });
  };
  if (!Identity.safeParse(householdId).success || !Array.isArray(legacyRows) || !Array.isArray(lots) || !Array.isArray(locations)) {
    report('INVALID_INPUT', 'Parity requires a household and row, lot and location arrays');
    return { ok: false, issues };
  }
  const locationById = new Map<string, StorageLocation>();
  const defaultTypes = new Set<string>();
  for (const input of locations) {
    const result = StorageLocationSchema.safeParse(input);
    if (!result.success) { report('INVALID_LOCATION', result.error.message); continue; }
    const location = result.data;
    if (location.householdId !== householdId) report('HOUSEHOLD_MISMATCH', `Location ${location.id} is outside the household`);
    if (locationById.has(location.id)) report('DUPLICATE_LOCATION', `Duplicate location ${location.id}`);
    if (location.isDefault) {
      const key = JSON.stringify([location.householdId, location.type]);
      if (defaultTypes.has(key)) report('DUPLICATE_DEFAULT_LOCATION', `Multiple defaults for ${location.type}`);
      defaultTypes.add(key);
    }
    locationById.set(location.id, location);
  }
  const sourceIds = new Set<string>();
  for (const input of legacyRows) {
    const id = record(input).id;
    if (typeof id !== 'string') continue;
    if (sourceIds.has(id)) report('DUPLICATE_LEGACY_ROW', 'Duplicate legacy source row', id);
    sourceIds.add(id);
  }
  const lotsBySource = new Map<string, Record<string, unknown>[]>();
  const lotsById = new Map<string, Record<string, unknown>>();
  for (const input of lots) {
    const lot = record(input);
    const id = typeof lot.id === 'string' ? lot.id : undefined;
    const sourceId = typeof lot.sourceId === 'string' ? lot.sourceId : undefined;
    const legacyId = lot.sourceType === 'LEGACY_BACKFILL' ? sourceId : undefined;
    const result = InventoryLotSchema.safeParse(input);
    if (!result.success) report('INVALID_LOT', result.error.message, legacyId, id);
    if (typeof lot.quantityMilli === 'number' && lot.quantityMilli < 0) report('NEGATIVE_QUANTITY', 'Lot quantity is negative', legacyId, id);
    if (!CanonicalUnit.safeParse(lot.canonicalUnit).success) report('INVALID_UNIT', 'Invalid lot canonical unit', legacyId, id);
    if (!SourceType.safeParse(lot.sourceType).success || (lot.sourceId !== null && !Identity.safeParse(lot.sourceId).success)
      || (lot.sourceType !== 'MANUAL' && lot.sourceId === null)) report('INVALID_PROVENANCE', 'Invalid source type/reference', legacyId, id);
    if (lot.householdId !== householdId) report('HOUSEHOLD_MISMATCH', 'Lot is outside the household', legacyId, id);
    if (id !== undefined) {
      if (lotsById.has(id)) report('DUPLICATE_LOT', 'Duplicate lot ID', legacyId, id);
      lotsById.set(id, lot);
    }
    const location = typeof lot.storageLocationId === 'string' ? locationById.get(lot.storageLocationId) : undefined;
    if (!location) report('ORPHAN_LOCATION', 'Lot has no valid storage location', legacyId, id);
    else if (location.householdId !== lot.householdId) report('HOUSEHOLD_MISMATCH', 'Lot/location ownership differs', legacyId, id);
    if (legacyId !== undefined) {
      const group = lotsBySource.get(legacyId) ?? [];
      group.push(lot);
      lotsBySource.set(legacyId, group);
      if (!sourceIds.has(legacyId)) report('INVALID_PROVENANCE', 'Legacy source row is missing', legacyId, id);
      if (Identity.safeParse(legacyId).success && id !== legacyLotId(legacyId)) report('INVALID_PROVENANCE', 'Legacy lot ID does not match its source', legacyId, id);
    }
  }
  for (const [id, group] of lotsBySource) {
    if (group.length > 1) report('DUPLICATE_LEGACY_LOT', 'Multiple lots reference the same legacy row', id);
  }
  for (const input of legacyRows) {
    const raw = record(input);
    const id = typeof raw.id === 'string' ? raw.id : undefined;
    if (raw.household_id !== householdId) report('HOUSEHOLD_MISMATCH', 'Legacy row is outside the household', id);
    let quantityValid = true;
    try { toLotQuantity(raw.quantity as number, raw.unit as string); }
    catch (error) {
      quantityValid = false;
      report(error instanceof LotQuantityError ? error.code : 'UNREPRESENTABLE_QUANTITY', error instanceof Error ? error.message : 'Invalid quantity', id);
    }
    const parsed = LegacyRowSchema.safeParse(input);
    if (!parsed.success) { report('INVALID_LEGACY_ROW', parsed.error.message, id); continue; }
    const row = parsed.data;
    const group = lotsBySource.get(row.id) ?? [];
    if (group.length === 0) {
      report('MISSING_LOT', 'No backfilled lot for legacy row', row.id, legacyLotId(row.id));
      if (lotsById.has(legacyLotId(row.id))) report('INVALID_PROVENANCE', 'Synthetic lot has the wrong source', row.id, legacyLotId(row.id));
    }
    if (!quantityValid) continue;
    const expected = legacyInventoryToLot(row);
    let activeTotal = 0n;
    let compatible = true;
    for (const lot of group) {
      const lotId = typeof lot.id === 'string' ? lot.id : undefined;
      if (lot.canonicalUnit !== expected.canonicalUnit || !NonnegativeInteger.safeParse(lot.quantityMilli).success) compatible = false;
      else if (lot.state === 'ACTIVE') activeTotal += BigInt(lot.quantityMilli as number);
      if (lot.state !== 'ACTIVE') report('STATE_MISMATCH', 'Backfilled legacy stock must remain ACTIVE, including zero', row.id, lotId);
      if (lot.ingredientId !== expected.ingredientId) report('INGREDIENT_MISMATCH', 'Canonical identity differs from legacy', row.id, lotId);
      const location = typeof lot.storageLocationId === 'string' ? locationById.get(lot.storageLocationId) : undefined;
      if (!location?.isDefault || location.type !== row.storage.toUpperCase()) {
        report('LOCATION_MISMATCH', 'Legacy storage bucket differs', row.id, lotId);
      }
      const expiryFields = ['expiryAt', 'estimatedExpiryAt', 'expiryKind', 'openedAt', 'legacyExpiryAt', 'legacyExpiryKind', 'legacyExpirySource', 'legacyOpenedAt'] as const;
      if (expiryFields.some((field) => lot[field] !== expected[field])) report('EXPIRY_MISMATCH', 'Legacy expiry/opened evidence differs', row.id, lotId);
      if (lot.purchasedAt !== null || lot.purchasePrice !== null) report('INVALID_PROVENANCE', 'Legacy backfill cannot supply purchase facts', row.id, lotId);
      if (lot.legacyVersion !== expected.legacyVersion) report('LEGACY_VERSION_MISMATCH', 'Legacy source revision differs', row.id, lotId);
      if (lot.rawName !== expected.rawName || lot.createdAt !== expected.createdAt || lot.updatedAt !== expected.updatedAt || lot.version !== 1) {
        report('LEGACY_METADATA_MISMATCH', 'Legacy name, timestamps or initial lot version differ', row.id, lotId);
      }
    }
    if (!compatible || activeTotal !== BigInt(expected.quantityMilli)) report('QUANTITY_MISMATCH', 'Active milli-quantity or canonical unit differs from legacy', row.id, expected.id);
  }
  return { ok: issues.length === 0, issues };
}
