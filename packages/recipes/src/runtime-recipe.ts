import { z } from 'zod';
import { StandardUnitSchema } from '../../domain/src/foundation';
import type { Recipe } from './types';

/**
 * RuntimeRecipe is the COMPLETE shape every production-enabled recipe flow consumes today
 * (`GET /recipes`, recommendations, Week v1 planner/snapshots, cooking, offline client).
 * It is deliberately separate from the narrower foundation `RecipeDefinition`, which is the
 * normalized catalog/planning contract and intentionally omits presentation/content fields.
 *
 * Structurally `RuntimeRecipe` equals the legacy `Recipe` interface; the schema below is the
 * formal, test-enforced statement of which fields are runtime-visible and must survive any
 * future D1-backed reader losslessly. Media stays a plain `imageUrl` string here on purpose:
 * recipe media architecture is deferred to T14C and this contract must not pre-empt it.
 */

export const RUNTIME_RECIPE_CUISINES = ['vietnamese', 'korean', 'japanese', 'chinese', 'thai', 'italian'] as const;
export const RUNTIME_RECIPE_REGIONS = ['bac', 'trung', 'nam', 'toan_quoc'] as const;

export const RuntimeRecipeIngredientSchema = z.object({
  ingredientId: z.string().min(1),
  name: z.string().min(1),
  requiredQuantity: z.number().finite(),
  unit: StandardUnitSchema,
  isOptional: z.boolean().optional(),
}).strict();

export const RuntimeRecipeStepSchema = z.object({
  stepNumber: z.number().int(),
  instruction: z.string().min(1),
  tip: z.string().optional(),
  timerMinutes: z.number().optional(),
}).strict();

export const RuntimeRecipeNutritionSchema = z.object({
  calories: z.number(),
  proteinG: z.number(),
  fatG: z.number(),
  carbG: z.number(),
}).strict();

export const RuntimeRecipeSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  cuisine: z.enum(RUNTIME_RECIPE_CUISINES),
  category: z.string().optional(),
  region: z.enum(RUNTIME_RECIPE_REGIONS).optional(),
  cookTimeMinutes: z.number(),
  servings: z.number(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  imageUrl: z.string(),
  nutrition: RuntimeRecipeNutritionSchema.optional(),
  ingredients: z.array(RuntimeRecipeIngredientSchema),
  steps: z.array(RuntimeRecipeStepSchema),
  tags: z.array(z.string()),
}).strict();

export type RuntimeRecipe = z.infer<typeof RuntimeRecipeSchema>;

/** Every runtime-visible top-level field. Tests use this list to prove lossless round-trips. */
export const RUNTIME_RECIPE_FIELDS = Object.freeze(Object.keys(RuntimeRecipeSchema.shape) as Array<keyof RuntimeRecipe>);

/**
 * Fields the foundation `RecipeDefinition` does NOT carry. Any future D1 runtime-view reader
 * must source these from somewhere other than the foundation catalog contract.
 */
export const RUNTIME_ONLY_FIELDS = Object.freeze([
  'category', 'region', 'imageUrl', 'nutrition', 'steps', 'tags',
] as const satisfies readonly (keyof RuntimeRecipe)[]);

// Compile-time proof that the legacy runtime interface and the formal contract coincide.
type Assert<T extends true> = T;
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type _RuntimeRecipeMatchesLegacyRecipe = Assert<MutuallyAssignable<RuntimeRecipe, Recipe>>;

/** Validates a static/legacy recipe against the runtime contract without altering it. */
export function toRuntimeRecipe(recipe: Recipe): RuntimeRecipe {
  return RuntimeRecipeSchema.parse(recipe);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).filter((key) => row[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${stable(row[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Field names whose values differ between two runtime recipes (deterministic order). */
export function runtimeRecipeFieldDifferences(left: RuntimeRecipe, right: RuntimeRecipe): Array<keyof RuntimeRecipe> {
  return RUNTIME_RECIPE_FIELDS.filter((field) => stable(left[field]) !== stable(right[field]));
}
