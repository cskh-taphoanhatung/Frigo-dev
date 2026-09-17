# T14E merge receipt — PR #23 merged into canonical main; main certified; production rollout DEFERRED (2026-09-17)

```text
STATUS=T14E_DEVELOPMENT_COMPLETE · T14E_MAIN_CERTIFIED · REAL_CATALOG_GROWTH_NOT_STARTED · PRODUCTION_ROLLOUT_DEFERRED · T14F_NOT_STARTED
This is a repository-development receipt, NOT a production receipt. T14E code is merged and certified on main only.
No 0036, no real recipe, no production D1/R2/Worker mutation, no recipe-authority activation, no media population, no T14F.
```

## Lineage

```text
repository_id=1368281478   repo=frigo-3/Frigo-dev (owner/name has changed historically; the ID is canonical)
PRE_MERGE_MAIN=9ff571995bf5f2a4381c2dfc6de796e6554fd43c
PR=23   branch=hoplite/syrakousai-f7b7c8a0-t14cd-ops-rollout-state-t14e-bulk-recipe-import-factory
PR23_ORIGINAL_HEAD=7b4edcc825b9061d373bd1b271b4a33967ccad76   (independently reviewed: P0=0 P1=1 P2=1 P3=1)
PR23_REMEDIATED_HEAD=ba1a45d43f2f4b85d4f7500eba36fe094a7d3655   (forward commit on top of 7b4edcc8; re-review: P0=0 P1=0 release_blocking_P2=0 P3=0)
ORIGINAL_HEAD_ANCESTOR_OF_REMEDIATED_HEAD=YES (git merge-base --is-ancestor) — remediation was forward-only, no rewrite
PR_BASE=main   PR_BEHIND=0   PR_MERGEABLE=true   PR_REVIEW_THREADS=0   PR_REVIEWS_PENDING=0
MERGE_METHOD=merge (normal merge commit, consistent with #14–#21; no squash/rebase; no force push; no history rewrite)
MERGE_SHA=POST_MERGE_MAIN=f7a5540841db27be31cdab9e0c2010cd92bc3861
MERGE_PARENTS=9ff571995bf5f2a4381c2dfc6de796e6554fd43c ba1a45d43f2f4b85d4f7500eba36fe094a7d3655
MERGED_AT=2026-09-17T04:36:38Z (usehoplite[bot] through the protected-branch PR flow)
PR23_HEAD_IN_MAIN=YES   ORIGINAL_HEAD_IN_MAIN=YES
APPLICATION_TREE_PRESERVED=YES (git diff ba1a45d4 f7a55408 --name-only is empty: 0 files)
MAIN_MOVEMENT_BETWEEN_REVIEW_AND_MERGE=NONE (f7a55408 is the only first-parent commit after 9ff57199)
```

## CI

```text
PR_VALIDATE=run 35179141504 / check 105067327285 / SUCCESS (exact head ba1a45d4; pull_request)
POST_MERGE_VALIDATE=run 35182568280 / job 105077715190 / SUCCESS (exact head f7a55408; push to main;
  ESLint, Typecheck, Vitest Unit Tests, Migration smoke (local SQLite), Build Web & Worker)
INCIDENTAL_AUTO_STAGING=Deploy run 35182789974 (workflow_run) SUCCESS — release + staging jobs SUCCESS, production job SKIPPED.
  Staging only; not a T14E completion criterion and not a production rollout. Exact-SHA receipt step passed (no propagation race this run).
```

## Pre-merge gates (re-verified on the merged commit, fresh `git fetch --all --prune`)

- `origin/main` = `f7a55408…` whose only new commit vs the reviewed base `9ff57199…` is the PR #23 merge itself.
  Nothing else landed between review and merge → the reviewed head is exactly what main contains.
- Diff classes `9ff57199…` → `f7a55408…` (34 files): `packages/recipes/src/import/*` (schema, parse, identity, ingredients,
  normalize, duplicates, sql-render, release-manifest, compiler, types, index, `catalog-release.current.json`),
  `packages/recipes/src/catalog-fingerprint.ts`, `packages/recipes/src/recipe-authority.ts`, `packages/recipes/src/index.ts`,
  `scripts/recipe-import.mjs`, `scripts/recipe-import-output-policy.mjs`, `package.json` (scripts only), tests + fixtures +
  helpers, ADR-027 / design / handoff / state docs.
- Protected paths — diff = 0: `migrations/`, `.github/`, `wrangler.jsonc`, `wrangler.staging.jsonc`, `src/worker/`,
  `src/web/`, `packages/db/`, `packages/domain/`, `packages/ai/`. No Inventory Truth, Qwen, PayOS, auth/OCR, DNS or
  deploy-workflow change. `pnpm-lock.yaml` unchanged.
- Migrations: 35 files, highest `0035_recipe_media_layer.sql`, `0036_exists=NO`, `0001–0035` byte-identical
  (`migration-smoke=ok`, hash set unchanged).
- Real catalog: `ALL_RECIPES` = 71 (rollback baseline). No real recipe added; all import batches in the repo are synthetic
  test fixtures (`tests/fixtures/recipe-import/`, `tests/helpers/recipe-import-fixtures.ts`).

## Release (as merged, unchanged by T14E)

```text
releaseId=rel-1a047444a3632771
legacyBaselineCount=71   expectedRecipeCount=71   approvedImportBatches=0
legacyBaselineFingerprint=expectedRuntimeFingerprint=static fingerprint=
  9ae153e64d34b30d72bb985d4070d8e210201219c0e8f8998ce8f99057fc7c3f
pnpm recipe:import:check → recipe-import-check=ok (releaseId=rel-1a047444a3632771 recipes=71 batches=0)
```

## Review → remediation

```text
initial_review (7b4edcc8): P1_nutrition_evidence · P2_batch_hash_metadata · P3_manifest_error_classification
remediation (ba1a45d4):    PASS — all three closed by forward commit; verified again on f7a55408 (below)
```

## Import factory certification (fresh, exact post-merge main `f7a55408…`)

- **Batch schema / parser:** JSON + JSONL PASS; invalid UTF-8, invalid JSON, non-object rows, duplicate keys, oversized
  records rejected; unknown extensions rejected.
- **Identity:** `imp-` + 16 hex SHA-256(`ns:recordId`), deterministic; physical row order is not authority (reorder ⇒
  byte-identical IDs/order/SQL/manifest); `batchOrder` must be exactly 0..N-1; source/ID/slug collisions (legacy, in-batch,
  cross-batch) fail closed.
- **Ingredient Truth:** exact canonical ID or exact normalized alias only; unresolved ⇒ FAIL, ambiguous ⇒ FAIL with bounded
  candidates; no substring match, no invented ID, no silent creation.
- **Quality gates:** closed units / cuisine / region, contiguous unique steps, `reviewed` required, non-empty batch
  `sourceReference` required; output hydrates losslessly into `RuntimeRecipeSchema` and classifies `complete`.
- **Nutrition provenance (P1):** macros present ⇔ evidence present. Evidence survives parse → normalize →
  `normalized-recipes.json` → `canonicalBatchProjection` → SQL (`nutrition_profiles` `<id>_nutrition_v1`, per serving,
  `source_type`/`source_reference` = declared type/evidence, + `recipe_nutrition` at version 1, plain INSERT). Real SQLite
  replay: `readRecipeContent` sees the profile, `hydrateRuntimeRecipes` = 0 failures, `prepareRankingNutritionRead` returns
  the profile, `D1RecipeAuthority.load()` = `ready`. Renderer throws on macros-without-evidence and evidence≠macros;
  compiler guard `NUTRITION_EVIDENCE_LOST`.
- **Immutable batch hash (P2):** nutrition evidence / license / usageNote / duplicateReview.reason mutations each change
  `batchHash` and `releaseId`; runtime fingerprint unchanged (provenance-independent by design); `schemaVersion` is in the
  projection; row order / whitespace / key order / JSON-vs-JSONL do not change hash, releaseId or `migration.sql`;
  mutated approved batch ⇒ `BATCH_COLLISION`.
- **Error classification (P3):** throwing release supplier ⇒ `status=error, code=RELEASE_MANIFEST_INVALID`; throwing D1 read
  ⇒ `D1_READ_FAILED`. Not collapsed.
- **Duplicates:** hash-bucketed index (source, ID, slug, content fingerprint, cuisine+title, ingredient signature); hard
  duplicates unwaivable; semantic candidates need explicit `duplicateReview { decision: "distinct", reason }`.
- **SQL renderer:** plain `INSERT`, never `ON CONFLICT DO UPDATE`; hostile text (`'); DROP TABLE recipes; --`) escaped and
  data-only; pending hero `recipe_media` slot per recipe; collision with a pre-existing FK stub aborts the import.
- **Artifact policy:** writes only beneath `.artifacts/recipe-import/`; traversal, absolute path, sibling-prefix, symlinked
  directory and symlinked file escapes refused; `verify` read-only; compiler never writes `migrations/` or
  `packages/recipes/src/data.ts`; errors ⇒ diagnostics only, no `migration.sql`, exit non-zero.
- **Growth readiness (real SQLite replay 0001→0035 + generated batch SQL):** current 71 ⇒ READY (same fingerprint as T14D);
  71 + 6 synthetic imported ⇒ READY with `ALL_RECIPES` still 71; extra ⇒ `COUNT_DRIFT`; missing ⇒ `COUNT_DRIFT`; swapped ID
  ⇒ `ID_DRIFT`; imported/legacy order drift ⇒ `ORDER_DRIFT`; legacy field drift ⇒ `LEGACY_BASELINE_DRIFT`; imported field
  drift ⇒ `FINGERPRINT_DRIFT`; FK-stub shape ⇒ `CATALOG_DIAGNOSTICS`; stale 71-manifest over 77 rows ⇒ `COUNT_DRIFT`;
  manifest not describing this build ⇒ `RELEASE_MANIFEST_INVALID`. Multi-batch A+B byte-identical.
- **Scale (synthetic, 50 % evidence-backed):** 500 → 2,000 ingredient lines / 1,750 steps / 250 profiles /
  **826,455 B** SQL; 2,000 → 8,000 / 7,000 / 1,000 / **3,326,028 B**; 5,000 → 20,000 / 17,500 / 2,500 / **8,322,981 B**.
  Byte-deterministic across compiles and JSON/JSONL. Duplicate index = keyed hash maps (bucket visits < 4N for N=2,000,
  no pairwise scan); batch hash = O(normalized batch size); release composer O(N).

## T14D mode regression (unchanged behaviour on the 71 catalog)

`static | shadow | canary | d1` router tests pass unchanged: static/shadow serve `ALL_RECIPES` with no D1 content read,
d1 = one five-statement batch + TTL cache + singleflight, canary deterministic per household with fallback, full-d1
failure ⇒ emergency static fallback, config-only rollback. Production stays `static`; no cutover fence set.

## Fresh local verification (exact `f7a55408…`, clean checkout, `pnpm install --frozen-lockfile`)

```text
recipe:seed:check     ok ×3 (vietnamese 59, parity 12+71, media 71)
recipe:import:check   ok (rel-1a047444a3632771, 71, 0 batches)
typecheck             0 errors (tsconfig.json + tsconfig.worker.json)
lint                  PASS
check:migrations      migration-smoke=ok (35 files, tip 0035, no 0036)
build                 PASS (vite + worker tsc)
pnpm test             169 files / 3889 tests PASS (326 s)
focused T14E          6 files / 88 tests PASS (provenance 11, factory 16, scale 4, output-policy+CLI 25, release-readiness 15, authority 17)
regression            15 files / 275 tests PASS (authority routing/modes, catalog safety, D1 parity, recipe engine/candidates,
                      planner contract/inventory/nutrition/reasons, cooking allocation/store, media catalog/presentation,
                      Inventory Truth unit+integration, writer fence, read authority, closed loop)
planner/cooking HTTP  7 files / 160 tests PASS (ranking ties, meal-planning client/http/persistence/snapshot, week core flow, authority)
git diff --check      clean
git status --short    clean
```

## Inventory Truth / media / safety

```text
T09_change=NO   T11_change=NO   new_inventory_writers=0   new_canonical_inventory_readers=0
recipe_media architecture unchanged; pending hero semantics, R2 verified promotion, storage-key contract, media route security intact
media_population_started=NO
force_push=NO   history_rewrite=NO   main_direct_application_edit=NO
0035_modified=NO   0036_created=NO   real_recipe_growth=NO
production_D1_write=NO   production_R2_write=NO   production_deploy=NO   production_recipe_authority_switch=NO
Inventory_Truth_change=NO   Qwen_change=NO   PayOS_change=NO   auth_OCR_change=NO   DNS_change=NO   deploy_workflow_change=NO
T14F_started=NO
```

## Production debt (unchanged, still recorded)

```text
production_application_expected=4ed98514f65ddd3b3d83007cd726fd7c2e2136e6
production_migration_tip_expected=0034_global_recipe_catalog_parity.sql
repo_migration_tip=0035_recipe_media_layer.sql
Production D1 Migration workflow: exists (PR #21)   Deploy workflow: exists   operator dispatch: PENDING_OPERATOR
```

T14E does not complete or erase that debt. Operator inputs: `T14CD_PRODUCTION_ROLLOUT_HANDOFF.md`.

## What happens next

`T14E_FINAL_CANONICAL_MAIN` = the merge SHA of the docs-only closure PR carrying this receipt (recorded in that PR's
post-merge comment and in `T14E_NEXT_HANDOFF.md`). It is the ONLY valid base for T14F. T14F prerequisites and sequence:
`T14E_NEXT_HANDOFF.md`.
