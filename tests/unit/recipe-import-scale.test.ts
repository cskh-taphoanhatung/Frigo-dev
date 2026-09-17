import { describe, expect, it } from 'vitest';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { compileImportBatch, IMPORT_ARTIFACT_FILES } from '../../packages/recipes/src/import/compiler';
import { IMPORT_SQL_MAX_STATEMENT_BYTES } from '../../packages/recipes/src/import/sql-render';
import { DuplicateIndex, catalogEntryFromRuntime } from '../../packages/recipes/src/import/duplicates';
import { composeCatalogRelease } from '../../packages/recipes/src/import/release-manifest';
import { encode, syntheticBatch, toJsonl } from '../helpers/recipe-import-fixtures';

/**
 * T14E scale evidence. Synthetic in-memory batches only (nothing committed). Assertions are
 * structural (determinism, bounded index sizes, linear row counts), never wall-clock thresholds.
 */

// Every second synthetic recipe carries evidence-backed nutrition so profile persistence is exercised at scale.
const scale = async (count: number, format: 'json' | 'jsonl' = 'json') => {
  const batch = syntheticBatch(count, `scale-${count}`, `s${count}`, 7, { nutritionEvery: 2 });
  const bytes = format === 'json' ? encode(batch) : toJsonl(batch);
  const result = await compileImportBatch(bytes, format, { legacy: ALL_RECIPES });
  expect(result.ok, JSON.stringify(result.issues.slice(0, 3))).toBe(true);
  return { batch, result };
};

describe('T14E — 500-recipe synthetic compile', () => {
  it('is deterministic (byte-identical across compiles and JSON/JSONL), publishes 500 recipes and a stable 571-recipe manifest', async () => {
    const first = await scale(500);
    const second = await scale(500);
    const jsonl = await scale(500, 'jsonl');
    for (const name of Object.values(IMPORT_ARTIFACT_FILES)) {
      expect(first.result.artifacts.get(name), name).toBe(second.result.artifacts.get(name));
      if (name !== IMPORT_ARTIFACT_FILES.artifact) expect(first.result.artifacts.get(name), name).toBe(jsonl.result.artifacts.get(name));
    }
    const artifact = JSON.parse(first.result.artifacts.get(IMPORT_ARTIFACT_FILES.artifact)!);
    expect(artifact).toMatchObject({ publishable: true, recipeCount: 500, errorCount: 0 });
    expect(first.result.releaseManifest).toMatchObject({ legacyBaselineCount: 71, expectedRecipeCount: 571 });
    expect(first.result.recipes.map((recipe) => recipe.batchOrder)).toEqual(Array.from({ length: 500 }, (_, index) => index));
    const sql = first.result.artifacts.get(IMPORT_ARTIFACT_FILES.migration)!;
    expect(sql).toContain('runtime_order=71..570');
    expect((sql.match(/_media_hero_v1'/g) ?? []).length).toBe(500);
    expect((sql.match(/_nutrition_v1'/g) ?? []).length).toBe(250 * 2);
    console.log(`T14E scale 500: recipes=${artifact.recipeCount} ingredient_lines=${artifact.ingredientLineCount} steps=${artifact.stepCount} nutrition_profiles=250 sql_bytes=${Buffer.byteLength(sql, 'utf8')}`);
  });

  it('reversing the physical row order changes nothing but the input hash', async () => {
    const batch = syntheticBatch(500, 'scale-500', 's500', 7, { nutritionEvery: 2 });
    const forward = await compileImportBatch(encode(batch), 'json', { legacy: ALL_RECIPES });
    batch.recipes.reverse();
    const backward = await compileImportBatch(encode(batch), 'json', { legacy: ALL_RECIPES });
    expect(backward.artifacts.get(IMPORT_ARTIFACT_FILES.migration)).toBe(forward.artifacts.get(IMPORT_ARTIFACT_FILES.migration));
    expect(backward.artifacts.get(IMPORT_ARTIFACT_FILES.release)).toBe(forward.artifacts.get(IMPORT_ARTIFACT_FILES.release));
    expect(backward.batchHash).toBe(forward.batchHash);
  });
});

describe('T14E — 5,000-recipe synthetic compile', () => {
  it('completes, stays publishable, and keeps duplicate/composition structures bounded (no N² scan)', async () => {
    const { result } = await scale(5000);
    const artifact = JSON.parse(result.artifacts.get(IMPORT_ARTIFACT_FILES.artifact)!);
    expect(artifact).toMatchObject({ publishable: true, recipeCount: 5000, errorCount: 0 });
    expect(result.releaseManifest).toMatchObject({ expectedRecipeCount: 5071 });
    expect(result.releaseManifest!.orderedRecipeIds).toHaveLength(5071);
    expect(new Set(result.releaseManifest!.orderedRecipeIds).size).toBe(5071);
    const sql = result.artifacts.get(IMPORT_ARTIFACT_FILES.migration)!;
    // Linear row counts: one recipes row, one media row, one runtime_fields row per recipe.
    expect((sql.match(/_media_hero_v1'/g) ?? []).length).toBe(5000);
    // T14F: multi-row INSERTs are chunked so no single statement exceeds the hosted D1 100 KB statement limit
    // (one recipes row per recipe ⇒ ≥ 5000/250 = 20 recipe statements); every statement stays under the budget.
    const statements = sql.split(/;\n/).flatMap((piece) => (piece.includes('INSERT INTO ') ? [`${piece.slice(piece.indexOf('INSERT INTO '))};`] : []));
    expect(statements.length).toBeGreaterThanOrEqual(9);
    expect(Math.max(...statements.map((statement) => Buffer.byteLength(statement, 'utf8')))).toBeLessThanOrEqual(IMPORT_SQL_MAX_STATEMENT_BYTES);
    expect(new Set(statements.map((statement) => statement.match(/^INSERT INTO (\w+)/m)![1])).size).toBe(9);
    expect((sql.match(/_nutrition_v1'/g) ?? []).length).toBe(2500 * 2); // profile row + link row per evidence-backed recipe
    expect(result.recipes.filter((recipe) => recipe.nutritionEvidence !== null)).toHaveLength(2500);
    console.log(`T14E scale 5000: recipes=${artifact.recipeCount} ingredient_lines=${artifact.ingredientLineCount} steps=${artifact.stepCount} nutrition_profiles=2500 sql_bytes=${Buffer.byteLength(sql, 'utf8')}`);
    // Duplicate index is a set of hash maps: one entry per recipe per key, i.e. O(N) memory and O(1) lookups.
    const index = new DuplicateIndex();
    for (const recipe of result.recipes) index.add(catalogEntryFromRuntime(recipe.runtime, recipe.contentFingerprint, 'batch', recipe.sourceKey));
    expect(index.size).toBe(5000);
    let probes = 0;
    for (const recipe of result.recipes) { if (index.hasId(recipe.runtime.id) && index.hasSlug(recipe.runtime.slug) && index.hasFingerprint(recipe.contentFingerprint)) probes += 1; }
    expect(probes).toBe(5000);
    // Composer over legacy + a 5,000 batch stays linear and matches the compiler's manifest.
    const composed = await composeCatalogRelease(ALL_RECIPES, [{ header: result.header!, recipes: result.recipes }]);
    expect(composed.manifest).toEqual(result.releaseManifest);
    expect(composed.recipes).toHaveLength(5071);
  }, 120_000);

  it('the duplicate detector compares by bucket, not pairwise: a batch with N recipes performs O(N) index operations', async () => {
    // Structural proof: DuplicateIndex exposes only keyed lookups; semanticCandidates returns bucket members only.
    const { result } = await scale(2000);
    const index = new DuplicateIndex();
    let bucketVisits = 0;
    for (const recipe of result.recipes) {
      const entry = catalogEntryFromRuntime(recipe.runtime, recipe.contentFingerprint, 'batch', recipe.sourceKey);
      bucketVisits += index.semanticCandidates(entry).length;
      index.add(entry);
    }
    // With distinct titles and signatures, every bucket holds at most a handful of entries — far below N²/2 (≈2,000,000).
    expect(bucketVisits).toBeLessThan(2000 * 4);
    const sql = result.artifacts.get(IMPORT_ARTIFACT_FILES.migration)!;
    const artifact = JSON.parse(result.artifacts.get(IMPORT_ARTIFACT_FILES.artifact)!);
    console.log(`T14E scale 2000: recipes=${artifact.recipeCount} ingredient_lines=${artifact.ingredientLineCount} steps=${artifact.stepCount} nutrition_profiles=1000 sql_bytes=${Buffer.byteLength(sql, 'utf8')}`);
  }, 60_000);
});
