import { describe, expect, it } from 'vitest';
import { MAX_TRANSIENT_FAILURES, waitForDeployedRelease } from '../../scripts/wait-for-deployed-release.mjs';

const newSha = 'a'.repeat(40);
const oldSha = 'b'.repeat(40);
const manifest = { sha: newSha, environment: 'staging' };
const url = 'https://frigo-staging.example.workers.dev';
const body = (over = {}) => ({ commit: newSha, environment: 'staging', status: 'ok', services: { database: 'ok' }, config: { ok: true }, ...over });

// Deterministic harness: scripted responses, virtual clock advanced by `sleep`, no real timers.
function harness(responses) {
  let clock = 0;
  const calls = [];
  const logs = [];
  const fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    const next = responses.shift();
    if (next === undefined) throw new Error('harness exhausted');
    if (next instanceof Error) throw next;
    if (typeof next === 'number') return { ok: next < 400, status: next, json: async () => ({}) };
    if (typeof next === 'string') return { ok: true, status: 200, json: async () => JSON.parse(next) };
    return { ok: true, status: 200, json: async () => next };
  };
  const options = { url, fetch, now: () => clock, sleep: async (ms) => { clock += ms; }, deadlineMs: 90_000, intervalMs: 3_000, log: (line) => logs.push(line) };
  return { options, calls, logs, clock: () => clock };
}

describe('wait-for-deployed-release — bounded exact-SHA convergence', () => {
  it('passes on the first attempt when readiness already identifies the exact release', async () => {
    const h = harness([body()]);
    await expect(waitForDeployedRelease(manifest, h.options)).resolves.toMatchObject({ sha: newSha, environment: 'staging', attempts: 1, waitedMs: 0 });
    expect(h.calls[0].url).toBe(`${url}/api/v1/health/ready`);
    expect(h.calls[0].init.redirect).toBe('error');
  });

  it('regression for Deploy run 35288137887: healthy endpoint still on the previous SHA, then the new SHA', async () => {
    const h = harness([body({ commit: oldSha }), body({ commit: oldSha }), body()]);
    await expect(waitForDeployedRelease(manifest, h.options)).resolves.toMatchObject({ sha: newSha, attempts: 3, waitedMs: 6_000 });
    expect(h.logs.filter((line) => line.includes(`observed_sha=${oldSha.slice(0, 8)}`))).toHaveLength(2);
    expect(h.logs.join('\n')).not.toContain(oldSha); // sanitized: short SHAs only
  });

  it('fails after the bounded deadline when the previous SHA never converges — and never redeploys', async () => {
    const h = harness(Array.from({ length: 40 }, () => body({ commit: oldSha })));
    await expect(waitForDeployedRelease(manifest, h.options)).rejects.toThrow('did not identify release aaaaaaaa within 90000 ms');
    // Attempts at t=0,3s,…,90s inclusive; the wait never runs past the deadline.
    expect(h.clock()).toBe(90_000);
    expect(h.calls.length).toBe(31);
  });

  it('fails closed immediately on the wrong environment, even with the expected SHA', async () => {
    const h = harness([body({ environment: 'production' }), body()]);
    await expect(waitForDeployedRelease(manifest, h.options)).rejects.toThrow('exact approved release SHA/environment');
    expect(h.calls).toHaveLength(1);
  });

  it('fails closed immediately on malformed readiness JSON', async () => {
    const h = harness(['{not json']);
    await expect(waitForDeployedRelease(manifest, h.options)).rejects.toThrow('not valid JSON');
    expect(h.calls).toHaveLength(1);
  });

  it.each([
    body({ status: 'unhealthy' }), body({ services: { database: 'error' } }), body({ config: { ok: false } }),
    body({ commit: oldSha, status: 'unhealthy' }),
  ])('fails closed immediately on explicit unhealthy readiness: %j', async (unhealthy) => {
    const h = harness([unhealthy, body()]);
    await expect(waitForDeployedRelease(manifest, h.options)).rejects.toThrow('not ready');
    expect(h.calls).toHaveLength(1);
  });

  it('fails closed on non-transient HTTP errors (401/403/404)', async () => {
    for (const status of [401, 403, 404]) {
      const h = harness([status, body()]);
      await expect(waitForDeployedRelease(manifest, h.options)).rejects.toThrow(`HTTP ${status}`);
      expect(h.calls).toHaveLength(1);
    }
  });

  it('tolerates a bounded number of transient edge failures (5xx/429/timeouts) then passes', async () => {
    const timeout = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    const h = harness([503, 429, timeout, body()]);
    await expect(waitForDeployedRelease(manifest, h.options)).resolves.toMatchObject({ attempts: 4 });
  });

  it('stops once transient failures exceed the bound', async () => {
    const h = harness(Array.from({ length: MAX_TRANSIENT_FAILURES + 1 }, () => 503).concat([body()]));
    await expect(waitForDeployedRelease(manifest, h.options)).rejects.toThrow('kept failing (HTTP 503)');
    expect(h.calls).toHaveLength(MAX_TRANSIENT_FAILURES + 1);
  });

  it('requires an exact HTTPS origin, like the workflow guard', async () => {
    for (const bad of ['http://frigo.example', 'https://frigo.example/path', 'frigo.example']) {
      await expect(waitForDeployedRelease(manifest, { ...harness([body()]).options, url: bad })).rejects.toThrow();
    }
  });
});
