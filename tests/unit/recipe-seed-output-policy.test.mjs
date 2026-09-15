import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  isContainedIn,
  RECIPE_SEED_OUTPUT_ROOT,
  resolveSeedOutputPath,
  SeedOutputPolicyError,
} from '../../scripts/recipe-seed-output-policy.mjs';

// The renderer's only allowed output tree. Tests use a throwaway repo root under tmpdir so
// nothing here can touch the real workspace.
describe('recipe seed output containment policy', () => {
  let repo;
  beforeAll(() => {
    repo = mkdtempSync(path.join(tmpdir(), 'frigo-seed-policy-'));
    mkdirSync(path.join(repo, RECIPE_SEED_OUTPUT_ROOT), { recursive: true });
    mkdirSync(path.join(repo, 'migrations'));
    mkdirSync(path.join(repo, 'outside'));
  });
  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it('exposes the single allowed root', () => {
    expect(RECIPE_SEED_OUTPUT_ROOT).toBe(path.join('.artifacts', 'recipe-seed'));
  });

  it.each([
    '.artifacts/recipe-seed/test.sql',
    '.artifacts/recipe-seed/0006_vietnamese_recipe_bank.sql',
    '.artifacts/recipe-seed/debug/test.sql',
    './.artifacts/recipe-seed/./nested/../test.sql',
  ])('allows %s', (requested) => {
    const resolved = resolveSeedOutputPath(repo, requested);
    expect(isContainedIn(path.join(repo, RECIPE_SEED_OUTPUT_ROOT), resolved)).toBe(true);
    expect(resolved.startsWith(path.join(repo, RECIPE_SEED_OUTPUT_ROOT) + path.sep)).toBe(true);
  });

  it.each([
    'migrations/evil.sql',
    'migrations/0006_vietnamese_recipe_bank.sql',
    'packages/recipes/evil.ts',
    'packages/recipes/src/vietnamese-bank.ts',
    'src/worker/evil.ts',
    'src/web/evil.tsx',
    'docs/evil.md',
    'package.json',
    'wrangler.jsonc',
    '.artifacts/other/test.sql',
    '.artifacts/recipe-seed-evil/test.sql',
    '.artifacts/recipe-seed',
    '.artifacts/recipe-seed/',
    '.artifacts/recipe-seed/../evil.sql',
    '.artifacts/recipe-seed/a/../../evil.sql',
    '../evil.sql',
    '/tmp/evil.sql',
    '',
  ])('refuses %s', (requested) => {
    expect(() => resolveSeedOutputPath(repo, requested)).toThrow(SeedOutputPolicyError);
  });

  it('refuses an absolute path that lexically matches the allowed root of a different repo', () => {
    const other = mkdtempSync(path.join(tmpdir(), 'frigo-other-'));
    try {
      expect(() => resolveSeedOutputPath(repo, path.join(other, RECIPE_SEED_OUTPUT_ROOT, 'x.sql'))).toThrow(SeedOutputPolicyError);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it('refuses a symlinked directory inside the allowed root that escapes it', () => {
    const link = path.join(repo, RECIPE_SEED_OUTPUT_ROOT, 'escape');
    symlinkSync(path.join(repo, 'outside'), link, 'dir');
    expect(() => resolveSeedOutputPath(repo, '.artifacts/recipe-seed/escape/evil.sql')).toThrow(SeedOutputPolicyError);
  });

  it('refuses when the allowed root itself is a symlink pointing at tracked source', () => {
    const evilRepo = mkdtempSync(path.join(tmpdir(), 'frigo-evil-root-'));
    try {
      mkdirSync(path.join(evilRepo, 'migrations'));
      writeFileSync(path.join(evilRepo, 'migrations', '0006.sql'), '-- tracked');
      mkdirSync(path.join(evilRepo, '.artifacts'));
      symlinkSync(path.join(evilRepo, 'migrations'), path.join(evilRepo, RECIPE_SEED_OUTPUT_ROOT), 'dir');
      expect(() => resolveSeedOutputPath(evilRepo, '.artifacts/recipe-seed/x.sql')).toThrow(SeedOutputPolicyError);
    } finally {
      rmSync(evilRepo, { recursive: true, force: true });
    }
  });

  it('refuses when .artifacts itself is a symlink out of the repository', () => {
    const evilRepo = mkdtempSync(path.join(tmpdir(), 'frigo-evil-artifacts-'));
    const elsewhere = mkdtempSync(path.join(tmpdir(), 'frigo-elsewhere-'));
    try {
      symlinkSync(elsewhere, path.join(evilRepo, '.artifacts'), 'dir');
      expect(() => resolveSeedOutputPath(evilRepo, '.artifacts/recipe-seed/x.sql')).toThrow(SeedOutputPolicyError);
    } finally {
      rmSync(evilRepo, { recursive: true, force: true });
      rmSync(elsewhere, { recursive: true, force: true });
    }
  });

  it('allows a fresh checkout where .artifacts does not exist yet', () => {
    const fresh = mkdtempSync(path.join(tmpdir(), 'frigo-fresh-'));
    try {
      expect(resolveSeedOutputPath(fresh, '.artifacts/recipe-seed/x.sql')).toBe(path.join(fresh, RECIPE_SEED_OUTPUT_ROOT, 'x.sql'));
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  });

  it('isContainedIn is segment-aware, not prefix-based', () => {
    expect(isContainedIn('/r/.artifacts/recipe-seed', '/r/.artifacts/recipe-seed-evil/x')).toBe(false);
    expect(isContainedIn('/r/.artifacts/recipe-seed', '/r/.artifacts/recipe-seed/x')).toBe(true);
    expect(isContainedIn('/r/.artifacts/recipe-seed', '/r/.artifacts/recipe-seed')).toBe(true);
    expect(isContainedIn('/r/.artifacts/recipe-seed', '/r/.artifacts')).toBe(false);
  });
});
