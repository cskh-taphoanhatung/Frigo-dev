import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { InventoryItem } from '../../packages/domain/src';
import { generateWeeklyMealPlan, getSwapAlternatives, swapMealInPlan } from '../../packages/domain/src/week/planner';
import { evaluateWeeklyCandidate, isRecipeEligible } from '../../packages/domain/src/week/score';
import type { MealPlanSetupInput } from '../../packages/domain/src/week/types';
import { readRecipeContent } from '../../packages/db/src/recipe-content';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { evaluateRecipeMatch, rankRecipes } from '../../packages/recipes/src/engine';
import type { D1RecipeContentSnapshot } from '../../packages/recipes/src/catalog-drift';
import { compareRuntimeCatalogs, D1RuntimeRecipeCatalog, StaticRuntimeRecipeCatalog } from '../../packages/recipes/src/runtime-catalog';
import { hydrateRuntimeRecipes } from '../../packages/recipes/src/runtime-hydration';
import type { Recipe, RecipeScoringContext } from '../../packages/recipes/src/types';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { recipeRoutes } from '../../src/worker/routes/recipes';
import { resetRecipeCatalogShadowThrottle, runRecipeCatalogShadow, toRecipeCatalogShadowLogRecord } from '../../src/worker/services/recipe-catalog-shadow';
import type { AuthContext, Env } from '../../src/worker/types';
import { signJwt } from '../../src/worker/utils/jwt';
import { LEGACY_CATALOG_MIGRATION_TIP, SqliteD1 } from '../helpers/sqlite-d1';

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

describe('T14B-B — static vs D1 runtime catalog behavioural parity (actual catalog output, no reordering)', () => {
  let db: SqliteD1;
  let staticRecipes: Recipe[];
  let d1Recipes: Recipe[];
  beforeEach(async () => {
    db = new SqliteD1({ through: LEGACY_CATALOG_MIGRATION_TIP }); // 71-recipe legacy baseline ledger
    const staticCatalog = new StaticRuntimeRecipeCatalog();
    const d1Catalog = new D1RuntimeRecipeCatalog(() => readRecipeContent(db));
    expect((await d1Catalog.hydrate()).failures).toEqual([]);
    // Both lists are consumed exactly as the catalogs emit them. Nothing below sorts, filters by
    // static position, or maps D1 recipes back through ALL_RECIPES.
    staticRecipes = await staticCatalog.listRuntimeRecipes();
    d1Recipes = await d1Catalog.listRuntimeRecipes();
  });
  afterEach(() => db.close());

  /** Reversal is the negative control: the same recipes, deliberately in the wrong canonical order. */
  const reversed = () => [...d1Recipes].reverse();
  const ids = (recipes: readonly { id: string }[]) => recipes.map((recipe) => recipe.id);
  const strip = (plan: ReturnType<typeof generateWeeklyMealPlan>) => JSON.parse(JSON.stringify({ ...plan, createdAt: 0, updatedAt: 0 }));
  const chosenIds = (plan: ReturnType<typeof generateWeeklyMealPlan>) => plan.days.flatMap((day) => day.slots.map((slot) => slot.recipe?.id ?? null));

  it('the D1 catalog list is strict-equal to the static list, in the same order, without any normalisation', () => {
    expect(d1Recipes).toStrictEqual(staticRecipes);
    expect(ids(d1Recipes)).toEqual(ids(ALL_RECIPES));
    expect(ids(staticRecipes)).toEqual(ids(ALL_RECIPES));
    expect(d1Recipes).toHaveLength(71);
    // The order is semantic and non-trivial: it is neither ID-sorted nor reversible without notice.
    expect(ids(d1Recipes)).not.toEqual([...ids(d1Recipes)].sort());
    expect(ids(reversed())).not.toEqual(ids(staticRecipes));
    expect(ids(d1Recipes).slice(0, 3)).toEqual(['vn-canh-01', 'vn-canh-02', 'vn-canh-03']);
    expect(ids(d1Recipes).slice(-3)).toEqual(['gl-10', 'gl-11', 'gl-12']);
    // Ingredient arrays are ordered by persisted position; positions are complete and unique per recipe.
    d1Recipes.forEach((recipe, index) => expect(recipe.ingredients).toStrictEqual(staticRecipes[index].ingredients));
    const positions = db.query<{ recipe_id: string; position: number }>('SELECT recipe_id, position FROM recipe_runtime_ingredient_order ORDER BY recipe_id, position');
    const byRecipe = new Map<string, number[]>();
    for (const row of positions) byRecipe.set(row.recipe_id, [...(byRecipe.get(row.recipe_id) ?? []), row.position]);
    for (const recipe of staticRecipes) expect(byRecipe.get(recipe.id), recipe.id).toEqual(recipe.ingredients.map((_, index) => index));
    expect(db.query('SELECT o.recipe_ingredient_id FROM recipe_runtime_ingredient_order o LEFT JOIN recipe_ingredients i ON i.id = o.recipe_ingredient_id WHERE i.id IS NULL')).toEqual([]);
    expect(db.query('SELECT i.id FROM recipe_ingredients i LEFT JOIN recipe_runtime_ingredient_order o ON o.recipe_ingredient_id = i.id WHERE o.recipe_ingredient_id IS NULL')).toEqual([]);
  });

  it('recommendations: rankRecipes/evaluateRecipeMatch on the raw D1 list equal the static results for every fixture × context', () => {
    for (const [fixture, items] of Object.entries(FIXTURES)) {
      for (const { label, ...context } of CONTEXTS) {
        const ctx: RecipeScoringContext = { inventory: scoring(items), ...context };
        const staticRanked = rankRecipes(staticRecipes, ctx);
        const d1Ranked = rankRecipes(d1Recipes, ctx);
        expect(d1Ranked, `${fixture} / ${label}`).toStrictEqual(staticRanked);
        expect(ids(d1Ranked.map((item) => item.recipe)), `${fixture} / ${label}`).toEqual(ids(staticRanked.map((item) => item.recipe)));
        // Pairwise by catalog position (the lists were proven strict-equal), not by ID lookup.
        staticRecipes.forEach((recipe, index) => expect(evaluateRecipeMatch(d1Recipes[index], ctx)).toStrictEqual(evaluateRecipeMatch(recipe, ctx)));
      }
    }
  });

  it('tie-sensitive ranking: equal score/match%/cookTime groups resolve by catalog order, D1 reproduces it and a reordered catalog is detected', () => {
    const ctx: RecipeScoringContext = { inventory: [] };
    const key = (item: ReturnType<typeof rankRecipes>[number]) => `${item.score}|${item.matchPercentage}|${item.recipe.cookTimeMinutes}`;
    const staticRanked = rankRecipes(staticRecipes, ctx);
    const groups = new Map<string, string[]>();
    for (const item of staticRanked) groups.set(key(item), [...(groups.get(key(item)) ?? []), item.recipe.id]);
    const ties = [...groups.values()].filter((group) => group.length > 1);
    // The fixture genuinely contains ties, so the final order depends on input order.
    expect(ties.length).toBeGreaterThanOrEqual(5);
    expect(groups.get('25|0|10')).toEqual(['vn-xao-01', 'vn-sang-02', 'gl-03', 'gl-12']);

    const d1Ranked = rankRecipes(d1Recipes, ctx);
    expect(ids(d1Ranked.map((item) => item.recipe))).toEqual(ids(staticRanked.map((item) => item.recipe)));
    expect(d1Ranked).toStrictEqual(staticRanked);

    // Negative control: the same recipes in reverse input order produce a different ranking —
    // every tie group comes out reversed — so the assertion above is sensitive to order.
    const controlRanked = rankRecipes(reversed(), ctx);
    expect(ids(controlRanked.map((item) => item.recipe))).not.toEqual(ids(staticRanked.map((item) => item.recipe)));
    const controlGroups = new Map<string, string[]>();
    for (const item of controlRanked) controlGroups.set(key(item), [...(controlGroups.get(key(item)) ?? []), item.recipe.id]);
    expect(controlGroups.get('25|0|10')).toEqual(['gl-12', 'gl-03', 'vn-sang-02', 'vn-xao-01']);
    for (const [groupKey, members] of groups) expect(controlGroups.get(groupKey)).toEqual([...members].reverse());

    // Minimal deterministic fixture: two recipes with identical comparison keys, order decides.
    const pair = new Set(['vn-xao-01', 'gl-03']);
    const staticPair = staticRecipes.filter((recipe) => pair.has(recipe.id));
    const d1Pair = d1Recipes.filter((recipe) => pair.has(recipe.id));
    expect(rankRecipes(staticPair, ctx).map((item) => [item.recipe.id, key(item)])).toEqual([['vn-xao-01', '25|0|10'], ['gl-03', '25|0|10']]);
    expect(rankRecipes(d1Pair, ctx)).toStrictEqual(rankRecipes(staticPair, ctx));
    expect(ids(rankRecipes([...d1Pair].reverse(), ctx).map((item) => item.recipe))).toEqual(['gl-03', 'vn-xao-01']);
  });

  it('planner: eligibility, candidate evaluation, generate, regenerate, swap alternatives and an executed swap are identical on the raw D1 list', () => {
    const inventory = [...FIXTURES.fullyStockedGlobal, ...FIXTURES.expiring, inv('PORK_BELLY', 800, 'g'), inv('FISH_SAUCE', 200, 'ml')];
    const input: MealPlanSetupInput = {
      householdId: HOUSEHOLD, startDate: '2026-09-21', planId: 'parity-plan', householdSize: 3, mealSlotsPreset: 'all',
      budgetTargetVnd: 500_000, priorities: ['budget', 'use_fridge'], shoppingFrequency: 'twice',
      dietaryRestrictions: ['no_pork'], dislikedIngredients: ['SQUID'], preferredCuisines: ['vietnamese'],
    };
    const weekly = { preferredCuisines: input.preferredCuisines, budgetFocus: true, recentRecipeIds: ['gl-03'] };
    staticRecipes.forEach((recipe, index) => {
      expect(isRecipeEligible(d1Recipes[index], input.dietaryRestrictions, input.dislikedIngredients))
        .toStrictEqual(isRecipeEligible(recipe, input.dietaryRestrictions, input.dislikedIngredients));
      expect(evaluateWeeklyCandidate(d1Recipes[index], inventory, undefined, weekly)).toStrictEqual(evaluateWeeklyCandidate(recipe, inventory, undefined, weekly));
    });

    const staticPlan = generateWeeklyMealPlan(input, inventory, staticRecipes);
    const d1Plan = generateWeeklyMealPlan(input, inventory, d1Recipes);
    expect(strip(d1Plan)).toEqual(strip(staticPlan));
    expect(chosenIds(staticPlan).some(Boolean)).toBe(true);
    expect(chosenIds(d1Plan)).toEqual(chosenIds(staticPlan));

    // Regenerate = generate again from the existing plan's inputs (routes/week.ts pattern).
    const regenInput: MealPlanSetupInput = { ...input, planId: 'parity-regen', mealSlotsPreset: 'dinner_only' };
    expect(strip(generateWeeklyMealPlan(regenInput, inventory, d1Recipes))).toEqual(strip(generateWeeklyMealPlan(regenInput, inventory, staticRecipes)));

    // Swap alternatives from each catalog, then execute the swap with the alternative each catalog returned.
    const targetSlot = staticPlan.days.flatMap((day) => day.slots).find((slot) => slot.recipe)!;
    const d1TargetSlot = d1Plan.days.flatMap((day) => day.slots).find((slot) => slot.id === targetSlot.id)!;
    const staticAlternatives = getSwapAlternatives(targetSlot, inventory, staticRecipes);
    const d1Alternatives = getSwapAlternatives(d1TargetSlot, inventory, d1Recipes);
    expect(d1Alternatives).toStrictEqual(staticAlternatives);
    expect(ids(d1Alternatives.map((alt) => alt.recipe))).toEqual(ids(staticAlternatives.map((alt) => alt.recipe)));
    const swapStatic = swapMealInPlan(staticPlan, targetSlot.id, staticAlternatives[0].recipe, inventory);
    const swapD1 = swapMealInPlan(d1Plan, d1TargetSlot.id, d1Alternatives[0].recipe, inventory);
    expect(strip(swapD1)).toEqual(strip(swapStatic));
  });

  it('planner tie fixture: equal weekly scores resolve by catalog order, D1 picks the same recipes and a reordered catalog picks different ones', () => {
    const input: MealPlanSetupInput = {
      householdId: HOUSEHOLD, startDate: '2026-09-21', planId: 'tie-plan', householdSize: 2, mealSlotsPreset: 'dinner_only',
      budgetTargetVnd: null, priorities: [], shoppingFrequency: 'once',
    };
    // Empty fridge: the top weekly score is shared by many recipes, so the planner's stable
    // sort picks the first top-scored recipe in input order.
    const top = Math.max(...staticRecipes.map((recipe) => evaluateWeeklyCandidate(recipe, [], undefined, {}).score));
    const topIds = staticRecipes.filter((recipe) => evaluateWeeklyCandidate(recipe, [], undefined, {}).score === top).map((recipe) => recipe.id);
    expect(topIds.length).toBeGreaterThan(5);
    expect(topIds[0]).toBe('vn-canh-01');

    const staticPlan = generateWeeklyMealPlan(input, [], staticRecipes);
    const d1Plan = generateWeeklyMealPlan(input, [], d1Recipes);
    expect(chosenIds(staticPlan)[0]).toBe('vn-canh-01');
    expect(chosenIds(d1Plan)).toEqual(chosenIds(staticPlan));
    expect(strip(d1Plan)).toEqual(strip(staticPlan));

    // Negative control: reversed catalog → a different top-scored recipe wins the first slot.
    const controlPlan = generateWeeklyMealPlan(input, [], reversed());
    expect(chosenIds(controlPlan)).not.toEqual(chosenIds(staticPlan));
    expect(chosenIds(controlPlan)[0]).not.toBe('vn-canh-01');
    expect(topIds).toContain(chosenIds(controlPlan)[0]);

    // Controlled fixture: three recipes with identical scores selected from each catalog by
    // membership (each catalog's own order is preserved; nothing is re-sorted).
    const tieSet = new Set(['vn-canh-01', 'vn-canh-05', 'gl-03']);
    const staticTie = staticRecipes.filter((recipe) => tieSet.has(recipe.id));
    const d1Tie = d1Recipes.filter((recipe) => tieSet.has(recipe.id));
    expect(new Set(staticTie.map((recipe) => evaluateWeeklyCandidate(recipe, [], undefined, {}).score)).size).toBe(1);
    expect(chosenIds(generateWeeklyMealPlan(input, [], staticTie))[0]).toBe('vn-canh-01');
    expect(chosenIds(generateWeeklyMealPlan(input, [], d1Tie))).toEqual(chosenIds(generateWeeklyMealPlan(input, [], staticTie)));
    expect(chosenIds(generateWeeklyMealPlan(input, [], [...d1Tie].reverse()))[0]).toBe('gl-03');
  });

  it('>5 swap alternatives: the first-five candidate subset is order-sensitive; D1 matches static exactly and a reordered catalog diverges', () => {
    const inventory = [...FIXTURES.fullyStockedGlobal, inv('FISH_FRESHWATER', 1000, 'g'), inv('PINEAPPLE', 2, 'piece')];
    const input: MealPlanSetupInput = {
      householdId: HOUSEHOLD, startDate: '2026-09-21', planId: 'swap-plan', householdSize: 2, mealSlotsPreset: 'dinner_only',
      budgetTargetVnd: null, priorities: [], shoppingFrequency: 'once',
    };
    const staticPlan = generateWeeklyMealPlan(input, inventory, staticRecipes);
    const d1Plan = generateWeeklyMealPlan(input, inventory, d1Recipes);
    expect(strip(d1Plan)).toEqual(strip(staticPlan));
    const slot = staticPlan.days[0].slots[0];
    const d1Slot = d1Plan.days[0].slots[0];
    expect(slot.recipe).toBeDefined();
    // 70 valid alternatives exist (far more than the 5 the function inspects).
    expect(staticRecipes.filter((recipe) => recipe.id !== slot.recipe!.id).length).toBeGreaterThan(5);

    const staticAlternatives = getSwapAlternatives(slot, inventory, staticRecipes);
    const d1Alternatives = getSwapAlternatives(d1Slot, inventory, d1Recipes);
    expect(staticAlternatives).toHaveLength(5);
    expect(d1Alternatives).toStrictEqual(staticAlternatives);
    const summary = (alternatives: typeof staticAlternatives) => alternatives.map((alt) => ({
      id: alt.recipe.id, matchPercent: alt.matchPercent, badges: alt.badges, budgetDeltaVnd: alt.budgetDeltaVnd, cookingTimeDeltaMinutes: alt.cookingTimeDeltaMinutes,
    }));
    expect(summary(d1Alternatives)).toEqual(summary(staticAlternatives));
    // The returned set is exactly the first five non-current recipes in catalog order (re-sorted by matchPercent).
    const expectedSet = staticRecipes.filter((recipe) => recipe.id !== slot.recipe!.id).slice(0, 5).map((recipe) => recipe.id).sort();
    expect(ids(staticAlternatives.map((alt) => alt.recipe)).sort()).toEqual(expectedSet);

    // Negative control: reversed catalog → a different candidate subset (global recipes first).
    const control = getSwapAlternatives(d1Slot, inventory, reversed());
    expect(ids(control.map((alt) => alt.recipe)).sort()).not.toEqual(expectedSet);
    expect(summary(control)).not.toEqual(summary(staticAlternatives));

    // Controlled >5 fixture: eight candidates selected by membership from each catalog (own order kept).
    const eight = new Set(['vn-canh-01', 'vn-kho-01', 'vn-xao-01', 'vn-chien-01', 'vn-hap-01', 'vn-cuon-01', 'gl-01', 'gl-03']);
    const staticEight = staticRecipes.filter((recipe) => eight.has(recipe.id));
    const d1Eight = d1Recipes.filter((recipe) => eight.has(recipe.id));
    expect(staticEight.filter((recipe) => recipe.id !== slot.recipe!.id).length).toBeGreaterThan(5);
    const staticEightAlternatives = getSwapAlternatives(slot, inventory, staticEight);
    const d1EightAlternatives = getSwapAlternatives(d1Slot, inventory, d1Eight);
    expect(d1EightAlternatives).toStrictEqual(staticEightAlternatives);
    expect(ids(getSwapAlternatives(d1Slot, inventory, [...d1Eight].reverse()).map((alt) => alt.recipe)).sort())
      .not.toEqual(ids(staticEightAlternatives.map((alt) => alt.recipe)).sort());

    // Execute a swap using an alternative from each returned set (same rank), compare resulting plans.
    const pick = Math.min(3, staticAlternatives.length - 1);
    const swappedStatic = swapMealInPlan(staticPlan, slot.id, staticAlternatives[pick].recipe, inventory);
    const swappedD1 = swapMealInPlan(d1Plan, d1Slot.id, d1Alternatives[pick].recipe, inventory);
    expect(strip(swappedD1)).toEqual(strip(swappedStatic));
    expect(swappedD1.days[0].slots[0].recipe?.id).toBe(staticAlternatives[pick].recipe.id);
    expect(swappedD1.days[0].slots[0].recipe?.id).not.toBe(slot.recipe!.id);
  });

  it('stored Week snapshots embed the full recipe object, so historical plans are self-describing and ID-stable', () => {
    const plan = generateWeeklyMealPlan({
      householdId: HOUSEHOLD, startDate: '2026-09-21', planId: 'snapshot-plan', householdSize: 2, mealSlotsPreset: 'dinner_only',
      budgetTargetVnd: null, priorities: [], shoppingFrequency: 'once',
    }, FIXTURES.fullyStockedGlobal, d1Recipes);
    const slot = plan.days.flatMap((day) => day.slots).find((item) => item.recipe)!;
    // routes/week.ts persists `JSON.stringify(slot)` into meal_plan_slots.snapshot_json and reads
    // `storedSlot.recipe` back first, falling back to ALL_RECIPES only when the payload lacks one.
    const persisted = JSON.parse(JSON.stringify(slot));
    expect(persisted.recipe).toStrictEqual(JSON.parse(JSON.stringify(ALL_RECIPES.find((recipe) => recipe.id === slot.recipe!.id))));
    expect(persisted.recipe.id).toBe(slot.recipe!.id);
  });

  it('shadow health: the real ledger logs info with zero order drift; a reordered D1 view logs warn with order drift', async () => {
    const outcome = await runRecipeCatalogShadow(db, 'shadow');
    expect(outcome.status).toBe('compared');
    if (outcome.status !== 'compared') return;
    // On the 0035 ledger the shipped (grown) manifest is intentionally NOT READY (COUNT_DRIFT); prefix parity is still info.
    expect(toRecipeCatalogShadowLogRecord(outcome)).toMatchObject({
      level: 'info', status: 'compared', catalog_static_only_count: 0, catalog_d1_only_count: 0, catalog_drift_count: 0,
      catalog_order_drift_count: 0, catalog_hydration_failure_count: 0, order_drift_sample: [], release_readiness: 'not_ready', release_readiness_code: 'COUNT_DRIFT',
    });
    const snapshot = await readRecipeContent(db);
    const globalFirst: D1RecipeContentSnapshot = {
      ...snapshot,
      runtimeFields: snapshot.runtimeFields.map((row) => ({ ...row, runtimeOrder: row.recipeId.startsWith('gl-') ? row.runtimeOrder! - 59 : row.runtimeOrder! + 12 })),
    };
    const drifted = compareRuntimeCatalogs(ALL_RECIPES, globalFirst);
    expect(drifted).toMatchObject({ staticOnlyCount: 0, d1OnlyCount: 0, driftCount: 0, hydrationFailureCount: 0, orderDriftCount: 71 });
    const record = toRecipeCatalogShadowLogRecord({ status: 'compared', mode: 'shadow', diagnostics: drifted, release: { ...outcome.release, readiness: 'not_ready', readinessCode: 'ORDER_DRIFT', reviewedGrowthCount: 0 } });
    expect(record).toMatchObject({ level: 'warn', catalog_order_drift_count: 71, catalog_drift_count: 0 });
    expect(record.order_drift_sample).toHaveLength(10);
    expect(record.order_drift_sample[0]).toEqual({ id: 'vn-canh-01', staticPosition: 0, d1Position: 12 });
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
    db = new SqliteD1({ through: LEGACY_CATALOG_MIGRATION_TIP });
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
    resetRecipeCatalogShadowThrottle();
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
      catalog_static_only_count: 0, catalog_d1_only_count: 0, catalog_drift_count: 0, catalog_order_drift_count: 0, catalog_hydration_failure_count: 0,
      drift_sample: [], order_drift_sample: [], hydration_failure_sample: [],
    });
    expect(typeof records[0].catalog_lookup_ms).toBe('number');
    expect(JSON.stringify(records[0])).not.toMatch(/Trứng|p-eggs|parity-house/);

    // Cost bound: a second shadow request inside the interval touches neither D1 nor the log.
    const throttled = await request('GET', '/recipes?cuisine=korean', undefined, {}, { RECIPE_CATALOG_MODE: 'shadow' });
    expect(throttled.json).toEqual(base.json);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(logs.filter((line) => line.includes('recipe_catalog_shadow'))).toHaveLength(1);
    resetRecipeCatalogShadowThrottle();

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
