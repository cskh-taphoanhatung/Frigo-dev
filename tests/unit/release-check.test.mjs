import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RELEASE_PROPAGATION_PENDING,
  migrationManifest, requireSuccessfulCi, validateReleaseSource,
  verifyDeployedRelease, verifyMigrationLedger,
} from '../../scripts/release-check.mjs';

const repository = 'release-fixture/Frigo';
const goodSha = 'a'.repeat(40);
const successful = {
  id: 2, run_attempt: 1, head_sha: goodSha, head_branch: 'main', event: 'push',
  path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success',
  repository: { full_name: repository }, head_repository: { full_name: repository },
  html_url: 'https://github.com/release-fixture/Frigo/actions/runs/2',
};

describe('release source of truth (local Git only)', () => {
  let cwd, baselineSha, hardenedSha, releaseSha, outsideSha;
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const check = (overrides = {}) => validateReleaseSource({ cwd, baselineSha, hardenedSha, ref: releaseSha, ...overrides });

  beforeAll(() => {
    cwd = mkdtempSync(path.join(tmpdir(), 'frigo-release-'));
    git('init', '-b', 'main');
    git('config', 'user.email', 'release-test@example.invalid');
    git('config', 'user.name', 'Release fixture');
    git('config', 'commit.gpgsign', 'false');
    mkdirSync(path.join(cwd, 'migrations'));
    writeFileSync(path.join(cwd, 'migrations/0001_initial.sql'), 'CREATE TABLE fixture (id TEXT);\n');
    git('add', '.'); git('commit', '-m', 'Reviewed baseline');
    baselineSha = git('rev-parse', 'HEAD');
    git('commit', '--allow-empty', '-m', 'Final approved hardening');
    hardenedSha = git('rev-parse', 'HEAD');
    writeFileSync(path.join(cwd, 'migrations/0002_hardening.sql'), 'CREATE INDEX fixture_id ON fixture(id);\n');
    git('add', '.'); git('commit', '-m', 'Release');
    releaseSha = git('rev-parse', 'HEAD');
    git('update-ref', 'refs/remotes/origin/main', releaseSha);
    git('tag', '-a', 'v1.0.0', '-m', 'Release tag');
    git('commit', '--allow-empty', '-m', 'Unmerged work');
    outsideSha = git('rev-parse', 'HEAD');
  });
  afterAll(() => rmSync(cwd, { recursive: true, force: true }));

  it('pins an approved full SHA in main with exact hardened ancestry', () => {
    expect(check()).toMatchObject({ sha: releaseSha, mainSha: releaseSha, hardenedSha });
  });

  it('resolves an annotated release tag once to an immutable SHA', () => {
    expect(check({ ref: 'refs/tags/v1.0.0' })).toMatchObject({ requestedRef: 'refs/tags/v1.0.0', sha: releaseSha });
  });

  it.each(['main', 'codex/security-hardening-sync', 'v1.0.0', 'abc1234', 'HEAD~1', '--help', 'refs/tags/v1;id', 'refs/heads/v1'])('rejects mutable/ambiguous/unsafe ref %s', (ref) => {
    expect(() => check({ ref })).toThrow('full SHA or refs/tags/v*');
  });

  it('rejects a release outside main even if it contains hardening', () => {
    expect(() => check({ ref: outsideSha })).toThrow('not contained in main');
  });

  it('rejects a release missing the approved hardening commit', () => {
    expect(() => check({ ref: baselineSha })).toThrow('exact approved hardening');
  });

  it('rejects an approved SHA older than the reviewed floor', () => {
    expect(() => check({ baselineSha: hardenedSha, hardenedSha: baselineSha })).toThrow('predates');
  });

  it('requires an exact, nonempty hardening SHA', () => {
    for (const value of ['', 'main', hardenedSha.slice(0, 7)]) expect(() => check({ hardenedSha: value })).toThrow('exact approved');
  });

  it('hashes migrations from the immutable commit, never a dirty working tree', () => {
    const manifest = migrationManifest(cwd, releaseSha);
    expect(manifest).toMatchObject({ version: '0002_hardening.sql', count: 2 });
    expect(manifest.sha256).toMatch(/^[a-f0-9]{64}$/);
    writeFileSync(path.join(cwd, 'migrations/0001_initial.sql'), 'uncommitted alteration');
    expect(migrationManifest(cwd, releaseSha)).toEqual(manifest);
    expect(migrationManifest(cwd, baselineSha).sha256).not.toBe(manifest.sha256);
    git('restore', 'migrations/0001_initial.sql');
  });

  it('rejects missing migration sequence entries', () => {
    writeFileSync(path.join(cwd, 'migrations/0004_gap.sql'), 'SELECT 1;\n');
    git('add', '.'); git('commit', '-m', 'Invalid migration fixture');
    expect(() => migrationManifest(cwd, git('rev-parse', 'HEAD'))).toThrow('gap');
  });
});

describe('hosted CI exact-head gate', () => {
  const check = (runs) => requireSuccessfulCi(runs, { sha: goodSha, repository });
  it('accepts a completed successful main push for the exact SHA', () => {
    expect(check([successful])).toMatchObject({ id: 2, attempt: 1, headSha: goodSha });
  });
  it.each([
    { head_sha: 'b'.repeat(40) }, { head_branch: 'codex/security-hardening-sync' },
    { event: 'pull_request' }, { event: 'workflow_dispatch' }, { path: '.github/workflows/deploy.yml' },
    { repository: { full_name: 'fork/Frigo' } }, { head_repository: { full_name: 'fork/Frigo' } },
    { status: 'in_progress', conclusion: null }, { conclusion: 'failure' },
    { conclusion: 'cancelled' }, { conclusion: 'skipped' }, { conclusion: 'neutral' },
  ])('rejects stale, spoofed, PR-merge, pending, or non-green evidence: %j', (changes) => {
    expect(() => check([{ ...successful, ...changes }])).toThrow('Latest exact-SHA');
  });
  it('does not let an old green run mask a newer failed run or rerun', () => {
    expect(() => check([successful, { ...successful, id: 3, conclusion: 'failure' }])).toThrow();
    expect(() => check([successful, { ...successful, run_attempt: 2, status: 'in_progress', conclusion: null }])).toThrow();
    expect(() => check([
      { ...successful, updated_at: '2026-09-08T01:00:00Z' },
      { ...successful, id: 1, run_attempt: 2, status: 'in_progress', conclusion: null, updated_at: '2026-09-08T02:00:00Z' },
    ])).toThrow();
  });
  it('fails closed when hosted results are absent or malformed', () => {
    expect(() => check([])).toThrow();
    expect(() => check(null)).toThrow();
  });
});

describe('schema and deployment receipts', () => {
  const schema = { version: '0002_auth.sql', migrations: [{ name: '0001_initial.sql' }, { name: '0002_auth.sql' }] };
  const ledger = [{ success: true, results: [{ name: '0001_initial.sql' }, { name: '0002_auth.sql' }] }];
  const manifest = { sha: goodSha, environment: 'production' };
  const ready = { commit: goodSha, environment: 'production', status: 'ok', services: { database: 'ok' }, config: { ok: true } };

  it('records the actual SELECT-only ledger separately from source migration checksums', () => {
    expect(verifyMigrationLedger(schema, ledger)).toMatchObject({ version: schema.version, names: ['0001_initial.sql', '0002_auth.sql'] });
  });
  it.each([
    [], [{ success: false, results: [] }], [{ success: true, results: [] }],
    [{ success: true, results: [{ name: '0001_initial.sql' }] }],
    [{ success: true, results: [...ledger[0].results, { name: '0003_later.sql' }] }],
    [{ success: true, results: [...ledger[0].results, { name: '0002_auth.sql' }] }],
  ].map((statements) => ({ statements })))('rejects missing, failed, duplicate, or unknown later schema: %j', ({ statements }) => {
    expect(() => verifyMigrationLedger(schema, statements)).toThrow();
  });
  it('records deployment only when readiness confirms exact SHA, environment, and health', () => {
    expect(verifyDeployedRelease(manifest, ready)).toMatchObject({ sha: goodSha, environment: 'production' });
  });
  it.each([
    { environment: 'staging' },
    { status: 'unhealthy' }, { status: undefined }, { services: { database: 'error' } },
    { config: { ok: false } }, { config: undefined },
  ])('rejects misleading or unhealthy deployment proof: %j', (changes) => {
    let caught;
    try { verifyDeployedRelease(manifest, { ...ready, ...changes }); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(Error);
    expect(caught.code).toBeUndefined(); // never retryable
  });
  // Commit identity contract: only a canonical full SHA (40 lowercase hex) is accepted at all.
  const otherValidSha = 'b'.repeat(40);
  const caught = (body) => { try { verifyDeployedRelease(manifest, body); } catch (error) { return error; } return undefined; };
  it('A. exact expected canonical SHA passes', () => {
    expect(verifyDeployedRelease(manifest, { ...ready, commit: goodSha })).toMatchObject({ sha: goodSha });
  });
  it('B. a different valid canonical SHA on a healthy correct-environment body is the only retryable outcome', () => {
    expect(caught({ ...ready, commit: otherValidSha })).toMatchObject({ code: RELEASE_PROPAGATION_PENDING, observedSha: otherValidSha });
  });
  it.each([
    ['C. missing commit', (body) => { const { commit, ...rest } = body; return rest; }],
    ['D. null commit', (body) => ({ ...body, commit: null })],
    ['E. empty commit', (body) => ({ ...body, commit: '' })],
    ['F. short SHA', (body) => ({ ...body, commit: goodSha.slice(0, 8) })],
    ['G. malformed SHA (branch name)', (body) => ({ ...body, commit: 'main' })],
    ['G. malformed SHA (uppercase)', (body) => ({ ...body, commit: goodSha.toUpperCase() })],
    ['G. malformed SHA (non-hex, right length)', (body) => ({ ...body, commit: 'g'.repeat(40) })],
    ['G. malformed SHA (41 chars)', (body) => ({ ...body, commit: `${goodSha}0` })],
    ['H. non-string commit (number)', (body) => ({ ...body, commit: 1234567890 })],
    ['H. non-string commit (object)', (body) => ({ ...body, commit: { sha: goodSha } })],
    ['H. non-string commit (array)', (body) => ({ ...body, commit: [goodSha] })],
    ['H. non-string commit (boolean)', (body) => ({ ...body, commit: true })],
  ])('%s fails closed immediately and is never retryable', (_label, mutate) => {
    const error = caught(mutate(ready));
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('not a canonical full Git SHA');
    expect(error.code).toBeUndefined();
  });
  it('I. wrong environment with a valid different SHA fails closed, not retryable', () => {
    const error = caught({ ...ready, commit: otherValidSha, environment: 'staging' });
    expect(error.message).toContain('SHA/environment');
    expect(error.code).toBeUndefined();
  });
  it.each([{ status: 'unhealthy' }, { services: { database: 'error' } }, { config: { ok: false } }])(
    'J. unhealthy body with a valid different SHA fails closed, not retryable: %j', (changes) => {
      const error = caught({ ...ready, commit: otherValidSha, ...changes });
      expect(error.message).toBe('Deployed release is not ready');
      expect(error.code).toBeUndefined();
    },
  );
  it('non-object readiness fails closed', () => {
    for (const body of [null, undefined, 'ok', 42]) expect(() => verifyDeployedRelease(manifest, body)).toThrow('not an object');
  });
});

describe('release workflow guardrails', () => {
  const ci = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const deploy = readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const migrate = readFileSync(new URL('../../.github/workflows/production-d1-migrate.yml', import.meta.url), 'utf8');
  // The workflow edits ship as a patch (docs/ai/recipe-catalog/t15a-r/workflows.patch, sha256
  // 1d5097a5…) because the App credential cannot push .github/workflows/*. The guardrails below
  // assert the wired state; they activate automatically once the patch is applied. Until then
  // the base workflow is asserted only against the invariants it already satisfies.
  const deployWired = deploy.includes('wait-for-deployed-release.mjs');
  const migrateWired = migrate.includes('d1-migration-check.mjs catalog');
  it('validates the active hardening branch and PRs with all existing local gates', () => {
    expect(ci).toContain('branches: [main, master, codex/security-hardening-sync]');
    expect(ci).toContain('pull_request:');
    for (const command of ['pnpm install --frozen-lockfile', 'pnpm lint', 'pnpm typecheck', 'pnpm test', 'pnpm check:migrations', 'pnpm build']) {
      expect(ci).toContain(command);
      expect(deploy).toContain(command);
    }
  });
  it('keeps manual confirmation, protected environment, immutable checkout, and schema-before-deploy gates', () => {
    expect(deploy).toContain("github.ref == 'refs/heads/main'");
    expect(deploy).toContain('inputs.confirm_production == true');
    expect(deploy).toContain('environment: production');
    expect(deploy).toContain('ref: ${{ needs.release.outputs.deploy_sha }}');
    expect(deploy).toContain('GIT_COMMIT:${{ needs.release.outputs.deploy_sha }}');
    expect(deploy).toContain('cancel-in-progress: false');
    const production = deploy.slice(deploy.indexOf('\n  production:'));
    expect(production.indexOf('release-check.mjs recheck')).toBeLessThan(production.indexOf('d1-schema-gate.sh remote'));
    expect(production.indexOf('release-check.mjs schema')).toBeLessThan(production.indexOf('command: deploy'));
    if (deployWired) expect(production.indexOf('command: deploy')).toBeLessThan(production.indexOf('wait-for-deployed-release.mjs'));
    expect(production).not.toContain('migrations apply');
    expect(production).not.toContain('frigo.tungjpstore.net');
  });
  (deployWired ? it : it.skip)('both staging and production prove the exact deployed SHA through bounded convergence, never a single-shot curl', () => {
    const staging = deploy.slice(deploy.indexOf('\n  staging:'), deploy.indexOf('\n  production:'));
    const production = deploy.slice(deploy.indexOf('\n  production:'));
    for (const job of [staging, production]) {
      expect(job).toContain('post-deploy-smoke.sh');
      expect(job).toContain('node scripts/wait-for-deployed-release.mjs release-manifest.json');
      expect(job).not.toMatch(/curl[^\n]*health\/ready[^\n]*> readiness\.json/);
      expect(job).not.toContain('release-check.mjs deployed');
      expect(job.indexOf('post-deploy-smoke.sh')).toBeLessThan(job.indexOf('wait-for-deployed-release.mjs'));
      // Forensic receipt survives a failed convergence.
      expect(job.slice(job.indexOf('wait-for-deployed-release.mjs'))).toMatch(/if: always\(\)[\s\S]*upload-artifact/);
    }
  });
  it('carries no write permission or shell-interpolated dispatch input', () => {
    expect(deploy).not.toMatch(/(?:contents|actions|id-token|deployments): write/);
    expect(deploy).not.toMatch(/run:.*\$\{\{.*(?:inputs\.|github.event.inputs)/);
    expect(deploy).toContain('persist-credentials: false');
  });

  (migrateWired ? it : it.skip)('production D1 migration workflow keeps every fail-closed gate in order (pinned chain + catalog certification)', () => {
    expect(migrate).toContain('workflow_dispatch:');
    expect(migrate).not.toMatch(/\n\s+(?:push|pull_request|schedule|workflow_run):/);
    expect(migrate).toContain("github.ref == 'refs/heads/main'");
    expect(migrate).toContain('inputs.confirm_production_migration == true');
    expect(migrate).toContain('environment: production');
    expect(migrate).toContain('cancel-in-progress: false');
    expect(migrate).toContain('persist-credentials: false');
    expect(migrate).toMatch(/permissions:\n\s+contents: read\n\s+actions: read/);
    expect(migrate).not.toMatch(/(?:contents|actions|id-token|deployments): write/);
    expect(migrate).not.toMatch(/run:.*\$\{\{.*(?:inputs\.|github.event.inputs)/);
    const order = ['d1-migration-check.mjs gate', 'd1-migration-check.mjs identity', 'd1-migration-check.mjs pre-ledger', 'time-travel info',
      'd1-migration-check.mjs bookmark', 'd1-migration-check.mjs baseline', 'd1-migration-check.mjs plan', 'migrations apply frigo-db --remote',
      'd1-migration-check.mjs post-ledger', 'd1-migration-check.mjs verify', 'd1-migration-check.mjs catalog', 'd1-schema-gate.sh remote'];
    const positions = order.map((needle) => migrate.indexOf(needle));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(migrate).toMatch(/if: steps\.pre_ledger\.outputs\.mode == 'apply'/);
    expect(migrate).toContain('m.catalogQuery()');
    // The receipt artifact is always saved, even when a gate fails.
    expect(migrate.slice(migrate.indexOf('d1-schema-gate.sh remote'))).toMatch(/if: always\(\)[\s\S]*upload-artifact/);
  });
});
