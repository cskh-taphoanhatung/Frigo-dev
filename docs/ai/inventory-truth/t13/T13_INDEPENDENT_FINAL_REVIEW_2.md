# T13 independent final review #2 — exact freeze audit

**INDEPENDENT T13 FINAL REVIEW #2 — PASS. T13 CERTIFIED FOR INTEGRATION PLANNING.**

Date: 2026-09-14. Independent read/verify/re-run audit of the exact certified T13
application freeze. The reviewer did not implement T13R-A, T13R-B, the final
certification, or the later Takosan brand migration. Previous certification claims
were not accepted as truth: source was re-read, evidence was re-run, and the
certification was actively challenged. **No application file, test, fixture or
migration was modified.** This document is the only artifact of the review.

This PASS authorizes only the next planning stage (certified T13 + hardened
Takosan → safe integration/consolidation plan). It does **not** authorize a main
merge, brand merge, deployment, remote D1 access, PayOS work, T14, or production
reconciliation.

## Identity

| Field | Verified value |
| --- | --- |
| Repository canonical name | `vn-dlo/Frigo-dev` (public API `repositories/1368281478` → `full_name`; owner renamed again from `vn-blo`) |
| Repository ID | **1368281478** (authoritative; resolved by ID before starting) |
| Independent reviewer branch | `hoplite/polyrhen-82141980` (this thread's broker-authorized branch) |
| Exact reviewed freeze | **`32ddbb4f2bb636fdcf201e9ca99c4689d3655477`** (`T13R_APPLICATION_FREEZE`) |
| Certification docs head | `42e0037f92104fd5dc3c89c633d91f67fa892724`; publication continuation `897102b6816c22af2e6a49f29662690e3e3206e0` (application-path diff freeze→`897102b` EMPTY) |
| Protected main | `d1b06732f8a80db4e77986df31ff28d9f04641fa` — unchanged (`origin/main` verified) |
| Rejected freeze (comparison only) | `7b7bb695ee597a46cf4022a2c534e2fea374be5d` |
| Takosan commits (explicitly NOT reviewed) | `ff63edfb…` (application), `60ab7d4…` (docs) |
| Toolchain | Node 24.19.0, pnpm 10.26.0 (`--frozen-lockfile`), Vitest 3.2.7, Playwright 1.63.0 / Chrome Headless Shell 153.0.8010.12, wrangler 3.114.17, sqlite3 3.45.1 |

## Preflight

| Check | Result |
| --- | --- |
| `git cat-file -e 32ddbb4…^{commit}` | EXISTS (fetched by exact SHA via the trusted broker) |
| Detached clean worktree | `git worktree add --detach /tmp/hoplite/t13-review 32ddbb4…`; `HEAD == 32ddbb4…`; starting `git status --porcelain` **EMPTY** |
| Development workspace | HEAD `d1b0673` (main); only dirty path was the pre-existing `.hoplite/settings.json` platform overlay — never staged, never committed, not part of this review |
| Main ancestor of freeze | YES (`git merge-base --is-ancestor`) |
| Lineage `7e68e3b → d0006a4 → 830d3cb → 83248df → bd2f5f3 → 32ddbb4` | PASS |

### Freeze boundary (`7e68e3b` → `32ddbb4`)

`git diff --stat 7e68e3b 32ddbb4`: 7 files — `TASK_BOARD.md`, `docs/ai/CURRENT_STATE.md`,
`docs/ai/HANDOFF.md`, `docs/ai/inventory-truth/t13/T13R_B_REMEDIATION.md`,
`scripts/planner-preview-fixtures.mjs` (+5/−1, one synthetic seed row
`preview-stock-milk` → `preview-stock-cheese`; the script is imported only by
`scripts/security-preview.mjs` and tests, never by `src/`), `tests/e2e/t13r-a-expiry-reopen.e2e.ts`
(new), `tests/e2e/t13r-b-presentation.e2e.ts` (fixture id rename). **No path under
`src/`, `packages/`, `migrations/`, `wrangler.jsonc`, `package.json`, `pnpm-lock.yaml`
or `playwright.config.ts` changed.** `bd2f5f3` and `32ddbb4` were inspected as
patches, not trusted by message. **7e68e3b → freeze production-source delta: NONE.**

## Migrations

| Check | Result |
| --- | --- |
| Count | **32**; ordering contiguous 0001–0032; `0033*` **ABSENT** |
| 0031 blob | `c580d30b589ace1102cdfda7e61bfbacc57c4253` at freeze == `fc0f9c5` (R-A baseline) — **unchanged** |
| 0032 blob | `48f26f7cca8e6aa91fdffd9e68a5f5028e4ccffe` at freeze == `fc0f9c5` == `7e68e3b` — **unchanged** |
| 0032 content (read) | additive only: 5 nullable `scan_items` columns (`ocr_canonical_id` FK, `ocr_category`, `ocr_storage` CHECK, `reviewed_expiry_date` real-calendar CHECK, `reviewed_expiry_kind` enum) + 2 fail-closed triggers; **no backfill statement** |
| `pnpm check:migrations` | `migration-smoke=ok` (includes pre-0031 legacy rows and populated 0031→0032 upgrade with zero-fabrication assertions) |
| Fresh real local D1 (`wrangler d1 migrations apply --local`, clean `.wrangler`) | 32 ✅; `d1_migrations` = 32; last = `0032_scan_evidence_completeness.sql` |
| Schema gate fresh (`pnpm schema:check:local`) | PASS |
| `pragma_foreign_key_check` fresh | **0** |
| Independent legacy/populated replay on real local D1 (isolated `--persist-to`, 0001–0031 applied, 5 representative rows seeded — legacy pending/confirmed, T13 pending/confirmed(NULL confidence)/rejected — then 0032 applied) | 0032 ✅; pre-existing columns **byte-identical** before/after (JSON snapshot `cmp`); every new 0032 column `typeof = null` on all 5 rows; **fabricated rows = 0**; FK = 0; both reviewed-expiry triggers present and **verified to ABORT** (`KNOWN` without date on CONFIRMED; kind on non-CONFIRMED) while a valid `CONFIRMED + KNOWN + 2030-12-31` write is accepted; schema gate on the upgraded DB: 0 issues |
| `inventory-truth.test.ts` "replays all 32 migrations" / "upgrades a populated 0022 database" | 2/2 PASS |

## Original findings — disposition (source re-read + evidence re-run)

| Finding | Verdict | Source evidence at freeze | Re-run evidence |
| --- | --- | --- | --- |
| **P1-1** async raw evidence | **PASS** | `src/worker/services/scan-queue.ts` — both fenced receipt and fridge INSERTs bind `ocr_raw_name, ocr_quantity, ocr_unit, ocr_confidence (item.confidence ?? null), ocr_canonical_id, ocr_category, ocr_storage`; legacy NOT NULL `confidence` keeps `0.9` filler **only** when the provider reported none and is never read back into the DTO (`scanItemDto` reads `ocr_confidence`). Consumer wiring `src/worker/index.ts` `queue()` → `processScanJob` verified; producer `SCAN_QUEUE.send({type:'scan.process.v1'…})` verified. | `t13r-a-async-evidence.test.ts` drives the real `processScanJob` against SqliteD1 and asserts persisted rows for confidence 0 / 0.11 / 0.9 / missing × fridge/receipt — not an unused helper |
| **P1-2** canonical identity | **PASS** | `src/worker/routes/inventory.ts` PATCH: `ingredientId = body.name !== undefined ? canonical?.id \|\| existing.ingredient_id \|\| null : existing.ingredient_id …`; same value flows into the native `CORRECT` (`adoptManualInventoryUpdate` → `changes.ingredientId`) and the legacy UPDATE. Rejected freeze had `canonical?.id \|\| null` (identity cleared). | `t13r-a-canonical-identity.test.ts` legacy+native × free-form / rename+metadata / explicit remap / unmapped / metadata-only / replay+stale — 14/14 |
| **P1-3** lot draft ownership | **PASS** | `IngredientDetailPage` renders `<LotDetail key={id}>` (route-keyed remount); `draftOwner {routeId,itemId}` set on `startEdit`; `submitDraft` refuses when `!draftOwner \|\| draftOwner.routeId !== routeId \|\| String(item.id) !== draftOwner.itemId` with **no mutation**; PATCH target fixed from the verified owner at submit; `useMutation({retry:false})`. Race attempt (A draft → route B → save) cannot reach `mutate` because the keyed remount discards state and the owner check fences the residual path. | `t13r-a-lot-draft-ownership.test.tsx` 7/7 (A→B, B→A, slow A after B, route change during refetch, in-flight save across routes); browser P1-3 3/3 |
| **P1-4** receipt ownership | **PASS** | `ReceiptReviewPage` keyed by `scanId`; `ownsReceipt(receiptScanId, next)` before any state write on initial poll **and** conflict refetch; mismatch → `failed`, items cleared, `MISMATCH_MESSAGE`; `handleConfirm` re-checks ownership and posts to `receiptScanId` (route), never DTO id; server GET/confirm both scoped `household_id` and return 404 for foreign scans. | `t13r-a-receipt-ownership.test.tsx` 6/6 (request A/response B, late A after B, A→B→A, refetch mismatch, confirm after route switch, private-session reset); browser P1-4 3/3 |
| **P2-1** confidence truth | **PASS** | `packages/ai/src/providers/cloudflare.ts` `optionalConfidence()`: `''/null/undefined → undefined`, finite `0..1` preserved exactly, otherwise `undefined`; used by both `vision()` and `receiptScan()`. `schemas.ts`: `confidence: z.number().min(0).max(1).optional()` for both item schemas (no `.default(0.9)`). No `Math.max(0.5…)` or `\|\| 0.9` anywhere in the AI package or DTO. Presenter probe: `undefined/null → "chưa rõ"`, `0 → 0%`, `0.11 → 11%`, `0.9 → 90%`, `1 → 100%`. Quality tone (`low/medium/high`) is presentation only and does not rewrite the value. | unit vision-confidence matrix + receipt 0.11 case GREEN; browser A "unknown/0/11%/90%" 3/3 |
| **P2-2** evidence completeness | **PASS** | 0032 columns written by all four writers (sync fridge/receipt via `SQL.INSERT_SCAN_ITEM`/`INSERT_RECEIPT_SCAN_ITEM`, async fridge/receipt in queue); confirmation `UPDATE scan_items SET raw_name…canonical_id…category…storage…` touches **only working columns** — no `ocr_*` column appears in the SET list; `rawScanEvidence()` → `scanItemDto().rawEvidence` exposes original vs reviewed separably. | `t13r-a-evidence-completeness.test.ts` (writers + confirmation leaves evidence intact) GREEN; browser A/C retained evidence 6/6 |
| **P2-3** expiry reopen | **PASS** | Confirmation persists `reviewed_expiry_date/kind` from `lotExpiryFromEvidence(item.expiryDate, item.expiryBasis)` per accepted line; `scanItemDto` emits `expiryKind/expiryDate/expiryEstimated` only for CONFIRMED lines via `reviewedScanExpiry()` (no heuristic re-derivation from stock); both review pages render disabled inputs hydrated from the DTO; explicit unknown → `expiryKind:'UNKNOWN'` and "Đã xác nhận không rõ hạn dùng". | integration KNOWN/ESTIMATED/UNKNOWN × fridge/receipt × legacy/native GREEN; `t13r-a-expiry-reopen.e2e.ts` fresh-document reopen with 2030-12-31 and explicit unknown, zero POSTs on reopen — 6/6 |
| **P2-4** conflict/refetch | **PASS** | `query-client.ts` `mutations: {retry:false}`; every inventory/detail mutation `retry:false`; `presentDomainError` classifies `CONFLICT/STALE_SNAPSHOT/IDEMPOTENCY_CONFLICT/INSUFFICIENT_INVENTORY…` as `refetch:true`, `UNIT_MISMATCH` as `refetch:false`; `refetch({throwOnError:false})` outcome checked; `presentRefetchOutcome` appends "Đã tải lại…" only on success and "Chưa tải lại được… dữ liệu đang hiển thị có thể đã cũ" on failure; `data-refetch-state` attribute; generic 500 → fallback copy, no internals. `updateInventoryItem` queues offline writes only for `isOffline` errors, so a 409 is thrown to the caller and never re-sent. | `t13r-b-inventory-conflict.test.tsx` 4/4 (one PATCH, reload replaces 2→7, failed reload honestly flagged, IDEMPOTENCY_CONFLICT delete, UNIT_MISMATCH + 500); browser A/B (list conflict success/failure) + G 9/9 |
| **P2-5** estimated expiry | **PASS** | `HomePage` use-soon chips use the shared `presentExpiry`; ESTIMATED → "Ước tính còn N ngày" with sky styling and `data-expiry-kind="ESTIMATED"`; KNOWN → "⏳ N ngày" / `KNOWN`; UNKNOWN → "Chưa rõ hạn dùng" / `UNKNOWN` (no countdown). `IngredientRow` and detail use the same presenter (tone `estimated` chip, " · Ước tính còn N ngày"). | presenter matrix GREEN; browser C 3/3 |
| **P2-6** openedAt null | **PASS** | `presentOpenedState`: non-string/invalid → "Chưa có thông tin"; ISO instant → "Đã mở YYYY-MM-DD". Lot DTO passes `openedAt` through unchanged from the T11 read. Probe: `null → Chưa có thông tin`, `2026-09-11T08:30:00Z → Đã mở 2026-09-11`. | unit P2-6 GREEN; browser D/E 3/3 |
| **IngredientRow crash** | **PASS** | `IngredientRow.tsx` destructures `id` in props (line 28) and renders `data-item-id={id}`; `ReferenceError` impossible. | browser `/fridge` renders rows in t13r-b case A/B and t13b G at 3 widths; fixtures assert "No uncaught browser errors" — 0 |

## Authority audit (validated against source, not the map)

| Check | Result |
| --- | --- |
| Stock writer statements (`INSERT/UPDATE/DELETE … inventory_lots\|inventory_items\|inventory_events` in `packages src scripts`) | 37 at freeze vs 35 at `7b7bb69`; the only delta is **2 synthetic seed INSERTs in `scripts/planner-preview-fixtures.mjs`** (preview-only, never imported by `src/`). All `src/`+`packages/` writer statements identical to the rejected freeze (line numbers aside). |
| Canonical reader call set (`readInventoryAuthority\|readInventoryLot\|readInventorySummary\|fetchHouseholdInventoryFromDb\|readInventoryAuthorityMode\|runLegacyInventoryBatch\|loadMealPlanningSnapshot`) | **IDENTICAL** to `7b7bb69` |
| 0032 evidence columns | read only by `src/worker/utils/scan-evidence.ts` → `scanItemDto`; never by an inventory writer or a T11 reader |
| T09 mutation authority | **PASS** — scan confirm, PATCH, reconciliation all compose `LotCommandSpec`s through `composeInventoryLotCommands`; grouped fridge corrections still `CORRECT`; receipt lines `CREATE` with `sourceType: provenance` |
| T11 read authority | **PASS** — `GET /inventory` native branch → `inventoryReadItemToApi`; lot detail/summary → `readInventoryLot/readInventorySummary`; non-native households get `INVENTORY_AUTHORITY_REQUIRED` on lot routes |
| Frontend projection authoritative? | NO — detail page reads T11 lot; legacy `GET /inventory` fallback only when lot query errors |
| `loadMealPlanningSnapshot` | still `SAFE_DEFERRED` behind unbound `MEAL_PLANNER_ENABLED` (unchanged from T12/T13 map; not a T13 regression) |
| **UNKNOWN INVENTORY WRITERS** | **0** |
| **UNKNOWN CANONICAL READERS** | **0** |

The AUTHORITY_MAP.md in the freeze tree still cites `7b7bb69` in its header
(updated only at the docs head `42e0037`); classifications were re-derived here
against `32ddbb4` and hold.

## Static / build / test gates (exact freeze, detached, frozen install)

| Gate | Result |
| --- | --- |
| `git diff --check` | PASS (exit 0) |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS |
| **Full Vitest `pnpm test`** | **3471 / 3471 passed, 138 files** (266.7 s) — matches the historical baseline exactly |
| Focused T08 (`inventory-truth` unit+integration, event-authority, writer-fence, concurrency, guest-transfer) | 385 / 385 (6 files) |
| Focused T09 (lot commands/authority/schema, FEFO ×3, backfilled FEFO/PATCH, PATCH parity, adoption unit+integration) | 982 / 982 (12 files) |
| Focused T10 (observations unit/integration/concurrency, reconciliation composition/fence) | 91 / 91 (5 files) |
| Focused T11 (`inventory-read-authority.test.ts`) | 28 / 28 |
| Focused T12 (closed-loop, closed-loop routes, adoption operator) | 40 / 40 (3 files; operator executable 26/26) |
| Focused T13 (10 non-D1 unit/integration/tooling files) | 272 / 272 |
| Focused T13R-A (5 files) | 45 / 45 |
| Focused T13R-B (`t13r-b-inventory-conflict` 4/4; 7-file set per T13R_B_REMEDIATION.md) | 174 / 174 (7 files) |
| Real local D1 workerd (`inventory-lot`, `inventory-observation`, `inventory-read-authority`, `inventory-closed-loop`, `t13-receipt-vision` `-d1.test.mjs`) | **92 / 92** (5 files) |

Focused file selections are the reviewer's own (by content/name), so per-suite
counts differ from the certification's groupings; every selected file passed and
the full-suite total is identical.

## Browser (Playwright, repository harness, serial, run LAST after all Vitest)

`CI=1 pnpm exec playwright test` at the exact freeze, workers=1, retries=0,
`node scripts/security-preview.mjs` web server (AI mock, sync queue, isolated
SqliteD1), Chromium headless 153.

| Result | Value |
| --- | --- |
| **Total** | **60 / 60 passed** (5.6 min) — 20 distinct cases × 360 / 390 / 430 |
| 360 / 390 / 430 | 20 PASS / 20 PASS / 20 PASS |
| Receipt ownership (`t13r-a-ownership` P1-4; `t13b-ownership` D/E/H) | PASS |
| Lot ownership (`t13r-a-ownership` P1-3) | PASS |
| Explicit expiry fresh-document reopen (fridge + receipt) | PASS |
| Explicit unknown expiry reopen (same specs, undated line) | PASS |
| Conflict refetch success (`t13r-b` A; `t13b-browser` G) | PASS |
| Conflict refetch failure (`t13r-b` B, synthetic 500 on reads) | PASS |
| Estimated expiry qualifier (`t13r-b` C) | PASS |
| openedAt null / known date (`t13r-b` D/E) | PASS |
| `/fridge` render / IngredientRow (`t13r-b` A/B, `t13b` G rows; fixture asserts zero uncaught browser errors) | PASS |
| Also: A receipt corrections, A missing facts, B purchase lot, C fridge, F UNKNOWN→KNOWN/MOVE, I adoption executable, U7 metadata, R11/U14 reconciliation | PASS ×3 each |

## Cleanliness after execution

`git status --porcelain` in `/tmp/hoplite/t13-review` after lint/typecheck/build,
all focused suites, full Vitest, migration smoke, fresh + legacy real D1, workerd
suites and the full Playwright run: **EMPTY**. `git rev-parse HEAD ==
32ddbb4f2bb636fdcf201e9ca99c4689d3655477`. Freeze modified: **NO**. Application
files modified by reviewer: **NO**.

## Hosted CI for the exact freeze

Checked via the first-party provider tools and the public REST API for
`32ddbb4f2bb636fdcf201e9ca99c4689d3655477`:

| Source | Count |
| --- | --- |
| Workflow runs (`head_sha`) | **0** |
| Check runs | **0** |
| Legacy status contexts (`state: pending`, empty) | **0** |

**NO HOSTED GITHUB CI STATUS FOR T13R_APPLICATION_FREEZE.** Cause: `.github/workflows/ci.yml`
triggers only on `push` to `main/master/codex/security-hardening-sync` and
`pull_request` to `main/master`; the freeze lives on a `hoplite/*` branch with no PR.
No repository policy document (AGENT_RULES, T13_PROPOSED_SCOPE, MASTER_CONTEXT)
requires hosted CI for a freeze; the local clean-detached gates are the defined
certification path. Treated as an evidence state, not a failure. No brand/main/docs
CI was substituted.

## Original AC1–AC14 (numbering from `docs/ai/release/T13_PROPOSED_SCOPE.md` only)

| AC | Requirement | Evidence re-verified | Result |
| --- | --- | --- | --- |
| AC1 | Adopted receipt confirm → `source_type='RECEIPT'`, `source_id=<scan>`; `dataSource:'receipt'` | `scanProvenance(scan.scan_type)` server-side; `CREATE … sourceType: plan.provenance, sourceId: scanId`; `inventoryReadItemToApi` maps `RECEIPT→'receipt'`; IT + D1 + browser A/B | **PASS** |
| AC2 | Purchase date / money exact when present, NULL when absent | `receiptLineFacts`/`receiptPurchasePrice` (whole-đồng only, `null` for absent, single-line attribution); `trustworthyCalendarDate`; browser A missing facts + B purchase | **PASS** |
| AC3 | No supplied expiry → ESTIMATED/UNKNOWN never KNOWN; day-chip ESTIMATED; picker KNOWN | `lotExpiryFromEvidence` + `expiryBasis` (`supplied`/`inferred`/`absent`); manual add sends `expiryEstimated: true` for chips; PATCH picker `expiryEstimated: false`; grouped default shelf-life fallback classified `inferred` | **PASS** |
| AC4 | Per-line confidence; unrecognized/unpriced/undated flags; provider leaves absent absent | `presentConfidence`, "Chưa nhận diện nguyên liệu chuẩn", `presentPrice`/`presentPurchaseDate`; Cloudflare `optional*` helpers; schemas optional | **PASS** |
| AC5 | Edit name/qty/unit/storage/expiry per line; explicit reject recorded | both review pages; `review_state='REJECTED'` UPDATE guarded by READY predicate | **PASS** |
| AC6 | Raw values survive confirmation; T09 metadata raw→confirmed | `ocr_*` untouched by confirm UPDATE; `scanCorrectionLine` into `scanEvidence` command intent; `rawEvidence` in DTO | **PASS** |
| AC7 | Observation in same atomic batch, no second stock writer (option a) | `confirmAdoptedScan`: `db.batch([...composed.statements, ...batchStatements, ...observationStatements, statusStatement])`; `guardedObservationInsertStatement` shares READY guard; writer audit 0 unknown | **PASS** |
| AC8 | Household-scoped lot/summary/observations/decision routes; cross-tenant 404 | `inventory-truth.ts` four routes under `tenancyGuard`; `LOT_NOT_FOUND → 404`; scan GET/confirm `household_id` scoped | **PASS** |
| AC9 | Detail shows provenance, expiry kind, estimated vs known, openedAt, purchasedAt, lot id/version | `IngredientDetailPage`: `provenanceLabel`, `presentExpiry` tone/label, `presentOpenedState`, `presentPurchaseDate`, `Mã lô`/`Phiên bản lô v{lotVersion}` | **PASS** |
| AC10 | Edit sheet + storage move → T09 CORRECT/MOVE; stale conflict specific message + refetch | `adoptManualInventoryUpdate` composes CORRECT (+MOVE); detail `onError` conflict → truthful refetch outcome; browser F/G/U7 | **PASS** |
| AC11 | UNKNOWN distinct from fresh; expiry correctable in UI | `presentExpiry` unknown tone/"Chưa rõ hạn dùng"; date picker in edit sheet; browser F | **PASS** |
| AC12 | Authority/conflict codes → specific text via `ApiError.code`; no raw JSON | `ApiError.code` getter + `DOMAIN_ERRORS` table; browser asserts alert has no `SQL\|fingerprint\|household\|{` | **PASS** |
| AC13 | Documented adoption path exercised in a test | `scripts/inventory-adopt.mjs`; `inventory-adoption-operator.test.ts` 26/26; browser I | **PASS** |
| AC14 | Gates green: suite ≥ 3,092, real D1 ≥ 70, lint/typecheck/build, migration smoke, schema gate, diff-check | 3471 ≥ 3092; D1 92 ≥ 70; all PASS above | **PASS** |

**AC1–AC14: 14 PASS, 0 FAIL, 0 PARTIAL.**

## Roadmap closure (current implementation evidence)

| Row | Status | Evidence |
| --- | --- | --- |
| R3 receipt provenance | **DONE** | AC1 |
| R4 purchase facts | **DONE** | AC2 |
| R5 confidence / no fabrication | **DONE** | AC4 + P2-1 (now fridge `vision()` too) |
| R6 expiry kind truth | **DONE** | AC3 |
| R7 per-line lifecycle + edits + reject | **DONE** | AC5 |
| R8 raw evidence retention | **DONE** | AC6 + P2-2 (0031 + 0032) |
| R11 observation path + reconciliation UX | **DONE** | AC7 + `ReconciliationPage` + browser R11/U14 |
| U1 lot/summary/observation routes | **DONE** | AC8 |
| U4 detail provenance/expiry/opened/purchased | **DONE** | AC9 + P2-6 |
| U6 unknown offered; estimate vs known shown | **DONE** | AC3/AC11 + P2-5 |
| U7 edit sheet | **DONE** | AC10 + P1-2/P1-3 |
| U8 storage move | **DONE** | AC10 (MOVE composed in same commit) |
| U12 UNKNOWN distinct; correct expiry | **DONE** | AC11 |
| U13 adoption path + readable authority codes | **DONE** | AC12/AC13 |
| U14 reconciliation accept/dismiss | **DONE** | R11 |

## Security / privacy sanity (T13-relevant regressions)

- Raw OCR evidence is exposed only through the household-scoped scan DTO; foreign
  scans/lots → 404 with no existence disclosure.
- Route ownership: receipt review and lot detail refuse mismatched resources
  client-side and are household-scoped server-side.
- Cached previous-user state: `guardPrivateSession()`/`capturePrivateSession()`
  fences remain on every fetch and on delayed responses (browser case E).
- Secret scan over `src packages scripts tests migrations wrangler.jsonc`
  (key/token/private-key patterns): **0 hits** beyond documented
  `isolated-local-preview-*-no-production-use` placeholders.
- Fixtures use synthetic identities (`planner@example.test`, preview household);
  `/__preview*` controls live only in `scripts/security-preview.mjs`, which is
  not imported by `src/`.
- Synthetic 500 for browser case B returns a fixed body with no private detail.

## New findings

| Severity | Count |
| --- | --- |
| **P0** | **0** |
| **P1** | **0** |
| **Blocking P2** | **0** |
| **P3** (non-blocking) | **3** |

**P3-1 — Legacy (non-adopted) inventory rows present a stored `expiry_date` as UNKNOWN.**
`src/worker/routes/inventory.ts` `mapInventoryRow()` emits no `expiryKind`, and
`presentExpiry({expiryDate, expiryKind: undefined})` returns `tone:'unknown'`
(probe: `{expiryDate:'2026-09-20'} → "Chưa rõ hạn dùng"`). Non-adopted households
therefore see "Chưa rõ hạn" on `/fridge` even when a legacy date exists. Why it is
not blocking: it is the conservative direction (a legacy date has no evidence kind
and pre-T13 it was silently presented as KNOWN "Còn N ngày"); it only affects the
`LEGACY_COMPATIBILITY` path that T13 explicitly left outside Inventory UX V2; the
adopted path is correct. Remediation (future): either surface `legacy_expiry_kind`
/`expiry_kind` from `inventory_items` in `mapInventoryRow` or document the legacy
presentation as intentionally unknown-until-adopted.

**P3-2 — Free-form rename can still remap identity through alias *substring*
matching.** `findCanonicalIngredient()` (pre-T13 behaviour, `packages/domain/src/index.ts`)
treats `clean.includes(alias)` as a match, so a label such as "Sốt cà chua nhà làm"
resolves to `TOMATO` and a PATCH rename to such a label is treated as an *explicit
remap*. P1-2 is fixed as specified (unrecognised names keep identity — the review
counterexample "Thịt gà đã kiểm tra" → `null` → identity preserved); this is a
sensitivity of the shared matcher, not a T13 regression. Remediation (future):
require exact/whole-word alias match for the rename remap path.

**P3-3 — Docs in the freeze tree are stale by design.** `AUTHORITY_MAP.md` and
`TEST_MATRIX.md` at `32ddbb4` still name `7b7bb69` as the audited freeze; the
certification docs head `42e0037` corrects them. Not an application defect.

## Review record / publication

| Field | Value |
| --- | --- |
| Independent review docs commit | see `git log -1 -- docs/ai/inventory-truth/t13/T13_INDEPENDENT_FINAL_REVIEW_2.md` on `hoplite/polyrhen-82141980` |
| Docs-only | YES (this file plus `docs/ai/CURRENT_STATE.md`, `TASK_BOARD.md`, `docs/ai/HANDOFF.md` per AGENTS.md) |
| Parent | `897102b6816c22af2e6a49f29662690e3e3206e0` (certification publication continuation; application tree == freeze) |
| Redefines the application freeze | NO — `T13R_APPLICATION_FREEZE` remains `32ddbb4f2bb636fdcf201e9ca99c4689d3655477` |
| Published to main | NO |

## Safety

Main merged: NO. Takosan merged: NO. Production modified: NO. Production deployed:
NO. Remote D1 touched: NO. PayOS touched: NO. T14 started: NO. Production
reconciliation started: NO. No rebase/cherry-pick/amend/force-push.

## Final verdict

P0 = 0, P1 = 0, Blocking P2 = 0, P3 = 3 (explicitly non-blocking). AC1–AC14 all PASS.
All material roadmap rows DONE. All required gates PASS at the exact freeze in a
clean detached worktree; the tree stayed clean after execution.

**INDEPENDENT T13 FINAL REVIEW #2 — PASS**
**T13 CERTIFIED FOR INTEGRATION PLANNING**
