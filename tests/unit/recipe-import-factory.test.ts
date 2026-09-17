import { describe, expect, it } from 'vitest';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { classifyCatalogEntry } from '../../packages/recipes/src/catalog-entry';
import { compileImportBatch, IMPORT_ARTIFACT_FILES, sortIssues } from '../../packages/recipes/src/import/compiler';
import { DuplicateIndex, canonicalEntryOf, detectDuplicates, normalizeTitleKey } from '../../packages/recipes/src/import/duplicates';
import { canonicalJson, deriveImportRecipeId, IMPORT_RECIPE_ID_PATTERN, isValidImportSlug } from '../../packages/recipes/src/import/identity';
import { createIngredientResolver } from '../../packages/recipes/src/import/ingredients';
import { IMPORT_IMAGE_PLACEHOLDER, normalizeTags } from '../../packages/recipes/src/import/normalize';
import { findDuplicateJsonKeys, importFormatForPath, parseImportInput } from '../../packages/recipes/src/import/parse';
import { IMPORT_LIMITS } from '../../packages/recipes/src/import/schema';
import { renderImportBatchSql, sqlText } from '../../packages/recipes/src/import/sql-render';
import { IMPORT_ISSUE_CODES, type ImportIssue } from '../../packages/recipes/src/import/types';
import { classifyLegacyImageUrl, isCanonicalRecipeIdShape } from '../../packages/recipes/src/recipe-media';
import { RuntimeRecipeSchema } from '../../packages/recipes/src/runtime-recipe';
import { encode, toJsonl, validBatch } from '../helpers/recipe-import-fixtures';

const legacy = ALL_RECIPES;
const compile = (batch: unknown, format: 'json' | 'jsonl' = 'json') =>
  compileImportBatch(format === 'json' ? encode(batch) : toJsonl(batch as { recipes: unknown[] } & Record<string, unknown>), format, { legacy });
const codes = (issues: ImportIssue[]) => [...new Set(issues.map((issue) => issue.code))].sort();
const withRecipe = (mutate: (record: Record<string, unknown>) => void, index = 0) => {
  const batch = validBatch();
  mutate(batch.recipes[index]);
  return batch;
};

describe('T14E import factory — parsing', () => {
  it('parses the valid JSON fixture and the equivalent JSONL; rejects unknown extensions', async () => {
    const json = await compile(validBatch());
    const jsonl = await compile(validBatch(), 'jsonl');
    expect(json.ok).toBe(true);
    expect(jsonl.ok).toBe(true);
    expect(jsonl.recipes.map((recipe) => recipe.runtime.id)).toEqual(json.recipes.map((recipe) => recipe.runtime.id));
    expect(jsonl.batchHash).toBe(json.batchHash);
    expect(importFormatForPath('a.json')).toBe('json');
    expect(importFormatForPath('a.JSONL')).toBe('jsonl');
    expect(importFormatForPath('a.csv')).toBeNull();
    expect(importFormatForPath('migrations/0036.sql')).toBeNull();
  });

  it('rejects invalid UTF-8, invalid JSON, non-object rows, duplicate keys and oversized records', () => {
    expect(parseImportInput(new Uint8Array([0xff, 0xfe, 0x7b]), 'json')).toMatchObject({ ok: false, issues: [{ code: 'INVALID_INPUT', detail: 'input is not valid UTF-8' }] });
    expect(parseImportInput(new TextEncoder().encode('{"schemaVersion": 1,'), 'json')).toMatchObject({ ok: false, issues: [{ code: 'INVALID_INPUT', detail: 'invalid JSON' }] });
    expect(parseImportInput(new TextEncoder().encode('[1,2]'), 'json')).toMatchObject({ ok: false, issues: [{ code: 'INVALID_INPUT', detail: 'row is not a JSON object' }] });
    const header = JSON.stringify({ schemaVersion: 1, batchId: 'b', source: { sourceType: 'curated', sourceNamespace: 'ns', sourceReference: 'ref' } });
    expect(parseImportInput(new TextEncoder().encode(`${header}\n[1]\n"x"\n`), 'jsonl')).toMatchObject({ ok: false });
    const duplicateKey = `{"schemaVersion":1,"batchId":"b","batchId":"c","source":{"sourceType":"curated","sourceNamespace":"ns","sourceReference":"ref"},"recipes":[]}`;
    expect(findDuplicateJsonKeys(duplicateKey)).toEqual(['batchId']);
    expect(findDuplicateJsonKeys('{"a":{"b":1},"c":{"b":2},"d":["b","b"]}')).toEqual([]); // same key in sibling objects/arrays is fine
    expect(parseImportInput(new TextEncoder().encode(duplicateKey), 'json')).toMatchObject({ ok: false, issues: [{ code: 'INVALID_INPUT', detail: 'duplicate JSON keys: batchId' }] });
    const huge = validBatch();
    (huge.recipes[0] as Record<string, unknown>).description = 'x'.repeat(IMPORT_LIMITS.maxRecordBytes + 1);
    expect(parseImportInput(encode(huge), 'json')).toMatchObject({ ok: false, issues: [{ code: 'INVALID_INPUT' }] });
    expect(parseImportInput(new TextEncoder().encode(''), 'jsonl')).toMatchObject({ ok: false, issues: [{ detail: 'empty JSONL input' }] });
    const badVersion = parseImportInput(new TextEncoder().encode('{"schemaVersion":2}'), 'json');
    expect(badVersion.ok).toBe(false);
    if (!badVersion.ok) expect(badVersion.issues[0]).toMatchObject({ code: 'INVALID_SCHEMA', path: 'schemaVersion' });
  });
});

describe('T14E import factory — identity, slug and order', () => {
  it('derives deterministic imp-<hash> IDs from source identity only; slug policy is strict', async () => {
    const id = await deriveImportRecipeId({ sourceNamespace: 'fixture.editorial', sourceRecordId: 'rec-001' });
    expect(id).toMatch(IMPORT_RECIPE_ID_PATTERN);
    expect(id).toBe(await deriveImportRecipeId({ sourceNamespace: 'fixture.editorial', sourceRecordId: 'rec-001' }));
    expect(id).not.toBe(await deriveImportRecipeId({ sourceNamespace: 'fixture.other', sourceRecordId: 'rec-001' }));
    expect(isCanonicalRecipeIdShape(id)).toBe(true); // T14C media key compatible
    expect(id.length).toBeLessThanOrEqual(64);
    for (const slug of ['ok-slug-1', 'a', 'x'.repeat(100)]) expect(isValidImportSlug(slug)).toBe(true);
    for (const slug of ['Bad', 'a_b', '-a', 'a-', 'a--b', 'phở', '', 'x'.repeat(101), 'a b']) expect(isValidImportSlug(slug), slug).toBe(false);
    const bad = await compile(withRecipe((record) => { record.slug = 'Phở Bò'; }));
    expect(codes(bad.issues)).toEqual(['INVALID_SLUG']);
    // Title changes never change identity.
    const retitled = await compile(withRecipe((record) => { record.title = 'Different Title'; }));
    expect(retitled.recipes.map((recipe) => recipe.runtime.id)).toEqual((await compile(validBatch())).recipes.map((recipe) => recipe.runtime.id));
  });

  it('physical file order is not authority: reordering rows leaves IDs, order, SQL and manifest byte-identical', async () => {
    const original = await compile(validBatch());
    const reversed = validBatch();
    reversed.recipes.reverse();
    const shuffled = await compile(reversed);
    expect(shuffled.recipes.map((recipe) => recipe.sourceKey)).toEqual(original.recipes.map((recipe) => recipe.sourceKey));
    expect(original.recipes.map((recipe) => recipe.batchOrder)).toEqual([0, 1]);
    expect(original.recipes[0].sourceKey).toBe('fixture.editorial:rec-001'); // batchOrder 0 although it is the second row in the file
    for (const name of Object.values(IMPORT_ARTIFACT_FILES)) {
      if (name === IMPORT_ARTIFACT_FILES.artifact) continue; // records the input hash, which legitimately differs
      expect(shuffled.artifacts.get(name), name).toBe(original.artifacts.get(name));
    }
    expect(shuffled.batchHash).toBe(original.batchHash);
    expect(shuffled.releaseManifest).toEqual(original.releaseManifest);
  });

  it('batchOrder must be exactly 0..N-1 (gaps and duplicates fail closed)', async () => {
    expect(codes((await compile(withRecipe((record) => { record.batchOrder = 5; }))).issues)).toEqual(['INVALID_BATCH_ORDER']);
    expect(codes((await compile(withRecipe((record) => { record.batchOrder = 0; }))).issues)).toEqual(['INVALID_BATCH_ORDER']);
    // A record failing another gate keeps its batchOrder in the sequence: no cascading order error.
    expect(codes((await compile(withRecipe((record) => { record.cuisine = 'martian'; }))).issues)).toEqual(['UNSUPPORTED_CUISINE']);
  });

  it('ID collisions: same source twice, same ID from a different source (forced), legacy ID, legacy slug, within-batch slug', async () => {
    const twice = validBatch();
    twice.recipes.push({ ...twice.recipes[0], batchOrder: 2 });
    expect(codes((await compile(twice)).issues)).toEqual(['DUPLICATE_SOURCE']);
    const legacySlug = await compile(withRecipe((record) => { record.slug = legacy[0].slug; }));
    expect(codes(legacySlug.issues)).toEqual(['LEGACY_SLUG_COLLISION']);
    const batchSlug = validBatch();
    (batchSlug.recipes[1] as Record<string, unknown>).slug = batchSlug.recipes[0].slug;
    expect(codes((await compile(batchSlug)).issues)).toEqual(['SLUG_COLLISION']);
    // A legacy ID can never be produced by the hash (imp- prefix), so simulate a colliding catalog entry directly.
    const index = new DuplicateIndex();
    for (const entry of await canonicalEntryOf(legacy)) index.add(entry);
    const ok = await compile(validBatch());
    index.add({ ...index.hasId('vn-canh-01')!, id: ok.recipes[0].runtime.id, slug: 'other-slug', contentFingerprint: 'f'.repeat(64), sourceKey: null, origin: 'legacy' });
    const { issues } = detectDuplicates(ok.recipes, index, new Map());
    expect(issues.map((issue) => issue.code)).toContain('LEGACY_ID_COLLISION');
  });
});

describe('T14E import factory — quality gates', () => {
  it('provenance: publishable imports require a non-empty batch source reference and reviewed state', async () => {
    const emptyRef = validBatch();
    emptyRef.source.sourceReference = '   ';
    expect(codes((await compile(emptyRef)).issues)).toEqual(['INVALID_SCHEMA']);
    const unreviewed = await compile(withRecipe((record) => { record.verificationState = 'unverified'; }));
    expect(codes(unreviewed.issues)).toEqual(['UNREVIEWED_RECIPE']);
    expect(unreviewed.ok).toBe(false);
    expect(unreviewed.artifacts.has(IMPORT_ARTIFACT_FILES.migration)).toBe(false);
    const userGenerated = validBatch();
    userGenerated.source.sourceType = 'user_generated';
    expect(codes((await compile(userGenerated)).issues)).toEqual(['INVALID_SCHEMA']);
    const ai = validBatch();
    ai.source.sourceType = 'ai_generated';
    const aiResult = await compile(ai); // same gates, no bypass
    expect(aiResult.ok).toBe(true);
    expect(aiResult.recipes[0].provenance).toEqual({ sourceType: 'ai_generated', sourceReference: ai.source.sourceReference, verificationState: 'reviewed', version: 1 });
  });

  it('ingredients: exact canonical resolution only; unresolved and ambiguous fail closed with bounded candidates; no invented IDs', async () => {
    const resolver = createIngredientResolver();
    expect(resolver.resolve('Thịt ba chỉ')).toEqual({ status: 'resolved', ingredientId: 'PORK_BELLY', via: 'exact_alias' });
    expect(resolver.resolve('  pork   belly ')).toEqual({ status: 'resolved', ingredientId: 'PORK_BELLY', via: 'exact_alias' });
    expect(resolver.resolve('anything', 'TOMATO')).toEqual({ status: 'resolved', ingredientId: 'TOMATO', via: 'id' });
    expect(resolver.resolve('anything', 'TOMATO_123')).toMatchObject({ status: 'unresolved' });
    expect(resolver.resolve('Thai chili pepper')).toMatchObject({ status: 'unresolved' }); // no substring merge into CHILI
    expect(resolver.resolve('dragon fruit')).toEqual({ status: 'unresolved', candidates: [] });
    const ambiguous = createIngredientResolver([
      { id: 'CHILI', nameVi: 'Ớt', nameEn: 'Chili', aliases: ['chili'], category: 'spice', defaultUnit: 'piece', defaultShelfLifeDays: 7 },
      { id: 'CHILI_THAI', nameVi: 'Ớt hiểm', nameEn: 'Thai chili', aliases: ['chili'], category: 'spice', defaultUnit: 'piece', defaultShelfLifeDays: 7 },
    ]);
    expect(ambiguous.resolve('chili')).toEqual({ status: 'ambiguous', candidates: ['CHILI', 'CHILI_THAI'] });
    const unresolved = await compile(withRecipe((record) => { (record.ingredients as Array<Record<string, unknown>>)[0].text = 'unicorn meat'; delete (record.ingredients as Array<Record<string, unknown>>)[0].ingredientId; }));
    expect(codes(unresolved.issues)).toEqual(['UNRESOLVED_INGREDIENT']);
    expect(unresolved.unresolvedIngredients).toMatchObject([{ subject: 'fixture.editorial:rec-002', text: 'unicorn meat', status: 'unresolved' }]);
    expect(unresolved.unresolvedIngredients[0].candidates.length).toBeLessThanOrEqual(5); // token-based review hints only, never auto-resolved
    expect(unresolved.ok).toBe(false);
    const result = await compile(validBatch());
    for (const recipe of result.recipes) for (const line of recipe.runtime.ingredients) expect(resolver.has(line.ingredientId)).toBe(true);
    expect(result.recipes[1].runtime.ingredients.map((line) => line.ingredientId)).toEqual(['TOMATO', 'CHICKEN_EGG', 'COOKING_OIL', 'SCALLION', 'RICE']);
    expect(result.recipes[1].runtime.ingredients[3].isOptional).toBe(true);
    expect(result.recipes[1].runtime.ingredients[0].isOptional).toBeUndefined();
  });

  it('units and quantities: closed unit set, finite positive quantities, no silent conversion', async () => {
    expect(codes((await compile(withRecipe((record) => { (record.ingredients as Array<Record<string, unknown>>)[0].unit = 'cup'; }))).issues)).toEqual(['UNSUPPORTED_UNIT']);
    expect(codes((await compile(withRecipe((record) => { (record.ingredients as Array<Record<string, unknown>>)[0].unit = 'tbsp'; }))).issues)).toEqual(['UNSUPPORTED_UNIT']);
    for (const quantity of [0, -1, '3', null]) {
      expect(codes((await compile(withRecipe((record) => { (record.ingredients as Array<Record<string, unknown>>)[0].quantity = quantity; }))).issues), String(quantity)).toEqual(['INVALID_SCHEMA']);
    }
    const text = new TextDecoder().decode(encode(validBatch())).replace('"quantity":3,', '"quantity":NaN,');
    expect(text).toContain('NaN');
    expect(parseImportInput(new TextEncoder().encode(text), 'json')).toMatchObject({ ok: false, issues: [{ detail: 'invalid JSON' }] });
  });

  it('steps must be 1..N contiguous and unique; cuisine/region/category/tags/classification/nutrition/imageUrl gates', async () => {
    expect(codes((await compile(withRecipe((record) => { (record.steps as Array<Record<string, unknown>>)[0].stepNumber = 5; }))).issues)).toEqual(['INVALID_STEP_ORDER']);
    expect(codes((await compile(withRecipe((record) => { (record.steps as Array<Record<string, unknown>>)[1].stepNumber = 1; }))).issues)).toEqual(['INVALID_STEP_ORDER']);
    expect(codes((await compile(withRecipe((record) => { record.cuisine = 'indian'; }))).issues)).toEqual(['UNSUPPORTED_CUISINE']);
    expect(codes((await compile(withRecipe((record) => { record.region = 'tokyo'; }, 1))).issues)).toEqual(['INVALID_REGION']);
    expect(codes((await compile(withRecipe((record) => { record.region = 'bac'; }, 0))).issues)).toEqual(['INVALID_REGION']); // chinese recipe with VN region
    expect(codes((await compile(withRecipe((record) => { record.category = '   '; }))).issues)).toEqual(['INVALID_CATEGORY']);
    expect(codes((await compile(withRecipe((record) => { record.tags = ['ok', 'cat:mon_kho']; }))).issues)).toEqual(['INVALID_TAGS']);
    expect(codes((await compile(withRecipe((record) => { record.tags = ['ok', '  ']; }))).issues)).toEqual(['INVALID_TAGS']);
    expect(normalizeTags([' a ', 'b', 'a', 'B'])).toEqual({ tags: ['a', 'b', 'B'], problems: [] });
    expect(codes((await compile(withRecipe((record) => { record.classifications = [{ kind: 'flavor', tag: 'x' }]; }))).issues)).toEqual(['INVALID_SCHEMA']);
    expect(codes((await compile(withRecipe((record) => { record.classifications = [{ kind: 'dietary', tag: 'vegan' }, { kind: 'dietary', tag: ' vegan ' }]; }))).issues)).toEqual(['INVALID_CLASSIFICATION']);
    expect(codes((await compile(withRecipe((record) => { record.nutrition = { calories: 100, proteinG: 1, fatG: 1, carbG: 1 }; }, 1))).issues)).toEqual(['INVALID_SCHEMA']); // evidence required
    expect(codes((await compile(withRecipe((record) => { record.nutrition = { calories: -1, proteinG: 1, fatG: 1, carbG: 1, evidence: 'x' }; }, 1))).issues)).toEqual(['INVALID_SCHEMA']);
    expect(codes((await compile(withRecipe((record) => { record.imageUrl = 'https://example.com/x.jpg'; }))).issues)).toEqual(['INVALID_IMAGE_URL']);
    expect(codes((await compile(withRecipe((record) => { record.imageUrl = '/../etc/passwd.png'; }))).issues)).toEqual(['INVALID_IMAGE_URL']);
    const ok = await compile(validBatch());
    expect(ok.recipes[0].runtime.imageUrl).toBe('/frigo/illustrations/delicious-meal.png');
    expect(ok.recipes[1].runtime.imageUrl).toBe(IMPORT_IMAGE_PLACEHOLDER); // absent ⇒ audited same-origin placeholder
    expect(classifyLegacyImageUrl(IMPORT_IMAGE_PLACEHOLDER).kind).toBe('legacy_static');
    expect(ok.recipes[1].runtime.nutrition).toBeUndefined(); // never fabricated
    expect(ok.recipes[0].runtime.nutrition).toEqual({ calories: 520, proteinG: 24, fatG: 40, carbG: 6 });
    expect(ok.recipes[1].runtime.tags).toEqual(['quick', 'weeknight']);
  });

  it('publishable output hydrates losslessly into RuntimeRecipeSchema and classifies as a complete catalog entry', async () => {
    const result = await compile(validBatch());
    for (const recipe of result.recipes) {
      expect(RuntimeRecipeSchema.parse(recipe.runtime)).toEqual(recipe.runtime);
      const classification = classifyCatalogEntry({ recipe: {
        id: recipe.runtime.id, slug: recipe.runtime.slug, title: recipe.runtime.title, description: recipe.runtime.description, cuisine: recipe.runtime.cuisine,
        servings: recipe.runtime.servings, cookTimeMinutes: recipe.runtime.cookTimeMinutes, difficulty: recipe.runtime.difficulty,
        provenance: recipe.provenance,
        ingredients: recipe.runtime.ingredients.map((line) => ({ ingredientId: line.ingredientId, name: line.name, requiredQuantity: line.requiredQuantity, unit: line.unit, isOptional: line.isOptional ?? false })),
      }, stepCount: recipe.runtime.steps.length });
      expect(classification).toEqual({ id: recipe.runtime.id, state: 'complete', fkStub: false, reasons: [] });
    }
  });
});

describe('T14E import factory — duplicates', () => {
  it('hard duplicates against legacy: identical content fingerprint and title/ingredient semantic candidates', async () => {
    const source = legacy.find((recipe) => recipe.id === 'gl-03')!;
    const clone = validBatch();
    clone.recipes = [{
      sourceRecordId: 'clone-1', batchOrder: 0, verificationState: 'reviewed', title: source.title, description: source.description, slug: 'clone-slug',
      cuisine: source.cuisine, cookTimeMinutes: source.cookTimeMinutes, servings: source.servings, difficulty: source.difficulty, imageUrl: source.imageUrl,
      ingredients: source.ingredients.map((line) => ({ text: line.name, ingredientId: line.ingredientId, quantity: line.requiredQuantity, unit: line.unit, ...(line.isOptional ? { isOptional: true } : {}) })),
      steps: source.steps.map((step) => ({ stepNumber: step.stepNumber, instruction: step.instruction, ...(step.tip ? { tip: step.tip } : {}), ...(step.timerMinutes ? { timerMinutes: step.timerMinutes } : {}) })),
      tags: source.tags, ...(source.nutrition ? { nutrition: { ...source.nutrition, evidence: 'copied' } } : {}),
    }];
    const result = await compile(clone);
    // Content fingerprint differs (id/slug are part of the runtime projection), so this is a semantic candidate, not a hard duplicate.
    expect(codes(result.issues)).toEqual(['POSSIBLE_DUPLICATE']);
    expect(result.duplicateReport.possible[0]).toMatchObject({ against: 'gl-03', origin: 'legacy', signals: ['normalized_title', 'ingredient_signature'], waived: false });
    // Explicit reviewed waiver makes it publishable and records the reason.
    (clone.recipes[0] as Record<string, unknown>).duplicateReview = { decision: 'distinct', reason: 'fixture: intentionally similar test recipe' };
    const waived = await compile(clone);
    expect(waived.ok).toBe(true);
    expect(waived.duplicateReport.possible[0]).toMatchObject({ waived: true, reason: 'fixture: intentionally similar test recipe' });
    // Waivers never silence hard duplicates (same slug is a hard collision even with a review record).
    const batch = validBatch();
    batch.recipes[1] = { ...batch.recipes[1], slug: batch.recipes[0].slug, duplicateReview: { decision: 'distinct', reason: 'no' } };
    const hard = await compile(batch);
    expect(codes(hard.issues)).toEqual(['SLUG_COLLISION']);
    expect(hard.ok).toBe(false);
    expect(normalizeTitleKey('Phở Bò  Hà Nội!')).toBe('pho bo ha noi');
  });

  it('within-batch duplicates are reported once per pair with deterministic ordering', async () => {
    const batch = validBatch();
    const [a] = batch.recipes;
    batch.recipes.push({ ...a, sourceRecordId: 'rec-003', batchOrder: 2, slug: 'third-slug', title: `${a.title}` });
    const result = await compile(batch);
    expect(result.duplicateReport.possible.map((entry) => `${entry.subject}→${entry.against}`)).toEqual([`fixture.editorial:rec-003→${result.recipes[1].runtime.id}`]);
    expect(codes(result.issues)).toEqual(['POSSIBLE_DUPLICATE']);
  });
});

describe('T14E import factory — SQL renderer and determinism', () => {
  it('renders complete, data-only SQL with escaped hostile text; plain INSERT; pending hero media; explicit positions and runtime order', async () => {
    const hostile = withRecipe((record) => {
      record.title = `Robert'); DROP TABLE recipes; --`;
      record.description = 'line1\nline2 "quoted" \\backslash 東京 🍜 ẩm thực';
      (record.steps as Array<Record<string, unknown>>)[0].instruction = `It's "fine"; -- not a comment`;
      (record.ingredients as Array<Record<string, unknown>>)[0].text = "Thịt ba chỉ";
    });
    const result = await compile(hostile);
    expect(result.ok).toBe(true);
    const sql = result.artifacts.get(IMPORT_ARTIFACT_FILES.migration)!;
    expect(sql).toContain(`'Robert''); DROP TABLE recipes; --'`);
    expect(sql).not.toMatch(/^DROP TABLE/m);
    expect(sql).toContain("'It''s \"fine\"; -- not a comment'");
    expect(sql).toContain('🍜');
    expect(sql).not.toMatch(/ON CONFLICT/);
    expect(sql.match(/^INSERT INTO (\w+)/gm)).toEqual([
      'INSERT INTO recipes', 'INSERT INTO recipe_ingredients', 'INSERT INTO recipe_steps', 'INSERT INTO recipe_runtime_fields',
      'INSERT INTO recipe_runtime_ingredient_order', 'INSERT INTO recipe_classifications',
      'INSERT INTO nutrition_profiles', 'INSERT INTO recipe_nutrition', 'INSERT INTO recipe_media',
    ]);
    const [first, second] = result.recipes.map((recipe) => recipe.runtime.id);
    expect(sql).toContain(`('${first}', 71, 'mon_kho', 'nam', 520, 24, 40, 6)`); // runtime_order = 71 + batchOrder 0
    expect(sql).toContain(`('${second}', 72, 'fixture_bowl', NULL, NULL, NULL, NULL, NULL)`);
    expect(sql).toContain(`('${first}_ing_1', '${first}', 0)`);
    expect(sql).toContain(`('${second}_ing_5', '${second}', 4)`);
    expect(sql).toContain(`('${first}_media_hero_v1', '${first}', 'hero', 1, 'pending')`);
    expect(sql).not.toMatch(/'ready'|storage_key|content_hash/);
    expect(sql).toContain(`'curated', 'T14E synthetic fixture batch A (test-only, no real recipes)', 'reviewed', 1)`);
    expect(sql).toContain('0035_recipe_media_layer.sql');
    expect(() => sqlText('a\u0000b')).toThrow();
    expect(() => renderImportBatchSql({ batchId: 'b', batchHash: 'h', releaseBaseCount: 71, recipes: [{ ...result.recipes[0], batchOrder: 3 }] })).toThrow('batchOrder');
  });

  it('is byte-deterministic: same input ⇒ identical artifacts; issues sorted; codes closed', async () => {
    const a = await compile(validBatch());
    const b = await compile(validBatch());
    for (const name of Object.values(IMPORT_ARTIFACT_FILES)) expect(a.artifacts.get(name), name).toBe(b.artifacts.get(name));
    expect(a.artifacts.size).toBe(7);
    const artifact = JSON.parse(a.artifacts.get(IMPORT_ARTIFACT_FILES.artifact)!);
    expect(artifact).toMatchObject({ schemaVersion: 1, batchId: 'fixture-batch-a', publishable: true, recipeCount: 2, ingredientLineCount: 8, stepCount: 5, errorCount: 0, warningCount: 0 });
    for (const key of ['inputSha256', 'normalizedSha256', 'migrationSha256', 'releaseManifestSha256', 'batchHash']) expect(artifact[key]).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(artifact)).not.toMatch(/token|secret|password/i);
    const messy: ImportIssue[] = [
      { code: 'UNRESOLVED_INGREDIENT', severity: 'error', subject: 'b', detail: 'z' },
      { code: 'INVALID_SLUG', severity: 'error', subject: 'b', detail: 'a' },
      { code: 'INVALID_SLUG', severity: 'error', subject: 'a', detail: 'a' },
    ];
    expect(sortIssues(messy).map((issue) => `${issue.subject}:${issue.code}`)).toEqual(['a:INVALID_SLUG', 'b:INVALID_SLUG', 'b:UNRESOLVED_INGREDIENT']);
    expect(sortIssues(messy)).toEqual(sortIssues([...messy].reverse()));
    expect([...IMPORT_ISSUE_CODES]).toEqual([...new Set(IMPORT_ISSUE_CODES)]);
    expect(canonicalJson({ b: 1, a: [{ d: undefined, c: 2 }] })).toBe('{"a":[{"c":2}],"b":1}');
  });

  it('compile with errors exits non-publishable: diagnostic artifacts only, no migration.sql or release manifest', async () => {
    const result = await compile(withRecipe((record) => { record.cuisine = 'mexican'; }));
    expect(result.ok).toBe(false);
    expect(result.summary).toMatchObject({ inputRecords: 2, valid: 1, invalid: 1, publishable: 0, unsupportedCuisine: 1, errors: 1 });
    expect([...result.artifacts.keys()].sort()).toEqual(['artifact-manifest.json', 'duplicate-report.json', 'normalized-recipes.json', 'unresolved-ingredients.json', 'validation-report.json']);
    expect(JSON.parse(result.artifacts.get(IMPORT_ARTIFACT_FILES.artifact)!)).toMatchObject({ publishable: false, migrationSha256: null, releaseManifestSha256: null });
  });
});
