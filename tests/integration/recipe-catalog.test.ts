import { afterEach, describe, expect, it } from 'vitest';
import { CANONICAL_INGREDIENTS } from '../../packages/domain/src';
import { readRecipeCatalog } from '../../packages/db/src/recipe-catalog';
import {
  adaptStaticRecipeCatalog,
  auditRecipeCatalogs,
  createRecipeCatalog,
} from '../../packages/recipes/src/catalog';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { SqliteD1, type SqliteStatementEvent } from '../helpers/sqlite-d1';

const recipe = {
  id: 'catalog_recipe',
  slug: 'catalog-recipe',
  title: 'Catalog recipe',
  cuisine: 'vietnamese',
  servings: 2,
  cookTimeMinutes: 10,
  difficulty: 'easy',
  ingredients: [
    {
      ingredientId: 'CHICKEN_BREAST',
      name: 'Chicken breast',
      requiredQuantity: 200,
      unit: 'g',
    },
  ],
};

describe('read-only recipe catalog adapters', () => {
  const databases: SqliteD1[] = [];
  const database = () => {
    const db = new SqliteD1();
    databases.push(db);
    return db;
  };

  afterEach(() => {
    for (const db of databases.splice(0)) db.close();
  });

  it('adapts the unchanged static catalog through explicit legacy provenance', () => {
    const snapshot = adaptStaticRecipeCatalog(CANONICAL_INGREDIENTS, ALL_RECIPES);

    expect(snapshot).toMatchObject({
      source: 'static',
      ingredientIds: [...CANONICAL_INGREDIENTS.map((ingredient) => ingredient.id)].sort(),
    });
    expect(snapshot.recipes).toHaveLength(ALL_RECIPES.length);
    expect(snapshot.recipes.every((item) => item.provenance.sourceType === 'legacy')).toBe(true);
    expect(
      snapshot.recipes.every((item) => item.provenance.verificationState === 'unverified'),
    ).toBe(true);
    expect(snapshot.diagnostics).toEqual([]);
  });

  it('keeps valid provided entries while excluding conflicting, invalid, and unknown references', () => {
    const snapshot = createRecipeCatalog({
      source: 'provided',
      ingredientIds: ['CHICKEN_BREAST', 'CHICKEN_BREAST', 'broken id'],
      recipes: [
        recipe,
        { ...recipe, title: 'Conflicting duplicate ID' },
        {
          ...recipe,
          id: 'unknown_recipe',
          slug: 'unknown-recipe',
          ingredients: [{ ...recipe.ingredients[0], ingredientId: 'UNKNOWN' }],
        },
        { ...recipe, id: 'bad_recipe', slug: 'bad-recipe', servings: 0 },
      ],
      families: [
        {
          id: 'bad_family',
          slug: 'bad-family',
          name: 'Bad family',
          baseServings: 2,
          slots: [
            {
              key: 'protein',
              minSelections: 1,
              maxSelections: 1,
              options: [{ ingredientId: 'UNKNOWN', quantity: 100, unit: 'g' }],
            },
          ],
        },
      ],
    });

    expect(snapshot.ingredientIds).toEqual(['CHICKEN_BREAST']);
    expect(snapshot.recipes).toEqual([]);
    expect(snapshot.families).toEqual([]);
    expect(snapshot.diagnostics.map((item) => item.code)).toEqual([
      'duplicate_recipe_id',
      'invalid_ingredient_id',
      'invalid_recipe',
      'unknown_family_ingredient',
      'unknown_recipe_ingredient',
    ]);
  });

  it('reads D1 rows with NULL and boolean mapping, structured family options, and no writes', async () => {
    const db = database();
    db.seed(`
      INSERT INTO recipe_families
        (id, slug, name, base_servings, source_type, source_reference, verification_state, version)
      VALUES ('catalog_family', 'catalog-family', 'Catalog family', 2, 'curated', NULL, 'reviewed', 2);
      INSERT INTO recipe_family_slots (family_id, slot_key, min_selections, max_selections)
      VALUES ('catalog_family', 'protein', 1, 1);
      INSERT INTO recipe_family_options (family_id, slot_key, ingredient_id, quantity, unit)
      VALUES ('catalog_family', 'protein', 'CHICKEN_BREAST', 150, 'g');
      INSERT INTO recipes
        (id, slug, title, description, cuisine, cook_time_minutes, servings, difficulty, family_id,
         prep_time_minutes, source_type, source_reference, verification_state, version)
      VALUES ('catalog_d1_recipe', 'catalog-d1-recipe', 'Catalog D1 recipe', NULL, 'vietnamese', 20, 2,
        'easy', 'catalog_family', NULL, 'legacy', NULL, 'unverified', 1);
      INSERT INTO recipe_ingredients
        (id, recipe_id, ingredient_id, name, required_quantity, unit, is_optional)
      VALUES ('catalog_d1_line', 'catalog_d1_recipe', 'CHICKEN_BREAST', 'Chicken breast', 200, 'g', 1);
      INSERT INTO recipe_classifications (recipe_id, kind, tag)
      VALUES ('catalog_d1_recipe', 'method', 'stir_fry');
    `);
    const events: SqliteStatementEvent[] = [];
    db.hooks.beforeBatch = (statements) => {
      events.push(...statements);
    };
    const snapshot = await readRecipeCatalog(db);

    const d1Recipe = snapshot.recipes.find((item) => item.id === 'catalog_d1_recipe');
    expect(d1Recipe).toMatchObject({
      familyId: 'catalog_family',
      provenance: { sourceType: 'legacy', verificationState: 'unverified', version: 1 },
      ingredients: [
        {
          ingredientId: 'CHICKEN_BREAST',
          requiredQuantity: 200,
          unit: 'g',
          isOptional: true,
        },
      ],
    });
    expect(d1Recipe?.description).toBeUndefined();
    expect(d1Recipe?.prepTimeMinutes).toBeUndefined();
    expect(d1Recipe?.provenance.sourceReference).toBeUndefined();
    expect(snapshot.families.find((item) => item.id === 'catalog_family')).toMatchObject({
      provenance: { sourceType: 'curated', verificationState: 'reviewed', version: 2 },
      slots: [
        {
          key: 'protein',
          options: [{ ingredientId: 'CHICKEN_BREAST', quantity: 150, unit: 'g' }],
        },
      ],
    });
    expect(snapshot.classifications).toEqual([
      { recipeId: 'catalog_d1_recipe', kind: 'method', tag: 'stir_fry' },
    ]);
    expect(events).toHaveLength(8);
    expect(events.every((event) => event.sql.trimStart().toUpperCase().startsWith('SELECT'))).toBe(
      true,
    );
  });

  it('excludes invalid legacy rows while retaining valid rows and only proposes alias promotion', async () => {
    const db = database();
    db.seed(`
      DROP TRIGGER trg_recipe_ingredients_foundation_insert;
      INSERT INTO recipes
        (id, slug, title, cuisine, cook_time_minutes, servings, difficulty, source_type, verification_state, version)
      VALUES ('invalid_legacy_recipe', 'invalid-legacy-recipe', 'Invalid legacy recipe', 'vietnamese', 10, 2,
        'easy', 'legacy', 'unverified', 1);
      INSERT INTO recipe_ingredients
        (id, recipe_id, ingredient_id, name, required_quantity, unit, is_optional)
      VALUES ('invalid_legacy_line', 'invalid_legacy_recipe', 'CHICKEN_BREAST', 'Chicken breast', 100, 'g', 2);
      INSERT INTO ingredient_aliases (id, ingredient_id, alias, language, normalized_alias)
      VALUES
        ('legacy_vi_alias', 'CHICKEN_BREAST', ' Shared   chicken ', 'vi', NULL),
        ('legacy_und_alias', 'PORK_BELLY', 'shared chicken', 'und', NULL);
    `);
    const aliasesBefore = db.query<{ count: number }>(
      'SELECT COUNT(*) AS count FROM ingredient_aliases',
    );
    const snapshot = await readRecipeCatalog(db);

    expect(snapshot.recipes.some((item) => item.id === 'invalid_legacy_recipe')).toBe(false);
    expect(snapshot.recipes.some((item) => item.id === 'vn-canh-01')).toBe(true);
    expect(snapshot.diagnostics.map((item) => item.code)).toContain('invalid_recipe');
    expect(snapshot.diagnostics.map((item) => item.code)).toContain(
      'legacy_alias_promotion_proposed',
    );
    expect(snapshot.diagnostics.map((item) => item.code)).toContain(
      'legacy_alias_locale_und_collision',
    );
    expect(db.query<{ count: number }>('SELECT COUNT(*) AS count FROM ingredient_aliases')).toEqual(
      aliasesBefore,
    );
    expect(
      db.query('SELECT normalized_alias FROM ingredient_aliases WHERE id = ?', 'legacy_vi_alias'),
    ).toEqual([{ normalized_alias: null }]);
  });

  it('reports canonical ID, recipe, requirement, unit, and D1 alias drift without writes', () => {
    const staticSnapshot = createRecipeCatalog({
      source: 'static',
      ingredientIds: ['CHICKEN_BREAST', 'PORK_BELLY'],
      recipes: [recipe],
    });
    const d1Snapshot = createRecipeCatalog({
      source: 'd1',
      ingredientIds: ['CHICKEN_BREAST', 'TOFU'],
      recipes: [
        {
          ...recipe,
          title: 'Changed title',
          ingredients: [{ ...recipe.ingredients[0], requiredQuantity: 0.2, unit: 'kg' }],
        },
        {
          ...recipe,
          id: 'd1_only',
          slug: 'd1-only',
          ingredients: [{ ...recipe.ingredients[0], requiredQuantity: 0.1, unit: 'kg' }],
        },
      ],
      diagnostics: [
        {
          code: 'legacy_alias_collision',
          entity: 'alias',
          message: 'Review collision',
        },
      ],
    });

    expect(auditRecipeCatalogs(staticSnapshot, d1Snapshot)).toMatchObject({
      ingredientIds: { staticOnly: ['PORK_BELLY'], d1Only: ['TOFU'] },
      recipeIds: { staticOnly: [], d1Only: ['d1_only'], changed: ['catalog_recipe'] },
      units: {
        staticOnly: ['g'],
        d1Only: ['kg'],
        requirementDifferences: [
          {
            recipeId: 'catalog_recipe',
            ingredientId: 'CHICKEN_BREAST',
            staticUnits: ['g'],
            d1Units: ['kg'],
          },
        ],
      },
      requirements: [
        {
          recipeId: 'catalog_recipe',
          staticOnly: [expect.objectContaining({ requiredQuantity: 200, unit: 'g' })],
          d1Only: [expect.objectContaining({ requiredQuantity: 0.2, unit: 'kg' })],
        },
      ],
      diagnostics: [{ code: 'legacy_alias_collision', entity: 'alias' }],
    });
  });

  it('reports the exact extra duplicate requirement rather than treating demand as a set', () => {
    const duplicateRequirement = { ...recipe.ingredients[0] };
    const staticSnapshot = createRecipeCatalog({
      source: 'static',
      ingredientIds: ['CHICKEN_BREAST'],
      recipes: [{ ...recipe, ingredients: [recipe.ingredients[0], duplicateRequirement] }],
    });
    const d1Snapshot = createRecipeCatalog({
      source: 'd1',
      ingredientIds: ['CHICKEN_BREAST'],
      recipes: [recipe],
    });

    expect(auditRecipeCatalogs(staticSnapshot, d1Snapshot).requirements).toEqual([
      {
        recipeId: 'catalog_recipe',
        staticOnly: [
          expect.objectContaining({
            ingredientId: 'CHICKEN_BREAST',
            requiredQuantity: 200,
            unit: 'g',
          }),
        ],
        d1Only: [],
      },
    ]);
  });

  it('audits the unchanged static and D1 seed catalogs without merging either source', async () => {
    const db = database();
    const staticSnapshot = adaptStaticRecipeCatalog(CANONICAL_INGREDIENTS, ALL_RECIPES);
    const d1Snapshot = await readRecipeCatalog(db);
    const audit = auditRecipeCatalogs(staticSnapshot, d1Snapshot);

    expect(staticSnapshot.source).toBe('static');
    expect(d1Snapshot.source).toBe('d1');
    expect(audit).toEqual({
      ingredientIds: { staticOnly: [], d1Only: [] },
      // T14B-B (0034) seeded the 12 global recipes: full identity parity, no drift.
      recipeIds: { staticOnly: [], d1Only: [], changed: [] },
      units: { staticOnly: [], d1Only: [], requirementDifferences: [] },
      requirements: [],
      diagnostics: [],
    });
  });
});
