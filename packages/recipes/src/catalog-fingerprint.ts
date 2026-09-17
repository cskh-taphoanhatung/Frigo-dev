import { RUNTIME_RECIPE_FIELDS, stableRuntimeJson, toRuntimeRecipe, type RuntimeRecipe } from './runtime-recipe';
import type { Recipe } from './types';

/**
 * Catalog fingerprint (T14D, shared with the T14E release manifest composer). Kept in its own
 * module so the import factory can compute release fingerprints without importing the authority
 * providers (which import `ALL_RECIPES`).
 */
/**
 * Fields that define recipe CONTENT identity for cutover parity. This is the full runtime
 * contract; `imageUrl` stays because it is still part of the semantic `Recipe` payload
 * (LEGACY_MEDIA_COMPATIBILITY_ONLY). No `recipe_media`, R2 or timestamp data is ever included.
 */
export const RECIPE_FINGERPRINT_FIELDS: readonly (keyof RuntimeRecipe)[] = RUNTIME_RECIPE_FIELDS;

/** Canonical projection of an ordered recipe list: array order and object keys are both deterministic. */
export function canonicalRecipeProjection(recipes: readonly Recipe[]): string {
  return stableRuntimeJson(recipes.map((recipe) => {
    const runtime = toRuntimeRecipe(recipe);
    const projected: Record<string, unknown> = {};
    for (const field of RECIPE_FINGERPRINT_FIELDS) projected[field] = runtime[field];
    return projected;
  }));
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 of {@link canonicalRecipeProjection}; identical input order and content ⇒ identical hash. */
export async function fingerprintRecipes(recipes: readonly Recipe[]): Promise<string> {
  return sha256Hex(canonicalRecipeProjection(recipes));
}

