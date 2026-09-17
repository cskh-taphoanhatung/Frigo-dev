import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readRecipeContent } from '../../packages/db/src/recipe-content';
import type { D1RecipeContentSnapshot } from '../../packages/recipes/src/catalog-drift';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import {
  assessD1Readiness,
  currentCatalogRelease,
  canonicalRecipeProjection,
  createRecipeAuthoritySnapshot,
  D1RecipeAuthority,
  fingerprintRecipes,
  fnv1a32,
  isRecipeCanaryTenant,
  parseRecipeCanaryPercent,
  RECIPE_CANARY_BUCKETS,
  RECIPE_FINGERPRINT_FIELDS,
  recipeCanaryBucket,
  StaticRecipeAuthority,
} from '../../packages/recipes/src/recipe-authority';
import { hydrateRuntimeRecipes } from '../../packages/recipes/src/runtime-hydration';
import { RUNTIME_RECIPE_FIELDS } from '../../packages/recipes/src/runtime-recipe';
import {
  RECIPE_AUTHORITY_D1_STALE_GRACE_MS,
  RECIPE_AUTHORITY_D1_TTL_MS,
  recipeAuthorityCounters,
  resetRecipeAuthorityCacheForTests,
  resetRecipeAuthorityCountersForTests,
  resolveRecipeAuthority,
  type RecipeAuthorityDiagnostic,
} from '../../src/worker/services/recipe-authority';
import { resetRecipeCatalogShadowThrottle } from '../../src/worker/services/recipe-catalog-shadow';
import type { Env } from '../../src/worker/types';
import { SqliteD1, type SqliteStatementEvent } from '../helpers/sqlite-d1';

const ids = (recipes: readonly { id: string }[]) => recipes.map((recipe) => recipe.id);

/** Deliberately corrupted views of the real D1 content snapshot (fixtures only; the ledger is never mutated). */
function reorder(snapshot: D1RecipeContentSnapshot): D1RecipeContentSnapshot {
  const max = Math.max(...snapshot.runtimeFields.map((row) => row.runtimeOrder ?? 0));
  return { ...snapshot, runtimeFields: snapshot.runtimeFields.map((row) => ({ ...row, runtimeOrder: row.runtimeOrder === null ? null : max - row.runtimeOrder })) };
}
function retitle(snapshot: D1RecipeContentSnapshot, id: string): D1RecipeContentSnapshot {
  return { ...snapshot, recipes: snapshot.recipes.map((row) => (row.id === id ? { ...row, title: `${row.title} (edited)` } : row)) };
}
function reverseIngredients(snapshot: D1RecipeContentSnapshot, id: string): D1RecipeContentSnapshot {
  const lines = snapshot.requirements.filter((line) => line.recipeId === id);
  const positions = lines.map((line) => line.position);
  return { ...snapshot, requirements: snapshot.requirements.map((line) => {
    if (line.recipeId !== id) return line;
    const index = lines.indexOf(line);
    return { ...line, position: positions[lines.length - 1 - index] };
  }) };
}
function dropRecipe(snapshot: D1RecipeContentSnapshot, id: string): D1RecipeContentSnapshot {
  return {
    recipes: snapshot.recipes.filter((row) => row.id !== id), requirements: snapshot.requirements.filter((line) => line.recipeId !== id),
    steps: snapshot.steps.filter((step) => step.recipeId !== id), nutritionRecipeIds: snapshot.nutritionRecipeIds.filter((rid) => rid !== id),
    runtimeFields: snapshot.runtimeFields.filter((row) => row.recipeId !== id),
  };
}
function duplicateRecipe(snapshot: D1RecipeContentSnapshot, id: string): D1RecipeContentSnapshot {
  const row = snapshot.recipes.find((recipe) => recipe.id === id)!;
  return { ...snapshot, recipes: [...snapshot.recipes, { ...row }] };
}
function changeQuantity(snapshot: D1RecipeContentSnapshot, id: string): D1RecipeContentSnapshot {
  let done = false;
  return { ...snapshot, requirements: snapshot.requirements.map((line) => {
    if (line.recipeId !== id || done) return line;
    done = true; return { ...line, requiredQuantity: line.requiredQuantity + 1 };
  }) };
}
function changeStep(snapshot: D1RecipeContentSnapshot, id: string): D1RecipeContentSnapshot {
  let done = false;
  return { ...snapshot, steps: snapshot.steps.map((step) => {
    if (step.recipeId !== id || done) return step;
    done = true; return { ...step, instruction: `${step.instruction}!` };
  }) };
}
function changeTag(snapshot: D1RecipeContentSnapshot, id: string): D1RecipeContentSnapshot {
  return { ...snapshot, recipes: snapshot.recipes.map((row) => (row.id === id ? { ...row, tags: [...(row.tags ?? []), 'extra-tag'] } : row)) };
}

describe('T14D — catalog fingerprint and D1 readiness (pure)', () => {
  let db: SqliteD1;
  let content: D1RecipeContentSnapshot;
  const staticAuthority = new StaticRecipeAuthority(ALL_RECIPES, () => 1);
  beforeEach(async () => { db = new SqliteD1(); content = await readRecipeContent(db); });
  afterEach(() => db.close());

  it('fingerprint covers every runtime field in canonical order, is deterministic, key-order independent and media-free', async () => {
    expect(RECIPE_FINGERPRINT_FIELDS).toEqual(RUNTIME_RECIPE_FIELDS);
    expect(RECIPE_FINGERPRINT_FIELDS).toContain('imageUrl'); // still part of the semantic Recipe payload
    const a = await fingerprintRecipes(ALL_RECIPES);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(await fingerprintRecipes([...ALL_RECIPES])).toBe(a);
    // Object key order must not matter; array order must.
    const shuffledKeys = ALL_RECIPES.map((recipe) => Object.fromEntries(Object.entries(recipe).reverse())) as typeof ALL_RECIPES;
    expect(await fingerprintRecipes(shuffledKeys)).toBe(a);
    expect(await fingerprintRecipes([...ALL_RECIPES].reverse())).not.toBe(a);
    expect(await fingerprintRecipes(ALL_RECIPES.slice(1))).not.toBe(a);
    const projection = canonicalRecipeProjection(ALL_RECIPES);
    expect(projection).not.toMatch(/recipe_media|canonical_r2|storage_key|content_hash|loadedAt|created_at|updated_at/);
    // The projection is the strict runtime contract: stray non-runtime properties (row ids, timestamps,
    // media presentation) are rejected rather than silently hashed, so the fingerprint can never absorb them.
    const decorated = ALL_RECIPES.map((recipe) => ({ ...recipe, rowid: 1, updatedAt: 'now', media: { hero: { source: 'canonical_r2' } } })) as unknown as typeof ALL_RECIPES;
    await expect(fingerprintRecipes(decorated)).rejects.toThrow();
  });

  it('static snapshot preserves exact order/IDs/fields and indexes by id and slug', async () => {
    const snapshot = await staticAuthority.load();
    expect(snapshot.source).toBe('static');
    expect(snapshot.size).toBe(ALL_RECIPES.length);
    expect(snapshot.list()).toStrictEqual(JSON.parse(JSON.stringify(ALL_RECIPES)));
    expect(ids(snapshot.list())).toEqual(ids(ALL_RECIPES));
    expect(snapshot.findById('gl-01')?.id).toBe('gl-01');
    expect(snapshot.findByIdOrSlug(ALL_RECIPES[3].slug)?.id).toBe(ALL_RECIPES[3].id);
    expect(snapshot.findByIdOrSlug('nope')).toBeNull();
    expect(snapshot.findById(ALL_RECIPES[3].slug)).toBeNull();
    // list() hands out a fresh array: filtering by a consumer never mutates the snapshot.
    snapshot.list().length = 0;
    expect(snapshot.size).toBe(ALL_RECIPES.length);
    expect(await staticAuthority.load()).toBe(snapshot); // process-lifetime instance
  });

  it('D1 authority is ready against the real ledger: same count, IDs, order, fields and fingerprint; snapshot lists are strict-equal', async () => {
    const authority = new D1RecipeAuthority(() => Promise.resolve(content), staticAuthority, () => 2);
    const loaded = await authority.load();
    expect(loaded.status).toBe('ready');
    if (loaded.status !== 'ready') return;
    const staticSnapshot = await staticAuthority.load();
    // T14E: readiness also names the reviewed release; with today's manifest it is the 71-recipe static baseline.
    expect(loaded.readiness).toEqual({ status: 'ready', source: 'd1', fingerprint: staticSnapshot.fingerprint, recipeCount: 71, releaseId: currentCatalogRelease().releaseId });
    expect(loaded.snapshot.source).toBe('d1');
    expect(loaded.snapshot.fingerprint).toBe(staticSnapshot.fingerprint);
    expect(loaded.snapshot.list()).toStrictEqual(staticSnapshot.list()); // no normalisation through ALL_RECIPES
    expect(loaded.snapshot.findByIdOrSlug('vn-canh-01')).toStrictEqual(staticSnapshot.findByIdOrSlug('vn-canh-01'));
  });

  it('readiness negative controls: count, id, order, ingredient order, field and duplicate drift are each detected with a specific code', async () => {
    const baseline = await staticAuthority.load();
    const assess = (snapshot: D1RecipeContentSnapshot) => assessD1Readiness(baseline, hydrateRuntimeRecipes(snapshot)).then((result) => result.readiness);
    expect((await assess(content)).status).toBe('ready');
    expect(await assess(reorder(content))).toMatchObject({ status: 'not_ready', code: 'ORDER_DRIFT' });
    expect(await assess(dropRecipe(content, 'gl-05'))).toMatchObject({ status: 'not_ready', code: 'COUNT_DRIFT', detail: { expectedCount: 71, actualCount: 70 } });
    expect(await assess(duplicateRecipe(content, 'gl-05'))).toMatchObject({ status: 'not_ready', code: 'CATALOG_DIAGNOSTICS' });
    // T14E (ADR-027): a field change inside one of the 71 legacy recipes is LEGACY_BASELINE_DRIFT — the
    // rollback baseline is protected explicitly even when a release manifest approves extra recipes.
    for (const mutate of [retitle, reverseIngredients, changeQuantity, changeStep, changeTag]) {
      const readiness = await assess(mutate(content, 'vn-canh-02'));
      expect(readiness, mutate.name).toMatchObject({ status: 'not_ready', code: 'LEGACY_BASELINE_DRIFT' });
      if (readiness.status === 'not_ready') {
        expect(readiness.detail.fieldDriftSample[0]?.id, mutate.name).toBe('vn-canh-02');
        expect(readiness.detail.actualFingerprint, mutate.name).not.toBe(readiness.detail.expectedFingerprint);
      }
    }
    const swapped = await assess({ ...content, recipes: content.recipes.map((row) => (row.id === 'gl-12' ? { ...row, id: 'gl-99', slug: 'gl-99' } : row)),
      requirements: content.requirements.map((line) => (line.recipeId === 'gl-12' ? { ...line, recipeId: 'gl-99' } : line)),
      steps: content.steps.map((step) => (step.recipeId === 'gl-12' ? { ...step, recipeId: 'gl-99' } : step)),
      runtimeFields: content.runtimeFields.map((row) => (row.recipeId === 'gl-12' ? { ...row, recipeId: 'gl-99' } : row)) });
    expect(swapped).toMatchObject({ status: 'not_ready', code: 'ID_DRIFT', detail: { idDriftSample: ['gl-12', 'gl-99'] } });
    // Detail is bounded and PII-free: counts, ids and field names only.
    const drift = await assess(retitle(content, 'gl-01'));
    if (drift.status === 'not_ready') expect(JSON.stringify(drift.detail)).not.toMatch(/edited|Trứng|instruction/);
    // A D1 read failure is an error, not "not ready", and never a snapshot.
    const failing = new D1RecipeAuthority(() => Promise.reject(new Error('boom')), staticAuthority);
    expect(await failing.load()).toMatchObject({ status: 'error', snapshot: null, readiness: { code: 'D1_READ_FAILED', error: 'Error' } });
    const notReady = new D1RecipeAuthority(() => Promise.resolve(reorder(content)), staticAuthority);
    expect((await notReady.load()).snapshot).toBeNull();
  });
});

describe('T14D — deterministic canary assignment', () => {
  it('parses percent strictly (0..100 integers) with default 0', () => {
    expect(parseRecipeCanaryPercent(undefined)).toBe(0);
    expect(parseRecipeCanaryPercent('')).toBe(0);
    for (const value of ['0', '1', '50', '99', '100', 7]) expect(parseRecipeCanaryPercent(value)).toBe(Number(value));
    for (const value of ['-1', '101', '1.5', 1.5, '05', '1e1', 'abc', ' 5 ', NaN, '+5']) expect(parseRecipeCanaryPercent(value), String(value)).toBeNull();
  });

  it('FNV-1a is stable and bucketing is deterministic across calls (same household + same percent ⇒ same choice)', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
    const bucket = recipeCanaryBucket('hh_123');
    for (let index = 0; index < 100; index += 1) expect(recipeCanaryBucket('hh_123')).toBe(bucket);
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(RECIPE_CANARY_BUCKETS);
    for (const percent of [0, 1, 50, 99, 100]) {
      const first = isRecipeCanaryTenant('hh_123', percent);
      for (let index = 0; index < 20; index += 1) expect(isRecipeCanaryTenant('hh_123', percent)).toBe(first);
    }
    expect(() => isRecipeCanaryTenant('hh', 101)).toThrow(RangeError);
    expect(() => isRecipeCanaryTenant('hh', 2.5)).toThrow(RangeError);
  });

  it('0% selects nobody, 100% selects everybody, and membership is monotonic in percent', () => {
    const households = Array.from({ length: 2_000 }, (_, index) => `household-${index}-${(index * 7919) % 104729}`);
    expect(households.some((id) => isRecipeCanaryTenant(id, 0))).toBe(false);
    expect(households.every((id) => isRecipeCanaryTenant(id, 100))).toBe(true);
    for (const id of households.slice(0, 200)) {
      let previous = false;
      for (const percent of [1, 5, 10, 25, 50, 75, 99, 100]) {
        const current = isRecipeCanaryTenant(id, percent);
        if (previous) expect(current, `${id}@${percent}`).toBe(true);
        previous = current;
      }
    }
  });

  it('distribution over 20,000 synthetic households approximates the requested percent (±1.5 points)', () => {
    const households = Array.from({ length: 20_000 }, (_, index) => `hh-${index.toString(36)}-${(index * 2654435761) >>> 0}`);
    for (const percent of [1, 10, 25, 50, 75, 99]) {
      const inside = households.filter((id) => isRecipeCanaryTenant(id, percent)).length;
      const observed = (inside / households.length) * 100;
      expect(Math.abs(observed - percent), `${percent}% → ${observed.toFixed(2)}%`).toBeLessThan(1.5);
    }
  });
});

describe('T14D — authority router: modes, fallback, cache/singleflight, observability', () => {
  let db: SqliteD1;
  const diagnostics: RecipeAuthorityDiagnostic[] = [];
  const log = (diagnostic: RecipeAuthorityDiagnostic) => diagnostics.push(diagnostic);
  let clock = 1_000_000;
  const now = () => clock;
  const env = (overrides: Partial<Env> = {}): Env => ({ DB: db, ...overrides }) as unknown as Env;
  const canaryEnv = (percent: string, overrides: Partial<Env> = {}) => env({ RECIPE_CATALOG_MODE: 'canary', RECIPE_CATALOG_D1_CANARY_PERCENT: percent, RECIPE_CATALOG_CUTOVER_ENABLED: 'true', ...overrides });
  const d1Env = (overrides: Partial<Env> = {}) => env({ RECIPE_CATALOG_MODE: 'd1', RECIPE_CATALOG_CUTOVER_ENABLED: 'true', ...overrides });
  const broken = { prepare: () => { throw new Error('boom'); }, batch: () => { throw new Error('boom'); } } as unknown as Env['DB'];

  beforeEach(() => { db = new SqliteD1(); diagnostics.length = 0; resetRecipeAuthorityCacheForTests(); resetRecipeAuthorityCountersForTests(); resetRecipeCatalogShadowThrottle(); });
  afterEach(() => db.close());

  it('static (default) and shadow serve ALL_RECIPES without touching D1 for content; shadow schedules the comparison off-response', async () => {
    const statements: SqliteStatementEvent[] = [];
    db.hooks = { beforeStatement: (event) => { statements.push(event); }, beforeBatch: (batch) => { statements.push(...batch); } };
    const resolution = await resolveRecipeAuthority(env(), { tenantKey: 'hh', now, log });
    expect(resolution).toMatchObject({ configuredMode: 'static', selectedSource: 'static', actualSource: 'static', canaryTenant: false, fallbackReason: null, diagnostics: [] });
    expect(resolution.snapshot.source).toBe('static');
    expect(ids(resolution.snapshot.list())).toEqual(ids(ALL_RECIPES));
    expect(statements).toEqual([]);
    const scheduled: Promise<unknown>[] = [];
    const shadow = await resolveRecipeAuthority(env({ RECIPE_CATALOG_MODE: 'shadow' }), { tenantKey: 'hh', now, log, backgroundExecutor: (task) => scheduled.push(task) });
    expect(shadow.actualSource).toBe('static');
    expect(shadow.snapshot.source).toBe('static');
    expect(scheduled).toHaveLength(1);
    await Promise.all(scheduled);
    expect(statements.filter((event) => /FROM recipes/.test(event.sql)).length).toBeGreaterThan(0); // the shadow compare, not the response
    expect(recipeAuthorityCounters()).toMatchObject({ static: 2, d1: 0 });
  });

  it('d1 mode serves the verified D1 snapshot with exactly one five-statement batch, then hits the cache within the TTL', async () => {
    const batches: number[] = [];
    const single: string[] = [];
    db.hooks = { beforeBatch: (batch) => { batches.push(batch.length); }, beforeStatement: (event) => { single.push(event.sql); } };
    const first = await resolveRecipeAuthority(d1Env(), { tenantKey: 'hh', now, log });
    expect(first).toMatchObject({ configuredMode: 'd1', selectedSource: 'd1', actualSource: 'd1', fallbackReason: null });
    expect(first.snapshot.source).toBe('d1');
    expect(first.snapshot.list()).toStrictEqual(JSON.parse(JSON.stringify(ALL_RECIPES)));
    expect(batches).toEqual([5]);
    expect(single).toEqual([]);
    expect(diagnostics).toEqual([expect.objectContaining({ level: 'info', event: 'recipe_catalog_authority_selected', configuredMode: 'd1', selectedSource: 'd1', actualSource: 'd1', fingerprintMatch: true, recipeCount: 71 })]);
    clock += RECIPE_AUTHORITY_D1_TTL_MS - 1;
    const second = await resolveRecipeAuthority(d1Env(), { tenantKey: 'other', now, log });
    expect(second.snapshot).toBe(first.snapshot);
    expect(batches).toEqual([5]); // cache hit: no second read
    clock += 2;
    const third = await resolveRecipeAuthority(d1Env(), { tenantKey: 'hh', now, log });
    expect(third.snapshot).not.toBe(first.snapshot);
    expect(third.snapshot.fingerprint).toBe(first.snapshot.fingerprint);
    expect(batches).toEqual([5, 5]); // TTL expiry: one refresh
    expect(recipeAuthorityCounters()).toMatchObject({ d1: 3, static: 0 });
  });

  it('singleflight: ten concurrent first requests trigger exactly one D1 read and share one snapshot', async () => {
    const batches: number[] = [];
    db.hooks = { beforeBatch: async (batch) => { batches.push(batch.length); await new Promise((resolve) => setTimeout(resolve, 20)); } };
    const results = await Promise.all(Array.from({ length: 10 }, (_, index) => resolveRecipeAuthority(d1Env(), { tenantKey: `hh-${index}`, now, log })));
    expect(batches).toEqual([5]);
    expect(new Set(results.map((result) => result.snapshot)).size).toBe(1);
    expect(results.every((result) => result.actualSource === 'd1')).toBe(true);
  });

  it('canary: only bucketed households get D1; others static; the choice is stable per household; 0% and 100% behave as documented', async () => {
    const households = Array.from({ length: 300 }, (_, index) => `canary-hh-${index}`);
    const inside = households.filter((id) => isRecipeCanaryTenant(id, 20));
    const outside = households.filter((id) => !isRecipeCanaryTenant(id, 20));
    expect(inside.length).toBeGreaterThan(20);
    expect(outside.length).toBeGreaterThan(20);
    for (const id of inside.slice(0, 5)) {
      const resolution = await resolveRecipeAuthority(canaryEnv('20'), { tenantKey: id, now, log });
      expect(resolution, id).toMatchObject({ configuredMode: 'canary', canaryTenant: true, selectedSource: 'd1', actualSource: 'd1' });
      expect(resolution.snapshot.source).toBe('d1');
    }
    for (const id of outside.slice(0, 5)) {
      const resolution = await resolveRecipeAuthority(canaryEnv('20'), { tenantKey: id, now, log });
      expect(resolution, id).toMatchObject({ configuredMode: 'canary', canaryTenant: false, selectedSource: 'static', actualSource: 'static' });
    }
    for (let repeat = 0; repeat < 3; repeat += 1) {
      expect((await resolveRecipeAuthority(canaryEnv('20'), { tenantKey: inside[0], now, log })).actualSource).toBe('d1');
      expect((await resolveRecipeAuthority(canaryEnv('20'), { tenantKey: outside[0], now, log })).actualSource).toBe('static');
    }
    expect((await resolveRecipeAuthority(canaryEnv('0'), { tenantKey: inside[0], now, log })).actualSource).toBe('static');
    expect((await resolveRecipeAuthority(canaryEnv('100'), { tenantKey: outside[0], now, log })).actualSource).toBe('d1');
    // No tenant key (unauthenticated context) is never in the canary.
    expect((await resolveRecipeAuthority(canaryEnv('100'), { now, log })).actualSource).toBe('static');
    // Diagnostics never carry the raw household id.
    expect(JSON.stringify(diagnostics)).not.toMatch(/canary-hh-/);
  });

  it('canary fallback: D1 read failure or parity drift serves static with recipe_catalog_canary_fallback; never throws', async () => {
    const tenant = Array.from({ length: 100 }, (_, index) => `fb-${index}`).find((id) => isRecipeCanaryTenant(id, 50))!;
    const failed = await resolveRecipeAuthority(canaryEnv('50', { DB: broken }), { tenantKey: tenant, now, log });
    expect(failed).toMatchObject({ configuredMode: 'canary', canaryTenant: true, selectedSource: 'd1', actualSource: 'static', fallbackReason: 'D1_READ_FAILED' });
    expect(failed.snapshot.source).toBe('static');
    expect(diagnostics.map((diagnostic) => [diagnostic.event, diagnostic.level])).toEqual([
      ['recipe_catalog_d1_not_ready', 'warn'], ['recipe_catalog_canary_fallback', 'warn'],
    ]);
    diagnostics.length = 0;
    // Parity drift on a real database: the content is reordered in D1 (fixture) → not ready → static.
    // Two-phase update sidesteps the UNIQUE(runtime_order) constraint while reversing the canonical order.
    db.seed(`UPDATE recipe_runtime_fields SET runtime_order = runtime_order + 1000; UPDATE recipe_runtime_fields SET runtime_order = 1070 - runtime_order`);
    const drifted = await resolveRecipeAuthority(canaryEnv('50'), { tenantKey: tenant, now, log });
    expect(drifted).toMatchObject({ actualSource: 'static', selectedSource: 'd1', fallbackReason: 'ORDER_DRIFT' });
    expect(diagnostics[0]).toMatchObject({ event: 'recipe_catalog_d1_not_ready', reasonCode: 'ORDER_DRIFT', fingerprintMatch: false });
    expect(recipeAuthorityCounters()).toMatchObject({ canaryFallback: 2, d1Fallback: 0, notReady: 2 });
  });

  it('full d1 failure policy: emergency static fallback with an error-level recipe_catalog_d1_fallback; actualSource never lies', async () => {
    const resolution = await resolveRecipeAuthority(d1Env({ DB: broken }), { tenantKey: 'hh', now, log });
    expect(resolution).toMatchObject({ configuredMode: 'd1', selectedSource: 'd1', actualSource: 'static', fallbackReason: 'D1_READ_FAILED' });
    expect(resolution.snapshot.source).toBe('static');
    expect(diagnostics).toEqual([
      expect.objectContaining({ event: 'recipe_catalog_d1_not_ready', level: 'warn', reasonCode: 'D1_READ_FAILED' }),
      expect.objectContaining({ event: 'recipe_catalog_d1_fallback', level: 'error', selectedSource: 'd1', actualSource: 'static' }),
    ]);
    expect(recipeAuthorityCounters()).toMatchObject({ d1Fallback: 1, static: 1, d1: 0 });
    // No D1 binding at all behaves the same way.
    expect(await resolveRecipeAuthority(d1Env({ DB: undefined }), { tenantKey: 'hh', now, log })).toMatchObject({ actualSource: 'static', fallbackReason: 'D1_READ_FAILED' });
  });

  it('D1 failure with a previously verified snapshot: stale snapshot served within the grace window, then static; refresh success restores fresh', async () => {
    const first = await resolveRecipeAuthority(d1Env(), { tenantKey: 'hh', now, log });
    expect(first.actualSource).toBe('d1');
    diagnostics.length = 0;
    clock += RECIPE_AUTHORITY_D1_TTL_MS + 1;
    const stale = await resolveRecipeAuthority(d1Env({ DB: broken }), { tenantKey: 'hh', now, log });
    expect(stale.actualSource).toBe('d1');
    expect(stale.snapshot).toBe(first.snapshot);
    expect(diagnostics[0]).toMatchObject({ event: 'recipe_catalog_d1_stale_served', level: 'warn', reasonCode: 'D1_READ_FAILED', fingerprintMatch: true });
    expect(diagnostics[0].staleAgeMs).toBe(RECIPE_AUTHORITY_D1_TTL_MS + 1);
    diagnostics.length = 0;
    clock += RECIPE_AUTHORITY_D1_STALE_GRACE_MS;
    const expired = await resolveRecipeAuthority(d1Env({ DB: broken }), { tenantKey: 'hh', now, log });
    expect(expired).toMatchObject({ actualSource: 'static', fallbackReason: 'D1_READ_FAILED' });
    expect(diagnostics.map((diagnostic) => diagnostic.event)).toEqual(['recipe_catalog_d1_not_ready', 'recipe_catalog_d1_fallback']);
    // D1 back: verified again, fresh snapshot, no fallback.
    const recovered = await resolveRecipeAuthority(d1Env(), { tenantKey: 'hh', now, log });
    expect(recovered).toMatchObject({ actualSource: 'd1', fallbackReason: null });
    expect(recovered.snapshot).not.toBe(first.snapshot);
  });

  it('config-only rollback: d1 → static serves ALL_RECIPES again with no D1 read and no data change; invalid config is loud but serves static', async () => {
    const before = db.query('SELECT id, title FROM recipes ORDER BY id');
    await resolveRecipeAuthority(d1Env(), { tenantKey: 'hh', now, log });
    const statements: string[] = [];
    db.hooks = { beforeStatement: (event) => { statements.push(event.sql); }, beforeBatch: (batch) => { statements.push(...batch.map((event) => event.sql)); } };
    const rolledBack = await resolveRecipeAuthority(env({ RECIPE_CATALOG_MODE: 'static' }), { tenantKey: 'hh', now, log });
    expect(rolledBack).toMatchObject({ configuredMode: 'static', actualSource: 'static' });
    expect(ids(rolledBack.snapshot.list())).toEqual(ids(ALL_RECIPES));
    expect(statements).toEqual([]);
    expect(db.query('SELECT id, title FROM recipes ORDER BY id')).toEqual(before);
    expect(db.query<{ n: number }>('SELECT COUNT(*) AS n FROM recipe_runtime_fields')[0].n).toBe(71);
    diagnostics.length = 0;
    const invalid = await resolveRecipeAuthority(env({ RECIPE_CATALOG_MODE: 'd1' }), { tenantKey: 'hh', now, log }); // fence missing
    expect(invalid).toMatchObject({ configuredMode: 'static', actualSource: 'static', fallbackReason: 'CUTOVER_NOT_ENABLED' });
    expect(diagnostics).toEqual([expect.objectContaining({ level: 'error', event: 'recipe_catalog_config_invalid', configuredMode: 'invalid', reasonCode: 'CUTOVER_NOT_ENABLED' })]);
    const typo = await resolveRecipeAuthority(env({ RECIPE_CATALOG_MODE: 'dl' }), { tenantKey: 'hh', now, log });
    expect(typo).toMatchObject({ actualSource: 'static', fallbackReason: 'INVALID_MODE' });
    expect(statements).toEqual([]);
  });

  it('snapshot from any source builds no per-recipe queries and supports 5,000-recipe lookups via indexes', async () => {
    const big = Array.from({ length: 5_000 }, (_, index) => ({ ...ALL_RECIPES[index % ALL_RECIPES.length], id: `r-${index}`, slug: `slug-${index}` }));
    const snapshot = await createRecipeAuthoritySnapshot('static', big, () => 0);
    expect(snapshot.size).toBe(5_000);
    expect(snapshot.findById('r-4999')?.slug).toBe('slug-4999');
    expect(snapshot.findByIdOrSlug('slug-2500')?.id).toBe('r-2500');
    expect(snapshot.list()[0].id).toBe('r-0');
  });
});
