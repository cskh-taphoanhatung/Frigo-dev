import type { Recipe } from './types';

/**
 * Pure, side-effect-free renderer for the historical `0006_vietnamese_recipe_bank.sql`
 * seed. It exists so tests can prove the committed migration still matches the static
 * catalog WITHOUT ever writing to `migrations/` or `packages/recipes/src`. Applied
 * migrations are immutable; only `scripts/render-recipe-seed.mjs` may write output,
 * and only outside `migrations/`.
 */

export const VIETNAMESE_SEED_MIGRATION_FILENAME = '0006_vietnamese_recipe_bank.sql';
export const GLOBAL_PARITY_MIGRATION_FILENAME = '0034_global_recipe_catalog_parity.sql';
/** Table that carries the runtime-only fields the foundation `RecipeDefinition` omits. */
export const RECIPE_RUNTIME_FIELDS_TABLE = 'recipe_runtime_fields';
/** Legacy `recipes.tags` markers 0006 used to smuggle category/region; hydration strips them. */
export const LEGACY_CATEGORY_TAG_PREFIX = 'cat:';
export const LEGACY_REGION_TAG_PREFIX = 'region:';

const SEED_INGREDIENT_ROWS: readonly string[] = [
  "('PORK_RIBS', 'Sườn heo / Sườn non', 'Pork ribs', 'meat', 'g', 3, '🍖'),",
  "('CRAB_MEAT', 'Cua đồng / Cua thịt', 'Crab meat / Field crab', 'seafood', 'g', 2, '🦀'),",
  "('SQUID', 'Mực tươi', 'Squid', 'seafood', 'g', 2, '🦑'),",
  "('FISH_FRESHWATER', 'Cá tươi (Cá lóc, điêu hồng, rô)', 'Freshwater fish', 'seafood', 'g', 2, '🐟'),",
  "('BITTER_MELON', 'Khổ qua / Mướp đắng', 'Bitter melon', 'vegetable', 'piece', 5, '🥒'),",
  "('WINTER_MELON', 'Bí đao', 'Winter melon', 'vegetable', 'piece', 10, '🍈'),",
  "('PUMPKIN', 'Bí đỏ', 'Pumpkin', 'vegetable', 'piece', 20, '🎃'),",
  "('PINEAPPLE', 'Dứa / Thơm', 'Pineapple', 'fruit', 'piece', 7, '🍍'),",
  "('BEAN_SPROUTS', 'Giá đỗ', 'Bean sprouts', 'vegetable', 'g', 3, '🌱'),",
  "('CHAYOTE', 'Su su', 'Chayote', 'vegetable', 'piece', 10, '🍐'),",
  "('LEMONGRASS', 'Sả tươi', 'Lemongrass', 'spice', 'piece', 14, '🌾'),",
  "('LIME', 'Chanh tươi', 'Lime', 'fruit', 'piece', 14, '🍋'),",
  "('RICE_PAPER', 'Bánh tráng cuốn', 'Rice paper', 'grain', 'pack', 180, '🫓'),",
  "('MUSHROOM', 'Nấm tươi / nấm hương', 'Mushroom', 'vegetable', 'g', 5, '🍄');",
];

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

/** Renders the exact SQL text of the Vietnamese recipe seed for the given recipes. */
export function renderVietnameseRecipeSeedSql(
  recipes: readonly Recipe[],
  images: Readonly<Record<string, string>>,
): string {
  const lines: string[] = [
    '-- Migration 0006: Vietnamese Recipe Bank (Curated Dishes across 10 Categories)',
    '-- Generated from @frigo/recipes canonical recipe catalog with distinct authentic dish photos',
    '',
    '-- 1. Ensure Canonical Ingredients exist',
    'INSERT OR IGNORE INTO ingredients (id, name_vi, name_en, category, default_unit, default_shelf_life_days, icon) VALUES',
    ...SEED_INGREDIENT_ROWS,
    '',
    '-- 2. Seed Vietnamese Recipes with Unique Authentic Photography',
    'INSERT INTO recipes (id, slug, title, description, cuisine, cook_time_minutes, servings, difficulty, image_url, tags) VALUES',
  ];

  recipes.forEach((recipe, index) => {
    const allTags = [
      ...(recipe.tags || []),
      `cat:${recipe.category || 'mon_khac'}`,
      `region:${recipe.region || 'toan_quoc'}`,
    ];
    const tagsJson = esc(JSON.stringify(allTags));
    const imageUrl = images[recipe.slug] || recipe.imageUrl;
    const isLast = index === recipes.length - 1;
    lines.push(
      `('${esc(recipe.id)}', '${esc(recipe.slug)}', '${esc(recipe.title)}', '${esc(recipe.description)}', '${esc(recipe.cuisine)}', ${recipe.cookTimeMinutes}, ${recipe.servings}, '${esc(recipe.difficulty)}', '${esc(imageUrl)}', '${tagsJson}')${isLast ? '' : ','}`,
    );
  });
  lines.push(`ON CONFLICT(id) DO UPDATE SET
  slug = excluded.slug,
  title = excluded.title,
  description = excluded.description,
  cuisine = excluded.cuisine,
  cook_time_minutes = excluded.cook_time_minutes,
  servings = excluded.servings,
  difficulty = excluded.difficulty,
  image_url = excluded.image_url,
  tags = excluded.tags;`);
  lines.push('');

  lines.push('-- 3. Seed Recipe Ingredients');
  lines.push(
    'INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, name, required_quantity, unit, is_optional) VALUES',
  );
  const ingredientRows: string[] = [];
  for (const recipe of recipes) {
    recipe.ingredients.forEach((line, lineIndex) => {
      const id = `${recipe.id}_ing_${lineIndex + 1}`;
      ingredientRows.push(
        `('${esc(id)}', '${esc(recipe.id)}', '${esc(line.ingredientId)}', '${esc(line.name)}', ${line.requiredQuantity}, '${esc(line.unit)}', ${line.isOptional ? 1 : 0})`,
      );
    });
  }
  lines.push(ingredientRows.join(',\n'));
  lines.push(`ON CONFLICT(id) DO UPDATE SET
  recipe_id = excluded.recipe_id,
  ingredient_id = excluded.ingredient_id,
  name = excluded.name,
  required_quantity = excluded.required_quantity,
  unit = excluded.unit,
  is_optional = excluded.is_optional;`);
  lines.push('');

  lines.push('-- 4. Seed Recipe Steps');
  lines.push(
    'INSERT INTO recipe_steps (id, recipe_id, step_number, instruction, tip, timer_minutes) VALUES',
  );
  const stepRows: string[] = [];
  for (const recipe of recipes) {
    for (const step of recipe.steps) {
      const id = `${recipe.id}_step_${step.stepNumber}`;
      const tip = step.tip ? `'${esc(step.tip)}'` : 'NULL';
      const timer = step.timerMinutes ? step.timerMinutes : 'NULL';
      stepRows.push(
        `('${esc(id)}', '${esc(recipe.id)}', ${step.stepNumber}, '${esc(step.instruction)}', ${tip}, ${timer})`,
      );
    }
  }
  lines.push(stepRows.join(',\n'));
  lines.push(`ON CONFLICT(id) DO UPDATE SET
  recipe_id = excluded.recipe_id,
  step_number = excluded.step_number,
  instruction = excluded.instruction,
  tip = excluded.tip,
  timer_minutes = excluded.timer_minutes;`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Returns the slugs whose source entry does not reference `VIETNAMESE_DISH_IMAGES['<slug>']`.
 * Operates on source text supplied by the caller; it never reads or writes files itself.
 */
export function findBankImageReferenceDrift(
  bankSource: string,
  recipes: readonly Recipe[],
): string[] {
  return recipes
    .filter((recipe) => {
      const pattern = new RegExp(
        `slug:\\s*'${recipe.slug}',[\\s\\S]*?imageUrl:\\s*VIETNAMESE_DISH_IMAGES\\['${recipe.slug}'\\]`,
      );
      return !pattern.test(bankSource);
    })
    .map((recipe) => recipe.slug);
}

const sqlText = (value: string | undefined | null) => (value === undefined || value === null ? 'NULL' : `'${esc(value)}'`);
const sqlNumber = (value: number | undefined | null) => (value === undefined || value === null ? 'NULL' : String(value));

/**
 * Renders the exact SQL text of the T14B-B parity migration: the 12 static-only global
 * recipes plus one `recipe_runtime_fields` row per runtime recipe. Pure: callers decide
 * whether to compare (`--check`) or write beneath `.artifacts/recipe-seed/`.
 *
 * Truthfulness rules: no `cat:`/`region:` marker is invented for recipes without a
 * category/region; provenance columns keep their schema defaults (legacy/unverified/1)
 * because no better evidence exists; macros land in the compatibility table, never in
 * `nutrition_profiles` (ADR-004/ADR-009 untouched).
 */
export function renderGlobalRecipeParitySql(
  globalRecipes: readonly Recipe[],
  allRecipes: readonly Recipe[],
): string {
  const allIds = new Set(allRecipes.map((recipe) => recipe.id));
  if (allIds.size !== allRecipes.length) throw new Error('Runtime catalog has duplicate recipe IDs');
  for (const recipe of globalRecipes) {
    if (!allIds.has(recipe.id)) throw new Error(`Global recipe ${recipe.id} is not part of the runtime catalog`);
    if (recipe.category !== undefined || recipe.region !== undefined) {
      throw new Error(`Global recipe ${recipe.id} carries category/region; encode it in recipe_runtime_fields, not tags`);
    }
  }
  for (const recipe of allRecipes) {
    for (const tag of recipe.tags) {
      if (tag.startsWith(LEGACY_CATEGORY_TAG_PREFIX) || tag.startsWith(LEGACY_REGION_TAG_PREFIX)) {
        throw new Error(`Recipe ${recipe.id} tag "${tag}" collides with a legacy marker prefix`);
      }
    }
  }

  const lines: string[] = [
    '-- Migration 0034: D1 catalog parity for the current 71-recipe runtime set (T14B-B).',
    '-- Rendered from @frigo/recipes ALL_RECIPES by renderGlobalRecipeParitySql; immutable once applied.',
    '--',
    '-- 1. The 12 global recipes (gl-01..gl-12) that 0006 never seeded, under their stable static IDs',
    '--    and slugs. ON CONFLICT upgrades a 7-column FK anchor row left behind by cooking/shopping',
    '--    into a complete entry without touching provenance columns (schema defaults',
    '--    legacy/unverified/1 are the only truthful values available).',
    '-- 2. recipe_runtime_fields: typed, queryable home for the runtime-only fields the foundation',
    '--    RecipeDefinition omits (category, region) plus LEGACY nutrition compatibility macros.',
    '--    Those macros are a compatibility projection of the static catalog, NOT nutrition_profiles',
    '--    evidence. recipes.image_url stays LEGACY_MEDIA_COMPATIBILITY_ONLY; media authority is T14C.',
    '-- 3. No historical migration, existing recipe row, inventory table or user data is modified.',
    '',
    'INSERT INTO recipes (id, slug, title, description, cuisine, cook_time_minutes, servings, difficulty, image_url, tags) VALUES',
  ];
  globalRecipes.forEach((recipe, index) => {
    const isLast = index === globalRecipes.length - 1;
    lines.push(
      `('${esc(recipe.id)}', '${esc(recipe.slug)}', '${esc(recipe.title)}', '${esc(recipe.description)}', '${esc(recipe.cuisine)}', ${recipe.cookTimeMinutes}, ${recipe.servings}, '${esc(recipe.difficulty)}', '${esc(recipe.imageUrl)}', '${esc(JSON.stringify(recipe.tags))}')${isLast ? '' : ','}`,
    );
  });
  lines.push(`ON CONFLICT(id) DO UPDATE SET
  slug = excluded.slug,
  title = excluded.title,
  description = excluded.description,
  cuisine = excluded.cuisine,
  cook_time_minutes = excluded.cook_time_minutes,
  servings = excluded.servings,
  difficulty = excluded.difficulty,
  image_url = excluded.image_url,
  tags = excluded.tags;`);
  lines.push('');

  lines.push('INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, name, required_quantity, unit, is_optional) VALUES');
  const ingredientRows: string[] = [];
  for (const recipe of globalRecipes) {
    recipe.ingredients.forEach((line, lineIndex) => {
      ingredientRows.push(
        `('${esc(`${recipe.id}_ing_${lineIndex + 1}`)}', '${esc(recipe.id)}', '${esc(line.ingredientId)}', '${esc(line.name)}', ${line.requiredQuantity}, '${esc(line.unit)}', ${line.isOptional ? 1 : 0})`,
      );
    });
  }
  lines.push(ingredientRows.join(',\n'));
  lines.push(`ON CONFLICT(id) DO UPDATE SET
  recipe_id = excluded.recipe_id,
  ingredient_id = excluded.ingredient_id,
  name = excluded.name,
  required_quantity = excluded.required_quantity,
  unit = excluded.unit,
  is_optional = excluded.is_optional;`);
  lines.push('');

  lines.push('INSERT INTO recipe_steps (id, recipe_id, step_number, instruction, tip, timer_minutes) VALUES');
  const stepRows: string[] = [];
  for (const recipe of globalRecipes) {
    for (const step of recipe.steps) {
      stepRows.push(
        `('${esc(`${recipe.id}_step_${step.stepNumber}`)}', '${esc(recipe.id)}', ${step.stepNumber}, '${esc(step.instruction)}', ${sqlText(step.tip)}, ${sqlNumber(step.timerMinutes)})`,
      );
    }
  }
  lines.push(stepRows.join(',\n'));
  lines.push(`ON CONFLICT(id) DO UPDATE SET
  recipe_id = excluded.recipe_id,
  step_number = excluded.step_number,
  instruction = excluded.instruction,
  tip = excluded.tip,
  timer_minutes = excluded.timer_minutes;`);
  lines.push('');

  lines.push(`CREATE TABLE IF NOT EXISTS ${RECIPE_RUNTIME_FIELDS_TABLE} (
  recipe_id TEXT PRIMARY KEY NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  category TEXT CHECK (category IS NULL OR length(trim(category)) > 0),
  region TEXT CHECK (region IS NULL OR region IN ('bac', 'trung', 'nam', 'toan_quoc')),
  legacy_calories REAL CHECK (legacy_calories IS NULL OR (legacy_calories >= 0 AND legacy_calories < 1e308)),
  legacy_protein_g REAL CHECK (legacy_protein_g IS NULL OR (legacy_protein_g >= 0 AND legacy_protein_g < 1e308)),
  legacy_fat_g REAL CHECK (legacy_fat_g IS NULL OR (legacy_fat_g >= 0 AND legacy_fat_g < 1e308)),
  legacy_carb_g REAL CHECK (legacy_carb_g IS NULL OR (legacy_carb_g >= 0 AND legacy_carb_g < 1e308)),
  CHECK (
    (legacy_calories IS NULL AND legacy_protein_g IS NULL AND legacy_fat_g IS NULL AND legacy_carb_g IS NULL) OR
    (legacy_calories IS NOT NULL AND legacy_protein_g IS NOT NULL AND legacy_fat_g IS NOT NULL AND legacy_carb_g IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_recipe_runtime_fields_category ON ${RECIPE_RUNTIME_FIELDS_TABLE}(category, recipe_id) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recipe_runtime_fields_region ON ${RECIPE_RUNTIME_FIELDS_TABLE}(region, recipe_id) WHERE region IS NOT NULL;`);
  lines.push('');
  lines.push(`INSERT INTO ${RECIPE_RUNTIME_FIELDS_TABLE} (recipe_id, category, region, legacy_calories, legacy_protein_g, legacy_fat_g, legacy_carb_g) VALUES`);
  lines.push(allRecipes.map((recipe) =>
    `('${esc(recipe.id)}', ${sqlText(recipe.category)}, ${sqlText(recipe.region)}, ${sqlNumber(recipe.nutrition?.calories)}, ${sqlNumber(recipe.nutrition?.proteinG)}, ${sqlNumber(recipe.nutrition?.fatG)}, ${sqlNumber(recipe.nutrition?.carbG)})`).join(',\n'));
  lines.push(`ON CONFLICT(recipe_id) DO UPDATE SET
  category = excluded.category,
  region = excluded.region,
  legacy_calories = excluded.legacy_calories,
  legacy_protein_g = excluded.legacy_protein_g,
  legacy_fat_g = excluded.legacy_fat_g,
  legacy_carb_g = excluded.legacy_carb_g;`);
  lines.push('');
  return lines.join('\n');
}
