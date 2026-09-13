# T13 continuation — independent final review only

**T13 COMPLETE — STOP for INDEPENDENT T13 FINAL REVIEW.** Browser verification,
application freeze and clean-detached local certification are complete. This is
not approval to merge, deploy or reconcile production. The earlier Preview-blocked
WIP checkpoints and limited viewport/API-only reports are historical.

## Exact review target

| Field | Value |
| --- | --- |
| Repository / ID | `vn-ca1/Frigo-dev` / `1368281478` |
| Branch | `hoplite/mende-26679a14--browser-harness-final-cert` |
| Starting docs HEAD | `3262eaff86333da142ada1135e5a20c58ea640eb` |
| Starting application WIP | `fd32aa8deaee7df454245591015780c59f909352` |
| Separate U7 application fix | `47b10e25d6853a9bc4f9dfcf2e83bc01ba330bf2` |
| **T13B_APPLICATION_FREEZE** | **`7b7bb695ee597a46cf4022a2c534e2fea374be5d`** |
| Protected main, unchanged | `d1b06732f8a80db4e77986df31ff28d9f04641fa` |

The freeze was published/fetched with exact equality, then certified in clean
worktree `/tmp/frigo-t13b-detached-cert`. Final docs follow the freeze. The parent
records `T13B_DOCS_HEAD` only after the documentation commit exists, together with
its publication equality and empty freeze→docs non-doc diff. Do not invent a
self-referential SHA or use an old docs WIP as the application freeze.

Read [T13B_FINAL_HARDENING.md](T13B_FINAL_HARDENING.md) for exact executed commands,
failures and evidence locations, then [TEST_MATRIX.md](TEST_MATRIX.md). Original
AC1–AC14 come **only** from
[release/T13_PROPOSED_SCOPE.md](../../release/T13_PROPOSED_SCOPE.md), not an older
renumbered TEST_MATRIX. All 14 PASS; roadmap R3/R4/R5/R6/R7/R8/R11 and
U1/U4/U6/U7/U8/U12/U13/U14 are DONE.

## Reproduce the repository-owned browser harness

Use Node **24.19.0** and pnpm **10.26.0** (certified versions). Playwright is
pinned to **1.63.0**, Chromium **153.0.8010.12**. From a fresh isolated checkout:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
# On hosts missing browser OS libraries, use playwright install --with-deps chromium.
# Finish all Vitest/source-writing/build/migration checks before starting browser.
pnpm test:browser
```

`playwright.config.ts` owns `node scripts/security-preview.mjs`; no managed Preview
or manually backgrounded server is required. Defaults are frontend
`http://127.0.0.1:3000` and local API `http://127.0.0.1:8787`. The run uses one
worker, zero retries, `reuseExistingServer: false` and a bounded startup. Stop an
older server you own before running, or select free ports through supported env:

```sh
PORT=3100 PREVIEW_API_PORT=8887 pnpm test:browser
```

Invalid/equal ports are rejected. Do not attach to an unrelated listener or use
an external/production fallback. Playwright creates real 360×844, 390×844 and
430×844 mobile Chromium projects. `/__preview` supplies synthetic reset/login;
fixtures call the real local authenticated routes and actual adoption executable.
The in-memory SqliteD1 browser harness is separate from the real local workerd/D1
certification suites; neither implies remote D1 testing.

### Isolation and privacy

- Synthetic household/session only, mocked AI, synchronous local scan queue;
  backend external fetch disabled. No production credentials or Cloudflare binding.
- Browser application network/WebSockets are same-origin only; unexpected external
  access fails the test. Known Unsplash images are aborted, not fetched.
- Google Fonts/GSI resources are removed **only** by the isolated HTML transform;
  production HTML/authentication is unchanged.
- Preview controls are same-origin guarded and absent from the production Worker.
- Screenshots, action traces and sanitized diagnostics are gitignored under
  `.hoplite/artifacts/`. Traces omit network snapshots/source capture. The custom
  private reporter sanitizes retained evidence through its actual tested lifecycle.
- The HTML reporter was **removed**, because its embedded archive bypassed the
  initial sanitization. Do not restore it without equivalent lifecycle privacy proof.
- Session credentials go to the operator on stdin, never arguments, URLs, checked-in
  request files, screenshots or documentation. Private artifacts are not public
  links; review/redact before any authorized publication.

### Mandatory serial execution

**Never run Vitest/source-writing checks concurrently with browser checks in the
same worktree.** The first detached browser run produced **35 passed / 1 failed**
(H at 430px). At **14:02:32 UTC** the full suite's
`tests/unit/generate-migration.test.ts` rewrote
`packages/recipes/src/vietnamese-bank.ts` with identical bytes, causing Vite to
reload the page. The retained trace confirmed the same-document marker was lost;
final Git content stayed unchanged.

No freeze edit, weakened assertion, automatic retry or timeout change was used.
After all source-writing suites finished, the **entire** unchanged detached browser
suite passed **36/36** serially. Preserve both the failure and successful evidence;
a zero content diff does not mean a watcher saw no file-write event.

## Explicit adoption path

The supported path is the repository operator executable, not auto-adoption:

```sh
node scripts/inventory-adopt.mjs --help
```

It requires `--base-url`, the explicit `--household` and `--apply`. Use the existing
trusted frontend `--origin`; it cannot override server CSRF policy. Authenticate
with the opaque session cookie value via `--session-stdin` or the documented
secret environment input, never by putting it in command arguments. HTTPS is
required except for literal loopback; redirects are not followed. The operator
first verifies household/session identity and preserves tenancy fences. Missing
terminal evidence must be supplied explicitly via the existing request contract,
not guessed. Lost-response recovery is an explicit rerun of the same intent, not
automatic mutation retry or a fake dry run.

Permanent OP integration coverage runs the actual executable (26 cases), and
browser I runs it against the isolated authenticated app. It proves no-apply and
wrong-household refusal, terminal evidence handling, adoption/stock preservation
and replay. These tests do not authorize running adoption against real households.

## Review-critical invariants

1. **T09 mutates adopted stock; T11 reads it.** Scan/reconciliation routes compose
   authority services; observations and review drafts are evidence, not writers.
   Preserve legacy household fencing, inventory revisions, idempotency, Week
   compatibility, tenancy and existing CSRF/session behavior.
2. **Receipts are separate purchases.** Manual 3 plus receipt 2 gives distinct
   lots and total 5; receipt A/B and same-ingredient receipt lines keep identity.
   Fridge grouped CORRECT preserves existing provenance/purchase facts.
3. **Review lifecycle is PENDING/CONFIRMED/REJECTED only.** `correctionOf()` produces
   `corrected` metadata, not a CORRECTED persisted state. Rejected lines retain raw
   and review evidence but no stock command/stock observation.
4. **Expiry follows evidence.** A receipt without supplied expiry is ESTIMATED
   with a basis or UNKNOWN without one; an explicit user date may be KNOWN.
   Missing confidence/date/price/merchant never becomes a fabricated fact.
5. **U7 edits existing metadata through the existing adapter.** Dirty snapshot
   fields preserve unrelated data; unit conversion stays backend-owned.
   UNIT_MISMATCH preserves safe edits without automatic retry; conflicts refetch.
6. **Bounds preserve identity.** Do not truncate `scanCommandKey()` (200),
   `scanObservationSourceRef()` (200) or `boundedDecisionKey()` (160). Observation
   IDs include prefixes and exceed the source-ref bound. Test realistic 64-character
   scan digests; short fake IDs hid earlier collisions and undecidable observations.
7. **Meal planner remains SAFE_DEFERRED.** Its projection snapshot is not T11
   canonical authority. Production `MEAL_PLANNER_ENABLED` stays unbound/off;
   `MEAL_PLANNER_AUTHORITY_CUTOVER` must precede enabling for adopted households.

## Certified result and honest limits

| Gate | Final result |
| --- | --- |
| Full pre-freeze / detached | **3372/132 / 3372/132** tests/files |
| Focused | **194/10**, including 26 hardening and 26 actual CLI |
| Browser pre-freeze / final serial detached | **36/36 / 36/36**, flows A–I plus U7 and T10 reconciliation |
| T08 / T09 / T10 | **130/2 / 1259/17 / 98/6** |
| T11 / T12 / T13-T13B | **39/2 / 22/3 / 271/12** |
| Real local workerd/D1 | **92/5** |
| Detached lint/typecheck/build/migration smoke/schema | **PASS** |
| Fresh local D1 / populated legacy replay | **31 applied / PASS**; targeted legacy 2 pass, 52 not selected; pre-0031 smoke upgrade PASS |
| Migration integrity | **31**, 0031 blob `c580d30b589ace1102cdfda7e61bfbacc57c4253` unchanged, 0032 absent |
| Writer/reader UNKNOWN; detached final status/diff | **0/0; EMPTY/EMPTY** |

Selections overlap; browser is separate from Vitest. Prior 3177/124 and other
intermediate counts are not the current baseline. Final real viewport checks and
UI accept/dismiss replace the old emulation-unavailable/API-only limitations.
Physical devices, external image/identity services and production are not certified.

**NO HOSTED GITHUB CI STATUS FOR T13B_APPLICATION_FREEZE.** Exact-freeze status
contexts = 0 and matching completed push-workflow runs = 0; aggregate pending with
no contexts is not a hosted success claim. Local PASS is not deployment evidence.

## Stop boundary

Next and only authorized next action: **INDEPENDENT T13 FINAL REVIEW** of the
exact freeze and its docs-only publication. Do not start T14, merge main, deploy,
access remote D1, change PayOS/payments/billing/checkout, or start Frigo ↔ Frigo-dev
production reconciliation. Any later reconciliation requires separate authorization
after independent final review PASS.
