import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readRecipeContent, RECIPE_CONTENT_READ_STATEMENT_COUNT } from '../../packages/db/src/recipe-content';
import { CANONICAL_INGREDIENTS } from '../../packages/domain/src';
import { classifyCatalogEntry } from '../../packages/recipes/src/catalog-entry';
import { fingerprintRecipes } from '../../packages/recipes/src/catalog-fingerprint';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { IMPORT_ARTIFACT_FILES } from '../../packages/recipes/src/import/compiler';
import { normalizeTitleKey } from '../../packages/recipes/src/import/duplicates';
import { computeBatchHash, composeCatalogRelease, serializeCatalogReleaseManifest } from '../../packages/recipes/src/import/release-manifest';
import { IMPORT_SQL_MAX_STATEMENT_BYTES } from '../../packages/recipes/src/import/sql-render';
import { assessD1Readiness, currentCatalogRelease, D1RecipeAuthority, StaticRecipeAuthority } from '../../packages/recipes/src/recipe-authority';
import { hydrateRuntimeRecipes } from '../../packages/recipes/src/runtime-hydration';
import { RUNTIME_RECIPE_CUISINES } from '../../packages/recipes/src/runtime-recipe';
import { compileApprovedBatches, LEGACY_BASELINE_FINGERPRINT, readApprovedBatchRegistry, type CompiledApprovedBatch } from '../helpers/recipe-catalog-growth';
import { LEGACY_CATALOG_MIGRATION_TIP, MIGRATION_LEDGER, SqliteD1 } from '../helpers/sqlite-d1';

/**
 * T14F — REAL catalog growth certification. Every assertion here runs against the committed reviewed
 * source batches (`data/recipe-import/t14f/*.jsonl`), the committed migrations they were promoted to,
 * and the committed Catalog Release Manifest. The legacy 71 (`ALL_RECIPES`) stay the static baseline.
 */
const root = process.cwd();
const sha256 = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const migrationFiles = () => readdirSync(path.join(root, 'migrations')).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
const staticAuthority = new StaticRecipeAuthority(ALL_RECIPES, () => 1);

let compiledCache: Promise<CompiledApprovedBatch[]> | null = null;
const compiled = () => (compiledCache ??= compileApprovedBatches());
const registry = readApprovedBatchRegistry();
const expectedTotal = 71 + registry.reduce((total, entry) => total + entry.recipeCount, 0);

describe('T14F — reviewed source batches (real data, committed)', () => {
  it('registry: every approved batch has a committed source, a committed migration and the expected size; batch identity is stable', async () => {
    expect(registry.length).toBeGreaterThanOrEqual(1);
    expect(registry[0]).toMatchObject({ batchId: 't14f-pilot-30-v1', source: 'data/recipe-import/t14f/pilot-30.jsonl', migration: '0036_recipe_catalog_pilot.sql', recipeCount: 30 });
    expect(registry.map((entry) => entry.migration)).toEqual(MIGRATION_LEDGER.catalogGrowth);
    for (const { entry, result } of await compiled()) {
      expect(result.ok, entry.batchId).toBe(true);
      expect(result.header!.batchId).toBe(entry.batchId);
      expect(result.recipes).toHaveLength(entry.recipeCount);
      expect(result.summary).toMatchObject({ inputRecords: entry.recipeCount, valid: entry.recipeCount, invalid: 0, publishable: entry.recipeCount, duplicates: 0, unresolvedIngredients: 0, unsupportedCuisine: 0, errors: 0 });
      expect(result.issues).toEqual([]);
      // Identity comes from sourceNamespace:sourceRecordId only, never from batchOrder/title/slug.
      expect(result.header!.source).toMatchObject({ sourceType: 'ai_generated', sourceNamespace: 'frigo.t14f.original.v1' });
      expect(result.header!.source.license).toBeTruthy();
      expect(result.header!.source.usageNote).toBeTruthy();
      for (const recipe of result.recipes) {
        expect(recipe.runtime.id).toMatch(/^imp-[0-9a-f]{16}$/);
        expect(recipe.provenance).toEqual({ sourceType: 'ai_generated', sourceReference: result.header!.source.sourceReference, verificationState: 'reviewed', version: 1 });
        expect(recipe.batchOrder).toBeGreaterThanOrEqual(0);
        expect(recipe.batchOrder).toBeLessThan(entry.recipeCount);
      }
      expect(result.recipes.map((recipe) => recipe.batchOrder)).toEqual(Array.from({ length: entry.recipeCount }, (_, index) => index));
      expect(result.batchHash).toBe(await computeBatchHash(result.header!, result.recipes));
    }
  });

  it('source quality: canonical ingredients only, supported units, closed cuisines, no nutrition without evidence, plausible servings/time, distinct titles', async () => {
    const canonical = new Set(CANONICAL_INGREDIENTS.map((ingredient) => ingredient.id));
    const titles = new Map<string, string>();
    for (const legacy of ALL_RECIPES) titles.set(normalizeTitleKey(legacy.title), legacy.id);
    for (const { result } of await compiled()) {
      for (const recipe of result.recipes) {
        const r = recipe.runtime;
        expect(RUNTIME_RECIPE_CUISINES).toContain(r.cuisine);
        expect(r.ingredients.length).toBeGreaterThanOrEqual(3);
        expect(r.steps.length).toBeGreaterThanOrEqual(3);
        for (const line of r.ingredients) {
          expect(canonical.has(line.ingredientId), `${r.id} ${line.ingredientId}`).toBe(true);
          expect(['g', 'kg', 'ml', 'l', 'piece', 'pack', 'bunch', 'slice']).toContain(line.unit);
          expect(line.requiredQuantity).toBeGreaterThan(0);
        }
        expect(new Set(r.ingredients.map((line) => line.ingredientId)).size).toBe(r.ingredients.length);
        expect(r.steps.map((step) => step.stepNumber)).toEqual(r.steps.map((_step, index) => index + 1));
        expect(r.servings).toBeGreaterThanOrEqual(1); expect(r.servings).toBeLessThanOrEqual(8);
        expect(r.cookTimeMinutes).toBeGreaterThanOrEqual(5); expect(r.cookTimeMinutes).toBeLessThanOrEqual(240);
        expect(['easy', 'medium', 'hard']).toContain(r.difficulty);
        // No fabricated nutrition: project-original recipes carry no macros and no evidence rows.
        expect(r.nutrition).toBeUndefined();
        expect(recipe.nutritionEvidence).toBeNull();
        expect(r.imageUrl).toBe('/frigo/illustrations/delicious-meal.png');
        expect(r.tags.length).toBeGreaterThan(0); expect(r.tags.length).toBeLessThanOrEqual(6);
        expect(new Set(r.tags).size).toBe(r.tags.length);
        for (const entry of recipe.classifications) expect(['meal_type', 'dietary', 'allergen', 'method', 'equipment', 'suitability']).toContain(entry.kind);
        expect(recipe.classifications.some((entry) => entry.kind === 'allergen' || entry.kind === 'dietary')).toBe(false); // no unevidenced claims
        const key = normalizeTitleKey(r.title);
        expect(titles.has(key), `title collision: ${r.title} vs ${titles.get(key)}`).toBe(false);
        titles.set(key, r.id);
        if (r.cuisine === 'vietnamese') { expect(r.category).toMatch(/^mon_/); expect(r.region).toBeDefined(); } else { expect(r.region).toBeUndefined(); }
      }
    }
  });

  it('compile is deterministic (byte-identical artifacts across two compiles) and the SQL stays under the hosted D1 statement limit', async () => {
    const first = await compiled();
    const second = await compileApprovedBatches();
    for (const [index, batch] of first.entries()) {
      for (const name of Object.values(IMPORT_ARTIFACT_FILES)) expect(batch.result.artifacts.get(name), `${batch.entry.batchId}/${name}`).toBe(second[index].result.artifacts.get(name));
      const sql = batch.result.artifacts.get(IMPORT_ARTIFACT_FILES.migration)!;
      const statements = sql.split(/;\n/).flatMap((piece) => (piece.includes('INSERT INTO ') ? [`${piece.slice(piece.indexOf('INSERT INTO '))};`] : []));
      expect(Math.max(...statements.map((statement) => Buffer.byteLength(statement, 'utf8')))).toBeLessThanOrEqual(IMPORT_SQL_MAX_STATEMENT_BYTES);
      expect(sql).not.toMatch(/^(UPDATE|DELETE|DROP|ALTER|CREATE)\b/m);
    }
  });
});

describe('T14F — migrations are the promoted T14E artifacts (additive, immutable history)', () => {
  it('each committed growth migration is byte-identical to the compiler render of its reviewed batch; 0001–0035 unchanged', async () => {
    const files = migrationFiles();
    expect(files).toHaveLength(MIGRATION_LEDGER.count);
    expect(files.slice(35)).toEqual(MIGRATION_LEDGER.catalogGrowth);
    for (const { entry, result } of await compiled()) {
      const committed = readFileSync(path.join(root, 'migrations', entry.migration), 'utf8');
      expect(committed).toBe(result.artifacts.get(IMPORT_ARTIFACT_FILES.migration));
      expect(committed).toContain(`batch_hash=${result.batchHash}`);
      expect(committed).toContain('0035_recipe_media_layer.sql');
    }
    const pinned = JSON.parse(readFileSync(path.join(root, 'tests/fixtures/migration-sha256.json'), 'utf8')).migrations as Record<string, string>;
    for (const [name, expected] of Object.entries(pinned)) expect(sha256(readFileSync(path.join(root, 'migrations', name))), name).toBe(expected);
    expect(pinned).not.toHaveProperty('0036_recipe_catalog_pilot.sql'); // pinned only after production apply
  });

  it('the runtime order of each batch continues the release: legacy 0..70, then releaseBaseCount + batchOrder', async () => {
    let base = 71;
    for (const { entry, result } of await compiled()) {
      const sql = result.artifacts.get(IMPORT_ARTIFACT_FILES.migration)!;
      expect(sql).toContain(`runtime_order=${base}..${base + entry.recipeCount - 1}`);
      expect(result.releaseManifest!.approvedImportBatches.at(-1)).toMatchObject({ batchId: entry.batchId, releaseBaseCount: base, recipeCount: entry.recipeCount });
      base += entry.recipeCount;
    }
    expect(base).toBe(expectedTotal);
  });
});

describe('T14F — fresh SQLite replay of the full ledger (0001 → tip)', () => {
  const databases: SqliteD1[] = [];
  const database = (options?: { migrate?: boolean; through?: string }) => { const db = new SqliteD1(options); databases.push(db); return db; };
  afterEach(() => { for (const db of databases.splice(0)) db.close(); });
  const n = (db: SqliteD1, sql: string) => db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${sql}`)[0].n;

  it(`recipes=${expectedTotal}: legacy 71 + imported ${expectedTotal - 71}; contiguous runtime order; complete rows; pending hero media; FK/quick_check clean`, async () => {
    const db = database();
    expect(db.migrations.at(-1)).toBe(MIGRATION_LEDGER.tip);
    expect(n(db, 'recipes')).toBe(expectedTotal);
    expect(n(db, "recipes WHERE id NOT LIKE 'imp-%'")).toBe(71);
    expect(n(db, "recipes WHERE id LIKE 'imp-%'")).toBe(expectedTotal - 71);
    expect(n(db, "recipes WHERE id LIKE 'imp-%' AND source_type = 'ai_generated' AND verification_state = 'reviewed' AND version = 1")).toBe(expectedTotal - 71);
    expect(n(db, 'recipe_runtime_fields')).toBe(expectedTotal);
    expect(db.query('SELECT MIN(runtime_order) AS lo, MAX(runtime_order) AS hi, COUNT(DISTINCT runtime_order) AS d FROM recipe_runtime_fields')[0]).toEqual({ lo: 0, hi: expectedTotal - 1, d: expectedTotal });
    // Every ingredient line has exactly one position and positions are 0..N-1 per recipe; steps are 1..N.
    expect(n(db, 'recipe_ingredients l WHERE NOT EXISTS (SELECT 1 FROM recipe_runtime_ingredient_order o WHERE o.recipe_ingredient_id = l.id)')).toBe(0);
    expect(n(db, '(SELECT recipe_id FROM recipe_runtime_ingredient_order GROUP BY recipe_id HAVING MIN(position) <> 0 OR MAX(position) <> COUNT(*) - 1)')).toBe(0);
    expect(n(db, '(SELECT recipe_id FROM recipe_steps GROUP BY recipe_id HAVING MIN(step_number) <> 1 OR MAX(step_number) <> COUNT(*) OR COUNT(DISTINCT step_number) <> COUNT(*))')).toBe(0);
    expect(n(db, 'recipes r WHERE NOT EXISTS (SELECT 1 FROM recipe_steps s WHERE s.recipe_id = r.id)')).toBe(0);
    expect(n(db, 'recipe_ingredients l WHERE NOT EXISTS (SELECT 1 FROM ingredients i WHERE i.id = l.ingredient_id)')).toBe(0);
    // Media: one pending hero v1 slot per recipe, nothing ready (T14C promotion untouched).
    expect(db.query("SELECT COUNT(*) AS total, SUM(status = 'pending') AS pending, SUM(status = 'ready') AS ready, SUM(role = 'hero' AND version = 1) AS hero FROM recipe_media")[0]).toEqual({ total: expectedTotal, pending: expectedTotal, ready: 0, hero: expectedTotal });
    expect(n(db, 'recipes r WHERE (SELECT COUNT(*) FROM recipe_media m WHERE m.recipe_id = r.id) <> 1')).toBe(0);
    // No fabricated nutrition rows for project-original recipes.
    expect(n(db, "recipe_nutrition WHERE recipe_id LIKE 'imp-%'")).toBe(0);
    expect(n(db, "recipe_runtime_fields WHERE recipe_id LIKE 'imp-%' AND legacy_calories IS NOT NULL")).toBe(0);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
    expect(db.query('PRAGMA quick_check')).toEqual([{ quick_check: 'ok' }]);
    const counts = {
      recipes: n(db, 'recipes'), recipe_ingredients: n(db, 'recipe_ingredients'), recipe_steps: n(db, 'recipe_steps'),
      recipe_runtime_fields: n(db, 'recipe_runtime_fields'), recipe_runtime_ingredient_order: n(db, 'recipe_runtime_ingredient_order'),
      recipe_classifications: n(db, 'recipe_classifications'), nutrition_profiles: n(db, 'nutrition_profiles'), recipe_nutrition: n(db, 'recipe_nutrition'),
      recipe_media: n(db, 'recipe_media'),
    };
    expect(counts.recipe_ingredients).toBe(counts.recipe_runtime_ingredient_order);
    console.log(`T14F catalog counts: ${JSON.stringify(counts)}`);
  });

  it('every entry classifies complete (no fkStub, no incomplete, no rejected) and hydrates without failures', async () => {
    const db = database();
    const content = await readRecipeContent(db);
    const hydration = hydrateRuntimeRecipes(content);
    expect(hydration.failures).toEqual([]);
    expect(hydration.recipes).toHaveLength(expectedTotal);
    const states = hydration.classifications.reduce((acc, entry) => ({ ...acc, [entry.fkStub ? 'fkStub' : entry.state]: (acc[entry.fkStub ? 'fkStub' : entry.state] ?? 0) + 1 }), {} as Record<string, number>);
    expect(states).toEqual({ complete: expectedTotal });
    expect(hydration.classifications).toHaveLength(expectedTotal);
    expect(hydration.classifications.every((entry) => entry.state === 'complete' && !entry.fkStub && entry.reasons.length === 0)).toBe(true);
    // classifyCatalogEntry itself still rejects a stub-shaped imported row (guards the hydrator's classification path).
    expect(classifyCatalogEntry({ recipe: { id: 'imp-0000000000000000', slug: 'x', title: 'x', cuisine: 'thai', cookTimeMinutes: 1, servings: 1, difficulty: 'easy' }, stepCount: 0 })).toMatchObject({ fkStub: true });
    // Legacy prefix is byte-equal to ALL_RECIPES; imported recipes follow in batch order.
    expect(hydration.recipes.slice(0, 71)).toStrictEqual((await staticAuthority.load()).list());
    expect(await fingerprintRecipes(hydration.recipes.slice(0, 71))).toBe(LEGACY_BASELINE_FINGERPRINT);
    const imported = (await compiled()).flatMap((batch) => batch.result.recipes.map((recipe) => recipe.runtime));
    expect(hydration.recipes.slice(71)).toStrictEqual(imported);
  });

  it('upgrade path: a populated 0035 ledger (production shape) receives the growth migrations without touching legacy rows or user data', () => {
    const db = database({ through: LEGACY_CATALOG_MIGRATION_TIP });
    db.seed(`INSERT INTO users (id, email) VALUES ('t14f_user', 't14f@example.test');
      INSERT INTO households (id, name, created_by) VALUES ('t14f_hh', 'T14F', 't14f_user');
      INSERT INTO inventory_items (id, household_id, ingredient_id, name, quantity, unit, category, storage, freshness, data_source)
      VALUES ('t14f_item', 't14f_hh', 'CHICKEN_EGG', 'Trứng gà', 6, 'piece', 'egg', 'fridge', 'fresh', 'manual');`);
    expect(n(db, 'recipes')).toBe(71);
    const legacyBefore = db.query("SELECT * FROM recipes WHERE id NOT LIKE 'imp-%' ORDER BY id");
    const fieldsBefore = db.query("SELECT * FROM recipe_runtime_fields WHERE recipe_id NOT LIKE 'imp-%' ORDER BY recipe_id");
    const mediaBefore = db.query("SELECT * FROM recipe_media WHERE recipe_id NOT LIKE 'imp-%' ORDER BY id");
    const other = () => db.query('SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM households) AS households, (SELECT COUNT(*) FROM inventory_items) AS items, (SELECT COUNT(*) FROM inventory_events) AS events, (SELECT COUNT(*) FROM meal_plans) AS plans')[0];
    const otherBefore = other();
    for (const file of MIGRATION_LEDGER.catalogGrowth) db.seed(readFileSync(path.join(root, 'migrations', file), 'utf8'));
    expect(n(db, 'recipes')).toBe(expectedTotal);
    expect(db.query("SELECT * FROM recipes WHERE id NOT LIKE 'imp-%' ORDER BY id")).toEqual(legacyBefore);
    expect(db.query("SELECT * FROM recipe_runtime_fields WHERE recipe_id NOT LIKE 'imp-%' ORDER BY recipe_id")).toEqual(fieldsBefore);
    expect(db.query("SELECT * FROM recipe_media WHERE recipe_id NOT LIKE 'imp-%' ORDER BY id")).toEqual(mediaBefore);
    expect(other()).toEqual(otherBefore);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
    // Plain INSERT: re-applying a growth migration aborts instead of duplicating or overwriting.
    expect(() => db.seed(readFileSync(path.join(root, 'migrations', MIGRATION_LEDGER.catalogGrowth[0]), 'utf8'))).toThrow(/UNIQUE|PRIMARY KEY/i);
    expect(n(db, 'recipes')).toBe(expectedTotal);
  });

  it('production forward path 0034 → 0035 → growth: a 0034-tip database applies the same chain and lands on the same catalog', () => {
    expect(MIGRATION_LEDGER.catalogGrowth).toEqual(['0036_recipe_catalog_pilot.sql', '0037_recipe_catalog_scale.sql']);
    const files = migrationFiles();
    const fresh = database();
    const staged = database({ migrate: false });
    for (const file of files.slice(0, 34)) staged.seed(readFileSync(path.join(root, 'migrations', file), 'utf8'));
    expect(files[33]).toBe('0034_global_recipe_catalog_parity.sql');
    expect(staged.query<{ n: number }>("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'recipe_media'")[0].n).toBe(0);
    for (const file of files.slice(34)) staged.seed(readFileSync(path.join(root, 'migrations', file), 'utf8'));
    // Independent replays generate different recipes.created_at values from SQLite's clock.
    const recipeColumns = ['id', 'slug', 'title', 'description', 'cuisine', 'cook_time_minutes', 'servings', 'difficulty', 'image_url', 'tags', 'family_id', 'prep_time_minutes', 'source_type', 'source_reference', 'verification_state', 'version'];
    expect(fresh.query<{ name: string }>('PRAGMA table_info(recipes)').map((column) => column.name).sort()).toEqual([...recipeColumns, 'created_at'].sort());
    const recipes = (db: SqliteD1) => db.query(`SELECT ${recipeColumns.join(', ')} FROM recipes ORDER BY id`);
    expect(recipes(staged)).toEqual(recipes(fresh));
    // These tables have no clock-derived defaults; retain every column, including row identities.
    for (const table of ['recipe_ingredients', 'recipe_steps', 'recipe_runtime_fields', 'recipe_runtime_ingredient_order', 'recipe_classifications']) {
      expect(staged.query(`SELECT * FROM ${table} ORDER BY 1, 2`), table).toEqual(fresh.query(`SELECT * FROM ${table} ORDER BY 1, 2`));
    }
    // recipe_media carries insertion timestamps; compare the identity/status projection.
    const media = (db: SqliteD1) => db.query('SELECT id, recipe_id, role, version, status, storage_key FROM recipe_media ORDER BY id');
    expect(media(staged)).toEqual(media(fresh));

    // Exercise the exclusion without relying on a replay crossing a wall-clock second.
    staged.seed("UPDATE recipes SET created_at = '2000-01-01 00:00:00'");
    expect(staged.query('SELECT id, created_at FROM recipes ORDER BY id')).not.toEqual(fresh.query('SELECT id, created_at FROM recipes ORDER BY id'));
    expect(recipes(staged)).toEqual(recipes(fresh));
    staged.seed("UPDATE recipes SET title = title || ' drift'");
    expect(recipes(staged)).not.toEqual(recipes(fresh));
  });

  it('T14F-C: a certified pilot-tip database (0036, 101 recipes) receives 0037 alone and lands on the 500 catalog with legacy + pilot rows byte-preserved', () => {
    const pilotTip = MIGRATION_LEDGER.catalogGrowth[0];
    const scale = MIGRATION_LEDGER.catalogGrowth[1];
    const db = database({ through: pilotTip });
    expect(n(db, 'recipes')).toBe(101);
    expect(db.query<{ n: number }>("SELECT COUNT(*) AS n FROM recipes WHERE id LIKE 'imp-%'")[0].n).toBe(30);
    const before = db.query('SELECT * FROM recipes ORDER BY id');
    const fieldsBefore = db.query('SELECT * FROM recipe_runtime_fields ORDER BY recipe_id');
    const mediaBefore = db.query('SELECT id, recipe_id, role, version, status, storage_key FROM recipe_media ORDER BY id');
    db.seed(readFileSync(path.join(root, 'migrations', scale), 'utf8'));
    expect(n(db, 'recipes')).toBe(500);
    expect(n(db, 'recipe_runtime_fields')).toBe(500);
    // Existing 101 rows are untouched; the 399 new rows continue the runtime order 101..499 without gaps.
    const beforeIds = new Set(before.map((row: any) => row.id));
    expect(db.query('SELECT * FROM recipes ORDER BY id').filter((row: any) => beforeIds.has(row.id))).toEqual(before);
    expect(db.query('SELECT * FROM recipe_runtime_fields ORDER BY recipe_id').filter((row: any) => beforeIds.has(row.recipe_id))).toEqual(fieldsBefore);
    expect(db.query('SELECT id, recipe_id, role, version, status, storage_key FROM recipe_media ORDER BY id').filter((row: any) => beforeIds.has(row.recipe_id))).toEqual(mediaBefore);
    const order = db.query<{ lo: number; hi: number; uniq: number }>('SELECT MIN(runtime_order) AS lo, MAX(runtime_order) AS hi, COUNT(DISTINCT runtime_order) AS uniq FROM recipe_runtime_fields')[0];
    expect(order).toEqual({ lo: 0, hi: 499, uniq: 500 });
    expect(db.query<{ lo: number; hi: number }>("SELECT MIN(f.runtime_order) AS lo, MAX(f.runtime_order) AS hi FROM recipe_runtime_fields f JOIN recipes r ON r.id = f.recipe_id WHERE r.source_reference LIKE '%t14f-scale-399-v1%'")[0]).toEqual({ lo: 101, hi: 499 });
    expect(db.query<{ n: number }>('SELECT COUNT(DISTINCT id) AS n FROM recipes')[0].n).toBe(500);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
    expect(db.query<{ quick_check: string }>('PRAGMA quick_check')).toEqual([{ quick_check: 'ok' }]);
    // 0037 is a plain additive INSERT: a second application aborts on the primary key instead of duplicating rows.
    expect(() => db.seed(readFileSync(path.join(root, 'migrations', scale), 'utf8'))).toThrow(/UNIQUE|PRIMARY KEY/i);
    expect(n(db, 'recipes')).toBe(500);
  });
});

describe('T14F — Catalog Release Manifest and D1 readiness on the grown ledger', () => {
  const databases: SqliteD1[] = [];
  const database = (options?: { through?: string }) => { const db = new SqliteD1(options); databases.push(db); return db; };
  afterEach(() => { for (const db of databases.splice(0)) db.close(); });

  it(`shipped manifest: legacy 71 (fingerprint unchanged) + ${registry.length} approved batch(es) = ${expectedTotal}; generated, not hand-edited`, async () => {
    const manifest = currentCatalogRelease();
    const composed = (await composeCatalogRelease(ALL_RECIPES, (await compiled()).map((batch) => batch.content))).manifest;
    expect(readFileSync(path.join(root, 'packages/recipes/src/import/catalog-release.current.json'), 'utf8')).toBe(serializeCatalogReleaseManifest(composed));
    expect(manifest).toEqual(composed);
    expect(manifest).toMatchObject({ legacyBaselineCount: 71, legacyBaselineFingerprint: LEGACY_BASELINE_FINGERPRINT, expectedRecipeCount: expectedTotal });
    expect(manifest.approvedImportBatches.map((batch) => ({ batchId: batch.batchId, recipeCount: batch.recipeCount }))).toEqual(registry.map((entry) => ({ batchId: entry.batchId, recipeCount: entry.recipeCount })));
    for (const [index, batch] of (await compiled()).entries()) expect(manifest.approvedImportBatches[index].batchHash).toBe(batch.result.batchHash);
    expect(new Set(manifest.orderedRecipeIds).size).toBe(expectedTotal);
    expect(manifest.expectedRuntimeFingerprint).not.toBe(LEGACY_BASELINE_FINGERPRINT);
  });

  it('D1 readiness is READY on the full ledger with the shipped manifest; static stays 71', async () => {
    const db = database();
    const content = await readRecipeContent(db);
    const baseline = await staticAuthority.load();
    expect(baseline.size).toBe(71);
    const { readiness, recipes } = await assessD1Readiness(baseline, hydrateRuntimeRecipes(content));
    expect(readiness).toEqual({ status: 'ready', source: 'd1', fingerprint: currentCatalogRelease().expectedRuntimeFingerprint, recipeCount: expectedTotal, releaseId: currentCatalogRelease().releaseId });
    expect(recipes.map((recipe) => recipe.id)).toEqual(currentCatalogRelease().orderedRecipeIds);
    const loaded = await new D1RecipeAuthority(() => Promise.resolve(content), staticAuthority, () => 2).load();
    expect(loaded.status).toBe('ready');
    if (loaded.status === 'ready') { expect(loaded.snapshot.size).toBe(expectedTotal); expect(loaded.snapshot.source).toBe('d1'); }
  });

  it('negative controls fail closed: one fewer / one extra recipe, wrong imported ID, wrong order, legacy mutation, imported mutation, stub row, pilot-only DB vs full manifest', async () => {
    const baseline = await staticAuthority.load();
    const manifest = currentCatalogRelease();
    const importedIds = manifest.orderedRecipeIds.slice(71);
    const assess = async (db: SqliteD1, release = manifest) => (await assessD1Readiness(baseline, hydrateRuntimeRecipes(await readRecipeContent(db)), release)).readiness;
    const fresh = () => database();

    const last = importedIds.at(-1)!;
    let db = fresh();
    db.seed(`DELETE FROM recipe_media WHERE recipe_id = '${last}'; DELETE FROM recipe_classifications WHERE recipe_id = '${last}'; DELETE FROM recipe_runtime_ingredient_order WHERE recipe_id = '${last}';
      DELETE FROM recipe_runtime_fields WHERE recipe_id = '${last}'; DELETE FROM recipe_steps WHERE recipe_id = '${last}'; DELETE FROM recipe_ingredients WHERE recipe_id = '${last}'; DELETE FROM recipes WHERE id = '${last}'`);
    expect(await assess(db)).toMatchObject({ status: 'not_ready', code: 'COUNT_DRIFT', detail: { expectedCount: expectedTotal, actualCount: expectedTotal - 1 } });

    db = fresh();
    db.seed(`INSERT INTO recipes (id, slug, title, description, cuisine, cook_time_minutes, servings, difficulty, image_url, tags, source_type, source_reference, verification_state, version)
      VALUES ('imp-ffffffffffffffff', 'stray-extra', 'Stray', 'Stray extra row', 'thai', 10, 2, 'easy', '/frigo/illustrations/delicious-meal.png', '[]', 'ai_generated', 'stray', 'reviewed', 1);
      INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, name, required_quantity, unit, is_optional) VALUES ('imp-ffffffffffffffff_ing_1', 'imp-ffffffffffffffff', 'RICE', 'Gạo', 100, 'g', 0);
      INSERT INTO recipe_runtime_ingredient_order (recipe_ingredient_id, recipe_id, position) VALUES ('imp-ffffffffffffffff_ing_1', 'imp-ffffffffffffffff', 0);
      INSERT INTO recipe_steps (id, recipe_id, step_number, instruction) VALUES ('imp-ffffffffffffffff_step_1', 'imp-ffffffffffffffff', 1, 'Stray step');
      INSERT INTO recipe_runtime_fields (recipe_id, runtime_order) VALUES ('imp-ffffffffffffffff', ${expectedTotal});`);
    expect(await assess(db)).toMatchObject({ status: 'not_ready', code: 'COUNT_DRIFT', detail: { actualCount: expectedTotal + 1 } });

    db = fresh();
    db.seed(`PRAGMA foreign_keys = OFF;
      UPDATE recipes SET id = 'imp-0000000000000000' WHERE id = '${importedIds[0]}';
      UPDATE recipe_ingredients SET recipe_id = 'imp-0000000000000000' WHERE recipe_id = '${importedIds[0]}';
      UPDATE recipe_runtime_ingredient_order SET recipe_id = 'imp-0000000000000000' WHERE recipe_id = '${importedIds[0]}';
      UPDATE recipe_steps SET recipe_id = 'imp-0000000000000000' WHERE recipe_id = '${importedIds[0]}';
      UPDATE recipe_runtime_fields SET recipe_id = 'imp-0000000000000000' WHERE recipe_id = '${importedIds[0]}';
      UPDATE recipe_classifications SET recipe_id = 'imp-0000000000000000' WHERE recipe_id = '${importedIds[0]}';
      UPDATE recipe_media SET recipe_id = 'imp-0000000000000000' WHERE recipe_id = '${importedIds[0]}';
      PRAGMA foreign_keys = ON;`);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
    expect(await assess(db)).toMatchObject({ status: 'not_ready', code: 'ID_DRIFT', detail: { idDriftSample: [importedIds[0], 'imp-0000000000000000'] } });

    db = fresh();
    db.seed(`UPDATE recipe_runtime_fields SET runtime_order = 100000 WHERE recipe_id = '${importedIds[0]}';
      UPDATE recipe_runtime_fields SET runtime_order = 71 WHERE recipe_id = '${importedIds[1]}';
      UPDATE recipe_runtime_fields SET runtime_order = 72 WHERE recipe_id = '${importedIds[0]}';`);
    expect(await assess(db)).toMatchObject({ status: 'not_ready', code: 'ORDER_DRIFT' });

    db = fresh(); db.seed("UPDATE recipes SET title = title || ' (edited)' WHERE id = 'vn-canh-01'");
    expect(await assess(db)).toMatchObject({ status: 'not_ready', code: 'LEGACY_BASELINE_DRIFT', detail: { fieldDriftSample: [{ id: 'vn-canh-01', fields: ['title'] }] } });

    db = fresh(); db.seed(`UPDATE recipe_ingredients SET required_quantity = required_quantity + 1 WHERE recipe_id = '${importedIds[3]}' AND id LIKE '%_ing_1'`);
    expect(await assess(db)).toMatchObject({ status: 'not_ready', code: 'FINGERPRINT_DRIFT' });

    // An imported row stripped of its content is a stub/incomplete entry: hydration fails closed, never "repairs" it.
    db = fresh();
    db.seed(`DELETE FROM recipe_runtime_ingredient_order WHERE recipe_id = '${importedIds[2]}'; DELETE FROM recipe_ingredients WHERE recipe_id = '${importedIds[2]}'; DELETE FROM recipe_steps WHERE recipe_id = '${importedIds[2]}'; UPDATE recipes SET description = NULL WHERE id = '${importedIds[2]}'`);
    const stubbed = await assess(db);
    expect(stubbed).toMatchObject({ status: 'not_ready', code: 'CATALOG_DIAGNOSTICS', detail: { hydrationFailureCount: 1 } });
    if (stubbed.status === 'not_ready') expect(['fk_stub', 'rejected_entry', 'incomplete_entry']).toContain(stubbed.detail.hydrationFailureSample[0].code);
    // The exact 7-column FK anchor shape (cooking/shopping INSERT OR IGNORE) is classified fk_stub.
    db = fresh();
    db.seed(`DELETE FROM recipe_media WHERE recipe_id = '${importedIds[2]}'; DELETE FROM recipe_classifications WHERE recipe_id = '${importedIds[2]}'; DELETE FROM recipe_runtime_ingredient_order WHERE recipe_id = '${importedIds[2]}'; DELETE FROM recipe_ingredients WHERE recipe_id = '${importedIds[2]}'; DELETE FROM recipe_steps WHERE recipe_id = '${importedIds[2]}';
      UPDATE recipes SET description = NULL, image_url = NULL, tags = NULL, source_type = 'legacy', source_reference = NULL, verification_state = 'unverified' WHERE id = '${importedIds[2]}'`);
    expect(await assess(db)).toMatchObject({ status: 'not_ready', code: 'CATALOG_DIAGNOSTICS', detail: { hydrationFailureSample: [{ id: importedIds[2], code: 'fk_stub' }] } });

    // Stale 71 manifest against the grown DB, and the grown manifest against a legacy-only DB.
    db = fresh();
    expect(await assess(db, (await composeCatalogRelease(ALL_RECIPES, [])).manifest)).toMatchObject({ status: 'not_ready', code: 'COUNT_DRIFT', detail: { expectedCount: 71, actualCount: expectedTotal } });
    const legacyOnly = database({ through: LEGACY_CATALOG_MIGRATION_TIP });
    expect(await assess(legacyOnly)).toMatchObject({ status: 'not_ready', code: 'COUNT_DRIFT', detail: { expectedCount: expectedTotal, actualCount: 71 } });
    // A partially applied release (pilot only) must never certify against a manifest that expects more batches.
    if (registry.length > 1) {
      const pilotOnly = database({ through: MIGRATION_LEDGER.catalogGrowth[0] });
      expect(await assess(pilotOnly)).toMatchObject({ status: 'not_ready', code: 'COUNT_DRIFT', detail: { actualCount: 71 + registry[0].recipeCount } });
    }
  });

  it('the D1 content reader stays a single five-statement batch regardless of catalog size (no N+1)', async () => {
    const db = database();
    const batches: number[] = []; let statements = 0;
    db.hooks = { beforeBatch: (batch) => { batches.push(batch.length); }, beforeStatement: () => { statements += 1; } };
    const content = await readRecipeContent(db);
    expect(batches).toEqual([RECIPE_CONTENT_READ_STATEMENT_COUNT]);
    expect(RECIPE_CONTENT_READ_STATEMENT_COUNT).toBe(5);
    expect(statements).toBe(0);
    expect(content.recipes).toHaveLength(expectedTotal);
  });
});
