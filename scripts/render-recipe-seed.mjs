#!/usr/bin/env node
// Explicit, intentional renderer for the Vietnamese recipe seed SQL.
//
// Modes:
//   node scripts/render-recipe-seed.mjs --check          compare in-memory render with committed 0006 (read-only)
//   node scripts/render-recipe-seed.mjs --out <file>     write the render to a path OUTSIDE migrations/
//
// It NEVER writes into migrations/ or packages/: applied migrations are immutable. Future
// seed changes must ship as a new, separately numbered migration.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const check = args.includes('--check');
const outIndex = args.indexOf('--out');
const outPath = outIndex >= 0 ? args[outIndex + 1] : null;
if (!check && !outPath) {
  console.error('usage: render-recipe-seed.mjs --check | --out <path outside migrations/>');
  process.exit(2);
}

const root = process.cwd();
const migrationsDir = path.resolve(root, 'migrations');
const packagesDir = path.resolve(root, 'packages');
if (outPath) {
  const resolved = path.resolve(root, outPath);
  if (resolved.startsWith(migrationsDir + path.sep) || resolved.startsWith(packagesDir + path.sep)) {
    console.error(`refusing to write inside ${resolved}: applied migrations and recipe source are immutable`);
    process.exit(3);
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
    const committed = readFileSync(path.join(migrationsDir, VIETNAMESE_SEED_MIGRATION_FILENAME), 'utf8');
    if (committed === rendered) {
      console.log(`recipe-seed-check=ok (${VIETNAMESE_RECIPES.length} recipes match ${VIETNAMESE_SEED_MIGRATION_FILENAME})`);
    } else {
      console.error(`recipe-seed-check=STALE: static catalog no longer matches ${VIETNAMESE_SEED_MIGRATION_FILENAME}.`);
      console.error('Do not rewrite 0006. Ship the difference as a new numbered migration.');
      process.exitCode = 1;
    }
  }
  if (outPath) {
    const resolved = path.resolve(root, outPath);
    mkdirSync(path.dirname(resolved), { recursive: true });
    writeFileSync(resolved, rendered, 'utf8');
    console.log(`rendered ${VIETNAMESE_RECIPES.length} recipes to ${resolved}`);
  }
} finally {
  await vite.close();
}
