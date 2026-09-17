import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  APPROVED_BATCHES_REGISTRY, CATALOG_RELEASE_MANIFEST, PRODUCTION_D1, baselineQuery, catalogQuery, classifyPreLedger, expectedCatalogAtTip,
  validateMigrationCandidate, verifyBaselinePreserved, verifyCatalogAtTip, verifyCloudflareIdentity, verifyHealth,
  verifyMigrationPlan, verifyPostLedger, verifyRecipeMediaSeed,
} from '../../scripts/d1-migration-check.mjs';
import { readFileSync } from 'node:fs';

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
    expect(check()).toMatchObject({ sha: candidateSha, migration: '0002_media.sql', expectedPreTip: '0001_base.sql', chain: ['0002_media.sql'], pinnedCount: 1, schema: { count: 2, version: '0002_media.sql' } });
  });

  it('accepts a multi-step chain: every migration after expected_pre_tip through the tip, in order', () => {
    expect(check({ ref: laterSha, migration: '0003_later.sql' })).toMatchObject({ chain: ['0002_media.sql', '0003_later.sql'], schema: { count: 3, version: '0003_later.sql' } });
    expect(check({ ref: laterSha, expectedPreTip: '0002_media.sql', migration: '0003_later.sql' })).toMatchObject({ chain: ['0003_later.sql'] });
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
    expect(() => check({ expectedPreTip: '0001_other.sql' })).toThrow('not part of the candidate migration history');
    expect(() => check({ migration: 'media.sql' })).toThrow('canonical NNNN_name.sql');
    expect(() => check({ ref: preSha, migration: '0001_base.sql' })).toThrow('nothing to apply');
    expect(() => check({ ref: laterSha, expectedPreTip: '0003_later.sql', migration: '0003_later.sql' })).toThrow('nothing to apply');
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

  it('classifies the pre-ledger as apply, certify, or stop (single migration)', () => {
    expect(classifyPreLedger(manifest, ledger('0034_b.sql', '0033_a.sql'))).toMatchObject({ mode: 'apply', count: 2, tip: '0034_b.sql' });
    expect(classifyPreLedger(manifest, ledger('0033_a.sql', '0034_b.sql', '0035_recipe_media_layer.sql'))).toMatchObject({ mode: 'certify', count: 3 });
    expect(() => classifyPreLedger(manifest, ledger('0033_a.sql'))).toThrow('stop and reconcile');
    expect(() => classifyPreLedger(manifest, ledger('0033_a.sql', '0034_b.sql', '0035_recipe_media_layer.sql', '0036_x.sql'))).toThrow('stop and reconcile');
    expect(() => classifyPreLedger(manifest, [])).toThrow('one successful result');
  });

  it('classifies a multi-step chain: apply only from exactly expected_pre_tip, certify only at the full history', () => {
    const names = ['0034_a.sql', '0035_b.sql', '0036_c.sql', '0037_d.sql'];
    const chained = { migration: '0037_d.sql', chain: ['0035_b.sql', '0036_c.sql', '0037_d.sql'], schema: { migrations: names.map((name) => ({ name })) } };
    expect(classifyPreLedger(chained, ledger('0034_a.sql'))).toMatchObject({ mode: 'apply', tip: '0034_a.sql', chain: ['0035_b.sql', '0036_c.sql', '0037_d.sql'] });
    expect(classifyPreLedger(chained, ledger(...names))).toMatchObject({ mode: 'certify', tip: '0037_d.sql', chain: [] });
    // Partially applied chain (tip 0035 or 0036) is neither state → stop; the operator must re-dispatch with the true pre-tip.
    expect(() => classifyPreLedger(chained, ledger('0034_a.sql', '0035_b.sql'))).toThrow('stop and reconcile');
    expect(() => classifyPreLedger(chained, ledger('0034_a.sql', '0035_b.sql', '0036_c.sql'))).toThrow('stop and reconcile');
    expect(() => classifyPreLedger(chained, ledger(...names, '0038_future.sql'))).toThrow('stop and reconcile');
  });

  it('requires the post-ledger to equal the candidate manifest exactly', () => {
    expect(verifyPostLedger(manifest, ledger('0033_a.sql', '0034_b.sql', '0035_recipe_media_layer.sql'))).toEqual({ count: 3, tip: '0035_recipe_media_layer.sql' });
    expect(() => verifyPostLedger(manifest, ledger('0033_a.sql', '0034_b.sql'))).toThrow('differs');
  });

  it('accepts only a plan of exactly the pinned chain, in order (or none when certifying)', () => {
    const plan = 'Migrations to be applied:\n┌──────────────────────────────┐\n│ Name                         │\n│ 0035_recipe_media_layer.sql  │\n└──────────────────────────────┘\n';
    expect(verifyMigrationPlan(plan, { migration: '0035_recipe_media_layer.sql', mode: 'apply' })).toEqual({ planned: ['0035_recipe_media_layer.sql'] });
    expect(() => verifyMigrationPlan(`${plan}│ 0036_next.sql │\n`, { migration: '0035_recipe_media_layer.sql', mode: 'apply' })).toThrow('exactly');
    expect(() => verifyMigrationPlan('✅ No migrations to apply!', { migration: '0035_recipe_media_layer.sql', mode: 'apply' })).toThrow('exactly');
    expect(verifyMigrationPlan('✅ No migrations to apply!', { migration: '0035_recipe_media_layer.sql', mode: 'certify' })).toEqual({ planned: [] });
    expect(() => verifyMigrationPlan(plan, { migration: '0035_recipe_media_layer.sql', mode: 'certify' })).toThrow('empty migration plan');
    const chain = ['0035_recipe_media_layer.sql', '0036_recipe_catalog_pilot.sql', '0037_recipe_catalog_scale.sql'];
    const chainPlan = `Migrations to be applied:\n${chain.map((name) => `│ ${name} │`).join('\n')}\n`;
    expect(verifyMigrationPlan(chainPlan, { migration: chain.at(-1), chain, mode: 'apply' })).toEqual({ planned: chain });
    expect(() => verifyMigrationPlan(`│ ${chain[0]} │\n│ ${chain[2]} │\n`, { migration: chain.at(-1), chain, mode: 'apply' })).toThrow('exactly');
    expect(() => verifyMigrationPlan(`│ ${chain[1]} │\n│ ${chain[0]} │\n│ ${chain[2]} │\n`, { migration: chain.at(-1), chain, mode: 'apply' })).toThrow('exactly');
    expect(() => verifyMigrationPlan(`${chainPlan}│ 0038_future.sql │\n`, { migration: chain.at(-1), chain, mode: 'apply' })).toThrow('exactly');
  });

  it('detects any aggregate drift and requires clean health pragmas', () => {
    const pre = ok([{ users: 5, recipes: 71 }]);
    expect(verifyBaselinePreserved(pre, ok([{ users: 5, recipes: 71 }]))).toMatchObject({ drift: 'none' });
    expect(() => verifyBaselinePreserved(pre, ok([{ users: 4, recipes: 71 }]))).toThrow('drift detected in users');
    // Catalog-growth chains may grow the catalog tables only; users/inventory/legacy id prefixes never move.
    const growthPre = ok([{ users: 5, inventory_lots: 9, recipes: 71, recipe_runtime_fields: 71, recipes_vn: 59, recipes_global: 12 }]);
    expect(() => verifyBaselinePreserved(growthPre, ok([{ users: 5, inventory_lots: 9, recipes: 500, recipe_runtime_fields: 500, recipes_vn: 59, recipes_global: 12 }]))).toThrow('drift detected in recipes, recipe_runtime_fields');
    expect(verifyBaselinePreserved(growthPre, ok([{ users: 5, inventory_lots: 9, recipes: 500, recipe_runtime_fields: 500, recipes_vn: 59, recipes_global: 12 }]), { catalogGrowth: true })).toMatchObject({ drift: 'none', catalogGrowth: ['recipes', 'recipe_runtime_fields'] });
    expect(() => verifyBaselinePreserved(growthPre, ok([{ users: 5, inventory_lots: 8, recipes: 500, recipe_runtime_fields: 500, recipes_vn: 59, recipes_global: 12 }]), { catalogGrowth: true })).toThrow('drift detected in inventory_lots');
    expect(() => verifyBaselinePreserved(growthPre, ok([{ users: 5, inventory_lots: 9, recipes: 500, recipe_runtime_fields: 500, recipes_vn: 58, recipes_global: 13 }]), { catalogGrowth: true })).toThrow('drift detected in recipes_vn, recipes_global');
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

describe('production catalog certification against the shipped release manifest (T15A)', () => {
  const release = JSON.parse(readFileSync(CATALOG_RELEASE_MANIFEST, 'utf8'));
  const registry = JSON.parse(readFileSync(APPROVED_BATCHES_REGISTRY, 'utf8'));
  const expected = (tip, rel = release, reg = registry) => expectedCatalogAtTip(rel, tip, reg);
  const verify = (tip, statements) => verifyCatalogAtTip(release, tip, statements, registry);
  const catalog = (recipes, over = {}) => ok([{
    recipes, runtime_fields: recipes, order_min: 0, order_max: recipes - 1, order_distinct: recipes,
    recipes_without_runtime_fields: 0, recipes_without_ingredients: 0, recipes_without_steps: 0, ingredients_without_order: 0,
    media_ready: 0, recipes_without_pending_hero: 0, ...over,
  }]);

  it('derives the expected catalog for each ledger tip from legacy + approved batches (one source of truth)', () => {
    expect(release).toMatchObject({ releaseId: 'rel-bd00a4f53fcaeee4', legacyBaselineCount: 71, expectedRecipeCount: 500 });
    expect(registry.batches.map((b) => b.migration)).toEqual(['0036_recipe_catalog_pilot.sql', '0037_recipe_catalog_scale.sql']);
    expect(release.approvedImportBatches.map((b) => b.batchId)).toEqual(registry.batches.map((b) => b.batchId));
    expect(expected('0034_global_recipe_catalog_parity.sql')).toMatchObject({ recipes: 71, appliedBatches: 0, releaseComplete: false });
    expect(expected('0035_recipe_media_layer.sql')).toMatchObject({ recipes: 71, appliedBatches: 0, releaseComplete: false });
    expect(expected('0036_recipe_catalog_pilot.sql')).toMatchObject({ recipes: 101, appliedBatches: 1, releaseComplete: false });
    expect(expected('0037_recipe_catalog_scale.sql')).toMatchObject({ recipes: 500, appliedBatches: 2, totalBatches: 2, releaseComplete: true });
    expect(() => expected('main')).toThrow('canonical migration tip');
    expect(() => expected('0037_recipe_catalog_scale.sql', { ...release, expectedRecipeCount: 501 })).toThrow('disagrees');
    expect(() => expected('0036_recipe_catalog_pilot.sql', { ...release, approvedImportBatches: [{ ...release.approvedImportBatches[0], releaseBaseCount: 70 }] })).toThrow('does not continue');
    expect(() => expected('0037_recipe_catalog_scale.sql', release, { batches: registry.batches.slice(0, 1) })).toThrow('not registered');
    expect(() => expected('0037_recipe_catalog_scale.sql', release, { batches: registry.batches.map((b) => ({ ...b, recipeCount: b.recipeCount + 1 })) })).toThrow('not registered');
  });

  it('certifies tip 0037 only with exactly 500 complete recipes in order 0..499 and no ready media', () => {
    expect(verify('0037_recipe_catalog_scale.sql', catalog(500))).toMatchObject({ recipes: 500, actualRecipes: 500, appliedBatches: 2, releaseComplete: true, mediaReady: 0 });
    expect(verify('0036_recipe_catalog_pilot.sql', catalog(101))).toMatchObject({ recipes: 101, actualRecipes: 101 });
    expect(verify('0035_recipe_media_layer.sql', catalog(71))).toMatchObject({ recipes: 71 });
  });

  it('fails closed when the database does not hold the catalog its ledger tip promises', () => {
    expect(() => verify('0037_recipe_catalog_scale.sql', catalog(101))).toThrow('recipes 101 != 500');
    expect(() => verify('0036_recipe_catalog_pilot.sql', catalog(71))).toThrow('recipes 71 != 101');
    expect(() => verify('0037_recipe_catalog_scale.sql', catalog(500, { runtime_fields: 499 }))).toThrow('runtime_fields 499 != 500');
    expect(() => verify('0037_recipe_catalog_scale.sql', catalog(500, { order_max: 500, order_distinct: 500 }))).toThrow('runtime_order');
    expect(() => verify('0037_recipe_catalog_scale.sql', catalog(500, { order_distinct: 499 }))).toThrow('runtime_order');
    expect(() => verify('0037_recipe_catalog_scale.sql', catalog(500, { recipes_without_ingredients: 1 }))).toThrow('recipes_without_ingredients=1');
    expect(() => verify('0037_recipe_catalog_scale.sql', catalog(500, { recipes_without_pending_hero: 3 }))).toThrow('recipes_without_pending_hero=3');
    expect(() => verify('0037_recipe_catalog_scale.sql', catalog(500, { media_ready: 1 }))).toThrow('media_ready=1');
    expect(() => verify('0037_recipe_catalog_scale.sql', [])).toThrow('one successful result');
  });

  it('builds an aggregates-only catalog query (no row projection)', () => {
    const query = catalogQuery();
    expect(query).toMatch(/^SELECT \(SELECT COUNT\(\*\) FROM recipes\) AS recipes/);
    expect(query).toContain('AS recipes_without_pending_hero');
    expect(query).not.toMatch(/SELECT \*|LIMIT|title|description/);
  });
});
