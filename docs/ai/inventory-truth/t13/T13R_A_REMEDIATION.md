# T13R-A — data integrity & ownership remediation

## STATUS — T13R-A COMPLETE (application checkpoint), 2026-09-13

Repository: `vn-co3/Frigo-dev` (historical `vn-co2/Frigo-dev`, `vn-ca1/Frigo-dev`).
Repository ID: **1368281478** (verified via public metadata this session).
Protected main: `d1b06732f8a80db4e77986df31ff28d9f04641fa`, unchanged.

Rejected application freeze: `7b7bb695ee597a46cf4022a2c534e2fea374be5d` —
**REJECTED BY INDEPENDENT REVIEW — DO NOT RELEASE** (unchanged, still the
comparison baseline). Independent audit commit: `b9735b441d93dfb7d7d409a47292974c8f2f1e52`.

Branch: `hoplite/oropos-eb2d4886--t13r-a-data-integrity-ownership`.
Starting checkpoint (safe-stop docs head): `d589342cbcef9f80487a2c269bcf6133fe0e4415`.

**T13R_A_APPLICATION_CHECKPOINT = `fc0f9c56c53ae7b17f2d1fb4770a6bc231ebc027`**

This is **NOT** a final T13 freeze. T13R-B blockers (Cloudflare fridge confidence
fabrication, inventory conflict/refetch UX, Home estimated-expiry qualifier, NULL
opened-state presentation) remain OPEN and were intentionally not touched.

### Workspace recovery (this session)

The previous session stopped on a branch-name mismatch. Recovery verified before
any edit: repository ID `1368281478` via public API; local HEAD `b9735b4` was a
strict docs-only ancestor of the remote remediation head `d589342` (non-doc diff
empty); `origin/main == d1b06732…`; remote remediation head `== d589342`; dirty
state was only the pre-existing `.hoplite/settings.json` overlay (kept
uncommitted). Switched with `git switch --track origin/hoplite/oropos-eb2d4886--
t13r-a-data-integrity-ownership`; verified branch, HEAD `d589342`, and
`git diff --exit-code 7b7bb69 HEAD -- . ':(exclude)docs'` EMPTY. No reset/rebase/
cherry-pick/force-push. The temporary local branches were left in place.

### Commits (all on the remediation branch, in order)

| SHA | Finding | Summary |
|---|---|---|
| `4d73365` | P1-1 | Async queue persists `ocr_raw_name/quantity/unit/confidence`; missing receipt confidence no longer fails the bind |
| `ac3c35e` | P2-A, P2-B | Migration **0032**; sync+async writers persist `ocr_canonical_id/category/storage`; confirmation persists `reviewed_expiry_date/kind`; DTO + both review pages hydrate the accepted expiry |
| `20bc14e` | P1-2 | Free-form rename preserves canonical `ingredientId` (legacy + native) |
| `43e95ed` | P1-3, P1-4 | Lot-keyed detail with draft owner check; receipt review requires `next.id === receiptScanId` |
| `bb19fc0` | — | Two last-migration assertions updated to 0032 |
| `fc0f9c5` | — | Browser U7/ownership expectations aligned with preserved identity |

### Finding status

| Finding | Status | Fix | Permanent test (RED on `7b7bb69`, GREEN at checkpoint) |
|---|---|---|---|
| P1-1 async evidence | **FIXED** | `src/worker/services/scan-queue.ts`: both fenced INSERTs write `ocr_*`; legacy `confidence` keeps 0.9 filler only when provider reported none; `ocr_confidence` = exact or NULL | `tests/integration/t13r-a-async-evidence.test.ts` (fridge+receipt × confidence 0/0.11/0.9/missing, persisted rows) — 9 RED → 9 GREEN |
| P2-A raw evidence completeness | **FIXED** | `migrations/0032_scan_evidence_completeness.sql` adds `ocr_canonical_id` (FK ingredients), `ocr_category`, `ocr_storage` (CHECK). All four writers bind them. `rawScanEvidence()`/`scanItemDto().rawEvidence` expose them. No backfill; NULL = unknown | `tests/integration/t13r-a-evidence-completeness.test.ts` (sync/async writers, confirmation leaves evidence intact) |
| P2-B expiry round-trip | **FIXED** | 0032 adds `reviewed_expiry_date/kind` + fail-closed triggers (only CONFIRMED carries a kind; KNOWN/ESTIMATED need a date, UNKNOWN none). Confirmation UPDATE persists `lotExpiryFromEvidence()` per accepted line; `scanItemDto()` emits `expiryDate/expiryEstimated/expiryKind` for CONFIRMED lines; `ScanResultPage`/`ReceiptReviewPage` hydrate read-only | same file (KNOWN/ESTIMATED/UNKNOWN × fridge/receipt × legacy/native; rejected gains nothing; pending exposes nothing) + fresh-document remount cases in `t13b-review-roundtrip.test.tsx` + presentation units |
| P1-2 canonical identity | **FIXED** | `src/worker/routes/inventory.ts` PATCH: `ingredientId = canonical?.id || existing.ingredient_id || null` when a name is supplied — a free-form name is a label; only a name resolving to a canonical ingredient remaps | `tests/integration/t13r-a-canonical-identity.test.ts` (legacy+native; review counterexample "Thịt gà đã kiểm tra"; explicit remap; unmapped stays unmapped; idempotent replay; stale CAS) — 6 RED → 14 GREEN; `t13b-metadata.e2e.ts` now asserts `ingredientId` |
| P1-3 lot-bound draft | **FIXED** | `IngredientDetailPage` keyed by route lot id (`LotDetail key={id}`); draft records owner `{routeId,itemId}`; submit refuses owner/route/item mismatch with **no mutation**; PATCH target fixed from verified owner | `tests/unit/t13r-a-lot-draft-ownership.test.tsx` (A→B, B→A, back/forward, slow A after B, route change during refetch, in-flight save across route change, owner attribute) — 5 RED → 7 GREEN; `tests/e2e/t13r-a-ownership.e2e.ts` P1-3 |
| P1-4 receipt ownership | **FIXED** | `ReceiptReviewPage`: `ownsReceipt(receiptScanId, next)` before any state mutation (initial poll and conflict refetch); mismatch → non-reviewable failure + reload; confirm targets `receiptScanId` only; private-session fences kept | `tests/unit/t13r-a-receipt-ownership.test.tsx` (request A/response B, late A after B, A→B→A, conflict refetch mismatch, confirm completion after route switch, private-session reset) — 2 RED → 6 GREEN; `tests/e2e/t13r-a-ownership.e2e.ts` P1-4 (adversarial same-household B DTO for A's GET) |

### Migration state

- Count: **32**. `0001`–`0031` byte-identical to the rejected freeze (verified with
  `cmp` against `7b7bb69` blobs). **0031 unchanged: YES.**
- **0032: `migrations/0032_scan_evidence_completeness.sql`** — additive only:
  5 nullable columns + 2 triggers on `scan_items`. No backfill (a pre-0032
  confirmation's mapping and reviewed basis are genuinely unknown).
- `scripts/migration-smoke.sh`: extended with a populated 0031→0032 upgrade over
  legacy pending/confirmed and T13 pending/confirmed/rejected rows; asserts **zero**
  fabricated evidence, new columns/triggers present, new writer shape accepted,
  `foreign_key_check` empty. `bash scripts/migration-smoke.sh` → `migration-smoke=ok`.
- `scripts/d1-schema-gate.sql/.sh`: requires 0032, the 5 columns and 2 triggers.
- Real local D1 (wrangler, workerd): fresh apply of all 32 → ✅; **legacy path**:
  freeze-tree 0001–0031 applied, 5 representative rows seeded, 0032 applied →
  pre-existing columns byte-identical before/after, all new columns SQL NULL
  (`typeof = null`), `foreign_key_check` 0 rows, schema gate PASS on both databases.

### Authority audit (at checkpoint)

- New 0032 columns are read only by `src/worker/utils/scan-evidence.ts`
  (`rawScanEvidence`, `reviewedScanExpiry`) → `scanItemDto()`; never by any
  inventory writer or T11 reader. **No evidence column becomes stock authority.**
- `INSERT/UPDATE inventory_items|inventory_lots` statement set (file + statement):
  **identical** to the freeze (only line numbers moved). T09 write authority preserved.
- `readInventoryAuthority/readInventoryLot/readInventorySummary/
  fetchHouseholdInventoryFromDb` caller set: **identical** to the freeze. T11 read
  authority preserved.
- **UNKNOWN INVENTORY WRITERS = 0. UNKNOWN CANONICAL READERS = 0.**
- The T09 `scanEvidence` command contract is unchanged (raw name/quantity/unit
  correction subset); `correctionOf()` now narrows to that subset explicitly.

### Exact checks executed at the application checkpoint `fc0f9c5`

| Check | Command | Result |
|---|---|---|
| Lint | `pnpm lint` | PASS (exit 0) |
| Typecheck | `pnpm typecheck` | PASS (exit 0) |
| Build | `pnpm build` | PASS (exit 0) |
| Full Vitest | `pnpm test` | **137 files / 3423 tests, 3423 passed** (exit 0; run at `bb19fc0`, only e2e-spec files changed after) |
| Focused T13R-A | `pnpm vitest run tests/integration/t13r-a-*.test.ts tests/unit/t13r-a-*.test.tsx` | **5 files / 45 passed** |
| Migration smoke | `bash scripts/migration-smoke.sh` | `migration-smoke=ok` |
| Fresh local D1 | `wrangler d1 migrations apply frigo-db --local` | 32 ✅ |
| Legacy 0031→0032 populated upgrade (real D1) | see above | PASS, 0 fabricated rows, FK 0 |
| Schema gate | `pnpm schema:check:local` | PASS (fresh and upgraded DB) |
| Real local D1 suites (workerd) | `pnpm vitest run tests/integration/{t13-receipt-vision,inventory-lot,inventory-observation,inventory-read-authority,inventory-closed-loop}-d1.test.mjs` | **5 files / 92 passed** |
| Browser (Playwright, repository harness) | `CI=1 pnpm exec playwright test` | **42 passed / 0 failed** (14 cases × 3 widths 360/390/430; was 36) |
| Diff hygiene | `git diff --check` | PASS |

Logs (gitignored): `.hoplite/artifacts/t13r-a/{lint,typecheck,build,vitest-full,playwright-full}.log`.

### Deliberately NOT changed (T13R-B)

`packages/ai/src/providers/cloudflare.ts` `vision()` confidence clamp; `InventoryPage`
conflict/refetch UX; `HomePage` estimated-expiry qualifier; `IngredientDetailPage`
`openedAt === null → 'Chưa mở'`. P1-1 touched confidence **persistence** only.

### Safety

Main merged: NO. Production repo modified: NO. Production deployed: NO.
Remote D1 touched: NO. PayOS touched: NO. T14 started: NO.
Repository reconciliation started: NO. Final T13 freeze created: **NO**.

### Publication

Docs head `111171d…` (checkpoint `fc0f9c5` + docs) published and fetch-verified on
`hoplite/medma-164548ce` (this thread's broker-authorized branch). The remote
remediation branch remains at `d589342` (broker scope); advancing it is a pure
fast-forward. Local remediation branch == remote `hoplite/medma-164548ce` head.

### Exact next step

T13R-B: fix the four deferred blockers only, each red/green, then a new application
freeze and a repeat independent certification. Do not release `7b7bb69` or this
checkpoint.

---

## Historical — SAFE STOP — T13R-A — 2026-09-13T15:50:34Z (superseded above)

Repository: `vn-co2/Frigo-dev`. Repository ID: **1368281478**. Origin/main:
`d1b06732f8a80db4e77986df31ff28d9f04641fa`, unchanged.

Rejected application freeze: `7b7bb695ee597a46cf4022a2c534e2fea374be5d` —
**REJECTED BY INDEPENDENT REVIEW — DO NOT RELEASE**.

Independent audit commit: `b9735b441d93dfb7d7d409a47292974c8f2f1e52` (`b9735b4`),
parent `4fcbc96b5a5d4b3cea2c2ad0bdb5682b1866891a`, documentation only. Published to
review branch `hoplite/oropos-eb2d4886`. Remediation branch
`hoplite/oropos-eb2d4886--t13r-a-data-integrity-ownership` created at the audit
commit with an empty non-doc delta against the rejected freeze. No remediation
code existed at that stop; all six findings were NOT STARTED; 31 migrations, no 0032.
