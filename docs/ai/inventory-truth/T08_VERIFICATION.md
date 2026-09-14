# T08 — Inventory Truth Foundation final report

Status: **COMPLETE** — locally verified, committed and published; not deployed.
Repository: `vn-2c/Frigo`.
Canonical handoff/publication branch: `hoplite/xanthos-7d942897`.
The user explicitly approved this branch in place of the original
`feature/t08-inventory-truth-foundation` on 2026-09-10; see DEC-006.

## Exact Git anchors and handoff

- Base / final fetched origin/main: `d1b06732f8a80db4e77986df31ff28d9f04641fa`.
- Final implementation SHA: `dd2ecc6f7066250dfdc5214a3d6c356e1479b61e`.
- Final verified and confirmed published checkpoint SHA:
  `fb00f46d4633c9659e812be9f86119533973a8bd`.
- Final branch tip is the subsequent docs-only completion commit containing this
  report; obtain it with `git rev-parse HEAD`. A commit cannot embed its own SHA.
- Source/tests/schema/scripts at the published checkpoint are identical to final
  implementation. Only docs changed afterward; the completion commit is published
  as a fast-forward successor, never squashed or force-pushed.

For a new account, fetch and checkout `origin/hoplite/xanthos-7d942897`, read the
six protocol files in order, and inspect `fb00f46..HEAD`. Do not attempt to fetch
the original feature name as the remote source of truth. Main is not the T08 branch.

### Preserved atomic commits

| Commit | Scope |
| --- | --- |
| `43718c2f64a0af86ceaa89244568c5f9fa1a1865` | Initial isolated working context |
| `e6ba715559ee0104e0ae6190b0bdee2d669aad3b` | Domain contracts, exact quantity, projection/parity and unit tests |
| `cdffb426b235c1369a2f3ffd9f3e6f16890508d0` | Storage/lot schema, migration/schema gates and latest-migration assertions |
| `dd2ecc6f7066250dfdc5214a3d6c356e1479b61e` | Guarded insert-only backfill/repository and SQL integration tests |
| `b5577ead44645d6d25171e7549a6f0f4cd7f0e4e` | Verification and blocked-publication handoff |
| `4cc290f8ea2be4000bc1368abd780ef25204b3a5` | Publication recheck receipt |
| `fb00f46d4633c9659e812be9f86119533973a8bd` | Explicitly approved handoff branch and successful publication |

This report's final documentation checkpoint follows that lineage.

## Schema and domain contracts

Additive `0023_inventory_truth_foundation.sql` adds only `storage_locations` and
`inventory_lots`. No existing migration, inventory/event history, HTTP DTO or live
reader/writer was rewritten. Schema migration does not automatically backfill data.

Locations are household-scoped FRIDGE/FREEZER/PANTRY types with custom names,
ordering/default flag/timestamps. Lots carry nullable canonical ingredient plus raw
name, exact nonnegative safe-integer milli quantity, canonical unit, composite
household/location FK, ACTIVE/CONSUMED/DISCARDED state, nullable purchase/opening
dates, separate known/estimated expiry, provenance identity, version and timestamps.
Optional money uses currency/amountMinor/minorDigits; unknown is NULL, not zero.
Raw legacy expiry/opening evidence and legacyVersion survive independently.

Contracts live in `packages/domain/src/inventory-truth.ts`, repository tooling in
`packages/db/src/inventory-truth.ts`. Existing exact Quantity arithmetic is reused;
kg/l normalize to g/ml, while piece/pack/bunch/slice never acquire fabricated mass.
Supported money pairs match T05: VND/JPY scale 0, USD/EUR scale 2. Explicit dated
label evidence is not a claim of independent verification or food safety.

Indexes enforce one household default per type, composite ownership, unique legacy
source, household/location access and ingredient FK lookup. Focused EXPLAIN QUERY
PLAN tests verify the documented lookups; there is no speculative FEFO/event index.

## Backfill strategy and parity evidence

`backfillLegacyInventory(db, authorizedHouseholdId)` is internal, explicit tooling,
not a public mutation route or automatic dual-write. It validates the household's
legacy rows before writes, uses deterministic IDs and a unique LEGACY_BACKFILL
source identity, then inserts defaults/lots in an atomic D1 batch. Source-field
guards reject stale inserts; retries skip existing synthetic lots, never overwrite
them. No purchase date, merchant, receipt, confirmed price or expiry is invented.

Real SQLite tests prove eight legacy seed rows -> eight synthetic lots; rerun ->
zero inserts; concurrent repeats -> 8+0. Original inventory/events/ingredients stay
unchanged. Invalid/unrepresentable quantities fail before writes; stale source
changes with or without a version bump roll back the entire batch. Existing guest
ownership-transfer SQL and household cascade remain legal; resulting snapshot
drift is reported rather than changing protected auth behavior.

Projection proves 10+6 eggs = 16, uses exact sums and separates incompatible units,
unknown ingredients and contextual packages. Known/estimated nearest expiry remain
separate. Parity reports missing/duplicate lots, quantity/household/ingredient/unit/
location/source/state/revision/expiry mismatches and malformed data with row IDs.
It proves the synthetic subset's point-in-time equivalence, not perpetual live truth.

## Verification

All final-session commands below passed on unchanged implementation source.

| Gate | Result |
| --- | --- |
| `pnpm test` | **1,617 tests / 89 files PASS**, 2026-09-10 01:36:42 UTC start, 88.37s |
| `pnpm exec vitest run tests/unit/inventory-truth.test.ts tests/integration/inventory-truth.test.ts` | **130 tests / 2 files PASS**: 76 unit + 54 integration |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm check:migrations` | PASS, fresh 23-migration chain and smoke scenarios |
| Populated 0022 -> 0023 + backfill | PASS in integration suite; legacy rows/history preserved |
| `pnpm schema:check:local` | PASS, sandbox-only schema/FK validation |
| `pnpm wrangler d1 migrations apply frigo-db --local` | Prior implementation session: 23/23 PASS; not rerun or applied remotely |
| `pnpm build` | PASS, web + Worker, no deployment |
| `git diff --check` and base-to-head diff check | PASS |
| Trusted branch publish + explicit fetch | PASS, fb00f46 confirmed on approved branch |
| Working tree / unchanged implementation comparison | Clean / PASS before completion docs checkpoint |

Existing inventory read/manual, scan confirmation, shopping import, cook completion,
planner snapshots, auth/tenancy and Week regressions pass. Two tests were updated
only to expect the actual new latest migration filename; coverage was not weakened.
Earlier implementation failures and their corrections are retained in VERIFICATION.md.
No unresolved test failure. No UI modification or fresh browser claim. No hosted-CI
claim: push filters do not run CI on this branch, and no PR/workflow was opened.

## Limits, divergence and future integration risks

- Final fetched main equals base; no divergence or migration-number collision was
  observed. If main later uses 0023, reconcile numbering only in an authorized
  integration phase, never silently merge/rebase it into this checkpoint.
- Exact milli representation deliberately rejects finer precision, legacy float
  drift, nonfinite/negative values and safe-integer overflow. No rounding repair.
- Money support is intentionally limited to four existing currencies; no FX or price
  intelligence. Unknown price/purchase/expiry remains unknown.
- Invalid legacy dates are retained raw and not promoted into confirmed dates.
- Backfill snapshots are not live synced. Old commands, new rows or guest transfers
  can make parity fail; the helper must not overwrite history to fake equivalence.
- Existing scan/shopping command fences are not an observed inventory CAS engine.
  Existing legacy consumers have first/last-row policies; none was cut over to lots.
- Contextual package equivalence is not known merely because unit labels match.
  The compatibility Number boundary rejects totals that would lose decimal value.

## Explicit exclusions and T09 prerequisites

Main untouched. No main merge/push/cherry-pick/force push; no production/staging
deployment, remote D1 apply, secrets/flags change, PayOS/payment/billing/webhook
change, unrelated auth or infrastructure change. Existing 0018 is only replayed
unchanged as part of local clean-migration verification; no real payment occurred.
No planner/cook/shopping/scan/frontend cutover, receipt/OCR/vision engine or UX V2.

T09 requires separate authorization. It must design lot commands
CREATE/USE/DISCARD/OPEN/MOVE/CORRECT, CAS/idempotency/concurrency and existing-ledger
authority before dual-write/cutover; define ownership-transfer/drift recovery and
representability policy; recheck migration numbering; then prove compatible
integration and FEFO under explicit evidence. T10–T12 remain unimplemented.
