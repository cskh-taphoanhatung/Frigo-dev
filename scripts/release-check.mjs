import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// The operator-approved final hardening SHA must descend from this reviewed floor.
export const REVIEWED_HARDENING_BASE = 'af661af467ba8620ba6b2919ee958195d179380c';
const SHA = /^[a-f0-9]{40}$/;

export function validateRecipeCatalogMode(value) {
  if (!['static', 'shadow'].includes(value)) {
    throw new Error('Release recipe catalog mode must be static or shadow');
  }
  return value;
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function requireAncestor(cwd, ancestor, descendant, message) {
  try { git(cwd, 'merge-base', '--is-ancestor', ancestor, descendant); }
  catch { throw new Error(message); }
}

export function validateReleaseSource({ ref, hardenedSha, cwd = process.cwd(), baselineSha = REVIEWED_HARDENING_BASE }) {
  if (!SHA.test(hardenedSha || '') || !SHA.test(baselineSha)) {
    throw new Error('An exact approved hardening SHA is required');
  }
  if (!SHA.test(ref || '') && !/^refs\/tags\/v[A-Za-z0-9][A-Za-z0-9._-]*$/.test(ref || '')) {
    throw new Error('Release ref must be a full SHA or refs/tags/v* release tag, never a branch');
  }
  if (!SHA.test(ref)) git(cwd, 'check-ref-format', ref);
  const sha = git(cwd, 'rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`);
  const mainSha = git(cwd, 'rev-parse', '--verify', 'refs/remotes/origin/main^{commit}');
  requireAncestor(cwd, baselineSha, hardenedSha, 'Approved hardening SHA predates the reviewed security baseline');
  requireAncestor(cwd, hardenedSha, sha, 'Release does not contain the exact approved hardening commit');
  requireAncestor(cwd, sha, mainSha, 'Release is not contained in main');
  return { requestedRef: ref, sha, mainSha, hardenedSha, reviewedHardeningBase: baselineSha };
}

export function migrationManifest(cwd, sha) {
  if (!SHA.test(sha)) throw new Error('Migration manifest requires an exact SHA');
  const files = git(cwd, 'ls-tree', '-r', '--name-only', sha, '--', 'migrations').split('\n').filter((file) => file.endsWith('.sql')).sort();
  if (files.length === 0) throw new Error('No migrations found at release SHA');
  const migrations = files.map((file, index) => {
    const name = file.replace(/^migrations\//, '');
    if (!/^\d{4}_[A-Za-z0-9_-]+\.sql$/.test(name) || Number(name.slice(0, 4)) !== index + 1) {
      throw new Error('Migration sequence is malformed, duplicated, or has a gap');
    }
    const bytes = execFileSync('git', ['show', `${sha}:${file}`], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    return { name, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
  return {
    version: migrations.at(-1).name,
    count: migrations.length,
    sha256: createHash('sha256').update(JSON.stringify(migrations)).digest('hex'),
    migrations,
  };
}

export function requireSuccessfulCi(runs, { sha, repository }) {
  if (!Array.isArray(runs)) throw new Error('Hosted CI response is invalid');
  const matching = runs.filter((run) => run.head_sha === sha && run.head_branch === 'main' &&
    run.event === 'push' && run.path === '.github/workflows/ci.yml' &&
    run.repository?.full_name === repository && run.head_repository?.full_name === repository);
  const activityTime = (run) => Date.parse(run.updated_at || run.run_started_at || run.created_at) || 0;
  const latest = matching.sort((a, b) => activityTime(b) - activityTime(a) || b.id - a.id || b.run_attempt - a.run_attempt)[0];
  if (!latest || latest.status !== 'completed' || latest.conclusion !== 'success') {
    throw new Error('Latest exact-SHA CI push run on main must be completed and successful');
  }
  return { id: latest.id, attempt: latest.run_attempt, url: latest.html_url, headSha: latest.head_sha, checkedAt: new Date().toISOString() };
}

async function hostedCi(sha, repository) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || '') || !process.env.GH_TOKEN) {
    throw new Error('Repository-scoped hosted CI read access is required');
  }
  const query = new URLSearchParams({ event: 'push', branch: 'main', head_sha: sha, per_page: '100' });
  const response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/ci.yml/runs?${query}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(30_000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`Hosted CI lookup failed (HTTP ${response.status})`);
  return requireSuccessfulCi((await response.json()).workflow_runs, { sha, repository });
}

export function verifyMigrationLedger(schema, statements) {
  if (!Array.isArray(statements) || statements.length !== 1 || statements[0]?.success !== true || !Array.isArray(statements[0].results)) {
    throw new Error('Migration ledger query did not return one successful result');
  }
  const names = statements[0].results.map((row) => row.name).sort();
  const expected = schema.migrations.map((migration) => migration.name).sort();
  // Unknown later migrations require an explicit compatibility review, not a blind rollback.
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error('D1 migration ledger differs from the release; migration/rollback owner review required');
  return { version: schema.version, names, checkedAt: new Date().toISOString() };
}

export const RELEASE_PROPAGATION_PENDING = 'RELEASE_PROPAGATION_PENDING';

/**
 * Exact deployment proof. `readiness.commit` must be a canonical full Git SHA (40 lowercase hex);
 * anything else (missing, short, uppercase, non-string) fails closed. A healthy body in the right
 * environment that reports a *different valid* SHA is the only retryable outcome (the edge may still
 * answer from another release during deployment convergence); `error.code ===
 * RELEASE_PROPAGATION_PENDING` marks it. Nothing here proves which release that SHA belongs to.
 */
export function verifyDeployedRelease(manifest, readiness) {
  if (typeof readiness !== 'object' || readiness === null) throw new Error('Readiness response is not an object');
  if (readiness.environment !== manifest.environment) {
    throw new Error('Readiness does not identify the exact approved release SHA/environment');
  }
  if (!['ok', 'degraded'].includes(readiness.status) || readiness.services?.database !== 'ok' || readiness.config?.ok !== true) {
    throw new Error('Deployed release is not ready');
  }
  if (typeof readiness.commit !== 'string' || !SHA.test(readiness.commit)) {
    throw new Error('Readiness commit is not a canonical full Git SHA');
  }
  if (readiness.commit !== manifest.sha) {
    const error = new Error('Readiness does not identify the exact approved release SHA/environment');
    error.code = RELEASE_PROPAGATION_PENDING;
    error.observedSha = readiness.commit;
    throw error;
  }
  return { sha: readiness.commit, environment: readiness.environment, checkedAt: new Date().toISOString() };
}

function writeManifest(file, manifest) {
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  const [command, file = 'release-manifest.json', evidenceFile] = process.argv.slice(2);
  if (command === 'gate') {
    const environment = process.env.RELEASE_ENVIRONMENT;
    if (!['production', 'staging'].includes(environment)) throw new Error('Invalid release environment');
    const recipeCatalogMode = validateRecipeCatalogMode(process.env.RECIPE_CATALOG_MODE);
    const hardenedSha = process.env.HARDENED_SHA ||
      (environment === 'staging' && process.env.GITHUB_EVENT_NAME === 'workflow_run' ? REVIEWED_HARDENING_BASE : undefined);
    const source = validateReleaseSource({ ref: process.env.RELEASE_REF, hardenedSha });
    const repository = process.env.GITHUB_REPOSITORY;
    const manifest = {
      ...source, repository, environment, recipeCatalogMode,
      ci: await hostedCi(source.sha, repository),
      schema: migrationManifest(process.cwd(), source.sha),
      workflowRunId: process.env.GITHUB_RUN_ID,
      workflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
      createdAt: new Date().toISOString(),
    };
    writeManifest(file, manifest);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
      `deploy_sha=${source.sha}\nrecipe_catalog_mode=${recipeCatalogMode}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## Approved release candidate\n\n- SHA: \`${source.sha}\`\n- Main: \`${source.mainSha}\`\n- Hardened ancestor: \`${source.hardenedSha}\`\n- Schema: \`${manifest.schema.version}\` (${manifest.schema.sha256})\n- Exact-head CI: ${manifest.ci.url}\n\nCandidate validation is not proof of deployment; see the deployment receipt artifact.\n`);
  } else {
    const manifest = JSON.parse(readFileSync(file, 'utf8'));
    if (command === 'recheck') {
      validateRecipeCatalogMode(manifest.recipeCatalogMode);
      if (git(process.cwd(), 'rev-parse', 'HEAD') !== manifest.sha) throw new Error('Checkout differs from approved release SHA');
      const source = validateReleaseSource({ ref: manifest.sha, hardenedSha: manifest.hardenedSha });
      if (migrationManifest(process.cwd(), source.sha).sha256 !== manifest.schema.sha256) throw new Error('Migration manifest changed');
      manifest.mainShaAtDeploymentGate = source.mainSha;
      manifest.ci = await hostedCi(source.sha, manifest.repository);
    } else if (command === 'schema') {
      manifest.observedMigrationLedger = verifyMigrationLedger(manifest.schema, JSON.parse(readFileSync(evidenceFile, 'utf8')));
    } else if (command === 'deployed') {
      manifest.deployed = verifyDeployedRelease(manifest, JSON.parse(readFileSync(evidenceFile, 'utf8')));
    } else {
      throw new Error('Usage: release-check.mjs <gate|recheck|schema|deployed> [manifest.json] [evidence.json]');
    }
    writeManifest(file, manifest);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : 'Release check failed'); process.exitCode = 1; });
}
