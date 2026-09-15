#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const HELP = `Explicit, single-household inventory adoption (Node >=22.13).

Usage:
  node scripts/inventory-adopt.mjs --base-url URL --household ID --apply [options]

Required:
  --base-url URL       API base including /api/v1, e.g. http://localhost:8787/api/v1
  --household ID       Exact household to adopt; must match authenticated GET /me
  --apply              Explicit consent to activate native inventory authority

Options:
  --origin URL         Existing trusted frontend origin (defaults to API origin)
  --session-stdin      Read the opaque session token from stdin instead of the env
  --request-file PATH  Optional JSON body accepted by POST /inventory/adopt
  --help              Show this help without accessing the API

Authentication:
  Supply only the opaque __Host-frigo_session cookie VALUE via FRIGO_SESSION_TOKEN
  or --session-stdin. Never put credentials in arguments, URLs or request files.
  HTTPS is required except on literal loopback hosts. Redirects are not followed.
  --origin does not change server CSRF policy: use the already trusted app origin.

Example (session supplied by your secret manager/environment):
  node scripts/inventory-adopt.mjs --base-url https://api.example/api/v1 \\
    --origin https://app.example --household hh_example --apply

Request file (optional; no household/actor IDs):
  {"expectedInventoryVersion": 7, "terminalEvidence": [
    {"legacyItemId": "item_example", "state": "DISCARDED", "reason": "Confirmed discarded"}
  ]}
  Omit fields you do not need. Use only reviewed, factual terminal evidence.
  Zero-quantity legacy rows require CONSUMED/DISCARDED evidence; nothing is inferred.
  The certified route enforces its existing limits and rejects invalid input/drift.

Safety and recovery:
  No mass adoption, direct SQL, automatic retries or automatic activation.
  No dry-run: the API has no adoption planning endpoint. /me verifies identity only;
  it is NOT a stock validation preview. --apply is mandatory before any API call.
  Adoption preserves inventory and records a durable household-scoped receipt.
  Rerun the same intent after response loss: the route safely replays that receipt.
  Changed terminal evidence after adoption fails with IDEMPOTENCY_CONFLICT.
  Do not change intent blindly after an uncertain response or a conflict.
  Output contains summary counts/status only, never credentials or evidence text.
  Exit codes: 0 adopted/replayed/help; 1 API/transport failure; 2 invalid local input.
`;

class OperatorError extends Error {
  constructor(code, message, exitCode = 1, httpStatus) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
    this.httpStatus = httpStatus;
  }
}

const API_CODES = new Set([
  'UNAUTHORIZED', 'AUTH_UNAVAILABLE', 'DATABASE_UNAVAILABLE', 'DATABASE_ERROR',
  'SESSION_OWNER_MISMATCH', 'CSRF_ORIGIN_DENIED', 'FORBIDDEN', 'TENANCY_VIOLATION', 'VALIDATION_ERROR',
  'RATE_LIMIT_EXCEEDED', 'RATE_LIMIT_UNAVAILABLE',
  'CONFLICT', 'IDEMPOTENCY_CONFLICT', 'INVENTORY_AUTHORITY_REQUIRED', 'VERSION_OVERFLOW',
  'ADOPTION_ALREADY_ACTIVE', 'ADOPTION_LIMIT_EXCEEDED', 'CORRUPT_RECEIPT',
  'DRIFT_DETECTED', 'INVALID_TERMINAL_EVIDENCE', 'TERMINAL_EVIDENCE_REQUIRED',
  'INVALID_ADOPTION_SNAPSHOT', 'INVALID_COMMAND', 'UNREPRESENTABLE_QUANTITY',
  'HOUSEHOLD_MISMATCH', 'INGREDIENT_NOT_FOUND', 'PERSISTENCE_FAILED',
]);

function inputError(message) {
  return new OperatorError('INVALID_INPUT', message, 2);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) throw new Error();
    return url;
  } catch {
    throw inputError('Use an explicit HTTPS URL without credentials, query or fragment (HTTP only on loopback).');
  }
}

async function main() {
  let options;
  try {
    const parsed = parseArgs({ options: {
      'base-url': { type: 'string' }, household: { type: 'string' },
      origin: { type: 'string' }, 'request-file': { type: 'string' },
      apply: { type: 'boolean' }, 'session-stdin': { type: 'boolean' }, help: { type: 'boolean' },
    }, strict: true, allowPositionals: false, tokens: true });
    const names = parsed.tokens.map((token) => token.name);
    if (new Set(names).size !== names.length) throw new Error();
    options = parsed.values;
  } catch {
    throw inputError('Unknown, repeated or malformed option. See --help; credentials must not be arguments.');
  }
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  if (!options['base-url'] || !options.household || !options.apply) {
    throw inputError('--base-url, --household and --apply are required. See --help.');
  }
  if (options.household !== options.household.trim() || /[\x00-\x20\x7f]/.test(options.household)) {
    throw inputError('--household must be one exact nonblank household ID.');
  }
  const base = safeUrl(options['base-url']);
  if (base.pathname.replace(/\/$/, '') !== '/api/v1') {
    throw inputError('--base-url must end in /api/v1.');
  }
  const origin = options.origin ? safeUrl(options.origin) : base;
  if (options.origin && options.origin !== origin.origin) {
    throw inputError('--origin must be an origin without a path or trailing slash.');
  }

  let body = '{}';
  if (options['request-file']) {
    try {
      const text = await readFile(options['request-file'], 'utf8');
      if (Buffer.byteLength(text) > 65536) throw new Error();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      body = JSON.stringify(parsed);
    } catch {
      throw inputError('--request-file must be a readable JSON object of at most 64 KiB.');
    }
  }

  if (options['session-stdin'] && process.env.FRIGO_SESSION_TOKEN) {
    throw inputError('Supply the session through only one source: env OR --session-stdin.');
  }
  let token = process.env.FRIGO_SESSION_TOKEN;
  if (options['session-stdin']) {
    let text = '';
    try {
      for await (const chunk of process.stdin) {
        text += chunk.toString();
        if (text.length > 4096) throw new Error();
      }
      token = text.trim();
    } catch {
      throw inputError('Cannot read a bounded session token from stdin.');
    }
  }
  if (!token || token.length > 4096 || /[\x00-\x20\x7f]/.test(token)) {
    throw inputError('Supply a nonblank opaque session token via FRIGO_SESSION_TOKEN or --session-stdin.');
  }

  const headers = { Cookie: `__Host-frigo_session=${encodeURIComponent(token)}`, Origin: origin.origin };
  async function request(path, init = {}) {
    let response;
    let data;
    try {
      response = await fetch(`${base.origin}/api/v1${path}`, {
        ...init, headers: { ...headers, ...init.headers },
        redirect: 'error', signal: AbortSignal.timeout(15000),
      });
      data = await response.json().catch(() => null);
    } catch {
      throw new OperatorError('REQUEST_FAILED',
        'Transport/redirect failure. If adoption was sent, its outcome is unknown; retry only the same intent.');
    }
    if (!response.ok) {
      // Never echo arbitrary API text: it may contain private evidence or credentials.
      const code = API_CODES.has(data?.code) ? data.code : 'HTTP_ERROR';
      throw new OperatorError(code,
        'API rejected the request. Review the code and existing inventory; do not change intent blindly.', 1, response.status);
    }
    return { data, status: response.status };
  }

  const { data: profile } = await request('/me');
  const user = profile?.user;
  if (typeof user?.id !== 'string' || !user.id || typeof user?.household?.id !== 'string') {
    throw new OperatorError('INVALID_RESPONSE', 'Identity verification failed; no adoption was sent.');
  }
  if (user.household.id !== options.household) {
    throw new OperatorError('HOUSEHOLD_MISMATCH', 'Authenticated household differs from --household; no adoption was sent.');
  }
  const { data, status } = await request('/inventory/adopt', {
    method: 'POST', body, headers: {
      'Content-Type': 'application/json',
      'X-Frigo-Expected-User-Id': user.id,
      'X-Frigo-Expected-Household-Id': options.household,
    },
  });
  const adoption = data?.adoption;
  const countFields = ['sourceInventoryVersion', 'createdLocationCount', 'createdSnapshotCount', 'mappedLotCount'];
  if (data?.success !== true || adoption?.householdId !== options.household ||
    typeof adoption?.emptyHousehold !== 'boolean' ||
    !countFields.every((key) => Number.isSafeInteger(adoption[key]) && adoption[key] >= 0) ||
    !(status === 201 && data.idempotentReplay === undefined || status === 200 && data.idempotentReplay === true)) {
    throw new OperatorError('INVALID_RESPONSE', 'Unexpected adoption response; outcome may be committed. Retry only the same intent.');
  }
  process.stdout.write(`${JSON.stringify({
    status: data.idempotentReplay ? 'replayed' : 'adopted', householdId: options.household,
    emptyHousehold: adoption.emptyHousehold,
    ...Object.fromEntries(countFields.map((key) => [key, adoption[key]])),
  })}\n`);
}

main().catch((error) => {
  const failure = error instanceof OperatorError ? error :
    new OperatorError('OPERATOR_ERROR', 'Operator tool failed without logging private details.');
  process.stderr.write(`${JSON.stringify({ code: failure.code, message: failure.message, httpStatus: failure.httpStatus })}\n`);
  process.exitCode = failure.exitCode;
});
