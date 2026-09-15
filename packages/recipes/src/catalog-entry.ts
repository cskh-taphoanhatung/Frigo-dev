import { RecipeDefinitionSchema } from './foundation';

/**
 * A row in D1 `recipes` is NOT automatically a catalog entry. Cooking-complete and
 * shopping-list routes insert 7-column FK anchor rows (`INSERT OR IGNORE INTO recipes
 * (id, slug, title, cuisine, cook_time_minutes, servings, difficulty)`) for recipes that
 * were never seeded. This classifier separates those stubs from complete, publishable
 * entries and from malformed rows, deterministically and without any D1 write.
 *
 * Media (`image_url`) is intentionally NOT a completeness criterion: recipe media is a
 * separate concern deferred to T14C, and today's runtime tolerates any string there.
 */

export type CatalogEntryState = 'complete' | 'incomplete' | 'rejected';

export interface CatalogEntryClassification {
  id: string | undefined;
  state: CatalogEntryState;
  /** `true` only for the exact shape a cooking/shopping FK insert leaves behind. */
  fkStub: boolean;
  /** Deterministically sorted reasons; empty for `complete`. */
  reasons: string[];
}

export interface RawCatalogEntryInput {
  /** Foundation-shaped recipe candidate as produced by the D1 mapper or the static adapter. */
  recipe: unknown;
  /** Number of `recipe_steps` rows attached, when the caller has loaded them. */
  stepCount?: number;
}

const STUB_KEYS = new Set(['id', 'slug', 'title', 'cuisine', 'servings', 'cookTimeMinutes', 'difficulty', 'ingredients', 'provenance']);

function isDefaultProvenance(value: unknown): boolean {
  const provenance = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return (provenance.sourceType === undefined || provenance.sourceType === 'legacy')
    && (provenance.verificationState === undefined || provenance.verificationState === 'unverified')
    && (provenance.version === undefined || provenance.version === 1)
    && (provenance.sourceReference === undefined || provenance.sourceReference === null);
}

/** Exactly the row a `INSERT OR IGNORE INTO recipes (7 cols)` produces after schema defaults. */
export function isFkStubShape(record: Record<string, unknown>): boolean {
  const requirements = Array.isArray(record.ingredients) ? record.ingredients.length : 0;
  if (requirements !== 0) return false;
  const extraContent = Object.keys(record).some((key) =>
    !STUB_KEYS.has(key) && record[key] !== undefined && record[key] !== null);
  return !extraContent && isDefaultProvenance(record.provenance);
}

/**
 * Classifies one raw recipe row:
 * - `incomplete` + `fkStub=true` for the FK-anchor shape (never a catalog entry);
 * - `rejected` when the row has content but violates the foundation contract;
 * - `incomplete` when foundation-valid but missing runtime-required content
 *   (description, or steps when `stepCount` is supplied);
 * - `complete` otherwise.
 */
export function classifyCatalogEntry(input: RawCatalogEntryInput): CatalogEntryClassification {
  const record = (input.recipe && typeof input.recipe === 'object' ? input.recipe : {}) as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : undefined;

  if (isFkStubShape(record)) {
    return { id, state: 'incomplete', fkStub: true, reasons: ['fk_anchor_shape', 'no_description', 'no_requirements'] };
  }

  const parsed = RecipeDefinitionSchema.safeParse(input.recipe);
  if (!parsed.success) {
    const reasons = [...new Set(parsed.error.issues.map((issue) => `invalid:${issue.path.join('.') || 'recipe'}`))].sort();
    return { id, state: 'rejected', fkStub: false, reasons };
  }

  const reasons: string[] = [];
  if (!parsed.data.description || parsed.data.description.trim().length === 0) reasons.push('no_description');
  if (input.stepCount !== undefined && input.stepCount === 0) reasons.push('no_steps');
  reasons.sort();
  return { id, state: reasons.length === 0 ? 'complete' : 'incomplete', fkStub: false, reasons };
}
