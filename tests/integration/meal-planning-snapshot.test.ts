import { afterEach, describe, expect, it } from 'vitest';
import {
  MealPlanningSnapshotAuthorizationError,
  MEAL_PLANNING_SNAPSHOT_STATEMENT_COUNT,
  loadMealPlanningSnapshot,
} from '../../packages/db/src/meal-planning-snapshot';
import { createPlanningContext } from '../../packages/recipes/src/planner-context';
import { planWeeklyMeals } from '../../packages/recipes/src/weekly-planner';
import { LEGACY_CATALOG_MIGRATION_TIP, SqliteD1, type SqliteStatementEvent } from '../helpers/sqlite-d1';

const householdId = 'snapshot-home';
const userId = 'snapshot-user';
const referenceTime = '2026-09-08T07:00:00.000Z';

function fixture() {
  // T04 planner semantics on the 71-recipe baseline ledger (recipeLimit 80 exhaustive). Catalog growth
  // beyond recipeLimit truthfully reports CATALOG_RECIPE_LIMIT / search_limited (see recipe-catalog-growth tests).
  const db = new SqliteD1({ through: LEGACY_CATALOG_MIGRATION_TIP });
  db.seed(`
    INSERT INTO users (id) VALUES ('${userId}'), ('snapshot-other');
    INSERT INTO households (id, name, created_by)
    VALUES ('${householdId}', 'Snapshot household', '${userId}');
    INSERT INTO household_members (id, household_id, user_id, role)
    VALUES ('snapshot-member', '${householdId}', '${userId}', 'owner');
    INSERT INTO recipes
      (id, slug, title, cuisine, cook_time_minutes, servings, difficulty, source_type, verification_state, version)
    VALUES ('snapshot-recipe', 'snapshot-recipe', 'Snapshot recipe', 'vietnamese', 20, 2, 'easy', 'curated', 'reviewed', 1);
    INSERT INTO recipe_ingredients
      (id, recipe_id, ingredient_id, name, required_quantity, unit, is_optional)
    VALUES ('snapshot-line', 'snapshot-recipe', 'CHICKEN_BREAST', 'Chicken breast', 200, 'g', 0);
    INSERT INTO recipe_steps (id, recipe_id, step_number, instruction, tip, timer_minutes)
    VALUES ('snapshot-step', 'snapshot-recipe', 1, 'Cook thoroughly.', 'Use a hot pan.', 20);
    INSERT INTO nutrition_profiles
      (id, basis_quantity, basis_unit, source_type, source_reference, protein_g)
    VALUES ('snapshot-nutrition', 1, 'serving', 'authoritative', 'fixture:snapshot', 30);
    INSERT INTO recipe_nutrition (recipe_id, recipe_version, nutrition_profile_id)
    VALUES ('snapshot-recipe', 1, 'snapshot-nutrition');
    INSERT INTO inventory_items
      (id, household_id, ingredient_id, name, quantity, unit, category, storage, freshness, version)
    VALUES ('snapshot-lot', '${householdId}', 'CHICKEN_BREAST', 'Chicken breast', 400, 'g', 'meat', 'fridge', 'fresh', 3);
  `);
  return db;
}

describe('coherent meal planning snapshot', () => {
  const databases: SqliteD1[] = [];
  const database = () => {
    const db = fixture();
    databases.push(db);
    return db;
  };

  afterEach(() => databases.splice(0).forEach((db) => db.close()));

  it('loads catalog, authorized ranking context, inventory, nutrition, and recipe steps in one read-only batch', async () => {
    const db = database();
    const batches: SqliteStatementEvent[][] = [];
    db.hooks.beforeBatch = (statements) => { batches.push([...statements]); };

    const snapshot = await loadMealPlanningSnapshot(db, { householdId, userId }, referenceTime);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(MEAL_PLANNING_SNAPSHOT_STATEMENT_COUNT);
    expect(batches[0].every((statement) => statement.sql.trimStart().toUpperCase().startsWith('SELECT'))).toBe(true);
    expect(snapshot.catalog.source).toBe('d1');
    expect(snapshot.catalog.recipes.find((recipe) => recipe.id === 'snapshot-recipe')).toEqual(
      expect.objectContaining({ id: 'snapshot-recipe', provenance: expect.objectContaining({ version: 1 }) }),
    );
    expect(snapshot.rankingContext).toEqual({ householdId, userId, preferences: [], feedback: [] });
    expect(snapshot.inventory).toEqual([
      expect.objectContaining({ id: 'snapshot-lot', householdId, quantity: 400, version: 3 }),
    ]);
    expect(snapshot.recipeSteps.find((step) => step.id === 'snapshot-step')).toEqual(
      { id: 'snapshot-step', recipeId: 'snapshot-recipe', stepNumber: 1,
        instruction: 'Cook thoroughly.', tip: 'Use a hot pan.', timerMinutes: 20 },
    );
    expect(snapshot.fingerprint).toMatchObject({
      algorithm: 'sha-256',
      value: expect.stringMatching(/^[a-f0-9]{64}$/),
      parts: {
        inventory: expect.stringMatching(/^[a-f0-9]{64}$/),
        preferences: expect.stringMatching(/^[a-f0-9]{64}$/),
        catalog: expect.stringMatching(/^[a-f0-9]{64}$/),
        history: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
  });

  it('uses the preloaded nutrition provider without inventing reviewed safety evidence or querying in planner search', async () => {
    const db = database();
    const snapshot = await loadMealPlanningSnapshot(db, { householdId, userId }, referenceTime);
    const context = createPlanningContext(() => ({
      snapshotId: 'snapshot-v1',
      referenceInstant: referenceTime,
      catalog: snapshot.catalog,
      inventory: snapshot.inventory,
      rankingContext: snapshot.rankingContext,
      evidenceProvider: snapshot.evidenceProvider,
    }));

    db.hooks.beforeBatch = () => { throw new Error('Planner search must not query D1'); };
    db.hooks.beforeStatement = () => { throw new Error('Planner search must not query D1'); };
    const plan = planWeeklyMeals({
      context,
      request: {
        startDate: '2026-09-08',
        defaultServings: 2,
        slots: [{ date: '2026-09-08', mealType: 'dinner' }],
      },
    });

    expect(plan.status).toBe('feasible');
    expect(plan.slots[0].ranked.facts.nutrition.verificationState).toBe('unverified');
    expect(plan.slots[0].ranked.eligibility.safetyAssessment).toBe('not_requested');
  });

  it('fails closed when persisted hard safety policy has no reviewed evidence source', async () => {
    const db = database();
    db.seed(`INSERT INTO household_ranking_preferences (household_id, values_json, updated_at)
      VALUES ('${householdId}', '{"version":1,"values":{"allergens":["soy"]}}', '${referenceTime}')`);
    const snapshot = await loadMealPlanningSnapshot(db, { householdId, userId }, referenceTime);
    const context = createPlanningContext(() => ({
      snapshotId: 'snapshot-safety-v1',
      referenceInstant: referenceTime,
      catalog: snapshot.catalog,
      inventory: snapshot.inventory,
      rankingContext: snapshot.rankingContext,
      evidenceProvider: snapshot.evidenceProvider,
    }));

    const plan = planWeeklyMeals({
      context,
      request: {
        startDate: '2026-09-08',
        defaultServings: 2,
        slots: [{ date: '2026-09-08', mealType: 'dinner' }],
      },
    });

    expect(plan.status).toBe('infeasible');
    expect(plan.diagnostics.some((diagnostic) => diagnostic.code === 'SAFETY_UNKNOWN')).toBe(true);
  });

  it('fails with a typed authorization error before exposing any household-scoped snapshot', async () => {
    const db = database();

    await expect(loadMealPlanningSnapshot(db, { householdId, userId: 'snapshot-other' }, referenceTime))
      .rejects.toBeInstanceOf(MealPlanningSnapshotAuthorizationError);
  });

  it('changes only the affected SHA-256 fingerprint part when inventory changes', async () => {
    const db = database();
    const before = await loadMealPlanningSnapshot(db, { householdId, userId }, referenceTime);
    db.seed("UPDATE inventory_items SET quantity = 300, version = 4 WHERE id = 'snapshot-lot'");
    const after = await loadMealPlanningSnapshot(db, { householdId, userId }, referenceTime);

    expect(after.fingerprint.value).not.toBe(before.fingerprint.value);
    expect(after.fingerprint.parts.inventory).not.toBe(before.fingerprint.parts.inventory);
    expect(after.fingerprint.parts.preferences).toBe(before.fingerprint.parts.preferences);
    expect(after.fingerprint.parts.catalog).toBe(before.fingerprint.parts.catalog);
    expect(after.fingerprint.parts.history).toBe(before.fingerprint.parts.history);
  });
});
