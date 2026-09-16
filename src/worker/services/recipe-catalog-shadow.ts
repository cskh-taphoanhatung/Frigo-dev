import type { D1DatabaseBinding } from '@frigo/db';
import { readRecipeContent } from '../../../packages/db/src/recipe-content';
import { ALL_RECIPES } from '../../../packages/recipes/src/data';
import {
  compareRuntimeCatalogs,
  D1RuntimeRecipeCatalog,
  type RecipeCatalogShadowDiagnostics,
} from '../../../packages/recipes/src/runtime-catalog';
import { parseRecipeAuthorityMode, type RecipeAuthorityMode } from './recipe-authority';

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
 * T14D (ADR-026) adds `canary`/`d1` user-visible modes in `recipe-authority.ts`; the mode parser
 * lives there. This module keeps the shadow comparison only and runs solely when mode is `shadow`.
 */
export type RecipeCatalogMode = RecipeAuthorityMode;

/** @deprecated T14D: use RecipeAuthorityConfigError; kept so existing callers/tests keep their error class. */
export class RecipeCatalogModeError extends Error {
  constructor(value: unknown) {
    super(`Unsupported RECIPE_CATALOG_MODE: ${String(value)}`);
    this.name = 'RecipeCatalogModeError';
  }
}

/** Strict parse of RECIPE_CATALOG_MODE (static default; static|shadow|canary|d1; anything else throws). */
export function resolveRecipeCatalogMode(value: unknown): RecipeCatalogMode {
  try {
    return parseRecipeAuthorityMode(value);
  } catch {
    throw new RecipeCatalogModeError(value);
  }
}

export type RecipeCatalogShadowOutcome =
  | { status: 'skipped'; mode: Exclude<RecipeCatalogMode, 'shadow'> }
  | { status: 'throttled'; mode: 'shadow'; nextEligibleInMs: number }
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
  catalog_order_drift_count: number | null;
  catalog_hydration_failure_count: number | null;
  catalog_lookup_ms: number;
  /** Bounded sample of recipe IDs/field names only; never inventory or user data. */
  drift_sample: Array<{ id: string; fields: string[] }>;
  order_drift_sample: Array<{ id: string; staticPosition: number; d1Position: number }>;
  hydration_failure_sample: Array<{ id: string; code: string }>;
  error?: string;
}

const SAMPLE_LIMIT = 10;

/**
 * Cost bound: at most one full catalog read + comparison per isolate per interval. The catalog
 * changes only by migration, so comparing it on every request would be pure waste; one sample
 * per minute per isolate is enough to observe drift, and with 5,000 recipes that is still one
 * five-statement batch, not 5,000×N requests.
 */
export const DEFAULT_RECIPE_CATALOG_SHADOW_INTERVAL_MS = 60_000;
export const MIN_RECIPE_CATALOG_SHADOW_INTERVAL_MS = 1_000;
export const MAX_RECIPE_CATALOG_SHADOW_INTERVAL_MS = 24 * 60 * 60 * 1000;
let lastShadowStartedAt: number | null = null;

export function resolveRecipeCatalogShadowIntervalMs(value: unknown): number {
  if (value === undefined || value === null || value === '') return DEFAULT_RECIPE_CATALOG_SHADOW_INTERVAL_MS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_RECIPE_CATALOG_SHADOW_INTERVAL_MS;
  return Math.min(MAX_RECIPE_CATALOG_SHADOW_INTERVAL_MS, Math.max(MIN_RECIPE_CATALOG_SHADOW_INTERVAL_MS, Math.floor(parsed)));
}

/** Test seam: forget the isolate's last shadow run. */
export function resetRecipeCatalogShadowThrottle(): void {
  lastShadowStartedAt = null;
}

/** Runs the shadow comparison once for a request scope; safe to call from `waitUntil`. */
export async function runRecipeCatalogShadow(
  db: D1DatabaseBinding | undefined,
  mode: RecipeCatalogMode,
  now: () => number = () => Date.now(),
): Promise<RecipeCatalogShadowOutcome> {
  if (mode !== 'shadow') return { status: 'skipped', mode };
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
    const healthy = d.driftCount === 0 && d.orderDriftCount === 0 && d.staticOnlyCount === 0 && d.d1OnlyCount === 0 && d.hydrationFailureCount === 0;
    return {
      ...base, level: healthy ? 'info' : 'warn',
      catalog_d1_count: d.d1RowCount, catalog_complete_count: d.d1CompleteCount, catalog_hydrated_count: d.hydratedCount,
      catalog_static_only_count: d.staticOnlyCount, catalog_d1_only_count: d.d1OnlyCount,
      catalog_drift_count: d.driftCount, catalog_order_drift_count: d.orderDriftCount, catalog_hydration_failure_count: d.hydrationFailureCount,
      catalog_lookup_ms: d.lookupMs,
      drift_sample: d.drift.slice(0, SAMPLE_LIMIT).map((item) => ({ id: item.id, fields: item.fields })),
      order_drift_sample: d.orderDrift.slice(0, SAMPLE_LIMIT).map((item) => ({ id: item.id, staticPosition: item.staticPosition, d1Position: item.d1Position })),
      hydration_failure_sample: d.hydrationFailures.slice(0, SAMPLE_LIMIT).map((item) => ({ id: item.id, code: item.code })),
    };
  }
  return {
    ...base, level: outcome.status === 'shadow_error' ? 'warn' : 'info',
    catalog_d1_count: null, catalog_complete_count: null, catalog_hydrated_count: null,
    catalog_static_only_count: null, catalog_d1_only_count: null, catalog_drift_count: null, catalog_order_drift_count: null,
    catalog_hydration_failure_count: null, catalog_lookup_ms: outcome.status === 'shadow_error' ? outcome.lookupMs : 0,
    drift_sample: [], order_drift_sample: [], hydration_failure_sample: [],
    ...(outcome.status === 'shadow_error' ? { error: outcome.error } : {}),
  };
}

/** Throttle decision for the current isolate; records the start time when a run is admitted. */
export function admitRecipeCatalogShadowRun(intervalMs: number, now: () => number = () => Date.now()): { admitted: true } | { admitted: false; nextEligibleInMs: number } {
  const current = now();
  if (lastShadowStartedAt !== null && current - lastShadowStartedAt < intervalMs) {
    return { admitted: false, nextEligibleInMs: intervalMs - (current - lastShadowStartedAt) };
  }
  lastShadowStartedAt = current;
  return { admitted: true };
}

/**
 * Schedules the shadow comparison off the response path when the mode is `shadow`, at most once
 * per `RECIPE_CATALOG_SHADOW_INTERVAL_MS` per isolate (throttled requests return `throttled`
 * without touching D1 and without logging). The response is never awaited on it; without an
 * executor (tests/local) the promise is simply returned so callers can await it explicitly.
 */
export function scheduleRecipeCatalogShadow(
  env: { DB?: D1DatabaseBinding; RECIPE_CATALOG_MODE?: string; RECIPE_CATALOG_SHADOW_INTERVAL_MS?: string },
  backgroundExecutor?: (task: Promise<unknown>) => void,
  log: (record: RecipeCatalogShadowLogRecord) => void = (record) => console.log(JSON.stringify(record)),
  now: () => number = () => Date.now(),
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
  if (mode !== 'shadow') return null;
  const admission = admitRecipeCatalogShadowRun(resolveRecipeCatalogShadowIntervalMs(env.RECIPE_CATALOG_SHADOW_INTERVAL_MS), now);
  if (!admission.admitted) return Promise.resolve({ status: 'throttled', mode, nextEligibleInMs: admission.nextEligibleInMs });
  const task = runRecipeCatalogShadow(env.DB, mode, now).then((outcome) => {
    log(toRecipeCatalogShadowLogRecord(outcome));
    return outcome;
  });
  backgroundExecutor?.(task.then(() => undefined, () => undefined));
  return task;
}
