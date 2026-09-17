import { describe, expect, it } from 'vitest';
import { readRecipeContent } from '../../packages/db/src/recipe-content';
import { mapRankingNutritionRead, prepareRankingNutritionRead } from '../../packages/db/src/ranking-nutrition';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { compileImportBatch, IMPORT_ARTIFACT_FILES, type CompileResult } from '../../packages/recipes/src/import/compiler';
import { canonicalBatchProjection, composeCatalogRelease, computeBatchHash, type ApprovedBatchContent } from '../../packages/recipes/src/import/release-manifest';
import { nutritionProfileId } from '../../packages/recipes/src/import/sql-render';
import { D1RecipeAuthority, StaticRecipeAuthority } from '../../packages/recipes/src/recipe-authority';
import { hydrateRuntimeRecipes } from '../../packages/recipes/src/runtime-hydration';
import { encode, toJsonl, validBatch } from '../helpers/recipe-import-fixtures';
import { SqliteD1 } from '../helpers/sqlite-d1';

/**
 * T14E remediation (review P1/P2/P3): nutrition evidence survives end-to-end and is persisted as
 * ADR-004 nutrition_profiles evidence; the immutable batch hash commits to ALL reviewed metadata
 * (schema version, license, usage note, nutrition evidence, duplicate-review decisions) while
 * ignoring file noise; release-manifest failures are classified RELEASE_MANIFEST_INVALID.
 */

const legacy = ALL_RECIPES;
type Batch = ReturnType<typeof validBatch>;
const compile = (batch: Batch, format: 'json' | 'jsonl' = 'json') =>
  compileImportBatch(format === 'json' ? encode(batch) : toJsonl(batch), format, { legacy });
const ok = (result: CompileResult) => { expect(result.ok, JSON.stringify(result.issues.slice(0, 3))).toBe(true); return result; };
const normalized = (result: CompileResult) => JSON.parse(result.artifacts.get(IMPORT_ARTIFACT_FILES.normalized)!);
/** rec-001 carries nutrition evidence in the fixture; rec-002 does not. */
const NUTRITION_RECORD = 1; // physical index in valid-batch.json (batchOrder 0)

async function identities(batch: Batch) {
  const result = ok(await compile(batch));
  return { result, batchHash: result.batchHash!, releaseId: result.releaseManifest!.releaseId, fingerprint: result.releaseManifest!.expectedRuntimeFingerprint };
}

describe('T14E remediation — nutrition evidence round trip (P1)', () => {
  it('evidence survives parse → normalize → normalized artifact → batch projection → SQL; macros stay runtime semantics', async () => {
    const batch = validBatch();
    (batch.recipes[NUTRITION_RECORD].nutrition as Record<string, unknown>).evidence = 'nutrition-source-A';
    const result = ok(await compile(batch));
    const recipe = result.recipes[0];
    expect(recipe.runtime.nutrition).toEqual({ calories: 520, proteinG: 24, fatG: 40, carbG: 6 });
    expect(recipe.nutritionEvidence).toEqual({ calories: 520, proteinG: 24, fatG: 40, carbG: 6, evidence: 'nutrition-source-A', sourceType: 'imported' });
    expect(result.recipes[1].nutritionEvidence).toBeNull();
    expect(result.recipes[1].runtime.nutrition).toBeUndefined();
    // Normalized artifact carries the evidence (auditable), the runtime block only the macros.
    const artifact = normalized(result);
    expect(artifact.recipes[0].nutritionEvidence).toEqual(recipe.nutritionEvidence);
    expect(artifact.recipes[0].runtime.nutrition).toEqual({ calories: 520, proteinG: 24, fatG: 40, carbG: 6 });
    expect(JSON.stringify(artifact.recipes[0].runtime)).not.toContain('nutrition-source-A');
    // Canonical projection commits to it.
    expect(canonicalBatchProjection(result.header!, result.recipes)).toContain('"evidence":"nutrition-source-A"');
    // SQL persists it as ADR-004 evidence, per serving, linked at recipe version 1, plain INSERT.
    const sql = result.artifacts.get(IMPORT_ARTIFACT_FILES.migration)!;
    expect(sql).toContain(`INSERT INTO nutrition_profiles (id, basis_quantity, basis_unit, source_type, source_reference, energy_kcal, protein_g, carbohydrate_g, fat_g) VALUES\n('${nutritionProfileId(recipe.runtime.id)}', 1, 'serving', 'imported', 'nutrition-source-A', 520, 24, 6, 40);`);
    expect(sql).toContain(`INSERT INTO recipe_nutrition (recipe_id, recipe_version, nutrition_profile_id) VALUES\n('${recipe.runtime.id}', 1, '${nutritionProfileId(recipe.runtime.id)}');`);
    expect(sql).not.toContain(`${result.recipes[1].runtime.id}_nutrition_v1`); // no profile without evidence
    expect(sql).not.toMatch(/ON CONFLICT/);
    // Applied to a real replay: the D1 reader still hydrates, the ranking nutrition reader sees the evidence, and the readiness fingerprint is unaffected by the profile.
    const db = new SqliteD1();
    try {
      db.seed(sql);
      const content = await readRecipeContent(db);
      expect(content.nutritionRecipeIds).toContain(recipe.runtime.id);
      const hydrated = hydrateRuntimeRecipes(content);
      expect(hydrated.failures).toEqual([]);
      expect(hydrated.recipes.find((item) => item.id === recipe.runtime.id)?.nutrition).toEqual(recipe.runtime.nutrition);
      const rows = await db.batch(prepareRankingNutritionRead(db));
      const profile = (rows[0].results as Array<Record<string, unknown>>).find((row) => row.recipe_id === recipe.runtime.id);
      expect(profile).toMatchObject({ profile_id: nutritionProfileId(recipe.runtime.id), basis_unit: 'serving', source_type: 'imported', source_reference: 'nutrition-source-A', energy_kcal: 520, protein_g: 24, carbohydrate_g: 6, fat_g: 40 });
      expect(typeof mapRankingNutritionRead).toBe('function'); // the existing reader consumes this table; no parallel nutrition system
      const staticAuthority = new StaticRecipeAuthority(legacy, () => 1);
      const loaded = await new D1RecipeAuthority(() => readRecipeContent(db), staticAuthority, () => 2, () => result.releaseManifest!).load();
      expect(loaded.status).toBe('ready');
    } finally { db.close(); }
  });

  it('a reviewer-declared nutrition sourceType is preserved; evidence cannot be blank; an invalid enum is rejected', async () => {
    const batch = validBatch();
    (batch.recipes[NUTRITION_RECORD].nutrition as Record<string, unknown>).sourceType = 'calculated';
    const result = ok(await compile(batch));
    expect(result.recipes[0].nutritionEvidence?.sourceType).toBe('calculated');
    expect(result.artifacts.get(IMPORT_ARTIFACT_FILES.migration)).toContain(`'serving', 'calculated', 'fixture-nutrition-table v1'`);
    const blank = validBatch();
    (blank.recipes[NUTRITION_RECORD].nutrition as Record<string, unknown>).evidence = '   ';
    expect((await compile(blank)).issues.map((issue) => issue.code)).toEqual(['INVALID_SCHEMA']);
    const badType = validBatch();
    (badType.recipes[NUTRITION_RECORD].nutrition as Record<string, unknown>).sourceType = 'guessed';
    expect((await compile(badType)).issues.map((issue) => issue.code)).toEqual(['INVALID_SCHEMA']);
  });

  it('the compiler fails closed if macros ever reach the canonical model without evidence (regression guard)', async () => {
    const result = ok(await compile(validBatch()));
    const stripped = result.recipes.map((recipe) => ({ ...recipe, nutritionEvidence: null }));
    const { renderImportBatchSql } = await import('../../packages/recipes/src/import/sql-render');
    expect(() => renderImportBatchSql({ batchId: 'x', batchHash: 'h', releaseBaseCount: 71, recipes: stripped })).toThrow(/evidence must both be present or both absent/);
    const mismatched = result.recipes.map((recipe) => (recipe.nutritionEvidence ? { ...recipe, nutritionEvidence: { ...recipe.nutritionEvidence, calories: 1 } } : recipe));
    expect(() => renderImportBatchSql({ batchId: 'x', batchHash: 'h', releaseBaseCount: 71, recipes: mismatched })).toThrow(/differ from runtime macros/);
  });
});

describe('T14E remediation — immutable batch hash covers all reviewed metadata (P2)', () => {
  it('mutating nutrition evidence changes batchHash and releaseId but not the runtime fingerprint', async () => {
    const a = validBatch(); (a.recipes[NUTRITION_RECORD].nutrition as Record<string, unknown>).evidence = 'source-A';
    const b = validBatch(); (b.recipes[NUTRITION_RECORD].nutrition as Record<string, unknown>).evidence = 'source-B';
    const [ia, ib] = await Promise.all([identities(a), identities(b)]);
    expect(ia.batchHash).not.toBe(ib.batchHash);
    expect(ia.releaseId).not.toBe(ib.releaseId);
    expect(ia.fingerprint).toBe(ib.fingerprint); // evidence is provenance, not runtime content
    expect(ia.result.recipes[0].contentFingerprint).toBe(ib.result.recipes[0].contentFingerprint);
  });

  it('mutating license changes batchHash and releaseId', async () => {
    const a = validBatch(); a.source.license = 'commercial allowed';
    const b = validBatch(); b.source.license = 'non-commercial';
    const [ia, ib] = await Promise.all([identities(a), identities(b)]);
    expect(ia.batchHash).not.toBe(ib.batchHash);
    expect(ia.releaseId).not.toBe(ib.releaseId);
    expect(normalized(ia.result).source.license).toBe('commercial allowed');
    const none = validBatch(); delete (none.source as Record<string, unknown>).license;
    const inone = await identities(none);
    expect(inone.batchHash).not.toBe(ia.batchHash);
    expect(normalized(inone.result).source.license).toBeNull();
  });

  it('mutating usageNote changes batchHash and releaseId', async () => {
    const a = validBatch(); a.source.usageNote = 'A';
    const b = validBatch(); b.source.usageNote = 'B';
    const [ia, ib] = await Promise.all([identities(a), identities(b)]);
    expect(ia.batchHash).not.toBe(ib.batchHash);
    expect(ia.releaseId).not.toBe(ib.releaseId);
    expect(normalized(ia.result).source.usageNote).toBe('A');
  });

  it('mutating a duplicate-review reason changes batchHash and releaseId; both remain publishable; the decision is in the normalized model', async () => {
    const source = legacy.find((recipe) => recipe.id === 'gl-03')!;
    const clone = (reason: string): Batch => {
      const batch = validBatch();
      batch.recipes = [{
        sourceRecordId: 'clone-1', batchOrder: 0, verificationState: 'reviewed', title: source.title, description: source.description, slug: 'clone-slug',
        cuisine: source.cuisine, cookTimeMinutes: source.cookTimeMinutes, servings: source.servings, difficulty: source.difficulty, imageUrl: source.imageUrl,
        ingredients: source.ingredients.map((line) => ({ text: line.name, ingredientId: line.ingredientId, quantity: line.requiredQuantity, unit: line.unit, ...(line.isOptional ? { isOptional: true } : {}) })),
        steps: source.steps.map((step) => ({ stepNumber: step.stepNumber, instruction: step.instruction, ...(step.tip ? { tip: step.tip } : {}), ...(step.timerMinutes ? { timerMinutes: step.timerMinutes } : {}) })),
        tags: source.tags, duplicateReview: { decision: 'distinct', reason },
      }];
      return batch;
    };
    const [ia, ib] = await Promise.all([identities(clone('distinct because A')), identities(clone('distinct because B'))]);
    expect(ia.result.duplicateReport.possible[0]).toMatchObject({ waived: true, reason: 'distinct because A' });
    expect(ia.batchHash).not.toBe(ib.batchHash);
    expect(ia.releaseId).not.toBe(ib.releaseId);
    expect(ia.fingerprint).toBe(ib.fingerprint);
    expect(ia.result.recipes[0].duplicateReview).toEqual({ decision: 'distinct', reason: 'distinct because A' });
    expect(normalized(ia.result).recipes[0].duplicateReview).toEqual({ decision: 'distinct', reason: 'distinct because A' });
    expect(canonicalBatchProjection(ia.result.header!, ia.result.recipes)).toContain('"reason":"distinct because A"');
    expect(normalized(ok(await compile(validBatch()))).recipes[0].duplicateReview).toBeNull();
  });

  it('schemaVersion participates in the canonical projection (tested on the projection, not by accepting v2 input)', async () => {
    const result = ok(await compile(validBatch()));
    const v1 = canonicalBatchProjection(result.header!, result.recipes);
    const v2 = canonicalBatchProjection({ ...result.header!, schemaVersion: 2 as unknown as 1 }, result.recipes);
    expect(v1).toContain('"schemaVersion":1');
    expect(v1).not.toBe(v2);
    for (const key of ['"sourceType":"curated"', '"sourceNamespace":"fixture.editorial"', '"sourceReference":"T14E synthetic fixture batch A (test-only, no real recipes)"', '"license":"internal-test-fixture"', '"usageNote":', '"provenance":', '"classifications":', '"nutritionEvidence":', '"duplicateReview":', '"runtime":']) {
      expect(v1, key).toContain(key);
    }
    expect(v1).not.toMatch(/inputSha256|row:|\\.json|\d{4}-\d{2}-\d{2}T/);
    // Compile, verify and release composition all use this one function.
    expect(await computeBatchHash(result.header!, result.recipes)).toBe(result.batchHash);
    const composed = await composeCatalogRelease(legacy, [{ header: result.header!, recipes: result.recipes }]);
    expect(composed.manifest.approvedImportBatches[0].batchHash).toBe(result.batchHash);
    expect(composed.manifest).toEqual(result.releaseManifest);
  });

  it('physical row order and JSON whitespace/key order are irrelevant: same semantic batch ⇒ same hash, releaseId and migration.sql', async () => {
    const base = ok(await compile(validBatch()));
    const reversed = validBatch(); reversed.recipes.reverse();
    const byRows = ok(await compile(reversed));
    const pretty = new TextEncoder().encode(JSON.stringify(validBatch(), null, 4));
    const byWhitespace = ok(await compileImportBatch(pretty, 'json', { legacy }));
    const rekeyed = JSON.parse(JSON.stringify(validBatch()), (_key, value) => (value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).reverse()) : value));
    const byKeys = ok(await compileImportBatch(encode(rekeyed), 'json', { legacy }));
    const jsonl = ok(await compile(validBatch(), 'jsonl'));
    for (const other of [byRows, byWhitespace, byKeys, jsonl]) {
      expect(other.batchHash).toBe(base.batchHash);
      expect(other.releaseManifest!.releaseId).toBe(base.releaseManifest!.releaseId);
      expect(other.artifacts.get(IMPORT_ARTIFACT_FILES.migration)).toBe(base.artifacts.get(IMPORT_ARTIFACT_FILES.migration));
      expect(other.artifacts.get(IMPORT_ARTIFACT_FILES.normalized)).toBe(base.artifacts.get(IMPORT_ARTIFACT_FILES.normalized));
    }
    expect(byWhitespace.inputSha256).not.toBe(base.inputSha256); // only the raw input hash sees formatting
  });

  it('an approved batch whose reviewed metadata changed is rejected during release composition (BATCH_COLLISION)', async () => {
    const approved = ok(await compile(validBatch()));
    const content: ApprovedBatchContent = { header: approved.header!, recipes: approved.recipes };
    const withLicense: ApprovedBatchContent = { header: { ...content.header, source: { ...content.header.source, license: 'changed' } }, recipes: content.recipes };
    await expect(composeCatalogRelease(legacy, [content, withLicense])).rejects.toMatchObject({ code: 'BATCH_COLLISION' });
    const withEvidence: ApprovedBatchContent = { header: content.header, recipes: content.recipes.map((recipe) => (recipe.nutritionEvidence ? { ...recipe, nutritionEvidence: { ...recipe.nutritionEvidence, evidence: 'other' } } : recipe)) };
    await expect(composeCatalogRelease(legacy, [content, withEvidence])).rejects.toMatchObject({ code: 'BATCH_COLLISION' });
    const withReview: ApprovedBatchContent = { header: content.header, recipes: content.recipes.map((recipe, index) => (index === 0 ? { ...recipe, duplicateReview: { decision: 'distinct', reason: 'late waiver' } } : recipe)) };
    await expect(composeCatalogRelease(legacy, [content, withReview])).rejects.toMatchObject({ code: 'BATCH_COLLISION' });
    // A later batch compiled against the mutated approval sees a different release than against the original.
    const original = await composeCatalogRelease(legacy, [content]);
    const mutated = await composeCatalogRelease(legacy, [withLicense]);
    expect(mutated.manifest.releaseId).not.toBe(original.manifest.releaseId);
    expect(mutated.manifest.expectedRuntimeFingerprint).toBe(original.manifest.expectedRuntimeFingerprint);
  });
});

describe('T14E remediation — release manifest failure telemetry (P3)', () => {
  it('a throwing release supplier is RELEASE_MANIFEST_INVALID (error), a throwing D1 read stays D1_READ_FAILED', async () => {
    const db = new SqliteD1();
    try {
      const content = await readRecipeContent(db);
      const staticAuthority = new StaticRecipeAuthority(legacy, () => 1);
      const manifestBroken = await new D1RecipeAuthority(() => Promise.resolve(content), staticAuthority, () => 2, () => { throw new SyntaxError('bad json'); }).load();
      expect(manifestBroken).toEqual({ status: 'error', snapshot: null, readiness: { status: 'error', source: 'd1', code: 'RELEASE_MANIFEST_INVALID', error: 'SyntaxError' } });
      const readBroken = await new D1RecipeAuthority(() => Promise.reject(new Error('boom')), staticAuthority, () => 2).load();
      expect(readBroken).toMatchObject({ status: 'error', snapshot: null, readiness: { code: 'D1_READ_FAILED', error: 'Error' } });
      // Both fail before the manifest matters when the read fails: the read error wins.
      const bothBroken = await new D1RecipeAuthority(() => Promise.reject(new Error('boom')), staticAuthority, () => 2, () => { throw new Error('x'); }).load();
      expect(bothBroken).toMatchObject({ status: 'error', readiness: { code: 'D1_READ_FAILED' } });
    } finally { db.close(); }
  });
});
