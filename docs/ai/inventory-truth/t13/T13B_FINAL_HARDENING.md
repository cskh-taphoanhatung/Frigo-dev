# T13B final hardening and detached certification — 2026-09-13

**T13 COMPLETE — STOP for INDEPENDENT T13 FINAL REVIEW.** This is local,
clean-detached certification, not a merge, deployment, or independent final-review
approval. The current acceptance and roadmap matrices are in [TEST_MATRIX.md](TEST_MATRIX.md).
Older T13 completion claims, renumbered matrices and browser-blocked checkpoints
are historical and do not establish this result.

## Identity and immutable checkpoints

| Field | Verified value |
| --- | --- |
| Repository | `vn-ca1/Frigo-dev` |
| Repository ID | `1368281478` (fresh public repository metadata) |
| Protected main | `d1b06732f8a80db4e77986df31ff28d9f04641fa` |
| Starting docs HEAD | `3262eaff86333da142ada1135e5a20c58ea640eb` |
| Starting application WIP | `fd32aa8deaee7df454245591015780c59f909352` |
| Continuation branch | `hoplite/mende-26679a14--browser-harness-final-cert` |
| Separate browser-proven U7 fix | `47b10e25d6853a9bc4f9dfcf2e83bc01ba330bf2` |
| **T13B_APPLICATION_FREEZE** | **`7b7bb695ee597a46cf4022a2c534e2fea374be5d`** |
| Detached certification worktree | `/tmp/frigo-t13b-detached-cert` |

Trusted fetch verified the starting branch `hoplite/mende-26679a14` at exact
3262eaff and guarded main. The required ancestry was verified before changes:
`2334a6f → c37a9b8 → f845d04 → fd32aa8 → a9b5904 → 3262eaf`.
`git diff fd32aa8 3262eaf -- . ':(exclude)docs'` was empty. The new branch
started exactly at 3262eaff without resetting or rewriting previous branches.
The U7 fix and freeze were published normally, fetched, and matched remote refs.

The final documentation commit follows the freeze. Its exact `T13B_DOCS_HEAD`
is recorded in the publication report after commit creation, not as an impossible
self-referential hash in its own contents. It must descend from this freeze with
an empty non-doc diff and verified local/remote equality.

## Change separation and review

1. Prior application hardening through fd32aa8 was retained: scan route ownership,
   private-session fencing, safe domain errors, and confirmed read-only presentation.
2. The new U7 browser test proved that existing-lot metadata controls were absent.
   Separate application commit 47b10e2 adds name/unit/category to the existing
   expiry/storage editor and submits only dirty fields through the existing
   versioned PATCH → T09 CORRECT/MOVE adapters. Unit conversion remains server-owned;
   no new stock writer, schema, authentication, or inventory architecture was added.
3. Freeze commit 7b7bb69 adds Playwright, isolated synthetic controls, browser
   assertions, privacy-safe failure artifacts, and pinned test dependencies. No
   production HTML or Cloudflare deployment configuration changed.
4. This subsequent checkpoint changes documentation only.

The full application/test/tooling delta from `c31567ec7dfa8f95808c20c834b327cbb3425f9c`
was reviewed, including untracked additions before freeze. Final scoped findings:
**P0=0, P1=0, blocking P2=0, unresolved scoped P3=0**. Independent supporting
reviews cleared the authority boundary and U7 implementation; these are not the
owner's separate INDEPENDENT T13 FINAL REVIEW.

## Browser harness and isolation

- Node **24.19.0**, pnpm **10.26.0**, Playwright **1.63.0**,
  Chromium **153.0.8010.12**.
- Command: `pnpm test:browser`; webServer owns `node scripts/security-preview.mjs`.
- Frontend `http://127.0.0.1:3000`; local API `http://127.0.0.1:8787`.
- One worker, zero automatic test retries, `reuseExistingServer: false`, 60-second
  startup bound. Explicit `PORT` and `PREVIEW_API_PORT` select alternate isolated
  ports; invalid/equal ports fail. There is no production or external fallback.
- In-memory SqliteD1, mocked AI, synchronous scan queue, synthetic local session,
  external backend fetch disabled, no production Cloudflare bindings or secrets.
- Browser application requests/WebSockets are same-origin only. Known Unsplash
  image requests are aborted, not fetched. Unexpected external access fails tests.
  Google Fonts/GSI bootstrap is removed only by the isolated HTML transform;
  production HTML is unchanged.
- `/__preview` offers synthetic login/reset. Existing controls include `state`,
  `stale-inventory`, `t13-scans`; added controls are `t13-scenarios`, `t13-state`,
  `t13-operator-requests`, `t13-reconciliation`. Controls are test-only, origin
  guarded and absent from the production Worker (404 regression assertions).
- Screenshots are explicit proof or failure-only; failed action traces and
  sanitized console/request diagnostics are gitignored. The HTML reporter was
  removed because its embedded ZIP bypassed sanitization. A real Playwright
  subprocess regression verifies reporter lifecycle redaction and image retention.
  Session credentials are stdin-only for the operator; never CLI arguments or docs.

### Actual browser matrix

Each listed flow passed at **360×844**, **390×844**, and **430×844**, both before
freeze and from the detached freeze. These are real Chromium mobile viewports,
not jsdom or claimed physical-device certification.

| Flow | Synthetic fixture / observed result |
| --- | --- |
| A receipt | `t13b-preview-receipt`: all five editable fields, durable rejection, retained OCR, corrected values, RECEIPT provenance; unknown/0/11%/90% confidence. `t13b-preview-undated`: absent header/price/date and nullable confidence remain unknown. |
| B existing + receipt | `t13b-preview-receipt-purchase-a`, `t13b-preview-legacy-tomato`: existing lot 3 unchanged except enclosing inventory revision; distinct receipt lot 2; aggregate 5; date/invoice/42,000đ displayed. |
| C fridge | `t13b-preview-fridge`: name/quantity/unit/storage/expiry edits and explicit reject; accepted correction commits, rejected line adds no stock, raw evidence survives, SCAN has no purchase facts. |
| D A→B→A | Purchase A and missing-header B: old private values disappear while B GET is delayed; same document retained; exactly one confirm POST targets B with no A payload. |
| E session race | Delayed real scan GET followed by profile logout: releasing old response does not repopulate private UI/store, navigate stale state, or mutate. |
| F UNKNOWN | `preview-stock-egg`: unknown is not green/fresh; explicit date plus storage edit yields KNOWN/freezer, not ESTIMATED. |
| G conflict | `preview-stock-egg`: real competing PATCH creates stale version; UI sends exactly one PATCH, receives 409 CONFLICT, renders safe message and refetches canonical quantity 7. No automatic second mutation. |
| H confirmed | A accepted, B rejected, `t13b-preview-confirmed-empty`: terminal wording, disabled controls, no confirm CTA/manual addition/edit instructions; same-document A→B→A retains terminal state; fridge navigation has zero mutations. |
| I actual operator | Terminal legacy fixture: no `--apply` refuses without requests; wrong household reads identity but never POSTs; explicit terminal evidence required. Intent sequence returns 422/201/200/409; replay keeps state identical and stock preserved. |
| U7 metadata | `preview-stock-chicken`: incompatible unit gets real 422 with draft/stock preserved and no retry; explicit recovery submits name, kg, category, storage, date; T09 preserves canonical quantity, lot identity and provenance. |
| R11/U14 | `t13b-reconciliation-egg` / `t13b-reconciliation-tofu`: real T10 proposals are accepted/dismissed through the UI, with authoritative lot/state rereads. |

A has two cases; total **12 cases × 3 projects = 36 tests**. Layout assertions check
actual viewport width, horizontal overflow, input/select bounds, and actionability
of controls/CTAs. Receipt, fridge, unknown-expiry and metadata screenshots were
captured; narrow-screen layout was visually inspected. No private media was used.

## Executed gates

| Gate | Final result |
| --- | --- |
| Pre-freeze full baseline | **3372/3372 tests, 132/132 files** |
| Pre-freeze browser | **36/36**, all three widths |
| Detached full suite | **3372/3372, 132/132**, exact baseline match |
| Detached browser, serial final run | **36/36**, all three widths |
| T08 focused | **130/130, 2 files** |
| T09 focused | **1259/1259, 17 files** |
| T10 focused | **98/98, 6 files** |
| T11 focused | **39/39, 2 files** |
| T12 focused | **22/22, 3 files** |
| T13/T13B focused | **271/271, 12 files** |
| Current 10-file hardening/privacy/operator gate | **194/194, 10 files**, including hardening 26 and actual CLI 26 |
| Real local workerd/D1 | **92/92, 5 files** (44 lot + 7 observation + 11 read + 8 closed loop + 22 T13) |
| Lint / typecheck / build | PASS / PASS / PASS |
| Migration smoke | PASS, `migration-smoke=ok` |
| Fresh local D1 replay | PASS, all 31 migrations applied in the new detached worktree |
| Legacy replay | PASS, populated-0022 upgrade and fresh replay subset 2/2; 52 unrelated tests not selected; full suite includes all 54 |
| Pre-0031 pending/confirmed scan upgrade | PASS, migration-smoke legacy fixture |
| Local schema gate | PASS, required objects/ledger including 0031 and foreign-key checks |
| Writer UNKNOWN / reader UNKNOWN | **0 / 0**, fresh frozen-source audit |
| Migrations | **31**, 0031 unchanged, **no 0032** |
| Detached diff/status | PASS / **EMPTY**, before install and after all gates |
| Original AC1–AC14 | **ALL PASS**; AC14 closed only after detached final browser PASS |

`CURRENT_FULL_TEST_COUNT=3372`, `CURRENT_FULL_FILE_COUNT=132`.
The earlier 3361/132 full run and 183/10 focused run predate the U7/privacy
regressions and are superseded, not the certified baseline. Full runtime output,
not manual parameterized-test arithmetic, established these counts.

### Exact reproducible commands

Run checks **sequentially**, with browser last. Existing
`tests/unit/generate-migration.test.ts` rewrites watched source with identical
content and can trigger Vite HMR if full Vitest runs alongside the browser.

```sh
git worktree add --detach /tmp/frigo-t13b-detached-cert \
  7b7bb695ee597a46cf4022a2c534e2fea374be5d
cd /tmp/frigo-t13b-detached-cert
git status --porcelain                         # must be empty
pnpm install --frozen-lockfile
# Install Chromium on a fresh host; use --with-deps if OS libraries are missing.
pnpm exec playwright install chromium
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm check:migrations
CI=1 WRANGLER_SEND_METRICS=false pnpm exec wrangler d1 migrations apply frigo-db --local
CI=1 WRANGLER_SEND_METRICS=false pnpm schema:check:local
```

Chromium was already installed in this session's shared browser cache and was
actually launched by the detached suite; no separate browser reinstall was needed.
The frozen dependency install passed with pnpm's existing ignored-build-script
warning; all runtime/build/D1 gates still executed successfully.

Focused commands executed from the same detached worktree:

```sh
pnpm exec vitest run tests/unit/inventory-truth.test.ts tests/integration/inventory-truth.test.ts

pnpm exec vitest run \
  tests/unit/inventory-lot-commands.test.ts tests/unit/inventory-fefo.test.ts \
  tests/unit/inventory-adoption.test.ts tests/unit/inventory-idempotency.test.ts \
  tests/integration/inventory-lot-commands.test.ts tests/integration/inventory-lot-authority.test.ts \
  tests/integration/inventory-lot-schema.test.ts tests/integration/inventory-event-authority.test.ts \
  tests/integration/inventory-fefo.test.ts tests/integration/inventory-fefo-schema.test.ts \
  tests/integration/inventory-backfilled-fefo.test.ts tests/integration/inventory-backfilled-patch.test.ts \
  tests/integration/inventory-patch-parity.test.ts tests/integration/inventory-adoption.test.ts \
  tests/integration/inventory-writer-fence.test.ts tests/integration/inventory-concurrency.test.ts \
  tests/integration/inventory-lot-d1.test.mjs

pnpm exec vitest run tests/unit/inventory-observations.test.ts \
  tests/integration/inventory-observations.test.ts tests/integration/inventory-observation-concurrency.test.ts \
  tests/integration/inventory-reconciliation-composition.test.ts \
  tests/integration/inventory-reconciliation-fence.test.ts tests/integration/inventory-observation-d1.test.mjs
pnpm exec vitest run tests/integration/inventory-read-authority.test.ts tests/integration/inventory-read-authority-d1.test.mjs
pnpm exec vitest run tests/integration/inventory-closed-loop.test.ts \
  tests/integration/inventory-closed-loop-routes.test.ts tests/integration/inventory-closed-loop-d1.test.mjs
pnpm exec vitest run tests/unit/t13* tests/integration/t13* tests/integration/inventory-adoption-operator.test.ts

pnpm exec vitest run tests/unit/t13b-fridge-hardening.test.tsx \
  tests/unit/t13b-fridge-review.test.tsx tests/unit/t13b-receipt-review.test.tsx \
  tests/unit/t13b-inventory-detail.test.tsx tests/integration/t13b-review-roundtrip.test.tsx \
  tests/integration/inventory-adoption-operator.test.ts tests/integration/t13b-preview-fixtures.test.mjs \
  tests/integration/t13b-browser-tooling.test.mjs tests/unit/scan-privacy.test.tsx tests/unit/client-session.test.ts

pnpm exec vitest run tests/integration/inventory-lot-d1.test.mjs \
  tests/integration/inventory-observation-d1.test.mjs tests/integration/inventory-read-authority-d1.test.mjs \
  tests/integration/inventory-closed-loop-d1.test.mjs tests/integration/t13-receipt-vision-d1.test.mjs \
  --maxWorkers=2 --minWorkers=1
pnpm exec vitest run tests/integration/inventory-truth.test.ts \
  -t 'replays all 30 migrations|upgrades a populated 0022 database'
# The historical test title says 30; its assertions require the current 31.
pnpm test:browser
git diff --check
git status --porcelain                         # must still be empty
```

The populated-0022 focused replay uses SqliteD1/Node SQLite, not workerd. It is
not substituted for the separately executed 92 real local-D1 tests or fresh
Wrangler D1 replay. Migration smoke also exercises pre-0031 scan evidence backfill.
No remote command was executed.

## Failures, corrections and final disposition

- Historical Managed Preview promotion-schema failure remains a platform issue,
  but the owner's active packet no longer requires that mechanism. Repository-owned
  Playwright owns the same isolated preview; no production fallback was used.
- Early harness assertions used wrong accessible selectors, canonical units,
  status codes, and operator base URL. These were corrected to actual contracts,
  not by changing application behavior. Known static image requests are blocked.
- Flow B originally compared the enclosing inventory revision as if it were
  immutable lot state; now only that revision may advance while every lot field
  remains identical. Flow I now separates unrelated bootstrap identity requests
  from operator request assertions. Both fixes passed the complete mobile matrix.
- U7 negative Chromium run failed at the absent name control. The separate 47b10e2
  fix passed 20 detail unit cases and real-browser correction/rejection proof;
  independent PATCH regression verification passed 68/68 in two existing files.
  Intermediate message-case/wording assertions were corrected to existing safe
  domain messages; error presentation was not changed to accommodate tests.
- Privacy review demonstrated synthetic credential leakage in the HTML report's
  embedded archive, despite sanitized external ZIPs. HTML output was removed;
  real reporter lifecycle coverage was added. Its first regression fixture was
  overwritten by Playwright's own `trace.zip`; separate actual/synthetic trace
  names fixed the test setup. Final privacy/isolation gate: 10/10 in two files.
- Unrelated lockfile `libc` metadata removals from package installation were restored;
  existing package records/versions remain unchanged, frozen install passes.
- **First detached browser run: 35 passed / 1 failed (H at 430px).** It overlapped
  the full suite. Browser log at **14:02:32 UTC** records Vite reloading
  `packages/recipes/src/vietnamese-bank.ts`; retained trace confirms a new document
  lost the marker. `tests/unit/generate-migration.test.ts` unconditionally writes
  that source. Content and final Git status were unchanged. After all source-writing
  checks ended, the **entire unchanged browser suite passed 36/36 serially**.
  No retry setting, timeout, test assertion, or frozen file was modified.
- Final docs correct stale `CORRECTED` lifecycle, unconditional receipt-expiry,
  rejection-evidence and historical acceptance numbering claims.

## Evidence locations and authority

Private, gitignored run logs: `.hoplite/artifacts/t13b-*` in the primary worktree;
final detached logs copied to `.hoplite/artifacts/t13b-detached-certification/`.
The detached worktree retains `.hoplite/artifacts/certification/`, including the
first browser failure and final serial result, plus sanitized screenshots/traces.
These are local retained evidence, not public artifact links or hosted CI results.

0031 Git blob: `c580d30b589ace1102cdfda7e61bfbacc57c4253` (unchanged).
Fresh audit commands are recorded in [AUTHORITY_MAP.md](AUTHORITY_MAP.md).
T09 remains adopted mutation authority; T11 remains adopted read authority.
Meal-planner `SAFE_DEFERRED` / `MEAL_PLANNER_AUTHORITY_CUTOVER` stays unchanged;
the production enable flag remains unbound. Preview enabling is synthetic only.

Exact-freeze hosted status query returned **zero contexts** (aggregate `pending`
means no reported contexts, not a running successful gate); the filtered completed
push-workflow query returned zero runs. The CI workflow does not trigger for this
continuation branch's pushes. **NO HOSTED GITHUB CI STATUS FOR T13B_APPLICATION_FREEZE**.

## Stop boundary

No main merge, staging/production deployment, remote D1 access, PayOS change,
T14 work, or Frigo ↔ Frigo-dev reconciliation. Next action is exclusively
**INDEPENDENT T13 FINAL REVIEW** of the exact freeze and docs-only publication.
