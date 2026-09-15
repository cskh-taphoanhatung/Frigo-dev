import type { Recipe } from './types';

/**
 * Pure, side-effect-free renderer for the historical `0006_vietnamese_recipe_bank.sql`
 * seed. It exists so tests can prove the committed migration still matches the static
 * catalog WITHOUT ever writing to `migrations/` or `packages/recipes/src`. Applied
 * migrations are immutable; only `scripts/render-recipe-seed.mjs` may write output,
 * and only outside `migrations/`.
 */

export const VIETNAMESE_SEED_MIGRATION_FILENAME = '0006_vietnamese_recipe_bank.sql';

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
