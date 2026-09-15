#!/usr/bin/env node
// Explicit, intentional renderer for the Vietnamese recipe seed SQL.
//
// Modes:
//   node scripts/render-recipe-seed.mjs --check          compare in-memory render with committed 0006 (read-only)
//   node scripts/render-recipe-seed.mjs --out <file>     write the render beneath .artifacts/recipe-seed/ ONLY
//
// It NEVER writes anywhere except `.artifacts/recipe-seed/` (see recipe-seed-output-policy.mjs):
// applied migrations and tracked source are immutable. Future seed changes must ship as a
// new, separately numbered migration.
import { readFileSync, writeFileSync, mkdirSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { resolveSeedOutputPath, SeedOutputPolicyError } from './recipe-seed-output-policy.mjs';

const args = process.argv.slice(2);
const check = args.includes('--check');
const outIndex = args.indexOf('--out');
const outPath = outIndex >= 0 ? args[outIndex + 1] : null;
if (!check && !outPath) {
  console.error('usage: render-recipe-seed.mjs --check | --out <path beneath .artifacts/recipe-seed/>');
  process.exit(2);
}

const root = process.cwd();
let resolvedOut = null;
if (outPath) {
  try {
    resolvedOut = resolveSeedOutputPath(root, outPath);
  } catch (error) {
    if (error instanceof SeedOutputPolicyError) {
      console.error(error.message);
      process.exit(3);
    }
    throw error;
  }
}

const vite = await createServer({
  server: { middlewareMode: true }, appType: 'custom', logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { VIETNAMESE_RECIPES } = await vite.ssrLoadModule('/packages/recipes/src/vietnamese-bank.ts');
  const { VIETNAMESE_DISH_IMAGES } = await vite.ssrLoadModule('/packages/recipes/src/vietnamese-images.ts');
  const { renderVietnameseRecipeSeedSql, VIETNAMESE_SEED_MIGRATION_FILENAME } =
    await vite.ssrLoadModule('/packages/recipes/src/seed-render.ts');
  const rendered = renderVietnameseRecipeSeedSql(VIETNAMESE_RECIPES, VIETNAMESE_DISH_IMAGES);

  if (check) {
    const committed = readFileSync(path.join(root, 'migrations', VIETNAMESE_SEED_MIGRATION_FILENAME), 'utf8');
    if (committed === rendered) {
      console.log(`recipe-seed-check=ok (${VIETNAMESE_RECIPES.length} recipes match ${VIETNAMESE_SEED_MIGRATION_FILENAME})`);
    } else {
      console.error(`recipe-seed-check=STALE: static catalog no longer matches ${VIETNAMESE_SEED_MIGRATION_FILENAME}.`);
      console.error('Do not rewrite 0006. Ship the difference as a new numbered migration.');
      process.exitCode = 1;
    }
  }
  if (resolvedOut) {
    mkdirSync(path.dirname(resolvedOut), { recursive: true });
    // Re-check after directory creation so a symlink planted in between cannot redirect the write.
    resolveSeedOutputPath(root, outPath);
    let existing = null;
    try { existing = lstatSync(resolvedOut); } catch { /* new file */ }
    if (existing?.isSymbolicLink()) {
      console.error(`refusing to write through symlink ${outPath}`);
      process.exitCode = 3;
    } else {
      writeFileSync(resolvedOut, rendered, { encoding: 'utf8', flag: 'w' });
      console.log(`rendered ${VIETNAMESE_RECIPES.length} recipes to ${resolvedOut}`);
    }
  }
} catch (error) {
  if (error instanceof SeedOutputPolicyError) { console.error(error.message); process.exitCode = 3; }
  else throw error;
} finally {
  await vite.close();
}
