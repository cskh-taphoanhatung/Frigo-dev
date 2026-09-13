# T13B-B — quota-safe WIP handoff

## Authoritative continuation checkpoint — 2026-09-13

**T13 NOT COMPLETE.** The owner authorized continuation from the recovered WIP;
the historical stop/identity statements below are superseded by this section.
Implementation hardening is saved and published, but mandatory running-app browser
verification is blocked by the managed Preview tool interface. This is a WIP
checkpoint, **not** `T13B_APPLICATION_FREEZE` or `T13B_DOCS_HEAD`.

### Verified identity, exact start and publication

- Canonical repository: **vn-ca1/Frigo-dev**, repository ID **1368281478**.
  Historical **Tungjpstore/Frigo-dev** redirects to the same numeric GitHub repository.
  Both public repository metadata responses were checked in this continuation.
  Older recovered references to ID 1364064929 are historical, not current identity.
- Starting WIP: `2334a6f41cf68d42ae1eba7a30440b8fe324eb31`.
- Trusted fetch verified `main` = `d1b06732f8a80db4e77986df31ff28d9f04641fa`;
  both `rescue/t13b-b-wip` and
  `hoplite/megara-hyblaia-888f1514--t13b-b-ux-final-hardening--quota-wip`
  = the exact starting WIP.
- `git merge-base --is-ancestor c31567ec7dfa8f95808c20c834b327cbb3425f9c 2334a6f41cf68d42ae1eba7a30440b8fe324eb31`
  exited 0. The new branch was created directly at that WIP; `git rev-parse HEAD`
  matched it before the first edit. No reset/rebase/cherry-pick or main merge.
- Continuation branch: `hoplite/kos-9d39545d--t13b-b-final-hardening`.
- **T13B_HARDENING_WIP=c37a9b8d7afc66507052bbc8f1e8a24fdc896e8d**.
  Published without force, then fetched; local/remote equality and unchanged main
  were verified. A separate documentation-only WIP checkpoint follows this commit.

### Actual changes and review

- `ScanResultPage.tsx`: route ID is authoritative; keyed review lifetime and
  matching-store rendering prevent A's items appearing/submitting on B. Hydration
  also rejects a mismatched response scan ID. No unrelated global reset is used.
- Polling checks captured private-session generation/scope and cancellation before
  requests and every result-derived state mutation; it clears recursive timers.
  Confirmation/refetch completion is additionally fenced by mount and scan identity.
- Confirmation uses `ApiError.code` and `presentDomainError`. Recoverable conflicts
  refetch authoritative scan evidence and invalidate inventory reads, replacing
  stale edits without retrying stock writes. Failed refresh blocks confirmation
  until explicit reload. Generic 500/non-refetch domain errors preserve edits and
  never show backend JSON/private text.
- Independent review found another P2 truthfulness defect: a confirmed scan could
  reopen editing after A -> unresolved B -> A because the store dropped its status.
  `useScanStore.ts` now retains optional server `reviewStatus`; terminal confirmed
  reviews remain read-only across remounts and private reset clears that status.
  Existing two-argument producers retain unknown status, preserving pending scans.
- `tests/unit/t13b-fridge-hardening.test.tsx`: **23** cases cover route ownership,
  A/B/A and late responses, generation/account switch/unmount, direct page-level
  service responses (independent of the HTTP layer's own guard), confirmation races,
  conflict/idempotency messages/refetch, failed refresh recovery, generic 500,
  UNIT_MISMATCH, no secret text, no implicit POST retry, and terminal review status.
- No backend, receipt editor, adoption implementation, migration, payment, unrelated
  auth, Week, or production infrastructure change was made in this continuation.

### Executed checks (pre-freeze WIP, not final certification)

Node **v24.19.0**, pnpm **10.26.0**. Initial `pnpm typecheck` could not execute:
`tsc: not found` / absent node_modules. `pnpm install --frozen-lockfile` succeeded,
then whole-project typecheck passed **before implementation**; lockfile unchanged.

Final current-code checks:

```sh
pnpm typecheck
pnpm exec vitest run tests/unit/t13b-* tests/integration/t13b-* \
  tests/integration/inventory-adoption-operator.test.ts \
  tests/unit/scan-privacy.test.tsx tests/unit/client-session.test.ts
pnpm exec eslint src/web/pages/ScanResultPage.tsx src/web/stores/useScanStore.ts \
  tests/unit/t13b-fridge-hardening.test.tsx
git diff --check
node --check scripts/inventory-adopt.mjs
```

**PASS: 173/173 tests, 9/9 files** (132 T13B/operator tests plus 41 existing privacy/
session tests), final typecheck, scoped lint, diff check and operator syntax check.
The operator suite is **26/26**, spawning the actual documented executable against
authenticated Hono/SQLite: `/me`, exact-household adoption, preserved stock, replay,
response loss, terminal evidence, session/tenancy/CSRF fences and secret-safe failures.

The **exact 17-file focused backend command** in `T13B_A_HANDOFF.md` under Executed
verification was rerun with `--maxWorkers=2 --minWorkers=1`: **1,122/1,122 PASS**.
This preserves separate receipt purchases, exact purchase facts, SCAN CORRECT,
fingerprinted raw evidence, production `correctionOf()`, OCR-backed T10 rawName,
atomicity, concurrent exactly-once confirmation and response-loss replay.

Red/green proof: copied only the new regression test into a separate detached
diagnostic worktree at the original WIP and ran:

```sh
pnpm exec vitest run tests/unit/t13b-fridge-hardening.test.tsx \
  -t 'treats the route|fences a pending response|fences a direct api.getScan ready DTO|reloads the authoritative scan'
```

Expected baseline result: **5 failed / 18 skipped**, including stale A rendering,
post-reset scan-store repopulation, stale polling recursion and both missing conflict
refetches. All 23 tests pass on the continuation. This diagnostic is not the required
clean detached final verification.

Intermediate verification issues, corrected rather than hidden:
- An initially nested diagnostic worktree was also discovered by Vitest, producing
  a duplicated 320-test run. It was moved outside the repository before the final
  173-test run; the 320 total is **not** certification evidence.
- A new direct-service test initially resolved an HTTP envelope instead of the
  unwrapped service DTO, producing two TS2345 errors. Corrected to `.scan`; final
  typecheck and all 173 focused tests were rerun successfully.
- Earlier focused 70/120/173 runs overlap the final totals and must not be added.

### Migration, authority and documentation-lineage evidence

**31 migrations**, no 0032. Migration diffs from both `c31567e` and restored WIP
are empty. 0031 Git blob remains `c580d30b589ace1102cdfda7e61bfbacc57c4253`;
SHA-256 = `fae72602ac7f3128155329a8abc60184609dd589e264cfec9bae1e3c961bc206`.
Persisted lifecycle is **PENDING / CONFIRMED / REJECTED**. A corrected line is
CONFIRMED with differing raw/confirmed values, never a persisted CORRECTED state.

Independent current-source enumeration found **UNKNOWN inventory writers = 0** and
**UNKNOWN canonical inventory readers = 0**: T09 remains mutation authority, T11
adopted read authority; controlled adoption/bootstrap and fenced legacy paths remain
classified. The meal-planner projection reader remains the documented SAFE_DEFERRED
boundary. No second inventory ledger or authority/cutover flag change.

Historical `69b0dc676fcb4136861a8ca0c66994259eba5116` was fetched read-only and is
**not** an ancestor of WIP (merge-base exit 1). Its five documentation files were
carried forward: DECISIONS and T13B_A_HANDOFF are byte-identical in WIP, while every
line of its CURRENT_STATE/TASK_BOARD/HANDOFF remains in order beneath subsequent
additions. No history rewrite is necessary or permitted.

### Preview blocker and exact next action

The pre-existing, uncommitted `.hoplite/settings.json` overlay replaces the checked-in
run script with `pnpm dev` and removes setup. It remains untouched/uncommitted.
After inspecting effective settings, the project **run override** was set to the
already-versioned `node scripts/security-preview.mjs`; no application/setup script
was redesigned. Locked dependencies were installed as above.

Managed startup remains blocked: the tool schema requires `promote {name,port}`
even for first startup, while the worker rejects promotion unless an owned managed
HTTP listener has already been discovered. Error:
`Preview port must be a currently discovered HTTP listener owned by the managed preview run`.
Reported to the platform; an independent agent confirmed the same interface blocker.
No successful app startup, browser check, screenshot, mobile-width check or reseed
is claimed. No shell server was substituted for managed Preview.

Next: repair the platform's optional-promotion invocation, start the existing isolated
preview, reset/login/seed through `/__preview`, then verify all eight owner flows and
360/390/430 widths. Preserve the actual operator-path proof above. Complete the
**original** AC1–AC14 from `docs/ai/release/T13_PROPOSED_SCOPE.md` (not the historical
renumbered matrix); close R3/R4/R5/R6/R7/R8/R11 and U1/U4/U6/U7/U8/U12/U13/U14 with
actual final evidence. The primary matrix and final six T13 documents deliberately
remain pending the owner's freeze/verification gate, not silently declared DONE.

Only then create an application freeze and perform all clean detached gates:
frozen install, T08–T13 focused suites, full suite (floor 3177/124), real local D1
(floor 92/92), full lint/typecheck/build, fresh/legacy migration replays, local schema
gate, diff check, empty status. No final suite, final real D1, migration replay/schema
gate, build, full lint, freeze or final docs HEAD was executed/declared in this turn.
Hosted CI has **not been evaluated for an application freeze**, since none exists;
recovery Actions are not certification. Commit/push final docs separately only after
those gates, verify docs-only delta/ancestry and remote equality, then request the
independent T13 final review. No merge, deployment, remote D1 or PayOS access.

## Historical recovery checkpoint (superseded by the continuation above)

Stopped on the owner's explicit instruction at 2026-09-13 09:58 UTC. No further
implementation, new test runs, application freeze, merge or deployment is authorized
by this checkpoint. It is not final acceptance or certification.

## Identity, lineage and publication blocker

**Publication recovery:** after the initial 404/fetch failures below, the trusted
Git broker successfully published application-bearing WIP commit
`a8cefd13505bc6b45dd11f45a6323539deb60f93` to the original successor branch without
force. A subsequent fetch verified exact local/remote equality and unchanged main
`d1b06732f8a80db4e77986df31ff28d9f04641fa`.
The unauthenticated numeric metadata endpoint still returns 404, so the numeric
identity/owner attribution remains the previously verified value, not a fresh public
metadata confirmation. This documentation-only follow-up records that recovery;
its final published SHA/equality is in the safe-stop report.

Appending documentation-only commit `fd7e0204a81b74d9c8e3e630353451e2bf3056c5`
then hit a platform lease mismatch twice, even after a fresh fetch returned exactly
the supplied expected head `a8cefd13505bc6b45dd11f45a6323539deb60f93`. Reported to
the platform; no force or history rewrite was attempted. Following the owner's
fallback instruction, the final checkpoint branch is
`hoplite/megara-hyblaia-888f1514--t13b-b-ux-final-hardening--quota-wip`, created
directly from that saved state. Application/test content remains identical to the
first published WIP; only safe-stop documentation follows it.

- Repository ID **1364064929**, owner/name **vn-2l/frigo-dev**, were verified using
  GitHub metadata at the start of Part B. Fresh safe-stop verification is blocked:
  the numeric repository endpoint, both historical owner/name endpoints and the
  authorized provider commit endpoint now return **404**. Do not infer a new owner.
- Interrupted branch: `hoplite/megara-hyblaia-888f1514--t13b-b-ux-final-hardening`.
- Pre-checkpoint HEAD / actual branch base:
  `c31567ec7dfa8f95808c20c834b327cbb3425f9c` (T13B-A application checkpoint).
- Owner's safe-stop expected base: `69b0dc676fcb4136861a8ca0c66994259eba5116`.
  **Lineage discrepancy:** Part B was started at the application checkpoint under
  the earlier exact-checkpoint instruction; the five documentation files from
  `69b0dc6` were then carried forward. That documentation commit is not an ancestor
  of this branch. No reset/rebase or history repair was attempted during safe stop.
- Last locally recorded `origin/main`:
  `d1b06732f8a80db4e77986df31ff28d9f04641fa`. Fresh trusted fetch now fails with
  `Repository not found`; this is not a current remote-main verification.
- Commit message: `wip(t13b): checkpoint interrupted ux final hardening`.
  The checkpoint SHA is the commit containing this file; obtain it with
  `git log -1 --format=%H -- docs/ai/inventory-truth/t13/T13B_B_WIP_HANDOFF.md`.
- If the original branch cannot be published, the requested non-force fallback is
  `hoplite/megara-hyblaia-888f1514--t13b-b-ux-final-hardening--quota-wip`, pointing
  at the same WIP commit. A different branch does not repair repository access.
  Publication/fetch equality is **not verified** at checkpoint creation. The final
  safe-stop report records the actual publication outcome; do not assume it passed.

## Changed files

Application:
- `src/web/pages/ReceiptReviewPage.tsx`
- `src/web/pages/ScanResultPage.tsx`
- `src/web/pages/IngredientDetailPage.tsx`
- `src/web/stores/useScanStore.ts`
- `src/worker/routes/inventory.ts`

Operator/isolated preview:
- `scripts/inventory-adopt.mjs` (new)
- `scripts/t13-preview-fixtures.mjs` (new)
- `scripts/planner-preview-fixtures.mjs`

Tests (new):
- `tests/unit/t13b-receipt-review.test.tsx`
- `tests/unit/t13b-fridge-review.test.tsx`
- `tests/unit/t13b-inventory-detail.test.tsx`
- `tests/integration/inventory-adoption-operator.test.ts`
- `tests/integration/t13b-review-roundtrip.test.tsx`
- `tests/integration/t13b-preview-fixtures.test.mjs`

Documentation: `docs/ai/{CURRENT_STATE,TASK_BOARD,HANDOFF}.md`,
`docs/ai/inventory-truth/DECISIONS.md`, and
`docs/ai/inventory-truth/t13/{T13B_A_HANDOFF,T13B_B_WIP_HANDOFF}.md`.
Part A's handoff/DEC-016 were carried forward, not redesigned.

At interruption, `git status --short` contained 10 modified tracked files and
9 untracked legitimate files; `git diff --stat` reported 505 insertions and
198 deletions across those 10 tracked files. This WIP handoff and safe-stop notices
are additional documentation changes. Settings, dependencies, DBs, logs, screenshots,
temporary files and credentials are excluded from the checkpoint.

## Completed implementation, not final acceptance

- Receipt and fridge review: name, fractional quantity, StandardUnit, storage and
  expiry edits; explicit dates versus estimates; durable persisted rejection.
  Fridge manual drafts can be removed locally; retained AI lines cannot.
- Confidence presents absent/zero/0.11/0.9 truthfully. Raw OCR is server evidence,
  not a client snapshot; missing price/date are not invented.
- Explicit single-household adoption CLI: authenticated identity/household fencing,
  certified route, explicit `--apply`, bounded input, secret-safe errors and replay.
  No fake dry-run: the route has no adoption-planning endpoint; `--help` explains it.
- Isolated, idempotent preview evidence fixtures use same-origin controls and do
  not write inventory. No external providers or production database are used.
- Two browser-discovered gaps corrected: canonical inventory-list DTO no longer
  collapses RECEIPT into scan; UNKNOWN/ESTIMATED detail badges no longer claim fresh.
  No receipt-lot mutation semantics or migrations were redesigned.

## Executed checks and partial verification

The pre-stop combined run completed successfully (not launched after safe stop):

```sh
pnpm exec vitest run tests/unit/t13b-* tests/integration/t13b-* tests/integration/inventory-adoption-operator.test.ts
```

**109/109 tests, 6/6 files PASS**: receipt 40, fridge 29, detail 10, operator 26,
real React-DOM → authenticated Hono/SQLite scan handlers 2, preview fixtures 2.
This is focused local verification, not the full suite or hosted CI.

Earlier focused results (overlap; do not add the totals):
- Receipt + scan privacy + existing inventory UX: 62/62, 3 files PASS.
- Fridge + client-session: 62/62, 2 files PASS.
- Operator + existing adoption: 45/45, 2 files PASS.
- Real-handler round trips: 2/2 PASS, including list/confirm/replay provenance.
- Scoped ESLint passed for receipt, fridge/store, operator and round-trip files;
  operator `node --check` passed. No final whole-tree lint/typecheck/build occurred.

Browser verification used the actual isolated app and synthetic registered cookie
sessions. Receipt edits/reject and retained OCR were exercised; old tomato lot
remained 3 pieces while a new receipt lot held 2. Fridge edits/reject/manual-remove,
SCAN lot truth, explicit expiry, and real stale-version conflict/refetch/retry were
exercised. UNKNOWN → KNOWN plus storage MOVE succeeded after a genuine concurrent
quantity edit. The executable adoption CLI adopted and replayed with stock preserved.
Receipt and fridge screenshots at actual 360/390/430 widths were visually inspected.
Viewport changes had to be batched with capture; generic browser date fill left an
empty field, so native date input/change events were used and resulting values checked.

Browser verification remains **partial**: the preview worker predates the inventory
DTO source-label fix and needs a restart/reseed and repeat of the affected receipt
flow. No final frozen-checkout browser run, final browser-error audit, checklist or
published proof package was completed. Screenshots/logs are ignored local artifacts.

## Failures, pending review and not started

- Initial API/fetch access failed (404 / `Repository not found`); broker publication
  and fetch subsequently succeeded as recorded above. Fresh public numeric metadata
  remains unavailable. Do not confuse metadata visibility with Git publication.
- Earlier typecheck failed with two TS7016 errors importing MJS preview fixtures
  from a TS test. That test was converted to MJS, matching existing preview tests,
  and the 109-test run passed; **whole-project typecheck has not been rerun**.
- Managed Preview startup was blocked by its mandatory promotion argument and stale
  effective settings; reported to the platform. The repository's existing isolated
  preview harness was used directly. `.hoplite/settings.json` was not modified.
- Pre-freeze independent code review was interrupted; its final findings were not
  retrieved. Investigate the open lead that retained scan-store items may be shown
  for a different route scan ID. Do not treat this unverified lead as resolved.
- No final original AC1–AC14 restoration, roadmap-gap closure matrix, final writer/
  reader audit, full suite, final real-D1 run, migration smoke/schema gate, clean
  detached verification, application freeze, docs-head freeze or hosted-CI check.
- Existing historical T13 docs still need reconciliation, including the incorrect
  `CORRECTED` lifecycle label. Actual 0031 values are PENDING/CONFIRMED/REJECTED.
- Existing Part A results (1,122 focused / 92 real D1) are historical evidence,
  not a fresh Part B final verification.

Migration status: **31**, no 0032; diff from the application checkpoint is empty.
0031 blob remains `c580d30b589ace1102cdfda7e61bfbacc57c4253`.
No main merge, deployment, remote D1 access, PayOS change or settings commit.

## Exact next step

Wait for explicit resumption authorization. Then reverify numeric repository identity
and current owner/name through an authorized metadata path, guarded main and the
published WIP SHA. Resolve the documented base discrepancy with the owner without
reset/rebase or discarding WIP. Only after explicit resumption authorization:
finish pending review, restart/reseed the isolated preview and rerun affected browser
flows, then complete original AC/roadmap audits and clean detached final gates. Do
not declare an application freeze from this quota-stop commit.
