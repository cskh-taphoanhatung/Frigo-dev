import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readInventoryAuthorityMode } from '../../packages/db/src/inventory-writer-fence';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { authRoutes } from '../../src/worker/routes/auth';
import { inventoryRoutes } from '../../src/worker/routes/inventory';
import type { AuthContext, Env } from '../../src/worker/types';
import { generateSessionToken, sha256Hex } from '../../src/worker/utils/session';
import { SqliteD1 } from '../helpers/sqlite-d1';

// /me is real; the unused Workers-only mail binding is unavailable in Node.
vi.mock('../../src/worker/services/email', () => ({ sendEmail: vi.fn(), buildOtpEmail: vi.fn() }));

const householdId = 'operator-household';
const actorId = 'operator-user';
const origin = 'https://operator-app.example';
const script = path.resolve('scripts/inventory-adopt.mjs');
let db: SqliteD1;
let server: Server;
let baseUrl: string;
let directory: string;
let sessionToken: string;
let afterProfile: (() => void) | undefined;
let loseAdoptionResponse: boolean;
let transportFault: 'redirect' | 'private-error' | 'invalid-profile' | undefined;
let requests: { method: string; path: string; expectedUser: string | null; expectedHousehold: string | null }[];

beforeEach(async () => {
  db = new SqliteD1();
  db.seed(`INSERT INTO users (id) VALUES ('operator-user'), ('other-user');
    INSERT INTO households (id, name, created_by) VALUES
      ('operator-household', 'Operator fixture', 'operator-user'),
      ('other-household', 'Other fixture', 'other-user');
    INSERT INTO household_members (id, household_id, user_id, role) VALUES
      ('operator-member', 'operator-household', 'operator-user', 'owner'),
      ('other-member', 'other-household', 'other-user', 'owner');
    INSERT INTO inventory_items
      (id, household_id, ingredient_id, name, quantity, unit, category, storage,
        expiry_date, expiry_kind, expiry_source, added_date, data_source)
    VALUES ('operator-rice', 'operator-household', 'RICE', 'Rice', 2, 'kg', 'grain', 'pantry',
      NULL, 'unknown', 'unknown', '2026-09-01', 'manual'),
      ('other-rice', 'other-household', 'RICE', 'Other rice', 3, 'kg', 'grain', 'pantry',
      NULL, 'unknown', 'unknown', '2026-09-01', 'manual');`);
  sessionToken = generateSessionToken();
  await db.prepare(`INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at)
    VALUES ('operator-session', ?, ?, ?, datetime('now', '+1 hour'))`)
    .bind(actorId, householdId, await sha256Hex(sessionToken)).run();
  directory = await mkdtemp(path.join(tmpdir(), 'frigo-adoption-operator-'));
  requests = [];
  afterProfile = undefined;
  transportFault = undefined;
  loseAdoptionResponse = false;
  const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
  app.use('*', authMiddleware);
  app.route('/api/v1', authRoutes);
  app.route('/api/v1', inventoryRoutes);
  const env: Env = { DB: db, ENVIRONMENT: 'production', APP_URL: origin };
  server = createServer(async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      const request = new Request(`${new URL(baseUrl).origin}${incoming.url}`, {
        method: incoming.method, headers,
        ...(!['GET', 'HEAD'].includes(incoming.method ?? 'GET') ? { body: Buffer.concat(chunks) } : {}),
      });
      const pathname = new URL(request.url).pathname;
      requests.push({ method: request.method, path: pathname,
        expectedUser: headers.get('X-Frigo-Expected-User-Id'),
        expectedHousehold: headers.get('X-Frigo-Expected-Household-Id') });
      let response = await app.fetch(request, env);
      if (pathname === '/api/v1/me') {
        afterProfile?.();
        if (transportFault === 'redirect') response = Response.redirect(`${baseUrl}/credential-sink`, 307);
        if (transportFault === 'private-error') response = Response.json({ error: sessionToken, code: sessionToken }, { status: 503 });
        if (transportFault === 'invalid-profile') response = Response.json({ user: { id: actorId } });
      }
      if (pathname === '/api/v1/inventory/adopt' && loseAdoptionResponse) {
        loseAdoptionResponse = false;
        outgoing.destroy();
        return;
      }
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      outgoing.writeHead(500);
      outgoing.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected loopback HTTP listener');
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
  db.close();
  await rm(directory, { recursive: true, force: true });
});

function command(options: { args?: string[]; token?: string; stdin?: string } = {}) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const env = { ...process.env };
    delete env.FRIGO_SESSION_TOKEN;
    if (options.stdin === undefined) env.FRIGO_SESSION_TOKEN = options.token ?? sessionToken;
    const child = spawn(process.execPath, [script, ...(options.args ?? [
      '--base-url', baseUrl, '--origin', origin, '--household', householdId, '--apply',
      ...(options.stdin === undefined ? [] : ['--session-stdin']),
    ])], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(options.stdin);
  });
}

function args(extra: string[] = [], requestedHousehold = householdId) {
  return ['--base-url', baseUrl, '--origin', origin, '--household', requestedHousehold, '--apply', ...extra];
}

function inventoryFacts() {
  return Object.fromEntries(['households', 'inventory_items', 'inventory_lots', 'inventory_commands',
    'inventory_events', 'inventory_adoption_receipts', 'storage_locations']
    .map((table) => [table, db.query(`SELECT * FROM ${table} ORDER BY id`)]));
}

async function requestFile(body: unknown) {
  const filename = path.join(directory, 'adoption.json');
  await writeFile(filename, JSON.stringify(body), { mode: 0o600 });
  return filename;
}

describe('AC13 actual operator CLI → authenticated Hono → SQLite adoption', () => {
  it('documents explicit usage, credential handling and the absence of a fake dry-run', async () => {
    const result = await command({ args: ['--help'] });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('--household');
    expect(result.stdout).toContain('--apply');
    expect(result.stdout).toContain('--session-stdin');
    expect(result.stdout).toContain('No dry-run');
    expect(result.stdout).toContain('IDEMPOTENCY_CONFLICT');
    expect(result.stdout).not.toContain(sessionToken);
    expect(result.stderr).toBe('');
    expect(requests).toEqual([]);
  });

  it.each(['--household', '--apply', '--base-url'])('requires explicit %s before any API access', async (option) => {
    const input = args();
    input.splice(input.indexOf(option), option === '--apply' ? 1 : 2);
    const before = inventoryFacts();
    const result = await command({ args: input });
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stderr).code).toBe('INVALID_INPUT');
    expect(requests).toEqual([]);
    expect(inventoryFacts()).toEqual(before);
  });

  it('adopts one legacy household, preserves all stock and safely replays through the executable', async () => {
    expect(await readInventoryAuthorityMode(db, householdId)).toBe('legacy');
    const stock = db.query('SELECT * FROM inventory_items ORDER BY id');
    const otherHousehold = db.query("SELECT * FROM households WHERE id = 'other-household'");
    const first = await command();
    expect(first.code).toBe(0);
    expect(first.stderr).toBe('');
    expect(JSON.parse(first.stdout)).toMatchObject({ status: 'adopted', householdId,
      emptyHousehold: false, mappedLotCount: 1, createdSnapshotCount: 1, createdLocationCount: 3 });
    expect(requests).toEqual([
      { method: 'GET', path: '/api/v1/me', expectedUser: null, expectedHousehold: null },
      { method: 'POST', path: '/api/v1/inventory/adopt', expectedUser: actorId, expectedHousehold: householdId },
    ]);
    expect(await readInventoryAuthorityMode(db, householdId)).toBe('native');
    expect(await readInventoryAuthorityMode(db, 'other-household')).toBe('legacy');
    expect(db.query('SELECT * FROM inventory_items ORDER BY id')).toEqual(stock);
    expect(db.query("SELECT * FROM households WHERE id = 'other-household'")).toEqual(otherHousehold);
    expect(db.query('SELECT household_id, legacy_item_id, quantity_milli, canonical_unit, state FROM inventory_lots'))
      .toEqual([{ household_id: householdId, legacy_item_id: 'operator-rice', quantity_milli: 2000000,
        canonical_unit: 'g', state: 'ACTIVE' }]);
    expect(db.query('SELECT household_id, actor_id FROM inventory_adoption_receipts'))
      .toEqual([{ household_id: householdId, actor_id: actorId }]);
    const beforeReplay = inventoryFacts();
    const replay = await command({ stdin: `${sessionToken}\n` });
    expect(replay.code).toBe(0);
    expect(JSON.parse(replay.stdout)).toEqual({ ...JSON.parse(first.stdout), status: 'replayed' });
    expect(replay.stderr).toBe('');
    expect(inventoryFacts()).toEqual(beforeReplay);
    expect(first.stdout + replay.stdout).not.toContain(sessionToken);
    const nativeRead = await fetch(`${baseUrl}/inventory`, {
      headers: { Cookie: `__Host-frigo_session=${sessionToken}` },
    });
    expect(nativeRead.status).toBe(200);
    expect(await nativeRead.json()).toMatchObject({ items: [{ id: 'operator-rice',
      lotId: 't08-legacy:operator-rice', householdId, quantityMilli: 2000000, canonicalUnit: 'g', state: 'ACTIVE' }] });
    expect(db.query('SELECT * FROM inventory_items ORDER BY id')).toEqual(stock);
  });

  it('refuses a different explicit household before sending adoption', async () => {
    const before = inventoryFacts();
    const result = await command({ args: args([], 'other-household') });
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe('HOUSEHOLD_MISMATCH');
    expect(requests.map((request) => request.path)).toEqual(['/api/v1/me']);
    expect(inventoryFacts()).toEqual(before);
  });

  it('activates only the explicitly requested empty household with durable receipt evidence', async () => {
    db.seed("DELETE FROM inventory_items WHERE household_id = 'operator-household'");
    const otherStock = db.query('SELECT * FROM inventory_items ORDER BY id');
    const result = await command();
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ status: 'adopted', emptyHousehold: true, mappedLotCount: 0 });
    expect(await readInventoryAuthorityMode(db, householdId)).toBe('native');
    expect(await readInventoryAuthorityMode(db, 'other-household')).toBe('legacy');
    expect(db.query('SELECT * FROM inventory_items ORDER BY id')).toEqual(otherStock);
    expect(db.query('SELECT household_id FROM inventory_adoption_receipts')).toEqual([{ household_id: householdId }]);
  });

  it('fences a session-owner change between identity verification and adoption', async () => {
    afterProfile = () => db.seed(`UPDATE sessions_v2 SET user_id = 'other-user', household_id = 'other-household'
      WHERE id = 'operator-session'`);
    const before = inventoryFacts();
    const result = await command();
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ code: 'SESSION_OWNER_MISMATCH', httpStatus: 403 });
    expect(requests).toHaveLength(2);
    expect(inventoryFacts()).toEqual(before);
  });

  it.each(['invalid', 'revoked', 'expired'])('rejects an %s session without activating authority', async (kind) => {
    if (kind === 'revoked') db.seed("UPDATE sessions_v2 SET revoked_at = datetime('now')");
    if (kind === 'expired') db.seed("UPDATE sessions_v2 SET expires_at = datetime('now', '-1 hour')");
    const before = inventoryFacts();
    const result = await command({ token: kind === 'invalid' ? 'not-a-session' : sessionToken });
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ code: 'UNAUTHORIZED', httpStatus: 401 });
    expect(requests).toHaveLength(1);
    expect(inventoryFacts()).toEqual(before);
  });

  it('uses existing CSRF policy rather than bypassing the trusted origin check', async () => {
    const input = args();
    input[input.indexOf('--origin') + 1] = 'https://untrusted.example';
    const before = inventoryFacts();
    const result = await command({ args: input });
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ code: 'CSRF_ORIGIN_DENIED', httpStatus: 403 });
    expect(inventoryFacts()).toEqual(before);
  });

  it('preserves tenancy rejection when membership is removed after identity verification', async () => {
    afterProfile = () => db.seed("DELETE FROM household_members WHERE id = 'operator-member'");
    const before = inventoryFacts();
    const result = await command();
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ code: 'TENANCY_VIOLATION', httpStatus: 403 });
    expect(inventoryFacts()).toEqual(before);
  });

  it('reports missing terminal evidence, accepts explicit facts, and rejects changed replay intent', async () => {
    db.seed("UPDATE inventory_items SET quantity = 0 WHERE id = 'operator-rice'");
    const before = inventoryFacts();
    const missing = await command();
    expect(missing.code).toBe(1);
    expect(JSON.parse(missing.stderr)).toMatchObject({ code: 'TERMINAL_EVIDENCE_REQUIRED', httpStatus: 422 });
    expect(inventoryFacts()).toEqual(before);
    const terminalEvidence = [{ legacyItemId: 'operator-rice', state: 'DISCARDED', reason: 'Confirmed discarded by owner' }];
    const filename = await requestFile({ terminalEvidence });
    const adopted = await command({ args: args(['--request-file', filename]) });
    expect(adopted.code).toBe(0);
    expect(JSON.parse(adopted.stdout).status).toBe('adopted');
    expect(db.query('SELECT quantity_milli, state FROM inventory_lots')).toEqual([{ quantity_milli: 0, state: 'DISCARDED' }]);
    expect(db.query('SELECT * FROM inventory_items ORDER BY id')).toEqual(before.inventory_items);
    const after = inventoryFacts();
    const replay = await command({ args: args(['--request-file', filename]) });
    expect(replay.code).toBe(0);
    expect(JSON.parse(replay.stdout).status).toBe('replayed');
    await requestFile({ terminalEvidence: [{ ...terminalEvidence[0], reason: 'Changed account' }] });
    const conflict = await command({ args: args(['--request-file', filename]) });
    expect(conflict.code).toBe(1);
    expect(JSON.parse(conflict.stderr)).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', httpStatus: 409 });
    expect(inventoryFacts()).toEqual(after);
    expect(adopted.stdout + replay.stdout + conflict.stderr).not.toContain(terminalEvidence[0].reason);
  });

  it.each([
    [{ expectedInventoryVersion: 9999 }, 'CONFLICT', 409],
    [{ householdId: 'other-household' }, 'VALIDATION_ERROR', 400],
  ])('preserves route validation/version failures for request body %j', async (body, code, httpStatus) => {
    const filename = await requestFile(body);
    const before = inventoryFacts();
    const result = await command({ args: args(['--request-file', filename]) });
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ code, httpStatus });
    expect(inventoryFacts()).toEqual(before);
  });

  it('recovers from a lost committed response only by explicitly rerunning the same tool intent', async () => {
    loseAdoptionResponse = true;
    const first = await command();
    expect(first.code).toBe(1);
    expect(JSON.parse(first.stderr).code).toBe('REQUEST_FAILED');
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    expect(await readInventoryAuthorityMode(db, householdId)).toBe('native');
    const after = inventoryFacts();
    const replay = await command();
    expect(replay.code).toBe(0);
    expect(JSON.parse(replay.stdout).status).toBe('replayed');
    expect(inventoryFacts()).toEqual(after);
  });

  it.each([
    ['redirect', 'REQUEST_FAILED'], ['private-error', 'HTTP_ERROR'], ['invalid-profile', 'INVALID_RESPONSE'],
  ] as const)('fails closed on %s without leaking credentials or posting adoption', async (fault, code) => {
    transportFault = fault;
    const before = inventoryFacts();
    const result = await command();
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe(code);
    expect(result.stdout + result.stderr).not.toContain(sessionToken);
    expect(requests).toHaveLength(1);
    expect(inventoryFacts()).toEqual(before);
  });

  it.each([
    ['--household', 'other-household'], ['--session-token', 'secret-never-in-argv'], ['--dry-run'],
  ])('rejects ambiguous/unsupported flags without echoing arguments: %j', async (...extra) => {
    const result = await command({ args: args(extra) });
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stderr).code).toBe('INVALID_INPUT');
    expect(result.stderr).not.toContain('secret-never-in-argv');
    expect(requests).toEqual([]);
  });

  it('rejects malformed request files without echoing their private contents', async () => {
    const filename = path.join(directory, 'malformed.json');
    await writeFile(filename, sessionToken);
    const result = await command({ args: args(['--request-file', filename]) });
    expect(result.code).toBe(2);
    expect(result.stderr).not.toContain(sessionToken);
    expect(requests).toEqual([]);
  });

  it('refuses missing credentials and ambiguous env/stdin credential sources', async () => {
    const missing = await command({ token: '' });
    expect(missing.code).toBe(2);
    expect(JSON.parse(missing.stderr).code).toBe('INVALID_INPUT');
    const ambiguous = await command({ args: args(['--session-stdin']) });
    expect(ambiguous.code).toBe(2);
    expect(JSON.parse(ambiguous.stderr).code).toBe('INVALID_INPUT');
    expect(missing.stderr + ambiguous.stderr).not.toContain(sessionToken);
    expect(requests).toEqual([]);
  });

  it('rejects non-loopback HTTP and credential-bearing URLs before network access', async () => {
    for (const url of ['http://api.example/api/v1', `https://user:${sessionToken}@api.example/api/v1`]) {
      const input = args();
      input[input.indexOf('--base-url') + 1] = url;
      const result = await command({ args: input });
      expect(result.code).toBe(2);
      expect(result.stderr).not.toContain(sessionToken);
    }
    expect(requests).toEqual([]);
  });
});
