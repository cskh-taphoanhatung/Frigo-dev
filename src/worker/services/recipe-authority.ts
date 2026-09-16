import type { D1DatabaseBinding } from '@frigo/db';
import { readRecipeContent } from '../../../packages/db/src/recipe-content';
import {
  D1RecipeAuthority,
  isRecipeCanaryTenant,
  parseRecipeCanaryPercent,
  StaticRecipeAuthority,
  type RecipeAuthorityReadiness,
  type RecipeAuthoritySnapshot,
} from '../../../packages/recipes/src/recipe-authority';
import type { Env } from '../types';
import { scheduleRecipeCatalogShadow } from './recipe-catalog-shadow';

/**
 * T14D — Recipe authority router (ADR-026).
 *
 * `RECIPE_CATALOG_MODE` (deployment config only; never a request parameter):
 * - `static`  (default, production today): `ALL_RECIPES` serves; D1 is not consulted.
 * - `shadow`  : static serves; the T14B-B off-response D1 comparison runs (unchanged, throttled).
 * - `canary`  : households whose stable bucket falls under `RECIPE_CATALOG_D1_CANARY_PERCENT` are
 *               served the VERIFIED D1 snapshot; anything short of verified readiness falls back to
 *               static with a `recipe_catalog_canary_fallback` diagnostic. Everyone else: static.
 * - `d1`      : every request is served the verified D1 snapshot. If D1 cannot be verified, the
 *               EMERGENCY policy serves static and emits a high-severity `recipe_catalog_d1_fallback`
 *               — availability over purity, but never silently: `actualSource` always tells the truth.
 *
 * `canary` and `d1` additionally require `RECIPE_CATALOG_CUTOVER_ENABLED=true` (fence against a
 * typo flipping authority). Rollback is `RECIPE_CATALOG_MODE=static`: read routing only, no data change.
 *
 * One snapshot per request/operation: routes call `resolveRecipeAuthority(c.env, tenantKey)` once
 * and pass the snapshot down. The D1 snapshot is cached per isolate for a bounded TTL with
 * singleflight refresh; a stale verified snapshot may be served for a bounded grace window when a
 * refresh fails so a transient D1 blip does not immediately flip canary users back to static.
 */
export const RECIPE_CATALOG_MODES = ['static', 'shadow', 'canary', 'd1'] as const;
export type RecipeAuthorityMode = (typeof RECIPE_CATALOG_MODES)[number];
/** Modes in which D1 content can reach a user. Both are fenced by RECIPE_CATALOG_CUTOVER_ENABLED. */
export const USER_VISIBLE_D1_MODES: readonly RecipeAuthorityMode[] = ['canary', 'd1'];

export class RecipeAuthorityConfigError extends Error {
  constructor(readonly code: 'INVALID_MODE' | 'INVALID_CANARY_PERCENT' | 'CUTOVER_NOT_ENABLED', message: string) {
    super(message); this.name = 'RecipeAuthorityConfigError';
  }
}

/** Exact-match parser: unknown/typo values are rejected, never coerced to static. */
export function parseRecipeAuthorityMode(value: unknown): RecipeAuthorityMode {
  if (value === undefined || value === null || value === '') return 'static';
  if (typeof value === 'string' && (RECIPE_CATALOG_MODES as readonly string[]).includes(value)) return value as RecipeAuthorityMode;
  throw new RecipeAuthorityConfigError('INVALID_MODE', `Unsupported RECIPE_CATALOG_MODE: ${String(value)}`);
}

export function parseCutoverEnabled(value: unknown): boolean {
  return value === 'true' || value === true;
}

export interface RecipeAuthorityConfig {
  mode: RecipeAuthorityMode;
  canaryPercent: number;
  cutoverEnabled: boolean;
}

export type RecipeAuthorityEnv = Pick<Env, 'DB' | 'RECIPE_CATALOG_MODE' | 'RECIPE_CATALOG_D1_CANARY_PERCENT' | 'RECIPE_CATALOG_CUTOVER_ENABLED' | 'RECIPE_CATALOG_SHADOW_INTERVAL_MS'>;

/**
 * Validates the whole authority configuration; throws a typed error for any invalid or
 * dangerous combination. Used by production config validation AND at request time (fail closed).
 */
export function resolveRecipeAuthorityConfig(env: Pick<RecipeAuthorityEnv, 'RECIPE_CATALOG_MODE' | 'RECIPE_CATALOG_D1_CANARY_PERCENT' | 'RECIPE_CATALOG_CUTOVER_ENABLED'>): RecipeAuthorityConfig {
  const mode = parseRecipeAuthorityMode(env.RECIPE_CATALOG_MODE);
  const canaryPercent = parseRecipeCanaryPercent(env.RECIPE_CATALOG_D1_CANARY_PERCENT);
  if (canaryPercent === null) throw new RecipeAuthorityConfigError('INVALID_CANARY_PERCENT', 'RECIPE_CATALOG_D1_CANARY_PERCENT must be an integer 0..100');
  const cutoverEnabled = parseCutoverEnabled(env.RECIPE_CATALOG_CUTOVER_ENABLED);
  if (USER_VISIBLE_D1_MODES.includes(mode) && !cutoverEnabled) {
    throw new RecipeAuthorityConfigError('CUTOVER_NOT_ENABLED', `RECIPE_CATALOG_MODE=${mode} requires RECIPE_CATALOG_CUTOVER_ENABLED=true`);
  }
  return { mode, canaryPercent, cutoverEnabled };
}

// ---------------------------------------------------------------------------------------------
// Bounded per-isolate D1 snapshot cache with singleflight refresh
// ---------------------------------------------------------------------------------------------

/** A verified snapshot is reused for this long before a refresh is attempted. */
export const RECIPE_AUTHORITY_D1_TTL_MS = 30_000;
/** After TTL, a previously verified snapshot may still serve while refreshes fail, up to this age. */
export const RECIPE_AUTHORITY_D1_STALE_GRACE_MS = 5 * 60_000;

interface CachedD1 { snapshot: RecipeAuthoritySnapshot; verifiedAt: number }
let cachedD1: CachedD1 | null = null;
let inflightD1: Promise<D1LoadOutcome> | null = null;
const staticAuthority = new StaticRecipeAuthority();

type D1LoadOutcome =
  | { kind: 'fresh'; snapshot: RecipeAuthoritySnapshot }
  | { kind: 'stale'; snapshot: RecipeAuthoritySnapshot; readiness: Exclude<RecipeAuthorityReadiness, { status: 'ready' }>; ageMs: number }
  | { kind: 'unavailable'; readiness: Exclude<RecipeAuthorityReadiness, { status: 'ready' }> };

/** Test seam: forget the isolate's cached D1 snapshot and any in-flight refresh. */
export function resetRecipeAuthorityCacheForTests(): void { cachedD1 = null; inflightD1 = null; }

async function loadVerifiedD1(db: D1DatabaseBinding | undefined, now: () => number): Promise<D1LoadOutcome> {
  const current = now();
  if (cachedD1 && current - cachedD1.verifiedAt < RECIPE_AUTHORITY_D1_TTL_MS) return { kind: 'fresh', snapshot: cachedD1.snapshot };
  if (inflightD1) return inflightD1;
  inflightD1 = (async (): Promise<D1LoadOutcome> => {
    const previous = cachedD1;
    if (!db) {
      const readiness: Exclude<RecipeAuthorityReadiness, { status: 'ready' }> = { status: 'error', source: 'd1', code: 'D1_READ_FAILED', error: 'D1 binding unavailable' };
      return previous && now() - previous.verifiedAt < RECIPE_AUTHORITY_D1_STALE_GRACE_MS
        ? { kind: 'stale', snapshot: previous.snapshot, readiness, ageMs: now() - previous.verifiedAt }
        : { kind: 'unavailable', readiness };
    }
    const loaded = await new D1RecipeAuthority(() => readRecipeContent(db), staticAuthority, now).load();
    if (loaded.status === 'ready') {
      cachedD1 = { snapshot: loaded.snapshot, verifiedAt: now() };
      return { kind: 'fresh', snapshot: loaded.snapshot };
    }
    // A failed refresh never evicts a verified snapshot early, but the grace window bounds its life.
    if (previous && now() - previous.verifiedAt < RECIPE_AUTHORITY_D1_STALE_GRACE_MS) {
      return { kind: 'stale', snapshot: previous.snapshot, readiness: loaded.readiness, ageMs: now() - previous.verifiedAt };
    }
    cachedD1 = null;
    return { kind: 'unavailable', readiness: loaded.readiness };
  })().finally(() => { inflightD1 = null; });
  return inflightD1;
}

// ---------------------------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------------------------

export type RecipeAuthorityEvent =
  | 'recipe_catalog_authority_selected'
  | 'recipe_catalog_d1_ready'
  | 'recipe_catalog_d1_not_ready'
  | 'recipe_catalog_d1_stale_served'
  | 'recipe_catalog_canary_fallback'
  | 'recipe_catalog_d1_fallback'
  | 'recipe_catalog_config_invalid';

/** Structured, PII-free diagnostic: no recipes, no raw tenant IDs (canary reports the bucket decision only). */
export interface RecipeAuthorityDiagnostic {
  level: 'info' | 'warn' | 'error';
  event: RecipeAuthorityEvent;
  configuredMode: RecipeAuthorityMode | 'invalid';
  selectedSource: 'static' | 'd1';
  actualSource: 'static' | 'd1';
  canary?: boolean;
  reasonCode?: string;
  fingerprintMatch?: boolean;
  staleAgeMs?: number;
  recipeCount?: number;
}

export interface RecipeAuthorityResolution {
  snapshot: RecipeAuthoritySnapshot;
  configuredMode: RecipeAuthorityMode;
  /** Where the router INTENDED to read from after mode + canary selection. */
  selectedSource: 'static' | 'd1';
  /** Where content actually came from. `static` with `selectedSource='d1'` means a fallback happened. */
  actualSource: 'static' | 'd1';
  canaryTenant: boolean;
  fallbackReason: string | null;
  diagnostics: RecipeAuthorityDiagnostic[];
}

const counters = { static: 0, d1: 0, canaryFallback: 0, d1Fallback: 0, staleServed: 0, notReady: 0 };
/** Bounded per-isolate counters for health/diagnostics; no external monitoring platform. */
export function recipeAuthorityCounters(): Readonly<typeof counters> { return { ...counters }; }
export function resetRecipeAuthorityCountersForTests(): void { for (const key of Object.keys(counters) as Array<keyof typeof counters>) counters[key] = 0; }

export interface ResolveRecipeAuthorityOptions {
  /** Stable tenant key for canary bucketing (householdId). Absent ⇒ never in canary. */
  tenantKey?: string | null;
  /** Off-response executor for the shadow comparison (ctx.waitUntil). */
  backgroundExecutor?: (task: Promise<unknown>) => void;
  now?: () => number;
  log?: (diagnostic: RecipeAuthorityDiagnostic) => void;
}

const defaultLog = (diagnostic: RecipeAuthorityDiagnostic) => {
  if (diagnostic.level !== 'info') console.warn(JSON.stringify(diagnostic));
};

/**
 * Chooses ONE coherent snapshot for the current request/operation. Never throws: D1 problems in
 * canary/d1 fall back to static with diagnostics, and INVALID configuration serves static with an
 * error-level `recipe_catalog_config_invalid` diagnostic (production config validation also marks
 * it fatal, so `/health/ready` fails and the deploy smoke refuses the release). A typo is therefore
 * never silently "static": it is loud in logs and in readiness, but it never takes recipes offline.
 */
export async function resolveRecipeAuthority(env: RecipeAuthorityEnv, options: ResolveRecipeAuthorityOptions = {}): Promise<RecipeAuthorityResolution> {
  const now = options.now ?? (() => Date.now());
  const log = options.log ?? defaultLog;
  const diagnostics: RecipeAuthorityDiagnostic[] = [];
  const emit = (diagnostic: RecipeAuthorityDiagnostic) => { diagnostics.push(diagnostic); log(diagnostic); };
  const staticSnapshot = await staticAuthority.load();
  let config: RecipeAuthorityConfig;
  try {
    config = resolveRecipeAuthorityConfig(env);
  } catch (error) {
    counters.static += 1;
    const reasonCode = error instanceof RecipeAuthorityConfigError ? error.code : 'INVALID_MODE';
    emit({ level: 'error', event: 'recipe_catalog_config_invalid', configuredMode: 'invalid', selectedSource: 'static', actualSource: 'static', reasonCode });
    return { snapshot: staticSnapshot, configuredMode: 'static', selectedSource: 'static', actualSource: 'static', canaryTenant: false, fallbackReason: reasonCode, diagnostics };
  }

  const serveStatic = (selectedSource: 'static' | 'd1', canaryTenant: boolean, fallbackReason: string | null): RecipeAuthorityResolution => {
    counters.static += 1;
    return { snapshot: staticSnapshot, configuredMode: config.mode, selectedSource, actualSource: 'static', canaryTenant, fallbackReason, diagnostics };
  };

  if (config.mode === 'static') return serveStatic('static', false, null);
  if (config.mode === 'shadow') {
    scheduleRecipeCatalogShadow(env, options.backgroundExecutor, undefined, now);
    return serveStatic('static', false, null);
  }

  const canaryTenant = config.mode === 'canary' && !!options.tenantKey && isRecipeCanaryTenant(options.tenantKey, config.canaryPercent);
  if (config.mode === 'canary' && !canaryTenant) return serveStatic('static', false, null);

  const outcome = await loadVerifiedD1(env.DB, now);
  if (outcome.kind === 'unavailable') {
    counters.notReady += 1;
    const reasonCode = outcome.readiness.code;
    emit({ level: 'warn', event: 'recipe_catalog_d1_not_ready', configuredMode: config.mode, selectedSource: 'd1', actualSource: 'static', canary: canaryTenant, reasonCode, fingerprintMatch: false });
    if (config.mode === 'canary') {
      counters.canaryFallback += 1;
      emit({ level: 'warn', event: 'recipe_catalog_canary_fallback', configuredMode: config.mode, selectedSource: 'd1', actualSource: 'static', canary: true, reasonCode });
    } else {
      counters.d1Fallback += 1;
      emit({ level: 'error', event: 'recipe_catalog_d1_fallback', configuredMode: config.mode, selectedSource: 'd1', actualSource: 'static', reasonCode });
    }
    return serveStatic('d1', canaryTenant, reasonCode);
  }
  if (outcome.kind === 'stale') {
    counters.staleServed += 1;
    emit({ level: 'warn', event: 'recipe_catalog_d1_stale_served', configuredMode: config.mode, selectedSource: 'd1', actualSource: 'd1', canary: canaryTenant, reasonCode: outcome.readiness.code, staleAgeMs: outcome.ageMs, fingerprintMatch: true });
  }
  counters.d1 += 1;
  emit({ level: 'info', event: 'recipe_catalog_authority_selected', configuredMode: config.mode, selectedSource: 'd1', actualSource: 'd1', canary: canaryTenant, fingerprintMatch: true, recipeCount: outcome.snapshot.size });
  return { snapshot: outcome.snapshot, configuredMode: config.mode, selectedSource: 'd1', actualSource: 'd1', canaryTenant, fallbackReason: null, diagnostics };
}

/** Convenience for Hono handlers: extracts `waitUntil` when an ExecutionContext exists (not in unit harnesses). */
export function backgroundExecutorOf(c: { executionCtx?: { waitUntil(task: Promise<unknown>): void } }): ((task: Promise<unknown>) => void) | undefined {
  try {
    const ctx = c.executionCtx;
    return ctx ? (task) => ctx.waitUntil(task) : undefined;
  } catch {
    return undefined;
  }
}
