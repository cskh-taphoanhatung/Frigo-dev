import { RECIPE_RUNTIME_FIELDS_TABLE, RECIPE_RUNTIME_INGREDIENT_ORDER_TABLE } from '../seed-render';
import type { NormalizedImportRecipe } from './types';

/**
 * Deterministic SQL renderer for a reviewed import batch (T14E). Output is a CANDIDATE for a future
 * numbered migration (T14F promotion); the compiler only writes it beneath `.artifacts/`.
 *
 * Safety properties:
 *  - one literal renderer (`sqlText`) — every string is quoted with `'` doubled; numbers are
 *    emitted only after `Number.isFinite`; no other interpolation exists, so hostile text cannot
 *    alter SQL structure;
 *  - plain `INSERT` (no `ON CONFLICT DO UPDATE`): a colliding ID/slug aborts the migration instead
 *    of silently overwriting a reviewed recipe. Legacy FK-anchor upgrade is deliberately NOT
 *    generalized here (see docs: imported IDs use the `imp-` namespace, so a stub cannot collide);
 *  - complete runtime rows: recipes (with provenance), recipe_ingredients, recipe_steps,
 *    recipe_runtime_fields (runtime_order = releaseBase + batchOrder), recipe_runtime_ingredient_order,
 *    recipe_classifications, and a truthful PENDING hero media slot (prerequisite migration 0035).
 */

export const IMPORT_SQL_MINIMUM_PREREQUISITE_MIGRATION = '0035_recipe_media_layer.sql';

export function sqlText(value: string): string {
  if (value.includes('\u0000')) throw new Error('SQL text literal cannot contain NUL');
  return `'${value.replace(/'/g, "''")}'`;
}
export function sqlTextOrNull(value: string | null | undefined): string {
  return value === undefined || value === null ? 'NULL' : sqlText(value);
}
export function sqlNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error('SQL number literal must be finite');
  return String(value);
}
export function sqlNumberOrNull(value: number | null | undefined): string {
  return value === undefined || value === null ? 'NULL' : sqlNumber(value);
}

export interface RenderImportSqlInput {
  batchId: string;
  batchHash: string;
  /** Number of recipes in the release BEFORE this batch (legacy 71 + earlier approved batches). */
  releaseBaseCount: number;
  recipes: readonly NormalizedImportRecipe[];
}

function ordered(recipes: readonly NormalizedImportRecipe[]): NormalizedImportRecipe[] {
  const sorted = [...recipes].sort((a, b) => a.batchOrder - b.batchOrder);
  sorted.forEach((recipe, index) => {
    if (recipe.batchOrder !== index) throw new Error(`batchOrder must be exactly 0..N-1; found ${recipe.batchOrder} at position ${index}`);
  });
  return sorted;
}

/** Renders the complete data-only SQL for one reviewed batch. Empty batch ⇒ header only. */
export function renderImportBatchSql(input: RenderImportSqlInput): string {
  const recipes = ordered(input.recipes);
  const lines: string[] = [
    `-- Recipe import batch ${input.batchId} (T14E factory render; candidate for a future numbered migration).`,
    `-- batch_hash=${input.batchHash} recipes=${recipes.length} runtime_order=${input.releaseBaseCount}..${input.releaseBaseCount + recipes.length - 1}`,
    `-- Prerequisite: canonical migration ordering through ${IMPORT_SQL_MINIMUM_PREREQUISITE_MIGRATION} (recipe_media, recipe_runtime_fields,`,
    '-- recipe_runtime_ingredient_order must exist). Plain INSERT: any ID/slug collision aborts instead of overwriting.',
    '-- Data-only: no schema change, no historical migration, recipe row, inventory table or user data is modified.',
    '',
  ];
  if (recipes.length === 0) return lines.join('\n');

  lines.push('INSERT INTO recipes (id, slug, title, description, cuisine, cook_time_minutes, servings, difficulty, image_url, tags, source_type, source_reference, verification_state, version) VALUES');
  lines.push(recipes.map((recipe) => {
    const r = recipe.runtime; const p = recipe.provenance;
    return `(${sqlText(r.id)}, ${sqlText(r.slug)}, ${sqlText(r.title)}, ${sqlText(r.description)}, ${sqlText(r.cuisine)}, ${sqlNumber(r.cookTimeMinutes)}, ${sqlNumber(r.servings)}, ${sqlText(r.difficulty)}, ${sqlText(r.imageUrl)}, ${sqlText(JSON.stringify(r.tags))}, ${sqlText(p.sourceType)}, ${sqlText(p.sourceReference)}, ${sqlText(p.verificationState)}, ${sqlNumber(p.version)})`;
  }).join(',\n') + ';');
  lines.push('');

  lines.push('INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, name, required_quantity, unit, is_optional) VALUES');
  const ingredientRows: string[] = [];
  for (const recipe of recipes) {
    recipe.runtime.ingredients.forEach((line, index) => {
      ingredientRows.push(`(${sqlText(`${recipe.runtime.id}_ing_${index + 1}`)}, ${sqlText(recipe.runtime.id)}, ${sqlText(line.ingredientId)}, ${sqlText(line.name)}, ${sqlNumber(line.requiredQuantity)}, ${sqlText(line.unit)}, ${line.isOptional ? 1 : 0})`);
    });
  }
  lines.push(ingredientRows.join(',\n') + ';');
  lines.push('');

  lines.push('INSERT INTO recipe_steps (id, recipe_id, step_number, instruction, tip, timer_minutes) VALUES');
  const stepRows: string[] = [];
  for (const recipe of recipes) {
    for (const step of recipe.runtime.steps) {
      stepRows.push(`(${sqlText(`${recipe.runtime.id}_step_${step.stepNumber}`)}, ${sqlText(recipe.runtime.id)}, ${sqlNumber(step.stepNumber)}, ${sqlText(step.instruction)}, ${sqlTextOrNull(step.tip)}, ${sqlNumberOrNull(step.timerMinutes)})`);
    }
  }
  lines.push(stepRows.join(',\n') + ';');
  lines.push('');

  lines.push(`INSERT INTO ${RECIPE_RUNTIME_FIELDS_TABLE} (recipe_id, runtime_order, category, region, legacy_calories, legacy_protein_g, legacy_fat_g, legacy_carb_g) VALUES`);
  lines.push(recipes.map((recipe) => {
    const r = recipe.runtime;
    return `(${sqlText(r.id)}, ${sqlNumber(input.releaseBaseCount + recipe.batchOrder)}, ${sqlTextOrNull(r.category)}, ${sqlTextOrNull(r.region)}, ${sqlNumberOrNull(r.nutrition?.calories)}, ${sqlNumberOrNull(r.nutrition?.proteinG)}, ${sqlNumberOrNull(r.nutrition?.fatG)}, ${sqlNumberOrNull(r.nutrition?.carbG)})`;
  }).join(',\n') + ';');
  lines.push('');

  lines.push(`INSERT INTO ${RECIPE_RUNTIME_INGREDIENT_ORDER_TABLE} (recipe_ingredient_id, recipe_id, position) VALUES`);
  const orderRows: string[] = [];
  for (const recipe of recipes) {
    recipe.runtime.ingredients.forEach((_line, position) => {
      orderRows.push(`(${sqlText(`${recipe.runtime.id}_ing_${position + 1}`)}, ${sqlText(recipe.runtime.id)}, ${sqlNumber(position)})`);
    });
  }
  lines.push(orderRows.join(',\n') + ';');
  lines.push('');

  const classificationRows: string[] = [];
  for (const recipe of recipes) {
    for (const entry of recipe.classifications) classificationRows.push(`(${sqlText(recipe.runtime.id)}, ${sqlText(entry.kind)}, ${sqlText(entry.tag)})`);
  }
  if (classificationRows.length) {
    lines.push('INSERT INTO recipe_classifications (recipe_id, kind, tag) VALUES');
    lines.push(classificationRows.join(',\n') + ';');
    lines.push('');
  }

  lines.push('-- Truthful PENDING hero slots (T14C): no bytes, no storage key, no hash. Promotion to ready happens only after verified R2 upload.');
  lines.push('INSERT INTO recipe_media (id, recipe_id, role, version, status) VALUES');
  lines.push(recipes.map((recipe) => `(${sqlText(`${recipe.runtime.id}_media_hero_v1`)}, ${sqlText(recipe.runtime.id)}, 'hero', 1, 'pending')`).join(',\n') + ';');
  lines.push('');
  return lines.join('\n');
}
