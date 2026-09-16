import type { D1RecipeContentRow, D1RecipeContentSnapshot, D1RecipeRequirementRow, D1RecipeStepRow } from './catalog-drift';
import { classifyCatalogEntry, type CatalogEntryClassification } from './catalog-entry';
import { RuntimeRecipeSchema, type RuntimeRecipe } from './runtime-recipe';
import { LEGACY_CATEGORY_TAG_PREFIX, LEGACY_REGION_TAG_PREFIX } from './seed-render';

/**
 * D1 → RuntimeRecipe hydrator (T14B-B). Rebuilds the complete production recipe shape from
 * the read-only content snapshot so static `ALL_RECIPES` can be compared against D1 in
 * shadow mode. It is NOT wired into any user-visible response; production authority stays
 * static until a separate cutover task.
 *
 * Fail-closed by design: any row that is an FK stub, foundation-invalid, missing steps or
 * media, carrying an unknown unit/region, or that yields a duplicate ID becomes a diagnostic
 * instead of a recipe. Nothing is defaulted or fabricated — the only transformation beyond
 * column mapping is stripping the historical 0006 `cat:`/`region:` tag markers, whose values
 * now live typed in `recipe_runtime_fields` (and must agree when both exist).
 *
 * ORDER IS SEMANTIC. `rankRecipes`, the Week planner and `getSwapAlternatives` resolve ties and
 * pick candidates by input order, so the hydrated list is ordered by the persisted
 * `recipe_runtime_fields.runtime_order` (0-based canonical position, unique) and each recipe's
 * ingredients by `recipe_runtime_ingredient_order.position` — never by ID and never by
 * consulting `ALL_RECIPES`. Missing, duplicate or non-integer ordinals fail closed.
 *
 * Complexity: O(rows) grouping into ID-keyed maps plus O(N log N) ordering; no per-recipe
 * queries (the snapshot is one five-statement batch) and no static×D1 cross product.
 */

export type RuntimeHydrationFailureCode =
  | 'fk_stub'
  | 'incomplete_entry'
  | 'rejected_entry'
  | 'missing_runtime_fields'
  | 'missing_media_compatibility'
  | 'invalid_tags'
  | 'legacy_marker_conflict'
  | 'invalid_region'
  | 'invalid_cuisine'
  | 'duplicate_recipe_id'
  | 'duplicate_step_number'
  | 'missing_runtime_order'
  | 'invalid_runtime_order'
  | 'duplicate_runtime_order'
  | 'missing_ingredient_position'
  | 'invalid_ingredient_position'
  | 'runtime_contract_violation';

export interface RuntimeHydrationFailure {
  id: string;
  code: RuntimeHydrationFailureCode;
  /** Deterministically sorted, human-readable reasons; never contains row content beyond IDs/field names. */
  reasons: string[];
}

export interface RuntimeHydrationResult {
  /** In persisted canonical runtime order (`runtime_order` ascending). */
  recipes: RuntimeRecipe[];
  failures: RuntimeHydrationFailure[];
  /** Row-level classification of every D1 recipe row, including the ones that hydrated. */
  classifications: CatalogEntryClassification[];
}

const compare = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);
const isLegacyMarker = (tag: string) => tag.startsWith(LEGACY_CATEGORY_TAG_PREFIX) || tag.startsWith(LEGACY_REGION_TAG_PREFIX);

function foundationShape(row: D1RecipeContentRow, lines: readonly D1RecipeRequirementRow[]): Record<string, unknown> {
  return {
    id: row.id, slug: row.slug, title: row.title, description: row.description ?? undefined, cuisine: row.cuisine,
    servings: row.servings, prepTimeMinutes: row.prepTimeMinutes ?? undefined, cookTimeMinutes: row.cookTimeMinutes,
    difficulty: row.difficulty, familyId: row.familyId ?? undefined,
    provenance: { sourceType: row.provenance.sourceType, sourceReference: row.provenance.sourceReference ?? undefined,
      verificationState: row.provenance.verificationState, version: row.provenance.version },
    ingredients: lines.map((line) => ({ ingredientId: line.ingredientId, name: line.name,
      requiredQuantity: line.requiredQuantity, unit: line.unit, isOptional: line.isOptional })),
  };
}

function legacyMarker(tags: readonly string[], prefix: string): string | null {
  const markers = tags.filter((tag) => tag.startsWith(prefix));
  return markers.length === 1 ? markers[0].slice(prefix.length) : markers.length === 0 ? null : '<multiple>';
}

/** Hydrates every complete D1 catalog entry into a `RuntimeRecipe`; everything else is a failure. */
export function hydrateRuntimeRecipes(snapshot: D1RecipeContentSnapshot): RuntimeHydrationResult {
  const linesByRecipe = new Map<string, D1RecipeRequirementRow[]>();
  for (const line of snapshot.requirements) {
    const bucket = linesByRecipe.get(line.recipeId);
    if (bucket) bucket.push(line); else linesByRecipe.set(line.recipeId, [line]);
  }
  const stepsByRecipe = new Map<string, D1RecipeStepRow[]>();
  for (const step of snapshot.steps) {
    const bucket = stepsByRecipe.get(step.recipeId);
    if (bucket) bucket.push(step); else stepsByRecipe.set(step.recipeId, [step]);
  }
  const runtimeFieldsByRecipe = new Map(snapshot.runtimeFields.map((row) => [row.recipeId, row]));
  const orderOwners = new Map<number, string[]>();
  for (const row of snapshot.runtimeFields) {
    if (row.runtimeOrder === null) continue;
    const owners = orderOwners.get(row.runtimeOrder);
    if (owners) owners.push(row.recipeId); else orderOwners.set(row.runtimeOrder, [row.recipeId]);
  }

  const ordered: Array<{ order: number; recipe: RuntimeRecipe }> = [];
  const failures: RuntimeHydrationFailure[] = [];
  const classifications: CatalogEntryClassification[] = [];
  const idCounts = new Map<string, number>();
  for (const row of snapshot.recipes) idCounts.set(row.id, (idCounts.get(row.id) ?? 0) + 1);
  const duplicateReported = new Set<string>();
  const fail = (id: string, code: RuntimeHydrationFailureCode, reasons: string[]) =>
    failures.push({ id, code, reasons: [...new Set(reasons)].sort(compare) });

  // Iteration order only affects diagnostics; recipe output order comes from runtime_order below.
  for (const row of [...snapshot.recipes].sort((a, b) => compare(a.id, b.id) || compare(a.slug, b.slug))) {
    const rawLines = linesByRecipe.get(row.id) ?? [];
    // Classification/validation are position-independent; ordering is enforced after completeness.
    const lines = [...rawLines].sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || compare(a.id, b.id));
    const steps = stepsByRecipe.get(row.id) ?? [];
    const classification = classifyCatalogEntry({ recipe: foundationShape(row, lines), stepCount: steps.length });
    classifications.push(classification);
    // A duplicated ID means neither row can be trusted as the recipe: both fail closed.
    if ((idCounts.get(row.id) ?? 0) > 1) {
      if (!duplicateReported.has(row.id)) { duplicateReported.add(row.id); fail(row.id, 'duplicate_recipe_id', ['duplicate_recipe_id']); }
      continue;
    }
    if (classification.fkStub) { fail(row.id, 'fk_stub', classification.reasons); continue; }
    if (classification.state === 'rejected') { fail(row.id, 'rejected_entry', classification.reasons); continue; }
    if (classification.state === 'incomplete') { fail(row.id, 'incomplete_entry', classification.reasons); continue; }

    const fields = runtimeFieldsByRecipe.get(row.id);
    if (!fields) { fail(row.id, 'missing_runtime_fields', ['no_recipe_runtime_fields_row']); continue; }
    if (fields.runtimeOrder === null) { fail(row.id, 'missing_runtime_order', ['runtime_order_null']); continue; }
    if (!Number.isInteger(fields.runtimeOrder) || fields.runtimeOrder < 0) { fail(row.id, 'invalid_runtime_order', [`runtime_order:${String(fields.runtimeOrder)}`]); continue; }
    if ((orderOwners.get(fields.runtimeOrder) ?? []).length > 1) {
      fail(row.id, 'duplicate_runtime_order', [`runtime_order:${fields.runtimeOrder}`]); continue;
    }
    // Every line needs exactly one explicit position and the positions must be exactly 0..N-1.
    const missingPositions = rawLines.filter((line) => line.position === null).map((line) => line.ingredientId);
    if (missingPositions.length) { fail(row.id, 'missing_ingredient_position', missingPositions); continue; }
    const positions = rawLines.map((line) => line.position as number);
    const invalidPositions = positions.some((position) => !Number.isInteger(position) || position < 0 || position >= rawLines.length)
      || new Set(positions).size !== positions.length;
    if (invalidPositions) { fail(row.id, 'invalid_ingredient_position', positions.map((position) => `position:${String(position)}`)); continue; }
    // classifyCatalogEntry already treats a missing/blank description as incomplete; re-check here so
    // the runtime candidate is never built from a defaulted value.
    if (row.description === null || row.description.trim().length === 0) { fail(row.id, 'incomplete_entry', ['no_description']); continue; }
    if (row.imageUrl === null || row.imageUrl.length === 0) { fail(row.id, 'missing_media_compatibility', ['image_url_null']); continue; }
    if (row.tags === null) { fail(row.id, 'invalid_tags', ['tags_not_json_string_array']); continue; }
    if (new Set(row.tags).size !== row.tags.length) { fail(row.id, 'invalid_tags', ['duplicate_tag']); continue; }

    // Legacy 0006 markers may coexist with the typed row only when they agree; a disagreement is
    // real drift between two representations and must not be silently resolved.
    const markerConflicts: string[] = [];
    const legacyCategory = legacyMarker(row.tags, LEGACY_CATEGORY_TAG_PREFIX);
    const legacyRegion = legacyMarker(row.tags, LEGACY_REGION_TAG_PREFIX);
    if (legacyCategory !== null && legacyCategory !== fields.category) markerConflicts.push('category');
    if (legacyRegion !== null && legacyRegion !== fields.region) markerConflicts.push('region');
    if (markerConflicts.length) { fail(row.id, 'legacy_marker_conflict', markerConflicts); continue; }

    // Unknown units and non-canonical ingredient IDs are already `rejected_entry` above: the
    // foundation contract validates every line (StandardUnitSchema / CanonicalIngredientIdSchema).
    const stepNumbers = steps.map((step) => step.stepNumber);
    if (new Set(stepNumbers).size !== stepNumbers.length) { fail(row.id, 'duplicate_step_number', ['duplicate_step_number']); continue; }

    const candidate: Record<string, unknown> = {
      id: row.id, slug: row.slug, title: row.title, description: row.description, cuisine: row.cuisine,
      cookTimeMinutes: row.cookTimeMinutes, servings: row.servings, difficulty: row.difficulty,
      // LEGACY_MEDIA_COMPATIBILITY_ONLY — recipes.image_url mirrors the static reference; media authority is T14C.
      imageUrl: row.imageUrl,
      ingredients: lines.map((line) => ({
        ingredientId: line.ingredientId, name: line.name, requiredQuantity: line.requiredQuantity, unit: line.unit,
        ...(line.isOptional ? { isOptional: true } : {}),
      })),
      steps: [...steps].sort((a, b) => a.stepNumber - b.stepNumber).map((step) => ({
        stepNumber: step.stepNumber, instruction: step.instruction,
        ...(step.tip !== null ? { tip: step.tip } : {}),
        ...(step.timerMinutes !== null ? { timerMinutes: step.timerMinutes } : {}),
      })),
      tags: row.tags.filter((tag) => !isLegacyMarker(tag)),
    };
    if (fields.category !== null) candidate.category = fields.category;
    if (fields.region !== null) candidate.region = fields.region;
    if (fields.legacyNutrition !== null) candidate.nutrition = { ...fields.legacyNutrition };

    const parsed = RuntimeRecipeSchema.safeParse(candidate);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((issue) => issue.path.join('.') || 'recipe');
      const code: RuntimeHydrationFailureCode = paths.includes('region') ? 'invalid_region'
        : paths.includes('cuisine') ? 'invalid_cuisine' : 'runtime_contract_violation';
      fail(row.id, code, paths.map((path) => `invalid:${path}`));
      continue;
    }
    ordered.push({ order: fields.runtimeOrder, recipe: parsed.data });
  }

  return {
    recipes: ordered.sort((a, b) => a.order - b.order).map((item) => item.recipe),
    failures: failures.sort((a, b) => compare(a.id, b.id) || compare(a.code, b.code)),
    classifications: classifications.sort((a, b) => compare(a.id ?? '', b.id ?? '')),
  };
}

/** Hydrates a single recipe by stable ID (or slug); `null` when it is absent or failed closed. */
export function hydrateRuntimeRecipeById(snapshot: D1RecipeContentSnapshot, idOrSlug: string): RuntimeRecipe | null {
  const row = snapshot.recipes.find((recipe) => recipe.id === idOrSlug || recipe.slug === idOrSlug);
  if (!row) return null;
  const narrowed: D1RecipeContentSnapshot = {
    recipes: snapshot.recipes.filter((recipe) => recipe.id === row.id),
    requirements: snapshot.requirements.filter((line) => line.recipeId === row.id),
    steps: snapshot.steps.filter((step) => step.recipeId === row.id),
    nutritionRecipeIds: snapshot.nutritionRecipeIds.filter((id) => id === row.id),
    runtimeFields: snapshot.runtimeFields.filter((fields) => fields.recipeId === row.id),
  };
  return hydrateRuntimeRecipes(narrowed).recipes[0] ?? null;
}
