import type { D1RecipeContentSnapshot } from '../../recipes/src/catalog-drift';
import type { D1DatabaseBinding, D1PreparedStatement, D1Result } from './index';

/**
 * Read-only projection of D1 recipe CONTENT tables (image_url, tags, steps, nutrition links,
 * T14B-B runtime fields) for the drift audit and the shadow runtime hydrator. It has no write
 * path and no production request path consumes it while `ALL_RECIPES` remains authority; the
 * foundation `readRecipeCatalog` remains the planner's catalog reader.
 *
 * Exactly five bulk SELECTs in one D1 batch, whatever the catalog size: never one query per
 * recipe. Mapping is O(rows); grouping by recipe happens in the consumers via ID-keyed maps.
 */

export const RECIPE_CONTENT_READ_STATEMENT_COUNT = 5;

export function prepareRecipeContentRead(db: D1DatabaseBinding): D1PreparedStatement[] {
  return [
    db.prepare(
      `SELECT id, slug, title, description, cuisine, servings, cook_time_minutes, difficulty, image_url, tags,
          prep_time_minutes, family_id, source_type, source_reference, verification_state, version
       FROM recipes ORDER BY id`,
    ),
    db.prepare(
      `SELECT id, recipe_id, ingredient_id, name, required_quantity, unit, is_optional
       FROM recipe_ingredients ORDER BY recipe_id, id`,
    ),
    db.prepare(
      `SELECT recipe_id, step_number, instruction, tip, timer_minutes
       FROM recipe_steps ORDER BY recipe_id, step_number, id`,
    ),
    db.prepare('SELECT DISTINCT recipe_id FROM recipe_nutrition ORDER BY recipe_id'),
    db.prepare(
      `SELECT recipe_id, category, region, legacy_calories, legacy_protein_g, legacy_fat_g, legacy_carb_g
       FROM recipe_runtime_fields ORDER BY recipe_id`,
    ),
  ];
}

function rowsOf(result: D1Result<unknown>, label: string): Record<string, unknown>[] {
  if (!result.success) throw new Error(`Recipe content ${label} read failed`);
  return result.results.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Recipe content ${label} row is invalid`);
    return row as Record<string, unknown>;
  });
}
const text = (value: unknown): string => (typeof value === 'string' ? value : String(value ?? ''));
const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value));
const numOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : num(value));
function parseTags(value: unknown): string[] | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((tag) => typeof tag === 'string') ? parsed : null;
  } catch {
    return null;
  }
}

/** Maps exactly the statement slice returned by {@link prepareRecipeContentRead}. */
export function mapRecipeContentRead(results: readonly D1Result<unknown>[]): D1RecipeContentSnapshot {
  if (results.length !== RECIPE_CONTENT_READ_STATEMENT_COUNT) {
    throw new Error('Recipe content batch returned an unexpected result count');
  }
  const [recipeRows, lineRows, stepRows, nutritionRows, runtimeFieldRows] = results.map((result, index) =>
    rowsOf(result, ['recipes', 'recipe ingredients', 'recipe steps', 'recipe nutrition', 'recipe runtime fields'][index]));
  return {
    recipes: recipeRows.map((row) => ({
      id: text(row.id), slug: text(row.slug), title: text(row.title), description: textOrNull(row.description),
      cuisine: text(row.cuisine), servings: num(row.servings), cookTimeMinutes: num(row.cook_time_minutes),
      difficulty: text(row.difficulty), imageUrl: textOrNull(row.image_url), tags: parseTags(row.tags),
      prepTimeMinutes: numOrNull(row.prep_time_minutes), familyId: textOrNull(row.family_id),
      provenance: {
        sourceType: text(row.source_type), sourceReference: textOrNull(row.source_reference),
        verificationState: text(row.verification_state), version: num(row.version),
      },
    })),
    requirements: lineRows.map((row) => ({
      id: text(row.id), recipeId: text(row.recipe_id), ingredientId: text(row.ingredient_id), name: text(row.name),
      requiredQuantity: num(row.required_quantity), unit: text(row.unit),
      isOptional: row.is_optional === 1 || row.is_optional === true,
    })),
    steps: stepRows.map((row) => ({
      recipeId: text(row.recipe_id), stepNumber: num(row.step_number), instruction: text(row.instruction),
      tip: textOrNull(row.tip), timerMinutes: numOrNull(row.timer_minutes),
    })),
    nutritionRecipeIds: nutritionRows.map((row) => text(row.recipe_id)),
    runtimeFields: runtimeFieldRows.map((row) => ({
      recipeId: text(row.recipe_id), category: textOrNull(row.category), region: textOrNull(row.region),
      legacyNutrition: row.legacy_calories === null || row.legacy_calories === undefined ? null : {
        calories: num(row.legacy_calories), proteinG: num(row.legacy_protein_g),
        fatG: num(row.legacy_fat_g), carbG: num(row.legacy_carb_g),
      },
    })),
  };
}

/** Reads the D1 recipe content projection in one read-only batch. */
export async function readRecipeContent(db: D1DatabaseBinding): Promise<D1RecipeContentSnapshot> {
  return mapRecipeContentRead(await db.batch(prepareRecipeContentRead(db)));
}
