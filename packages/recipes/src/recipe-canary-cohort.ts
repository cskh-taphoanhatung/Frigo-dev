import { isRecipeCanaryTenant } from './recipe-authority';

/**
 * T15C-C — authorized test cohort for the recipe D1 canary.
 *
 * Production canary membership is decided solely by `recipeCanaryBucket(householdId)` (FNV-1a,
 * 10 000 buckets). An operator has no household whose bucket is guaranteed to fall inside the
 * first 1 %, so proving INSIDE/OUTSIDE canary behaviour in production needs a narrow, server-side
 * override for operator-owned test households only:
 *
 *   exclude (control household → static)  >  include (test household → canary)  >  deterministic bucket
 *
 * Configuration arrives ONLY through Worker secrets/vars (`RECIPE_CATALOG_TEST_COHORT_ENABLED`,
 * `RECIPE_CATALOG_TEST_INCLUDE`, `RECIPE_CATALOG_TEST_EXCLUDE`); never from request input. The
 * sets hold SHA-256 digests of `recipe-catalog-test-cohort:<householdId>` — not raw identifiers —
 * so configuration and diagnostics never carry a production household ID. The digest is a
 * deterministic identifier representation, not a security boundary: the secret store is.
 *
 * The pure functions here know nothing about modes/cutover; callers apply the mode fences.
 */
export const RECIPE_TEST_COHORT_DIGEST_NAMESPACE = 'recipe-catalog-test-cohort:';
const DIGEST_HEX = /^[0-9a-f]{64}$/;
/** Bound the parse cost and the blast radius: an operator cohort is a handful of households. */
export const MAX_RECIPE_TEST_COHORT_DIGESTS = 16;

export type RecipeTestCohortConfigCode =
  | 'TEST_COHORT_ENABLED_INVALID'
  | 'TEST_COHORT_DIGEST_INVALID'
  | 'TEST_COHORT_DIGEST_DUPLICATE'
  | 'TEST_COHORT_TOO_LARGE'
  | 'TEST_COHORT_INCLUDE_EXCLUDE_OVERLAP'
  | 'TEST_COHORT_PAIR_REQUIRED'
  | 'TEST_COHORT_MEMBERS_WITHOUT_ENABLE';

export class RecipeTestCohortConfigError extends Error {
  constructor(readonly code: RecipeTestCohortConfigCode, message: string) {
    super(message); this.name = 'RecipeTestCohortConfigError';
  }
}

export interface RecipeTestCohort {
  /** Lower-case hex SHA-256 digests; disjoint sets. */
  readonly include: ReadonlySet<string>;
  readonly exclude: ReadonlySet<string>;
}

export interface RecipeTestCohortEnv {
  RECIPE_CATALOG_TEST_COHORT_ENABLED?: unknown;
  RECIPE_CATALOG_TEST_INCLUDE?: unknown;
  RECIPE_CATALOG_TEST_EXCLUDE?: unknown;
}

/** Digest a tenant key exactly as operators must when producing the configured sets. */
export async function recipeTestCohortDigest(tenantKey: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${RECIPE_TEST_COHORT_DIGEST_NAMESPACE}${tenantKey}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parseDigestList(value: unknown, name: string): Set<string> {
  if (value === undefined || value === null || value === '') return new Set();
  if (typeof value !== 'string') throw new RecipeTestCohortConfigError('TEST_COHORT_DIGEST_INVALID', `${name} must be a comma-separated list of SHA-256 hex digests`);
  const entries = value.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  if (entries.length > MAX_RECIPE_TEST_COHORT_DIGESTS) throw new RecipeTestCohortConfigError('TEST_COHORT_TOO_LARGE', `${name} may list at most ${MAX_RECIPE_TEST_COHORT_DIGESTS} digests`);
  const set = new Set<string>();
  for (const entry of entries) {
    // Exact lower-case hex only: no raw IDs, no prefixes, no case-folding that could hide a typo.
    if (!DIGEST_HEX.test(entry)) throw new RecipeTestCohortConfigError('TEST_COHORT_DIGEST_INVALID', `${name} contains an entry that is not a 64-char lower-case hex SHA-256 digest`);
    if (set.has(entry)) throw new RecipeTestCohortConfigError('TEST_COHORT_DIGEST_DUPLICATE', `${name} lists the same digest twice`);
    set.add(entry);
  }
  return set;
}

/**
 * Parses the cohort configuration; `null` when the feature is absent/disabled. Throws for every
 * malformed or contradictory shape so production validation and the request path fail closed.
 * Disabled is the default: no variable, `''`, or exactly `'false'`.
 *
 * An enabled cohort must name BOTH an include (test) household and an exclude (control)
 * household: the mechanism exists to prove inside AND outside canary, never one alone.
 */
export function parseRecipeTestCohort(env: RecipeTestCohortEnv): RecipeTestCohort | null {
  const enabledRaw = env.RECIPE_CATALOG_TEST_COHORT_ENABLED;
  const enabled = enabledRaw === 'true';
  if (!enabled && enabledRaw !== undefined && enabledRaw !== null && enabledRaw !== '' && enabledRaw !== 'false') {
    throw new RecipeTestCohortConfigError('TEST_COHORT_ENABLED_INVALID', 'RECIPE_CATALOG_TEST_COHORT_ENABLED must be exactly true or false');
  }
  const include = parseDigestList(env.RECIPE_CATALOG_TEST_INCLUDE, 'RECIPE_CATALOG_TEST_INCLUDE');
  const exclude = parseDigestList(env.RECIPE_CATALOG_TEST_EXCLUDE, 'RECIPE_CATALOG_TEST_EXCLUDE');
  for (const digest of include) {
    if (exclude.has(digest)) throw new RecipeTestCohortConfigError('TEST_COHORT_INCLUDE_EXCLUDE_OVERLAP', 'A digest appears in both RECIPE_CATALOG_TEST_INCLUDE and RECIPE_CATALOG_TEST_EXCLUDE');
  }
  if (!enabled) {
    // Members configured while the switch is off is a half-applied rollout: refuse rather than guess.
    if (include.size > 0 || exclude.size > 0) throw new RecipeTestCohortConfigError('TEST_COHORT_MEMBERS_WITHOUT_ENABLE', 'RECIPE_CATALOG_TEST_INCLUDE/EXCLUDE are set but RECIPE_CATALOG_TEST_COHORT_ENABLED is not true');
    return null;
  }
  if (include.size === 0 || exclude.size === 0) throw new RecipeTestCohortConfigError('TEST_COHORT_PAIR_REQUIRED', 'RECIPE_CATALOG_TEST_COHORT_ENABLED=true requires at least one RECIPE_CATALOG_TEST_INCLUDE digest AND at least one RECIPE_CATALOG_TEST_EXCLUDE digest');
  return { include, exclude };
}

export type RecipeCanaryAssignmentReason = 'missing_tenant' | 'authorized_exclude' | 'authorized_include' | 'deterministic_bucket';

export interface RecipeCanaryAssignment {
  canary: boolean;
  reason: RecipeCanaryAssignmentReason;
}

/**
 * Canary membership for one tenant. Without a cohort (the default) this is exactly
 * `isRecipeCanaryTenant`; with one, exclude wins over include, and both win over the bucket.
 * Never returns or logs the tenant key or its digest.
 */
export async function resolveRecipeCanaryAssignment(options: {
  tenantKey: string | null | undefined;
  percent: number;
  cohort: RecipeTestCohort | null;
}): Promise<RecipeCanaryAssignment> {
  const { tenantKey, percent, cohort } = options;
  if (!tenantKey) return { canary: false, reason: 'missing_tenant' };
  if (cohort) {
    const digest = await recipeTestCohortDigest(tenantKey);
    if (cohort.exclude.has(digest)) return { canary: false, reason: 'authorized_exclude' };
    if (cohort.include.has(digest)) return { canary: true, reason: 'authorized_include' };
  }
  return { canary: isRecipeCanaryTenant(tenantKey, percent), reason: 'deterministic_bucket' };
}
