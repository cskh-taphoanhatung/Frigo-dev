# T13 independent final review — FAIL

Date: 2026-09-13. This is a read-only application audit, not a remediation or
deployment. The frozen application is **not accepted** for leaving T13.
The existing certification gates reproduce successfully, but independent
counterexamples establish **4 P1 and 6 release-blocking P2 findings**.

## Identity and tree preservation

| Field | Independently verified result |
|---|---|
| Requested repository | `vn-ca1/Frigo-dev` |
| Current provider name | `vn-co2/Frigo-dev`; same authoritative numeric repository ID |
| Repository ID | `1368281478` |
| Protected main | `d1b06732f8a80db4e77986df31ff28d9f04641fa` |
| Application freeze | `7b7bb695ee597a46cf4022a2c534e2fea374be5d` |
| Docs head | `4fcbc96b5a5d4b3cea2c2ad0bdb5682b1866891a` |
| Certified remote branch | `hoplite/mende-26679a14--browser-harness-final-cert` |
| Branch head verified | YES; exact docs head, checked before and after the audit |
| U7 commit ancestor of freeze | YES: `47b10e25d6853a9bc4f9dfcf2e83bc01ba330bf2` |
| Freeze ancestor of docs | YES |
| Freeze → docs non-doc diff | EMPTY |
| Detached freeze status after checks | EMPTY |
| Review branch | `hoplite/oropos-eb2d4886`, starting at the exact docs head |

Public repository metadata confirmed the numeric ID; trusted Git operations
confirmed both remote refs. The rename is not an identity failure. The strict
comparison `git diff <freeze> <docs> -- . ':(exclude)docs'` is empty; all 12
changed paths are documentation. Application, permanent tests, migrations and
the repository browser harness were not edited. A pre-existing primary-worktree
`.hoplite/settings.json` modification was preserved and excluded from this review.

## Findings

Source line references below refer to the exact application freeze, not a later
working copy. Audit-only probes and raw logs live outside the detached source
tree under `.hoplite/artifacts/t13-independent/`; they are not new release tests.
Their successful assertions demonstrate counterexamples, not product acceptance.

### P0: 0

No P0 finding was established. This is not a claim of exhaustive security proof.

### P1: 4

#### P1-1 — The configured async scan path omits T13 raw evidence

- `wrangler.jsonc:61-64` selects production `SCAN_QUEUE_MODE: "async"`.
- Both production queue INSERTs omit every `ocr_*` column added by 0031:
  `src/worker/services/scan-queue.ts:227-244,270-284`.
- `scanItemDto()` and confirmation provenance read those omitted columns:
  `src/worker/routes/scans.ts:443-468,1074-1076,1259-1262`.
- A valid queued fridge scan and a valid queued receipt scan both reached
  `ready`, with raw name present in the mutable legacy column but
  `ocr_raw_name`, `ocr_quantity`, `ocr_unit`, and `ocr_confidence` all NULL.
  Confirmation can then overwrite the only original values.
- A receipt without confidence failed persistence instead of remaining a valid
  unknown-confidence receipt: `AI_SCAN_FAILED`, SQLite bind parameter 7,
  retryable, scan returned to `pending`, zero items. The queue directly binds
  optional confidence into the legacy required column.

Evidence: `backend-probes.log`, using the real frozen queue, real Cloudflare
adapter with synthetic extraction responses, all-migration local SQLite, and
external `fetch` disabled. This is not remote D1. The normal browser harness uses
`SCAN_QUEUE_MODE: 'sync'` and pre-seeded scan rows, so its green matrix cannot
certify this configured production ingestion path. Blocks AC4/AC6 and R5/R8.

#### P1-2 — An ordinary U7 name edit clears canonical ingredient identity

`src/worker/routes/inventory.ts:784-849` re-resolves the edited display name and
sets `ingredientId` to NULL when no alias matches. The T09 adapter passes this
as a correction (`:207-234`). This violates the required preservation of canonical
identity during metadata editing.

Fresh real-browser reproduction, using the same label as the committed U7 test:

```text
PATCH /api/v1/inventory/preview-stock-chicken
{"name":"Thịt gà đã kiểm tra","version":1}
HTTP 200
ingredientId: CHICKEN_BREAST → null
quantityMilli: 300000 → 300000
```

Evidence: `final-counterexamples.log`, `AUDIT_CANONICAL_IDENTITY`.
The permanent browser test asserts quantity/unit/source preservation but omits
`ingredientId` (`tests/e2e/t13b-metadata.e2e.ts:41-46`). U7 is not complete.

#### P1-3 — A U7 draft can save into a different lot after a route change

`IngredientDetailPage.tsx:38-43,65-69,123-131,214-227` retains `editing`, `draft`,
and `editBaseline` across a same-component route-ID change, but submit uses the
newly displayed `item.id` and version. There is no lot-owner binding on the draft.

Fresh reproduction: open chicken, edit its name to a chicken-only draft, use a
same-document `/ingredients/chicken` → `/ingredients/tofu` navigation, then save.
The page displayed tofu with the chicken draft; PATCH targeted tofu and returned
200. Chicken remained unchanged; tofu acquired the chicken-only name. The probe
uses the same browser-history navigation helper as the repository ownership
tests, not a store or DOM patch. It does not claim a cross-household auth bypass.

Evidence: `lot-draft-probes-attempt1.log`, `AUDIT_WRONG_LOT`, and the retained
`wrong-lot-owner-crop.png` screenshot. `App.tsx:119-143` keys private scope, not
individual lot routes. Blocks U7 and safe completion of the shared MOVE UI.

#### P1-4 — Receipt review trusts a mismatched response ID for confirmation

`ReceiptReviewPage.tsx:110-113` accepts a scan DTO without requiring its ID to
equal the route's `scanId`. Submit targets `liveReceipt.id` (`:158`), and the
conflict refresh has the same missing comparison (`:176`).

The adversarial browser probe supplied an actual same-household B DTO as the
response to route A's GET. A rendered B's receipt and confirmed B with HTTP 200;
A remained ready. This is a controlled mismatched-response test of the explicitly
required ownership invariant, not evidence that the current backend naturally
returns another household's data. The equivalent `ScanResultPage` guard exists.

Evidence: `final-counterexamples.log`, `AUDIT_RECEIPT_ROUTE`. Existing browser
ownership tests exercise the fridge route, not this receipt mismatch.

### Release-blocking P2: 6

#### P2-1 — Cloudflare fridge vision fabricates confidence

`packages/ai/src/providers/cloudflare.ts:149-159` still applies
`Math.min(1, Math.max(0.5, Number(item.confidence) || 0.9))` in `vision()`.
Fresh execution of that adapter produced:

| Supplied confidence | Actual output | Required presentation basis |
|---|---:|---|
| undefined | 0.9 | unknown |
| null | 0.9 | unknown |
| 0 | 0.9 | 0% |
| 0.11 | 0.5 | 11% |
| 0.9 | 0.9 | 90% |

Evidence: `backend-probes.log`, `AUDIT_CONFIDENCE_FABRICATION`.
The fixed receipt parser and correctly implemented UI confidence presenter do
not fix the fridge parser. Existing no-fabrication provider tests cover
`receiptScan()`, not `vision()`. Blocks confidence truth and R5.

#### P2-2 — Raw storage/category/mapping evidence is not retained

Even the synchronous path retains only a subset of extracted fields. 0031 adds
raw name/quantity/unit/confidence, while confirmation overwrites current
canonical mapping/category/storage. `RawScanEvidence` and `correctionOf()` cover
only name/quantity/unit (`src/worker/utils/scan-evidence.ts:140-175`). Original
storage/category cannot be retrieved alongside a correction; a storage-only
correction is not represented by that raw→confirmed comparison.

Evidence: `migrations/0031_scan_evidence_retention.sql:5-10,26-42`,
`src/worker/routes/scans.ts:1302-1318`, and the DTO at `:443-469`.
The current tests assert the narrower name/quantity/unit subset. AC6 and R8
require raw extracted values, not an undocumented subset.

#### P2-3 — A confirmed explicit expiry disappears from the review after remount

The persistent review update and `scanItemDto()` omit reviewed expiry fields
(`src/worker/routes/scans.ts:443-469,1302-1318`). The fridge component then renders
an absent value as unknown (`ScanResultPage.tsx:301-308`).

Fresh real-browser reproduction: submit `2030-12-31`, observe a canonical lot
with `expiryKind: KNOWN` and that date, then revisit the confirmed scan in a new
document. The disabled date field is empty and says `Chưa rõ hạn dùng`.

Evidence: `final-counterexamples.log`, `AUDIT_CONFIRMED_EXPIRY`, and retained
`confirmed-expiry-lost.png`. The stock date is retained; the confirmed review
misrepresents what was accepted. Blocks confirmed-review truth and U12 closure.

#### P2-4 — Inventory conflicts still receive generic, stale-state recovery

`InventoryPage.tsx:41-64` discards `ApiError.code` on quantity/delete/add failures
and does not refetch on conflict. A real competing update changed eggs from 2 to
7; the UI's stale increment received 409 `CONFLICT`, displayed generic retry
copy, made zero authoritative inventory refetches, and still displayed 2.

Evidence: `surface-counterexamples.log`, `AUDIT_INVENTORY_CONFLICT`.
In addition, detail/reconciliation call `refetch()` without checking the result
or requesting `throwOnError`; installed React Query catches fetch errors by
default (`queryObserver.ts:364-366`). A failed refresh therefore cannot justify
the detail message claiming the latest state was loaded. This latter condition
is source-verified, not separately browser-reproduced. Blocks AC10/AC12 and the
understandable authority-error portion of U13.

#### P2-5 — Home displays an estimated expiry without an estimate qualifier

`HomePage.tsx:84-88,310-333` consumes T11 inventory but ignores `expiryKind`,
rendering an unqualified countdown. Fresh real-browser/API evidence showed:

```text
expiryKind: ESTIMATED; expiryAt: null
estimatedExpiryAt: 2026-09-15
Home card: "Ức gà / ⏳ 2 ngày" (no estimate label)
```

Evidence: `home-estimate-probe.log`, `AUDIT_HOME_ESTIMATE`. The probe supplied
only the synthetic `frigo_onboarded` prerequisite; its inventory came from the
real authenticated API, not patched frontend data. Blocks expiry-display
consistency and U12.

#### P2-6 — Unknown opening state is displayed as definitely unopened

`IngredientDetailPage.tsx:195` renders NULL `openedAt` as `Chưa mở` (unopened).
The domain contract explicitly says missing opening evidence does not prove
sealed (`docs/ai/DOMAIN_MODEL.md:183-185`). The detail should
not manufacture that fact.

Evidence: the real lot API returned `openedAt: null`; the rendered page said
`Chưa mở` (`lot-draft-probes-attempt1.log`, `AUDIT_UNKNOWN_OPENING`, screenshot).
Blocks faithful detail presentation under AC9/U4; it does not itself alter stock
quantity or extend an expiry date.

### P3: 3 non-blocking groups

1. **Non-hermetic test:** `tests/unit/generate-migration.test.ts:31,135` writes
   tracked source/migration files. Its source rewrite can reload Vite even when
   the bytes are identical. Browser-last is an operational warning, not a lock.
2. **Stale gate wording:** schema-gate output says through 0030 while its SQL
   requires 0031; the migration replay test title says 30 while asserting 31.
3. **Harness limits:** synthetic controls are same-origin/CSRF checked but not
   a capability-authenticated control plane; external-network restrictions and
   credential sanitization are scoped to the test context/known fields and the
   normal reporter lifecycle, not a universal sandbox firewall or secret
   detector. No production fixture exposure or actual credential leak was found.

## Previous defects

| Required assessment | Result |
|---|---|
| P1-A route/store | PASS for the original fridge `ScanResultPage` defect; distinct receipt mismatch remains P1-4 |
| P1-B private-session | PASS for audited request/session generation fencing and reset behavior |
| P2 domain errors | FAIL — P2-4 |
| Confirmed review | FAIL — controls/navigation are read-only, but accepted expiry becomes false unknown after remount |
| U7 metadata | FAIL — P1-2/P1-3; normal compatible-unit and dirty-field behavior alone is insufficient |

The shared HTTP layer rechecks private generation/user/household after transport
and body parsing; private reset clears scan/query state, and app route keys
remount across user/household changes. Fresh permanent session/ownership tests
passed. No stale-response cross-session data exposure was reproduced.

## Truth and authority

| Assessment | Result |
|---|---|
| Receipt truth | FAIL overall; receipt source, distinct purchase lots and nullable purchase facts themselves PASS |
| Fridge truth | FAIL overall; SCAN provenance/no invented purchase facts themselves PASS |
| Raw → confirmed provenance | FAIL |
| Expiry truth | FAIL in review/display; persisted supplied/inferred/absent kind mapping PASS |
| Confidence truth | FAIL |
| T09 stock mutation authority | Preserved |
| T10 evidence/decision boundary | Preserved; observations and T09 effects share the atomic batch |
| T11 canonical read authority | Preserved |
| UNKNOWN stock writers | 0 |
| UNKNOWN canonical readers | 0 |

Independent enumeration included SQL writers and authority-composer callers,
not just the authority-map's claimed totals:

- **T09 canonical writer:** `packages/db/src/inventory-lot-commands.ts`.
  Inventory, recipe consume, scan confirm and Week routes use sanctioned adapters
  or the fenced legacy branch; their inline inventory SQL was enumerated.
- **Explicit adoption/snapshot:** `inventory-adoption-executor.ts` performs
  authorized adoption; `inventory-truth.ts` is insert-only T08 backfill and
  rejects adopted households. No normal read invokes adoption/backfill.
- **Guards, not successful second stock effects:** event SQL in
  `inventory-writer-fence.ts`, `inventory-reconciliation.ts`, and adoption guards
  deliberately abort stale batches. Reconciliation composes T09 effects.
- **Legacy SQL catalog:** `packages/db/src/queries.ts` constants are used by the
  known legacy adapters or unused; no unclassified live caller was found.
- **Test-only SQL:** `planner-preview-fixtures.mjs`, `t13-preview-fixtures.mjs`,
  and `t07-query-plans.mjs` are isolated fixtures/analysis, not production routes.
- **Readers:** inventory/recipes/scans/Week use `fetchHouseholdInventoryFromDb`
  → T11 for adopted households. Notifications directly call T11 in native mode;
  their legacy projection query is separately fenced by authority mode. New lot
  detail/summary routes call T11. Command/adoption/T10 reads are internal
  validation/evidence reads, not alternate client truth.
- **Known SAFE_DEFERRED reader:** `meal-planning-snapshot.ts` is the documented
  feature-gated projection boundary, not an unknown T13 reader. The gate is
  installed in `src/worker/routes/meal-planning.ts:54-63`.

This architectural pass does not excuse wrong intent/identity supplied to the
sanctioned command path, nor incomplete scan evidence before that path.

## Browser harness and evidence

| Field | Result |
|---|---|
| Isolation | PASS — synthetic in-memory SQLite |
| Production bindings absent | YES |
| Remote D1 absent | YES |
| External network protection | PASS for certification Playwright context; P3 limits above |
| Fixture production exposure | NONE found; permanent real-worker 404 checks passed |
| Artifact privacy | PASS for inspected synthetic artifacts and tested lifecycle |
| Browser evidence quality | FAIL as complete release-certification coverage; genuine execution/counts are trustworthy |
| Historical pre-freeze browser 36/36 | NOT VERIFIED from original raw artifacts |
| Detached browser 36/36 | VERIFIED by a fresh exact-freeze run |
| 360 | PASS — all 12 existing cases |
| 390 | PASS — all 12 existing cases; additional counterexamples reproduced here |
| 430 | PASS — all 12 existing cases |

Fresh discovery reports **36 tests in 5 files**: 12 cases × 3 projects, one
worker, zero retries, `forbidOnly`, no T13 skip/only markers. The suite uses real
Chromium, Vite application modules, the actual Worker and SQLite; fixture
controls arrange data/races rather than assert mocked UI behavior.

Fresh screenshots of receipt review (360), fridge review (390), metadata (430),
and detail (360) were inspected, plus the adverse lot-ownership screenshot.
The isolated image-network policy intentionally aborts external stock images.
Reporter-tooling tests passed. Two retained real failure traces were inspected
without printing credential values; no unredacted 64-hex token remained in the
inspected text entries. This is scoped privacy evidence, not proof that arbitrary
future sensitive images or secret formats would be sanitized.

### Earlier concurrent 35/36 failure

**BENIGN EXPLAINED mechanism; historical execution itself remains unverified.**
The source-writing test can trigger the stated Vite reload. Both rewritten
tracked blobs match the freeze after the full suite, and a clean, serial browser
run subsequently passed all 36 with no application/test/harness edit or retry.
This is evidence of a shared-worktree test collision, not observed production
nondeterminism. The original ignored 35/36 and pre-freeze logs were unavailable;
their exact timing/cause cannot be certified retrospectively. Fresh serial
evidence removes that missing-run blocker, but not the application findings.

## Certification checks

All commands below ran in the detached exact-freeze worktree. Full/source-writing
checks completed before the full browser matrix. Diagnostic probes were separate.

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm exec vitest run \
  tests/unit/t13b-fridge-review.test.tsx tests/unit/t13b-receipt-review.test.tsx \
  tests/unit/t13b-inventory-detail.test.tsx tests/integration/t13b-review-roundtrip.test.tsx \
  tests/unit/t13b-fridge-hardening.test.tsx tests/integration/t13b-preview-fixtures.test.mjs \
  tests/integration/t13b-browser-tooling.test.mjs tests/unit/client-session.test.ts \
  tests/unit/scan-privacy.test.tsx tests/integration/inventory-adoption-operator.test.ts
pnpm exec vitest run \
  tests/integration/inventory-lot-d1.test.mjs tests/integration/inventory-observation-d1.test.mjs \
  tests/integration/inventory-read-authority-d1.test.mjs tests/integration/inventory-closed-loop-d1.test.mjs \
  tests/integration/t13-receipt-vision-d1.test.mjs
pnpm check:migrations
CI=1 WRANGLER_SEND_METRICS=false pnpm exec wrangler d1 migrations apply frigo-db --local
CI=1 WRANGLER_SEND_METRICS=false pnpm schema:check:local
pnpm test:browser
pnpm exec vitest run tests/integration/inventory-truth.test.ts \
  -t 'replays all 30 migrations|upgrades a populated 0022 database'
git diff --check
git status --porcelain
```

The focused commands identify the exact executed file selections; file order is
not a test-discovery filter change. Logs retain runtime file counts and outcomes.

| Check | Fresh result |
|---|---|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS |
| `pnpm test` | 3372/3372; 132/132 files; PASS |
| Hardening/privacy/operator selection | 194/194; 10/10 files; PASS |
| Five real local D1 suites | 92/92; 5/5 files; PASS |
| `pnpm test:browser` | 36/36; 3.6 minutes; exit 0 |
| Migration smoke | PASS |
| Fresh `wrangler d1 migrations apply frigo-db --local` | All 31 applied |
| Populated-0022 upgrade + complete migration replay | 2/2 selected PASS; other 52 deliberately unselected and passed in full suite |
| `pnpm schema:check:local` | PASS |
| `git diff --check` | PASS |
| Post-check detached status | EMPTY |

Per-file counts in the fresh full-suite log independently reproduce these
overlapping selections (do not add them together): T08 **130/2**, T09 **1259/17**,
T10 **98/6**, T11 **39/2**, T12 **22/3**, T13/T13B **271/12**. The actual adoption
executable suite contributes **26** cases. Exact selection lists are retained in
`focused-selection-counts.json`.

The historical **3177/124** baseline is documentary, not a newly rerun historical
tree. Its growth reconciles: T13B-A added 42 cases (22 HTTP + 9 event + 11 D1),
and the eight new T13B files contribute 153 cases; **3177 + 42 + 153 = 3372** and
**124 + 8 = 132**. Default Vitest discovery still finds all 132 files. No frozen
filter, retry, assertion or source was changed to obtain these results.

### Audit-probe failures and limitations retained

- Initial version-refresh probe incorrectly used `expectedVersion`, receiving
  428. After correcting only that audit input to the actual `version` contract,
  its synthetic focus event did not cause a refetch and timed out. A silent
  pre-submit version rebase is therefore **NOT VERIFIED and not counted** as a
  release finding. Both attempts and traces are retained.
- The first Home probe reached Landing because the synthetic account lacked
  onboarding state. A repeat with only that fixture prerequisite supplied
  reproduced the unqualified estimated-expiry card. No application or release
  test was changed, and the initial failure log was retained.
- The queue probe uses the repository's SQLite D1-compatible helper, not remote
  D1; it is additional evidence distinct from the separately passing 92 real
  local workerd/D1 cases.
- Original historical pre-freeze/detached certification artifacts were not
  available. Their counters are not silently promoted to fresh observations.

## Migrations, dependencies and hosted CI

- **31 migrations; all 31 frozen file blobs equal their introducing-commit
  blobs.** 0001–0030 unchanged; 0031 unchanged; no 0032. 0031 blob:
  `c580d30b589ace1102cdfda7e61bfbacc57c4253`.
- Lifecycle remains `PENDING | CONFIRMED | REJECTED`; no persisted `CORRECTED`
  state. Replay and populated-0022 upgrade passed; no remote schema operation ran.
- Playwright and `fflate` are exact-pinned dev dependencies with a narrow,
  lock-consistent addition. No unrelated production dependency upgrade found.
- **NO HOSTED GITHUB CI STATUS FOR T13B_APPLICATION_FREEZE.** Fresh exact-SHA
  checks: zero check runs and zero legacy status contexts. GitHub's empty-context
  combined `pending` value is not a running successful/failed CI job. No main,
  old-release or other-branch CI was substituted. Current workflow branch filters
  explain the absence; it is not a failure by itself under the stated task.

## Original AC1–AC14

These are the original criteria in `T13_PROPOSED_SCOPE.md:107-135`, not a new
substitute acceptance list. PASS applies to the stated criterion, not the whole
feature. Findings outside a narrow AC can still block release or roadmap closure.

| AC | Result | Independent code/test/browser basis |
|---|---|---|
| AC1 | PASS | Server-owned RECEIPT/source ID and receipt DTO; HTTP/D1 tests and browser A/B |
| AC2 | PASS | Exact/NULL purchase facts; mapper, HTTP/D1 and receipt/browser missing-header cases |
| AC3 | PASS | Supplied/inferred/absent kind mapper; manual day-chip and real explicit-date correction |
| AC4 | FAIL | Correct receipt presenter/parser is bypassed by the broken async confidence persistence, P1-1 |
| AC5 | PASS | Both forms expose all five edits and explicit rejection; real roundtrip/browser A/C passed |
| AC6 | FAIL | Async raw evidence absent; raw field subset incomplete; P1-1/P2-2 |
| AC7 | PASS | Same-batch observations + T09; HTTP and real-D1 rollback evidence; no second stock writer |
| AC8 | PASS | Scoped lot/summary/observation/decision routes; HTTP/D1 foreign-household tests |
| AC9 | PARTIAL | Required facts/identity visible, but NULL opening evidence is misrepresented, P2-6 |
| AC10 | FAIL | T09 CORRECT/MOVE and ordinary conflict test pass; identity/route ownership and failed-refresh recovery remain broken |
| AC11 | PARTIAL | UNKNOWN vs fresh and initial correction work; confirmed expiry remount and estimate presentation fail |
| AC12 | FAIL | Inventory handlers ignore `ApiError.code`; real stale conflict keeps stale data, P2-4 |
| AC13 | PASS | Actual documented adoption CLI, 26 integration cases and browser I |
| AC14 | PASS | Fresh exact-freeze full/D1/lint/type/build/migration/schema/diff gates above |

## Required roadmap closure

Closure includes the task's ownership, truthfulness and remount invariants, not
just the existence of controls. Existing happy-path tests do not override a
counterexample. The original reconciliation table defines these rows.

| Row | Result | Implementation and independent evidence |
|---|---|---|
| R3 | DONE | Server RECEIPT provenance; HTTP/D1 and browser purchase-lot evidence |
| R4 | DONE | Exact/absent purchase facts; mapper/HTTP/D1 and missing-header browser case |
| R5 | NOT DONE | Async confidence loss and Cloudflare fridge fabrication, P1-1/P2-1 |
| R6 | DONE | No automatic KNOWN from missing/inferred expiry; mapper/manual/D1/browser kind checks |
| R7 | NOT DONE | Editable/reject lifecycle exists, but receipt owner and terminal accepted-expiry correctness fail |
| R8 | NOT DONE | Raw→confirmed evidence fails in async and is incomplete in sync, P1-1/P2-2 |
| R11 | DONE | Atomic T10 observation/T09 path; actual accept/dismiss browser proof and rollback tests |
| U1 | DONE | Additive scoped truth endpoints and independent tenancy gates |
| U4 | NOT DONE | Detail fields exist; unknown opening state is asserted as unopened, P2-6 |
| U6 | DONE | Unknown/day-chip estimate input semantics; mapper/UI/D1 evidence |
| U7 | NOT DONE | Canonical identity loss and cross-lot draft submission, P1-2/P1-3 |
| U8 | NOT DONE | MOVE adapter and normal browser path work, but the shared editor can target another lot, P1-3 |
| U12 | NOT DONE | Confirmed expiry disappears and estimated Home dates lack qualification, P2-3/P2-5 |
| U13 | NOT DONE | Operator adoption path passes; understandable authority/conflict recovery remains incomplete, P2-4 |
| U14 | DONE | Real observation accept/dismiss UI; canonical egg/tofu rereads and T10/T12 tests |

## Evidence ledger and safety

Retained under `.hoplite/artifacts/t13-independent/evidence/`:
`core-gates.log`, `focused-and-d1.log`, `browser-discovery.log`, `browser-gate.log`,
`migrations.log`, `local-schema-gate.log`, `legacy-replay.log`,
`backend-probes.log`, `lot-draft-probes-attempt1.log`,
`lot-draft-refresh-probe.log`, `final-counterexamples.log`,
`surface-counterexamples.log`, `home-estimate-probe.log`,
`focused-selection-counts.json`, `migration-integrity.json`,
`hosted-checks.json`, `failure-artifact-privacy.json`, screenshots and preserved
attempt artifacts. `SHA256SUMS.json` identifies the captured evidence snapshot.

Review-owned tracked changes are this report and the three required status/
handoff documents only. The detached application and original certification docs
remain unchanged. No PR, merge, deploy, remote D1, PayOS application change, T14,
or repository reconciliation was performed.

## Final verdict

**T13 INDEPENDENT FINAL REVIEW — FAIL**

Next action: **NEW T13 REMEDIATION BRANCH → fix confirmed blockers only → new
application freeze → repeat independent certification.** Preserve this freeze
and its failed-review evidence. Do not begin Frigo-dev ↔ production reconciliation,
merge, deploy, or T14 until the replacement candidate passes review.
