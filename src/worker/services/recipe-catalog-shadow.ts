import type { D1DatabaseBinding } from '@frigo/db';
import { readRecipeContent } from '../../../packages/db/src/recipe-content';
import { ALL_RECIPES } from '../../../packages/recipes/src/data';
import {
  compareRuntimeCatalogs,
  D1RuntimeRecipeCatalog,
  type RecipeCatalogShadowDiagnostics,
} from '../../../packages/recipes/src/runtime-catalog';

/**
 * Recipe catalog shadow service (T14B-B).
 *
 * `RECIPE_CATALOG_MODE`:
 * - `static` (default, and the only value production uses): nothing here runs; `ALL_RECIPES`
 *   answers every request exactly as before.
 * - `shadow`: static STILL answers every request. A bounded side path reads the D1 catalog
 *   once (one five-statement batch), hydrates it, compares it with the static authority and
 *   emits one structured diagnostic. D1 failure is recorded as `shadow_error`, never as
 *   static "success", and never changes the user-visible response.
 *
 * There is deliberately no `d1` mode: authority cutover is a separate explicit task.
 */
export type RecipeCatalogMode = 'static' | 'shadow';

export class RecipeCatalogModeError extends Error {
  constructor(value: unknown) {
    super(`Unsupported RECIPE_CATALOG_MODE: ${String(value)}`);
    this.name = 'RecipeCatalogModeError';
  }
}

export function resolveRecipeCatalogMode(value: unknown): RecipeCatalogMode {
  if (value === undefined || value === null || value === '' || value === 'static') return 'static';
  if (value === 'shadow') return 'shadow';
  throw new RecipeCatalogModeError(value);
}

export type RecipeCatalogShadowOutcome =
  | { status: 'skipped'; mode: 'static' }
  | { status: 'compared'; mode: 'shadow'; diagnostics: RecipeCatalogShadowDiagnostics }
  | { status: 'shadow_error'; mode: 'shadow'; error: string; lookupMs: number };

export interface RecipeCatalogShadowLogRecord {
  level: 'info' | 'warn';
  event: 'recipe_catalog_shadow';
  catalog_source: 'static';
  catalog_mode: RecipeCatalogMode;
  status: RecipeCatalogShadowOutcome['status'];
  catalog_static_count: number;
  catalog_d1_count: number | null;
  catalog_complete_count: number | null;
  catalog_hydrated_count: number | null;
  catalog_static_only_count: number | null;
  catalog_d1_only_count: number | null;
  catalog_drift_count: number | null;
  catalog_hydration_failure_count: number | null;
  catalog_lookup_ms: number;
  /** Bounded sample of recipe IDs/field names only; never inventory or user data. */
  drift_sample: Array<{ id: string; fields: string[] }>;
  hydration_failure_sample: Array<{ id: string; code: string }>;
  error?: string;
}

const SAMPLE_LIMIT = 10;

/** Runs the shadow comparison once for a request scope; safe to call from `waitUntil`. */
export async function runRecipeCatalogShadow(
  db: D1DatabaseBinding | undefined,
  mode: RecipeCatalogMode,
  now: () => number = () => Date.now(),
): Promise<RecipeCatalogShadowOutcome> {
  if (mode === 'static') return { status: 'skipped', mode };
  const started = now();
  if (!db) return { status: 'shadow_error', mode, error: 'D1 binding unavailable', lookupMs: now() - started };
  try {
    const catalog = new D1RuntimeRecipeCatalog(() => readRecipeContent(db));
    const [snapshot, hydration] = [await catalog.readSnapshot(), await catalog.hydrate()];
    const diagnostics = compareRuntimeCatalogs(ALL_RECIPES, snapshot, hydration, 0);
    diagnostics.lookupMs = now() - started;
    return { status: 'compared', mode, diagnostics };
  } catch (error) {
    return { status: 'shadow_error', mode, error: error instanceof Error ? error.name : 'unknown', lookupMs: now() - started };
  }
}

/** Flattens an outcome into the structured, PII-free log payload. */
export function toRecipeCatalogShadowLogRecord(outcome: RecipeCatalogShadowOutcome): RecipeCatalogShadowLogRecord {
  const base = {
    event: 'recipe_catalog_shadow' as const, catalog_source: 'static' as const, catalog_mode: outcome.mode,
    status: outcome.status, catalog_static_count: ALL_RECIPES.length,
  };
  if (outcome.status === 'compared') {
    const d = outcome.diagnostics;
    const healthy = d.driftCount === 0 && d.staticOnlyCount === 0 && d.d1OnlyCount === 0 && d.hydrationFailureCount === 0;
    return {
      ...base, level: healthy ? 'info' : 'warn',
      catalog_d1_count: d.d1RowCount, catalog_complete_count: d.d1CompleteCount, catalog_hydrated_count: d.hydratedCount,
      catalog_static_only_count: d.staticOnlyCount, catalog_d1_only_count: d.d1OnlyCount,
      catalog_drift_count: d.driftCount, catalog_hydration_failure_count: d.hydrationFailureCount,
      catalog_lookup_ms: d.lookupMs,
      drift_sample: d.drift.slice(0, SAMPLE_LIMIT).map((item) => ({ id: item.id, fields: item.fields })),
      hydration_failure_sample: d.hydrationFailures.slice(0, SAMPLE_LIMIT).map((item) => ({ id: item.id, code: item.code })),
    };
  }
  return {
    ...base, level: outcome.status === 'shadow_error' ? 'warn' : 'info',
    catalog_d1_count: null, catalog_complete_count: null, catalog_hydrated_count: null,
    catalog_static_only_count: null, catalog_d1_only_count: null, catalog_drift_count: null,
    catalog_hydration_failure_count: null, catalog_lookup_ms: outcome.status === 'shadow_error' ? outcome.lookupMs : 0,
    drift_sample: [], hydration_failure_sample: [],
    ...(outcome.status === 'shadow_error' ? { error: outcome.error } : {}),
  };
}

/**
 * Schedules the shadow comparison off the response path when the mode is `shadow`. The
 * response is never awaited on it; without an executor (tests/local) the promise is simply
 * returned so callers can await it explicitly.
 */
export function scheduleRecipeCatalogShadow(
  env: { DB?: D1DatabaseBinding; RECIPE_CATALOG_MODE?: string },
  backgroundExecutor?: (task: Promise<unknown>) => void,
  log: (record: RecipeCatalogShadowLogRecord) => void = (record) => console.log(JSON.stringify(record)),
): Promise<RecipeCatalogShadowOutcome> | null {
  let mode: RecipeCatalogMode;
  try {
    mode = resolveRecipeCatalogMode(env.RECIPE_CATALOG_MODE);
  } catch {
    // An unknown mode must never break a recipe read; it is reported as a shadow error.
    const outcome: RecipeCatalogShadowOutcome = { status: 'shadow_error', mode: 'shadow', error: 'RecipeCatalogModeError', lookupMs: 0 };
    log(toRecipeCatalogShadowLogRecord(outcome));
    return Promise.resolve(outcome);
  }
  if (mode === 'static') return null;
  const task = runRecipeCatalogShadow(env.DB, mode).then((outcome) => {
    log(toRecipeCatalogShadowLogRecord(outcome));
    return outcome;
  });
  backgroundExecutor?.(task.then(() => undefined, () => undefined));
  return task;
}
