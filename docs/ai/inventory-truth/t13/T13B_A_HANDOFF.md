# T13B-A — Backend truth hardening handoff

Date: 2026-09-13. Scope: Part A only; this supersedes older T13 completion claims
for continuation planning, not the historical verification receipts.

## Identity and continuation checkpoint

- Repository ID: **1364064929** (verified using GitHub numeric repository metadata).
- Current owner/name: **vn-2l/frigo-dev**; `vn-2k/frigo-dev` redirects to that same ID.
- Branch: **hoplite/megara-hyblaia-888f1514** (platform-generated equivalent of the
  requested `hoplite/t13b-a-backend-truth-hardening`).
- Exact starting HEAD, verified before edits:
  **3458c6cb971f5d96fce8eda3abc3d708437ce713**.
- Guarded `origin/main`: **d1b06732f8a80db4e77986df31ff28d9f04641fa**; unchanged
  at initial fetch and checkpoint publication/fetch. No merge/rebase of main.
- Preserved prior T13 application ancestor:
  **ad342703fb31a2b97d2798f1161fb83d4d0ed090**.
- **T13B_A_CHECKPOINT=c31567ec7dfa8f95808c20c834b327cbb3425f9c**.
- Checkpoint commit: `fix(t13b): preserve receipt purchase lot truth and correction provenance`.
- This is a **continuation checkpoint, not a final application freeze**.
- The checkpoint was published without force, fetched, and verified:
  `local HEAD == origin/hoplite/megara-hyblaia-888f1514 == T13B_A_CHECKPOINT`.
  This handoff is in a subsequent documentation-only commit; its own SHA cannot
  be embedded in itself. The final publication receipt is in the task report.

## Backend behavior

### Receipt purchase lots

For **adopted/native households**, each accepted receipt line composes a T09 CREATE,
even when the ingredient/name already exists. It bypasses old-stock matching and
keeps each line separate, including two lines for the same ingredient on one receipt.
The old lot and its projection are unchanged. The new lot retains server-owned
`sourceType=RECEIPT`, scan ID, exact available purchase date/VND price, storage and
expiry semantics. No old provenance is overwritten or purchase evidence absorbed.
An incompatible old unit does not block a distinct new purchase lot.

Verified cases: manual tomato 3 + receipt B 2 produces two lots and T11 total 5;
receipt A + receipt B keeps separately attributable lots and unchanged A authority;
duplicate same-ingredient receipt lines retain individual prices/storage/expiry.
Repeated confirmation creates no third lot. Missing purchase facts remain null.

Unadopted legacy compatibility is unchanged. It does not acquire canonical lot
truth without adoption; the product/operator adoption path belongs to Part B.

### Fridge scan compatibility

Fridge SCAN still groups compatible same-ingredient lines and composes the existing
T09 CORRECT quantity addition on existing stock (3 + 2 = 5), not a receipt-style new
lot. Existing source, purchase facts, storage and expiry remain unchanged. If no
stock matches, SCAN CREATE remains valid. Review storage/expiry are retained as
claims; the unchanged CORRECT path does not apply those fields to the old lot.
The event after-state remains the authoritative record of what actually changed.

### Raw → confirmed authority

Optional, strictly validated `scanEvidence` is part of CREATE/CORRECT command intent:

```text
inventory_commands.fingerprint -> JSON.parse(...).command.scanEvidence
inventory_events.metadata -> JSON.parse(...).fingerprint
                          -> JSON.parse(...).command.scanEvidence
```

There is deliberately **no** `inventory_events.metadata.scanEvidence` top-level key.
The immutable 0025 trigger requires the exact existing event envelope; its retained
fingerprint already supplies the authoritative metadata extension point. No second
ledger, new DB writer or DB implementation change was needed.

Evidence contains `scanId`, server-owned source type and per-line `scanItemId`
(null for manual additions), raw name/quantity/unit, confirmed name/quantity/unit/
storage/expiry fields, and `corrected`. The production `scanCorrectionLine()` calls
`correctionOf()`; it is no longer test-only. Null raw values remain null. No image,
binary data, fabricated extraction or extra unknown fields are retained.

`corrected` means a provable name/quantity/unit difference from retained OCR, not
an assertion that missing OCR was accepted unchanged. Confirmed expiry represents
the actual review claim: if no date was supplied, that claim is UNKNOWN, while the
lot after-state may separately contain a sanctioned ESTIMATED shelf-life date.
Evidence is bounded to the route's 50 lines and 64 KiB, rejected rather than truncated.
Expiry combinations and CREATE source/scan-ID agreement are validated. Direct T09
same-key changed evidence conflicts; old commands without the optional field retain
backward-compatible fingerprints and replay behavior.

### T10 rawName and atomicity

T10 rawName is persisted `ocr_raw_name`, trimmed and bounded to 200 characters by
its existing contract. The full retained raw name remains in command evidence.
Without OCR it is null, never the reviewed name. Subject identity is the canonical
ingredient when available; otherwise the actual affected projection ID is supplied
for unmapped/manual lines. Reviewed quantities/units remain the confirmed claim.

Reviewed scan rows, T10 observations, T09 commands/effects/events and completion-last
scan status still share one D1 batch. Injected failures at stock/event, observation
and final status stages roll back everything. No partial stock or evidence remains.

Same retry, lost response, controlled concurrent receipt/fridge confirmation,
existing-stock retry, receipt A/B and valid altered already-confirmed payloads are
covered. A concurrent attempt that loses to a committed twin recovers only after a
household-scoped confirmed-status read, then returns the strict T11 replay response
without retrying writes. The preserved HTTP contract returns current T11 inventory
and ignores a valid altered confirmed payload; it does not promise an altered-payload
409 or replay the original response body. Direct T09 replay still validates intent.

## Migration and authority audits

- Migration count: **31**. `git diff 3458c6cb971f5d96fce8eda3abc3d708437ce713 -- migrations`
  is empty. 0001–0031 unchanged; **0032 absent**.
- 0031 blob: **c580d30b589ace1102cdfda7e61bfbacc57c4253**, unchanged from base.
- Fresh 0001→0031 replay executes in the SQLite and real local D1 test harnesses.
- **UNKNOWN INVENTORY WRITERS = 0** (focused changed backend area).
- **UNKNOWN CANONICAL READERS = 0** (focused changed backend area).
- Audited production files: `packages/domain/src/inventory-lot-commands.ts`,
  `src/worker/routes/scans.ts`, `src/worker/utils/scan-evidence.ts`.
- Compared SQL references before/after with
  `\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|FROM|JOIN)\s+(?:inventory_items|inventory_lots|inventory_events|inventory_commands)\b`:
  ordered lists unchanged (domain 0, scans 4, utility 0); no new stock SQL.
- Compared `git grep -l inventory_items <base> -- packages src scripts` with the
  current-tree equivalent: no added/removed referencing files; all three changed
  production files have zero added `inventory_items` references.
- The scan route's pre-existing projection matching is command-adapter input, not
  a new canonical product reader; receipt purchases now bypass it. Legacy SQL remains
  under its existing fence. Adopted stock mutation stays T09; returned reads stay T11.
- Existing classifications remain in T13 `AUTHORITY_MAP.md` and T12
  `FINAL_AUTHORITY_MAP.md`/`FINAL_WRITER_MAP.md`; DEC-016 records this clarification.
- No frontend, payment, unrelated auth, production config, setup, lockfile or Week
  change. No deployment, remote D1 access or main mutation.

## Executed verification

Node v24.19.0; pnpm 10.26.0; `pnpm install --frozen-lockfile` PASS, lockfile unchanged.

**Focused backend: 1,122/1,122 PASS, 17 files, 41.96 seconds.**

```sh
pnpm exec vitest run \
  tests/unit/inventory-lot-commands.test.ts \
  tests/unit/inventory-observations.test.ts \
  tests/unit/scans.test.ts \
  tests/unit/receipt-scan.test.ts \
  tests/unit/t13-receipt-vision-truth.test.ts \
  tests/integration/inventory-lot-commands.test.ts \
  tests/integration/inventory-lot-authority.test.ts \
  tests/integration/inventory-event-authority.test.ts \
  tests/integration/inventory-adoption.test.ts \
  tests/integration/inventory-writer-fence.test.ts \
  tests/integration/inventory-observations.test.ts \
  tests/integration/inventory-observation-concurrency.test.ts \
  tests/integration/inventory-reconciliation-composition.test.ts \
  tests/integration/inventory-reconciliation-fence.test.ts \
  tests/integration/inventory-read-authority.test.ts \
  tests/integration/scan-response-loss.test.ts \
  tests/integration/t13-receipt-vision-truth.test.ts \
  --maxWorkers=2 --minWorkers=1
```

T13 HTTP suite: **57/57** (22 new); T09 event-authority suite: **205/205** (9 new).
New cases also verify evidence immutability, exact replay/changed-evidence conflicts,
corrupt event-fingerprint rejection, strict field/expiry/source/size validation,
null OCR and controlled receipt/fridge races and late-stage rollback.

**Real local workerd/D1: 92/92 PASS, five files, 15.00 seconds** (baseline 81 + 11).

```sh
pnpm exec vitest run \
  tests/integration/inventory-lot-d1.test.mjs \
  tests/integration/inventory-observation-d1.test.mjs \
  tests/integration/inventory-read-authority-d1.test.mjs \
  tests/integration/inventory-closed-loop-d1.test.mjs \
  tests/integration/t13-receipt-vision-d1.test.mjs \
  --maxWorkers=2 --minWorkers=1
```

Counts: lot 44, observation 7, read authority 11, closed loop 8, T13 **22**.
Expected injected constraint failures in rollback tests are passing assertions.

Other executed checks:

```sh
pnpm typecheck
pnpm exec eslint packages/domain/src/inventory-lot-commands.ts \
  src/worker/routes/scans.ts src/worker/utils/scan-evidence.ts \
  tests/integration/inventory-event-authority.test.ts \
  tests/integration/t13-receipt-vision-truth.test.ts \
  tests/integration/t13-receipt-vision-d1.test.mjs
git diff --check
```

All PASS. Reviewed the full changed application/test diff and scope/ancestry guards.
Four new purchase-lot regressions were copied into an isolated detached worktree at
the exact base and run with:

```sh
pnpm exec vitest run tests/integration/t13-receipt-vision-truth.test.ts \
  -t 'preserves the entire manual lot|keeps receipt A and receipt B|keeps duplicate same-ingredient|does not let an incompatible existing unit'
```

**Negative control: all four fail as expected** (53 unselected tests), detecting the
old lot/evidence behavior; temporary worktree removed. This is not an unresolved failure.

### Failures encountered and corrected

- Initial typecheck identified missing persisted OCR typing and an over-wide expiry
  helper return type; both fixed, final typecheck passes.
- Initial focused run: 26 failures because adding a top-level event metadata key
  violated 0025's exact-envelope guard. Removed that approach, used the existing
  fingerprint, and aligned the new test assertions with that actual storage path.
- Two new test query calls initially passed an array to a variadic SQLite helper;
  corrected the call convention, not the expected authority behavior.
- First combined D1 matrix: 91/92; concurrent receipt twin sometimes returned 500
  after the other committed. Added confirmed-status recovery; kept the strong
  both-success/exactly-once assertions. Final matrix is 92/92.
- Platform setup/settings tools disagreed with the live checkout after selecting
  the required base. Reported the platform issue and installed locked dependencies
  directly; no repository/environment-configuration edit was needed.

### Not run / known limitations

**NOT RUN — DEFERRED TO T13B-B FINAL VERIFICATION:** full 3,000+ application suite,
full lint/build, dedicated migration smoke/schema gate/populated-upgrade matrix,
frontend/browser/mobile/visual checks, adoption UX/operator workflow and final T13
acceptance/certification matrix. Fresh migration replay did run as part of the
focused SQLite and real-D1 harnesses; do not confuse it with those deferred gates.
Hosted CI was not requested/run. No PR or main merge was created.

No known failing Part A backend check remains. Unadopted compatibility and the
fridge quantity-addition/claim-versus-applied-fields distinction above are retained
boundaries, not a claim that Part B UX or adoption is complete.

## Exact next action for T13B-B

1. Verify numeric repository ID 1364064929 and re-check main against the guarded SHA;
   stop on a mismatch. Do not merge/rebase main or rewrite the T13 lineage.
2. Fetch the published Part A branch and start from its final documentation HEAD.
   Confirm the checkpoint above is an ancestor and the application/test tree has no
   delta from it (`git diff T13B_A_CHECKPOINT HEAD -- packages src tests`). Read this
   handoff and DEC-016 before edits. Do not restart from main or the prior T13 freeze.
3. Preserve per-line receipt CREATE, fridge compatibility, raw evidence/fingerprint
   binding, real-D1 regressions, atomicity and status-based replay recovery. Keep all
   31 migrations immutable; do not add 0032 without separately justified approval.
4. Complete the separately scoped ReceiptReviewPage/ScanResultPage UX and adoption
   product/operator path. Reconcile UI claims with confirmed metadata versus actual
   applied lot state; do not turn scan observations into a second stock writer.
5. Run the deferred final verification and fresh browser interactions, then produce
   the final T13 acceptance matrix and independent-review packet in Part B. Part A
   supplies no final certification or authorization to merge/deploy.

**T13B-A COMPLETE — READY FOR T13B-B.**
