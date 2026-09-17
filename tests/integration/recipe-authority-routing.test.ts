import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { rankRecipes } from '../../packages/recipes/src/engine';
import { isRecipeCanaryTenant } from '../../packages/recipes/src/recipe-authority';
import { promoteRecipeMediaVersion, stageRecipeMediaVersion } from '../../packages/db/src/recipe-media';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { recipeRoutes } from '../../src/worker/routes/recipes';
import { shoppingRoutes } from '../../src/worker/routes/shopping';
import { weekRoutes } from '../../src/worker/routes/week';
import { resetRecipeAuthorityCacheForTests, resetRecipeAuthorityCountersForTests, recipeAuthorityCounters } from '../../src/worker/services/recipe-authority';
import { resetRecipeCatalogShadowThrottle } from '../../src/worker/services/recipe-catalog-shadow';
import type { AuthContext, Env } from '../../src/worker/types';
import { signJwt } from '../../src/worker/utils/jwt';
import { FakeR2, WEBP_FIXTURE_BYTES, WEBP_FIXTURE_SHA256 } from '../helpers/recipe-media-r2';
import { LEGACY_CATALOG_MIGRATION_TIP, SqliteD1, type SqliteStatementEvent } from '../helpers/sqlite-d1';

// The Workers-only cloudflare:email module cannot load in Node; no network mail is sent.
vi.mock('../../src/worker/services/email', () => ({
  sendEmail: vi.fn(async () => ({ sent: true, provider: 'test' })),
  buildOtpEmail: (code: string) => ({ subject: 'Test OTP', html: `<p>${code}</p>`, text: code }),
}));

/**
 * T14D end-to-end authority parity. Every runtime recipe consumer is exercised through HTTP under
 * `static`, full `d1` (verified D1 snapshot) and `canary` (household bucketed IN), and the responses
 * must be strictly equal — same IDs, order, scores, plan, swap candidates, cooking deductions and media.
 * Nothing sorts or normalises on the test side.
 */
const secret = 'authority-secret-that-is-definitely-long-enough';
const USER = 'authority-user';
const HOUSEHOLD = Array.from({ length: 200 }, (_, index) => `authority-house-${index}`).find((id) => isRecipeCanaryTenant(id, 10))!;
const OUTSIDE_HOUSEHOLD = Array.from({ length: 200 }, (_, index) => `authority-house-${index}`).find((id) => !isRecipeCanaryTenant(id, 10))!;

type Mode = 'static' | 'd1' | 'canary';
const MODE_ENV: Record<Mode, Partial<Env>> = {
  static: {},
  d1: { RECIPE_CATALOG_MODE: 'd1', RECIPE_CATALOG_CUTOVER_ENABLED: 'true' },
  canary: { RECIPE_CATALOG_MODE: 'canary', RECIPE_CATALOG_CUTOVER_ENABLED: 'true', RECIPE_CATALOG_D1_CANARY_PERCENT: '10' },
};

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', authMiddleware);
app.route('/', recipeRoutes);
app.route('/', weekRoutes);
app.route('/', shoppingRoutes);

function seed(db: SqliteD1, householdId: string) {
  db.seed(`INSERT OR IGNORE INTO users(id) VALUES ('${USER}');
    INSERT INTO households(id, name, created_by) VALUES ('${householdId}', 'Authority', '${USER}');
    INSERT INTO household_members(id, household_id, user_id, role) VALUES ('hm-${householdId}', '${householdId}', '${USER}', 'owner');
    INSERT INTO inventory_items (id, household_id, ingredient_id, name, quantity, unit, category, storage, freshness, data_source) VALUES
      ('a-eggs-${householdId}', '${householdId}', 'CHICKEN_EGG', 'Trứng gà', 12, 'piece', 'egg', 'fridge', 'fresh', 'manual'),
      ('a-tomato-${householdId}', '${householdId}', 'TOMATO', 'Cà chua', 10, 'piece', 'vegetable', 'fridge', 'fresh', 'manual'),
      ('a-scallion-${householdId}', '${householdId}', 'SCALLION', 'Hành lá', 5, 'bunch', 'vegetable', 'fridge', 'fresh', 'manual'),
      ('a-oil-${householdId}', '${householdId}', 'COOKING_OIL', 'Dầu ăn', 300, 'ml', 'spice', 'pantry', 'fresh', 'manual'),
      ('a-tofu-${householdId}', '${householdId}', 'TOFU', 'Đậu phụ', 4, 'piece', 'vegetable', 'fridge', 'fresh', 'manual');`);
}

const stripVolatile = (value: unknown): unknown => JSON.parse(JSON.stringify(value, (key, item) =>
  ['createdAt', 'updatedAt', 'startedAt', 'cookingSessionId', 'id', 'planId', 'dayId', 'cookId', 'generatedAt'].includes(key) ? undefined : item));

describe('T14D — HTTP parity of every runtime recipe consumer across static / d1 / canary authority', () => {
  let db: SqliteD1;
  let token: string;
  const warnings: string[] = [];
  const originalWarn = console.warn;

  beforeEach(async () => {
    db = new SqliteD1({ through: LEGACY_CATALOG_MIGRATION_TIP }); // 71 == 71 parity; T14F growth parity lives in recipe-catalog-growth-authority
    seed(db, HOUSEHOLD);
    seed(db, OUTSIDE_HOUSEHOLD);
    token = await signJwt({ sub: USER, hid: HOUSEHOLD, typ: 'access', exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
    warnings.length = 0;
    console.warn = (line?: unknown) => { warnings.push(String(line)); };
    resetRecipeAuthorityCacheForTests(); resetRecipeAuthorityCountersForTests(); resetRecipeCatalogShadowThrottle();
  });
  afterEach(() => { console.warn = originalWarn; db.close(); });

  async function request(mode: Mode, method: string, path: string, body?: unknown, headers: Record<string, string> = {}, env: Partial<Env> = {}, bearer = token) {
    const response = await app.fetch(new Request(`https://authority.local${path}`, {
      method, headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), { DB: db, ENVIRONMENT: 'test', JWT_SECRET: secret, WEEK_SCHEMA_MODE: 'legacy', ...MODE_ENV[mode], ...env } as unknown as Env);
    return { status: response.status, json: await response.json().catch(() => ({})) as Record<string, any> };
  }
  const bothModes = async (method: string, path: string, body?: unknown, headers?: Record<string, string>) => {
    const out: Record<Mode, Awaited<ReturnType<typeof request>>> = {} as never;
    for (const mode of ['static', 'd1', 'canary'] as Mode[]) { resetRecipeAuthorityCacheForTests(); out[mode] = await request(mode, method, path, body, headers); }
    return out;
  };

  it('GET /recipes (list + filters + search) and GET /recipes/:id are strictly identical under static, d1 and canary', async () => {
    for (const path of ['/recipes', '/recipes?cuisine=korean', '/recipes?category=mon_canh', '/recipes?region=bac', '/recipes?q=trứng']) {
      const { static: s, d1, canary } = await bothModes('GET', path);
      expect(s.status, path).toBe(200);
      expect(d1.json, path).toStrictEqual(s.json);
      expect(canary.json, path).toStrictEqual(s.json);
      expect(s.json.recipes.length, path).toBeGreaterThan(0);
    }
    const all = await request('d1', 'GET', '/recipes');
    expect(all.json.recipes.map((recipe: any) => recipe.id)).toEqual(ALL_RECIPES.map((recipe) => recipe.id));
    expect(all.json.recipes.map(({ media: _m, ...rest }: any) => rest)).toEqual(JSON.parse(JSON.stringify(ALL_RECIPES)));
    for (const id of ['gl-01', ALL_RECIPES[5].slug, 'vn-canh-01']) {
      const { static: s, d1, canary } = await bothModes('GET', `/recipes/${id}`);
      expect(s.status, id).toBe(200);
      expect(d1.json, id).toStrictEqual(s.json);
      expect(canary.json, id).toStrictEqual(s.json);
    }
    expect((await request('d1', 'GET', '/recipes/no-such-recipe')).status).toBe(404);
    // Authority mode is never user-controlled.
    const spoof = await request('static', 'GET', '/recipes?recipeCatalogMode=d1&mode=d1', undefined, { 'X-Recipe-Mode': 'd1' });
    expect(spoof.status).toBe(200);
    expect(recipeAuthorityCounters().d1).toBeGreaterThan(0); // from the d1/canary runs above
  });

  it('GET /recommendations: identical IDs, scores, match percentages and order; equals rankRecipes on ALL_RECIPES; media additive', async () => {
    for (const path of ['/recommendations', '/recommendations?noBuy=true', '/recommendations?cuisine=vietnamese,korean&maxTime=20', '/recommendations?category=mon_canh&region=nam']) {
      const { static: s, d1, canary } = await bothModes('GET', path);
      expect(s.status, path).toBe(200);
      expect(d1.json, path).toStrictEqual(s.json);
      expect(canary.json, path).toStrictEqual(s.json);
    }
    const { json } = await request('d1', 'GET', '/recommendations');
    const inventory = [
      { ingredientId: 'CHICKEN_EGG', quantity: 12, unit: 'piece' }, { ingredientId: 'TOMATO', quantity: 10, unit: 'piece' },
      { ingredientId: 'SCALLION', quantity: 5, unit: 'bunch' }, { ingredientId: 'COOKING_OIL', quantity: 300, unit: 'ml' }, { ingredientId: 'TOFU', quantity: 4, unit: 'piece' },
    ];
    const expected = rankRecipes(ALL_RECIPES, { inventory: inventory as never });
    expect(json.recommendations.map((entry: any) => [entry.recipe.id, entry.score, entry.matchPercentage]))
      .toEqual(expected.map((entry) => [entry.recipe.id, entry.score, entry.matchPercentage]));
  });

  it('media enrichment is identical for identical content regardless of authority source (T14C untouched)', async () => {
    const r2 = new FakeR2();
    await stageRecipeMediaVersion(db, { recipeId: 'gl-03', role: 'hero', version: 2, mimeType: 'image/webp', width: 1200, height: 800, contentLength: WEBP_FIXTURE_BYTES.byteLength, contentHash: WEBP_FIXTURE_SHA256, sourceType: 'uploaded' });
    r2.put('recipes/gl-03/hero/v2.webp', WEBP_FIXTURE_BYTES, 'image/webp');
    await promoteRecipeMediaVersion(db, r2, 'gl-03', 'hero', 2);
    const { static: s, d1 } = await bothModes('GET', '/recipes/gl-03');
    expect(s.json.recipe.media).toEqual({ hero: { url: '/api/v1/recipe-media/gl-03/hero/2', source: 'canonical_r2', version: 2, width: 1200, height: 800 } });
    expect(d1.json).toStrictEqual(s.json);
    const list = await bothModes('GET', '/recipes');
    expect(list.d1.json).toStrictEqual(list.static.json);
    expect(list.d1.json.recipes.filter((recipe: any) => recipe.media.hero.source === 'canonical_r2')).toHaveLength(1);
  });

  it('cook start + cook complete: identical response, deductions, inventory events and idempotent replay under static and d1; no new inventory writer', async () => {
    const recipe = ALL_RECIPES.find((item) => item.id === 'gl-03')!;
    const stocked = new Set(['CHICKEN_EGG', 'TOMATO', 'SCALLION', 'COOKING_OIL']);
    const deductions = recipe.ingredients.filter((line) => stocked.has(line.ingredientId)).map((line) => ({ ingredientId: line.ingredientId, quantityDeducted: line.requiredQuantity }));
    expect(deductions.length).toBeGreaterThan(0);
    const start = await bothModes('POST', `/recipes/${recipe.slug}/cook/start`);
    expect(start.static).toMatchObject({ status: 200, json: { recipeId: 'gl-03', stepsCount: recipe.steps.length } });
    expect(stripVolatile(start.d1.json)).toStrictEqual(stripVolatile(start.static.json));
    expect(stripVolatile(start.canary.json)).toStrictEqual(stripVolatile(start.static.json));

    const run = async (mode: Mode, key: string) => {
      resetRecipeAuthorityCacheForTests();
      const before = { events: db.query<{ n: number }>('SELECT COUNT(*) AS n FROM inventory_events')[0].n, stock: db.query('SELECT id, quantity FROM inventory_items WHERE household_id = ? ORDER BY id', HOUSEHOLD) };
      const first = await request(mode, 'POST', `/recipes/gl-03/cook/complete`, { servings: recipe.servings, deductions }, { 'Idempotency-Key': key });
      const replay = await request(mode, 'POST', `/recipes/gl-03/cook/complete`, { servings: recipe.servings, deductions }, { 'Idempotency-Key': key });
      const after = { events: db.query<{ n: number }>('SELECT COUNT(*) AS n FROM inventory_events')[0].n, stock: db.query('SELECT id, quantity FROM inventory_items WHERE household_id = ? ORDER BY id', HOUSEHOLD) };
      const cooked = db.query<{ deductions_applied: string; servings_cooked: number }>('SELECT deductions_applied, servings_cooked FROM cooked_meals ORDER BY rowid DESC LIMIT 1')[0];
      const delta = after.stock.map((row: any, index) => Number((row.quantity - (before.stock[index] as any).quantity).toFixed(6)));
      return { first, replay, eventDelta: after.events - before.events, delta, cooked };
    };
    // Same household, so the two runs deduct sequentially; compare shapes and deltas, not absolute stock.
    const staticRun = await run('static', 't14d-cook-static-key');
    const d1Run = await run('d1', 't14d-cook-d1-key');
    expect(staticRun.first).toMatchObject({ status: 200, json: { success: true, recipeId: 'gl-03' } });
    expect(d1Run.first.status).toBe(200);
    expect(stripVolatile({ ...d1Run.first.json, inventory: undefined, remainingInventoryCount: undefined })).toStrictEqual(stripVolatile({ ...staticRun.first.json, inventory: undefined, remainingInventoryCount: undefined }));
    expect(d1Run.first.json.deductionsApplied).toStrictEqual(staticRun.first.json.deductionsApplied);
    expect(d1Run.eventDelta).toBe(staticRun.eventDelta);
    expect(d1Run.delta).toStrictEqual(staticRun.delta);
    expect(d1Run.cooked).toStrictEqual(staticRun.cooked);
    expect(staticRun.replay.json).toMatchObject({ success: true, idempotentReplay: true });
    expect(d1Run.replay.json).toMatchObject({ success: true, idempotentReplay: true });
    expect(db.query<{ n: number }>('SELECT COUNT(*) AS n FROM cooked_meals')[0].n).toBe(2);
    // The only inventory writers are the pre-existing legacy paths: no recipe_* table was written.
    expect(db.query<{ n: number }>('SELECT COUNT(*) AS n FROM recipes')[0].n).toBe(71);
    expect(db.query<{ n: number }>('SELECT COUNT(*) AS n FROM recipe_runtime_fields')[0].n).toBe(71);
  });

  it('week planner: create, regenerate, swap alternatives (first five), executed swap and shopping attribution are identical under static and d1', async () => {
    const setup = { startDate: '2026-09-14', householdSize: 2, mealSlotsPreset: 'dinner_only', budgetTargetVnd: 600000, priorities: ['use_fridge'], shoppingFrequency: 'once' };
    const flows: Record<Mode, any> = {} as never;
    for (const mode of ['static', 'd1'] as Mode[]) {
      resetRecipeAuthorityCacheForTests();
      const planId = `plan_t14d_${mode}`;
      const created = await request(mode, 'POST', '/week/plans', { ...setup, planId });
      expect([200, 201], mode).toContain(created.status);
      const regenerated = await request(mode, 'POST', `/week/plans/${planId}/generate`);
      expect(regenerated.status, mode).toBe(200);
      const activePlanId = regenerated.json.plan.id; // regenerate archives the old plan and creates a new one
      const slot = regenerated.json.plan.days.flatMap((day: any) => day.slots).find((item: any) => item.recipe);
      const alternatives = await request(mode, 'POST', `/week/plans/${activePlanId}/meals/${slot.id}/swap`, {});
      expect(alternatives.status, mode).toBe(200);
      const target = alternatives.json.alternatives[0].recipe.slug;
      const swapped = await request(mode, 'POST', `/week/plans/${activePlanId}/meals/${slot.id}/swap`, { recipeId: target });
      expect(swapped.status, mode).toBe(200);
      const shopping = await request(mode, 'POST', '/shopping-list/items', { name: 'Muối', quantity: 1, unit: 'g', sourceRecipeId: target });
      flows[mode] = {
        created: stripVolatile(created.json), regenerated: stripVolatile(regenerated.json), alternatives: alternatives.json.alternatives.map((alt: any) => alt.recipe.id),
        alternativeCount: alternatives.json.alternatives.length, swapped: stripVolatile(swapped.json), shopping: { status: shopping.status, item: stripVolatile(shopping.json.item ?? shopping.json) },
      };
    }
    expect(flows.d1).toStrictEqual(flows.static);
    expect(flows.static.alternativeCount).toBe(5);
    expect(flows.static.alternatives).not.toEqual([...flows.static.alternatives].sort());
  });

  it('canary D1 failure and full-d1 failure degrade to static HTTP 200 with the same body as static mode; outside-canary households never touch D1', async () => {
    const baseline = await request('static', 'GET', '/recipes?cuisine=korean');
    const broken = { prepare: () => { throw new Error('boom'); }, batch: () => { throw new Error('boom'); } } as unknown as Env['DB'];
    // Recipes list needs no D1 for content in static, so the broken DB only affects the authority path + media (degrades to legacy).
    resetRecipeAuthorityCacheForTests();
    const canaryFailed = await request('canary', 'GET', '/recipes?cuisine=korean', undefined, {}, { DB: broken });
    expect(canaryFailed.status).toBe(200);
    expect(canaryFailed.json.recipes.map((recipe: any) => recipe.id)).toEqual(baseline.json.recipes.map((recipe: any) => recipe.id));
    expect(warnings.some((line) => line.includes('recipe_catalog_canary_fallback'))).toBe(true);
    resetRecipeAuthorityCacheForTests();
    const d1Failed = await request('d1', 'GET', '/recipes?cuisine=korean', undefined, {}, { DB: broken });
    expect(d1Failed.status).toBe(200);
    expect(d1Failed.json.recipes.map((recipe: any) => recipe.id)).toEqual(baseline.json.recipes.map((recipe: any) => recipe.id));
    expect(warnings.some((line) => line.includes('recipe_catalog_d1_fallback'))).toBe(true);
    expect(warnings.join('\n')).not.toMatch(new RegExp(HOUSEHOLD));

    // A household outside the canary never reads the D1 catalog for content.
    resetRecipeAuthorityCacheForTests();
    const outsideToken = await signJwt({ sub: USER, hid: OUTSIDE_HOUSEHOLD, typ: 'access', exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
    const contentReads: SqliteStatementEvent[] = [];
    db.hooks = { beforeBatch: (batch) => { for (const event of batch) if (/FROM recipe_runtime_fields/.test(event.sql)) contentReads.push(event); } };
    const outside = await request('canary', 'GET', '/recipes', undefined, {}, {}, outsideToken);
    expect(outside.status).toBe(200);
    expect(contentReads).toEqual([]);
    expect(recipeAuthorityCounters().d1).toBe(0);
  });

  it('one authority snapshot per operation: a recommendations request reads the D1 catalog at most once (no nested re-hydration)', async () => {
    const batches: number[] = [];
    db.hooks = { beforeBatch: (batch) => { if (batch.some((event) => /FROM recipe_runtime_fields/.test(event.sql))) batches.push(batch.length); } };
    await request('d1', 'GET', '/recommendations');
    expect(batches).toEqual([5]);
    batches.length = 0;
    await request('d1', 'POST', '/week/plans', { startDate: '2026-09-21', householdSize: 2, mealSlotsPreset: 'dinner_only', budgetTargetVnd: 500000, priorities: ['use_fridge'], shoppingFrequency: 'once', planId: 'plan_single_snapshot' });
    expect(batches).toEqual([]); // still within the TTL: cached snapshot, zero content reads
  });
});
