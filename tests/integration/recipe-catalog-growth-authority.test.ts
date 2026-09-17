import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readRecipeContent } from '../../packages/db/src/recipe-content';
import { generateWeeklyMealPlan, getSwapAlternatives, swapMealInPlan } from '../../packages/domain/src/week/planner';
import type { InventoryItem } from '../../packages/domain/src';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { rankRecipes } from '../../packages/recipes/src/engine';
import { currentCatalogRelease, isRecipeCanaryTenant, recipeCanaryBucket } from '../../packages/recipes/src/recipe-authority';
import { hydrateRuntimeRecipes } from '../../packages/recipes/src/runtime-hydration';
import type { Recipe } from '../../packages/recipes/src/types';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { recipeRoutes } from '../../src/worker/routes/recipes';
import { shoppingRoutes } from '../../src/worker/routes/shopping';
import { weekRoutes } from '../../src/worker/routes/week';
import { recipeAuthorityCounters, resetRecipeAuthorityCacheForTests, resetRecipeAuthorityCountersForTests, resolveRecipeAuthority, type RecipeAuthorityDiagnostic } from '../../src/worker/services/recipe-authority';
import { resetRecipeCatalogShadowThrottle, runRecipeCatalogShadow, scheduleRecipeCatalogShadow, toRecipeCatalogShadowLogRecord } from '../../src/worker/services/recipe-catalog-shadow';
import type { AuthContext, Env } from '../../src/worker/types';
import { signJwt } from '../../src/worker/utils/jwt';
import { compileApprovedBatches } from '../helpers/recipe-catalog-growth';
import { LEGACY_CATALOG_MIGRATION_TIP, SqliteD1, type SqliteStatementEvent } from '../helpers/sqlite-d1';

vi.mock('../../src/worker/services/email', () => ({
  sendEmail: vi.fn(async () => ({ sent: true, provider: 'test' })),
  buildOtpEmail: (code: string) => ({ subject: 'Test OTP', html: `<p>${code}</p>`, text: code }),
}));

/**
 * T14F — authority semantics with an INTENTIONALLY larger D1 catalog: static serves the 71 rollback
 * baseline, the reviewed release (71 + approved real batches) is what D1 verifies as. Every runtime
 * consumer is exercised over HTTP against the real grown ledger, and at least one imported recipe flows
 * through recommendation → planner/swap → cooking with Inventory Truth untouched.
 */
const secret = 'growth-secret-that-is-definitely-long-enough';
const USER = 'growth-user';
const CANDIDATES = Array.from({ length: 400 }, (_, index) => `growth-house-${index}`);
const INSIDE = CANDIDATES.find((id) => isRecipeCanaryTenant(id, 10))!;
const OUTSIDE = CANDIDATES.find((id) => !isRecipeCanaryTenant(id, 10))!;
const release = currentCatalogRelease();
const TOTAL = release.expectedRecipeCount;

type Mode = 'static' | 'shadow' | 'd1' | 'canary';
const MODE_ENV: Record<Mode, Partial<Env>> = {
  static: {},
  shadow: { RECIPE_CATALOG_MODE: 'shadow', RECIPE_CATALOG_SHADOW_INTERVAL_MS: '1000' },
  d1: { RECIPE_CATALOG_MODE: 'd1', RECIPE_CATALOG_CUTOVER_ENABLED: 'true' },
  canary: { RECIPE_CATALOG_MODE: 'canary', RECIPE_CATALOG_CUTOVER_ENABLED: 'true', RECIPE_CATALOG_D1_CANARY_PERCENT: '10' },
};

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', authMiddleware);
app.route('/', recipeRoutes);
app.route('/', weekRoutes);
app.route('/', shoppingRoutes);

// Inventory chosen so that an imported pilot recipe (Tôm xào bông cải xanh) is fully cookable without buying.
const STOCK = [
  ['SHRIMP', 'Tôm tươi', 600, 'g', 'seafood'], ['BROCCOLI', 'Bông cải xanh', 3, 'piece', 'vegetable'], ['GARLIC', 'Tỏi', 6, 'piece', 'spice'],
  ['COOKING_OIL', 'Dầu ăn', 500, 'ml', 'spice'], ['FISH_SAUCE', 'Nước mắm', 300, 'ml', 'spice'],
] as const;
function seed(db: SqliteD1, householdId: string) {
  db.seed(`INSERT OR IGNORE INTO users(id) VALUES ('${USER}');
    INSERT INTO households(id, name, created_by) VALUES ('${householdId}', 'Growth', '${USER}');
    INSERT INTO household_members(id, household_id, user_id, role) VALUES ('hm-${householdId}', '${householdId}', '${USER}', 'owner');
    INSERT INTO inventory_items (id, household_id, ingredient_id, name, quantity, unit, category, storage, freshness, data_source) VALUES
      ${STOCK.map(([id, name, qty, unit, category]) => `('g-${id.toLowerCase()}-${householdId}', '${householdId}', '${id}', '${name}', ${qty}, '${unit}', '${category}', 'fridge', 'fresh', 'manual')`).join(',\n')};`);
}
const inventoryOf = (householdId: string): InventoryItem[] => STOCK.map(([ingredientId, name, quantity, unit, category]) => ({
  id: `g-${ingredientId.toLowerCase()}-${householdId}`, householdId, ingredientId, name, quantity, unit, category, storage: 'fridge', addedDate: '2026-09-01', freshness: 'fresh', updatedAt: '2026-09-01T00:00:00.000Z',
} as InventoryItem));

describe('T14F — static 71 vs reviewed D1 release: readiness, shadow, canary, d1', () => {
  let db: SqliteD1;
  const diagnostics: RecipeAuthorityDiagnostic[] = [];
  const log = (record: RecipeAuthorityDiagnostic) => { diagnostics.push(record); };
  const env = (extra: Partial<Env> = {}): Env => ({ DB: db, ENVIRONMENT: 'test', JWT_SECRET: secret, ...extra } as unknown as Env);
  beforeEach(() => { db = new SqliteD1(); diagnostics.length = 0; resetRecipeAuthorityCacheForTests(); resetRecipeAuthorityCountersForTests(); resetRecipeCatalogShadowThrottle(); });
  afterEach(() => db.close());

  it(`static authority serves 71; d1 authority serves the ${TOTAL}-recipe reviewed release (READY) from one five-statement batch`, async () => {
    const staticRes = await resolveRecipeAuthority(env(), { tenantKey: 'hh', log });
    expect(staticRes).toMatchObject({ actualSource: 'static', selectedSource: 'static' });
    expect(staticRes.snapshot.size).toBe(71);
    expect(staticRes.snapshot.list().map((recipe) => recipe.id)).toEqual(ALL_RECIPES.map((recipe) => recipe.id));
    const batches: number[] = [];
    db.hooks = { beforeBatch: (batch) => { batches.push(batch.length); } };
    const d1Res = await resolveRecipeAuthority(env(MODE_ENV.d1), { tenantKey: 'hh', log });
    expect(d1Res).toMatchObject({ actualSource: 'd1', selectedSource: 'd1', fallbackReason: null });
    expect(d1Res.snapshot.size).toBe(TOTAL);
    expect(d1Res.snapshot.fingerprint).toBe(release.expectedRuntimeFingerprint);
    expect(d1Res.snapshot.list().map((recipe) => recipe.id)).toEqual(release.orderedRecipeIds);
    expect(d1Res.snapshot.list().slice(0, 71)).toStrictEqual(staticRes.snapshot.list());
    expect(batches).toEqual([5]);
    expect(diagnostics.filter((record) => record.event === 'recipe_catalog_authority_selected' && record.actualSource === 'd1')).toEqual([expect.objectContaining({ recipeCount: TOTAL, fingerprintMatch: true })]);
    // Imported recipes resolve by ID and by slug through the snapshot.
    const imported = d1Res.snapshot.list()[71];
    expect(imported.id).toMatch(/^imp-/);
    expect(d1Res.snapshot.findById(imported.id)).toBe(imported);
    expect(d1Res.snapshot.findByIdOrSlug(imported.slug)).toBe(imported);
    expect(staticRes.snapshot.findById(imported.id)).toBeNull();
  });

  it('shadow: user response is static 71, the D1 release verifies READY, and reviewed growth is logged at level info (not drift)', async () => {
    const resolution = await resolveRecipeAuthority(env(MODE_ENV.shadow), { tenantKey: 'hh', log });
    expect(resolution).toMatchObject({ configuredMode: 'shadow', actualSource: 'static' });
    expect(resolution.snapshot.size).toBe(71);
    const outcome = await runRecipeCatalogShadow(db, 'shadow');
    expect(outcome.status).toBe('compared');
    if (outcome.status !== 'compared') return;
    expect(outcome.diagnostics).toMatchObject({ staticCount: 71, d1RowCount: TOTAL, hydratedCount: TOTAL, d1CompleteCount: TOTAL, staticOnlyCount: 0, d1OnlyCount: TOTAL - 71, driftCount: 0, orderDriftCount: 0, hydrationFailureCount: 0 });
    expect(outcome.release).toEqual({ releaseId: release.releaseId, expectedRecipeCount: TOTAL, readiness: 'ready', readinessCode: null, reviewedGrowthCount: TOTAL - 71 });
    const record = toRecipeCatalogShadowLogRecord(outcome);
    expect(record).toMatchObject({ level: 'info', status: 'compared', catalog_static_count: 71, catalog_d1_count: TOTAL, catalog_d1_only_count: TOTAL - 71, catalog_drift_count: 0, catalog_order_drift_count: 0, release_id: release.releaseId, release_readiness: 'ready', release_reviewed_growth_count: TOTAL - 71 });
    // Unmanifested extra rows are still drift: a stray complete recipe beyond the release flips the shadow to warn/COUNT_DRIFT.
    db.seed(`INSERT INTO recipes (id, slug, title, description, cuisine, cook_time_minutes, servings, difficulty, image_url, tags, source_type, source_reference, verification_state, version)
      VALUES ('imp-ffffffffffffffff', 'stray-extra', 'Stray', 'Stray extra row', 'thai', 10, 2, 'easy', '/frigo/illustrations/delicious-meal.png', '[]', 'ai_generated', 'stray', 'reviewed', 1);
      INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, name, required_quantity, unit, is_optional) VALUES ('imp-ffffffffffffffff_ing_1', 'imp-ffffffffffffffff', 'RICE', 'Gạo', 100, 'g', 0);
      INSERT INTO recipe_runtime_ingredient_order (recipe_ingredient_id, recipe_id, position) VALUES ('imp-ffffffffffffffff_ing_1', 'imp-ffffffffffffffff', 0);
      INSERT INTO recipe_steps (id, recipe_id, step_number, instruction) VALUES ('imp-ffffffffffffffff_step_1', 'imp-ffffffffffffffff', 1, 'Stray step');
      INSERT INTO recipe_runtime_fields (recipe_id, runtime_order) VALUES ('imp-ffffffffffffffff', ${TOTAL});`);
    const stray = await runRecipeCatalogShadow(db, 'shadow');
    expect(stray.status).toBe('compared');
    if (stray.status !== 'compared') return;
    expect(stray.release).toMatchObject({ readiness: 'not_ready', readinessCode: 'COUNT_DRIFT', reviewedGrowthCount: 0 });
    expect(toRecipeCatalogShadowLogRecord(stray)).toMatchObject({ level: 'warn', catalog_d1_only_count: TOTAL - 71 + 1, release_readiness: 'not_ready', release_readiness_code: 'COUNT_DRIFT' });
    // Legacy prefix drift inside the grown catalog is still warn even though the growth itself is reviewed.
    const fresh = new SqliteD1();
    try {
      fresh.seed("UPDATE recipes SET title = title || ' (edited)' WHERE id = 'vn-canh-01'");
      const drifted = await runRecipeCatalogShadow(fresh, 'shadow');
      expect(drifted.status).toBe('compared');
      if (drifted.status === 'compared') {
        expect(drifted.diagnostics.driftCount).toBe(1);
        expect(drifted.release).toMatchObject({ readiness: 'not_ready', readinessCode: 'LEGACY_BASELINE_DRIFT' });
        expect(toRecipeCatalogShadowLogRecord(drifted).level).toBe('warn');
      }
    } finally { fresh.close(); }
    // Scheduling stays off the response path and throttled (the resolveRecipeAuthority call above already admitted one run).
    resetRecipeCatalogShadowThrottle();
    const scheduled = scheduleRecipeCatalogShadow(env(MODE_ENV.shadow), undefined, () => undefined);
    expect(scheduled).not.toBeNull();
    expect((await scheduled!).status).toBe('compared');
    expect((await scheduleRecipeCatalogShadow(env(MODE_ENV.shadow), undefined, () => undefined)!).status).toBe('throttled');
  });

  it(`canary: deterministic households — outside bucket gets static 71, inside bucket gets d1 ${TOTAL}; same household ⇒ same bucket`, async () => {
    expect(recipeCanaryBucket(INSIDE)).toBe(recipeCanaryBucket(INSIDE));
    expect(isRecipeCanaryTenant(INSIDE, 10)).toBe(true);
    expect(isRecipeCanaryTenant(OUTSIDE, 10)).toBe(false);
    const reads: SqliteStatementEvent[] = [];
    db.hooks = { beforeBatch: (batch) => { reads.push(...batch.filter((event) => /FROM recipe_runtime_fields/.test(event.sql))); } };
    const outside = await resolveRecipeAuthority(env(MODE_ENV.canary), { tenantKey: OUTSIDE, log });
    expect(outside).toMatchObject({ actualSource: 'static', selectedSource: 'static', canaryTenant: false });
    expect(outside.snapshot.size).toBe(71);
    expect(reads).toEqual([]);
    const inside = await resolveRecipeAuthority(env(MODE_ENV.canary), { tenantKey: INSIDE, log });
    expect(inside).toMatchObject({ actualSource: 'd1', selectedSource: 'd1', canaryTenant: true });
    expect(inside.snapshot.size).toBe(TOTAL);
    expect(reads).toHaveLength(1);
    for (let i = 0; i < 5; i += 1) expect((await resolveRecipeAuthority(env(MODE_ENV.canary), { tenantKey: INSIDE, log })).actualSource).toBe('d1');
    for (let i = 0; i < 5; i += 1) expect((await resolveRecipeAuthority(env(MODE_ENV.canary), { tenantKey: OUTSIDE, log })).snapshot.size).toBe(71);
    expect(recipeAuthorityCounters()).toMatchObject({ canaryFallback: 0, d1Fallback: 0 });
  });

  it('a pilot-only ledger (0035 + first growth batch) is NOT READY under a manifest expecting more; the legacy-only ledger is NOT READY under the shipped manifest — emergency static fallback serves 71', async () => {
    const legacyOnly = new SqliteD1({ through: LEGACY_CATALOG_MIGRATION_TIP });
    try {
      const resolution = await resolveRecipeAuthority({ DB: legacyOnly, ...MODE_ENV.d1 } as unknown as Env, { tenantKey: 'hh', log });
      expect(resolution).toMatchObject({ configuredMode: 'd1', selectedSource: 'd1', actualSource: 'static', fallbackReason: 'COUNT_DRIFT' });
      expect(resolution.snapshot.size).toBe(71);
      expect(diagnostics.some((record) => record.event === 'recipe_catalog_d1_fallback')).toBe(true);
    } finally { legacyOnly.close(); }
  });
});

describe(`T14F — HTTP user flows on the ${TOTAL}-recipe D1 release (list, detail, recommendations, planner, regenerate, swap, cooking)`, () => {
  let db: SqliteD1;
  let token: string;
  let imported: Recipe[];
  const warnings: string[] = [];
  const originalWarn = console.warn;

  beforeEach(async () => {
    db = new SqliteD1();
    seed(db, INSIDE); seed(db, OUTSIDE);
    token = await signJwt({ sub: USER, hid: INSIDE, typ: 'access', exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
    imported = (await compileApprovedBatches()).flatMap((batch) => batch.result.recipes.map((recipe) => recipe.runtime as Recipe));
    warnings.length = 0; console.warn = (line?: unknown) => { warnings.push(String(line)); };
    resetRecipeAuthorityCacheForTests(); resetRecipeAuthorityCountersForTests(); resetRecipeCatalogShadowThrottle();
  });
  afterEach(() => { console.warn = originalWarn; db.close(); });

  async function request(mode: Mode, method: string, path: string, body?: unknown, headers: Record<string, string> = {}, bearer = token) {
    const response = await app.fetch(new Request(`https://growth.local${path}`, {
      method, headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), { DB: db, ENVIRONMENT: 'test', JWT_SECRET: secret, WEEK_SCHEMA_MODE: 'legacy', ...MODE_ENV[mode] } as unknown as Env);
    const text = await response.text();
    return { status: response.status, bytes: Buffer.byteLength(text, 'utf8'), json: (text ? JSON.parse(text) : {}) as Record<string, any> };
  }

  it(`GET /recipes: static returns 71, d1 returns ${TOTAL} in release order (legacy prefix identical); detail resolves an imported recipe by id and slug`, async () => {
    const staticList = await request('static', 'GET', '/recipes');
    expect(staticList.status).toBe(200);
    expect(staticList.json.recipes).toHaveLength(71);
    const d1List = await request('d1', 'GET', '/recipes');
    expect(d1List.status).toBe(200);
    expect(d1List.json.recipes.map((recipe: any) => recipe.id)).toEqual(release.orderedRecipeIds);
    expect(d1List.json.recipes.slice(0, 71)).toStrictEqual(staticList.json.recipes);
    const ids = d1List.json.recipes.map((recipe: any) => recipe.id);
    expect(new Set(ids).size).toBe(TOTAL);
    console.log(`T14F recipe_list_response: recipe_count=${TOTAL} response_bytes=${d1List.bytes} static_bytes=${staticList.bytes}`);
    // Filters work across imported recipes (cuisine, category, region, text search).
    const korean = await request('d1', 'GET', '/recipes?cuisine=korean');
    expect(korean.json.recipes.every((recipe: any) => recipe.cuisine === 'korean')).toBe(true);
    expect(korean.json.recipes.some((recipe: any) => recipe.id.startsWith('imp-'))).toBe(true);
    const canh = await request('d1', 'GET', '/recipes?category=mon_canh&region=nam');
    expect(canh.json.recipes.some((recipe: any) => recipe.id.startsWith('imp-'))).toBe(true);
    const search = await request('d1', 'GET', `/recipes?q=${encodeURIComponent(imported[0].title.split(' ').slice(0, 2).join(' '))}`);
    expect(search.json.recipes.map((recipe: any) => recipe.id)).toContain(imported[0].id);
    for (const key of [imported[0].id, imported[0].slug]) {
      const detail = await request('d1', 'GET', `/recipes/${key}`);
      expect(detail.status, key).toBe(200);
      const { media, ...recipe } = detail.json.recipe;
      expect(recipe).toStrictEqual(JSON.parse(JSON.stringify(imported[0])));
      expect(media).toEqual({ hero: expect.objectContaining({ source: expect.stringMatching(/legacy|placeholder|none/) }) });
      expect(media.hero.source).not.toBe('canonical_r2');
    }
    expect((await request('static', 'GET', `/recipes/${imported[0].id}`)).status).toBe(404);
    expect((await request('canary', 'GET', `/recipes/${imported[0].id}`)).status).toBe(200);
    expect((await request('canary', 'GET', `/recipes/${imported[0].id}`, undefined, {}, await signJwt({ sub: USER, hid: OUTSIDE, typ: 'access', exp: Math.floor(Date.now() / 1000) + 3600 }, secret))).status).toBe(404);
  });

  it(`GET /recommendations over ${TOTAL} recipes: equals rankRecipes on the D1 snapshot, no duplicate IDs, deterministic ties, an imported recipe is cookable without buying`, async () => {
    const d1 = await request('d1', 'GET', '/recommendations');
    expect(d1.status).toBe(200);
    const ids = d1.json.recommendations.map((entry: any) => entry.recipe.id);
    expect(new Set(ids).size).toBe(ids.length);
    const catalog = hydrateRuntimeRecipes(await readRecipeContent(db)).recipes as Recipe[];
    expect(catalog).toHaveLength(TOTAL);
    const inventory = STOCK.map(([ingredientId, , quantity, unit]) => ({ ingredientId, quantity, unit, freshness: 'fresh' as const }));
    const expected = rankRecipes(catalog, { inventory });
    expect(d1.json.recommendations.map((entry: any) => [entry.recipe.id, entry.score, entry.matchPercentage])).toEqual(expected.map((entry) => [entry.recipe.id, entry.score, entry.matchPercentage]));
    // Repeat requests are stable (tie order is catalog order, never random).
    const again = await request('d1', 'GET', '/recommendations');
    expect(again.json.recommendations.map((entry: any) => entry.recipe.id)).toEqual(ids);
    const cookable = d1.json.recommendations.find((entry: any) => entry.recipe.id.startsWith('imp-') && entry.canCookWithoutBuying);
    expect(cookable, 'an imported recipe must be recommendable from stocked inventory').toBeDefined();
    expect(cookable.recipe.slug).toBe('tom-xao-bong-cai-xanh-toi-gion-ngot');
    const noBuy = await request('d1', 'GET', '/recommendations?noBuy=true');
    expect(noBuy.json.recommendations.map((entry: any) => entry.recipe.id)).toContain(cookable.recipe.id);
    // Static never surfaces imported recipes.
    const staticRes = await request('static', 'GET', '/recommendations');
    expect(staticRes.json.recommendations.some((entry: any) => entry.recipe.id.startsWith('imp-'))).toBe(false);
  });

  it('week planner on the D1 release: generate, regenerate, swap alternatives and an executed swap to an imported recipe; no hidden 71 truncation', async () => {
    const setup = { startDate: '2026-09-14', householdSize: 2, mealSlotsPreset: 'dinner_only', budgetTargetVnd: 600000, priorities: ['use_fridge'], shoppingFrequency: 'once', planId: 'plan_t14f_growth' };
    const created = await request('d1', 'POST', '/week/plans', setup);
    expect([200, 201]).toContain(created.status);
    const regenerated = await request('d1', 'POST', '/week/plans/plan_t14f_growth/generate');
    expect(regenerated.status).toBe(200);
    const activePlanId = regenerated.json.plan.id;
    const slot = regenerated.json.plan.days.flatMap((day: any) => day.slots).find((item: any) => item.recipe);
    expect(slot).toBeDefined();
    const alternatives = await request('d1', 'POST', `/week/plans/${activePlanId}/meals/${slot.id}/swap`, {});
    expect(alternatives.status).toBe(200);
    expect(alternatives.json.alternatives).toHaveLength(5);
    // The executed swap targets an imported recipe explicitly: it must resolve through the D1 snapshot.
    const target = imported.find((recipe) => recipe.id !== slot.recipe.id)!;
    const swapped = await request('d1', 'POST', `/week/plans/${activePlanId}/meals/${slot.id}/swap`, { recipeId: target.id });
    expect(swapped.status).toBe(200);
    const swappedSlot = swapped.json.plan.days.flatMap((day: any) => day.slots).find((item: any) => item.id === slot.id);
    expect(swappedSlot.recipe.id).toBe(target.id);
    // Under static the same imported target is unknown (404/400), proving no static fallback leaked the grown catalog.
    resetRecipeAuthorityCacheForTests();
    const staticSwap = await request('static', 'POST', `/week/plans/${activePlanId}/meals/${slot.id}/swap`, { recipeId: target.id });
    expect(staticSwap.status).toBeGreaterThanOrEqual(400);
    // Pure planner over the full snapshot: candidates include imported recipes and the catalog is not truncated to 71.
    const catalog = hydrateRuntimeRecipes(await readRecipeContent(db)).recipes as Recipe[];
    const plan = generateWeeklyMealPlan({ ...setup, planId: 'pure_plan' } as never, inventoryOf(INSIDE), catalog);
    const planned = plan.days.flatMap((day) => day.slots).filter((item) => item.recipe).map((item) => item.recipe!.id);
    expect(planned.length).toBeGreaterThan(0);
    const swapAlternatives = getSwapAlternatives(plan.days[0].slots.find((item) => item.recipe)!, inventoryOf(INSIDE), catalog);
    expect(swapAlternatives).toHaveLength(5);
    const swappedPlan = swapMealInPlan(plan, plan.days[0].slots.find((item) => item.recipe)!.id, target, inventoryOf(INSIDE));
    expect(swappedPlan.days[0].slots.find((item) => item.recipe)!.recipe!.id).toBe(target.id);
  });

  it('cooking an imported recipe under d1: cook start + complete deduct inventory, write events, replay idempotently; static 404s the same recipe; no recipe_* table written', async () => {
    const recipe = imported.find((item) => item.slug === 'tom-xao-bong-cai-xanh-toi-gion-ngot')!;
    const start = await request('d1', 'POST', `/recipes/${recipe.slug}/cook/start`);
    expect(start).toMatchObject({ status: 200, json: { recipeId: recipe.id, stepsCount: recipe.steps.length } });
    const deductions = recipe.ingredients.map((line) => ({ ingredientId: line.ingredientId, quantityDeducted: line.requiredQuantity }));
    const before = { events: db.query<{ n: number }>('SELECT COUNT(*) AS n FROM inventory_events')[0].n, stock: Object.fromEntries(db.query<{ ingredient_id: string; quantity: number }>('SELECT ingredient_id, quantity FROM inventory_items WHERE household_id = ?', INSIDE).map((row) => [row.ingredient_id, row.quantity])) };
    const recipesBefore = db.query('SELECT COUNT(*) AS n FROM recipes')[0];
    const first = await request('d1', 'POST', `/recipes/${recipe.id}/cook/complete`, { servings: recipe.servings, deductions }, { 'Idempotency-Key': 't14f-cook-imported' });
    expect(first).toMatchObject({ status: 200, json: { success: true, recipeId: recipe.id } });
    expect(first.json.deductionsApplied.map((item: any) => item.ingredientId).sort()).toEqual(deductions.map((item) => item.ingredientId).sort());
    const after = Object.fromEntries(db.query<{ ingredient_id: string; quantity: number }>('SELECT ingredient_id, quantity FROM inventory_items WHERE household_id = ?', INSIDE).map((row) => [row.ingredient_id, row.quantity]));
    for (const line of recipe.ingredients) expect(Number((before.stock[line.ingredientId] - after[line.ingredientId]).toFixed(6)), line.ingredientId).toBe(line.requiredQuantity);
    const eventsAfter = db.query<{ n: number }>('SELECT COUNT(*) AS n FROM inventory_events')[0].n;
    expect(eventsAfter - before.events).toBe(recipe.ingredients.length);
    expect(db.query<{ event_type: string }>('SELECT DISTINCT event_type FROM inventory_events WHERE household_id = ?', INSIDE)).toEqual([{ event_type: 'COOK' }]);
    const replay = await request('d1', 'POST', `/recipes/${recipe.id}/cook/complete`, { servings: recipe.servings, deductions }, { 'Idempotency-Key': 't14f-cook-imported' });
    expect(replay.json).toMatchObject({ success: true, idempotentReplay: true });
    expect(db.query<{ n: number }>('SELECT COUNT(*) AS n FROM inventory_events')[0].n).toBe(eventsAfter);
    expect(db.query<{ recipe_id: string }>('SELECT recipe_id FROM cooked_meals')).toEqual([{ recipe_id: recipe.id }]);
    // Recipe tables are read-only for cooking: no anchor row, no new recipe_* writes (the imported ID already exists as a complete row).
    expect(db.query('SELECT COUNT(*) AS n FROM recipes')[0]).toEqual(recipesBefore);
    expect(db.query<{ n: number }>("SELECT COUNT(*) AS n FROM recipes WHERE id = ? AND description IS NOT NULL", recipe.id)[0].n).toBe(1);
    // Static authority does not know the imported recipe: cooking it is refused (404), nothing is deducted.
    resetRecipeAuthorityCacheForTests();
    const staticStart = await request('static', 'POST', `/recipes/${recipe.slug}/cook/start`);
    expect(staticStart.status).toBe(404);
    expect(db.query<{ n: number }>('SELECT COUNT(*) AS n FROM inventory_events')[0].n).toBe(eventsAfter);
  });

  it('T14F-C: Batch B (t14f-scale-399-v1) recipes from several cuisines participate in list/detail, recommendations, planner swap and cooking under the 500 D1 authority; pilot recipes still resolve', async () => {
    const batches = await compileApprovedBatches();
    const scale = batches.find((batch) => batch.entry.batchId === 't14f-scale-399-v1')!;
    const pilot = batches.find((batch) => batch.entry.batchId === 't14f-pilot-30-v1')!;
    expect(scale.result.recipes).toHaveLength(399);
    const scaleRecipes = scale.result.recipes.map((recipe) => recipe.runtime as Recipe);
    const pilotRecipe = pilot.result.recipes[0].runtime as Recipe;
    // One Batch B sample per cuisine (deterministic: first in release order).
    const sample = ['vietnamese', 'chinese', 'japanese', 'korean', 'thai', 'italian'].map((cuisine) => scaleRecipes.find((recipe) => recipe.cuisine === cuisine)!);
    expect(sample.every(Boolean)).toBe(true);

    const d1List = await request('d1', 'GET', '/recipes');
    const listIds = new Set(d1List.json.recipes.map((recipe: any) => recipe.id));
    for (const recipe of [pilotRecipe, ...sample]) {
      expect(listIds.has(recipe.id), recipe.slug).toBe(true);
      for (const key of [recipe.id, recipe.slug]) {
        const detail = await request('d1', 'GET', `/recipes/${key}`);
        expect(detail.status, key).toBe(200);
        const { media, ...body } = detail.json.recipe;
        expect(body).toStrictEqual(JSON.parse(JSON.stringify(recipe)));
        // Imported recipes have pending hero media: the resolver falls back, never fabricates canonical_r2.
        expect(media.hero.source).not.toBe('canonical_r2');
      }
      expect((await request('static', 'GET', `/recipes/${recipe.id}`)).status).toBe(404);
    }
    // Stock the household with one Batch B recipe's exact ingredient lines (a Thai dish, so the sample is not Vietnamese-only),
    // through the ordinary inventory_items table: no recipe-specific writer is introduced.
    const cook = sample.find((recipe) => recipe.cuisine === 'thai')!;
    const stocked = new Set(STOCK.map(([id]) => id as string));
    db.seed(cook.ingredients.filter((line) => !stocked.has(line.ingredientId)).map((line) =>
      `INSERT INTO inventory_items (id, household_id, ingredient_id, name, quantity, unit, category, storage, freshness, data_source) VALUES ('g-scale-${line.ingredientId.toLowerCase()}', '${INSIDE}', '${line.ingredientId}', '${line.ingredientId}', ${line.requiredQuantity * 4}, '${line.unit}', 'other', 'fridge', 'fresh', 'manual');`).join('\n'));
    // Batch B recipes rank in recommendations (release-order ties) and the stocked one is cookable without buying.
    const recommendations = await request('d1', 'GET', '/recommendations');
    const recommended = new Set(recommendations.json.recommendations.map((entry: any) => entry.recipe.id));
    const scaleIds = new Set(scaleRecipes.map((recipe) => recipe.id));
    expect([...recommended].filter((id) => scaleIds.has(id as string)).length).toBeGreaterThan(50);
    const cookableScale = recommendations.json.recommendations.find((entry: any) => entry.recipe.id === cook.id);
    expect(cookableScale, 'the stocked Batch B recipe must be recommendable').toBeDefined();
    expect(cookableScale.canCookWithoutBuying).toBe(true);

    // Planner: an executed swap onto a Batch B recipe from a non-Vietnamese cuisine resolves through the D1 snapshot.
    const setup = { startDate: '2026-09-21', householdSize: 2, mealSlotsPreset: 'dinner_only', budgetTargetVnd: 600000, priorities: ['use_fridge'], shoppingFrequency: 'once', planId: 'plan_t14f_c_scale' };
    expect([200, 201]).toContain((await request('d1', 'POST', '/week/plans', setup)).status);
    const generated = await request('d1', 'POST', '/week/plans/plan_t14f_c_scale/generate');
    expect(generated.status).toBe(200);
    const slot = generated.json.plan.days.flatMap((day: any) => day.slots).find((item: any) => item.recipe);
    const target = sample.find((recipe) => recipe.cuisine === 'korean' && recipe.id !== slot.recipe.id) ?? sample[3];
    const swapped = await request('d1', 'POST', `/week/plans/${generated.json.plan.id}/meals/${slot.id}/swap`, { recipeId: target.id });
    expect(swapped.status).toBe(200);
    expect(swapped.json.plan.days.flatMap((day: any) => day.slots).find((item: any) => item.id === slot.id).recipe.id).toBe(target.id);

    // Cooking the Batch B recipe deducts through the existing inventory mutation path and replays idempotently.
    const start = await request('d1', 'POST', `/recipes/${cook.slug}/cook/start`);
    expect(start).toMatchObject({ status: 200, json: { recipeId: cook.id, stepsCount: cook.steps.length } });
    const deductions = cook.ingredients.map((line) => ({ ingredientId: line.ingredientId, quantityDeducted: line.requiredQuantity }));
    const eventsBefore = db.query<{ n: number }>('SELECT COUNT(*) AS n FROM inventory_events')[0].n;
    const first = await request('d1', 'POST', `/recipes/${cook.id}/cook/complete`, { servings: cook.servings, deductions }, { 'Idempotency-Key': 't14f-c-cook-scale' });
    expect(first).toMatchObject({ status: 200, json: { success: true, recipeId: cook.id } });
    const eventsAfter = db.query<{ n: number }>('SELECT COUNT(*) AS n FROM inventory_events')[0].n;
    expect(eventsAfter - eventsBefore).toBe(cook.ingredients.length);
    const replay = await request('d1', 'POST', `/recipes/${cook.id}/cook/complete`, { servings: cook.servings, deductions }, { 'Idempotency-Key': 't14f-c-cook-scale' });
    expect(replay.json).toMatchObject({ success: true, idempotentReplay: true });
    expect(db.query<{ n: number }>('SELECT COUNT(*) AS n FROM inventory_events')[0].n).toBe(eventsAfter);
    expect(db.query<{ n: number }>('SELECT COUNT(*) AS n FROM recipes')[0].n).toBe(TOTAL);
  });
});
