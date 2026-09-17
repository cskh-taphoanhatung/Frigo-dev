#!/usr/bin/env node
// T14E — Bulk recipe import factory CLI (ADR-027). Offline, deterministic, fail-closed.
//
//   node scripts/recipe-import.mjs validate --input <batch.json|.jsonl>
//   node scripts/recipe-import.mjs compile  --input <batch> --out <dir beneath .artifacts/recipe-import/>
//   node scripts/recipe-import.mjs verify   --input <batch> --artifact <dir>      (read-only recompute + compare)
//   node scripts/recipe-import.mjs check                                          (committed current release manifest == generated truth)
//   node scripts/recipe-import.mjs release-manifest --out <dir>                    (regenerate the current manifest beneath .artifacts/ for review)
//
// It NEVER writes into migrations/ or packages/recipes/src: promotion of a reviewed migration.sql /
// manifest into the repository is a separate, human-reviewed T14F step. No network, no D1, no R2.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { assertNotSymlink, ImportOutputPolicyError, resolveImportOutputDir } from './recipe-import-output-policy.mjs';

const args = process.argv.slice(2);
const command = args[0];
const option = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
const usage = () => {
  console.error('usage: recipe-import.mjs validate --input <batch> | compile --input <batch> --out <dir> | verify --input <batch> --artifact <dir> | check | release-manifest --out <dir>');
  process.exit(2);
};
if (!['validate', 'compile', 'verify', 'check', 'release-manifest'].includes(command)) usage();
const input = option('--input');
const out = option('--out');
const artifactDir = option('--artifact');
if ((command === 'validate' || command === 'compile' || command === 'verify') && !input) usage();
if ((command === 'compile' || command === 'release-manifest') && !out) usage();
if (command === 'verify' && !artifactDir) usage();

const root = process.cwd();
const CURRENT_MANIFEST = path.join('packages', 'recipes', 'src', 'import', 'catalog-release.current.json');

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { ALL_RECIPES } = await vite.ssrLoadModule('/packages/recipes/src/data.ts');
  const factory = await vite.ssrLoadModule('/packages/recipes/src/import/index.ts');

  const summarize = (result) => {
    const s = result.summary;
    console.log(`recipe-import ${result.ok ? 'ok' : 'FAILED'}: records=${s.inputRecords} valid=${s.valid} invalid=${s.invalid} publishable=${s.publishable} duplicates=${s.duplicates} possibleDuplicates=${s.possibleDuplicates} unresolvedIngredients=${s.unresolvedIngredients} unsupportedCuisine=${s.unsupportedCuisine} warnings=${s.warnings} errors=${s.errors}`);
    for (const issue of result.issues.slice(0, 50)) console.log(`  ${issue.severity.toUpperCase()} ${issue.code} ${issue.subject}${issue.path ? ` @${issue.path}` : ''}: ${issue.detail}`);
    if (result.issues.length > 50) console.log(`  … ${result.issues.length - 50} more issue(s) in validation-report.json`);
  };
  const compile = async () => {
    const format = factory.importFormatForPath(input);
    if (!format) { console.error(`unsupported input extension: ${input} (use .json or .jsonl)`); process.exit(2); }
    const bytes = new Uint8Array(readFileSync(path.resolve(root, input)));
    return factory.compileImportBatch(bytes, format, { legacy: ALL_RECIPES });
  };

  if (command === 'validate') {
    const result = await compile();
    summarize(result);
    process.exitCode = result.ok ? 0 : 1;
  } else if (command === 'compile') {
    let dir;
    try { dir = resolveImportOutputDir(root, out); } catch (error) { if (error instanceof ImportOutputPolicyError) { console.error(error.message); process.exit(3); } throw error; }
    const result = await compile();
    summarize(result);
    mkdirSync(dir, { recursive: true });
    resolveImportOutputDir(root, out); // re-check after mkdir: a symlink planted in between must not redirect writes
    for (const [name, text] of result.artifacts) {
      const file = path.join(dir, name);
      assertNotSymlink(file);
      writeFileSync(file, text, { encoding: 'utf8', flag: 'w' });
    }
    console.log(`wrote ${result.artifacts.size} artifact(s) to ${dir}${result.ok ? '' : ' (no migration.sql: compile has errors)'}`);
    process.exitCode = result.ok ? 0 : 1;
  } else if (command === 'verify') {
    const result = await compile();
    let drift = 0;
    const expectedFiles = result.ok ? Object.values(factory.IMPORT_ARTIFACT_FILES) : Object.values(factory.IMPORT_ARTIFACT_FILES).filter((name) => name !== 'migration.sql' && name !== 'catalog-release-manifest.json');
    for (const name of expectedFiles) {
      let committed = null;
      try { committed = readFileSync(path.resolve(root, artifactDir, name), 'utf8'); } catch { /* missing */ }
      const generated = result.artifacts.get(name);
      if (committed === generated) console.log(`recipe-import-verify=ok ${name}`);
      else { console.error(`recipe-import-verify=DRIFT ${name}${committed === null ? ' (missing)' : ''}`); drift += 1; }
    }
    process.exitCode = drift === 0 && result.ok ? 0 : 1;
  } else if (command === 'check') {
    const { manifest } = await factory.composeCatalogRelease(ALL_RECIPES, []);
    const generated = factory.serializeCatalogReleaseManifest(manifest);
    const committed = readFileSync(path.resolve(root, CURRENT_MANIFEST), 'utf8');
    if (committed === generated) {
      console.log(`recipe-import-check=ok ${CURRENT_MANIFEST} (releaseId=${manifest.releaseId} recipes=${manifest.expectedRecipeCount} batches=${manifest.approvedImportBatches.length})`);
    } else {
      console.error(`recipe-import-check=STALE ${CURRENT_MANIFEST} differs from the manifest composed from ALL_RECIPES + approved batches.`);
      console.error('Regenerate with `node scripts/recipe-import.mjs release-manifest --out .artifacts/recipe-import/current` and review the diff before committing.');
      process.exitCode = 1;
    }
  } else if (command === 'release-manifest') {
    let dir;
    try { dir = resolveImportOutputDir(root, out); } catch (error) { if (error instanceof ImportOutputPolicyError) { console.error(error.message); process.exit(3); } throw error; }
    const { manifest } = await factory.composeCatalogRelease(ALL_RECIPES, []);
    mkdirSync(dir, { recursive: true });
    resolveImportOutputDir(root, out);
    const file = path.join(dir, 'catalog-release-manifest.json');
    assertNotSymlink(file);
    writeFileSync(file, factory.serializeCatalogReleaseManifest(manifest), { encoding: 'utf8', flag: 'w' });
    console.log(`rendered current release manifest (releaseId=${manifest.releaseId}, ${manifest.expectedRecipeCount} recipes) to ${file}`);
  }
} catch (error) {
  if (error instanceof ImportOutputPolicyError) { console.error(error.message); process.exitCode = 3; }
  else throw error;
} finally {
  await vite.close();
}
