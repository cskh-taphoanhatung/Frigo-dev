import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readRecipeContent } from '../../packages/db/src/recipe-content';
import { auditCatalogDrift, type D1RecipeContentSnapshot } from '../../packages/recipes/src/catalog-drift';
import { ALL_RECIPES, GLOBAL_RECIPES, VIETNAMESE_RECIPES } from '../../packages/recipes/src/data';
import { hydrateRuntimeRecipeById, hydrateRuntimeRecipes } from '../../packages/recipes/src/runtime-hydration';
import {
  compareRuntimeCatalogs,
  D1RuntimeRecipeCatalog,
  StaticRuntimeRecipeCatalog,
} from '../../packages/recipes/src/runtime-catalog';
import { RuntimeRecipeSchema, toRuntimeRecipe } from '../../packages/recipes/src/runtime-recipe';
import { GLOBAL_PARITY_MIGRATION_FILENAME, renderGlobalRecipeParitySql } from '../../packages/recipes/src/seed-render';
import type { Recipe } from '../../packages/recipes/src/types';
import { LEGACY_CATALOG_MIGRATION_TIP, MIGRATION_LEDGER, SqliteD1, type SqliteStatementEvent } from '../helpers/sqlite-d1';
import migrationManifest from '../fixtures/migration-sha256.json';

const GLOBAL_IDS = Array.from({ length: 12 }, (_, index) => `gl-${String(index + 1).padStart(2, '0')}`);
const STATIC_IDS = ALL_RECIPES.map((recipe) => recipe.id);
const migrationFiles = () => readdirSync('migrations').filter((name) => /^\d+.*\.sql$/.test(name)).sort();
const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

describe('T14B-B — 0034 parity migration', () => {
  const databases: SqliteD1[] = [];
  // Legacy-baseline parity: replay the ledger through 0035 (the 71-recipe static baseline). T14F growth is certified separately.
  const database = (options?: { migrate?: boolean }) => { const db = new SqliteD1({ ...options, through: LEGACY_CATALOG_MIGRATION_TIP }); databases.push(db); return db; };
  afterEach(() => { for (const db of databases.splice(0)) db.close(); });

  it('is the 34th migration (contiguous ledger) and renders byte-for-byte from the static catalog (order data included)', () => {
    const files = migrationFiles();
    expect(files).toHaveLength(MIGRATION_LEDGER.count);
    expect(files[33]).toBe(GLOBAL_PARITY_MIGRATION_FILENAME);
    expect(files.map((name) => name.slice(0, 4))).toEqual(Array.from({ length: MIGRATION_LEDGER.count }, (_, i) => String(i + 1).padStart(4, '0')));
    const rendered = renderGlobalRecipeParitySql(GLOBAL_RECIPES, ALL_RECIPES);
    expect(readFileSync(path.join('migrations', GLOBAL_PARITY_MIGRATION_FILENAME), 'utf8')).toBe(rendered);
    // The renderer, not a hand-maintained list, owns runtime_order and ingredient positions.
    expect(rendered).toContain(`('${STATIC_IDS[0]}', 0, `);
    expect(rendered).toContain(`('${STATIC_IDS[70]}', 70, `);
    expect(rendered).toContain(`('vn-canh-01_ing_1', 'vn-canh-01', 0)`);
    expect(readFileSync('migrations/0006_vietnamese_recipe_bank.sql', 'utf8')).not.toContain('gl-01');
  });

  it('0001-0034 match the fixed fingerprints pinned from canonical main (not the working tree)', () => {
    const pinned = migrationManifest.migrations as Record<string, string>;
    expect(Object.keys(pinned)).toHaveLength(34);
    expect(migrationManifest.pinnedFromMain).toBe('c1c1c14a2a7dccc883f1030d0dee7043754fb4a9');
    for (const [name, expected] of Object.entries(pinned)) {
      expect(sha256(path.join('migrations', name)), name).toBe(expected);
    }
    // 0034 was applied to production on 2026-09-16 and is pinned; 0035 (T14C) is verified via its renderer, never pinned yet.
    expect(pinned).toHaveProperty(GLOBAL_PARITY_MIGRATION_FILENAME, '23f356458a294b240e683fec14012bc932a8b7e57ad0c932e4fc184329bada4d');
    expect(pinned).not.toHaveProperty('0035_recipe_media_layer.sql');
    // Guard the guard: a mutated byte would be detected.
    expect(createHash('sha256').update(readFileSync('migrations/0006_vietnamese_recipe_bank.sql', 'utf8') + ' ').digest('hex'))
      .not.toBe(pinned['0006_vietnamese_recipe_bank.sql']);
  });

  it('fresh replay 0001→0035: 71 complete rows, 12 globals under stable IDs, no orphans, no FK failures', () => {
    const db = database();
    expect(db.migrations[33]).toBe(GLOBAL_PARITY_MIGRATION_FILENAME);
    const totalLines = ALL_RECIPES.reduce((sum, recipe) => sum + recipe.ingredients.length, 0);
    const counts = db.query<{ recipes: number; lines: number; steps: number; fields: number; classifications: number; positions: number }>(
      `SELECT (SELECT COUNT(*) FROM recipes) AS recipes, (SELECT COUNT(*) FROM recipe_ingredients) AS lines,
              (SELECT COUNT(*) FROM recipe_steps) AS steps, (SELECT COUNT(*) FROM recipe_runtime_fields) AS fields,
              (SELECT COUNT(*) FROM recipe_classifications) AS classifications,
              (SELECT COUNT(*) FROM recipe_runtime_ingredient_order) AS positions`)[0];
    expect(counts).toEqual({
      recipes: 71, lines: totalLines, steps: ALL_RECIPES.reduce((sum, recipe) => sum + recipe.steps.length, 0),
      fields: 71, classifications: 0, positions: totalLines,
    });
    // Canonical runtime order: contiguous 0..70, unique, and equal to ALL_RECIPES order.
    expect(db.query<{ n: number; d: number; lo: number; hi: number }>(
      'SELECT COUNT(*) AS n, COUNT(DISTINCT runtime_order) AS d, MIN(runtime_order) AS lo, MAX(runtime_order) AS hi FROM recipe_runtime_fields')[0])
      .toEqual({ n: 71, d: 71, lo: 0, hi: 70 });
    expect(db.query<{ recipe_id: string }>('SELECT recipe_id FROM recipe_runtime_fields ORDER BY runtime_order').map((row) => row.recipe_id)).toEqual(STATIC_IDS);
    // Ingredient positions: every line mapped exactly once, 0..N-1 per recipe, no orphans.
    expect(db.query('SELECT l.id FROM recipe_ingredients l LEFT JOIN recipe_runtime_ingredient_order o ON o.recipe_ingredient_id = l.id WHERE o.recipe_ingredient_id IS NULL')).toEqual([]);
    expect(db.query('SELECT o.recipe_ingredient_id FROM recipe_runtime_ingredient_order o LEFT JOIN recipe_ingredients l ON l.id = o.recipe_ingredient_id WHERE l.id IS NULL OR l.recipe_id <> o.recipe_id')).toEqual([]);
    expect(db.query('SELECT recipe_id FROM recipe_runtime_ingredient_order GROUP BY recipe_id HAVING COUNT(*) <> COUNT(DISTINCT position) OR MIN(position) <> 0 OR MAX(position) <> COUNT(*) - 1')).toEqual([]);
    expect(() => db.seed("INSERT INTO recipe_runtime_ingredient_order (recipe_ingredient_id, recipe_id, position) VALUES ('vn-canh-01_ing_2', 'vn-canh-01', 0)")).toThrow();
    expect(() => db.seed("UPDATE recipe_runtime_fields SET runtime_order = 0 WHERE recipe_id = 'gl-01'")).toThrow();
    expect(() => db.seed("UPDATE recipe_runtime_fields SET runtime_order = -1 WHERE recipe_id = 'gl-01'")).toThrow();
    expect(db.query<{ id: string }>("SELECT id FROM recipes WHERE id GLOB 'gl-*' ORDER BY id").map((row) => row.id)).toEqual(GLOBAL_IDS);
    expect(db.query<{ n: number }>("SELECT COUNT(*) AS n FROM recipes WHERE cuisine = 'vietnamese'")[0].n).toBe(59);
    expect(db.query('SELECT l.id FROM recipe_ingredients l LEFT JOIN ingredients i ON i.id = l.ingredient_id WHERE i.id IS NULL')).toEqual([]);
    expect(db.query('SELECT s.id FROM recipe_steps s LEFT JOIN recipes r ON r.id = s.recipe_id WHERE r.id IS NULL')).toEqual([]);
    expect(db.query('SELECT f.recipe_id FROM recipe_runtime_fields f LEFT JOIN recipes r ON r.id = f.recipe_id WHERE r.id IS NULL')).toEqual([]);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
    expect(db.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
    // Truthful provenance: nothing is curated/reviewed; no source reference was invented.
    expect(db.query("SELECT DISTINCT source_type, verification_state, version, source_reference FROM recipes"))
      .toEqual([{ source_type: 'legacy', verification_state: 'unverified', version: 1, source_reference: null }]);
    // Region stays a closed vocabulary; globals carry neither category nor region.
    expect(db.query<{ n: number }>("SELECT COUNT(*) AS n FROM recipe_runtime_fields WHERE recipe_id GLOB 'gl-*' AND (category IS NOT NULL OR region IS NOT NULL)")[0].n).toBe(0);
    expect(() => db.seed("INSERT INTO recipe_runtime_fields (recipe_id, category, region) VALUES ('vn-canh-01', 'x', 'mars')")).toThrow();
    expect(() => db.seed("UPDATE recipe_runtime_fields SET legacy_calories = NULL WHERE recipe_id = 'gl-01'")).toThrow();
  });

  it('upgrade from a populated 0033 database (FK stub + cooked meal + user data) applies only 0034 and changes nothing else', () => {
    const db = database({ migrate: false });
    for (const file of migrationFiles().filter((name) => Number(name.slice(0, 4)) <= 33)) db.seed(readFileSync(`migrations/${file}`, 'utf8'));
    // A real cooking-complete anchor and its cooked_meals reference, plus household inventory.
    db.seed(`INSERT INTO users(id) VALUES ('t14bb-user');
      INSERT INTO households(id, name, created_by) VALUES ('t14bb-house', 'T14B-B', 't14bb-user');
      INSERT OR IGNORE INTO recipes (id, slug, title, cuisine, cook_time_minutes, servings, difficulty)
        VALUES ('gl-03', 'tomato-egg-stir-fry', 'Cà chua xào trứng Trung Hoa', 'chinese', 10, 2, 'easy');
      INSERT INTO cooked_meals (id, household_id, user_id, recipe_id, servings_cooked) VALUES ('t14bb-cook', 't14bb-house', 't14bb-user', 'gl-03', 2);
      INSERT INTO inventory_items (id, household_id, ingredient_id, name, quantity, unit, category, storage, freshness)
        VALUES ('t14bb-eggs', 't14bb-house', 'CHICKEN_EGG', 'Trứng', 6, 'piece', 'egg', 'fridge', 'fresh');`);
    const snapshot = () => ({
      vietnamese: db.query('SELECT * FROM recipes WHERE cuisine = ? ORDER BY id', 'vietnamese'),
      lines: db.query("SELECT * FROM recipe_ingredients WHERE recipe_id NOT GLOB 'gl-*' ORDER BY id"),
      steps: db.query("SELECT * FROM recipe_steps WHERE recipe_id NOT GLOB 'gl-*' ORDER BY id"),
      cooked: db.query('SELECT * FROM cooked_meals ORDER BY id'),
      inventory: db.query('SELECT * FROM inventory_items ORDER BY id'),
      users: db.query('SELECT * FROM users ORDER BY id'),
    });
    const before = snapshot();
    const stubBefore = db.query<{ description: string | null; created_at: string }>('SELECT description, created_at FROM recipes WHERE id = ?', 'gl-03')[0];
    expect(stubBefore.description).toBeNull();

    db.seed(readFileSync(`migrations/${GLOBAL_PARITY_MIGRATION_FILENAME}`, 'utf8'));

    expect(snapshot()).toEqual(before);
    expect(db.query<{ n: number }>('SELECT COUNT(*) AS n FROM recipes')[0].n).toBe(71);
    expect(db.query<{ n: number }>("SELECT COUNT(*) AS n FROM recipes WHERE id GLOB 'gl-*'")[0].n).toBe(12);
    expect(db.query<{ recipe_id: string }>('SELECT recipe_id FROM recipe_runtime_fields ORDER BY runtime_order').map((row) => row.recipe_id)).toEqual(STATIC_IDS);
    expect(db.query<{ n: number }>('SELECT COUNT(*) AS n FROM recipe_runtime_ingredient_order')[0].n)
      .toBe(ALL_RECIPES.reduce((sum, recipe) => sum + recipe.ingredients.length, 0));
    const upgraded = db.query<Record<string, unknown>>('SELECT * FROM recipes WHERE id = ?', 'gl-03')[0];
    expect(upgraded.description).toBe(GLOBAL_RECIPES.find((recipe) => recipe.id === 'gl-03')!.description);
    expect(upgraded.created_at).toBe(stubBefore.created_at);
    expect(upgraded).toMatchObject({ source_type: 'legacy', verification_state: 'unverified', version: 1, source_reference: null });
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
    expect(db.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
    // Re-running the same migration is a no-op (replay-safe upsert).
    const after = db.query('SELECT * FROM recipes ORDER BY id');
    db.seed(readFileSync(`migrations/${GLOBAL_PARITY_MIGRATION_FILENAME}`, 'utf8'));
    expect(db.query('SELECT * FROM recipes ORDER BY id')).toEqual(after);
  });

  it('renderer refuses to encode category/region as legacy tag markers or to accept marker-prefixed tags', () => {
    const withRegion = [{ ...GLOBAL_RECIPES[0], region: 'nam' as const }];
    expect(() => renderGlobalRecipeParitySql(withRegion, [...VIETNAMESE_RECIPES, ...withRegion])).toThrow(/recipe_runtime_fields, not tags/);
    const markerTag = [{ ...GLOBAL_RECIPES[0], tags: ['cat:sneaky'] }];
    expect(() => renderGlobalRecipeParitySql(markerTag, [...VIETNAMESE_RECIPES, ...markerTag])).toThrow(/legacy marker prefix/);
    expect(() => renderGlobalRecipeParitySql(GLOBAL_RECIPES, VIETNAMESE_RECIPES)).toThrow(/not part of the runtime catalog/);
  });
});

describe('T14B-B — D1 → RuntimeRecipe hydration parity', () => {
  const databases: SqliteD1[] = [];
  const database = () => { const db = new SqliteD1({ through: LEGACY_CATALOG_MIGRATION_TIP }); databases.push(db); return db; };
  afterEach(() => { for (const db of databases.splice(0)) db.close(); });

  it('reads one five-statement read-only batch and hydrates all 71 recipes deep-equal to the static authority', async () => {
    const db = database();
    const events: SqliteStatementEvent[] = [];
    db.hooks.beforeBatch = (statements) => { events.push(...statements); };
    const snapshot = await readRecipeContent(db);
    expect(events).toHaveLength(5);
    expect(events.every((event) => /^SELECT/i.test(event.sql.trimStart()))).toBe(true);

    const hydration = hydrateRuntimeRecipes(snapshot);
    expect(hydration.failures).toEqual([]);
    expect(hydration.recipes).toHaveLength(71);
    // Canonical order comes from persisted runtime_order — Vietnamese first, then gl-01..gl-12 — with no sorting on either side.
    expect(hydration.recipes.map((recipe) => recipe.id)).toEqual(STATIC_IDS);
    expect(hydration.recipes.slice(0, 3).map((recipe) => recipe.id)).toEqual(['vn-canh-01', 'vn-canh-02', 'vn-canh-03']);
    expect(hydration.recipes.slice(-3).map((recipe) => recipe.id)).toEqual(['gl-10', 'gl-11', 'gl-12']);
    // Positional deep equality of the whole list.
    expect(hydration.recipes).toStrictEqual(ALL_RECIPES.map(toRuntimeRecipe));

    const staticById = new Map(ALL_RECIPES.map((recipe) => [recipe.id, toRuntimeRecipe(recipe)]));
    for (const hydrated of hydration.recipes) {
      // Deep structural equality: same key presence (no undefined-vs-missing games), same values,
      // same ingredient and step order as the static source.
      expect(hydrated).toStrictEqual(staticById.get(hydrated.id));
      expect(RuntimeRecipeSchema.strict().safeParse(hydrated).success).toBe(true);
    }
    // Field-level parity claims the packet asks for, stated explicitly.
    for (const recipe of ALL_RECIPES) {
      const hydrated = hydration.recipes.find((item) => item.id === recipe.id)!;
      expect(hydrated.ingredients.map((line) => [line.ingredientId, line.requiredQuantity, line.unit, line.isOptional]))
        .toEqual(recipe.ingredients.map((line) => [line.ingredientId, line.requiredQuantity, line.unit, line.isOptional]));
      expect(hydrated.steps).toEqual(recipe.steps);
      expect(hydrated.tags).toEqual(recipe.tags);
      expect(hydrated.category).toBe(recipe.category);
      expect(hydrated.region).toBe(recipe.region);
      expect(hydrated.imageUrl).toBe(recipe.imageUrl);
      expect(hydrated.nutrition).toEqual(recipe.nutrition);
    }
    expect(GLOBAL_IDS.map((id) => hydration.recipes.find((recipe) => recipe.id === id)?.slug))
      .toEqual(GLOBAL_RECIPES.map((recipe) => recipe.slug));
  });

  it('runtime catalogs agree including array order: static preserves ALL_RECIPES order, D1 reproduces it from runtime_order', async () => {
    const db = database();
    let reads = 0;
    const d1Catalog = new D1RuntimeRecipeCatalog(async () => { reads += 1; return readRecipeContent(db); });
    const staticCatalog = new StaticRuntimeRecipeCatalog();
    const staticList = await staticCatalog.listRuntimeRecipes();
    const d1List = await d1Catalog.listRuntimeRecipes();
    expect(staticList.map((recipe) => recipe.id)).toEqual(STATIC_IDS);
    expect(d1List.map((recipe) => recipe.id)).toEqual(STATIC_IDS);
    expect(d1List).toStrictEqual(staticList);
    expect(STATIC_IDS).not.toEqual([...STATIC_IDS].sort());
    // Static catalog never sorts its input: a custom order is preserved verbatim.
    const custom = [ALL_RECIPES[70], ALL_RECIPES[0], ALL_RECIPES[35]];
    expect((await new StaticRuntimeRecipeCatalog(custom).listRuntimeRecipes()).map((recipe) => recipe.id)).toEqual(custom.map((recipe) => recipe.id));
    expect(await d1Catalog.findRuntimeRecipe('gl-07')).toStrictEqual(await staticCatalog.findRuntimeRecipe('kimbap-han-quoc'));
    expect(await d1Catalog.findRuntimeRecipe('vn-canh-01')).toStrictEqual(await staticCatalog.findRuntimeRecipe('vn-canh-01'));
    expect(await d1Catalog.findRuntimeRecipe('not-a-recipe')).toBeNull();
    expect(reads).toBe(1);
    expect(hydrateRuntimeRecipeById(await d1Catalog.readSnapshot(), 'pasta-pomodoro')?.id).toBe('gl-01');
    expect(hydrateRuntimeRecipeById(await d1Catalog.readSnapshot(), 'gl-99')).toBeNull();
  });

  it('drift audit reaches full 71 parity with explicit statuses for classification, media and nutrition', async () => {
    const report = auditCatalogDrift(ALL_RECIPES, await readRecipeContent(database()));
    expect(report).toMatchObject({
      staticCount: 71, d1RowCount: 71, d1CompleteCount: 71,
      identity: { staticOnly: [], d1Only: [], slugMismatch: [] },
      core: { changed: [] }, requirements: { changed: [] }, units: { changed: [] },
      content: {
        steps: { changed: [] }, tags: { changed: [] },
        media: { missingInD1: [], changed: [] },
        nutrition: { representation: 'legacy_compatibility', missingInD1: [], changed: [] },
      },
      incompleteRows: [], rejectedRows: [],
    });
    expect(report.content.classification.filter((item) => item.representation !== 'typed_runtime_field')).toEqual([]);
    expect(report.content.classification).toHaveLength(59 * 2);
  });

  it('shadow comparison is O(N), order-independent and reports zero drift on the real ledger', async () => {
    const snapshot = await readRecipeContent(database());
    const diagnostics = compareRuntimeCatalogs(ALL_RECIPES, snapshot);
    expect(diagnostics).toMatchObject({
      catalogSource: 'static', shadowSource: 'd1', staticCount: 71, d1RowCount: 71, d1CompleteCount: 71, hydratedCount: 71,
      staticOnlyCount: 0, d1OnlyCount: 0, driftCount: 0, orderDriftCount: 0, hydrationFailureCount: 0,
      staticOnly: [], d1Only: [], drift: [], orderDrift: [], hydrationFailures: [],
    });
    // Negative control: a global-first ordinal assignment must surface as order drift (bounded, IDs + positions only).
    const globalFirst: D1RecipeContentSnapshot = {
      ...snapshot,
      runtimeFields: snapshot.runtimeFields.map((row) => ({
        ...row, runtimeOrder: row.recipeId.startsWith('gl-') ? row.runtimeOrder! - 59 : row.runtimeOrder! + 12,
      })),
    };
    const drifted = compareRuntimeCatalogs(ALL_RECIPES, globalFirst);
    expect(drifted.orderDriftCount).toBe(71);
    expect(drifted.orderDrift[0]).toEqual({ id: 'vn-canh-01', staticPosition: 0, d1Position: 12 });
    expect(drifted.orderDrift.find((item) => item.id === 'gl-01')).toEqual({ id: 'gl-01', staticPosition: 59, d1Position: 0 });
    expect(drifted.driftCount).toBe(0);
    expect(hydrateRuntimeRecipes(globalFirst).recipes.slice(0, 12).map((recipe) => recipe.id)).toEqual(GLOBAL_IDS);
    // Row array order in the snapshot is irrelevant: persisted ordinals decide, so a shuffled read is identical.
    const shuffled: D1RecipeContentSnapshot = {
      recipes: [...snapshot.recipes].reverse(), requirements: [...snapshot.requirements].reverse(),
      steps: [...snapshot.steps].reverse(), nutritionRecipeIds: snapshot.nutritionRecipeIds, runtimeFields: [...snapshot.runtimeFields].reverse(),
    };
    expect(JSON.stringify(compareRuntimeCatalogs(ALL_RECIPES, shuffled))).toBe(JSON.stringify(diagnostics));
    // …but a reversed STATIC list is a genuine order difference and must be reported as such.
    // (Reversing 71 items leaves the middle item at its own index, so 70 positions differ.)
    expect(compareRuntimeCatalogs([...ALL_RECIPES].reverse(), snapshot).orderDriftCount).toBe(70);
    expect(JSON.parse(JSON.stringify(diagnostics))).toEqual(diagnostics);
  });

  it('fails closed: stub, malformed, missing steps/media/fields, marker conflict, bad unit/region/cuisine, duplicate IDs', async () => {
    const db = database();
    const base = await readRecipeContent(db);
    const pick = (id: string) => base.recipes.find((row) => row.id === id)!;
    const fields = (id: string) => base.runtimeFields.find((row) => row.recipeId === id)!;
    const lines = (id: string) => base.requirements.filter((row) => row.recipeId === id);
    const steps = (id: string) => base.steps.filter((row) => row.recipeId === id);

    const synthetic: D1RecipeContentSnapshot = {
      recipes: [
        // FK anchor exactly as cooking/shopping leave it (no description, no lines, no image, no tags).
        { ...pick('gl-01'), id: 'stub-01', slug: 'stub-01', description: null, imageUrl: null, tags: null },
        // Malformed content: servings 0 fails the foundation contract → rejected.
        { ...pick('gl-02'), id: 'bad-servings', slug: 'bad-servings', servings: 0 },
        { ...pick('gl-03'), id: 'no-steps', slug: 'no-steps' },
        { ...pick('gl-03'), id: 'blank-description', slug: 'blank-description', description: '   ' },
        { ...pick('gl-04'), id: 'no-media', slug: 'no-media', imageUrl: null },
        { ...pick('gl-05'), id: 'no-fields', slug: 'no-fields' },
        { ...pick('vn-canh-01'), id: 'marker-conflict', slug: 'marker-conflict' },
        { ...pick('gl-06'), id: 'bad-unit', slug: 'bad-unit' },
        { ...pick('gl-07'), id: 'bad-region', slug: 'bad-region' },
        { ...pick('gl-08'), id: 'bad-cuisine', slug: 'bad-cuisine', cuisine: 'martian' },
        { ...pick('gl-09'), id: 'dup', slug: 'dup-a' },
        { ...pick('gl-09'), id: 'dup', slug: 'dup-b' },
        { ...pick('gl-10'), id: 'dup-tag', slug: 'dup-tag', tags: ['Thái Lan', 'Thái Lan'] },
        { ...pick('gl-11'), id: 'dup-step', slug: 'dup-step' },
        { ...pick('gl-01'), id: 'no-order', slug: 'no-order' },
        { ...pick('gl-01'), id: 'neg-order', slug: 'neg-order' },
        { ...pick('gl-01'), id: 'dup-order-a', slug: 'dup-order-a' },
        { ...pick('gl-01'), id: 'dup-order-b', slug: 'dup-order-b' },
        { ...pick('gl-02'), id: 'no-position', slug: 'no-position' },
        { ...pick('gl-02'), id: 'bad-position', slug: 'bad-position' },
        pick('gl-12'),
      ],
      requirements: [
        ...lines('gl-02').map((line) => ({ ...line, recipeId: 'bad-servings' })),
        ...lines('gl-03').map((line) => ({ ...line, recipeId: 'no-steps' })),
        ...lines('gl-03').map((line) => ({ ...line, recipeId: 'blank-description' })),
        ...lines('gl-04').map((line) => ({ ...line, recipeId: 'no-media' })),
        ...lines('gl-05').map((line) => ({ ...line, recipeId: 'no-fields' })),
        ...lines('vn-canh-01').map((line) => ({ ...line, recipeId: 'marker-conflict' })),
        ...lines('gl-06').map((line, index) => ({ ...line, recipeId: 'bad-unit', unit: index === 0 ? 'cup' : line.unit })),
        ...lines('gl-07').map((line) => ({ ...line, recipeId: 'bad-region' })),
        ...lines('gl-08').map((line) => ({ ...line, recipeId: 'bad-cuisine' })),
        ...lines('gl-09').map((line) => ({ ...line, recipeId: 'dup' })),
        ...lines('gl-10').map((line) => ({ ...line, recipeId: 'dup-tag' })),
        ...lines('gl-11').map((line) => ({ ...line, recipeId: 'dup-step' })),
        ...lines('gl-01').map((line) => ({ ...line, recipeId: 'no-order' })),
        ...lines('gl-01').map((line) => ({ ...line, recipeId: 'neg-order' })),
        ...lines('gl-01').map((line) => ({ ...line, recipeId: 'dup-order-a' })),
        ...lines('gl-01').map((line) => ({ ...line, recipeId: 'dup-order-b' })),
        ...lines('gl-02').map((line, index) => ({ ...line, recipeId: 'no-position', position: index === 1 ? null : line.position })),
        // Positions 0,0,2,3,4: duplicate + gap → invalid, never silently re-sequenced.
        ...lines('gl-02').map((line, index) => ({ ...line, recipeId: 'bad-position', position: index === 1 ? 0 : line.position })),
        ...lines('gl-12'),
      ],
      steps: [
        ...steps('gl-02').map((step) => ({ ...step, recipeId: 'bad-servings' })),
        ...steps('gl-03').map((step) => ({ ...step, recipeId: 'blank-description' })),
        ...steps('gl-04').map((step) => ({ ...step, recipeId: 'no-media' })),
        ...steps('gl-05').map((step) => ({ ...step, recipeId: 'no-fields' })),
        ...steps('vn-canh-01').map((step) => ({ ...step, recipeId: 'marker-conflict' })),
        ...steps('gl-06').map((step) => ({ ...step, recipeId: 'bad-unit' })),
        ...steps('gl-07').map((step) => ({ ...step, recipeId: 'bad-region' })),
        ...steps('gl-08').map((step) => ({ ...step, recipeId: 'bad-cuisine' })),
        ...steps('gl-09').map((step) => ({ ...step, recipeId: 'dup' })),
        ...steps('gl-10').map((step) => ({ ...step, recipeId: 'dup-tag' })),
        ...steps('gl-11').map((step) => ({ ...step, recipeId: 'dup-step', stepNumber: 1 })),
        ...steps('gl-01').map((step) => ({ ...step, recipeId: 'no-order' })),
        ...steps('gl-01').map((step) => ({ ...step, recipeId: 'neg-order' })),
        ...steps('gl-01').map((step) => ({ ...step, recipeId: 'dup-order-a' })),
        ...steps('gl-01').map((step) => ({ ...step, recipeId: 'dup-order-b' })),
        ...steps('gl-02').map((step) => ({ ...step, recipeId: 'no-position' })),
        ...steps('gl-02').map((step) => ({ ...step, recipeId: 'bad-position' })),
        ...steps('gl-12'),
      ],
      nutritionRecipeIds: [],
      runtimeFields: [
        { ...fields('gl-01'), recipeId: 'stub-01' },
        { ...fields('gl-02'), recipeId: 'bad-servings' },
        { ...fields('gl-03'), recipeId: 'no-steps' },
        { ...fields('gl-03'), recipeId: 'blank-description' },
        { ...fields('gl-04'), recipeId: 'no-media' },
        // Typed row says region 'bac' while the 0006 tag marker still says 'nam' → conflict, not a silent pick.
        { ...fields('vn-canh-01'), recipeId: 'marker-conflict', region: 'bac' },
        { ...fields('gl-06'), recipeId: 'bad-unit' },
        { ...fields('gl-07'), recipeId: 'bad-region', region: 'mars' },
        { ...fields('gl-08'), recipeId: 'bad-cuisine' },
        { ...fields('gl-09'), recipeId: 'dup' },
        { ...fields('gl-10'), recipeId: 'dup-tag' },
        { ...fields('gl-11'), recipeId: 'dup-step' },
        { ...fields('gl-01'), recipeId: 'no-order', runtimeOrder: null },
        { ...fields('gl-01'), recipeId: 'neg-order', runtimeOrder: -1 },
        { ...fields('gl-01'), recipeId: 'dup-order-a', runtimeOrder: 500 },
        { ...fields('gl-01'), recipeId: 'dup-order-b', runtimeOrder: 500 },
        { ...fields('gl-02'), recipeId: 'no-position', runtimeOrder: 501 },
        { ...fields('gl-02'), recipeId: 'bad-position', runtimeOrder: 502 },
        fields('gl-12'),
      ],
    };
    const result = hydrateRuntimeRecipes(synthetic);
    expect(result.recipes.map((recipe) => recipe.id)).toEqual(['gl-12']);
    expect(result.recipes[0]).toStrictEqual(toRuntimeRecipe(GLOBAL_RECIPES.find((recipe) => recipe.id === 'gl-12')!));
    expect(result.failures.map((failure) => [failure.id, failure.code])).toEqual([
      ['bad-cuisine', 'invalid_cuisine'],
      ['bad-position', 'invalid_ingredient_position'],
      ['bad-region', 'invalid_region'],
      ['bad-servings', 'rejected_entry'],
      ['bad-unit', 'rejected_entry'],
      ['blank-description', 'incomplete_entry'],
      ['dup', 'duplicate_recipe_id'],
      ['dup-order-a', 'duplicate_runtime_order'],
      ['dup-order-b', 'duplicate_runtime_order'],
      ['dup-step', 'duplicate_step_number'],
      ['dup-tag', 'invalid_tags'],
      ['marker-conflict', 'legacy_marker_conflict'],
      ['neg-order', 'invalid_runtime_order'],
      ['no-fields', 'missing_runtime_fields'],
      ['no-media', 'missing_media_compatibility'],
      ['no-order', 'missing_runtime_order'],
      ['no-position', 'missing_ingredient_position'],
      ['no-steps', 'incomplete_entry'],
      ['stub-01', 'fk_stub'],
    ]);
    expect(result.failures.find((failure) => failure.id === 'no-position')?.reasons).toEqual([lines('gl-02')[1].ingredientId]);
    expect(result.classifications.find((item) => item.id === 'stub-01')).toMatchObject({ state: 'incomplete', fkStub: true });
    expect(result.classifications.find((item) => item.id === 'bad-servings')).toMatchObject({ state: 'rejected' });
    // Unknown units are rejected by the foundation contract itself, naming the offending line path.
    expect(result.failures.find((failure) => failure.id === 'bad-unit')?.reasons).toEqual(['invalid:ingredients.0.unit']);
    // The failing rows are reported, never auto-repaired: the snapshot is untouched.
    expect(synthetic.recipes.find((row) => row.id === 'stub-01')?.description).toBeNull();
    // Shadow diagnostics surface the failures without inventing recipes.
    const diagnostics = compareRuntimeCatalogs(GLOBAL_RECIPES, synthetic);
    expect(diagnostics.hydrationFailureCount).toBe(19);
    expect(diagnostics.staticOnly).toEqual(GLOBAL_IDS.filter((id) => id !== 'gl-12'));
  });

  it('ingredient order is carried by explicit positions, not lexical row IDs: a 12-line recipe round-trips 1..12', async () => {
    const db = database();
    const ingredientIds = db.query<{ id: string }>('SELECT id FROM ingredients ORDER BY id LIMIT 12').map((row) => row.id);
    expect(ingredientIds).toHaveLength(12);
    const synthetic: Recipe = {
      id: 'gl-99', slug: 'twelve-lines', title: 'Twelve lines', description: 'Synthetic order regression', cuisine: 'thai',
      cookTimeMinutes: 10, servings: 2, difficulty: 'easy', imageUrl: '/frigo/recipes/global/pad-krapow.webp',
      nutrition: { calories: 1, proteinG: 1, fatG: 1, carbG: 1 }, tags: ['synthetic'],
      ingredients: ingredientIds.map((ingredientId, index) => ({ ingredientId, name: `Line ${index + 1}`, requiredQuantity: index + 1, unit: 'g' })),
      steps: [{ stepNumber: 1, instruction: 'Mix.' }],
    };
    // Persist through the same renderer that produced 0034 (appended as the 72nd runtime recipe) so the
    // seed IDs are exactly `<id>_ing_1 .. _ing_12` — lexically `_ing_1, _ing_10, _ing_11, _ing_12, _ing_2, …`.
    db.seed(renderGlobalRecipeParitySql([...GLOBAL_RECIPES, synthetic], [...ALL_RECIPES, synthetic]));
    const lexical = db.query<{ id: string }>("SELECT id FROM recipe_ingredients WHERE recipe_id = 'gl-99' ORDER BY id").map((row) => row.id);
    expect(lexical.slice(0, 5)).toEqual(['gl-99_ing_1', 'gl-99_ing_10', 'gl-99_ing_11', 'gl-99_ing_12', 'gl-99_ing_2']);

    const snapshot = await readRecipeContent(db);
    const hydration = hydrateRuntimeRecipes(snapshot);
    expect(hydration.failures).toEqual([]);
    expect(hydration.recipes).toHaveLength(72);
    expect(hydration.recipes.at(-1)?.id).toBe('gl-99');
    const hydrated = hydration.recipes.at(-1)!;
    expect(hydrated.ingredients.map((line) => line.requiredQuantity)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(hydrated.ingredients).toStrictEqual(synthetic.ingredients);
    expect(hydrated).toStrictEqual(toRuntimeRecipe(synthetic));
    // Without the position mapping the same rows would hydrate lexically — and must fail closed instead.
    const unmapped: D1RecipeContentSnapshot = {
      ...snapshot, requirements: snapshot.requirements.map((line) => (line.recipeId === 'gl-99' ? { ...line, position: null } : line)),
    };
    expect(hydrateRuntimeRecipes(unmapped).failures).toEqual([{ id: 'gl-99', code: 'missing_ingredient_position', reasons: [...ingredientIds].sort() }]);
    // The existing 71 recipes are untouched by the synthetic addition.
    expect(hydration.recipes.slice(0, 71)).toStrictEqual(ALL_RECIPES.map(toRuntimeRecipe));
  });

  it('a live FK anchor for a not-yet-seeded recipe stays excluded and is never repaired by hydration', async () => {
    const db = database();
    db.seed(`INSERT OR IGNORE INTO recipes (id, slug, title, cuisine, cook_time_minutes, servings, difficulty)
      VALUES ('gl-99', 'future-anchor', 'Future', 'thai', 10, 2, 'easy')`);
    const before = db.query('SELECT * FROM recipes WHERE id = ?', 'gl-99');
    const result = hydrateRuntimeRecipes(await readRecipeContent(db));
    expect(result.recipes).toHaveLength(71);
    expect(result.failures).toEqual([{ id: 'gl-99', code: 'fk_stub', reasons: ['fk_anchor_shape', 'no_description', 'no_requirements'] }]);
    expect(db.query('SELECT * FROM recipes WHERE id = ?', 'gl-99')).toEqual(before);
  });
});
