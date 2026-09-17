import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readRecipeContent } from '../../packages/db/src/recipe-content';
import { fingerprintRecipes } from '../../packages/recipes/src/catalog-fingerprint';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { compileImportBatch, IMPORT_ARTIFACT_FILES } from '../../packages/recipes/src/import/compiler';
import {
  CatalogCompositionError,
  composeCatalogRelease,
  computeBatchHash,
  deriveReleaseId,
  parseCatalogReleaseManifest,
  serializeCatalogReleaseManifest,
  type ApprovedBatchContent,
  type CatalogReleaseManifest,
} from '../../packages/recipes/src/import/release-manifest';
import { assessD1Readiness, currentCatalogRelease, D1RecipeAuthority, StaticRecipeAuthority } from '../../packages/recipes/src/recipe-authority';
import { hydrateRuntimeRecipes } from '../../packages/recipes/src/runtime-hydration';
import { encode, syntheticBatch } from '../helpers/recipe-import-fixtures';
import { SqliteD1 } from '../helpers/sqlite-d1';

/**
 * T14E — Catalog Release Manifest + growth-ready D1 readiness (ADR-027).
 * The static baseline never changes; expanded releases are built separately from synthetic batches
 * whose generated SQL is applied to a REAL SQLite replay of the 35 migrations, then read back through
 * the unchanged five-statement reader and hydrator.
 */

const root = process.cwd();
const CURRENT_MANIFEST_PATH = path.resolve(root, 'packages/recipes/src/import/catalog-release.current.json');
const staticAuthority = new StaticRecipeAuthority(ALL_RECIPES, () => 1);

async function compiledBatch(count: number, batchId: string, tag: string, approved: ApprovedBatchContent[] = [], seed = 7) {
  const result = await compileImportBatch(encode(syntheticBatch(count, batchId, tag, seed)), 'json', { legacy: ALL_RECIPES, approvedBatches: approved });
  expect(result.ok, JSON.stringify(result.issues.slice(0, 3))).toBe(true);
  return { result, content: { header: result.header!, recipes: result.recipes } satisfies ApprovedBatchContent };
}

describe('T14E — current Catalog Release Manifest (71, zero batches)', () => {
  it('committed manifest equals the manifest composed from ALL_RECIPES; it is the static fingerprint with no batches', async () => {
    const { manifest, recipes } = await composeCatalogRelease(ALL_RECIPES, []);
    expect(readFileSync(CURRENT_MANIFEST_PATH, 'utf8')).toBe(serializeCatalogReleaseManifest(manifest));
    expect(currentCatalogRelease()).toEqual(manifest);
    const baseline = await staticAuthority.load();
    expect(manifest).toMatchObject({ schemaVersion: 1, legacyBaselineCount: 71, expectedRecipeCount: 71, approvedImportBatches: [] });
    expect(manifest.orderedRecipeIds).toEqual(ALL_RECIPES.map((recipe) => recipe.id));
    expect(manifest.legacyBaselineFingerprint).toBe(baseline.fingerprint);
    expect(manifest.expectedRuntimeFingerprint).toBe(baseline.fingerprint);
    expect(manifest.releaseId).toBe(await deriveReleaseId(baseline.fingerprint, []));
    expect(recipes).toStrictEqual(baseline.list());
    // Deterministic: composing twice yields byte-identical text; drift is detected.
    expect(serializeCatalogReleaseManifest((await composeCatalogRelease(ALL_RECIPES, [])).manifest)).toBe(serializeCatalogReleaseManifest(manifest));
    const drifted = { ...manifest, orderedRecipeIds: [...manifest.orderedRecipeIds].reverse() };
    expect(serializeCatalogReleaseManifest(drifted)).not.toBe(readFileSync(CURRENT_MANIFEST_PATH, 'utf8'));
    expect(() => parseCatalogReleaseManifest({ ...manifest, expectedRecipeCount: 72 })).toThrow();
    expect(() => parseCatalogReleaseManifest({ ...manifest, orderedRecipeIds: [...manifest.orderedRecipeIds, 'vn-canh-01'] })).toThrow();
  });

  it('current D1 readiness is unchanged by the manifest: READY on the real ledger with the same fingerprint as T14D', async () => {
    const db = new SqliteD1();
    try {
      const content = await readRecipeContent(db);
      const baseline = await staticAuthority.load();
      const { readiness } = await assessD1Readiness(baseline, hydrateRuntimeRecipes(content));
      expect(readiness).toEqual({ status: 'ready', source: 'd1', fingerprint: baseline.fingerprint, recipeCount: 71, releaseId: currentCatalogRelease().releaseId });
      // Explicit equivalence: the manifest-driven assessment equals a manifest composed on the fly from the static baseline.
      const explicit = await assessD1Readiness(baseline, hydrateRuntimeRecipes(content), (await composeCatalogRelease(ALL_RECIPES, [])).manifest);
      expect(explicit.readiness).toEqual(readiness);
      const loaded = await new D1RecipeAuthority(() => Promise.resolve(content), staticAuthority, () => 2).load();
      expect(loaded.status).toBe('ready');
      if (loaded.status === 'ready') expect(loaded.snapshot.list()).toStrictEqual(baseline.list());
    } finally { db.close(); }
  });

  it('a manifest that does not describe this build\'s static baseline is RELEASE_MANIFEST_INVALID (stale metadata never certifies D1)', async () => {
    const db = new SqliteD1();
    try {
      const content = await readRecipeContent(db);
      const baseline = await staticAuthority.load();
      const { manifest } = await composeCatalogRelease(ALL_RECIPES.slice(0, 70), []);
      const { readiness } = await assessD1Readiness(baseline, hydrateRuntimeRecipes(content), manifest);
      expect(readiness).toMatchObject({ status: 'not_ready', code: 'RELEASE_MANIFEST_INVALID' });
      const broken = new D1RecipeAuthority(() => Promise.resolve(content), staticAuthority, () => 2, () => { throw new Error('bad json'); });
      expect(await broken.load()).toMatchObject({ status: 'error', snapshot: null, readiness: { code: 'D1_READ_FAILED' } });
    } finally { db.close(); }
  });
});

describe('T14E — expanded release readiness on a real SQLite replay (legacy 71 + synthetic imports)', () => {
  let db: SqliteD1;
  let manifest: CatalogReleaseManifest;
  let batchA: ApprovedBatchContent;
  let importedIds: string[];

  beforeEach(async () => {
    db = new SqliteD1();
    const { result, content } = await compiledBatch(6, 'synthetic-a', 'alpha');
    batchA = content;
    manifest = result.releaseManifest!;
    // Apply the generated migration SQL exactly as a future T14F promotion would (data-only, after 0035).
    db.seed(result.artifacts.get(IMPORT_ARTIFACT_FILES.migration)!);
    importedIds = result.recipes.map((recipe) => recipe.runtime.id);
  });
  afterEach(() => db.close());

  const assess = async (release = manifest) => {
    const content = await readRecipeContent(db);
    const baseline = await staticAuthority.load();
    return assessD1Readiness(baseline, hydrateRuntimeRecipes(content), release);
  };

  it('READY: D1 has 77 recipes, ALL_RECIPES is still 71, the manifest approves the extension and the release fingerprint matches', async () => {
    expect(ALL_RECIPES).toHaveLength(71);
    expect(manifest).toMatchObject({ legacyBaselineCount: 71, expectedRecipeCount: 77, approvedImportBatches: [{ batchId: 'synthetic-a', recipeCount: 6, releaseBaseCount: 71 }] });
    const { readiness, recipes } = await assess();
    expect(readiness).toMatchObject({ status: 'ready', recipeCount: 77, releaseId: manifest.releaseId, fingerprint: manifest.expectedRuntimeFingerprint });
    expect(recipes.map((recipe) => recipe.id)).toEqual([...ALL_RECIPES.map((recipe) => recipe.id), ...importedIds]);
    expect(recipes.slice(0, 71)).toStrictEqual((await staticAuthority.load()).list());
    expect(await fingerprintRecipes(recipes.slice(0, 71))).toBe(manifest.legacyBaselineFingerprint);
    // The five-statement reader + hydrator are untouched and the imported rows are complete entries.
    const hydration = hydrateRuntimeRecipes(await readRecipeContent(db));
    expect(hydration.failures).toEqual([]);
    expect(hydration.classifications.filter((entry) => entry.state !== 'complete')).toEqual([]);
    // Media: exactly one pending hero slot per imported recipe, nothing ready.
    const media = db.query<{ status: string; n: number }>(`SELECT status, COUNT(*) AS n FROM recipe_media WHERE recipe_id IN (${importedIds.map(() => '?').join(',')}) GROUP BY status`, ...importedIds);
    expect(media).toEqual([{ status: 'pending', n: 6 }]);
    const loaded = await new D1RecipeAuthority(() => readRecipeContent(db), staticAuthority, () => 3, () => manifest).load();
    expect(loaded.status).toBe('ready');
    if (loaded.status === 'ready') { expect(loaded.snapshot.size).toBe(77); expect(loaded.snapshot.findById(importedIds[0])?.id).toBe(importedIds[0]); }
  });

  it('NOT READY — unmanifested extra recipe (D1 78, manifest 77) → COUNT_DRIFT; also under today\'s 71 manifest', async () => {
    const { result } = await compiledBatch(1, 'stray', 'stray', [batchA], 101);
    db.seed(result.artifacts.get(IMPORT_ARTIFACT_FILES.migration)!);
    expect((await assess()).readiness).toMatchObject({ status: 'not_ready', code: 'COUNT_DRIFT', detail: { expectedCount: 77, actualCount: 78 } });
    expect((await assess(currentCatalogRelease())).readiness).toMatchObject({ status: 'not_ready', code: 'COUNT_DRIFT', detail: { expectedCount: 71, actualCount: 78 } });
  });

  it('NOT READY — missing imported recipe (manifest 77, D1 76) → COUNT_DRIFT; swapped ID → ID_DRIFT', async () => {
    db.execute('DELETE FROM recipes WHERE id = ?', [importedIds[3]]);
    expect((await assess()).readiness).toMatchObject({ status: 'not_ready', code: 'COUNT_DRIFT', detail: { expectedCount: 77, actualCount: 76 } });
    // Replace with a different recipe (same count, different ID set).
    const { result } = await compiledBatch(1, 'replacement', 'repl', [batchA], 202);
    db.seed(result.artifacts.get(IMPORT_ARTIFACT_FILES.migration)!);
    db.execute('UPDATE recipe_runtime_fields SET runtime_order = ? WHERE recipe_id = ?', [74, result.recipes[0].runtime.id]);
    const readiness = (await assess()).readiness;
    expect(readiness).toMatchObject({ status: 'not_ready', code: 'ID_DRIFT' });
    if (readiness.status === 'not_ready') expect(readiness.detail.idDriftSample).toEqual([importedIds[3], result.recipes[0].runtime.id]);
  });

  it('NOT READY — imported content drift → FINGERPRINT_DRIFT (legacy portion still matches)', async () => {
    db.execute('UPDATE recipe_steps SET instruction = instruction || ?  WHERE recipe_id = ? AND step_number = 1', [' (edited)', importedIds[2]]);
    const readiness = (await assess()).readiness;
    expect(readiness).toMatchObject({ status: 'not_ready', code: 'FINGERPRINT_DRIFT', detail: { legacyBaselineMatch: true, fingerprintMatch: false } });
    if (readiness.status === 'not_ready') {
      expect(readiness.detail.idDriftSample).toEqual(importedIds.slice(0, 5));
      expect(JSON.stringify(readiness.detail)).not.toMatch(/edited|Step 1 for/);
    }
  });

  it('NOT READY — legacy content drift inside an expanded release → LEGACY_BASELINE_DRIFT with the legacy ID sampled', async () => {
    db.execute('UPDATE recipes SET title = title || ? WHERE id = ?', [' (edited)', 'vn-canh-02']);
    const readiness = (await assess()).readiness;
    expect(readiness).toMatchObject({ status: 'not_ready', code: 'LEGACY_BASELINE_DRIFT', detail: { legacyBaselineMatch: false, expectedCount: 77, actualCount: 77 } });
    if (readiness.status === 'not_ready') expect(readiness.detail.fieldDriftSample).toEqual([{ id: 'vn-canh-02', fields: ['title'] }]);
  });

  it('NOT READY — imported order drift → ORDER_DRIFT; legacy order drift → ORDER_DRIFT', async () => {
    db.execute('UPDATE recipe_runtime_fields SET runtime_order = 1000 WHERE recipe_id = ?', [importedIds[0]]);
    db.execute('UPDATE recipe_runtime_fields SET runtime_order = 71 WHERE recipe_id = ?', [importedIds[1]]);
    db.execute('UPDATE recipe_runtime_fields SET runtime_order = 72 WHERE recipe_id = ?', [importedIds[0]]);
    const swapped = (await assess()).readiness;
    expect(swapped).toMatchObject({ status: 'not_ready', code: 'ORDER_DRIFT' });
    if (swapped.status === 'not_ready') expect(swapped.detail.orderDriftSample[0]).toEqual({ id: importedIds[0], expected: 71, actual: 72 });
  });

  it('NOT READY — hydration failure (imported row stripped to an FK stub shape) → CATALOG_DIAGNOSTICS', async () => {
    db.execute('DELETE FROM recipe_steps WHERE recipe_id = ?', [importedIds[4]]);
    const readiness = (await assess()).readiness;
    expect(readiness).toMatchObject({ status: 'not_ready', code: 'CATALOG_DIAGNOSTICS', detail: { hydrationFailureCount: 1, hydrationFailureSample: [{ id: importedIds[4], code: 'incomplete_entry' }] } });
  });

  it('a stale (pre-expansion) manifest is not fooled by extra rows: today\'s 71 manifest → COUNT_DRIFT, never READY', async () => {
    expect((await assess(currentCatalogRelease())).readiness).toMatchObject({ status: 'not_ready', code: 'COUNT_DRIFT' });
  });
});

describe('T14E — multi-batch composition and batch immutability', () => {
  it('legacy + A + B: stable order, IDs, fingerprint; recompile is byte-identical; batch hash is content-bound', async () => {
    const a = await compiledBatch(3, 'batch-a', 'alpha');
    const b = await compiledBatch(4, 'batch-b', 'beta', [a.content], 303);
    const release = await composeCatalogRelease(ALL_RECIPES, [a.content, b.content]);
    expect(release.manifest).toMatchObject({ expectedRecipeCount: 78, approvedImportBatches: [{ batchId: 'batch-a', recipeCount: 3, releaseBaseCount: 71 }, { batchId: 'batch-b', recipeCount: 4, releaseBaseCount: 74 }] });
    expect(release.manifest.orderedRecipeIds.slice(0, 71)).toEqual(ALL_RECIPES.map((recipe) => recipe.id));
    expect(release.manifest.orderedRecipeIds.slice(71)).toEqual([...a.result.recipes, ...b.result.recipes].map((recipe) => recipe.runtime.id));
    expect(b.result.releaseManifest).toEqual(release.manifest); // the compiler composes the same release
    const again = await composeCatalogRelease(ALL_RECIPES, [a.content, b.content]);
    expect(serializeCatalogReleaseManifest(again.manifest)).toBe(serializeCatalogReleaseManifest(release.manifest));
    // SQL for batch B starts its runtime_order after A.
    expect(b.result.artifacts.get(IMPORT_ARTIFACT_FILES.migration)).toContain(`runtime_order=74..77`);
    // Same batchId, byte-identical content ⇒ counted once; different content ⇒ BATCH_COLLISION.
    expect((await composeCatalogRelease(ALL_RECIPES, [a.content, a.content])).manifest.expectedRecipeCount).toBe(74);
    const mutated: ApprovedBatchContent = { header: a.content.header, recipes: a.content.recipes.map((recipe, index) => index === 0 ? { ...recipe, runtime: { ...recipe.runtime, title: 'changed' } } : recipe) };
    await expect(composeCatalogRelease(ALL_RECIPES, [a.content, mutated])).rejects.toThrow(CatalogCompositionError);
    expect(await computeBatchHash(mutated.header, mutated.recipes)).not.toBe(release.manifest.approvedImportBatches[0].batchHash);
    // Immutable approved batch: compiling B again against a MUTATED A yields a different release.
    const bAgainstMutated = await compileImportBatch(encode(syntheticBatch(4, 'batch-b', 'beta', 303)), 'json', { legacy: ALL_RECIPES, approvedBatches: [mutated] });
    expect(bAgainstMutated.releaseManifest?.releaseId).not.toBe(release.manifest.releaseId);
    // Cross-batch collisions fail closed.
    const aAgain = await compileImportBatch(encode(syntheticBatch(3, 'batch-a2', 'alpha')), 'json', { legacy: ALL_RECIPES, approvedBatches: [a.content] });
    expect(aAgain.ok).toBe(false);
    expect([...new Set(aAgain.issues.map((issue) => issue.code))].sort()).toEqual(['DUPLICATE_SOURCE']);
    await expect(composeCatalogRelease(ALL_RECIPES, [a.content, { header: { ...a.content.header, batchId: 'batch-a-copy' }, recipes: a.content.recipes }])).rejects.toThrow(CatalogCompositionError);
  });

  it('the composer refuses a batch whose batchOrder is not exactly 0..N-1', async () => {
    const a = await compiledBatch(2, 'batch-a', 'alpha');
    const gap: ApprovedBatchContent = { header: a.content.header, recipes: a.content.recipes.map((recipe) => ({ ...recipe, batchOrder: recipe.batchOrder + 1 })) };
    await expect(composeCatalogRelease(ALL_RECIPES, [gap])).rejects.toMatchObject({ code: 'BATCH_ORDER_INVALID' });
  });
});

describe('T14E — legacy FK-anchor interaction and collision policy', () => {
  it('an imported recipe can never be mistaken for an FK stub, and a pre-existing stub with an imported ID makes the import abort instead of upgrading it', async () => {
    const db = new SqliteD1();
    try {
      const { result } = await compiledBatch(2, 'anchor', 'anchor', [], 404);
      const target = result.recipes[0].runtime;
      // Cooking/shopping flows leave 7-column anchors for unknown IDs. Imported IDs live in the `imp-` namespace, so an
      // anchor only exists for an imported ID if some flow referenced it BEFORE promotion.
      db.execute('INSERT OR IGNORE INTO recipes (id, slug, title, cuisine, cook_time_minutes, servings, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [target.id, `${target.slug}-anchor`, target.title, target.cuisine, target.cookTimeMinutes, target.servings, target.difficulty]);
      const before = hydrateRuntimeRecipes(await readRecipeContent(db));
      expect(before.failures).toEqual([{ id: target.id, code: 'fk_stub', reasons: ['fk_anchor_shape', 'no_description', 'no_requirements'] }]);
      // Plain INSERT policy: the generated SQL aborts on the primary-key collision; nothing is silently overwritten.
      expect(() => db.seed(result.artifacts.get(IMPORT_ARTIFACT_FILES.migration)!)).toThrow(/UNIQUE|PRIMARY KEY/i);
      const after = hydrateRuntimeRecipes(await readRecipeContent(db));
      expect(after.recipes.map((recipe) => recipe.id)).toEqual(ALL_RECIPES.map((recipe) => recipe.id));
      expect(after.failures.map((failure) => failure.code)).toEqual(['fk_stub']);
    } finally { db.close(); }
  });

  it('imported IDs are outside every legacy namespace and match the T14C media identity rule', async () => {
    const { result } = await compiledBatch(5, 'ns', 'ns', [], 505);
    for (const recipe of result.recipes) {
      expect(recipe.runtime.id).toMatch(/^imp-[0-9a-f]{16}$/);
      expect(ALL_RECIPES.some((legacyRecipe) => legacyRecipe.id === recipe.runtime.id || legacyRecipe.slug === recipe.runtime.slug)).toBe(false);
    }
  });
});
