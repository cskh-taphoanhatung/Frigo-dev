import { describe, expect, it } from 'vitest';
import { generateWeeklyMealPlan } from '@frigo/domain';
import { ALL_RECIPES } from '@frigo/recipes';
import {
  normalizeWeekDayOfWeek,
  parseMealPlanSnapshot,
  persistPlanRelational,
  resolveWeekSchemaMode,
  serializeMealPlanSnapshot,
} from '../../src/worker/routes/week';

describe('Frigo Week relational read model', () => {
  it('defaults Week storage to legacy and rejects unsupported modes', () => {
    expect(resolveWeekSchemaMode(undefined)).toBe('legacy');
    expect(resolveWeekSchemaMode('legacy')).toBe('legacy');
    expect(resolveWeekSchemaMode('dual')).toBe('dual');
    expect(() => resolveWeekSchemaMode('v2-read')).toThrow('Unsupported WEEK_SCHEMA_MODE');
  });

  it('fails closed before mutation when the v2 capability is incomplete', async () => {
    const calls: string[] = [];
    const db = {
      prepare(sql: string) {
        calls.push(sql);
        const statement = {
          sql,
          bind() {
            return statement;
          },
          async first() {
            if (sql.includes('pragma_table_info')) {
              return { day_columns: 0, slot_columns: 0, shopping_columns: 0 };
            }
            return null;
          },
          async all() {
            return { results: [] };
          },
        };
        return statement;
      },
      async batch() {
        throw new Error('batch must not run');
      },
    };

    await expect(
      persistPlanRelational(db, { id: 'plan_test', householdId: 'hh_test' } as any, 'hh_test', 'user_test', 'dual')
    ).rejects.toThrow('Week v2 schema capability is unavailable');
    expect(calls).toHaveLength(1);
  });

  it('adds v2 child deletes/inserts to the same batch in dual mode', async () => {
    let batchSql: string[] = [];
    let batchStatements: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      prepare(sql: string) {
        const statement = {
          sql,
          values: [] as unknown[],
          bind(...values: unknown[]) {
            statement.values = values;
            return statement;
          },
          async first() {
            if (sql.includes('pragma_table_info')) {
              return { day_columns: 5, slot_columns: 12, shopping_columns: 16 };
            }
            return null;
          },
          async all() {
            return { results: [] };
          },
        };
        return statement;
      },
      async batch(statements: Array<{ sql: string; values: unknown[] }>) {
        batchStatements = statements;
        batchSql = statements.map((statement) => statement.sql);
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
      },
    };

    await persistPlanRelational(
      db,
      {
        id: 'plan_test',
        householdId: 'hh_test',
        startDate: '2026-09-07',
        endDate: '2026-09-13',
        status: 'READY',
        shoppingFrequency: 'once',
        priorities: ['use_fridge'],
        budget: { targetVnd: null, estimatedMinVnd: 0, estimatedMaxVnd: 0, status: 'UNDER', displayText: '0' },
        utilization: { utilizationPercent: 0, plannedItemsCount: 0, totalUsableItemsCount: 0, highPriorityUsedCount: 0 },
        wasteRisk: { level: 'LOW', expiringItemsCount: 0, rescuedItemsCount: 0, displayText: 'low' },
        days: [
          {
            id: 'day_test',
            planId: 'plan_test',
            date: '2026-09-07',
            dayOfWeek: 1,
            dayNameVi: 'Thứ 2',
            dayType: 'cooking',
            slots: [
              {
                id: 'slot_test',
                dayId: 'day_test',
                planId: 'plan_test',
                slotType: 'dinner',
                status: 'PLANNED',
                date: '2026-09-07',
                dayOfWeek: 1,
                servings: 2,
                source: 'AUTO',
                availabilityPercent: 100,
                incrementalCostVnd: 0,
                rescuedExpiringIngredients: [],
                badges: [],
                ingredients: [],
              },
            ],
          },
        ],
        shoppingItems: [
          {
            ingredientId: 'TOMATO',
            name: 'Cà chua',
            category: 'vegetable',
            requiredQuantity: 2,
            existingInventoryQuantity: 0,
            missingQuantity: 2,
            recommendedPurchaseQuantity: 2,
            unit: 'piece',
            estimatedPriceMin: 1000,
            estimatedPriceMax: 2000,
            checked: false,
            sourceRecipes: [],
          },
        ],
        createdAt: '2026-09-07T00:00:00.000Z',
        updatedAt: '2026-09-07T00:00:00.000Z',
      } as any,
      'hh_test',
      'user_test',
      'dual'
    );

    expect(batchSql.some((sql) => sql.includes('DELETE FROM meal_plan_days_v2'))).toBe(true);
    expect(batchSql.some((sql) => sql.includes('INSERT INTO meal_plans'))).toBe(true);
    expect(batchSql.some((sql) => sql.includes('INSERT INTO meal_plan_days_v2'))).toBe(true);
    expect(batchSql.some((sql) => sql.includes('INSERT INTO meal_plan_slots_v2'))).toBe(true);
    expect(batchSql.some((sql) => sql.includes('INSERT INTO meal_plan_shopping_items_v2'))).toBe(true);
    expect(batchStatements.find((statement) => statement.sql.includes('INSERT INTO meal_plan_slots_v2'))?.values)
      .toEqual(['slot_test', 'day_test', 'plan_test', 'dinner', 'PLANNED', null, 2, 'AUTO', 0, null, null, expect.any(String)]);
    expect(batchStatements.find((statement) => statement.sql.includes('INSERT INTO meal_plan_shopping_items_v2'))?.values)
      .toEqual([
        'shop_plan_test_TOMATO', 'plan_test', 'TOMATO', 'Cà chua', 'vegetable', 2, 0, 2, 2, 2,
        'piece', 1000, 2000, 0, 0, expect.any(String),
      ]);
  });

  it('round-trips the complete planner response without losing metadata', () => {
    const plan = generateWeeklyMealPlan(
      {
        householdId: 'hh_test',
        startDate: '2026-09-07',
        householdSize: 2,
        mealSlotsPreset: 'dinner_only',
        budgetTargetVnd: 500000,
        priorities: ['use_fridge'],
        shoppingFrequency: 'once',
        schedule: [{ date: '2026-09-08', dayType: 'eat_out' }],
      },
      [],
      ALL_RECIPES
    );

    const row = { id: plan.id, household_id: plan.householdId };
    const restored = parseMealPlanSnapshot(serializeMealPlanSnapshot(plan), row);

    expect(restored).toEqual(plan);
    if (!restored) throw new Error('snapshot should restore');
    expect(restored.days[1]).toMatchObject({
      dayNameVi: 'Thứ 3',
      dayType: 'eat_out',
    });
    expect(restored.days[1]?.slots[0]).toMatchObject({
      dayId: restored.days[1].id,
      planId: plan.id,
      source: 'AUTO',
      availabilityPercent: 100,
      ingredients: [],
    });
  });

  it('rejects snapshots belonging to another plan or household', () => {
    const raw = JSON.stringify({ version: 1, plan: { id: 'plan_a', householdId: 'hh_a', days: [], shoppingItems: [] } });

    expect(parseMealPlanSnapshot(raw, { id: 'plan_b', household_id: 'hh_a' })).toBeNull();
    expect(parseMealPlanSnapshot(raw, { id: 'plan_a', household_id: 'hh_b' })).toBeNull();
  });

  it('normalizes legacy numeric, named, and Sunday values to the API contract', () => {
    expect(normalizeWeekDayOfWeek(1, '2026-09-07')).toBe(1);
    expect(normalizeWeekDayOfWeek('Tuesday', '2026-09-07')).toBe(2);
    expect(normalizeWeekDayOfWeek(0, '2026-09-13')).toBe(7);
  });
});
