import { Recipe } from '@frigo/recipes';
import { InventoryItem, tryConvertUnit } from '../index';
import {
  MealPlan,
  MealPlanDay,
  MealSlotItem,
  MealPlanSetupInput,
  MealSwapAlternative,
  PlannerConfig,
  DEFAULT_PLANNER_CONFIG,
  MealSlotIngredientRequirement,
} from './types';
import { scaleRecipeIngredients } from './portion';
import { defaultPriceProvider, PriceProvider } from './pricing';
import { evaluateWeeklyCandidate, isRecipeEligible } from './score';
import { aggregateShoppingRequirements } from './shopping';
import { calculateFridgeUtilization, calculateFoodWasteRisk } from './utilization';

const DAY_NAMES_VI = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/**
 * Generates an end-to-end deterministic weekly meal plan.
 */
export function generateWeeklyMealPlan(
  input: MealPlanSetupInput,
  inventory: InventoryItem[],
  // T14D: the caller's authority snapshot decides recipe content; there is no hidden static default.
  availableRecipes: Recipe[],
  priceProvider: PriceProvider = defaultPriceProvider,
  config: PlannerConfig = DEFAULT_PLANNER_CONFIG
): MealPlan {
  const planId = input.planId || `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const startDateObj = new Date(input.startDate || new Date().toISOString().split('T')[0]);

  // Clone inventory for internal tracking of consumption across days
  const trackingInventory: InventoryItem[] = inventory.map((item) => ({ ...item }));

  const days: MealPlanDay[] = [];
  const plannedRecipeIds: string[] = [];
  const plannedProteins: string[] = [];
  const rescuedIngredientIds: string[] = [];
  const allMealRequirements: Array<{
    recipeId: string;
    recipeTitle: string;
    ingredientId: string;
    name: string;
    quantity: number;
    unit: any;
    category?: any;
  }> = [];

  // 1. Build 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const dayDateObj = new Date(startDateObj.getTime() + dayOffset * 86400000);
    const dateStr = dayDateObj.toISOString().split('T')[0];
    const jsDayOfWeek = dayDateObj.getDay(); // 0 = Sunday, 1 = Monday
    const vnDayIndex = jsDayOfWeek === 0 ? 0 : jsDayOfWeek; // 0 = CN, 1 = T2
    const dayNameVi = DAY_NAMES_VI[vnDayIndex];
    const isWeekend = jsDayOfWeek === 0 || jsDayOfWeek === 6;

    // Check user schedule override if provided
    const scheduleOverride = input.schedule?.find((s) => s.date === dateStr);
    const dayType = scheduleOverride ? scheduleOverride.dayType : 'cooking';

    const dayId = `day_${planId}_${dayOffset + 1}`;
    const slots: MealSlotItem[] = [];

    // Determine slots to plan
    let activeSlotsForDay: ('breakfast' | 'lunch' | 'dinner')[] = ['dinner'];
    if (input.mealSlotsPreset === 'all') {
      activeSlotsForDay = ['breakfast', 'lunch', 'dinner'];
    } else if (input.mealSlotsPreset === 'working_people') {
      activeSlotsForDay = isWeekend ? ['lunch', 'dinner'] : ['dinner'];
    }

    if (dayType === 'eat_out') {
      slots.push({
        id: `slot_${dayId}_dinner`,
        dayId,
        planId,
        slotType: 'dinner',
        status: 'EATING_OUT',
        date: dateStr,
        dayOfWeek: jsDayOfWeek === 0 ? 7 : jsDayOfWeek,
        servings: input.householdSize,
        source: 'AUTO',
        availabilityPercent: 100,
        incrementalCostVnd: 0,
        rescuedExpiringIngredients: [],
        badges: ['Ăn ngoài', 'Không cần nấu'],
        ingredients: [],
        notes: 'Bữa ăn ngoài cùng gia đình hoặc bạn bè',
      });
    } else if (dayType === 'flexible') {
      slots.push({
        id: `slot_${dayId}_dinner`,
        dayId,
        planId,
        slotType: 'dinner',
        status: 'FLEXIBLE',
        date: dateStr,
        dayOfWeek: jsDayOfWeek === 0 ? 7 : jsDayOfWeek,
        servings: input.householdSize,
        source: 'AUTO',
        availabilityPercent: 100,
        incrementalCostVnd: 0,
        rescuedExpiringIngredients: [],
        badges: ['Bữa linh hoạt', 'Tùy chọn lúc đó'],
        ingredients: [],
        notes: 'Dành cho đồ ăn thừa (leftovers) hoặc đặt món tự do',
      });
    } else if (dayType === 'away') {
      slots.push({
        id: `slot_${dayId}_dinner`,
        dayId,
        planId,
        slotType: 'dinner',
        status: 'SKIPPED',
        date: dateStr,
        dayOfWeek: jsDayOfWeek === 0 ? 7 : jsDayOfWeek,
        servings: input.householdSize,
        source: 'AUTO',
        availabilityPercent: 100,
        incrementalCostVnd: 0,
        rescuedExpiringIngredients: [],
        badges: ['Không ở nhà'],
        ingredients: [],
      });
    } else {
      // Normal Cooking Day: Pick best recipe for each active slot
      for (const slotType of activeSlotsForDay) {
        // Filter eligible recipes by restrictions & dislikes
        const eligibleRecipes = availableRecipes.filter((r) => {
          const check = isRecipeEligible(r, input.dietaryRestrictions, input.dislikedIngredients);
          return check.eligible;
        });

        // Evaluate candidates against current available trackingInventory
        const evaluated = eligibleRecipes.map((recipe) =>
          evaluateWeeklyCandidate(recipe, trackingInventory, priceProvider, {
            preferredCuisines: input.preferredCuisines,
            recentProteins: plannedProteins,
            recentRecipeIds: plannedRecipeIds,
            budgetFocus: input.priorities.includes('budget'),
            config,
          })
        );

        // Sort descending by score
        evaluated.sort((a, b) => b.score - a.score);

        // Pick top candidate
        const bestCandidate = evaluated[0] || {
          recipe: availableRecipes[0],
          score: 50,
          rescuedExpiringIngredients: [],
          estimatedCostVnd: 20000,
          mainProtein: 'pork',
        };

        const chosenRecipe = bestCandidate.recipe;
        plannedRecipeIds.push(chosenRecipe.id);
        if (bestCandidate.mainProtein) {
          plannedProteins.push(bestCandidate.mainProtein);
        }

        // Scale ingredients for household
        const scaledIngredients = scaleRecipeIngredients(
          chosenRecipe.ingredients,
          input.householdSize,
          chosenRecipe.servings
        );

        // Build slot ingredients and update tracking inventory
        let matchedCount = 0;
        let slotIncrementalCost = 0;
        const slotIngredients: MealSlotIngredientRequirement[] = [];

        for (const ing of scaledIngredients) {
          const invItem = trackingInventory.find(
            (i) => i.ingredientId.toUpperCase() === ing.ingredientId.toUpperCase()
          );

          let availableFromFridge = 0;
          if (invItem && invItem.quantity > 0) {
            const userQtyConverted = tryConvertUnit(invItem.quantity, invItem.unit, ing.unit);
            if (userQtyConverted !== null && userQtyConverted > 0) {
              const used = Math.min(userQtyConverted, ing.scaledQuantity);
              availableFromFridge = used;

              // Deduct from tracking inventory for subsequent days.
              const deductInInvUnit = tryConvertUnit(used, ing.unit, invItem.unit);
              if (deductInInvUnit !== null) {
                invItem.quantity = Math.max(0, invItem.quantity - deductInInvUnit);
              }

              if (invItem.freshness === 'expiring' || invItem.freshness === 'use_soon') {
                rescuedIngredientIds.push(ing.ingredientId);
              }
              matchedCount++;
            }
          }

          const missingQuantity = Math.max(0, ing.scaledQuantity - availableFromFridge);
          let cost = 0;
          if (missingQuantity > 0) {
            const est = priceProvider.estimateCost(ing.ingredientId, missingQuantity, ing.unit);
            cost = est.minVnd;
            slotIncrementalCost += cost;
          }

          slotIngredients.push({
            ingredientId: ing.ingredientId,
            name: ing.name,
            category: (ing as any).category || 'other',
            requiredQuantity: ing.scaledQuantity,
            availableQuantity: availableFromFridge,
            missingQuantity,
            unit: ing.unit,
            estimatedCostVnd: cost,
            fromFridge: availableFromFridge > 0,
          });

          // Add to overall requirements list
          allMealRequirements.push({
            recipeId: chosenRecipe.id,
            recipeTitle: chosenRecipe.title,
            ingredientId: ing.ingredientId,
            name: ing.name,
            quantity: ing.scaledQuantity,
            unit: ing.unit,
          });
        }

        const availabilityPercent = scaledIngredients.length > 0
          ? Math.round((matchedCount / scaledIngredients.length) * 100)
          : 100;

        const badges: string[] = [];
        if (bestCandidate.rescuedExpiringIngredients.length > 0) {
          badges.push('Dùng đồ sắp hết');
        }
        if (availabilityPercent === 100) {
          badges.push('100% nguyên liệu có sẵn');
        } else if (slotIncrementalCost < 25000) {
          badges.push('Tiết kiệm');
        }

        slots.push({
          id: `slot_${dayId}_${slotType}`,
          dayId,
          planId,
          slotType,
          status: 'PLANNED',
          date: dateStr,
          dayOfWeek: jsDayOfWeek === 0 ? 7 : jsDayOfWeek,
          recipe: chosenRecipe,
          servings: input.householdSize,
          source: 'AUTO',
          availabilityPercent,
          incrementalCostVnd: slotIncrementalCost,
          rescuedExpiringIngredients: bestCandidate.rescuedExpiringIngredients,
          badges,
          ingredients: slotIngredients,
        });
      }
    }

    days.push({
      id: dayId,
      planId,
      date: dateStr,
      dayOfWeek: jsDayOfWeek === 0 ? 7 : jsDayOfWeek,
      dayNameVi,
      dayType,
      slots,
    });
  }

  // 2. Aggregate Shopping & Calculate Budget
  const { shoppingItems, budget } = aggregateShoppingRequirements(
    allMealRequirements,
    inventory,
    priceProvider,
    input.budgetTargetVnd
  );

  // 3. Calculate Utilization & Waste Risk
  const usagePlans = allMealRequirements.map((r) => ({
    ingredientId: r.ingredientId,
    plannedUsedQuantity: r.quantity,
  }));
  const utilization = calculateFridgeUtilization(inventory, usagePlans);
  const wasteRisk = calculateFoodWasteRisk(inventory, rescuedIngredientIds);

  const endDateStr = new Date(startDateObj.getTime() + 6 * 86400000).toISOString().split('T')[0];

  return {
    id: planId,
    householdId: input.householdId,
    startDate: input.startDate,
    endDate: endDateStr,
    status: 'READY',
    days,
    budget,
    utilization,
    wasteRisk,
    shoppingItems,
    priorities: input.priorities,
    shoppingFrequency: input.shoppingFrequency,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aiExplanation: `Thực đơn đã tối ưu theo tiêu chí tủ lạnh trước: tận dụng ${utilization.utilizationPercent}% nguyên liệu sẵn có, ưu tiên giải cứu các món cận date đầu tuần.`,
  };
}

/**
 * Generates alternative recipes for swapping a meal in a specific slot,
 * including delta metrics (+budgetDelta, +utilizationDelta, +cookingTimeDelta).
 */
export function getSwapAlternatives(
  currentSlot: MealSlotItem,
  inventory: InventoryItem[],
  availableRecipes: Recipe[],
  priceProvider: PriceProvider = defaultPriceProvider
): MealSwapAlternative[] {
  const currentRecipe = currentSlot.recipe;
  const currentCookTime = currentRecipe?.cookTimeMinutes || 30;
  const currentCost = currentSlot.incrementalCostVnd;

  const currentRecipeId = currentRecipe?.id;
  const alternatives = availableRecipes.filter((r) => r.id !== currentRecipeId);

  const results: MealSwapAlternative[] = [];

  for (const alt of alternatives.slice(0, 5)) {
    const evalResult = evaluateWeeklyCandidate(alt, inventory, priceProvider);
    const altCost = evalResult.estimatedCostVnd;
    const budgetDelta = altCost - currentCost;
    const timeDelta = alt.cookTimeMinutes - currentCookTime;

    const badges: string[] = [];
    if (alt.cookTimeMinutes <= 20) badges.push('Nấu nhanh');
    if (evalResult.inventoryMatchScore >= 15) badges.push('Nhiều đồ có sẵn');
    if (budgetDelta < 0) badges.push('Tiết kiệm hơn');

    results.push({
      recipe: alt,
      budgetDeltaVnd: budgetDelta,
      fridgeUtilizationDeltaPercent: budgetDelta < 0 ? 3 : -2,
      cookingTimeDeltaMinutes: timeDelta,
      matchPercent: Math.round((evalResult.inventoryMatchScore / 20) * 100),
      badges,
    });
  }

  return results.sort((a, b) => b.matchPercent - a.matchPercent);
}

/**
 * Swaps a meal slot with a new recipe and recalculates the plan's
 * ingredient requirements, budget, utilization, and shopping list.
 */
export function swapMealInPlan(
  plan: MealPlan,
  slotId: string,
  newRecipe: Recipe,
  inventory: InventoryItem[],
  priceProvider: PriceProvider = defaultPriceProvider
): MealPlan {
  const updatedDays = plan.days.map((day) => {
    const updatedSlots = day.slots.map((slot) => {
      if (slot.id !== slotId) return slot;

      // Scale ingredients for this slot
      const scaled = scaleRecipeIngredients(
        newRecipe.ingredients,
        slot.servings,
        newRecipe.servings
      );

      let slotCost = 0;
      let matchedCount = 0;
      const slotIngredients: MealSlotIngredientRequirement[] = [];

      for (const ing of scaled) {
        const inv = inventory.find(
          (i) => i.ingredientId.toUpperCase() === ing.ingredientId.toUpperCase()
        );
        let available = 0;
        if (inv && inv.quantity > 0) {
          const userQty = tryConvertUnit(inv.quantity, inv.unit, ing.unit);
          if (userQty !== null && userQty > 0) {
            available = Math.min(userQty, ing.scaledQuantity);
            matchedCount++;
          }
        }

        const missing = Math.max(0, ing.scaledQuantity - available);
        let cost = 0;
        if (missing > 0) {
          cost = priceProvider.estimateCost(ing.ingredientId, missing, ing.unit).minVnd;
          slotCost += cost;
        }

        slotIngredients.push({
          ingredientId: ing.ingredientId,
          name: ing.name,
          category: (ing as any).category || 'other',
          requiredQuantity: ing.scaledQuantity,
          availableQuantity: available,
          missingQuantity: missing,
          unit: ing.unit,
          estimatedCostVnd: cost,
          fromFridge: available > 0,
        });
      }

      const availabilityPercent = scaled.length > 0
        ? Math.round((matchedCount / scaled.length) * 100)
        : 100;

      return {
        ...slot,
        recipe: newRecipe,
        source: 'USER' as const,
        isLocked: true, // Lock user choice from auto-overwrite
        availabilityPercent,
        incrementalCostVnd: slotCost,
        badges: availabilityPercent === 100 ? ['100% nguyên liệu có sẵn'] : ['Đã chọn'],
        ingredients: slotIngredients,
      };
    });

    return { ...day, slots: updatedSlots };
  });

  // Re-aggregate shopping requirements
  const allReqs: Array<{
    recipeId: string;
    recipeTitle: string;
    ingredientId: string;
    name: string;
    quantity: number;
    unit: any;
    category?: any;
  }> = [];

  for (const day of updatedDays) {
    for (const slot of day.slots) {
      if (slot.status === 'PLANNED' && slot.recipe) {
        for (const ing of slot.ingredients) {
          allReqs.push({
            recipeId: slot.recipe.id,
            recipeTitle: slot.recipe.title,
            ingredientId: ing.ingredientId,
            name: ing.name,
            quantity: ing.requiredQuantity,
            unit: ing.unit,
            category: ing.category,
          });
        }
      }
    }
  }

  const { shoppingItems, budget } = aggregateShoppingRequirements(
    allReqs,
    inventory,
    priceProvider,
    plan.budget.targetVnd
  );

  const usagePlans = allReqs.map((r) => ({
    ingredientId: r.ingredientId,
    plannedUsedQuantity: r.quantity,
  }));
  const utilization = calculateFridgeUtilization(inventory, usagePlans);

  return {
    ...plan,
    days: updatedDays,
    shoppingItems,
    budget,
    utilization,
    updatedAt: new Date().toISOString(),
  };
}
