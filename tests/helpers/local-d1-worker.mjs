import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unstable_dev, unstable_splitSqlQuery } from 'wrangler';

// workerd 1.20250718 caches prepared SQL in a 1 MiB LRU and crashes (SIGSEGV via
// cloudflare/workerd#5977) when it has to evict. Replaying every migration into one
// workerd instance crosses that line once 0037 (~830 KB) lands, so the harness runs
// on a persisted local D1 and restarts workerd before the cache would overflow.
const STATEMENT_CACHE_HARD_LIMIT = 1024 * 1024;
const STATEMENT_CACHE_BUDGET = STATEMENT_CACHE_HARD_LIMIT / 2;
const MIGRATION_PATTERN = /^\d+.*\.sql$/;

export function listMigrationFiles(directory = 'migrations') {
  return readdirSync(directory).filter((name) => MIGRATION_PATTERN.test(name)).sort();
}

export async function startLocalD1Worker({ name, databaseName, databaseId, token,
  script = 'tests/helpers/inventory-lot-d1-worker.ts' }) {
  const directory = mkdtempSync(path.join(tmpdir(), `frigo-${name}-d1-`));
  const config = path.join(directory, 'wrangler.json');
  writeFileSync(config, JSON.stringify({ name: `frigo-${name}-local-proof`, compatibility_date: '2025-03-01' }));
  const persist = { path: path.join(directory, 'state') };
  let worker;

  const start = async () => {
    worker = await unstable_dev(path.resolve(script), {
      config, ip: '127.0.0.1', port: 0, inspectorPort: 0, local: true, persist,
      logLevel: 'error', vars: { TEST_TOKEN: token },
      experimental: {
        disableExperimentalWarning: true, disableDevRegistry: true, forceLocal: true, watch: false,
        d1Databases: [{ binding: 'DB', database_name: databaseName, database_id: databaseId }],
      },
    });
  };
  const restart = async () => {
    await worker.stop();
    await start();
  };
  const batch = async (statements) => {
    const response = await worker.fetch('http://localhost/', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-test-token': token },
      body: JSON.stringify({ statements: statements.map((sql) => ({ sql })) }),
    });
    return { status: response.status, ...await response.json() };
  };

  await start();

  return {
    fetch: (input, init) => worker.fetch(input, init),
    // Replays the full migration chain into the (empty) persisted D1. Every file is
    // still applied as one batch; only the workerd process is recycled between files.
    async replayMigrations(expect, migrationsDirectory = 'migrations') {
      let cachedBytes = 0;
      for (const file of listMigrationFiles(migrationsDirectory)) {
        const sql = readFileSync(path.join(migrationsDirectory, file), 'utf8');
        const statements = unstable_splitSqlQuery(sql);
        const bytes = statements.reduce((total, statement) => total + Buffer.byteLength(statement, 'utf8'), 0);
        if (bytes >= STATEMENT_CACHE_HARD_LIMIT) {
          throw new Error(`${file} alone exceeds the workerd statement cache (${bytes} bytes); split it before replaying on local D1`);
        }
        if (cachedBytes > 0 && cachedBytes + bytes > STATEMENT_CACHE_BUDGET) {
          await restart();
          cachedBytes = 0;
        }
        const result = await batch(statements);
        expect(result, file).toMatchObject({ status: 200 });
        cachedBytes += bytes;
      }
      // Leave the suite's own queries a cold cache when the replay used most of it.
      if (cachedBytes > STATEMENT_CACHE_BUDGET) await restart();
    },
    async stop() {
      await worker?.stop();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
