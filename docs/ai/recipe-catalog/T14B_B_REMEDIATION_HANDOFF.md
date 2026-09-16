# T14B-B review remediation — handoff (2026-09-16)

**Status: FINAL REMEDIATION (continuation of the safe checkpoint `d9130b69…`).** Sections 0
and 10 record the continuation; §1–§9 preserve the safe-stop checkpoint record verbatim for
history. The accepted baseline is `docs/ai/recipe-catalog/T14B_B_D1_PARITY_SHADOW.md` (ADR-024).

## 0. Final remediation record (continuation session)

```text
repo=vn-clo/Frigo-dev
repository_id=1368281478
branch=hoplite/poteidaia-c88481ca-integrate-t14b-a-current-main-t14-canonical-merge-receipt-t14b-b-d1-recipe-parity-shadow
start_main=c1c1c14a2a7dccc883f1030d0dee7043754fb4a9
safe_checkpoint=d9130b69f3df27f4f071153c9824d66ca3750001
LAST_KNOWN_SAFE_CHECKPOINT_CI=run 35053041994 / check 104657335468 / validate=SUCCESS (historical once new commits exist)
continuation_commit_A=19b144a543e1d492d6540e0701eb255f3daae0c7  test(recipes): prove order-sensitive D1 behavioral parity on actual catalog output
continuation_commit_B=8c8ea94abff06744fda164415f3ab7a6c21ea73c  docs(t14b-b): finalize ordering remediation evidence (hosted validate SUCCESS run 35065056229 / check 104693398900)
continuation_commit_C=a68910ad6a23ecf623a360c6e8c87a029d3d5c03  chore(migrations): gate and smoke-check 0034 runtime order and ingredient ordinals
final_candidate=branch head after commit C + this docs receipt; exact SHA and hosted CI run recorded in the PR #14 body
```

| Finding | Final status | Evidence |
| --- | --- | --- |
| P1 — runtime order | **VERIFIED_LOCAL (implementation + behaviour)** | Checkpoint foundation untouched (`runtime_order` persisted/UNIQUE/0..70, hydrator orders by it, `StaticRuntimeRecipeCatalog` preserves input order). `recipe-d1-runtime-parity` now consumes `D1RuntimeRecipeCatalog.listRuntimeRecipes()` **as emitted** — no `byId` map, no `ALL_RECIPES.map`, no sort. First assertion `toStrictEqual(staticRecipes)`; IDs equal `ALL_RECIPES` IDs unsorted. |
| P1 — behavioural parity | **VERIFIED_LOCAL** | Recommendation (6 fixtures × 5 contexts), tie-sensitive ranking (≥5 real tie groups; `25\|0\|10` = `vn-xao-01, vn-sang-02, gl-03, gl-12`), planner generate/regenerate/eligibility/candidate, planner equal-score tie fixture (29 recipes at score 48; first pick `vn-canh-01`), `getSwapAlternatives` with 70 (>5) valid alternatives + 8-recipe controlled fixture, executed swap. Every fixture has a reversed-catalog negative control that changes the result. Mutation check: ID-sorting hydrator output fails 8/11 tests. |
| P2 — ingredient order | **VERIFIED_LOCAL (unchanged)** | `recipe_runtime_ingredient_order` 385 rows, no orphan/missing mapping, positions exactly `0..N-1` per recipe (asserted in the new suite), 12-line synthetic round-trip 1..12, fail-closed when unmapped. |
| P3 — migration hash manifest | **VERIFIED_LOCAL (unchanged)** | 33/33 fixed SHA-256 pinned from `c1c1c14a…`; working-tree hashes compared against the manifest; 0034 not pinned. |
| P3 — category wording | **DONE** | ADR-024, `T14B_B_D1_PARITY_SHADOW.md`, state docs and PR #14 body now state: `category` = typed **open** field with non-empty-string validation; `region` = **closed** vocabulary (`bac\|trung\|nam\|toan_quoc`). Schema unchanged. |
| Shadow health | **VERIFIED_LOCAL** | `runRecipeCatalogShadow` on the real ledger → `level=info`, all counts 0; global-first D1 ordinals → `level=warn`, `catalog_order_drift_count=71`, 10-item `order_drift_sample`. |

Verification of the final candidate is recorded in §10 (appended after the gates ran).

---

# Historical: SAFE-STOP checkpoint record (preserved verbatim)

## 1. Identity

```text
repo=vn-clo/Frigo-dev
repository_id=1368281478
branch=hoplite/poteidaia-c88481ca-integrate-t14b-a-current-main-t14-canonical-merge-receipt-t14b-b-d1-recipe-parity-shadow
origin_main=c1c1c14a2a7dccc883f1030d0dee7043754fb4a9        (verified unchanged; PR contains it, behind=0)
checkpoint_base_head=f8813d50f9edd08b19e0f104817640781dca5f57  (last published/remotely green head)
final_checkpoint_head=32593686053857945f4cfc1f09eeba2d543ab72c
PR=14 (open, base=main, mergeable)
```

## 2. Review findings and their exact status

| Finding | Status at safe stop | Evidence |
| --- | --- | --- |
| P1 — canonical/runtime recipe ordering parity | **IMPLEMENTED_NOT_VERIFIED (core VERIFIED_LOCAL; behavioral-test rework NOT_STARTED)** | `recipe_runtime_fields.runtime_order` persisted (renderer-derived, UNIQUE index), reader reads it, hydrator orders by it, `StaticRuntimeRecipeCatalog` preserves input order, `compareRuntimeCatalogs` reports `orderDrift`. Direct list-parity + order-drift tests pass (`recipe-d1-parity` 12/12). **Remaining:** `tests/integration/recipe-d1-runtime-parity.test.ts` still contains the forbidden workaround (`byId` map re-imposing `ALL_RECIPES` order, lines ~57–67) and must be rewritten to consume `D1RuntimeRecipeCatalog.listRuntimeRecipes()` directly, with tie-sensitive fixtures and the >5-alternatives swap-order regression (packet §14–§17). |
| P2 — explicit ingredient position (not lexical IDs) | **VERIFIED_LOCAL (implementation + tests)** | `recipe_runtime_ingredient_order` table (PK `recipe_ingredient_id`, UNIQUE `(recipe_id, position)`, 0-based), reader LEFT JOINs it (still 5 bulk SELECTs), hydrator fails closed on missing/duplicate/invalid positions, synthetic 12-line recipe (`_ing_1.._ing_12`) round-trips 1..12 and fails closed when unmapped. All in the passing focused suite. |
| P3 — historical migration hash test self-comparing | **VERIFIED_LOCAL** | `tests/fixtures/migration-sha256.json` pins 33/33 SHA-256 values captured from canonical start main `c1c1c14a…` after verifying every blob byte-identical (`git show c1c1c14a:<file>`). Test hashes working-tree files against the fixed manifest; 0034 deliberately not pinned. Extend by appending only. |
| P3 — category vocabulary wording | **NOT_STARTED** | Renderer comment/DDL comment in the checkpoint says "typed open category, closed region vocabulary", but `docs/ai/DECISIONS.md` (ADR-024, line ~18) and the PR #14 body still say "(closed CHECK vocabulary)" for category+region. Schema truth: `category` = typed non-empty string (open); `region` = closed (`bac|trung|nam|toan_quoc`). Fix docs/PR wording only; do NOT change the schema. |

## 3. Work completed in this remediation session (all in the checkpoint commit)

- `packages/recipes/src/seed-render.ts` — renderer emits `runtime_order` (0-based, from array
  position) and the `recipe_runtime_ingredient_order` table; 0034 comments updated.
- `migrations/0034_global_recipe_catalog_parity.sql` — re-rendered; committed SQL == rendered
  output byte-for-byte (`pnpm recipe:seed:check` green for both 0006 and 0034).
- `packages/db/src/recipe-content.ts` — lines SELECT now carries `position` (LEFT JOIN), fields
  SELECT carries `runtime_order`; still exactly 5 bulk SELECTs, ordered by position/runtime_order.
- `packages/recipes/src/catalog-drift.ts` — snapshot row types extended (`runtimeOrder`,
  `position`); requirement comparison strips the new fields.
- `packages/recipes/src/runtime-hydration.ts` — output ordered by persisted `runtime_order`;
  ingredients ordered by persisted `position`; new fail-closed codes
  `missing_runtime_order|invalid_runtime_order|duplicate_runtime_order|missing_ingredient_position|invalid_ingredient_position`.
- `packages/recipes/src/runtime-catalog.ts` — `StaticRuntimeRecipeCatalog` preserves input order
  (no sorting); shadow diagnostics gain `orderDriftCount`/`orderDrift`
  (`{id, staticPosition, d1Position}`), healthy requires order drift 0; order compared over the
  shared-ID set to avoid cascades.
- `src/worker/services/recipe-catalog-shadow.ts` — log payload gains
  `catalog_order_drift_count` and bounded `order_drift_sample`; throttle untouched.
- `tests/fixtures/migration-sha256.json` — new manifest (see P3 above).
- `tests/integration/recipe-d1-parity.test.ts` — manifest test, runtime_order/position
  invariants incl. SQL-level CHECKs, ordinal fail-closed cases, 12-line synthetic round-trip,
  order-drift negative controls (global-first ordinals → 71 drifts; reversed static → 70).

## 4. NOT finished (next agent's job, in order)

1. **Rewrite `tests/integration/recipe-d1-runtime-parity.test.ts`** to remove the
   `byId`/`ALL_RECIPES.map` workaround; derive `hydrated = await new
   D1RuntimeRecipeCatalog(...).listRuntimeRecipes()` and use that list directly for
   `rankRecipes`, `evaluateRecipeMatch`, `isRecipeEligible`, `evaluateWeeklyCandidate`,
   `generateWeeklyMealPlan`, regenerate, `getSwapAlternatives`, `swapMealInPlan` and the
   snapshot test. Add: one deliberate tie fixture (equal score/match%/cookTime where practical)
   and a swap test with >5 alternatives asserting exact IDs/order/matchPercent/badges. Keep the
   existing cooking and shadow-mode tests; they use `hydrateRuntimeRecipes` only for single
   recipes/diagnostics, which the packet allows (§39).
2. **Correct category wording**: ADR-024 in `docs/ai/DECISIONS.md`, `T14B_B_D1_PARITY_SHADOW.md`
   if needed, and the PR #14 description → "typed open category; closed region vocabulary".
3. Re-run focused suites + full gates (packet §42), push, obtain fresh exact-head hosted CI
   (packet §43), re-check main (§44), update docs, then request review. Do NOT merge.

## 5. Verification actually executed on this checkpoint's tree

| Check | Result |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm recipe:seed:check` | exit 0 (0006 ok, 0034 ok) |
| `pnpm check:migrations` | exit 0, `migration-smoke=ok` |
| `pnpm build` | exit 0 |
| `pnpm test` (full) | exit 0 — **157 files / 3699 tests** |
| Focused: recipe-d1-parity + recipe-d1-runtime-parity + recipe-catalog-authority | 3 files / 23 tests pass |
| `git diff --check` | exit 0 |
| Historical hashes vs pinned manifest + start-main baseline | 0 drift (33/33) |
| Hosted CI on the new checkpoint SHA | **NOT_RUN** (must run after push) |

No failures observed in the above. The known limitation is not a failure: behavioral parity
tests still pass while hiding order via the workaround, which is exactly why the P1 test rework
remains mandatory.

## 6. Invariants that still hold (verified this session)

- `ALL_RECIPES` remains the only user-visible authority; no `d1` mode; production gate rejects
  non-static `RECIPE_CATALOG_MODE`; throttle (60 s default, 1 s min, 24 h max) unchanged.
- Migrations 0001–0033 byte-identical; 0034 is the only changed migration and is unmerged;
  no 0035 exists; renderer owns all order data (`recipe:seed:check` proves render==committed).
- Fresh replay and populated-0033 upgrade re-verified by the passing suites; 0034 re-run no-op.
- PR #9 files, `public/`, `packages/ai|domain`, `src/web`, Inventory Truth code, Qwen, PayOS:
  untouched by this remediation session. `inventory-truth.test.ts` remains decoupled from the
  ledger tip (no hard-coded total).

## 7. Do-not-do list for the next agent

No T14C/T14D/T14E, no merge of PR #14 or PR #4, no authority switch or `d1` mode, no
production D1/deploy/secret/DNS changes, no edits to 0001–0033, no test-side reordering, no
force push/history rewrite, no committing `.hoplite/settings.json` (it is the pre-existing
sandbox setting, preserved uncommitted in the working tree and in the local stash).

## 8. Next-agent start procedure

```sh
git fetch --all --prune
git checkout hoplite/poteidaia-c88481ca-integrate-t14b-a-current-main-t14-canonical-merge-receipt-t14b-b-d1-recipe-parity-shadow
git pull --ff-only
git status --short && git rev-parse HEAD && git rev-parse origin/main   # expect main == c1c1c14a…
pnpm install --frozen-lockfile
npx vitest run tests/integration/recipe-d1-parity.test.ts   # confirm 12/12 baseline before edits
```

Then resume at §4 item 1. Read the remediation packet sections §7–§21 (order) and §39–§42
(tests/gates) before editing. Do not start T14C/D/E.

## 9. Checkpoint record

```text
checkpoint_created=YES
checkpoint_message=wip(t14b-b): checkpoint ordering remediation (runtime_order + ingredient positions + hash manifest)
checkpoint_sha=32593686053857945f4cfc1f09eeba2d543ab72c
remote_head_after_push=<same as checkpoint_sha>
local_remote_match=YES
last_known_green_head=f8813d50f9edd08b19e0f104817640781dca5f57
last_known_green_run=35050720485 (validate=SUCCESS)
current_head_ci_at_stop=PENDING (run 104657229602 started 2026-09-16T03:45:35Z; result must be checked by the next agent — NOT counted as green)
```

## 10. Final-candidate verification (continuation session, executed on the tree of commit A + these docs)

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm recipe:seed:check` | exit 0 — `0006` ok (59), `0034` ok (12 globals + 71 runtime field rows) |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm check:migrations` | exit 0 — `migration-smoke=ok` (fresh 0001→0034, populated-0033 upgrade with FK stub + cooked meal + user + inventory, 0034 re-run no-op) |
| `pnpm build` | exit 0 |
| `pnpm test` (full) | exit 0 — **157 files / 3704 tests** (checkpoint: 157 / 3699; +5 from the rewritten runtime-parity suite) |
| Focused: `recipe-d1-parity` 12 · `recipe-d1-runtime-parity` 11 · `recipe-catalog-authority` 5 · `recipe-catalog-safety` 6 | 4 files / 34 tests pass |
| Mutation check (hydrator temporarily ID-sorting output) | 8/11 `recipe-d1-runtime-parity` tests fail → suite detects the original ordering defect; reverted, tree clean |
| `git diff --check` | clean |
| 0001–0033 vs `c1c1c14a…` | byte-identical (git diff quiet per file); `migration_count=34`, highest `0034`, no 0035 |
| 0034 SHA-256 | `23f356458a294b240e683fec14012bc932a8b7e57ad0c932e4fc184329bada4d` (== committed == rendered) |
| PR #9 / auth / OCR files (`public/_headers`, Scan*/Auth*/ReceiptReview pages, `src/worker/index.ts`, cors/auth/scan tests) | byte-identical to base |
| `src/` changes vs base | only `config/validation.ts`, `routes/recipes.ts` (off-response shadow hook), `services/recipe-catalog-shadow.ts`, `types.ts`; `wrangler.jsonc` has no `RECIPE_CATALOG_MODE` |
| Inventory Truth | no application module changed; `inventory-truth.test.ts` only stops pinning the ledger tip |
| Runtime order proof | static=71, d1=71, first `vn-canh-01 … vn-canh-06 vn-kho-01 … vn-kho-04`, last `gl-03 … gl-12`, `orderDriftCount=0` |
| `.hoplite/settings.json` | pre-existing local modification, left uncommitted (never staged) |
| Hosted CI | `8c8ea94a`: run 35065056229 / check 104693398900 validate=SUCCESS. Final head: recorded in the PR #14 body |
| Release audit (commit C) | `scripts/d1-schema-gate.sql` now requires `recipe_runtime_ingredient_order` + `runtime_order`/`position` columns; `migration-smoke.sh` asserts 0..70 permutation and one ordinal per ingredient line (negative control: wrong count fails). Deploy ordering: operator applies 0034 remotely before the read-only gate passes (`DEPLOYMENT.md`). No env/secret/workflow/wrangler/dependency change |

Sandbox note: `check:migrations` needs `sqlite3`; the repo's committed `.hoplite/settings.json`
setup script installs it. This sandbox had skipped setup, so `apt-get install sqlite3` was run
manually before the gate (no repository change).
