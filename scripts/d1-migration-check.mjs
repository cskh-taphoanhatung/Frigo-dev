import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { migrationManifest, requireSuccessfulCi } from './release-check.mjs';

// Production D1 identity is pinned; a mismatch aborts before any mutation.
export const PRODUCTION_D1 = { name: 'frigo-db', id: 'f975ec39-b2c8-4a2a-80e1-0366054599d3' };
const SHA = /^[a-f0-9]{40}$/;
const MIGRATION_NAME = /^\d{4}_[A-Za-z0-9_-]+\.sql$/;

// Aggregate-only baseline: counts, never rows.
export const BASELINE_TABLES = [
  'users', 'households', 'inventory_items', 'inventory_lots', 'inventory_events', 'inventory_commands',
  'meal_plans', 'cooked_meals', 'scans',
  'recipes', 'recipe_ingredients', 'recipe_steps', 'recipe_runtime_fields', 'recipe_runtime_ingredient_order',
];
export const CATALOG_TABLES = ['recipes', 'recipe_ingredients', 'recipe_steps', 'recipe_runtime_fields', 'recipe_runtime_ingredient_order'];
export const CATALOG_RELEASE_MANIFEST = 'packages/recipes/src/import/catalog-release.current.json';
export const APPROVED_BATCHES_REGISTRY = 'data/recipe-import/approved-batches.json';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function baselineQuery() {
  const counts = BASELINE_TABLES.map((table) => `(SELECT COUNT(*) FROM ${table}) AS ${table}`);
  return `SELECT ${counts.join(', ')}, (SELECT COUNT(*) FROM recipes WHERE id LIKE 'vn-%') AS recipes_vn, (SELECT COUNT(*) FROM recipes WHERE id LIKE 'gl-%') AS recipes_global`;
}

// Aggregate-only catalog shape: counts, runtime-order range and per-recipe completeness. Never rows.
export function catalogQuery() {
  return [
    '(SELECT COUNT(*) FROM recipes) AS recipes',
    '(SELECT COUNT(*) FROM recipe_runtime_fields) AS runtime_fields',
    '(SELECT MIN(runtime_order) FROM recipe_runtime_fields) AS order_min',
    '(SELECT MAX(runtime_order) FROM recipe_runtime_fields) AS order_max',
    '(SELECT COUNT(DISTINCT runtime_order) FROM recipe_runtime_fields) AS order_distinct',
    '(SELECT COUNT(*) FROM recipes r WHERE NOT EXISTS (SELECT 1 FROM recipe_runtime_fields f WHERE f.recipe_id = r.id)) AS recipes_without_runtime_fields',
    '(SELECT COUNT(*) FROM recipes r WHERE NOT EXISTS (SELECT 1 FROM recipe_ingredients i WHERE i.recipe_id = r.id)) AS recipes_without_ingredients',
    '(SELECT COUNT(*) FROM recipes r WHERE NOT EXISTS (SELECT 1 FROM recipe_steps s WHERE s.recipe_id = r.id)) AS recipes_without_steps',
    '(SELECT COUNT(*) FROM recipe_ingredients i WHERE NOT EXISTS (SELECT 1 FROM recipe_runtime_ingredient_order o WHERE o.recipe_ingredient_id = i.id)) AS ingredients_without_order',
    '(SELECT COUNT(*) FROM recipe_media WHERE status = \'ready\') AS media_ready',
    '(SELECT COUNT(*) FROM recipes r WHERE (SELECT COUNT(*) FROM recipe_media m WHERE m.recipe_id = r.id AND m.role = \'hero\' AND m.status = \'pending\') <> 1) AS recipes_without_pending_hero',
  ].join(', ').replace(/^/, 'SELECT ');
}

/**
 * The catalog the ledger tip promises. Each approved import batch names its migration, so the
 * expected recipe count after applying migration N is legacy + every batch whose migration is
 * <= N. Migrations before the first batch expect exactly the legacy baseline. The shipped
 * release manifest carries batch identity/count/base; the approved-batches registry names each
 * batch's promoted migration (`recipe:import:check` proves the two agree at the release SHA).
 */
export function expectedCatalogAtTip(release, tip, registry) {
  if (!MIGRATION_NAME.test(tip || '')) throw new Error('Catalog expectation requires a canonical migration tip');
  const batches = release.approvedImportBatches ?? [];
  const registered = new Map((registry?.batches ?? []).map((entry) => [entry.batchId, entry]));
  let recipes = release.legacyBaselineCount;
  let applied = 0;
  for (const [index, batch] of batches.entries()) {
    const entry = registered.get(batch.batchId);
    if (!entry || !MIGRATION_NAME.test(entry.migration || '') || entry.recipeCount !== batch.recipeCount) {
      throw new Error(`Approved batch ${batch.batchId} is not registered with a canonical migration and matching recipe count`);
    }
    if (entry.migration > tip) break;
    if (batch.releaseBaseCount !== recipes) throw new Error(`Approved batch ${batch.batchId} releaseBaseCount ${batch.releaseBaseCount} does not continue the release at ${recipes}`);
    recipes += batch.recipeCount;
    applied = index + 1;
  }
  const complete = applied === batches.length;
  if (complete && recipes !== release.expectedRecipeCount) throw new Error(`Release manifest expectedRecipeCount ${release.expectedRecipeCount} disagrees with legacy + batches ${recipes}`);
  return { releaseId: release.releaseId, tip, recipes, appliedBatches: applied, totalBatches: batches.length, releaseComplete: complete };
}

// Post-apply catalog certification: the database must hold exactly the catalog the tip promises.
export function verifyCatalogAtTip(release, tip, statements, registry) {
  const expected = expectedCatalogAtTip(release, tip, registry);
  const row = singleResult(statements, 'Catalog aggregate')[0];
  const problems = [];
  if (row.recipes !== expected.recipes) problems.push(`recipes ${row.recipes} != ${expected.recipes}`);
  if (row.runtime_fields !== expected.recipes) problems.push(`runtime_fields ${row.runtime_fields} != ${expected.recipes}`);
  if (row.order_min !== 0 || row.order_max !== expected.recipes - 1 || row.order_distinct !== expected.recipes) {
    problems.push(`runtime_order ${row.order_min}..${row.order_max} distinct ${row.order_distinct} != 0..${expected.recipes - 1} distinct ${expected.recipes}`);
  }
  for (const key of ['recipes_without_runtime_fields', 'recipes_without_ingredients', 'recipes_without_steps', 'ingredients_without_order', 'recipes_without_pending_hero']) {
    if (row[key] !== 0) problems.push(`${key}=${row[key]}`);
  }
  // Media population is a separate task; a migration must never mark media ready.
  if (row.media_ready !== 0) problems.push(`media_ready=${row.media_ready}`);
  if (problems.length) throw new Error(`Catalog at ${tip} does not match the release manifest: ${problems.join('; ')}`);
  return { ...expected, actualRecipes: row.recipes, mediaReady: 0, checkedAt: new Date().toISOString() };
}

/**
 * Candidate gate. `migration` must be the repository tip at `ref`; `expectedPreTip` must be an
 * earlier entry of that same manifest. The chain to apply is every manifest entry strictly after
 * `expectedPreTip` through `migration`, in order — each pinned by the hash recorded at `ref`.
 */
export function validateMigrationCandidate({ ref, expectedPreTip, migration, cwd = process.cwd() }) {
  if (!SHA.test(ref || '')) throw new Error('Migration ref must be a full immutable SHA, never a branch or tag');
  if (!MIGRATION_NAME.test(migration || '') || !MIGRATION_NAME.test(expectedPreTip || '')) {
    throw new Error('expected_pre_tip and migration must be canonical NNNN_name.sql migration file names');
  }
  const sha = git(cwd, 'rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`);
  const mainSha = git(cwd, 'rev-parse', '--verify', 'refs/remotes/origin/main^{commit}');
  try { git(cwd, 'merge-base', '--is-ancestor', sha, mainSha); }
  catch { throw new Error('Migration candidate is not contained in main'); }

  const schema = migrationManifest(cwd, sha);
  if (schema.version !== migration) throw new Error(`Repository migration tip at candidate is ${schema.version}, not ${migration}; unexpected later migration or wrong candidate`);
  const preIndex = schema.migrations.findIndex((entry) => entry.name === expectedPreTip);
  if (preIndex === -1) throw new Error(`expected_pre_tip ${expectedPreTip} is not part of the candidate migration history`);
  const chain = schema.migrations.slice(preIndex + 1).map((entry) => entry.name);
  if (chain.length === 0) throw new Error(`expected_pre_tip ${expectedPreTip} must precede ${migration}; nothing to apply`);

  // Historical migrations must be byte-identical to the pinned fixture at the candidate.
  const pinned = JSON.parse(execFileSync('git', ['show', `${sha}:tests/fixtures/migration-sha256.json`], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  const pinnedEntries = Object.entries(pinned.migrations || {});
  if (pinnedEntries.length === 0) throw new Error('Pinned migration fixture is empty');
  for (const [name, sha256] of pinnedEntries) {
    const actual = schema.migrations.find((entry) => entry.name === name);
    if (!actual || actual.sha256 !== sha256) throw new Error(`Historical migration ${name} differs from its pinned hash`);
  }
  return { sha, mainSha, expectedPreTip, migration, chain, schema, pinnedCount: pinnedEntries.length };
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

function singleResult(statements, label) {
  if (!Array.isArray(statements) || statements.length !== 1 || statements[0]?.success !== true || !Array.isArray(statements[0].results)) {
    throw new Error(`${label} query did not return one successful result`);
  }
  return statements[0].results;
}

export function verifyCloudflareIdentity({ list, info, expected = PRODUCTION_D1 }) {
  if (!Array.isArray(list)) throw new Error('d1 list did not return a database array');
  const matches = list.filter((db) => db.name === expected.name);
  if (matches.length !== 1 || matches[0].uuid !== expected.id) throw new Error('Production D1 database name/id mismatch in d1 list');
  // d1 info additionally needs analytics scope; when available it must agree with d1 list.
  if (info !== null && (info?.name !== expected.name || info?.uuid !== expected.id)) throw new Error('Production D1 database name/id mismatch in d1 info');
  return { accountAuthenticated: true, databaseName: expected.name, databaseId: expected.id, infoCrossCheck: info === null ? 'unavailable' : 'match' };
}

// Returns 'apply' when the ledger is exactly the candidate history through expected_pre_tip,
// 'certify' when it already equals the whole candidate history. Anything else is a stop.
export function classifyPreLedger(manifest, statements) {
  const names = singleResult(statements, 'Migration ledger').map((row) => row.name).sort();
  const all = manifest.schema.migrations.map((m) => m.name).sort();
  const chain = new Set(manifest.chain ?? [all.at(-1)]);
  const before = all.filter((name) => !chain.has(name));
  if (JSON.stringify(names) === JSON.stringify(before)) {
    return { mode: 'apply', count: names.length, tip: names.at(-1), names, chain: [...chain] };
  }
  if (JSON.stringify(names) === JSON.stringify(all)) {
    return { mode: 'certify', count: names.length, tip: names.at(-1), names, chain: [] };
  }
  throw new Error('Production migration ledger is neither at expected_pre_tip nor exactly at the candidate migration; stop and reconcile');
}

export function verifyPostLedger(manifest, statements) {
  const names = singleResult(statements, 'Migration ledger').map((row) => row.name).sort();
  const all = manifest.schema.migrations.map((m) => m.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(all)) throw new Error('Post-migration ledger differs from the candidate manifest');
  return { count: names.length, tip: names.at(-1) };
}

// Wrangler prints unapplied migrations as a table; only file names matter. The plan must be the
// exact pinned chain, in order — never a subset, superset or reordering.
export function verifyMigrationPlan(planOutput, { migration, chain = [migration], mode }) {
  const planned = [...new Set((planOutput.match(/\d{4}_[A-Za-z0-9_-]+\.sql/g) || []))];
  if (mode === 'certify') {
    if (planned.length !== 0 || !/No migrations to apply/.test(planOutput)) throw new Error('Certification-only mode expected an empty migration plan');
    return { planned };
  }
  if (JSON.stringify(planned) !== JSON.stringify(chain)) throw new Error(`Migration plan must contain exactly [${chain.join(', ')}]; got [${planned.join(', ')}]`);
  return { planned };
}

// Every aggregate must be preserved, except the catalog tables when the applied chain contains a
// registered catalog-growth migration; the `catalog` step then pins their exact post-apply shape.
// Legacy id prefixes (vn-/gl-) are never allowed to change.
export function verifyBaselinePreserved(pre, post, { catalogGrowth = false } = {}) {
  const preRow = singleResult(pre, 'Pre-migration baseline')[0];
  const postRow = singleResult(post, 'Post-migration baseline')[0];
  const changed = Object.keys(preRow).filter((key) => preRow[key] !== postRow[key]);
  const drift = changed.filter((key) => !(catalogGrowth && CATALOG_TABLES.includes(key)));
  if (drift.length > 0) throw new Error(`Aggregate drift detected in ${drift.join(', ')}`);
  return { pre: preRow, post: postRow, drift: 'none', catalogGrowth: changed };
}

export function verifyHealth({ foreignKeys, quickCheck }) {
  const fk = singleResult(foreignKeys, 'PRAGMA foreign_key_check');
  if (fk.length !== 0) throw new Error(`foreign_key_check reported ${fk.length} violation(s)`);
  const qc = singleResult(quickCheck, 'PRAGMA quick_check');
  if (qc.length !== 1 || Object.values(qc[0])[0] !== 'ok') throw new Error('quick_check did not return ok');
  return { foreignKeyCheck: '[]', quickCheck: 'ok' };
}

// 0035 seeds exactly one pending hero v1 slot per recipe and nothing ready.
export function verifyRecipeMediaSeed({ summary, slots, schema, recipes }) {
  const row = singleResult(summary, 'recipe_media summary')[0];
  const counts = { rows: row.total, hero: row.hero, thumbnail: row.thumbnail, pending: row.pending, ready: row.ready, rejected: row.rejected, superseded: row.superseded };
  const missing = singleResult(slots, 'recipe_media per-recipe slots')[0].recipes_without_exact_hero_v1_pending;
  if (counts.rows !== recipes || counts.hero !== recipes || counts.pending !== recipes ||
      counts.thumbnail !== 0 || counts.ready !== 0 || counts.rejected !== 0 || counts.superseded !== 0 || missing !== 0) {
    throw new Error(`recipe_media seed mismatch: ${JSON.stringify({ ...counts, recipes, missing })}`);
  }
  const objects = singleResult(schema, 'recipe_media schema');
  const names = new Set(objects.map((o) => o.name));
  for (const required of ['idx_recipe_media_current_ready', 'idx_recipe_media_recipe_role_status', 'idx_recipe_media_content_hash', 'trg_recipe_media_ready_immutable_update']) {
    if (!names.has(required)) throw new Error(`recipe_media schema object ${required} is missing`);
  }
  const table = objects.find((o) => o.type === 'table' && o.name === 'recipe_media')?.sql || '';
  for (const fragment of ['REFERENCES recipes(id)', "role IN ('hero', 'thumbnail')", "status IN ('pending', 'ready', 'rejected', 'superseded')", 'version >= 1', 'UNIQUE (recipe_id, role, version)',
    "'recipes/' || recipe_id || '/' || role || '/v' || version"]) {
    if (!table.includes(fragment)) throw new Error(`recipe_media table is missing contract fragment: ${fragment}`);
  }
  return { ...counts, perRecipeHeroV1Pending: 'exact', schemaObjects: [...names].sort(), storageKeyContract: 'exact' };
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

async function main() {
  const [command, file = 'migration-manifest.json', ...args] = process.argv.slice(2);
  if (command === 'gate') {
    const candidate = validateMigrationCandidate({ ref: process.env.MIGRATION_REF, expectedPreTip: process.env.EXPECTED_PRE_TIP, migration: process.env.MIGRATION });
    const repository = process.env.GITHUB_REPOSITORY;
    const ci = await hostedCi(candidate.sha, repository);
    const manifest = { repository, database: PRODUCTION_D1, ...candidate, ci, gatedAt: new Date().toISOString() };
    writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
    if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `candidate_sha=${candidate.sha}\n`, { flag: 'a' });
    console.log(`Migration candidate ${candidate.sha}: ${candidate.expectedPreTip} -> [${candidate.chain.join(', ')}] (${candidate.schema.count} migrations, ${candidate.pinnedCount} pinned hashes verified)`);
    return;
  }
  const manifest = readJson(file);
  if (command === 'identity') {
    manifest.cloudflare = verifyCloudflareIdentity({ list: readJson(args[0]), info: args[1] ? readJson(args[1]) : null });
  } else if (command === 'pre-ledger') {
    manifest.preLedger = classifyPreLedger(manifest, readJson(args[0]));
    if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `mode=${manifest.preLedger.mode}\n`, { flag: 'a' });
    console.log(`Pre-ledger: count=${manifest.preLedger.count} tip=${manifest.preLedger.tip} mode=${manifest.preLedger.mode}`);
  } else if (command === 'bookmark') {
    const bookmark = readJson(args[0]);
    if (typeof bookmark?.bookmark !== 'string' || bookmark.bookmark.length === 0) throw new Error('Time Travel bookmark was not returned');
    manifest.timeTravel = { bookmark: bookmark.bookmark, capturedAt: new Date().toISOString() };
  } else if (command === 'baseline') {
    manifest.preBaseline = singleResult(readJson(args[0]), 'Pre-migration baseline')[0];
  } else if (command === 'plan') {
    manifest.plan = verifyMigrationPlan(readFileSync(args[0], 'utf8'), { migration: manifest.migration, chain: manifest.chain, mode: manifest.preLedger.mode });
  } else if (command === 'applied') {
    manifest.applied = { at: new Date().toISOString(), mode: manifest.preLedger.mode, chain: manifest.preLedger.chain };
  } else if (command === 'post-ledger') {
    manifest.postLedger = verifyPostLedger(manifest, readJson(args[0]));
  } else if (command === 'verify') {
    const [postBaseline, foreignKeys, quickCheck, mediaSummary, mediaSlots, mediaSchema] = args.map(readJson);
    const registry = JSON.parse(readFileSync(APPROVED_BATCHES_REGISTRY, 'utf8'));
    const growthMigrations = new Set(registry.batches.map((batch) => batch.migration));
    const catalogGrowth = (manifest.preLedger.chain ?? []).some((name) => growthMigrations.has(name));
    const preserved = verifyBaselinePreserved([{ success: true, results: [manifest.preBaseline] }], postBaseline, { catalogGrowth });
    manifest.postBaseline = preserved.post;
    manifest.aggregateDrift = preserved.drift;
    manifest.catalogGrowthTables = preserved.catalogGrowth;
    manifest.health = verifyHealth({ foreignKeys, quickCheck });
    // recipe_media exists from 0035 on; every recipe (legacy or imported) owns exactly one pending hero slot.
    if (manifest.postLedger.tip >= '0035_recipe_media_layer.sql') {
      manifest.recipeMedia = verifyRecipeMediaSeed({ summary: mediaSummary, slots: mediaSlots, schema: mediaSchema, recipes: manifest.postBaseline.recipes });
    }
  } else if (command === 'catalog') {
    const release = JSON.parse(readFileSync(CATALOG_RELEASE_MANIFEST, 'utf8'));
    const registry = JSON.parse(readFileSync(APPROVED_BATCHES_REGISTRY, 'utf8'));
    manifest.catalog = verifyCatalogAtTip(release, manifest.postLedger.tip, readJson(args[0]), registry);
    console.log(`Catalog at ${manifest.catalog.tip}: recipes=${manifest.catalog.actualRecipes} batches=${manifest.catalog.appliedBatches}/${manifest.catalog.totalBatches} release=${manifest.catalog.releaseId}`);
  } else if (command === 'schema-gate') {
    manifest.schemaGate = { result: 'PASS', checkedAt: new Date().toISOString() };
  } else {
    throw new Error('Usage: d1-migration-check.mjs <gate|identity|pre-ledger|bookmark|baseline|plan|applied|post-ledger|verify|catalog|schema-gate> [manifest.json] [evidence...]');
  }
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : 'Migration check failed'); process.exitCode = 1; });
}
