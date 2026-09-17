import { CANONICAL_INGREDIENTS, type CanonicalIngredient } from '../../../domain/src';
import { normalizeIngredientAlias, StandardUnitSchema } from '../../../domain/src/foundation';

/**
 * Ingredient Truth boundary for imports (T14E). The ONLY ingredient vocabulary is the existing
 * canonical catalog (`CANONICAL_INGREDIENTS`, seeded in D1 `ingredients` by 0002/0006). Resolution
 * is EXACT: canonical ID, or a normalized name/alias that maps to exactly one ingredient. No
 * substring matching (the runtime `findCanonicalIngredient` helper is deliberately not reused:
 * its `includes()` fallback would merge "chili" into "Thai chili"), no invented IDs, no automatic
 * merge of look-alikes. Ambiguity and misses are reported with bounded candidates for review.
 */

export type IngredientResolution =
  | { status: 'resolved'; ingredientId: string; via: 'id' | 'exact_alias' }
  | { status: 'ambiguous'; candidates: string[] }
  | { status: 'unresolved'; candidates: string[] };

export interface IngredientResolver {
  resolve(text: string, explicitId?: string): IngredientResolution;
  has(ingredientId: string): boolean;
  readonly size: number;
}

const MAX_CANDIDATES = 5;

/** Builds the exact-match index once; O(total aliases). */
export function createIngredientResolver(catalog: readonly CanonicalIngredient[] = CANONICAL_INGREDIENTS): IngredientResolver {
  const ids = new Set<string>();
  const byAlias = new Map<string, Set<string>>();
  const add = (alias: string, id: string) => {
    const key = normalizeIngredientAlias(alias);
    if (!key) return;
    const bucket = byAlias.get(key);
    if (bucket) bucket.add(id); else byAlias.set(key, new Set([id]));
  };
  for (const ingredient of catalog) {
    ids.add(ingredient.id);
    add(ingredient.id, ingredient.id);
    add(ingredient.nameVi, ingredient.id);
    add(ingredient.nameEn, ingredient.id);
    for (const alias of ingredient.aliases) add(alias, ingredient.id);
  }
  // Token index for bounded review candidates only (never used to auto-resolve).
  const byToken = new Map<string, Set<string>>();
  for (const [alias, owners] of byAlias) {
    for (const token of alias.split(' ')) {
      if (token.length < 3) continue;
      const bucket = byToken.get(token);
      for (const id of owners) { if (bucket) bucket.add(id); else byToken.set(token, new Set([id])); }
    }
  }
  const candidatesFor = (normalized: string): string[] => {
    const found = new Set<string>();
    for (const token of normalized.split(' ')) for (const id of byToken.get(token) ?? []) found.add(id);
    return [...found].sort().slice(0, MAX_CANDIDATES);
  };

  return {
    size: ids.size,
    has: (ingredientId) => ids.has(ingredientId),
    resolve(text, explicitId) {
      if (explicitId !== undefined) {
        return ids.has(explicitId) ? { status: 'resolved', ingredientId: explicitId, via: 'id' } : { status: 'unresolved', candidates: candidatesFor(normalizeIngredientAlias(text)) };
      }
      const normalized = normalizeIngredientAlias(text);
      const owners = byAlias.get(normalized);
      if (!owners) return { status: 'unresolved', candidates: candidatesFor(normalized) };
      if (owners.size === 1) return { status: 'resolved', ingredientId: [...owners][0], via: 'exact_alias' };
      return { status: 'ambiguous', candidates: [...owners].sort().slice(0, MAX_CANDIDATES) };
    },
  };
}

/** Closed runtime unit vocabulary; no silent cup/tbsp/tsp conversion. */
export function isSupportedUnit(unit: string): boolean {
  return StandardUnitSchema.safeParse(unit).success;
}
