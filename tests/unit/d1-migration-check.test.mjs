import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  PRODUCTION_D1, baselineQuery, classifyPreLedger, validateMigrationCandidate, verifyBaselinePreserved,
  verifyCloudflareIdentity, verifyHealth, verifyMigrationPlan, verifyPostLedger, verifyRecipeMediaSeed,
} from '../../scripts/d1-migration-check.mjs';

const ok = (results) => [{ success: true, results }];
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

describe('production D1 migration candidate gate (local Git only)', () => {
  let cwd, preSha, candidateSha, laterSha, unmergedSha;
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const migration = (name, sql) => writeFileSync(path.join(cwd, 'migrations', name), sql);
  const pin = (entries) => writeFileSync(path.join(cwd, 'tests/fixtures/migration-sha256.json'), JSON.stringify({ migrations: entries }));
  const check = (overrides = {}) => validateMigrationCandidate({ cwd, ref: candidateSha, expectedPreTip: '0001_base.sql', migration: '0002_media.sql', ...overrides });

  beforeAll(() => {
    cwd = mkdtempSync(path.join(tmpdir(), 'frigo-d1-migrate-'));
    git('init', '-b', 'main');
    git('config', 'user.email', 'd1-test@example.invalid');
    git('config', 'user.name', 'D1 fixture');
    git('config', 'commit.gpgsign', 'false');
    mkdirSync(path.join(cwd, 'migrations'));
    mkdirSync(path.join(cwd, 'tests/fixtures'), { recursive: true });
    const base = 'CREATE TABLE fixture (id TEXT);\n';
    migration('0001_base.sql', base);
    pin({ '0001_base.sql': sha256(base) });
    git('add', '.'); git('commit', '-m', 'Base');
    preSha = git('rev-parse', 'HEAD');
    migration('0002_media.sql', 'CREATE TABLE media (id TEXT);\n');
    git('add', '.'); git('commit', '-m', 'Media');
    candidateSha = git('rev-parse', 'HEAD');
    migration('0003_later.sql', 'CREATE TABLE later (id TEXT);\n');
    git('add', '.'); git('commit', '-m', 'Later');
    laterSha = git('rev-parse', 'HEAD');
    git('update-ref', 'refs/remotes/origin/main', laterSha);
    git('commit', '--allow-empty', '-m', 'Unmerged');
    unmergedSha = git('rev-parse', 'HEAD');
  });
  afterAll(() => rmSync(cwd, { recursive: true, force: true }));

  it('accepts the exact candidate whose tip is the requested migration and whose predecessor is expected_pre_tip', () => {
    expect(check()).toMatchObject({ sha: candidateSha, migration: '0002_media.sql', expectedPreTip: '0001_base.sql', pinnedCount: 1, schema: { count: 2, version: '0002_media.sql' } });
  });

  it.each(['main', 'HEAD', 'refs/tags/v1', 'abc1234', '--help'])('rejects non-SHA ref %s', (ref) => {
    expect(() => check({ ref })).toThrow('full immutable SHA');
  });

  it('rejects a candidate outside main', () => {
    expect(() => check({ ref: unmergedSha })).toThrow('not contained in main');
  });

  it('rejects a candidate whose tip is a later, unexpected migration', () => {
    expect(() => check({ ref: laterSha })).toThrow('unexpected later migration');
  });

  it('rejects a mismatched expected_pre_tip and malformed migration names', () => {
    expect(() => check({ expectedPreTip: '0001_other.sql' })).toThrow('is not 0001_other.sql');
    expect(() => check({ migration: 'media.sql' })).toThrow('canonical NNNN_name.sql');
    expect(() => check({ ref: preSha, migration: '0001_base.sql' })).toThrow('preceding');
  });

  it('rejects a candidate where a pinned historical migration was edited', () => {
    migration('0001_base.sql', 'CREATE TABLE fixture (id TEXT, extra TEXT);\n');
    git('add', '.'); git('commit', '-m', 'Edit history');
    const edited = git('rev-parse', 'HEAD');
    git('update-ref', 'refs/remotes/origin/main', edited);
    expect(() => check({ ref: edited, expectedPreTip: '0002_media.sql', migration: '0003_later.sql' })).toThrow('differs from its pinned hash');
    git('update-ref', 'refs/remotes/origin/main', laterSha);
  });
});

describe('production D1 evidence verification', () => {
  const manifest = { migration: '0035_recipe_media_layer.sql', schema: { migrations: [{ name: '0033_a.sql' }, { name: '0034_b.sql' }, { name: '0035_recipe_media_layer.sql' }] } };
  const ledger = (...names) => ok(names.map((name) => ({ name })));

  it('pins the production database identity and requires d1 list agreement', () => {
    const list = [{ name: 'frigo-db-staging', uuid: 'other' }, { name: PRODUCTION_D1.name, uuid: PRODUCTION_D1.id }];
    expect(verifyCloudflareIdentity({ list, info: { name: PRODUCTION_D1.name, uuid: PRODUCTION_D1.id } })).toMatchObject({ databaseId: PRODUCTION_D1.id, infoCrossCheck: 'match' });
    expect(verifyCloudflareIdentity({ list, info: null })).toMatchObject({ infoCrossCheck: 'unavailable' });
    expect(() => verifyCloudflareIdentity({ list: [{ name: 'frigo-db', uuid: 'wrong' }], info: null })).toThrow('mismatch in d1 list');
    expect(() => verifyCloudflareIdentity({ list, info: { name: 'frigo-db', uuid: 'wrong' } })).toThrow('mismatch in d1 info');
  });

  it('classifies the pre-ledger as apply, certify, or stop', () => {
    expect(classifyPreLedger(manifest, ledger('0034_b.sql', '0033_a.sql'))).toMatchObject({ mode: 'apply', count: 2, tip: '0034_b.sql' });
    expect(classifyPreLedger(manifest, ledger('0033_a.sql', '0034_b.sql', '0035_recipe_media_layer.sql'))).toMatchObject({ mode: 'certify', count: 3 });
    expect(() => classifyPreLedger(manifest, ledger('0033_a.sql'))).toThrow('stop and reconcile');
    expect(() => classifyPreLedger(manifest, ledger('0033_a.sql', '0034_b.sql', '0035_recipe_media_layer.sql', '0036_x.sql'))).toThrow('stop and reconcile');
    expect(() => classifyPreLedger(manifest, [])).toThrow('one successful result');
  });

  it('requires the post-ledger to equal the candidate manifest exactly', () => {
    expect(verifyPostLedger(manifest, ledger('0033_a.sql', '0034_b.sql', '0035_recipe_media_layer.sql'))).toEqual({ count: 3, tip: '0035_recipe_media_layer.sql' });
    expect(() => verifyPostLedger(manifest, ledger('0033_a.sql', '0034_b.sql'))).toThrow('differs');
  });

  it('accepts only a plan of exactly the requested migration (or none when certifying)', () => {
    const plan = 'Migrations to be applied:\n┌──────────────────────────────┐\n│ Name                         │\n│ 0035_recipe_media_layer.sql  │\n└──────────────────────────────┘\n';
    expect(verifyMigrationPlan(plan, { migration: '0035_recipe_media_layer.sql', mode: 'apply' })).toEqual({ planned: ['0035_recipe_media_layer.sql'] });
    expect(() => verifyMigrationPlan(`${plan}│ 0036_next.sql │\n`, { migration: '0035_recipe_media_layer.sql', mode: 'apply' })).toThrow('exactly');
    expect(() => verifyMigrationPlan('✅ No migrations to apply!', { migration: '0035_recipe_media_layer.sql', mode: 'apply' })).toThrow('exactly');
    expect(verifyMigrationPlan('✅ No migrations to apply!', { migration: '0035_recipe_media_layer.sql', mode: 'certify' })).toEqual({ planned: [] });
    expect(() => verifyMigrationPlan(plan, { migration: '0035_recipe_media_layer.sql', mode: 'certify' })).toThrow('empty migration plan');
  });

  it('detects any aggregate drift and requires clean health pragmas', () => {
    const pre = ok([{ users: 5, recipes: 71 }]);
    expect(verifyBaselinePreserved(pre, ok([{ users: 5, recipes: 71 }]))).toMatchObject({ drift: 'none' });
    expect(() => verifyBaselinePreserved(pre, ok([{ users: 4, recipes: 71 }]))).toThrow('drift detected in users');
    expect(verifyHealth({ foreignKeys: ok([]), quickCheck: ok([{ quick_check: 'ok' }]) })).toEqual({ foreignKeyCheck: '[]', quickCheck: 'ok' });
    expect(() => verifyHealth({ foreignKeys: ok([{ table: 'x' }]), quickCheck: ok([{ quick_check: 'ok' }]) })).toThrow('violation');
    expect(() => verifyHealth({ foreignKeys: ok([]), quickCheck: ok([{ quick_check: '*** in database main ***' }]) })).toThrow('quick_check');
  });

  it('requires exactly one pending hero v1 slot per recipe, zero ready, and the 0035 schema contract', () => {
    const summary = (over = {}) => ok([{ total: 71, hero: 71, thumbnail: 0, pending: 71, ready: 0, rejected: 0, superseded: 0, ...over }]);
    const slots = (missing = 0) => ok([{ recipes_without_exact_hero_v1_pending: missing }]);
    const table = "CREATE TABLE recipe_media (id TEXT PRIMARY KEY NOT NULL, recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK (role IN ('hero', 'thumbnail')), version INTEGER NOT NULL CHECK (typeof(version) = 'integer' AND version >= 1), status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'rejected', 'superseded')), UNIQUE (recipe_id, role, version), CHECK (storage_key IS NULL OR (storage_key = 'recipes/' || recipe_id || '/' || role || '/v' || version || '.webp')))";
    const schema = (names = ['idx_recipe_media_current_ready', 'idx_recipe_media_recipe_role_status', 'idx_recipe_media_content_hash', 'trg_recipe_media_ready_immutable_update']) =>
      ok([{ type: 'table', name: 'recipe_media', sql: table }, ...names.map((name) => ({ type: name.startsWith('trg') ? 'trigger' : 'index', name, sql: '' }))]);
    expect(verifyRecipeMediaSeed({ summary: summary(), slots: slots(), schema: schema(), recipes: 71 })).toMatchObject({ rows: 71, hero: 71, pending: 71, ready: 0, storageKeyContract: 'exact' });
    expect(() => verifyRecipeMediaSeed({ summary: summary({ ready: 1, pending: 70 }), slots: slots(), schema: schema(), recipes: 71 })).toThrow('seed mismatch');
    expect(() => verifyRecipeMediaSeed({ summary: summary(), slots: slots(1), schema: schema(), recipes: 71 })).toThrow('seed mismatch');
    expect(() => verifyRecipeMediaSeed({ summary: summary(), slots: slots(), schema: schema(), recipes: 72 })).toThrow('seed mismatch');
    expect(() => verifyRecipeMediaSeed({ summary: summary(), slots: slots(), schema: schema(['idx_recipe_media_current_ready']), recipes: 71 })).toThrow('is missing');
  });

  it('builds a counts-only baseline query (no row projection)', () => {
    const query = baselineQuery();
    expect(query).toMatch(/^SELECT \(SELECT COUNT\(\*\) FROM users\) AS users/);
    expect(query).toContain("WHERE id LIKE 'gl-%') AS recipes_global");
    expect(query).not.toMatch(/SELECT \*|LIMIT/);
  });
});
