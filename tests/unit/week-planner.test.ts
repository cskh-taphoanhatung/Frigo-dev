import { describe, it, expect } from 'vitest';
import {
  scaleIngredientQuantity,
  scaleRecipeIngredients,
  calculatePackageRecommendation,
  calculateFridgeUtilization,
  calculateFoodWasteRisk,
  aggregateShoppingRequirements,
  isRecipeEligible,
  generateWeeklyMealPlan,
  swapMealInPlan,
  InventoryItem,
  StandardUnit,
} from '@frigo/domain';
import { ALL_RECIPES, Recipe } from '@frigo/recipes';

describe('Frigo Week — Portion Scaling Engine', () => {
  it('scales ingredients deterministically based on household servings', () => {
    // Household of 3 with base recipe for 4 (ratio = 0.75)
    // 400g pork * 0.75 = 300g
    const scaledG = scaleIngredientQuantity(400, 'g', 0.75);
    expect(scaledG).toBe(300);

    // 4 eggs * 0.75 = 3 eggs
    const scaledEgg = scaleIngredientQuantity(4, 'piece', 0.75);
    expect(scaledEgg).toBe(3);

    // 1 bunch * 0.75 -> minimum 1 bunch
    const scaledBunch = scaleIngredientQuantity(1, 'bunch', 0.75);
    expect(scaledBunch).toBe(1);
  });

  it('scales complete recipe ingredients array', () => {
    const ingredients = [
      { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ', requiredQuantity: 400, unit: 'g' as StandardUnit },
      { ingredientId: 'CHICKEN_EGG', name: 'Trứng gà', requiredQuantity: 4, unit: 'piece' as StandardUnit },
    ];
    const scaled = scaleRecipeIngredients(ingredients, 2, 4); // ratio = 0.5
    expect(scaled[0].scaledQuantity).toBe(200);
    expect(scaled[1].scaledQuantity).toBe(2);
  });
});

describe('Frigo Week — Requirement 59: Inventory Subtraction & Shopping Aggregation', () => {
  it('correctly subtracts inventory across multiple recipes without creating unnecessary purchases', () => {
    // Requirement 59:
    // Inventory: pork 500g, egg 6, tomato 4, tofu 2
    // Recipe A: pork 300g, egg 4
    // Recipe B: tofu 2, tomato 3
    // Expected:
    // purchase pork = 0, egg = 0, tofu = 0, tomato = 0
    const mockInventory: InventoryItem[] = [
      {
        id: 'i1',
        householdId: 'h1',
        ingredientId: 'PORK_BELLY',
        name: 'Thịt ba chỉ',
        quantity: 500,
        unit: 'g',
        category: 'meat',
        storage: 'fridge',
        addedDate: new Date().toISOString(),
        freshness: 'fresh',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'i2',
        householdId: 'h1',
        ingredientId: 'CHICKEN_EGG',
        name: 'Trứng gà',
        quantity: 6,
        unit: 'piece',
        category: 'egg',
        storage: 'fridge',
        addedDate: new Date().toISOString(),
        freshness: 'fresh',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'i3',
        householdId: 'h1',
        ingredientId: 'TOMATO',
        name: 'Cà chua',
        quantity: 4,
        unit: 'piece',
        category: 'vegetable',
        storage: 'fridge',
        addedDate: new Date().toISOString(),
        freshness: 'fresh',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'i4',
        householdId: 'h1',
        ingredientId: 'TOFU',
        name: 'Đậu phụ',
        quantity: 2,
        unit: 'piece',
        category: 'other',
        storage: 'fridge',
        addedDate: new Date().toISOString(),
        freshness: 'fresh',
        updatedAt: new Date().toISOString(),
      },
    ];

    const requirements = [
      // Recipe A
      { recipeId: 'rA', recipeTitle: 'Thịt kho trứng', ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ', quantity: 300, unit: 'g' as StandardUnit },
      { recipeId: 'rA', recipeTitle: 'Thịt kho trứng', ingredientId: 'CHICKEN_EGG', name: 'Trứng gà', quantity: 4, unit: 'piece' as StandardUnit },
      // Recipe B
      { recipeId: 'rB', recipeTitle: 'Đậu sốt cà chua', ingredientId: 'TOFU', name: 'Đậu phụ', quantity: 2, unit: 'piece' as StandardUnit },
      { recipeId: 'rB', recipeTitle: 'Đậu sốt cà chua', ingredientId: 'TOMATO', name: 'Cà chua', quantity: 3, unit: 'piece' as StandardUnit },
    ];

    const { shoppingItems, budget } = aggregateShoppingRequirements(requirements, mockInventory);

    // All items should be 100% covered by inventory
    expect(shoppingItems.length).toBe(0);
    expect(budget.estimatedMaxVnd).toBe(0);
    expect(budget.displayText).toContain('100%');
  });

  it('correctly identifies purchase requirements when inventory is insufficient', () => {
    // Inventory: only 200g pork, need 500g -> missing 300g -> recommended purchase 300g or 500g pack
    const mockInventory: InventoryItem[] = [
      {
        id: 'i1',
        householdId: 'h1',
        ingredientId: 'PORK_BELLY',
        name: 'Thịt ba chỉ',
        quantity: 200,
        unit: 'g',
        category: 'meat',
        storage: 'fridge',
        addedDate: new Date().toISOString(),
        freshness: 'fresh',
        updatedAt: new Date().toISOString(),
      },
    ];

    const requirements = [
      { recipeId: 'r1', recipeTitle: 'Thịt nướng', ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ', quantity: 500, unit: 'g' as StandardUnit },
    ];

    const { shoppingItems, budget } = aggregateShoppingRequirements(requirements, mockInventory);
    expect(shoppingItems.length).toBe(1);
    expect(shoppingItems[0].ingredientId).toBe('PORK_BELLY');
    expect(shoppingItems[0].missingQuantity).toBe(300);
    expect(shoppingItems[0].recommendedPurchaseQuantity).toBeGreaterThanOrEqual(300);
    expect(budget.estimatedMinVnd).toBeGreaterThan(0);
  });

  it('does not offset mass requirements with incompatible piece inventory', () => {
    const { shoppingItems } = aggregateShoppingRequirements(
      [{ recipeId: 'r1', recipeTitle: 'Thịt nướng', ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ', quantity: 500, unit: 'g' }],
      [{
        id: 'i1', householdId: 'h1', ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ', quantity: 2,
        unit: 'piece', category: 'meat', storage: 'fridge', addedDate: new Date().toISOString(),
        freshness: 'fresh', updatedAt: new Date().toISOString(),
      }]
    );

    expect(shoppingItems).toHaveLength(1);
    expect(shoppingItems[0].missingQuantity).toBe(500);
  });

  it('does not offset piece requirements with incompatible mass inventory', () => {
    const { shoppingItems } = aggregateShoppingRequirements(
      [{ recipeId: 'r1', recipeTitle: 'Trứng', ingredientId: 'CHICKEN_EGG', name: 'Trứng gà', quantity: 4, unit: 'piece' }],
      [{
        id: 'i1', householdId: 'h1', ingredientId: 'CHICKEN_EGG', name: 'Trứng gà', quantity: 400,
        unit: 'g', category: 'egg', storage: 'fridge', addedDate: new Date().toISOString(),
        freshness: 'fresh', updatedAt: new Date().toISOString(),
      }]
    );

    expect(shoppingItems).toHaveLength(1);
    expect(shoppingItems[0].missingQuantity).toBe(4);
  });

  it.each([
    ['SCALLION', 'Hành lá', 'bunch', 'g'],
    ['RICE', 'Gạo', 'pack', 'g'],
  ] as const)('does not offset %s requirements with incompatible %s inventory', (ingredientId, name, requiredUnit, inventoryUnit) => {
    const { shoppingItems } = aggregateShoppingRequirements(
      [{ recipeId: 'r1', recipeTitle: name, ingredientId, name, quantity: 1, unit: requiredUnit }],
      [{
        id: 'i1', householdId: 'h1', ingredientId, name, quantity: 500,
        unit: inventoryUnit, category: 'other', storage: 'fridge', addedDate: new Date().toISOString(),
        freshness: 'fresh', updatedAt: new Date().toISOString(),
      }]
    );

    expect(shoppingItems).toHaveLength(1);
    expect(shoppingItems[0].missingQuantity).toBe(1);
  });
});

describe('Frigo Week — Package Size Engine', () => {
  it('rounds missing retail amounts to realistic packages', () => {
    // Chicken egg: packages of 6 or 10. Need 4 -> recommend 6
    const eggPack = calculatePackageRecommendation('CHICKEN_EGG', 4, 'piece');
    expect(eggPack.recommendedPurchase).toBe(6);
    expect(eggPack.expectedLeftover).toBe(2);

    // Pork belly: 300, 500, 1000. Need 350g -> recommend 500g
    const porkPack = calculatePackageRecommendation('PORK_BELLY', 350, 'g');
    expect(porkPack.recommendedPurchase).toBe(500);
    expect(porkPack.expectedLeftover).toBe(150);
  });
});

describe('Frigo Week — Utilization & Waste Risk Engine', () => {
  it('calculates weighted fridge utilization score prioritizing use-soon items', () => {
    const mockInventory: InventoryItem[] = [
      {
        id: 'i1',
        householdId: 'h1',
        ingredientId: 'PORK_BELLY',
        name: 'Thịt ba chỉ',
        quantity: 500,
        unit: 'g',
        category: 'meat',
        storage: 'fridge',
        addedDate: new Date().toISOString(),
        freshness: 'expiring', // Weight = 3.0
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'i2',
        householdId: 'h1',
        ingredientId: 'CABBAGE',
        name: 'Bắp cải',
        quantity: 1,
        unit: 'piece',
        category: 'vegetable',
        storage: 'fridge',
        addedDate: new Date().toISOString(),
        freshness: 'fresh', // Weight = 1.0
        updatedAt: new Date().toISOString(),
      },
    ];

    // Using 500g pork (all of expiring item)
    const utilization = calculateFridgeUtilization(mockInventory, [
      { ingredientId: 'PORK_BELLY', plannedUsedQuantity: 500 },
    ]);

    // Used 3.0 out of 4.0 total weight = 75%
    expect(utilization.utilizationPercent).toBe(75);
    expect(utilization.highPriorityUsedCount).toBe(1);
  });

  it('determines food waste risk level based on expiring items', () => {
    const mockInventory: InventoryItem[] = [
      {
        id: 'i1',
        householdId: 'h1',
        ingredientId: 'FISH',
        name: 'Cá',
        quantity: 300,
        unit: 'g',
        category: 'seafood',
        storage: 'fridge',
        addedDate: new Date().toISOString(),
        freshness: 'expiring',
        updatedAt: new Date().toISOString(),
      },
    ];

    // If rescued
    const lowRisk = calculateFoodWasteRisk(mockInventory, ['FISH']);
    expect(lowRisk.level).toBe('LOW');

    // If unrescued
    const medRisk = calculateFoodWasteRisk(mockInventory, []);
    expect(medRisk.level).toBe('MEDIUM');
  });
});

describe('Frigo Week — Constraint & Allergy Exclusion', () => {
  const sampleMeatRecipe: Recipe = {
    id: 'vn-01',
    slug: 'thit-kho-trung',
    title: 'Thịt kho trứng',
    description: 'Thịt kho',
    cuisine: 'vietnamese',
    cookTimeMinutes: 40,
    servings: 4,
    difficulty: 'medium',
    imageUrl: '/frigo/recipes/vietnam/thit-kho-trung.webp',
    tags: ['Món mặn'],
    ingredients: [
      { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ', requiredQuantity: 400, unit: 'g' },
    ],
    steps: [{ stepNumber: 1, instruction: 'Kho thịt' }],
  };

  it('excludes meat recipes when user has vegetarian restriction', () => {
    const result = isRecipeEligible(sampleMeatRecipe, ['ăn chay'], []);
    expect(result.eligible).toBe(false);
  });

  it('excludes recipes containing disliked ingredients', () => {
    const result = isRecipeEligible(sampleMeatRecipe, [], ['ba chỉ']);
    expect(result.eligible).toBe(false);
  });

  it('allows eligible recipes when no restrictions match', () => {
    const result = isRecipeEligible(sampleMeatRecipe, ['ít dầu mỡ'], ['hải sản']);
    expect(result.eligible).toBe(true);
  });
});

describe('Frigo Week — End-to-End Plan Generation & Swap', () => {
  it('generates a full 7-day meal plan and supports meal swapping', () => {
    const plan = generateWeeklyMealPlan(
      {
        householdId: 'demo_household_01',
        startDate: '2026-09-07',
        householdSize: 3,
        mealSlotsPreset: 'dinner_only',
        budgetTargetVnd: 800000,
        priorities: ['use_fridge', 'budget'],
        shoppingFrequency: 'once',
      },
      [
        {
          id: 'inv_1',
          householdId: 'demo_household_01',
          ingredientId: 'PORK_BELLY',
          name: 'Thịt ba chỉ',
          quantity: 500,
          unit: 'g',
          category: 'meat',
          storage: 'fridge',
          addedDate: new Date().toISOString(),
          freshness: 'expiring',
          updatedAt: new Date().toISOString(),
        },
      ],
      ALL_RECIPES
    );

    expect(plan.days.length).toBe(7);
    expect(plan.status).toBe('READY');
    expect(plan.budget.estimatedMaxVnd).toBeDefined();
    expect(plan.utilization.utilizationPercent).toBeGreaterThan(0);

    // Verify swap meal
    const mondaySlot = plan.days[0].slots[0];
    const newRecipe: Recipe = {
      id: 'mock_swap',
      slug: 'dau-phu-sot-ca-chua',
      title: 'Đậu phụ sốt cà chua',
      description: 'Đậu sốt',
      cuisine: 'vietnamese',
      cookTimeMinutes: 15,
      servings: 3,
      difficulty: 'easy',
      imageUrl: '/frigo/recipes/vietnam/dau-phu-sot-ca-chua.webp',
      tags: ['Nhanh'],
      ingredients: [
        { ingredientId: 'TOFU', name: 'Đậu phụ', requiredQuantity: 2, unit: 'piece' },
      ],
      steps: [{ stepNumber: 1, instruction: 'Rán đậu' }],
    };

    const swappedPlan = swapMealInPlan(plan, mondaySlot.id, newRecipe, []);
    const updatedSlot = swappedPlan.days[0].slots[0];
    expect(updatedSlot.recipe?.id).toBe('mock_swap');
    expect(updatedSlot.source).toBe('USER');
    expect(updatedSlot.isLocked).toBe(true);
  });
});
