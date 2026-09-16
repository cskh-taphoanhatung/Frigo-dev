import { ALL_RECIPES } from './data';
import { auditCatalogDrift, type CatalogDriftReport, type D1RecipeContentSnapshot } from './catalog-drift';
import { hydrateRuntimeRecipes, type RuntimeHydrationResult } from './runtime-hydration';
import { runtimeRecipeFieldDifferences, toRuntimeRecipe, type RuntimeRecipe } from './runtime-recipe';
import type { Recipe } from './types';

/**
 * Runtime recipe catalog abstraction (T14B-B). Two implementations share one read contract:
 *
 * - `StaticRuntimeRecipeCatalog` wraps `ALL_RECIPES` — the ONLY production/user-visible authority.
 * - `D1RuntimeRecipeCatalog` hydrates a read-only D1 content snapshot — shadow/parity capable,
 *   never a response source. Cutover is a separate, explicit future task.
 *
 * Both resolve by ID or slug, mirroring how routes look recipes up today, and both list recipes
 * in CANONICAL RUNTIME ORDER: the static catalog preserves its input order (`ALL_RECIPES`), the
 * D1 catalog emits the persisted `runtime_order`. Order is semantic (ranking/planner/swap ties
 * resolve by input order), so the D1 view must reproduce it independently — it never reorders
 * itself by consulting the static list. No implementation writes anything.
 */
export type RuntimeRecipeCatalogSource = 'static' | 'd1';

export interface RuntimeRecipeCatalog {
  readonly source: RuntimeRecipeCatalogSource;
  listRuntimeRecipes(): Promise<RuntimeRecipe[]>;
  findRuntimeRecipe(idOrSlug: string): Promise<RuntimeRecipe | null>;
}

const compare = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

export class StaticRuntimeRecipeCatalog implements RuntimeRecipeCatalog {
  readonly source = 'static' as const;
  private readonly recipes: RuntimeRecipe[];
  constructor(recipes: readonly Recipe[] = ALL_RECIPES) {
    // Input order IS the production order; never sort.
    this.recipes = recipes.map(toRuntimeRecipe);
  }
  async listRuntimeRecipes(): Promise<RuntimeRecipe[]> { return [...this.recipes]; }
  async findRuntimeRecipe(idOrSlug: string): Promise<RuntimeRecipe | null> {
    return this.recipes.find((recipe) => recipe.id === idOrSlug || recipe.slug === idOrSlug) ?? null;
  }
}

/** Loads the content snapshot at most once per catalog instance (request-scoped caching). */
export class D1RuntimeRecipeCatalog implements RuntimeRecipeCatalog {
  readonly source = 'd1' as const;
  private snapshot: Promise<D1RecipeContentSnapshot> | null = null;
  private hydration: Promise<RuntimeHydrationResult> | null = null;
  constructor(private readonly loadSnapshot: () => Promise<D1RecipeContentSnapshot>) {}

  readSnapshot(): Promise<D1RecipeContentSnapshot> {
    this.snapshot ??= this.loadSnapshot();
    return this.snapshot;
  }
  hydrate(): Promise<RuntimeHydrationResult> {
    this.hydration ??= this.readSnapshot().then(hydrateRuntimeRecipes);
    return this.hydration;
  }
  async listRuntimeRecipes(): Promise<RuntimeRecipe[]> { return [...(await this.hydrate()).recipes]; }
  async findRuntimeRecipe(idOrSlug: string): Promise<RuntimeRecipe | null> {
    const { recipes } = await this.hydrate();
    return recipes.find((recipe) => recipe.id === idOrSlug || recipe.slug === idOrSlug) ?? null;
  }
}

/** Per-recipe runtime-field differences between the static authority and the hydrated view. */
export interface RuntimeRecipeDrift { id: string; fields: string[] }
/** A recipe whose position differs between the static list and the hydrated list (both 0-based). */
export interface RuntimeOrderDrift { id: string; staticPosition: number; d1Position: number }

/**
 * Structured, PII-free shadow diagnostics. Counts are over the full runtime contract; the
 * embedded drift report keeps the finer per-dimension statuses (nutrition/media/classification).
 * Suitable as a JSON log payload; contains recipe IDs and field names only, never inventory.
 */
export interface RecipeCatalogShadowDiagnostics {
  catalogSource: 'static';
  shadowSource: 'd1';
  staticCount: number;
  d1RowCount: number;
  d1CompleteCount: number;
  hydratedCount: number;
  staticOnlyCount: number;
  d1OnlyCount: number;
  driftCount: number;
  /** Recipes present in both lists whose position differs; healthy shadow requires 0. */
  orderDriftCount: number;
  hydrationFailureCount: number;
  staticOnly: string[];
  d1Only: string[];
  drift: RuntimeRecipeDrift[];
  orderDrift: RuntimeOrderDrift[];
  hydrationFailures: RuntimeHydrationResult['failures'];
  report: CatalogDriftReport;
  /** Wall-clock milliseconds spent reading + hydrating + comparing; filled by the caller. */
  lookupMs: number;
}

/**
 * Compares the static authority with a hydrated D1 view, O(N) via ID-keyed maps. This is the
 * shadow comparison the packet asks for: it never influences which recipes users receive.
 */
export function compareRuntimeCatalogs(
  staticRecipes: readonly Recipe[],
  snapshot: D1RecipeContentSnapshot,
  hydration: RuntimeHydrationResult = hydrateRuntimeRecipes(snapshot),
  lookupMs = 0,
): RecipeCatalogShadowDiagnostics {
  const staticById = new Map(staticRecipes.map((recipe) => [recipe.id, toRuntimeRecipe(recipe)]));
  const hydratedById = new Map(hydration.recipes.map((recipe) => [recipe.id, recipe]));
  const staticOnly = [...staticById.keys()].filter((id) => !hydratedById.has(id)).sort(compare);
  const d1Only = [...hydratedById.keys()].filter((id) => !staticById.has(id)).sort(compare);
  const drift: RuntimeRecipeDrift[] = [];
  for (const id of [...staticById.keys()].sort(compare)) {
    const hydrated = hydratedById.get(id);
    if (!hydrated) continue;
    const fields = runtimeRecipeFieldDifferences(staticById.get(id)!, hydrated);
    if (fields.length) drift.push({ id, fields: [...fields] });
  }
  // Order parity over the shared set: compare each shared recipe's rank among shared recipes so
  // a single missing recipe does not cascade into N spurious order drifts.
  const sharedStatic = staticRecipes.map((recipe) => recipe.id).filter((id) => hydratedById.has(id));
  const sharedD1 = hydration.recipes.map((recipe) => recipe.id).filter((id) => staticById.has(id));
  const d1Position = new Map(sharedD1.map((id, index) => [id, index]));
  const orderDrift: RuntimeOrderDrift[] = [];
  sharedStatic.forEach((id, staticPosition) => {
    const position = d1Position.get(id)!;
    if (position !== staticPosition) orderDrift.push({ id, staticPosition, d1Position: position });
  });
  const report = auditCatalogDrift(staticRecipes, snapshot);
  return {
    catalogSource: 'static', shadowSource: 'd1',
    staticCount: staticRecipes.length, d1RowCount: snapshot.recipes.length, d1CompleteCount: report.d1CompleteCount,
    hydratedCount: hydration.recipes.length, staticOnlyCount: staticOnly.length, d1OnlyCount: d1Only.length,
    driftCount: drift.length, orderDriftCount: orderDrift.length, hydrationFailureCount: hydration.failures.length,
    staticOnly, d1Only, drift, orderDrift, hydrationFailures: hydration.failures, report, lookupMs,
  };
}
