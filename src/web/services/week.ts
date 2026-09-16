import { ALL_RECIPES } from '@frigo/recipes';
import {
  type MealPlan, type MealPlanSetupInput, type MealSwapAlternative,
  generateWeeklyMealPlan, swapMealInPlan, getSwapAlternatives,
  findCanonicalIngredient, computeFreshness, tryConvertUnit,
} from '@frigo/domain';
import { privateCacheKey } from '../lib/private-session';
import {
  fetchJson, isOffline, queueWrite, getHouseholdId, createClientItemId,
  createDeterministicKey, readCachedInventory, guardPrivateSession, weekPlanCacheKey,
} from './http';
import { inventoryApi } from './inventory';

export const weekApi = {
  getCurrentWeekPlan: async (): Promise<MealPlan | null> => {
    const assertCurrent = guardPrivateSession();
    try {
      const res = await fetchJson<{ plan: MealPlan }>('/week/current');
      assertCurrent();
      if (res.plan) {
        localStorage.setItem(weekPlanCacheKey(), JSON.stringify(res.plan));
      } else {
        localStorage.removeItem(weekPlanCacheKey());
      }
      return res.plan;
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      // Local fallback
      const cached = localStorage.getItem(weekPlanCacheKey());
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // ignore
        }
      }
      return null;
    }
  },

  createWeekPlan: async (input: MealPlanSetupInput): Promise<MealPlan> => {
    const assertCurrent = guardPrivateSession();
    const commandId = createClientItemId('week_plan');
    const planInput: MealPlanSetupInput = {
      ...input,
      planId: input.planId || `plan_${commandId}`,
    };
    const body = JSON.stringify({ ...planInput, commandId });
    const headers = { 'Idempotency-Key': commandId };
    try {
      const res = await fetchJson<{ plan: MealPlan }>('/week/plans', {
        method: 'POST',
        body,
        headers,
      });
      assertCurrent();
      localStorage.setItem(weekPlanCacheKey(), JSON.stringify(res.plan));
      return res.plan;
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      // Genuine offline: the deterministic domain engine can build the plan locally.
      const currentInv = await inventoryApi.getInventory();
      assertCurrent();
      const plan = generateWeeklyMealPlan(planInput, currentInv, ALL_RECIPES);
      localStorage.setItem(weekPlanCacheKey(), JSON.stringify(plan));
      queueWrite(
        '/week/plans',
        'POST',
        body,
        'Tạo thực đơn tuần',
        `week-plan:${commandId}`,
        headers
      );
      return plan;
    }
  },

  getWeekPlan: async (id: string): Promise<MealPlan | null> => {
    const assertCurrent = guardPrivateSession();
    try {
      const res = await fetchJson<{ plan: MealPlan }>(`/week/plans/${id}`);
      assertCurrent();
      return res.plan;
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      const cached = localStorage.getItem(weekPlanCacheKey());
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.id === id || !id) return parsed;
        } catch {
          // ignore
        }
      }
      return null;
    }
  },

  swapMeal: async (
    planId: string,
    mealId: string,
    recipeId?: string
  ): Promise<{ plan?: MealPlan; alternatives?: MealSwapAlternative[] }> => {
    const assertCurrent = guardPrivateSession();
    const commandId = recipeId ? createClientItemId('week_swap') : undefined;
    const body = JSON.stringify({ recipeId, ...(commandId ? { commandId } : {}) });
    const headers = commandId ? { 'Idempotency-Key': commandId } : undefined;
    try {
      const res = await fetchJson<{ plan?: MealPlan; alternatives?: MealSwapAlternative[] }>(
        `/week/plans/${planId}/meals/${mealId}/swap`,
        {
          method: 'POST',
          body,
          headers,
        }
      );
      assertCurrent();
      if (res.plan) {
        localStorage.setItem(weekPlanCacheKey(), JSON.stringify(res.plan));
      }
      return res;
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err; // surface real server errors
      if (recipeId) {
        // Preserve an offline user choice for the next reconnect. The plan
        // snapshot is still updated optimistically below.
        queueWrite(
          `/week/plans/${planId}/meals/${mealId}/swap`,
          'POST',
          body,
          'Đổi món trong thực đơn tuần',
          `week-swap:${planId}:${mealId}:${commandId}`,
          headers
        );
      }
      // Standalone client fallback (offline): apply the deterministic swap locally.
      const cached = localStorage.getItem(weekPlanCacheKey());
      if (cached) {
        const plan: MealPlan = JSON.parse(cached);
        let targetSlot: any;
        for (const day of plan.days) {
          const s = day.slots.find((slot) => slot.id === mealId);
          if (s) {
            targetSlot = s;
            break;
          }
        }

        if (!recipeId && targetSlot) {
          const alternatives = getSwapAlternatives(targetSlot, [], ALL_RECIPES);
          return { alternatives };
        }

        if (recipeId) {
          const newRec = ALL_RECIPES.find((r) => r.id === recipeId || r.slug === recipeId);
          if (newRec) {
            const currentInv = await inventoryApi.getInventory();
            assertCurrent();
            const updated = swapMealInPlan(plan, mealId, newRec, currentInv);
            localStorage.setItem(weekPlanCacheKey(), JSON.stringify(updated));
            return { plan: updated };
          }
        }
      }
      return {};
    }
  },

  updateMealSlot: async (planId: string, mealId: string, updates: any): Promise<MealPlan | null> => {
    const assertCurrent = guardPrivateSession();
    const commandId = createClientItemId('week_slot');
    const body = JSON.stringify(updates);
    const headers = { 'Idempotency-Key': commandId };
    try {
      const res = await fetchJson<{ plan: MealPlan }>(`/week/plans/${planId}/meals/${mealId}`, {
        method: 'PATCH',
        body,
        headers,
      });
      assertCurrent();
      localStorage.setItem(weekPlanCacheKey(), JSON.stringify(res.plan));
      return res.plan;
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      queueWrite(
        `/week/plans/${planId}/meals/${mealId}`,
        'PATCH',
        body,
        'Cập nhật bữa ăn trong thực đơn tuần',
        `week-slot:${planId}:${mealId}:${commandId}`,
        headers
      );
      const cached = localStorage.getItem(weekPlanCacheKey());
      if (cached) {
        const plan: MealPlan = JSON.parse(cached);
        for (const day of plan.days) {
          const s = day.slots.find((slot) => slot.id === mealId);
          if (s) {
            Object.assign(s, updates);
            s.source = 'USER';
            break;
          }
        }
        localStorage.setItem(weekPlanCacheKey(), JSON.stringify(plan));
        return plan;
      }
      return null;
    }
  },

  getWeekShopping: async (planId: string) => {
    const assertCurrent = guardPrivateSession();
    try {
      const result = await fetchJson<any>(`/week/plans/${planId}/shopping`);
      assertCurrent();
      return result;
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      const cached = localStorage.getItem(weekPlanCacheKey());
      if (cached) {
        const plan: MealPlan = JSON.parse(cached);
        return {
          planId,
          items: plan.shoppingItems,
          budget: plan.budget,
          totalCount: plan.shoppingItems.length,
          checkedCount: plan.shoppingItems.filter((i) => i.checked).length,
        };
      }
      return { items: [], totalCount: 0, checkedCount: 0 };
    }
  },

  toggleWeekShoppingItem: async (planId: string, itemId: string, checked: boolean) => {
    const assertCurrent = guardPrivateSession();
    const commandId = createClientItemId('week_shop_toggle');
    const body = JSON.stringify({ checked });
    const headers = { 'Idempotency-Key': commandId };
    try {
      await fetchJson(`/week/plans/${planId}/shopping/items/${itemId}`, {
        method: 'PATCH',
        body,
        headers,
      });
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      queueWrite(
        `/week/plans/${planId}/shopping/items/${itemId}`,
        'PATCH',
        body,
        'Cập nhật danh sách mua của thực đơn tuần',
        `week-shopping-toggle:${planId}:${itemId}:${commandId}`,
        headers
      );
      // Local storage fallback (offline)
      const cached = localStorage.getItem(weekPlanCacheKey());
      if (cached) {
        const plan: MealPlan = JSON.parse(cached);
        const item = plan.shoppingItems.find((i) => i.ingredientId === itemId);
        if (item) item.checked = checked;
        localStorage.setItem(weekPlanCacheKey(), JSON.stringify(plan));
      }
    }
  },

  completeWeekShopping: async (planId: string, itemsToImport?: any[], commandId?: string) => {
    const assertCurrent = guardPrivateSession();
    const cached = localStorage.getItem(weekPlanCacheKey());
    let cachedPlan: MealPlan | null = null;
    if (cached) {
      try {
        cachedPlan = JSON.parse(cached) as MealPlan;
      } catch {
        cachedPlan = null;
      }
    }
    const selectedItems = itemsToImport || cachedPlan?.shoppingItems.filter((item) => item.checked) || [];
    const stableCommandId =
      commandId ||
      createDeterministicKey(
        'week_shop',
        JSON.stringify({
          planId,
          items: selectedItems
            .map((item) => ({
              ingredientId: item.ingredientId,
              quantity: item.recommendedPurchaseQuantity || item.missingQuantity || 1,
              unit: item.unit,
            }))
            .sort((a, b) => a.ingredientId.localeCompare(b.ingredientId)),
        })
      );
    const body = JSON.stringify({ items: selectedItems, commandId: stableCommandId });
    const headers = { 'Idempotency-Key': stableCommandId };
    try {
      return await fetchJson<any>(`/week/plans/${planId}/shopping/complete`, {
        method: 'POST',
        body,
        headers,
      });
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      queueWrite(
        `/week/plans/${planId}/shopping/complete`,
        'POST',
        body,
        'Nhập hàng theo thực đơn tuần',
        `week-shopping-complete:${planId}:${stableCommandId}`,
        headers
      );

      // Apply one deterministic optimistic projection. The queued command is
      // the only server mutation, so replay cannot create one row per item.
      if (selectedItems.length > 0) {
        const householdId = getHouseholdId();
        const currentInventory = readCachedInventory(householdId);
        const nextInventory = [...currentInventory];
        selectedItems.forEach((item: any) => {
          const stableIngredient = String(item.ingredientId || item.name)
            .replace(/[^A-Za-z0-9_-]/g, '_')
            .slice(0, 80);
          const quantity = Number(item.recommendedPurchaseQuantity || item.missingQuantity || 1);
          const canonical = findCanonicalIngredient(String(item.ingredientId || item.name));
          const unit = item.unit || canonical?.defaultUnit || 'piece';
          const id = `shop_import_${planId}_${stableIngredient}`;
          const existingIndex = nextInventory.findIndex((entry: any) => {
            const sameIngredient =
              (entry.ingredientId && (entry.ingredientId === (canonical?.id || item.ingredientId))) ||
              String(entry.name || '').trim().toLowerCase() === String(item.name || '').trim().toLowerCase();
            return Boolean(sameIngredient) && tryConvertUnit(quantity, unit, entry.unit) !== null;
          });
          const projection = {
            id,
            householdId,
            ingredientId: canonical?.id || item.ingredientId || '',
            name: item.name,
            quantity,
            unit,
            category: item.category || canonical?.category || 'other',
            storage: item.storage || 'fridge',
            freshness: computeFreshness(undefined),
            addedDate: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            dataSource: 'shopping',
            pendingSync: true,
          };
          if (existingIndex >= 0) {
            const existing = nextInventory[existingIndex];
            const converted = tryConvertUnit(quantity, unit, existing.unit);
            nextInventory[existingIndex] = {
              ...existing,
              quantity: Number(existing.quantity || 0) + (converted ?? quantity),
              freshness: 'fresh',
              updatedAt: projection.updatedAt,
              pendingSync: true,
            };
          } else {
            nextInventory.unshift(projection);
          }
        });
        localStorage.setItem(privateCacheKey('inventory', householdId), JSON.stringify(nextInventory));
      }
      return {
        success: true,
        importedItemsCount: selectedItems.length,
        pendingSync: true,
        message: `Đã lưu ${selectedItems.length} nguyên liệu vào tủ lạnh (sẽ đồng bộ khi có mạng).`,
      };
    }
  },

  getWeekPreferences: async () => {
    const assertCurrent = guardPrivateSession();
    try {
      const res = await fetchJson<{ preferences: any }>('/week/preferences');
      assertCurrent();
      return res.preferences;
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      return null;
    }
  },

  updateWeekPreferences: async (prefs: any) => {
    const assertCurrent = guardPrivateSession();
    const commandId = createClientItemId('week_preferences');
    const body = JSON.stringify(prefs);
    const headers = { 'Idempotency-Key': commandId };
    try {
      return await fetchJson('/week/preferences', {
        method: 'PATCH',
        body,
        headers,
      });
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      queueWrite(
        '/week/preferences',
        'PATCH',
        body,
        'Cập nhật tùy chọn thực đơn tuần',
        `week-preferences:${commandId}`,
        headers
      );
      return { success: true, preferences: prefs, pendingSync: true };
    }
  },
};
