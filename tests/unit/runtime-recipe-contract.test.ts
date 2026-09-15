import { describe, expect, it } from 'vitest';
import { CANONICAL_INGREDIENTS } from '../../packages/domain/src';
import { adaptStaticRecipeCatalog } from '../../packages/recipes/src/catalog';
import { ALL_RECIPES, GLOBAL_RECIPES, VIETNAMESE_RECIPES } from '../../packages/recipes/src/data';
import { RecipeDefinitionSchema } from '../../packages/recipes/src/foundation';
import {
  RUNTIME_ONLY_FIELDS,
  RUNTIME_RECIPE_FIELDS,
  RuntimeRecipeSchema,
  runtimeRecipeFieldDifferences,
  toRuntimeRecipe,
} from '../../packages/recipes/src/runtime-recipe';

describe('RuntimeRecipe contract (T14B-A)', () => {
  it('covers exactly the 71 static recipes that production serves today', () => {
    expect(ALL_RECIPES).toHaveLength(71);
    expect(VIETNAMESE_RECIPES).toHaveLength(59);
    expect(GLOBAL_RECIPES).toHaveLength(12);
    expect(new Set(ALL_RECIPES.map((recipe) => recipe.id)).size).toBe(71);
    expect(new Set(ALL_RECIPES.map((recipe) => recipe.slug)).size).toBe(71);
  });

  it('hydrates every static recipe losslessly: no runtime-visible field is dropped or altered', () => {
    for (const recipe of ALL_RECIPES) {
      const runtime = toRuntimeRecipe(recipe);
      expect(runtime).toEqual(recipe);
      expect(runtimeRecipeFieldDifferences(runtime, recipe)).toEqual([]);
      for (const field of RUNTIME_RECIPE_FIELDS) {
        expect(Object.prototype.hasOwnProperty.call(runtime, field)).toBe(
          Object.prototype.hasOwnProperty.call(recipe, field),
        );
      }
    }
  });

  it('preserves media reference, nutrition, steps with tips/timers, tags, category and region', () => {
    const withTip = ALL_RECIPES.find((recipe) => recipe.steps.some((step) => step.tip))!;
    const withTimer = ALL_RECIPES.find((recipe) => recipe.steps.some((step) => step.timerMinutes))!;
    const vietnamese = VIETNAMESE_RECIPES[0];
    for (const recipe of [withTip, withTimer, vietnamese]) {
      const runtime = toRuntimeRecipe(recipe);
      expect(runtime.imageUrl).toBe(recipe.imageUrl);
      expect(runtime.nutrition).toEqual(recipe.nutrition);
      expect(runtime.steps).toEqual(recipe.steps);
      expect(runtime.tags).toEqual(recipe.tags);
      expect(runtime.category).toBe(recipe.category);
      expect(runtime.region).toBe(recipe.region);
      expect(runtime.description).toBe(recipe.description);
      expect(runtime.ingredients).toEqual(recipe.ingredients);
    }
    expect(toRuntimeRecipe(withTip).steps.some((step) => step.tip)).toBe(true);
    expect(toRuntimeRecipe(withTimer).steps.some((step) => step.timerMinutes)).toBe(true);
    expect(ALL_RECIPES.every((recipe) => toRuntimeRecipe(recipe).nutrition !== undefined)).toBe(true);
  });

  it('rejects unknown fields so silent contract widening is impossible', () => {
    expect(RuntimeRecipeSchema.safeParse({ ...ALL_RECIPES[0], mediaId: 'x' }).success).toBe(false);
    expect(RuntimeRecipeSchema.safeParse({ ...ALL_RECIPES[0], imageUrl: undefined }).success).toBe(false);
  });

  it('documents exactly which runtime fields the foundation RecipeDefinition does not carry', () => {
    const foundationKeys = new Set(Object.keys(RecipeDefinitionSchema.shape));
    const missing = RUNTIME_RECIPE_FIELDS.filter((field) => !foundationKeys.has(field));
    expect([...missing].sort()).toEqual([...RUNTIME_ONLY_FIELDS].sort());

    // Static → foundation adaptation is lossy for precisely those fields (T14A F-04).
    const snapshot = adaptStaticRecipeCatalog(CANONICAL_INGREDIENTS, ALL_RECIPES);
    expect(snapshot.recipes).toHaveLength(71);
    for (const definition of snapshot.recipes) {
      for (const field of RUNTIME_ONLY_FIELDS) {
        expect(field in definition).toBe(false);
      }
    }
  });
});
