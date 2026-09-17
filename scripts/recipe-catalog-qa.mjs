#!/usr/bin/env node
// T14F — Editorial QA + ingredient-coverage report for a reviewed T14E import batch. Offline, deterministic, read-only.
//
//   node scripts/recipe-catalog-qa.mjs --input <batch.jsonl> [--approved <other-batch.jsonl> ...] [--out <file beneath .artifacts/>]
//
// It does NOT replace the T14E compiler gates (schema, ingredient resolution, duplicates, runtime contract);
// it adds the catalog-editorial checks the T14F packet requires on top of them and writes one JSON summary:
// ingredient coverage (required/resolved/ambiguous/unresolved), title/step/serving/time plausibility,
// ingredient↔step consistency, tag hygiene, cuisine/category distribution, and duplicate/waiver statistics
// computed by the real T14E duplicate detector against the legacy 71 (+ any already-approved batches).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { assertNotSymlink, ImportOutputPolicyError, resolveImportOutputDir } from './recipe-import-output-policy.mjs';

const args = process.argv.slice(2);
const values = (name) => args.flatMap((arg, index) => (arg === name && args[index + 1] ? [args[index + 1]] : []));
const input = values('--input')[0];
const approvedInputs = values('--approved');
const out = values('--out')[0] ?? null;
if (!input) { console.error('usage: recipe-catalog-qa.mjs --input <batch> [--approved <batch> ...] [--out <file>]'); process.exit(2); }

const root = process.cwd();
const read = (file) => new Uint8Array(readFileSync(path.resolve(root, file)));
const stripDiacritics = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();

// Vietnamese/English stem hints per canonical ingredient: an important ingredient should surface in step prose.
const STEP_HINTS = {
  PORK_BELLY: ['ba chi', 'thit'], GROUND_PORK: ['thit', 'vien', 'nhan'], BEEF_SIRLOIN: ['bo'], CHICKEN_BREAST: ['ga'], CHICKEN_THIGH: ['ga'],
  SHRIMP: ['tom'], SALMON_FILLET: ['ca hoi', 'ca'], CHICKEN_EGG: ['trung'], FRESH_MILK: ['sua'], CHEDDAR_CHEESE: ['pho mai'], BUTTER: ['bo'],
  TOMATO: ['ca chua'], WATER_SPINACH: ['rau muong', 'rau'], SPINACH: ['rau bina', 'cai bo xoi', 'rau'], TOFU: ['dau phu', 'dau hu'], BROCCOLI: ['bong cai', 'sup lo'],
  CARROT: ['ca rot'], ONION: ['hanh tay'], GARLIC: ['toi'], GINGER: ['gung'], SCALLION: ['hanh la', 'hanh'], CHILI: ['ot'], CUCUMBER: ['dua leo', 'dua chuot'],
  CABBAGE: ['bap cai', 'cai thao', 'cai'], KIMCHI: ['kim chi', 'kimchi'], MUSHROOM: ['nam'], RICE: ['gao', 'com'], SPAGHETTI_PASTA: ['mi', 'spaghetti', 'pasta'],
  NOODLE: ['mi', 'bun', 'pho', 'hu tieu', 'udon', 'mien', 'soba', 'ramen'], FISH_SAUCE: ['nuoc mam', 'mam'], SOY_SAUCE: ['xi dau', 'nuoc tuong', 'tuong'], COOKING_OIL: ['dau'],
  PORK_RIBS: ['suon'], CRAB_MEAT: ['cua', 'rieu'], SQUID: ['muc'], FISH_FRESHWATER: ['ca'], BITTER_MELON: ['kho qua', 'muop dang'], WINTER_MELON: ['bi dao', 'bi xanh', 'bi'],
  PUMPKIN: ['bi do', 'bi ngo', 'bi'], PINEAPPLE: ['dua', 'thom', 'khom'], BEAN_SPROUTS: ['gia'], CHAYOTE: ['su su'], LEMONGRASS: ['sa'], LIME: ['chanh'], RICE_PAPER: ['banh trang', 'banh da'],
};
const PLAUSIBLE = { minServings: 1, maxServings: 8, minCookMinutes: 5, maxCookMinutes: 240, minSteps: 3, minIngredients: 3, minInstructionChars: 25 };

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { ALL_RECIPES } = await vite.ssrLoadModule('/packages/recipes/src/data.ts');
  const factory = await vite.ssrLoadModule('/packages/recipes/src/import/index.ts');
  const { CANONICAL_INGREDIENTS } = await vite.ssrLoadModule('/packages/domain/src/index.ts');
  const resolver = factory.createIngredientResolver();

  // Approved batches (release order) are compiled first so cross-batch duplicate detection is the real T14E one.
  const approved = [];
  for (const file of approvedInputs) {
    const result = await factory.compileImportBatch(read(file), factory.importFormatForPath(file), { legacy: ALL_RECIPES, approvedBatches: approved });
    if (!result.ok) throw new Error(`approved batch ${file} does not compile cleanly (errors=${result.summary.errors})`);
    approved.push({ header: result.header, recipes: result.recipes });
  }
  const parsed = factory.parseImportInput(read(input), factory.importFormatForPath(input));
  if (!parsed.ok) throw new Error(`input does not parse: ${parsed.issues.map((issue) => issue.code).join(', ')}`);
  const compiled = await factory.compileImportBatch(read(input), factory.importFormatForPath(input), { legacy: ALL_RECIPES, approvedBatches: approved });

  // --- Ingredient coverage preflight (raw records, before the compiler gates) -------------------------------
  const coverage = { required: new Set(), resolved: new Set(), ambiguous: [], unresolved: [], unsupportedUnits: [] };
  const findings = [];
  const byCuisine = {}; const byCategory = {}; const byDifficulty = {}; const titles = new Map();
  const finding = (record, code, detail) => findings.push({ sourceRecordId: record.sourceRecordId ?? null, code, detail });
  for (const raw of parsed.batch.records) {
    const record = raw;
    byCuisine[record.cuisine] = (byCuisine[record.cuisine] ?? 0) + 1;
    const category = record.category ?? `(${record.cuisine})`;
    byCategory[category] = (byCategory[category] ?? 0) + 1;
    byDifficulty[record.difficulty] = (byDifficulty[record.difficulty] ?? 0) + 1;
    const titleKey = factory.normalizeTitleKey(record.title);
    titles.set(titleKey, [...(titles.get(titleKey) ?? []), record.sourceRecordId]);

    const ids = [];
    for (const line of record.ingredients ?? []) {
      coverage.required.add(line.ingredientId ?? line.text);
      const resolution = resolver.resolve(line.text, line.ingredientId);
      if (resolution.status === 'resolved') { coverage.resolved.add(resolution.ingredientId); ids.push(resolution.ingredientId); }
      else if (resolution.status === 'ambiguous') coverage.ambiguous.push({ sourceRecordId: record.sourceRecordId, text: line.text, candidates: resolution.candidates });
      else coverage.unresolved.push({ sourceRecordId: record.sourceRecordId, text: line.text, candidates: resolution.candidates });
      if (!factory.isSupportedUnit(line.unit)) coverage.unsupportedUnits.push({ sourceRecordId: record.sourceRecordId, text: line.text, unit: line.unit });
      if (!(line.quantity > 0) || line.quantity > 5000) finding(record, 'IMPLAUSIBLE_QUANTITY', `${line.text}: ${line.quantity} ${line.unit}`);
    }
    if (new Set(ids).size !== ids.length) finding(record, 'REPEATED_INGREDIENT', 'the same canonical ingredient appears twice in one recipe');

    // --- Editorial plausibility --------------------------------------------------------------------------------
    if (record.servings < PLAUSIBLE.minServings || record.servings > PLAUSIBLE.maxServings) finding(record, 'IMPLAUSIBLE_SERVINGS', String(record.servings));
    if (record.cookTimeMinutes < PLAUSIBLE.minCookMinutes || record.cookTimeMinutes > PLAUSIBLE.maxCookMinutes) finding(record, 'IMPLAUSIBLE_COOK_TIME', String(record.cookTimeMinutes));
    if ((record.ingredients ?? []).length < PLAUSIBLE.minIngredients) finding(record, 'TOO_FEW_INGREDIENTS', String(record.ingredients?.length ?? 0));
    if ((record.steps ?? []).length < PLAUSIBLE.minSteps) finding(record, 'TOO_FEW_STEPS', String(record.steps?.length ?? 0));
    const timerTotal = (record.steps ?? []).reduce((total, step) => total + (step.timerMinutes ?? 0), 0);
    if (timerTotal > record.cookTimeMinutes) finding(record, 'TIMERS_EXCEED_COOK_TIME', `timers=${timerTotal} > cookTime=${record.cookTimeMinutes}`);
    const prose = stripDiacritics((record.steps ?? []).map((step) => `${step.instruction} ${step.tip ?? ''}`).join(' '));
    for (const step of record.steps ?? []) {
      if (step.instruction.trim().length < PLAUSIBLE.minInstructionChars) finding(record, 'THIN_STEP', `step ${step.stepNumber}: "${step.instruction}"`);
      if (/^(chuan bi nguyen lieu|nau)\.?$/.test(stripDiacritics(step.instruction).trim())) finding(record, 'PLACEHOLDER_STEP', `step ${step.stepNumber}`);
    }
    const seenSteps = new Set();
    for (const step of record.steps ?? []) {
      const key = stripDiacritics(step.instruction).trim();
      if (seenSteps.has(key)) finding(record, 'REPEATED_STEP_TEXT', `step ${step.stepNumber}`);
      seenSteps.add(key);
    }
    // Ingredient ↔ step consistency for non-optional, non-seasoning lines (oil/sauces are legitimately implicit).
    const SEASONING = new Set(['COOKING_OIL', 'FISH_SAUCE', 'SOY_SAUCE', 'GARLIC', 'CHILI', 'SCALLION', 'GINGER', 'LIME']);
    for (const line of record.ingredients ?? []) {
      const id = line.ingredientId ?? resolver.resolve(line.text).ingredientId;
      if (!id || line.isOptional || SEASONING.has(id)) continue;
      const hints = STEP_HINTS[id] ?? [];
      const textHint = stripDiacritics(line.text).split(/\s+/).filter((token) => token.length >= 3);
      if (![...hints, ...textHint].some((hint) => prose.includes(hint))) finding(record, 'INGREDIENT_NOT_IN_STEPS', `${id} (${line.text}) never appears in step prose`);
    }
    // Raw-protein sanity: a recipe with meat/seafood must contain a cooking verb somewhere.
    const proteins = new Set(['PORK_BELLY', 'GROUND_PORK', 'BEEF_SIRLOIN', 'CHICKEN_BREAST', 'CHICKEN_THIGH', 'SHRIMP', 'SALMON_FILLET', 'PORK_RIBS', 'CRAB_MEAT', 'SQUID', 'FISH_FRESHWATER', 'CHICKEN_EGG']);
    if (ids.some((id) => proteins.has(id)) && !/(xao|kho|chien|hap|luoc|nau|nuong|ap chao|om|rim|ham|dun|ran|nhung|quay|say|lam chin|chin|tai)/.test(prose)) finding(record, 'NO_COOKING_VERB_WITH_PROTEIN', 'protein listed but no cooking verb found in steps');
    // Tag hygiene.
    const tags = record.tags ?? [];
    if (tags.length > 6) finding(record, 'TAG_SPAM', `${tags.length} tags`);
    if (new Set(tags.map((tag) => tag.toLowerCase())).size !== tags.length) finding(record, 'DUPLICATE_TAG', tags.join('|'));
    if (tags.some((tag) => /chua benh|giam can|tri |detox|thuoc/i.test(stripDiacritics(tag)))) finding(record, 'HEALTH_CLAIM_TAG', tags.join('|'));
    if (record.nutrition !== undefined) finding(record, 'NUTRITION_PRESENT', `evidence=${record.nutrition.evidence ?? 'MISSING'}`);
  }
  for (const [key, owners] of titles) if (owners.length > 1) findings.push({ sourceRecordId: owners.join(','), code: 'TITLE_COLLISION_IN_BATCH', detail: key });

  const legacyTitles = new Set(ALL_RECIPES.map((recipe) => factory.normalizeTitleKey(recipe.title)));
  for (const [key, owners] of titles) if (legacyTitles.has(key)) findings.push({ sourceRecordId: owners.join(','), code: 'TITLE_COLLISION_WITH_LEGACY', detail: key });

  findings.sort((a, b) => String(a.sourceRecordId).localeCompare(String(b.sourceRecordId)) || a.code.localeCompare(b.code) || a.detail.localeCompare(b.detail));
  const sortObject = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
  const report = {
    batchId: parsed.batch.header.batchId,
    input,
    approvedInputs,
    records: parsed.batch.records.length,
    compile: { ok: compiled.ok, summary: compiled.summary, batchHash: compiled.batchHash, issues: compiled.issues.map((issue) => ({ code: issue.code, subject: issue.subject, detail: issue.detail })) },
    ingredientCoverage: {
      canonicalCatalogSize: CANONICAL_INGREDIENTS.length,
      requiredDistinct: coverage.required.size,
      resolvedDistinct: coverage.resolved.size,
      resolvedIds: [...coverage.resolved].sort(),
      unusedCanonicalIds: CANONICAL_INGREDIENTS.map((ingredient) => ingredient.id).filter((id) => !coverage.resolved.has(id)).sort(),
      ambiguous: coverage.ambiguous,
      unresolved: coverage.unresolved,
      unsupportedUnits: coverage.unsupportedUnits,
    },
    duplicates: {
      hard: compiled.duplicateReport.hard.length,
      possible: compiled.duplicateReport.possible.length,
      waived: compiled.duplicateReport.possible.filter((entry) => entry.waived).length,
      unwaived: compiled.duplicateReport.possible.filter((entry) => !entry.waived).length,
      possibleDetail: compiled.duplicateReport.possible,
    },
    distribution: { byCuisine: sortObject(byCuisine), byCategory: sortObject(byCategory), byDifficulty: sortObject(byDifficulty) },
    editorial: {
      findingCount: findings.length,
      byCode: sortObject(findings.reduce((acc, item) => ({ ...acc, [item.code]: (acc[item.code] ?? 0) + 1 }), {})),
      findings,
    },
    thresholds: PLAUSIBLE,
  };
  const text = `${JSON.stringify(report, null, 2)}\n`;
  const blocking = compiled.summary.errors + coverage.unresolved.length + coverage.ambiguous.length + coverage.unsupportedUnits.length + report.duplicates.hard + report.duplicates.unwaived;
  console.log(`recipe-catalog-qa ${blocking === 0 && findings.length === 0 ? 'ok' : blocking === 0 ? 'ok-with-findings' : 'BLOCKED'}: batch=${report.batchId} records=${report.records} valid=${compiled.summary.valid} publishable=${compiled.summary.publishable} `
    + `unresolved=${coverage.unresolved.length} ambiguous=${coverage.ambiguous.length} unsupportedUnits=${coverage.unsupportedUnits.length} hardDup=${report.duplicates.hard} possibleDup=${report.duplicates.possible} waived=${report.duplicates.waived} editorialFindings=${findings.length}`);
  for (const item of findings.slice(0, 80)) console.log(`  ${item.code} ${item.sourceRecordId}: ${item.detail}`);
  if (findings.length > 80) console.log(`  … ${findings.length - 80} more finding(s) in the report`);
  if (out) {
    let dir;
    try { dir = resolveImportOutputDir(root, path.dirname(out)); } catch (error) { if (error instanceof ImportOutputPolicyError) { console.error(error.message); process.exit(3); } throw error; }
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, path.basename(out));
    assertNotSymlink(file);
    writeFileSync(file, text, { encoding: 'utf8', flag: 'w' });
    console.log(`wrote ${file}`);
  }
  process.exitCode = blocking === 0 ? 0 : 1;
} finally {
  await vite.close();
}
