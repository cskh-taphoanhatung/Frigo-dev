import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { InventoryItem } from '../../packages/domain/src';
import { generateWeeklyMealPlan, getSwapAlternatives, swapMealInPlan } from '../../packages/domain/src/week/planner';
import { evaluateWeeklyCandidate, isRecipeEligible } from '../../packages/domain/src/week/score';
import type { MealPlanSetupInput } from '../../packages/domain/src/week/types';
import { readRecipeContent } from '../../packages/db/src/recipe-content';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { evaluateRecipeMatch, rankRecipes } from '../../packages/recipes/src/engine';
import { hydrateRuntimeRecipes } from '../../packages/recipes/src/runtime-hydration';
import type { Recipe, RecipeScoringContext } from '../../packages/recipes/src/types';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { recipeRoutes } from '../../src/worker/routes/recipes';
import type { AuthContext, Env } from '../../src/worker/types';
import { signJwt } from '../../src/worker/utils/jwt';
import { SqliteD1 } from '../helpers/sqlite-d1';

/**
 * T14B-B parity harnesses. Every scorer/planner/cooking primitive is called twice — once with
 * the static authority, once with the D1-hydrated view — and the outputs must be identical.
 * Nothing here switches production authority: the routes under test still import ALL_RECIPES.
 */

const secret = 'parity-secret-that-is-definitely-long-enough';
const USER = 'parity-user';
const HOUSEHOLD = 'parity-house';

const inv = (ingredientId: string, quantity: number, unit: InventoryItem['unit'], freshness: InventoryItem['freshness'] = 'fresh',
  expiryDate?: string): InventoryItem => ({
  id: `inv-${ingredientId}`, householdId: HOUSEHOLD, ingredientId, name: ingredientId, quantity, unit, category: 'other',
  storage: 'fridge', addedDate: '2026-09-01', updatedAt: '2026-09-01T00:00:00.000Z', freshness, expiryDate,
});
const scoring = (items: InventoryItem[]): RecipeScoringContext['inventory'] =>
  items.map((item) => ({ ingredientId: item.ingredientId, quantity: item.quantity, unit: item.unit, freshness: item.freshness }));

const fullyStockedFor = (recipe: Recipe) => recipe.ingredients.map((line) => inv(line.ingredientId, line.requiredQuantity * 3, line.unit));

const FIXTURES: Record<string, InventoryItem[]> = {
  emptyFridge: [],
  fullyStockedGlobal: fullyStockedFor(ALL_RECIPES.find((recipe) => recipe.id === 'gl-03')!),
  partialVietnamese: fullyStockedFor(ALL_RECIPES.find((recipe) => recipe.id === 'vn-canh-01')!).slice(0, 2),
  partialGlobal: fullyStockedFor(ALL_RECIPES.find((recipe) => recipe.id === 'gl-11')!).slice(0, 3),
  expiring: [inv('CHICKEN_EGG', 6, 'piece', 'expiring', '2026-09-17'), inv('TOMATO', 4, 'piece', 'use_soon', '2026-09-18'), inv('COOKING_OIL', 500, 'ml')],
  mixedUnits: [inv('GROUND_PORK', 0.5, 'kg'), inv('RICE', 1, 'kg'), inv('SOY_SAUCE', 0.2, 'l'), inv('CHICKEN_EGG', 10, 'piece')],
};
const CONTEXTS: Array<Partial<RecipeScoringContext> & { label: string }> = [
  { label: 'default' },
  { label: 'cuisine preference', preferredCuisines: ['vietnamese', 'korean'] },
  { label: 'max cooking time', maxCookTimeMinutes: 15 },
  { label: 'no-buy-needed filter', onlyNoBuyNeeded: true },
  { label: 'recently cooked', recentCookedRecipeIds: ['gl-03', 'vn-canh-01'] },
];

describe('T14B-B — static vs D1-hydrated runtime parity', () => {
  let db: SqliteD1;
  let hydrated: Recipe[];
  beforeEach(async () => {
    db = new SqliteD1();
    const result = hydrateRuntimeRecipes(await readRecipeContent(db));
    expect(result.failures).toEqual([]);
    // Static production order is the source order; the hydrator lists by ID. Re-impose static order
    // so ordering/tie behaviour is compared like-for-like (a catalog implementation detail, not a
    // recipe difference).
    const byId = new Map(result.recipes.map((recipe) => [recipe.id, recipe as Recipe]));
    hydrated = ALL_RECIPES.map((recipe) => byId.get(recipe.id)!);
    expect(hydrated.every(Boolean)).toBe(true);
  });
  afterEach(() => db.close());

  it('recommendations: rankRecipes/evaluateRecipeMatch give identical results for every fixture × context', () => {
    for (const [fixture, items] of Object.entries(FIXTURES)) {
      for (const { label, ...context } of CONTEXTS) {
        const ctx: RecipeScoringContext = { inventory: scoring(items), ...context };
        const staticRanked = rankRecipes(ALL_RECIPES, ctx);
        const d1Ranked = rankRecipes(hydrated, ctx);
        expect(d1Ranked, `${fixture} / ${label}`).toStrictEqual(staticRanked);
        expect(d1Ranked.map((item) => [item.recipe.id, item.score, item.matchPercentage, item.canCookWithoutBuying,
          item.missingRequiredIngredients.map((line) => line.ingredientId), item.expiringIngredientsUsed]))
          .toEqual(staticRanked.map((item) => [item.recipe.id, item.score, item.matchPercentage, item.canCookWithoutBuying,
            item.missingRequiredIngredients.map((line) => line.ingredientId), item.expiringIngredientsUsed]));
        for (const recipe of ALL_RECIPES) {
          expect(evaluateRecipeMatch(hydrated.find((item) => item.id === recipe.id)!, ctx)).toStrictEqual(evaluateRecipeMatch(recipe, ctx));
        }
      }
    }
  });

  it('planner: candidate evaluation, eligibility, generated week, regenerate and swap candidates are identical', () => {
    const inventory = [...FIXTURES.fullyStockedGlobal, ...FIXTURES.expiring, inv('PORK_BELLY', 800, 'g'), inv('FISH_SAUCE', 200, 'ml')];
    const input: MealPlanSetupInput = {
      householdId: HOUSEHOLD, startDate: '2026-09-21', planId: 'parity-plan', householdSize: 3, mealSlotsPreset: 'all',
      budgetTargetVnd: 500_000, priorities: ['budget', 'use_fridge'], shoppingFrequency: 'twice',
      dietaryRestrictions: ['no_pork'], dislikedIngredients: ['SQUID'], preferredCuisines: ['vietnamese'],
    };

    // Candidate generation primitives (what generate/regenerate consume before selection).
    for (const recipe of ALL_RECIPES) {
      const twin = hydrated.find((item) => item.id === recipe.id)!;
      expect(isRecipeEligible(twin, input.dietaryRestrictions, input.dislikedIngredients))
        .toStrictEqual(isRecipeEligible(recipe, input.dietaryRestrictions, input.dislikedIngredients));
      expect(evaluateWeeklyCandidate(twin, inventory, undefined, { preferredCuisines: input.preferredCuisines, budgetFocus: true, recentRecipeIds: ['gl-03'] }))
        .toStrictEqual(evaluateWeeklyCandidate(recipe, inventory, undefined, { preferredCuisines: input.preferredCuisines, budgetFocus: true, recentRecipeIds: ['gl-03'] }));
    }

    const strip = (plan: ReturnType<typeof generateWeeklyMealPlan>) => JSON.parse(JSON.stringify({ ...plan, createdAt: 0, updatedAt: 0 }));
    const staticPlan = generateWeeklyMealPlan(input, inventory, ALL_RECIPES);
    const d1Plan = generateWeeklyMealPlan(input, inventory, hydrated);
    expect(strip(d1Plan)).toEqual(strip(staticPlan));
    const chosen = staticPlan.days.flatMap((day) => day.slots.map((slot) => slot.recipe?.id ?? null));
    expect(chosen.some(Boolean)).toBe(true);
    expect(d1Plan.days.flatMap((day) => day.slots.map((slot) => slot.recipe?.id ?? null))).toEqual(chosen);

    // Regenerate = generate again from the existing plan's inputs (routes/week.ts pattern).
    const regenInput: MealPlanSetupInput = { ...input, planId: 'parity-regen', mealSlotsPreset: 'dinner_only' };
    expect(strip(generateWeeklyMealPlan(regenInput, inventory, hydrated))).toEqual(strip(generateWeeklyMealPlan(regenInput, inventory, ALL_RECIPES)));

    // Swap alternatives and the executed swap.
    const targetSlot = staticPlan.days.flatMap((day) => day.slots).find((slot) => slot.recipe)!;
    const staticAlternatives = getSwapAlternatives(targetSlot, inventory, ALL_RECIPES);
    const d1Alternatives = getSwapAlternatives(targetSlot, inventory, hydrated);
    expect(d1Alternatives).toStrictEqual(staticAlternatives);
    expect(d1Alternatives.map((alt) => alt.recipe.id)).toEqual(staticAlternatives.map((alt) => alt.recipe.id));
    const replacementId = staticAlternatives[0].recipe.id;
    const swapStatic = swapMealInPlan(staticPlan, targetSlot.id, ALL_RECIPES.find((recipe) => recipe.id === replacementId)!, inventory);
    const swapD1 = swapMealInPlan(staticPlan, targetSlot.id, hydrated.find((recipe) => recipe.id === replacementId)!, inventory);
    expect(strip(swapD1)).toEqual(strip(swapStatic));
  });

  it('stored Week snapshots embed the full recipe object, so historical plans are self-describing and ID-stable', () => {
    const plan = generateWeeklyMealPlan({
      householdId: HOUSEHOLD, startDate: '2026-09-21', planId: 'snapshot-plan', householdSize: 2, mealSlotsPreset: 'dinner_only',
      budgetTargetVnd: null, priorities: [], shoppingFrequency: 'once',
    }, FIXTURES.fullyStockedGlobal, hydrated);
    const slot = plan.days.flatMap((day) => day.slots).find((item) => item.recipe)!;
    // routes/week.ts persists `JSON.stringify(slot)` into meal_plan_slots.snapshot_json and reads
    // `storedSlot.recipe` back first, falling back to ALL_RECIPES only when the payload lacks one.
    const persisted = JSON.parse(JSON.stringify(slot));
    expect(persisted.recipe).toStrictEqual(JSON.parse(JSON.stringify(ALL_RECIPES.find((recipe) => recipe.id === slot.recipe!.id))));
    expect(persisted.recipe.id).toBe(slot.recipe!.id);
  });
});

describe('T14B-B — cooking boundary with hydrated recipes (legacy inventory authority, local D1 only)', () => {
  const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
  app.use('*', authMiddleware);
  app.route('/', recipeRoutes);
  let db: SqliteD1;
  let token: string;
  const logs: string[] = [];
  const originalLog = console.log;

  beforeEach(async () => {
    db = new SqliteD1();
    db.seed(`INSERT INTO users(id) VALUES ('${USER}');
      INSERT INTO households(id, name, created_by) VALUES ('${HOUSEHOLD}', 'Parity', '${USER}');
      INSERT INTO household_members(id, household_id, user_id, role) VALUES ('pm', '${HOUSEHOLD}', '${USER}', 'owner');
      INSERT INTO inventory_items (id, household_id, ingredient_id, name, quantity, unit, category, storage, freshness, data_source) VALUES
        ('p-eggs', '${HOUSEHOLD}', 'CHICKEN_EGG', 'Trứng gà', 12, 'piece', 'egg', 'fridge', 'fresh', 'manual'),
        ('p-tomato', '${HOUSEHOLD}', 'TOMATO', 'Cà chua', 10, 'piece', 'vegetable', 'fridge', 'fresh', 'manual'),
        ('p-scallion', '${HOUSEHOLD}', 'SCALLION', 'Hành lá', 5, 'bunch', 'vegetable', 'fridge', 'fresh', 'manual'),
        ('p-oil', '${HOUSEHOLD}', 'COOKING_OIL', 'Dầu ăn', 300, 'ml', 'spice', 'pantry', 'fresh', 'manual'),
        ('p-fish', '${HOUSEHOLD}', 'FISH_FRESHWATER', 'Cá lóc', 1200, 'g', 'seafood', 'fridge', 'fresh', 'manual'),
        ('p-pineapple', '${HOUSEHOLD}', 'PINEAPPLE', 'Dứa', 3, 'piece', 'fruit', 'fridge', 'fresh', 'manual');`);
    token = await signJwt({ sub: USER, hid: HOUSEHOLD, typ: 'access', exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
    logs.length = 0;
    console.log = (line?: unknown) => { logs.push(String(line)); };
  });
  afterEach(() => { console.log = originalLog; db.close(); });

  async function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}, env: Partial<Env> = {}) {
    const response = await app.fetch(new Request(`https://parity.local${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), { DB: db, ENVIRONMENT: 'test', JWT_SECRET: secret, WEEK_SCHEMA_MODE: 'legacy', ...env } as unknown as Env);
    return { status: response.status, json: await response.json() as Record<string, any> };
  }

  it.each([['gl-03', 'tomato-egg-stir-fry'], ['vn-canh-01', 'canh-chua-ca-loc-nam-bo']])(
    'hydrated %s drives the SAME cooking command as the static recipe: same deductions, fingerprint, idempotent replay, no new writer',
    async (id, slug) => {
      const hydration = hydrateRuntimeRecipes(await readRecipeContent(db));
      const recipe = hydration.recipes.find((item) => item.id === id)!;
      const staticRecipe = ALL_RECIPES.find((item) => item.id === id)!;
      expect(recipe).toStrictEqual(staticRecipe);
      expect(recipe.slug).toBe(slug);

      // Deductions are derived from the hydrated recipe exactly as a client would from the static one.
      const stocked = new Set(['CHICKEN_EGG', 'TOMATO', 'SCALLION', 'COOKING_OIL', 'FISH_FRESHWATER', 'PINEAPPLE']);
      const deductions = recipe.ingredients.filter((line) => stocked.has(line.ingredientId))
        .map((line) => ({ ingredientId: line.ingredientId, quantityDeducted: line.requiredQuantity, unit: line.unit }));
      expect(deductions.length).toBeGreaterThan(0);
      const start = await request('POST', `/recipes/${recipe.slug}/cook/start`);
      expect(start).toMatchObject({ status: 200, json: { recipeId: id, stepsCount: staticRecipe.steps.length } });

      const eventsBefore = db.query<{ n: number }>('SELECT COUNT(*) AS n FROM inventory_events')[0].n;
      const first = await request('POST', `/recipes/${id}/cook/complete`, { servings: recipe.servings, deductions }, { 'Idempotency-Key': `parity-${id}` });
      expect(first).toMatchObject({ status: 200, json: { success: true, recipeId: id } });
      const cooked = db.query<{ recipe_id: string; deductions_applied: string }>('SELECT recipe_id, deductions_applied FROM cooked_meals');
      expect(cooked).toHaveLength(1);
      expect(cooked[0].recipe_id).toBe(id);
      // The recipe row is the 0034-seeded complete entry; cooking's INSERT OR IGNORE anchor is a no-op now.
      expect(db.query<{ description: string | null }>('SELECT description FROM recipes WHERE id = ?', id)[0].description).toBe(staticRecipe.description);
      const events = db.query<{ n: number }>('SELECT COUNT(*) AS n FROM inventory_events')[0].n - eventsBefore;
      expect(events).toBe(deductions.length);

      const replay = await request('POST', `/recipes/${id}/cook/complete`, { servings: recipe.servings, deductions }, { 'Idempotency-Key': `parity-${id}` });
      expect(replay).toMatchObject({ status: 200, json: { success: true, idempotentReplay: true } });
      expect(db.query<{ n: number }>('SELECT COUNT(*) AS n FROM inventory_events')[0].n - eventsBefore).toBe(deductions.length);
      expect(db.query('SELECT COUNT(*) AS n FROM cooked_meals')).toEqual([{ n: 1 }]);
    },
  );

  it('RECIPE_CATALOG_MODE=shadow never changes the response and logs one PII-free diagnostic; static default logs nothing', async () => {
    const base = await request('GET', '/recipes?cuisine=korean');
    expect(base.status).toBe(200);
    expect(logs.filter((line) => line.includes('recipe_catalog_shadow'))).toEqual([]);

    const shadow = await request('GET', '/recipes?cuisine=korean', undefined, {}, { RECIPE_CATALOG_MODE: 'shadow' });
    expect(shadow.json).toEqual(base.json);
    // No ExecutionContext in this harness: give the detached comparison a tick to finish.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const records = logs.filter((line) => line.includes('recipe_catalog_shadow')).map((line) => JSON.parse(line));
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      level: 'info', event: 'recipe_catalog_shadow', catalog_source: 'static', catalog_mode: 'shadow', status: 'compared',
      catalog_static_count: 71, catalog_d1_count: 71, catalog_complete_count: 71, catalog_hydrated_count: 71,
      catalog_static_only_count: 0, catalog_d1_only_count: 0, catalog_drift_count: 0, catalog_hydration_failure_count: 0,
      drift_sample: [], hydration_failure_sample: [],
    });
    expect(typeof records[0].catalog_lookup_ms).toBe('number');
    expect(JSON.stringify(records[0])).not.toMatch(/Trứng|p-eggs|parity-house/);

    // D1 failure in shadow mode is observable, never a static "success", and never a user-visible error.
    const broken = { prepare: () => { throw new Error('boom'); }, batch: () => { throw new Error('boom'); } } as unknown as Env['DB'];
    const failing = await app.fetch(new Request('https://parity.local/recipes?cuisine=korean', { headers: { Authorization: `Bearer ${token}` } }),
      { DB: broken, ENVIRONMENT: 'test', JWT_SECRET: secret, RECIPE_CATALOG_MODE: 'shadow' } as unknown as Env);
    expect(failing.status).toBe(200);
    expect(await failing.json()).toEqual(base.json);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const errorRecord = logs.map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .find((record) => record?.event === 'recipe_catalog_shadow' && record.status === 'shadow_error');
    expect(errorRecord).toMatchObject({ level: 'warn', status: 'shadow_error', catalog_mode: 'shadow', catalog_drift_count: null });
  });
});
