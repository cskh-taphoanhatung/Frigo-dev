# T13R final certification — exact application freeze after T13R-A + T13R-B

**T13 REMEDIATION CERTIFIED — READY FOR INDEPENDENT FINAL REVIEW #2.**
Date: 2026-09-14. Local technical certification only. This is **not** independent
review approval, a main merge, a deployment, or production evidence. The only
authorized next step is **INDEPENDENT T13 FINAL REVIEW #2** of the exact freeze.

## Identity

| Field | Verified value |
| --- | --- |
| Repository | `vn-blo/Frigo-dev` (provider owner renamed from `vn-co3`; historical `vn-co2`, `vn-ca1`) |
| Repository ID | **1368281478** (public API `id`, verified this session) |
| Protected main | `d1b06732f8a80db4e77986df31ff28d9f04641fa` — unchanged |
| Rejected old freeze | `7b7bb695ee597a46cf4022a2c534e2fea374be5d` — **DO NOT RELEASE**, comparison baseline |
| T13R-A application checkpoint | `fc0f9c56c53ae7b17f2d1fb4770a6bc231ebc027` |
| P2-1 fix | `4d587eb0047fc6289307f96ffa4fd5357421c541` |
| Original T13R-B candidate | `7e68e3b358f73786cc02eaa7db24537df855fba5` |
| Starting docs head (`hoplite/medma-164548ce`) | `83248df4f97d2110527a69e92a3ebe162aa71492` |
| Certification branch (this thread's broker-authorized branch) | `hoplite/delos-f0bb1d04` |
| **T13R_APPLICATION_FREEZE** | **`32ddbb4f2bb636fdcf201e9ca99c4689d3655477`** |
| T13R_DOCS_HEAD | recorded by the parent handoff after the docs commit exists (a document cannot contain its own hash) |

### Why the freeze is `32ddbb4`, not `7e68e3b`

`7e68e3b → 83248df` is documentation-only (explicit application-path diff over
`src packages tests scripts migrations playwright.config.ts package.json
pnpm-lock.yaml wrangler.jsonc` is EMPTY; the four changed paths are
`TASK_BOARD.md`, `docs/ai/CURRENT_STATE.md`, `docs/ai/HANDOFF.md`,
`docs/ai/inventory-truth/t13/T13R_B_REMEDIATION.md`). Certification then required
two **test/fixture-only** changes, so per the task rule the last non-doc SHA is the
freeze:

| SHA | Change | Why |
| --- | --- | --- |
| `bd2f5f3badea72454c951e0ffa268cdbce51b030` | `scripts/planner-preview-fixtures.mjs`, `tests/e2e/t13r-b-presentation.e2e.ts` | The T13R-B openedAt fixture seeded a `FRESH_MILK` 'Sữa tươi' row; fridge confirmation groups a reviewed line into an existing lot by ingredient, so browser case C `CORRECT`ed that row instead of creating a third `SCAN` lot (**3 failed / 51 passed** on the first full serial run). The fixture now seeds a cheese row with no matching review line. |
| `32ddbb4f2bb636fdcf201e9ca99c4689d3655477` | new `tests/e2e/t13r-a-expiry-reopen.e2e.ts` | The certification packet requires browser coverage of the **explicit expiry reopen** (review P2-3 / T13R-A P2-B). The permanent proof was jsdom-only (`t13b-review-roundtrip` fresh-document remount); the browser matrix asserted only the stock lot. RED at `7b7bb69` (DTO has no `expiryKind`; reopened fridge date input empty; reopened receipt date input not rendered), GREEN 6/6 here. |

`git diff 7e68e3b 32ddbb4 -- src packages migrations wrangler.jsonc package.json
pnpm-lock.yaml playwright.config.ts` is **EMPTY**: the application source, schema,
dependencies and harness configuration of the freeze are byte-identical to the
T13R-B candidate; only a synthetic fixture and two e2e specs differ.

## Boundary and lineage checks

- `origin/hoplite/medma-164548ce == 83248df…` PASS; `origin/main == d1b0673…` PASS.
- `7e68e3b` ancestor of `83248df`: PASS. `83248df` ancestor of `bd2f5f3` and `32ddbb4`: PASS.
- `fc0f9c5` ancestor of freeze: PASS. `4d587eb` and `7e68e3b` ancestors of freeze: PASS.
- `git status --short` in the development worktree: only the pre-existing
  `.hoplite/settings.json` platform overlay (never staged, never committed).

## Migration lock

| Check | Result |
| --- | --- |
| Count | **32**; `migrations/0033*` **NONE** |
| `0031_scan_evidence_retention.sql` blob | `c580d30b589ace1102cdfda7e61bfbacc57c4253` at freeze == `fc0f9c5` == `7b7bb69` — **unchanged** |
| `0032_scan_evidence_completeness.sql` blob | `48f26f7cca8e6aa91fdffd9e68a5f5028e4ccffe` at freeze == `fc0f9c5` — **unchanged** |
| `git diff --name-only fc0f9c5 <freeze> -- migrations` | EMPTY — T13R-B introduced **no** migration change |
| `pnpm check:migrations` (sqlite3 smoke incl. pre-0031 and 0031→0032 populated upgrades) | `migration-smoke=ok` |
| Fresh apply, real local D1 (`wrangler d1 migrations apply --local`, clean state) | 32 ✅, `d1_migrations` n=32, last `0032_scan_evidence_completeness.sql`, `PRAGMA foreign_key_check` = [] |
| `pnpm schema:check:local` | PASS on the fresh DB and on the legacy-upgraded DB |
| Legacy populated replay, real local D1 | 0001–0030 → seeded legacy pending/confirmed lines → 0031 → seeded T13 pending/confirmed/rejected lines → 0032: all ✅; n=32; FK []; every pre-existing `scan_items` column byte-identical before/after 0032; all five new 0032 columns SQL NULL on every populated row (**0 fabricated rows**) |

## Focused remediation regressions (all GREEN, pre-freeze and detached)

| Finding | Permanent proof at the freeze | Result |
| --- | --- | --- |
| P1-1 async scan evidence | `tests/integration/t13r-a-async-evidence.test.ts` (9: fridge/receipt × confidence 0/0.11/0.9/missing; missing receipt confidence is valid, not a bind failure) | PASS |
| P1-2 canonical identity | `tests/integration/t13r-a-canonical-identity.test.ts` (14); `tests/e2e/t13b-metadata.e2e.ts` asserts `ingredientId` preserved | PASS |
| P1-3 lot-bound draft | `tests/unit/t13r-a-lot-draft-ownership.test.tsx` (7); browser `t13r-a-ownership.e2e.ts` P1-3 (chicken draft cannot save into tofu) | PASS |
| P1-4 receipt ownership | `tests/unit/t13r-a-receipt-ownership.test.tsx` (6); browser `t13r-a-ownership.e2e.ts` P1-4 (adversarial B DTO for A's GET is never rendered or confirmed) | PASS |
| P2-A raw evidence completeness | `tests/integration/t13r-a-evidence-completeness.test.ts` (9, sync+async writers, confirmation leaves evidence intact) | PASS |
| P2-B / review P2-3 confirmed expiry round-trip | same file + `t13b-review-roundtrip.test.tsx` fresh-document remount (receipt+fridge) + **new browser `t13r-a-expiry-reopen.e2e.ts`** (fridge+receipt, read-only reopened date, explicit "confirmed unknown", no mutation on reopen) | PASS |
| P2-1 Cloudflare confidence | `tests/unit/t13-receipt-vision-truth.test.ts`: `cloudflareVision` matrix undefined→absent, null→absent, 0→0, 0.11→0.11, 0.5→0.5, 0.6→0.6, 0.9→0.9, 1→1, numeric string 0.11→0.11; invalid values → absent; no `Math.max(0.5, …)`/`|| 0.9` remains in `vision()` (source-verified) | PASS |
| P2-4 conflict/refetch truth | `tests/unit/t13r-b-inventory-conflict.test.tsx` (4): 409 CONFLICT → one PATCH, specific copy, authoritative reload 2→7; failed reload keeps stale row honestly flagged + explicit reload; IDEMPOTENCY_CONFLICT delete reloads without second DELETE; UNIT_MISMATCH and generic 500 safe copy, no refetch claim, no automatic retry. `t13b-inventory-detail.test.tsx` conflict/500/UNIT_MISMATCH cases; `t13-inventory-ux.test.tsx` "never claims latest state loaded inside the domain message" / "appends the refresh claim only when the reload succeeded". Browser `t13r-b-presentation` A (list conflict, `data-refetch-state=ok`, 7 replaces 2) and B (failed refetch → `data-refetch-state=failed`, "Chưa tải lại được", explicit reload recovers, exactly one PATCH); `t13b-browser` G | PASS |
| P2-5 estimated expiry qualifier | `t13-inventory-ux.test.tsx` presenter (UNKNOWN distinct, ESTIMATED labelled, KNOWN truthful, missing date stays unknown, expired estimate vs fact); `frontend-ui-integration.test.tsx` Home chips; browser `t13r-b-presentation` C (Home ESTIMATED chip qualified, no unqualified countdown; UNKNOWN 'Chưa rõ hạn dùng') | PASS |
| P2-6 unknown opening state | `t13b-inventory-detail.test.tsx` "NULL openedAt → no information, never unopened" and "recorded instant → opening date"; browser `t13r-b-presentation` D/E (`lot-opened` = 'Chưa có thông tin' for NULL, 'Đã mở 2026-09-11' for the recorded instant; zero 'Chưa mở') | PASS |
| IngredientRow `/fridge` ReferenceError | `IngredientRow.tsx` destructures `id`; `t13r-b-inventory-conflict.test.tsx` renders the real `InventoryPage` rows; browser `t13r-b-presentation` A renders `/fridge` rows by `data-item-id` under the harness's "no uncaught browser errors" fixture | PASS |

Ownership matrix: lot A draft cannot mutate B (P1-3 unit + browser); receipt A
cannot render/confirm B (P1-4 unit + browser); route/session fencing preserved
(`t13b-ownership` D/E/H, 26 hardening cases). Confidence matrix: no floor/default
fabrication (P2-1). Conflict matrix: specific safe message, authoritative refetch,
successful refetch replaces stale state, failed refetch never claims latest state,
no automatic mutation retry, UNIT_MISMATCH safe, generic 500 sanitized (P2-4).
Presentation matrix: UNKNOWN/KNOWN truthful, ESTIMATED visibly qualified,
`openedAt` null → not recorded, `openedAt` date → truthful date (P2-5/P2-6).

## Pre-freeze certification (development worktree, same tree as the freeze)

Run at `bd2f5f3` (application/fixture tree) and re-run for lint/typecheck/diff/
browser at `32ddbb4` after the e2e-only commit. `bd2f5f3 → 32ddbb4` adds one e2e
spec; Vitest does not collect `tests/e2e/*.e2e.ts`, so the Vitest totals are the
same tree.

| Gate | Result |
| --- | --- |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | PASS / PASS / PASS |
| Full Vitest `pnpm test` | **3471 passed / 138 files** |
| Focused T13R-A | **45 / 5 files** |
| Focused T13R-B (7 files) | **171 / 7 files** |
| T08 / T09 / T10 / T11 / T12 / T13 | **130/2 · 1259/17 · 98/6 · 39/2 · 22/3 · 320/12** |
| Real local workerd/D1 `*-d1.test.mjs` | **92 / 5 files** |
| `pnpm check:migrations`; fresh 32 apply; legacy 0031→0032 populated upgrade; schema gate | PASS / 32 ✅ / PASS (0 fabricated, FK 0) / PASS |
| Browser (serial, after all Vitest) at `bd2f5f3` | **54 passed / 0 failed** (18 cases × 360/390/430) |
| Browser (serial, after all Vitest) at `32ddbb4` | **60 passed / 0 failed** (20 cases × 360/390/430) |
| `git diff --check` | PASS |

Failure retained, not hidden: the first full serial browser run at `7e68e3b`'s
tree was **3 failed / 51 passed** (case C at all three widths) caused by the
fixture collision described above; fixed by `bd2f5f3` with no application change.

## Clean detached exact-freeze certification (`/tmp/t13r-freeze` @ `32ddbb4`)

Fresh `git worktree add --detach`, `pnpm install --frozen-lockfile`, Node 24.19.0,
pnpm 10.26.0, Playwright 1.63.0 / Chromium 1243, `CI=1`. Vitest/build/D1/migration
work ran first; the browser suite ran **last and alone**.

| Gate | Result |
| --- | --- |
| install / lint / typecheck / build | 0 / 0 / 0 / 0 |
| Full Vitest | **3471 passed / 138 files** (identical to pre-freeze) |
| Migration smoke | ok |
| Fresh real local D1 apply / schema gate / count / FK | 32 ✅ / PASS / n=32 last=0032 / [] |
| Migration count 32, 0033 absent, 0031/0032 blobs unchanged | PASS |
| Legacy populated replay (0001–0030 → seed → 0031 → seed → 0032) | all ✅; pre-existing columns IDENTICAL; new-column non-NULL rows **0**; FK []; schema gate PASS |
| Focused T08 / T09 / T10 / T11 / T12 / T13 | **130/2 · 1259/17 · 98/6 · 39/2 · 22/3 · 320/12** |
| Focused T13R-A / T13R-B / real D1 | **45/5 · 171/7 · 92/5** |
| Writer audit vs `fc0f9c5` (`INSERT/UPDATE/DELETE inventory_lots\|inventory_items\|inventory_events` over `packages src scripts`) | `src`+`packages` statement set **identical**; only delta = two synthetic seed INSERTs in `scripts/planner-preview-fixtures.mjs` (preview fixture, classified synthetic bootstrap) |
| Reader audit vs `fc0f9c5` and `7b7bb69` (`readInventoryAuthorityMode\|runLegacyInventoryBatch\|fetchHouseholdInventoryFromDb\|MEAL_PLANNER_ENABLED\|readInventoryLot\|readInventorySummary\|loadMealPlanningSnapshot`) | **identical** call sets (69 lines; line numbers only shift) |
| UNKNOWN inventory writers / UNKNOWN canonical readers | **0 / 0** |
| T09 mutation authority / T11 canonical read authority | preserved / preserved (`SAFE_DEFERRED` meal-planner boundary retained, see AUTHORITY_MAP) |
| `git diff --check` | PASS |
| **Browser, full serial, last** | **60 passed / 0 failed** — 20 cases × 360/390/430 |
| `git status --porcelain` after everything | **EMPTY** |

Browser discovery at the freeze (20 cases, each at three widths): `t13b-browser`
A receipt corrections, A missing facts, C fridge, F UNKNOWN→KNOWN/MOVE, G stale
conflict; `t13b-metadata` U7; `t13b-ownership` D, E, H; `t13b-purchase-adoption` B,
I; `t13b-reconciliation` R11/U14; `t13r-a-ownership` P1-3, P1-4;
`t13r-a-expiry-reopen` fridge, receipt; `t13r-b-presentation` A list conflict
refetch, B failed refetch, C Home ESTIMATED, D/E openedAt null/date. Required
coverage — receipt ownership, lot draft ownership, explicit expiry reopen, stale
conflict successful refetch, failed conflict refetch, Home ESTIMATED qualifier,
openedAt null truth, openedAt known date, `/fridge` IngredientRow crash — is all
present.

Baseline consistency: full Vitest 3471/138 identical pre-freeze and detached;
browser discovery identical (60 = 20 × 3); migration count 32 identical;
authority results identical.

## Original blocker disposition

| Finding | Disposition |
| --- | --- |
| P1-1 / P1-2 / P1-3 / P1-4 | CLOSED (T13R-A, re-verified at freeze) |
| P2-1 / P2-4 / P2-5 / P2-6 | CLOSED (T13R-B, re-verified at freeze) |
| P2-2 (raw storage/category/mapping evidence) | CLOSED by T13R-A P2-A (0032 `ocr_canonical_id/category/storage`) |
| P2-3 (confirmed expiry disappears on remount) | CLOSED by T13R-A P2-B (0032 `reviewed_expiry_date/kind`); now also browser-proven |
| IngredientRow `/fridge` ReferenceError | CLOSED (`4d587eb`…`7e68e3b` tree; browser-proven) |
| **P0 / P1 / release-blocking P2** | **0 / 0 / 0** |

P3 (non-blocking) status: the schema-gate wording now reads 0001–0017 and
0019–0032 and the replay test title says 32 (group 2 resolved); the source-writing
`generate-migration.test.ts` and harness limits (groups 1 and 3) remain as documented
operational constraints — browser must run after Vitest, never concurrently.

## Original AC1–AC14 (numbering from `release/T13_PROPOSED_SCOPE.md` only)

| AC | Result | Basis at the freeze |
| --- | --- | --- |
| AC1 | PASS | RECEIPT provenance/source ID; IT/D1; browser A/B |
| AC2 | PASS | exact/NULL purchase facts; IT/D1; browser A missing, B supplied |
| AC3 | PASS | supplied/inferred/absent kind mapper; browser A/F/U7 |
| AC4 | PASS | async confidence persisted exactly (P1-1); Cloudflare fridge `vision()` no longer fabricates (P2-1); browser A/C unknown/0%/11%/90% |
| AC5 | PASS | five edits + explicit reject; RT/IT; browser A/C/H |
| AC6 | PASS | async raw evidence persisted (P1-1); raw mapping complete (P2-A/0032); raw→confirmed in T09 metadata; browser A/C |
| AC7 | PASS | same-batch observation + T09; IT/D1 rollback |
| AC8 | PASS | scoped routes, foreign identity = absence; IT/D1 |
| AC9 | PASS | provenance/expiry kind/opened/purchased/lot identity; NULL openedAt now 'Chưa có thông tin' (P2-6); browser D/E |
| AC10 | PASS | T09 CORRECT/MOVE; identity preserved (P1-2); lot-bound draft (P1-3); specific conflict + truthful refetch incl. failed refetch (P2-4); browser G, U7, R-B A/B |
| AC11 | PASS | UNKNOWN distinct; confirmed expiry survives remount (P2-B, browser-proven); Home estimate qualified (P2-5); browser F, C, reopen |
| AC12 | PASS | `ApiError.code` → specific copy on list/detail/review; no raw JSON; real stale conflict reloads authority (P2-4); browser G, R-B A/B, U7 422 |
| AC13 | PASS | documented adoption CLI, 26 operator cases, browser I |
| AC14 | PASS | full 3471 ≥ 3092+new, real D1 92 ≥ 70, lint/typecheck/build, migration smoke (32), local schema gate, `git diff --check` — pre-freeze and exact detached |

## Roadmap closure

R3 DONE · R4 DONE · R5 DONE (async confidence + Cloudflare fabrication closed) ·
R6 DONE · R7 DONE (receipt ownership + confirmed expiry truth closed) · R8 DONE
(async + complete raw evidence) · R11 DONE · U1 DONE · U4 DONE (unknown opening
state truthful) · U6 DONE · U7 DONE (identity + lot binding) · U8 DONE · U12 DONE
(confirmed expiry + estimate qualifier) · U13 DONE (conflict recovery understandable
and truthful) · U14 DONE.

## Hosted CI

**NO HOSTED GITHUB CI STATUS FOR T13R_APPLICATION_FREEZE.** For exact
`32ddbb4f2bb636fdcf201e9ca99c4689d3655477`: workflow runs = 0, check runs = 0,
legacy status contexts = 0 (aggregate `pending` with zero contexts). The
repository's `ci.yml` triggers on `main`/PR only; this branch has no PR. This is
evidence state, not a certification failure; the project's acceptance contract for
T13 is the local clean-detached gate set above.

## Evidence locations (gitignored / sandbox-local)

- Development worktree logs: `.hoplite/artifacts/t13r-cert/` (7e68e3b tree run:
  `vitest-full.log` 3471/138, `playwright-full.log` 3 failed/51 passed, authority
  `writers-*/readers-*`), `prefreeze-bd2f5f3/` (all gates, browser 54/54),
  `prefreeze-32ddbb4/` (lint/typecheck/diff/browser).
- Detached exact-freeze logs: `/tmp/t13r-detached-logs/` (`gates.txt`,
  `vitest-full.log`, `focused-*.log`, `d1-fresh-apply.log`, `legacy-*.json`,
  `writers-*/readers-*`, `playwright-full.log`, `porcelain.txt`) and the earlier
  `bd2f5f3` detached run in `/tmp/t13r-detached-logs-bd2f5f3/` (54/54, 3471/138).
- Drivers: `/tmp/t13r-tools/detached-cert-v2.sh`, `/tmp/t13r-tools/focused-suites.sh`.

## Safety

Main merged: NO. Production modified: NO. Production deployed: NO. Remote D1: NO.
PayOS: NO. T14: NO. Frigo-dev ↔ production reconciliation: NO. `.hoplite/settings.json`
overlay: uncommitted.

## Stop boundary

The only next step is **INDEPENDENT T13 FINAL REVIEW #2** of exact freeze
`32ddbb4f2bb636fdcf201e9ca99c4689d3655477` and its docs-only head. Preserve
`7b7bb69` and its failed-review evidence; do not release it.
