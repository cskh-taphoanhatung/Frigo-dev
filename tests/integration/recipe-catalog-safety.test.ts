import { afterEach, describe, expect, it } from 'vitest';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { classifyCatalogEntry, isFkStubShape } from '../../packages/recipes/src/catalog-entry';
import { auditCatalogDrift, UNAUDITED_RUNTIME_FIELDS, type D1RecipeContentSnapshot } from '../../packages/recipes/src/catalog-drift';
import { readRecipeCatalog } from '../../packages/db/src/recipe-catalog';
import { readRecipeContent } from '../../packages/db/src/recipe-content';
import { SqliteD1, type SqliteStatementEvent } from '../helpers/sqlite-d1';

const GLOBAL_IDS = ['gl-01', 'gl-02', 'gl-03', 'gl-04', 'gl-05', 'gl-06', 'gl-07', 'gl-08', 'gl-09', 'gl-10', 'gl-11', 'gl-12'];

/** Byte-identical to the FK anchor cooking-complete and shopping-list routes insert today. */
function insertFkStub(db: SqliteD1, recipe = ALL_RECIPES.find((item) => item.id === 'gl-01')!) {
  db.seed(`INSERT OR IGNORE INTO recipes (id, slug, title, cuisine, cook_time_minutes, servings, difficulty)
    VALUES ('${recipe.id}', '${recipe.slug}', '${recipe.title.replace(/'/g, "''")}', '${recipe.cuisine}',
      ${recipe.cookTimeMinutes}, ${recipe.servings}, '${recipe.difficulty}')`);
}

const complete = {
  id: 'vn-canh-01', slug: 'canh-chua-ca-loc-nam-bo', title: 'Canh chua', description: 'Bát canh', cuisine: 'vietnamese',
  servings: 4, cookTimeMinutes: 25, difficulty: 'easy',
  provenance: { sourceType: 'legacy', verificationState: 'unverified', version: 1 },
  ingredients: [{ ingredientId: 'TOMATO', name: 'Cà chua', requiredQuantity: 2, unit: 'piece', isOptional: false }],
};

describe('catalog entry completeness (T14B-A)', () => {
  it('classifies a full row as complete, an FK anchor as incomplete stub, and malformed content as rejected', () => {
    expect(classifyCatalogEntry({ recipe: complete, stepCount: 5 })).toEqual({ id: 'vn-canh-01', state: 'complete', fkStub: false, reasons: [] });

    const stub = { id: 'gl-01', slug: 'pasta-pomodoro', title: 'Mì Ý', cuisine: 'italian', servings: 2, cookTimeMinutes: 18,
      difficulty: 'easy', provenance: { sourceType: 'legacy', verificationState: 'unverified', version: 1 }, ingredients: [] };
    expect(isFkStubShape(stub)).toBe(true);
    expect(classifyCatalogEntry({ recipe: stub })).toEqual({
      id: 'gl-01', state: 'incomplete', fkStub: true, reasons: ['fk_anchor_shape', 'no_description', 'no_requirements'],
    });

    expect(classifyCatalogEntry({ recipe: { ...complete, servings: 0, ingredients: [] } })).toEqual({
      id: 'vn-canh-01', state: 'rejected', fkStub: false, reasons: ['invalid:ingredients', 'invalid:servings'],
    });
    expect(classifyCatalogEntry({ recipe: { ...complete, description: undefined }, stepCount: 0 })).toEqual({
      id: 'vn-canh-01', state: 'incomplete', fkStub: false, reasons: ['no_description', 'no_steps'],
    });
    // A stub that later gained a description is content, not an anchor: it must be judged on its merits.
    expect(classifyCatalogEntry({ recipe: { ...stub, description: 'x' } }).fkStub).toBe(false);
    expect(classifyCatalogEntry({ recipe: { ...stub, description: 'x' } }).state).toBe('rejected');
  });

  it('is deterministic regardless of key order', () => {
    const shuffled = { ingredients: complete.ingredients, difficulty: 'easy', cookTimeMinutes: 25, servings: 4, cuisine: 'vietnamese',
      description: 'Bát canh', title: 'Canh chua', slug: 'canh-chua-ca-loc-nam-bo', id: 'vn-canh-01', provenance: complete.provenance };
    expect(classifyCatalogEntry({ recipe: shuffled })).toEqual(classifyCatalogEntry({ recipe: complete }));
  });
});

describe('static ↔ D1 drift audit against the real migration ledger', () => {
  const databases: SqliteD1[] = [];
  const database = () => { const db = new SqliteD1(); databases.push(db); return db; };
  afterEach(() => { for (const db of databases.splice(0)) db.close(); });

  it('reads content in one read-only batch and never issues a write', async () => {
    const db = database();
    const events: SqliteStatementEvent[] = [];
    db.hooks.beforeBatch = (statements) => { events.push(...statements); };
    const before = db.query<{ n: number }>('SELECT COUNT(*) AS n FROM recipes');
    await readRecipeContent(db);
    expect(events).toHaveLength(4);
    expect(events.every((event) => event.sql.trimStart().toUpperCase().startsWith('SELECT'))).toBe(true);
    expect(db.query<{ n: number }>('SELECT COUNT(*) AS n FROM recipes')).toEqual(before);
  });

  it('reports the truthful current drift: 71 static, 59 complete D1, 12 globals static-only, media/nutrition gaps', async () => {
    const report = auditCatalogDrift(ALL_RECIPES, await readRecipeContent(database()));

    expect(report.staticCount).toBe(71);
    expect(report.d1RowCount).toBe(59);
    expect(report.d1CompleteCount).toBe(59);
    expect(report.identity).toEqual({ staticOnly: GLOBAL_IDS, d1Only: [], slugMismatch: [] });
    expect(report.core.changed).toEqual([]);
    expect(report.requirements.changed).toEqual([]);
    expect(report.units.changed).toEqual([]);
    expect(report.incompleteRows).toEqual([]);
    expect(report.rejectedRows).toEqual([]);

    // Content truth (do not weaken): steps and image URLs match; nutrition is not represented in D1.
    expect(report.content.steps).toEqual({ changed: [] });
    expect(report.content.media).toEqual({ missingInD1: [], changed: [] });
    expect(report.content.tags.changed).toEqual([]);
    expect(report.content.nutrition.missingInD1).toHaveLength(59);
    expect(report.content.classification).toHaveLength(59 * 2);
    expect(report.content.classification.every((item) => item.representation === 'represented_through_legacy_tags')).toBe(true);

    expect(UNAUDITED_RUNTIME_FIELDS).toEqual([]);
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });

  it('never counts an FK stub as a catalog entry, does not repair it, and the foundation reader excludes it too', async () => {
    const db = database();
    insertFkStub(db);
    const rowBefore = db.query('SELECT * FROM recipes WHERE id = ?', 'gl-01');

    const report = auditCatalogDrift(ALL_RECIPES, await readRecipeContent(db));
    expect(report.d1RowCount).toBe(60);
    expect(report.d1CompleteCount).toBe(59);
    expect(report.identity.staticOnly).toEqual(GLOBAL_IDS);
    expect(report.identity.d1Only).toEqual([]);
    expect(report.incompleteRows).toEqual([
      { id: 'gl-01', state: 'incomplete', fkStub: true, reasons: ['fk_anchor_shape', 'no_description', 'no_requirements'] },
    ]);

    // The existing planner catalog reader already excludes the stub (min(1) ingredients).
    const foundation = await readRecipeCatalog(db);
    expect(foundation.recipes.some((recipe) => recipe.id === 'gl-01')).toBe(false);
    expect(foundation.diagnostics.some((item) => item.code === 'invalid_recipe')).toBe(true);

    expect(db.query('SELECT * FROM recipes WHERE id = ?', 'gl-01')).toEqual(rowBefore);
    // Static authority still serves the canonical recipe untouched.
    expect(ALL_RECIPES.find((recipe) => recipe.id === 'gl-01')?.ingredients.length).toBeGreaterThan(0);
  });

  it('detects every drift class deterministically on a synthetic snapshot', async () => {
    const base = await readRecipeContent(database());
    const pick = (id: string) => base.recipes.find((row) => row.id === id)!;
    const d1: D1RecipeContentSnapshot = {
      recipes: [
        { ...pick('vn-canh-01'), slug: 'renamed-slug', title: 'Different title' },
        { ...pick('vn-canh-02'), tags: ['Món canh', 'cat:mon_xao', 'region:bac'], imageUrl: null },
        { ...pick('vn-canh-03'), tags: null },
        { ...pick('vn-kho-01'), imageUrl: '/frigo/recipes/vietnam/thit-kho-trung.webp' },
        { ...pick('vn-kho-02') },
        { ...pick('vn-kho-03'), id: 'd1-only', slug: 'd1-only' },
      ],
      requirements: base.requirements
        .filter((line) => ['vn-canh-01', 'vn-canh-02', 'vn-canh-03', 'vn-kho-01', 'vn-kho-02', 'vn-kho-03'].includes(line.recipeId))
        .map((line) => {
          if (line.recipeId === 'vn-canh-02' && line.ingredientId === 'CRAB_MEAT') return { ...line, requiredQuantity: 999 };
          if (line.recipeId === 'vn-canh-03' && line.ingredientId === 'GROUND_PORK') return { ...line, unit: 'kg' };
          if (line.recipeId === 'vn-kho-01' && line.ingredientId === 'CHICKEN_EGG') return { ...line, isOptional: true };
          return line.recipeId === 'vn-kho-03' ? { ...line, recipeId: 'd1-only' } : line;
        }),
      steps: base.steps.filter((step) => step.recipeId !== 'vn-kho-02')
        .map((step) => (step.recipeId === 'vn-kho-03' ? { ...step, recipeId: 'd1-only' } : step))
        .map((step) => (step.recipeId === 'vn-canh-01' && step.stepNumber === 1 ? { ...step, tip: 'new tip' } : step)),
      nutritionRecipeIds: ['vn-canh-01'],
    };
    const staticSubset = ALL_RECIPES.filter((recipe) => ['vn-canh-01', 'vn-canh-02', 'vn-canh-03', 'vn-kho-01', 'vn-kho-02', 'gl-01'].includes(recipe.id));
    const report = auditCatalogDrift(staticSubset, d1);

    // vn-kho-02 lost its steps: runtime requires steps, so the row is incomplete and NOT a catalog entry.
    expect(report.incompleteRows).toEqual([{ id: 'vn-kho-02', state: 'incomplete', fkStub: false, reasons: ['no_steps'] }]);
    expect(report.identity.staticOnly).toEqual(['gl-01', 'vn-kho-02']);
    expect(report.identity.d1Only).toEqual(['d1-only']);
    expect(report.identity.slugMismatch).toEqual([{ id: 'vn-canh-01', staticSlug: 'canh-chua-ca-loc-nam-bo', d1Slug: 'renamed-slug' }]);
    expect(report.core.changed).toEqual([{ id: 'vn-canh-01', fields: ['slug', 'title'] }]);
    expect(report.requirements.changed.map((item) => item.id)).toEqual(['vn-canh-02', 'vn-canh-03', 'vn-kho-01']);
    expect(report.requirements.changed[0].d1Only[0].requiredQuantity).toBe(999);
    expect(report.requirements.changed[2].d1Only[0].isOptional).toBe(true);
    expect(report.units.changed).toEqual([{ id: 'vn-canh-03', ingredientId: 'GROUND_PORK', staticUnits: ['g'], d1Units: ['kg'] }]);
    expect(report.content.steps).toEqual({ changed: ['vn-canh-01'] });
    expect(report.content.nutrition.missingInD1).toEqual(['vn-canh-02', 'vn-canh-03', 'vn-kho-01']);
    expect(report.content.tags.changed).toEqual(['vn-canh-02', 'vn-canh-03']);
    expect(report.content.classification.filter((item) => item.id === 'vn-canh-02')).toEqual([
      { id: 'vn-canh-02', field: 'category', representation: 'unsupported_by_catalog_model', staticValue: 'mon_canh', d1Value: 'mon_xao' },
      { id: 'vn-canh-02', field: 'region', representation: 'represented_through_legacy_tags', staticValue: 'bac', d1Value: 'bac' },
    ]);
    expect(report.content.classification.filter((item) => item.id === 'vn-canh-03').map((item) => item.representation))
      .toEqual(['missing_in_d1', 'missing_in_d1']);
    expect(report.content.media).toEqual({ missingInD1: ['vn-canh-02'], changed: ['vn-kho-01'] });

    // Ordering is independent of input order.
    const reversed = auditCatalogDrift([...staticSubset].reverse(), {
      ...d1, recipes: [...d1.recipes].reverse(), requirements: [...d1.requirements].reverse(), steps: [...d1.steps].reverse(),
    });
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(report));
  });
});
