#!/usr/bin/env node
// Explicit, intentional renderer for recipe seed/parity SQL.
//
// Modes:
//   node scripts/render-recipe-seed.mjs --check                    compare in-memory renders with committed 0006 + 0034 (read-only)
//   node scripts/render-recipe-seed.mjs --out <file>               write the 0006 render beneath .artifacts/recipe-seed/ ONLY
//   node scripts/render-recipe-seed.mjs --seed parity --out <file> write the 0034 render beneath .artifacts/recipe-seed/ ONLY
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
const seedIndex = args.indexOf('--seed');
const seed = seedIndex >= 0 ? args[seedIndex + 1] : 'vietnamese';
if ((!check && !outPath) || !['vietnamese', 'parity'].includes(seed)) {
  console.error('usage: render-recipe-seed.mjs --check | [--seed vietnamese|parity] --out <path beneath .artifacts/recipe-seed/>');
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
  const { ALL_RECIPES, GLOBAL_RECIPES } = await vite.ssrLoadModule('/packages/recipes/src/data.ts');
  const {
    renderVietnameseRecipeSeedSql, renderGlobalRecipeParitySql,
    VIETNAMESE_SEED_MIGRATION_FILENAME, GLOBAL_PARITY_MIGRATION_FILENAME,
  } = await vite.ssrLoadModule('/packages/recipes/src/seed-render.ts');

  const renders = {
    vietnamese: {
      file: VIETNAMESE_SEED_MIGRATION_FILENAME,
      sql: renderVietnameseRecipeSeedSql(VIETNAMESE_RECIPES, VIETNAMESE_DISH_IMAGES),
      summary: `${VIETNAMESE_RECIPES.length} recipes`,
    },
    parity: {
      file: GLOBAL_PARITY_MIGRATION_FILENAME,
      sql: renderGlobalRecipeParitySql(GLOBAL_RECIPES, ALL_RECIPES),
      summary: `${GLOBAL_RECIPES.length} global recipes + ${ALL_RECIPES.length} runtime field rows`,
    },
  };

  if (check) {
    for (const [name, render] of Object.entries(renders)) {
      const committed = readFileSync(path.join(root, 'migrations', render.file), 'utf8');
      if (committed === render.sql) {
        console.log(`recipe-seed-check=ok ${name} (${render.summary} match ${render.file})`);
      } else {
        console.error(`recipe-seed-check=STALE ${name}: static catalog no longer matches ${render.file}.`);
        console.error(`Do not rewrite ${render.file}. Ship the difference as a new numbered migration.`);
        process.exitCode = 1;
      }
    }
  }
  if (resolvedOut) {
    const render = renders[seed];
    mkdirSync(path.dirname(resolvedOut), { recursive: true });
    // Re-check after directory creation so a symlink planted in between cannot redirect the write.
    resolveSeedOutputPath(root, outPath);
    let existing = null;
    try { existing = lstatSync(resolvedOut); } catch { /* new file */ }
    if (existing?.isSymbolicLink()) {
      console.error(`refusing to write through symlink ${outPath}`);
      process.exitCode = 3;
    } else {
      writeFileSync(resolvedOut, render.sql, { encoding: 'utf8', flag: 'w' });
      console.log(`rendered ${render.summary} to ${resolvedOut}`);
    }
  }
} catch (error) {
  if (error instanceof SeedOutputPolicyError) { console.error(error.message); process.exitCode = 3; }
  else throw error;
} finally {
  await vite.close();
}
