import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertNotSymlink,
  ImportOutputPolicyError,
  isContainedIn,
  RECIPE_IMPORT_OUTPUT_ROOT,
  resolveImportOutputDir,
} from '../../scripts/recipe-import-output-policy.mjs';

/**
 * T14E artifact containment. Policy tests use a throwaway repo root under tmpdir. The CLI
 * end-to-end test runs the real script against the real repository but writes ONLY beneath
 * `.artifacts/recipe-import/<tmp-name>/` (git-ignored) and removes it afterwards.
 */
describe('recipe import artifact output containment policy', () => {
  let repo;
  beforeAll(() => {
    repo = mkdtempSync(path.join(tmpdir(), 'frigo-import-policy-'));
    mkdirSync(path.join(repo, RECIPE_IMPORT_OUTPUT_ROOT), { recursive: true });
    mkdirSync(path.join(repo, 'migrations'));
    mkdirSync(path.join(repo, 'outside'));
  });
  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it('exposes the single allowed root', () => {
    expect(RECIPE_IMPORT_OUTPUT_ROOT).toBe(path.join('.artifacts', 'recipe-import'));
  });

  it.each(['.artifacts/recipe-import/batch-a', '.artifacts/recipe-import/nested/deeper', './.artifacts/recipe-import/./x/../y'])('allows %s', (requested) => {
    const resolved = resolveImportOutputDir(repo, requested);
    expect(isContainedIn(path.join(repo, RECIPE_IMPORT_OUTPUT_ROOT), resolved)).toBe(true);
    expect(resolved.startsWith(path.join(repo, RECIPE_IMPORT_OUTPUT_ROOT) + path.sep)).toBe(true);
  });

  it.each([
    'migrations', 'migrations/0036', '../../migrations/0036.sql', 'packages/recipes/src', 'packages/recipes/src/import', 'docs', 'package.json',
    '.artifacts', '.artifacts/recipe-seed/x', '.artifacts/recipe-import-evil/x', '.artifacts/recipe-import', '.artifacts/recipe-import/',
    '.artifacts/recipe-import/../evil', '.artifacts/recipe-import/a/../../evil', '../evil', '/tmp/evil', '',
  ])('refuses %s', (requested) => {
    expect(() => resolveImportOutputDir(repo, requested)).toThrow(ImportOutputPolicyError);
  });

  it('refuses a symlinked artifact directory that escapes the repository or points at migrations/', () => {
    symlinkSync(path.join(repo, 'outside'), path.join(repo, RECIPE_IMPORT_OUTPUT_ROOT, 'escape'));
    expect(() => resolveImportOutputDir(repo, '.artifacts/recipe-import/escape')).toThrow(/escapes/);
    expect(() => resolveImportOutputDir(repo, '.artifacts/recipe-import/escape/deeper')).toThrow(/escapes/);
    symlinkSync(path.join(repo, 'migrations'), path.join(repo, RECIPE_IMPORT_OUTPUT_ROOT, 'to-migrations'));
    expect(() => resolveImportOutputDir(repo, '.artifacts/recipe-import/to-migrations')).toThrow(/escapes/);
    // The whole .artifacts tree swapped for a symlink is refused too.
    const other = mkdtempSync(path.join(tmpdir(), 'frigo-import-policy-other-'));
    mkdirSync(path.join(other, 'recipe-import'), { recursive: true });
    rmSync(path.join(repo, '.artifacts'), { recursive: true, force: true });
    symlinkSync(other, path.join(repo, '.artifacts'));
    expect(() => resolveImportOutputDir(repo, '.artifacts/recipe-import/batch')).toThrow(ImportOutputPolicyError);
    rmSync(path.join(repo, '.artifacts'));
    rmSync(other, { recursive: true, force: true });
    mkdirSync(path.join(repo, RECIPE_IMPORT_OUTPUT_ROOT), { recursive: true });
  });

  it('refuses to write through a planted symlinked file', () => {
    const target = path.join(repo, 'outside', 'victim.sql');
    writeFileSync(target, 'original');
    const link = path.join(repo, RECIPE_IMPORT_OUTPUT_ROOT, 'migration.sql');
    symlinkSync(target, link);
    expect(() => assertNotSymlink(link)).toThrow(ImportOutputPolicyError);
    expect(readFileSync(target, 'utf8')).toBe('original');
    expect(() => assertNotSymlink(path.join(repo, RECIPE_IMPORT_OUTPUT_ROOT, 'fresh.sql'))).not.toThrow();
  });
});

describe('recipe-import CLI (real script, git-ignored artifact directory)', () => {
  const root = process.cwd();
  const run = (...args) => {
    try {
      return { code: 0, out: execFileSync(process.execPath, ['scripts/recipe-import.mjs', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
    } catch (error) {
      return { code: error.status, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
    }
  };
  const dirName = `test-${process.pid}-${Date.now()}`;
  const artifactDir = path.join('.artifacts', 'recipe-import', dirName);
  const migrationsBefore = readdirSync(path.join(root, 'migrations')).sort();
  afterAll(() => rmSync(path.join(root, artifactDir), { recursive: true, force: true }));

  it('validate / compile / verify / check succeed on the fixture and never touch migrations/ or recipe source', () => {
    const validate = run('validate', '--input', 'tests/fixtures/recipe-import/valid-batch.json');
    expect(validate.out).toMatch(/recipe-import ok: records=2 valid=2 invalid=0 publishable=2/);
    expect(validate.code).toBe(0);
    const compile = run('compile', '--input', 'tests/fixtures/recipe-import/valid-batch.json', '--out', artifactDir);
    expect(compile.code).toBe(0);
    expect(readdirSync(path.join(root, artifactDir)).sort()).toEqual([
      'artifact-manifest.json', 'catalog-release-manifest.json', 'duplicate-report.json', 'migration.sql', 'normalized-recipes.json', 'unresolved-ingredients.json', 'validation-report.json',
    ]);
    const verify = run('verify', '--input', 'tests/fixtures/recipe-import/valid-batch.json', '--artifact', artifactDir);
    expect(verify.code).toBe(0);
    expect(verify.out.match(/recipe-import-verify=ok/g)).toHaveLength(7);
    // verify is read-only: tamper with an artifact and it reports drift without rewriting it.
    const tampered = path.join(root, artifactDir, 'migration.sql');
    writeFileSync(tampered, '-- tampered\n');
    const drift = run('verify', '--input', 'tests/fixtures/recipe-import/valid-batch.json', '--artifact', artifactDir);
    expect(drift.code).toBe(1);
    expect(drift.out).toMatch(/recipe-import-verify=DRIFT migration.sql/);
    expect(readFileSync(tampered, 'utf8')).toBe('-- tampered\n');
    // Reviewed-metadata mutation in the SOURCE (license / evidence / review reason) is detected by read-only verify.
    writeFileSync(tampered, readFileSync(path.join(root, artifactDir, 'normalized-recipes.json'), 'utf8').length ? '-- restored below\n' : '');
    const recompiled = run('compile', '--input', 'tests/fixtures/recipe-import/valid-batch.json', '--out', artifactDir);
    expect(recompiled.code).toBe(0);
    const source = JSON.parse(readFileSync(path.join(root, 'tests/fixtures/recipe-import/valid-batch.json'), 'utf8'));
    const mutatedDir = mkdtempSync(path.join(tmpdir(), 'frigo-import-mutated-'));
    try {
      const variants = {
        license: (b) => { b.source.license = 'non-commercial'; },
        evidence: (b) => { b.recipes[1].nutrition.evidence = 'different-evidence'; },
        usageNote: (b) => { b.source.usageNote = 'changed'; },
      };
      for (const [name, mutate] of Object.entries(variants)) {
        const copy = JSON.parse(JSON.stringify(source));
        mutate(copy);
        const file = path.join(mutatedDir, `${name}.json`);
        writeFileSync(file, JSON.stringify(copy));
        const verifyMutated = run('verify', '--input', file, '--artifact', artifactDir);
        expect(verifyMutated.code, name).toBe(1);
        expect(verifyMutated.out, name).toMatch(/recipe-import-verify=DRIFT normalized-recipes.json/);
        expect(verifyMutated.out, name).toMatch(/recipe-import-verify=DRIFT artifact-manifest.json/);
      }
      expect(run('verify', '--input', 'tests/fixtures/recipe-import/valid-batch.json', '--artifact', artifactDir).code).toBe(0); // artifacts untouched by verify
    } finally { rmSync(mutatedDir, { recursive: true, force: true }); }
    const check = run('check');
    expect(check.out).toMatch(/recipe-import-check=ok packages\/recipes\/src\/import\/catalog-release.current.json \(releaseId=rel-[0-9a-f]{16} recipes=71 batches=0\)/);
    expect(check.code).toBe(0);
    expect(readdirSync(path.join(root, 'migrations')).sort()).toEqual(migrationsBefore);
    expect(existsSync(path.join(root, 'migrations', '0036_recipe_import.sql'))).toBe(false);
  }, 120_000);

  it('a failing batch exits non-zero, writes diagnostics only (no migration.sql); traversal and symlink outputs are refused before any write', () => {
    const bad = mkdtempSync(path.join(tmpdir(), 'frigo-import-bad-'));
    try {
      const batch = JSON.parse(readFileSync(path.join(root, 'tests/fixtures/recipe-import/valid-batch.json'), 'utf8'));
      batch.recipes[0].cuisine = 'mexican';
      const input = path.join(bad, 'bad.json');
      writeFileSync(input, JSON.stringify(batch));
      const failing = run('compile', '--input', input, '--out', `${artifactDir}-bad`);
      expect(failing.code).toBe(1);
      expect(failing.out).toMatch(/UNSUPPORTED_CUISINE/);
      expect(readdirSync(path.join(root, `${artifactDir}-bad`))).not.toContain('migration.sql');
      for (const evil of ['migrations', '../../migrations/0036', '/tmp/evil', '.artifacts/recipe-seed/x']) {
        const refused = run('compile', '--input', input, '--out', evil);
        expect(refused.code, evil).toBe(3);
        expect(refused.out, evil).toMatch(/refusing to write/);
      }
      // Symlink escape: .artifacts/recipe-import/<link> → outside directory.
      const outside = mkdtempSync(path.join(tmpdir(), 'frigo-import-outside-'));
      const link = path.join(root, '.artifacts', 'recipe-import', `${dirName}-link`);
      mkdirSync(path.dirname(link), { recursive: true });
      symlinkSync(outside, link);
      try {
        const viaLink = run('compile', '--input', input, '--out', `.artifacts/recipe-import/${dirName}-link`);
        expect(viaLink.code).toBe(3);
        expect(viaLink.out).toMatch(/escapes/);
        expect(readdirSync(outside)).toEqual([]);
        expect(lstatSync(link).isSymbolicLink()).toBe(true);
      } finally {
        rmSync(link, { force: true });
        rmSync(outside, { recursive: true, force: true });
      }
      expect(run('compile', '--input', input).code).toBe(2); // --out required
      expect(run('frobnicate').code).toBe(2);
      expect(run('compile', '--input', path.join(bad, 'nope.csv'), '--out', `${artifactDir}-csv`).code).toBe(2);
    } finally {
      rmSync(bad, { recursive: true, force: true });
      rmSync(path.join(root, `${artifactDir}-bad`), { recursive: true, force: true });
    }
  }, 180_000);
});
