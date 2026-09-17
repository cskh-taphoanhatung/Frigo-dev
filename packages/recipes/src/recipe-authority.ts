import { ALL_RECIPES } from './data';
import type { D1RecipeContentSnapshot } from './catalog-drift';
import { hydrateRuntimeRecipes, type RuntimeHydrationResult } from './runtime-hydration';
import { canonicalRecipeProjection, fingerprintRecipes, RECIPE_FINGERPRINT_FIELDS } from './catalog-fingerprint';
import currentCatalogRelease_json from './import/catalog-release.current.json';
import { parseCatalogReleaseManifest, type CatalogReleaseManifest } from './import/release-manifest';
import { stableRuntimeJson, toRuntimeRecipe, type RuntimeRecipe } from './runtime-recipe';
import type { Recipe } from './types';

export { canonicalRecipeProjection, fingerprintRecipes, RECIPE_FINGERPRINT_FIELDS };

/**
 * T14D — Recipe catalog authority (ADR-026).
 *
 * A `RecipeAuthoritySnapshot` is the ONE coherent view of recipe CONTENT a request/operation
 * reads from. Every runtime consumer (list, detail, recommendations, cooking, planner, swap)
 * receives a snapshot instead of importing `ALL_RECIPES`, so the source can be switched by
 * configuration — never by user input — and rolled back by configuration alone.
 *
 * Two providers share the contract:
 * - static  → `ALL_RECIPES` in its exact order (the rollback baseline; production default);
 * - d1      → the T14B-B hydrator (`hydrateRuntimeRecipes`) over one five-statement content
 *             read, which becomes user-visible ONLY after `assessD1Readiness` proves it is the
 *             same catalog: same count, same IDs, same order, same fields, same fingerprint.
 *
 * Media (T14C) is deliberately absent: `recipe_media` readiness never influences which recipe
 * content is authoritative, and the fingerprint never includes media state.
 */
export type RecipeAuthoritySource = 'static' | 'd1';

export interface RecipeAuthoritySnapshot {
  readonly source: RecipeAuthoritySource;
  /** SHA-256 hex over the canonical ordered projection (see {@link fingerprintRecipes}). */
  readonly fingerprint: string;
  /** Epoch milliseconds when the snapshot was built; informational, never part of the fingerprint. */
  readonly loadedAt: number;
  /** Canonical runtime order. Returns a fresh array so callers can filter freely. */
  list(): Recipe[];
  /** Exact stable ID lookup. */
  findById(id: string): Recipe | null;
  /** Mirrors how every route resolves recipes today: stable ID first, then slug. */
  findByIdOrSlug(idOrSlug: string): Recipe | null;
  readonly size: number;
}

class IndexedRecipeSnapshot implements RecipeAuthoritySnapshot {
  private readonly byId = new Map<string, Recipe>();
  private readonly bySlug = new Map<string, Recipe>();
  readonly size: number;
  constructor(
    readonly source: RecipeAuthoritySource,
    private readonly recipes: readonly Recipe[],
    readonly fingerprint: string,
    readonly loadedAt: number,
  ) {
    for (const recipe of recipes) {
      // First occurrence wins, matching Array.prototype.find on the ordered list.
      if (!this.byId.has(recipe.id)) this.byId.set(recipe.id, recipe);
      if (!this.bySlug.has(recipe.slug)) this.bySlug.set(recipe.slug, recipe);
    }
    this.size = recipes.length;
  }
  list(): Recipe[] { return [...this.recipes]; }
  findById(id: string): Recipe | null { return this.byId.get(id) ?? null; }
  findByIdOrSlug(idOrSlug: string): Recipe | null { return this.byId.get(idOrSlug) ?? this.bySlug.get(idOrSlug) ?? null; }
}

/** Builds a snapshot over an explicit list; exported for fixtures and the providers below. */
export async function createRecipeAuthoritySnapshot(
  source: RecipeAuthoritySource,
  recipes: readonly Recipe[],
  now: () => number = () => Date.now(),
): Promise<RecipeAuthoritySnapshot> {
  return new IndexedRecipeSnapshot(source, recipes, await fingerprintRecipes(recipes), now());
}

/**
 * Rollback baseline. `ALL_RECIPES` is validated against the runtime contract once and served in
 * its exact input order. The instance is process-lifetime: static content only changes by deploy.
 */
export class StaticRecipeAuthority {
  readonly source = 'static' as const;
  private snapshot: Promise<RecipeAuthoritySnapshot> | null = null;
  constructor(private readonly recipes: readonly Recipe[] = ALL_RECIPES, private readonly now: () => number = () => Date.now()) {}
  load(): Promise<RecipeAuthoritySnapshot> {
    this.snapshot ??= createRecipeAuthoritySnapshot('static', this.recipes.map(toRuntimeRecipe), this.now);
    return this.snapshot;
  }
}

export type RecipeAuthorityReadinessCode =
  | 'D1_READ_FAILED'
  | 'RELEASE_MANIFEST_INVALID'
  | 'CATALOG_DIAGNOSTICS'
  | 'COUNT_DRIFT'
  | 'ID_DRIFT'
  | 'ORDER_DRIFT'
  | 'LEGACY_BASELINE_DRIFT'
  | 'FINGERPRINT_DRIFT';

export type RecipeAuthorityReadiness =
  | { status: 'ready'; source: 'd1'; fingerprint: string; recipeCount: number; releaseId: string }
  | { status: 'not_ready'; source: 'd1'; code: Exclude<RecipeAuthorityReadinessCode, 'D1_READ_FAILED'>; detail: RecipeAuthorityReadinessDetail }
  | { status: 'error'; source: 'd1'; code: 'D1_READ_FAILED'; error: string };

/** Bounded, PII-free evidence: counts and at most a few recipe IDs / field names. */
export interface RecipeAuthorityReadinessDetail {
  releaseId: string | null;
  expectedCount: number;
  actualCount: number;
  legacyBaselineCount: number;
  hydrationFailureCount: number;
  hydrationFailureSample: Array<{ id: string; code: string }>;
  idDriftSample: string[];
  orderDriftSample: Array<{ id: string; expected: number; actual: number }>;
  fieldDriftSample: Array<{ id: string; fields: string[] }>;
  expectedFingerprint: string;
  actualFingerprint: string | null;
  legacyBaselineMatch: boolean | null;
  fingerprintMatch: boolean | null;
}

const SAMPLE = 5;

let cachedCurrentRelease: CatalogReleaseManifest | null = null;
/**
 * The reviewed Catalog Release Manifest shipped with this build (`import/catalog-release.current.json`).
 * Parsed lazily and once; never loaded from a request, D1 row, KV or URL. Today it describes exactly
 * the 71-recipe static baseline with zero approved import batches.
 */
export function currentCatalogRelease(): CatalogReleaseManifest {
  cachedCurrentRelease ??= parseCatalogReleaseManifest(currentCatalogRelease_json);
  return cachedCurrentRelease;
}

/**
 * Strict, growth-ready D1 readiness (T14D + T14E, ADR-026/ADR-027). The hydrated D1 catalog must be
 * EXACTLY the reviewed Catalog Release: zero hydration failures, the release's count, its ordered IDs,
 * the legacy prefix byte-equal to the static baseline (LEGACY_BASELINE_DRIFT protects the 71 rollback
 * recipes even inside an expanded release) and the full release fingerprint. Checks run from the
 * cheapest/most diagnostic to the final hash so the reason code is specific. With today's manifest
 * (71, no batches) this is exactly the T14D "D1 == static" rule.
 */
export async function assessD1Readiness(
  baseline: RecipeAuthoritySnapshot,
  hydration: RuntimeHydrationResult,
  release: CatalogReleaseManifest = currentCatalogRelease(),
): Promise<{ readiness: RecipeAuthorityReadiness; recipes: RuntimeRecipe[] }> {
  const legacy = baseline.list();
  const actual = hydration.recipes;
  const actualFingerprint = await fingerprintRecipes(actual);
  const detail: RecipeAuthorityReadinessDetail = {
    releaseId: release.releaseId,
    expectedCount: release.expectedRecipeCount, actualCount: actual.length, legacyBaselineCount: release.legacyBaselineCount,
    hydrationFailureCount: hydration.failures.length,
    hydrationFailureSample: hydration.failures.slice(0, SAMPLE).map((failure) => ({ id: failure.id, code: failure.code })),
    idDriftSample: [], orderDriftSample: [], fieldDriftSample: [],
    expectedFingerprint: release.expectedRuntimeFingerprint, actualFingerprint,
    legacyBaselineMatch: null, fingerprintMatch: null,
  };
  const notReady = (code: Exclude<RecipeAuthorityReadinessCode, 'D1_READ_FAILED'>): { readiness: RecipeAuthorityReadiness; recipes: RuntimeRecipe[] } =>
    ({ readiness: { status: 'not_ready', source: 'd1', code, detail }, recipes: actual });

  // The manifest must describe THIS build's static baseline; otherwise the release metadata is stale.
  if (release.legacyBaselineCount !== legacy.length || release.legacyBaselineFingerprint !== baseline.fingerprint
    || release.orderedRecipeIds.slice(0, legacy.length).some((id, index) => id !== legacy[index].id)) {
    return notReady('RELEASE_MANIFEST_INVALID');
  }
  if (hydration.failures.length > 0) return notReady('CATALOG_DIAGNOSTICS');
  if (actual.length !== release.expectedRecipeCount) return notReady('COUNT_DRIFT');
  const actualIds = new Set(actual.map((recipe) => recipe.id));
  const expectedIds = new Set(release.orderedRecipeIds);
  const missing = release.orderedRecipeIds.filter((id) => !actualIds.has(id));
  const extra = actual.filter((recipe) => !expectedIds.has(recipe.id)).map((recipe) => recipe.id);
  if (missing.length || extra.length) { detail.idDriftSample = [...missing, ...extra].slice(0, SAMPLE); return notReady('ID_DRIFT'); }
  const actualPosition = new Map(actual.map((recipe, index) => [recipe.id, index]));
  release.orderedRecipeIds.forEach((id, index) => {
    const position = actualPosition.get(id)!;
    if (position !== index && detail.orderDriftSample.length < SAMPLE) detail.orderDriftSample.push({ id, expected: index, actual: position });
  });
  if (detail.orderDriftSample.length) return notReady('ORDER_DRIFT');
  // Legacy baseline protection: the first N recipes must be the static rollback baseline, field for field.
  const legacyPortion = actual.slice(0, legacy.length);
  const legacyFingerprint = legacy.length === actual.length ? actualFingerprint : await fingerprintRecipes(legacyPortion);
  detail.legacyBaselineMatch = legacyFingerprint === baseline.fingerprint;
  if (!detail.legacyBaselineMatch) {
    for (let index = 0; index < legacy.length && detail.fieldDriftSample.length < SAMPLE; index += 1) {
      const left = toRuntimeRecipe(legacy[index]);
      const right = legacyPortion[index];
      const fields = RECIPE_FINGERPRINT_FIELDS.filter((field) => stableRuntimeJson(left[field]) !== stableRuntimeJson(right[field]));
      if (fields.length) detail.fieldDriftSample.push({ id: left.id, fields: [...fields] });
    }
    return notReady('LEGACY_BASELINE_DRIFT');
  }
  detail.fingerprintMatch = actualFingerprint === release.expectedRuntimeFingerprint;
  // Imported recipes are certified by the release fingerprint alone (the manifest carries no field
  // values), so drift there is reported by ID sample only.
  if (!detail.fingerprintMatch) {
    detail.idDriftSample = release.orderedRecipeIds.slice(legacy.length, legacy.length + SAMPLE);
    return notReady('FINGERPRINT_DRIFT');
  }
  return { readiness: { status: 'ready', source: 'd1', fingerprint: actualFingerprint, recipeCount: actual.length, releaseId: release.releaseId }, recipes: actual };
}

export type D1RecipeAuthorityLoad =
  | { status: 'ready'; snapshot: RecipeAuthoritySnapshot; readiness: Extract<RecipeAuthorityReadiness, { status: 'ready' }> }
  | { status: 'not_ready' | 'error'; snapshot: null; readiness: Exclude<RecipeAuthorityReadiness, { status: 'ready' }> };

/**
 * D1 provider: one content read (the caller supplies the five-statement batch reader), one
 * hydration, one readiness assessment. It never returns a snapshot that failed readiness, so a
 * D1 snapshot in hand is proof of parity with the static baseline at load time.
 */
export class D1RecipeAuthority {
  readonly source = 'd1' as const;
  constructor(
    private readonly readSnapshot: () => Promise<D1RecipeContentSnapshot>,
    private readonly baseline: StaticRecipeAuthority,
    private readonly now: () => number = () => Date.now(),
    /** Reviewed release expectation; defaults to the manifest shipped with this build. */
    private readonly release: () => CatalogReleaseManifest = currentCatalogRelease,
  ) {}

  async load(): Promise<D1RecipeAuthorityLoad> {
    let content: D1RecipeContentSnapshot;
    try {
      content = await this.readSnapshot();
    } catch (error) {
      return { status: 'error', snapshot: null, readiness: { status: 'error', source: 'd1', code: 'D1_READ_FAILED', error: error instanceof Error ? error.name : 'unknown' } };
    }
    const baseline = await this.baseline.load();
    let release: CatalogReleaseManifest;
    try {
      release = this.release();
    } catch (error) {
      return { status: 'error', snapshot: null, readiness: { status: 'error', source: 'd1', code: 'D1_READ_FAILED', error: error instanceof Error ? `release manifest: ${error.name}` : 'release manifest' } };
    }
    const { readiness, recipes } = await assessD1Readiness(baseline, hydrateRuntimeRecipes(content), release);
    if (readiness.status !== 'ready') return { status: readiness.status, snapshot: null, readiness };
    // Hydrated recipes are already RuntimeRecipe-validated; the fingerprint equals the release's by construction.
    return { status: 'ready', snapshot: new IndexedRecipeSnapshot('d1', recipes, readiness.fingerprint, this.now()), readiness };
  }
}

// ---------------------------------------------------------------------------------------------
// Deterministic canary assignment
// ---------------------------------------------------------------------------------------------

export const RECIPE_CANARY_BUCKETS = 10_000;

/**
 * FNV-1a 32-bit over the UTF-8 bytes of the key. Chosen for determinism across runtimes (no
 * dependency on JS string hashing quirks) and adequate dispersion for bucketing tenant IDs; it is
 * NOT a security primitive and is never used as one.
 */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(input)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Stable bucket in `[0, RECIPE_CANARY_BUCKETS)` for a tenant key; same key ⇒ same bucket forever. */
export function recipeCanaryBucket(tenantKey: string): number {
  return fnv1a32(`recipe-catalog-canary:${tenantKey}`) % RECIPE_CANARY_BUCKETS;
}

/** Strict integer percent 0..100; anything else (floats, strings with junk, NaN, negatives) is `null`. */
export function parseRecipeCanaryPercent(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]?|100)$/.test(value)) return null;
  return Number(value);
}

/**
 * `true` when the tenant is inside the canary for `percent`. Monotonic: a household inside the
 * canary at p% stays inside for every larger percent, so widening the rollout never flips users out.
 */
export function isRecipeCanaryTenant(tenantKey: string, percent: number): boolean {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) throw new RangeError('canary percent must be an integer 0..100');
  if (percent === 0) return false;
  if (percent === 100) return true;
  return recipeCanaryBucket(tenantKey) < percent * (RECIPE_CANARY_BUCKETS / 100);
}
