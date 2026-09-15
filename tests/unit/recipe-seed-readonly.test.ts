import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { VIETNAMESE_RECIPES } from '../../packages/recipes/src/vietnamese-bank';
import { VIETNAMESE_DISH_IMAGES } from '../../packages/recipes/src/vietnamese-images';
import {
  findBankImageReferenceDrift,
  renderVietnameseRecipeSeedSql,
  VIETNAMESE_SEED_MIGRATION_FILENAME,
} from '../../packages/recipes/src/seed-render';

const root = process.cwd();
const migrationsDir = path.resolve(root, 'migrations');
const bankPath = path.resolve(root, 'packages/recipes/src/vietnamese-bank.ts');
const seedPath = path.join(migrationsDir, VIETNAMESE_SEED_MIGRATION_FILENAME);

const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const snapshotTree = () => {
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
  return {
    files,
    hashes: files.map((name) => sha256(path.join(migrationsDir, name))),
    mtimes: files.map((name) => statSync(path.join(migrationsDir, name)).mtimeMs),
    bank: sha256(bankPath),
    bankMtime: statSync(bankPath).mtimeMs,
  };
};

// T14A F-08: the former generate-migration test rewrote vietnamese-bank.ts and 0006 during
// `pnpm test`. Validation is now pure: render in memory, compare, never touch tracked files.
describe('Vietnamese recipe seed validation is read-only', () => {
  it('renders the committed 0006 seed byte-for-byte from the static catalog without writing', () => {
    const before = snapshotTree();
    const rendered = renderVietnameseRecipeSeedSql(VIETNAMESE_RECIPES, VIETNAMESE_DISH_IMAGES);
    const committed = readFileSync(seedPath, 'utf8');

    expect(rendered).toBe(committed);
    expect(rendered).toContain('canh-chua-ca-loc-nam-bo');
    expect(snapshotTree()).toEqual(before);
  });

  it('keeps every Vietnamese recipe pointing at VIETNAMESE_DISH_IMAGES without rewriting the bank', () => {
    const before = snapshotTree();
    const source = readFileSync(bankPath, 'utf8');
    expect(source).toContain("from './vietnamese-images'");
    expect(findBankImageReferenceDrift(source, VIETNAMESE_RECIPES)).toEqual([]);
    expect(snapshotTree()).toEqual(before);
  });

  it('reports drift for a stale bank reference instead of repairing it', () => {
    const source = readFileSync(bankPath, 'utf8').replace(
      "imageUrl: VIETNAMESE_DISH_IMAGES['thit-kho-trung']",
      "imageUrl: '/frigo/recipes/vietnam/thit-kho-trung.webp'",
    );
    expect(findBankImageReferenceDrift(source, VIETNAMESE_RECIPES)).toEqual(['thit-kho-trung']);
  });

  it('renders a divergent catalog as a different document (stale seed would be detected)', () => {
    const mutated = VIETNAMESE_RECIPES.map((recipe, index) =>
      index === 0 ? { ...recipe, title: `${recipe.title} (changed)` } : recipe);
    expect(renderVietnameseRecipeSeedSql(mutated, VIETNAMESE_DISH_IMAGES)).not.toBe(readFileSync(seedPath, 'utf8'));
  });

  it('has no test that writes into migrations/ or recipe source, and the migration ledger ends at 0033', () => {
    const testFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(test|spec)\.(ts|tsx|mjs)$/.test(entry.name)) testFiles.push(full);
      }
    };
    walk(path.resolve(root, 'tests'));
    const offenders = testFiles.filter((file) => {
      const source = readFileSync(file, 'utf8');
      // A write is hazardous only when its target is resolved against the repository root
      // (process.cwd()/__dirname); temp-directory fixtures (mkdtemp) are fine.
      const writesRepoRelative = /writeFile(Sync)?\(\s*path\.(resolve|join)\(\s*(process\.cwd\(\)|__dirname)/.test(source)
        || /const \w+Path = path\.resolve\(process\.cwd\(\),\s*['"`](migrations|packages\/recipes)[^)]*\);[\s\S]*writeFile(Sync)?\(\s*\w+Path/.test(source);
      return writesRepoRelative || /generate-migration/.test(path.basename(file));
    });
    expect(offenders).toEqual([]);
    expect(existsSync(path.resolve(root, 'tests/unit/generate-migration.test.ts'))).toBe(false);

    const numbers = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).map((name) => name.slice(0, 4)).sort();
    expect(numbers).toHaveLength(33);
    expect(numbers.at(-1)).toBe('0033');
    expect(new Set(numbers).size).toBe(33);
  });
});
