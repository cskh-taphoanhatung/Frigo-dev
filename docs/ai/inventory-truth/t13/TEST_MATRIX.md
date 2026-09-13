# T13 acceptance, roadmap and certification matrix

**T13 COMPLETE — STOP for INDEPENDENT T13 FINAL REVIEW.** All current rows below
refer to application freeze **`7b7bb695ee597a46cf4022a2c534e2fea374be5d`**.

## Acceptance authority and evidence keys

The **only numbering authority for AC1–AC14** is
[release/T13_PROPOSED_SCOPE.md, Acceptance criteria (14)](../../release/T13_PROPOSED_SCOPE.md#acceptance-criteria-14).
Its historical “proposed” status describes when the packet was written, not the
current implementation status. Earlier versions of this matrix incorrectly
renumbered requirements; those rows must not be used for final acceptance.
Roadmap IDs come from that packet's gap table and the
[roadmap reconciliation audit](../../release/INVENTORY_TRUTH_ROADMAP_RECONCILIATION.md).

Evidence keys below name permanent tests, not substitute aggregate counts:

| Key | File / purpose |
| --- | --- |
| UT | `tests/unit/t13-receipt-vision-truth.test.ts`: expiry basis, server provenance, exact/absent purchase facts, raw correction, Cloudflare/schema no-fabrication |
| UI | `tests/unit/t13-inventory-ux.test.tsx`: unknown/estimated presentation, confidence/price/date, safe domain codes, bounded decision identity |
| RR / FR | `tests/unit/t13b-receipt-review.test.tsx` / `tests/unit/t13b-fridge-review.test.tsx`: actual editable review controls and review-state behavior |
| HD | `tests/unit/t13b-fridge-hardening.test.tsx`: 26 route/session/terminal/error regression cases |
| DT | `tests/unit/t13b-inventory-detail.test.tsx`: expiry truth, dirty metadata drafts, stale errors, UNIT_MISMATCH |
| IT | `tests/integration/t13-receipt-vision-truth.test.ts`: real authenticated Hono/SQLite truth, separate purchases, replay/rollback, reads/tenancy/decisions |
| RT | `tests/integration/t13b-review-roundtrip.test.tsx`: receipt and fridge DOM → actual authenticated route → T09/T10/T11 |
| D1 | `tests/integration/t13-receipt-vision-d1.test.mjs`: real local workerd/D1 receipt/read, purchase, expiry, review, atomicity and correction evidence |
| OP | `tests/integration/inventory-adoption-operator.test.ts`: 26 cases invoking the actual `scripts/inventory-adopt.mjs` executable |
| AT | `tests/unit/inventory-adoption.test.ts` + `tests/integration/inventory-adoption.test.ts`: certified adoption domain/route semantics |
| PF / BT | `tests/integration/t13b-preview-fixtures.test.mjs` / `tests/integration/t13b-browser-tooling.test.mjs`: isolated controls, production 404/origin fences, actual reporter lifecycle privacy |
| Browser | Cases A–I, U7 and reconciliation in the browser matrix below; real Chromium, real local app, synthetic data |
| T13R-A | `tests/integration/t13r-a-async-evidence.test.ts` (P1-1 persisted async evidence), `tests/integration/t13r-a-evidence-completeness.test.ts` (P2-A/P2-B, 0032), `tests/integration/t13r-a-canonical-identity.test.ts` (P1-2), `tests/unit/t13r-a-lot-draft-ownership.test.tsx` (P1-3), `tests/unit/t13r-a-receipt-ownership.test.tsx` (P1-4), `tests/e2e/t13r-a-ownership.e2e.ts` (P1-3/P1-4 browser); see [T13R_A_REMEDIATION.md](T13R_A_REMEDIATION.md) |

## Original AC1–AC14 — all PASS

| Original AC | Required behavior | Implementation source | Unit / integration / browser evidence | Result |
| --- | --- | --- | --- | --- |
| AC1 | Adopted receipt creates `RECEIPT`, source ID = receipt scan ID; inventory `dataSource='receipt'` | `src/worker/routes/scans.ts`, `src/worker/utils/scan-evidence.ts`, T11 inventory funnel | UT server-only provenance; IT `AC1/AC2` and server-type cases, D1 receipt→T11; browser A/B (C remains SCAN) | **PASS** |
| AC2 | Supplied purchase date and line money exact; absent facts NULL | `scan-evidence.ts` → `receiptLineFacts()` / `receiptPurchasePrice()`, scan CREATE adapter | UT exact VND, null coercion, date and line-total cases; IT `AC2`, D1 purchase/absence; browser A missing facts and B purchase facts | **PASS** |
| AC3 | No supplied expiry → ESTIMATED with basis or UNKNOWN, never automatically KNOWN; day chip estimated, explicit date known | `scan-evidence.ts`, `src/worker/utils/inventory-authority.ts`, manual/scan adapters | UT expiry mapping; IT `AC3` inferred/explicit/day-chip and manual loop, D1 schema expiry; browser A/F/U7 explicit date and absent/estimated claims | **PASS** |
| AC4 | Review confidence and missing ingredient/price/date flags; absent provider fields stay absent | `packages/ai/src/{schemas.ts,providers/cloudflare.ts}`, `ReceiptReviewPage.tsx`, presentation helpers | UT provider missing/low confidence, UI truth labels, RR flags; RT retained nullable evidence; browser A unknown/0/11%/90% and missing facts | **PASS** |
| AC5 | Receipt/fridge line name/quantity/unit/storage/expiry edits and explicit rejection | `ReceiptReviewPage.tsx`, `ScanResultPage.tsx`, scan confirmation route | RR/FR controls, HD terminal guards; RT both actual DOM→routes, IT rejection; browser A/C/H | **PASS** |
| AC6 | Raw extraction retrievable beside reviewed values; raw→confirmed in T09 metadata | `scan-evidence.ts` → `scanCorrectionLine()`, scan DTO, `packages/domain/src/inventory-lot-commands.ts`, existing command/event fingerprint | UT raw correction; IT raw retention/grouped correction, D1 command/event evidence, RT raw/review separation; browser A/C retained evidence | **PASS** |
| AC7 | Chosen option (a): accepted confirmation records RECEIPT/SCAN observation atomically with T09; no second stock writer | `confirmAdoptedScan()`, `packages/db/src/inventory-observations.ts` → guarded insert, T09 batch | UT maps evidence intent; IT event/observation/final-status rollback and concurrent/replay cases; D1 real batch rollback; browser A/C plus T10 reconciliation validate the visible loop, not atomicity by themselves | **PASS** |
| AC8 | Household-scoped detail/summary/observations/decisions; foreign identities do not leak | `src/worker/routes/inventory-truth.ts`, T11 reads, T10 decisions, tenancy guard | UI bounded decision identity; IT `AC8` detail/summary/foreign household and realistic IDs; D1 routes; browser A/B/reconciliation use authorized real endpoints | **PASS** |
| AC9 | Detail provenance, expiry kind/date, opened/purchased facts, lot identity/version | `IngredientDetailPage.tsx`, T11 `readInventoryLot`, `src/web/lib/inventory-truth.ts` | UI/DT truth labels and missing dates; IT `AC8/AC9` detail, D1 receipt read; browser A/B/F/U7 detail and canonical reread | **PASS** |
| AC10 | Existing edit sheet and storage move → T09 CORRECT/MOVE; stale errors specific with refetch | `IngredientDetailPage.tsx`, inventory PATCH adapter → T09 | DT dirty-field/cancel/no-op/unit/conflict cases; IT `AC10` MOVE/stale, existing PATCH parity integration; browser F/G/U7 real PATCH and reread | **PASS** |
| AC11 | UNKNOWN visibly distinct from fresh; correct expiry in UI | `presentExpiry()`, inventory/detail surfaces and existing editor | UI/DT UNKNOWN never fresh, clear/known/estimated; IT `AC11` unknown/estimated→known; browser F and U7 | **PASS** |
| AC12 | `ApiError.code` yields readable authority/domain errors, no raw JSON | `src/web/services/api.ts`, `presentDomainError()`, review/detail handlers | UI code mapping, HD conflict/refetch/UNIT_MISMATCH/500, DT safe drafts; IT authority/stale decision and OP refusal; browser G real 409, U7 real 422, I safe operator refusal | **PASS** |
| AC13 | Documented adoption path exercised, explicit rather than automatic | `scripts/inventory-adopt.mjs --help`, existing adoption endpoint; runbook in CONTINUATION | AT domain/route tests; IT `AC13`; OP actual executable identity/apply/CSRF/terminal/replay cases; browser I invokes executable from isolated authenticated session | **PASS** |
| AC14 | Existing full suite and real D1 floors, lint/type/build/migration/schema/diff gates | `package.json`, migration/schema scripts, `playwright.config.ts`, frozen tests | Exact full baseline and detached results below; PF/BT isolation/privacy; final serial browser 36/36; detailed executed commands/failures in FINAL_HARDENING | **PASS** |

`CORRECTED` is not a persisted review lifecycle. It is a `corrected` metadata
boolean; actual states are PENDING/CONFIRMED/REJECTED. Rejection retains raw/review
evidence but creates no stock command or stock observation. A receipt with an
explicit user-supplied expiry may be KNOWN; AC3 forbids inventing that fact.

## Original roadmap gaps — all DONE

| Roadmap ID | Closed requirement | Implementation source | Unit / integration / browser evidence | Status |
| --- | --- | --- | --- | --- |
| R3 | RECEIPT provenance and distinct purchase lots | `scans.ts` receipt CREATE + server `scanProvenance()` | UT provenance; IT manual 3+receipt 2 and receipt A/B, D1; browser A/B | **DONE** |
| R4 | Exact purchase date/price; retained merchant fact without invention | `receiptLineFacts()`, receipt header/DTO and CREATE input | UT null/exact/date; IT/D1 purchase facts; RR header, browser A missing/B supplied | **DONE** |
| R5 | Real confidence and missing-fact warnings | AI schema/Cloudflare provider, `ReceiptReviewPage.tsx` | UT no-fabrication/low confidence, UI/RR; RT nullable evidence; browser A | **DONE** |
| R6 | Inferred expiry is not a known fact | `lotExpiryFromEvidence()`, existing manual/scan adapters | UT expiry, IT/D1 `AC3`; browser A/F | **DONE** |
| R7 | Receipt and fridge line correction/rejection lifecycle | Both review pages and `scans.ts` | RR/FR/HD, RT receipt+fridge, IT rejection; browser A/C/H | **DONE** |
| R8 | Raw→confirmed retention, not overwrite | 0031 OCR fields, `scanCorrectionLine()`, command/event fingerprint | UT raw correction, IT/RT/D1 retained metadata; browser A/C | **DONE** |
| R11 | Atomic observation path and deterministic decisions | Guarded T10 insert + T09 batch, truth routes | UT intent mapping; IT/D1 rollback/reconciliation; browser A/C and reconciliation accept/dismiss | **DONE** |
| U1 | Lot/summary/observation/decision routes | `inventory-truth.ts`, T11/T10 services | UI decision bounds; IT tenancy/summary/decisions, D1; browser B/reconciliation | **DONE** |
| U4 | Detail source/expiry/opened/purchased/lot identity | `IngredientDetailPage.tsx`, T11 detail DTO | UI/DT truth; IT `AC8/AC9`, D1; browser A/B/F/U7 | **DONE** |
| U6 | Manual/scan estimated vs known/unknown UI | Expiry evidence mapper and add/review/detail controls | UT/UI/DT; IT manual day-chip/date; browser A/F/U7 | **DONE** |
| U7 | Existing name/unit/category/storage/expiry editor; preserve unrelated facts | `IngredientDetailPage.tsx` dirty draft → versioned PATCH, backend conversion | DT no-op/cancel/dirty snapshot/UNIT_MISMATCH, IT/PATCH parity; browser U7 incompatible then compatible unit and canonical invariant proof | **DONE** |
| U8 | Storage move via existing authority adapter | Inventory PATCH → T09 CORRECT/MOVE | DT metadata submit; IT `AC10` storage move; browser F/U7 | **DONE** |
| U12 | UNKNOWN not fresh, expiry correction available | `presentExpiry()` and detail editor | UI/DT known/estimated/unknown; IT `AC11`; browser F | **DONE** |
| U13 | Explicit adoption path and useful authority/domain errors | Operator executable, existing endpoint, `ApiError.code` presenter | AT/UI/HD/DT; OP 26 executable cases and IT authority code; browser I/G/U7 | **DONE** |
| U14 | Observation/reconciliation UI accept/dismiss | `ReconciliationPage.tsx`, T10 read/decision routes | UI bounded decision key; IT/D1 stale/replay/decisions; browser real T10 proposal applies, dismissal preserves stock | **DONE** |

## Browser matrix — 12 cases × 3 real viewports

Pinned Playwright **1.63.0**, Chromium **153.0.8010.12**, Node **24.19.0**, pnpm
**10.26.0**. Every row passed at **360×844 / 390×844 / 430×844** before freeze
and in the final detached run. Viewport assertions check actual `innerWidth`,
overflow, visible controls and trial-click accessibility, not a 1440px proxy.

| Case / file under `tests/e2e/` | Observed proof | 360 / 390 / 430 |
| --- | --- | --- |
| A receipt correction — `t13b-browser.e2e.ts` | Five edited fields, raw values, explicit reject, real confidence, RECEIPT provenance | PASS / PASS / PASS |
| A missing facts — same file | Missing merchant/date/price and nullable confidence stay unknown | PASS / PASS / PASS |
| B existing + purchase — `t13b-purchase-adoption.e2e.ts` | Original lot 3 unchanged; new RECEIPT lot 2; T11 total 5, exact purchase facts | PASS / PASS / PASS |
| C fridge — `t13b-browser.e2e.ts` | Accepted correction only, rejection retained, raw evidence, no purchase facts | PASS / PASS / PASS |
| D route ownership — `t13b-ownership.e2e.ts` | Same-document A→B→A; delayed B never shows A evidence; only route-owned confirmation | PASS / PASS / PASS |
| E session race — same file | Delayed real GET after profile logout cannot repopulate private state or mutate | PASS / PASS / PASS |
| F UNKNOWN — `t13b-browser.e2e.ts` | Unknown not fresh; explicit date/storage edit becomes canonical KNOWN/freezer | PASS / PASS / PASS |
| G conflict — same file | Real stale PATCH 409, safe message, authoritative refetch, exactly one mutation | PASS / PASS / PASS |
| H confirmed — `t13b-ownership.e2e.ts` | Accepted/rejected/empty terminal reviews, disabled controls, no confirm/manual CTA; same-document A→B→A and mutation-free fridge navigation | PASS / PASS / PASS |
| I adoption — `t13b-purchase-adoption.e2e.ts` | Actual CLI apply/identity refusals, terminal evidence, stock preservation, explicit replay | PASS / PASS / PASS |
| U7 metadata — `t13b-metadata.e2e.ts` | Real 422 UNIT_MISMATCH retains draft/stock; compatible unit/name/category/storage/date save through T09 without changing canonical quantity/source | PASS / PASS / PASS |
| R11/U14 — `t13b-reconciliation.e2e.ts` | Real T10 proposal accepted through UI; egg quantity becomes 5; dismissed tofu stays 200 | PASS / PASS / PASS |

## Executed local certification gates

Selections below overlap and must not be added to the full-suite total. Browser
cases run via `pnpm test:browser`, **not** in the default Vitest suite. Exact
commands and retained logs are in [T13B_FINAL_HARDENING.md](T13B_FINAL_HARDENING.md).

| Gate | Result |
| --- | --- |
| Pre-freeze full baseline | **3372 passed / 132 files** |
| Detached exact-freeze full suite | **3372 passed / 132 files** |
| Focused T13B/privacy/operator/tooling | **194 passed / 10 files**, including HD 26 and OP 26 |
| T08 | **130 passed / 2 files** |
| T09 | **1259 passed / 17 files** |
| T10 | **98 passed / 6 files** |
| T11 | **39 passed / 2 files** |
| T12 | **22 passed / 3 files** |
| T13/T13B | **271 passed / 12 files** |
| Real local workerd/D1 | **92 passed / 5 files**, including T13 D1 22 |
| Browser pre-freeze / final serial detached | **36/36 / 36/36** |
| Detached lint / typecheck / build | **PASS / PASS / PASS** |
| Migration smoke / fresh local D1 apply / local schema | **PASS / 31 applied / PASS** |
| Populated-0022 upgrade + fresh replay targeted selection | **2 passed / 52 not selected**; full suite executes all 54 |
| Pre-0031 pending/confirmed scan upgrade | **PASS**, smoke fixture |
| Migration integrity | **31** migrations; 0001–0030 unchanged; 0031 blob `c580d30b589ace1102cdfda7e61bfbacc57c4253` unchanged; 0032 absent |
| Final detached status / diff / whitespace check | **EMPTY / EMPTY / PASS** |
| Writer / reader UNKNOWN | **0 / 0**, with meal-planner SAFE_DEFERRED boundary retained |

### Failure retained, not hidden

The first concurrent detached browser run was **35 passed / 1 failed**, H at
430px. At **14:02:32 UTC**, full-suite
`tests/unit/generate-migration.test.ts` rewrote
`packages/recipes/src/vietnamese-bank.ts` with unchanged bytes. Vite reloaded the
page and the trace showed the same-document marker was lost. No frozen source,
assertion, timeout or retry setting was changed. Once source-writing suites
finished, the **entire** detached browser matrix passed serially, **36/36**.

**Never run Vitest/source-writing checks concurrently with browser checks in the
same worktree.** The failed attempt remains part of certification history.
Intermediate U7 negative proof and reporter privacy failures are also recorded in
FINAL_HARDENING; they are not the final baseline.

**NO HOSTED GITHUB CI STATUS FOR T13B_APPLICATION_FREEZE.** Exact-freeze queries
returned zero contexts and zero matching completed push-workflow runs. Local
PASS is not hosted CI, independent final-review approval, or production evidence.
