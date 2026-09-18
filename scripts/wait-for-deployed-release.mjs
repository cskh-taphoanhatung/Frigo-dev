import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { RELEASE_PROPAGATION_PENDING, verifyDeployedRelease } from './release-check.mjs';

// After `wrangler deploy` the edge can keep answering /health/ready from the previous Worker
// version for a short while. A single immediate check therefore produced a false-negative
// deployment failure (Deploy run 35288137887). This helper polls readiness within a bounded
// deadline, retrying ONLY the "healthy, right environment, previous SHA" case classified by
// `verifyDeployedRelease`; every other failure stops immediately. On success it records the
// same `deployed` receipt field `release-check.mjs deployed` would have written.
export const DEFAULT_DEADLINE_MS = 90_000;
export const DEFAULT_INTERVAL_MS = 3_000;
export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
// Edge/network blips while the new version settles; anything past this count is a real outage.
export const MAX_TRANSIENT_FAILURES = 3;

const short = (sha) => (typeof sha === 'string' && sha.length >= 8 ? sha.slice(0, 8) : 'unknown');

export async function waitForDeployedRelease(manifest, {
  url, fetch: fetchImpl = globalThis.fetch, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  deadlineMs = DEFAULT_DEADLINE_MS, intervalMs = DEFAULT_INTERVAL_MS, requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, log = console.log,
}) {
  const origin = new URL(url);
  if (origin.protocol !== 'https:' || origin.origin !== url) throw new Error('Deployment URL must be an exact HTTPS origin');
  const readiness = new URL('/api/v1/health/ready', origin);
  const startedAt = now();
  let attempt = 0;
  let transientFailures = 0;
  for (;;) {
    attempt += 1;
    let body;
    try {
      const response = await fetchImpl(readiness, { signal: AbortSignal.timeout(requestTimeoutMs), redirect: 'error' });
      if (response.status >= 500 || response.status === 429) {
        transientFailures += 1;
        if (transientFailures > MAX_TRANSIENT_FAILURES) throw new Error(`Readiness endpoint kept failing (HTTP ${response.status})`);
        log(`attempt ${attempt}: readiness HTTP ${response.status}; transient ${transientFailures}/${MAX_TRANSIENT_FAILURES}, retrying`);
      } else if (!response.ok) {
        throw new Error(`Readiness endpoint returned HTTP ${response.status}`);
      } else {
        body = await response.json();
      }
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error('Readiness response is not valid JSON');
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError' || error?.code === 'ECONNRESET' || error?.name === 'TypeError') {
        transientFailures += 1;
        if (transientFailures > MAX_TRANSIENT_FAILURES) throw new Error(`Readiness endpoint unreachable after ${transientFailures} attempts`);
        log(`attempt ${attempt}: readiness request failed (${error.name}); transient ${transientFailures}/${MAX_TRANSIENT_FAILURES}, retrying`);
      } else {
        throw error;
      }
    }
    if (body !== undefined) {
      try {
        const deployed = verifyDeployedRelease(manifest, body);
        log(`attempt ${attempt}: readiness identifies release ${short(deployed.sha)} in ${deployed.environment}`);
        return { ...deployed, attempts: attempt, waitedMs: now() - startedAt };
      } catch (error) {
        if (error?.code !== RELEASE_PROPAGATION_PENDING) throw error;
        log(`attempt ${attempt}: healthy endpoint, observed_sha=${short(error.observedSha)}, expected_sha=${short(manifest.sha)}, retrying`);
      }
    }
    if (now() - startedAt + intervalMs > deadlineMs) {
      throw new Error(`Readiness did not identify release ${short(manifest.sha)} within ${deadlineMs} ms (${attempt} attempts); the deployed version must be inspected by an operator`);
    }
    await sleep(intervalMs);
  }
}

async function main() {
  const [file = 'release-manifest.json'] = process.argv.slice(2);
  const url = process.env.APP_SMOKE_URL;
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  manifest.deployed = await waitForDeployedRelease(manifest, { url });
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Deployed release ${manifest.deployed.sha} verified in ${manifest.deployed.environment} after ${manifest.deployed.attempts} attempt(s)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : 'Deployed release wait failed'); process.exitCode = 1; });
}
