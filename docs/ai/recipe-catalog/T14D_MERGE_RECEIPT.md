# T14D merge receipt — PR #19 merged into canonical main; main certified; production rollout DEFERRED (2026-09-16)

```text
STATUS=T14D_DEVELOPMENT_COMPLETE · T14D_MAIN_CERTIFIED · PRODUCTION_ROLLOUT_DEFERRED
This is NOT a production completion receipt. T14D code is merged and certified on main only.
```

## Lineage

```text
repository_id=1368281478   repo=frigo-1/Frigo-dev
PRE_MERGE_MAIN=d0856b48e043c72d1793002e7c6047a186ac890d
PR=19   branch=hoplite/megale-polis-f7fb9e9a-t14d-recipe-authority-cutover
PR19_HEAD=f2831805c9bf61fcf72d46d93425c0303c25361f
PR_BASE=main   PR_BEHIND=0   PR_MERGEABLE=mergeable   PR_REVIEW_THREADS=0 unresolved
MERGE_METHOD=merge (normal merge commit, consistent with #14–#18; no squash/rebase; no force push; no history rewrite)
MERGE_SHA=POST_MERGE_MAIN=bb504cce7476927249b3c6e4d5bc634600a45883
MERGE_PARENTS=d0856b48e043c72d1793002e7c6047a186ac890d f2831805c9bf61fcf72d46d93425c0303c25361f
PR19_HEAD_IN_MAIN=YES (git merge-base --is-ancestor)
APPLICATION_TREE_PRESERVED=YES (git diff f2831805 bb504cce --stat is empty)
```

## CI

```text
PR_VALIDATE=run 35154490438 / check 104990560480 / SUCCESS (exact head f2831805)
POST_MERGE_VALIDATE=run 35157739716 / check 105001075798 / SUCCESS (exact head bb504cce; ESLint, Typecheck, Vitest, Migration smoke, Build)
INCIDENTAL_AUTO_STAGING=Deploy run 35158032832 (workflow_run) SUCCESS — staging D1/R2 only, production job SKIPPED; not a T14D completion criterion
```

## Pre-merge gates (executed immediately before the merge, fresh `git fetch --all --prune`)

- `origin/main` = `d0856b48…`, PR head = `f2831805…`, behind 0, mergeable, rollup SUCCESS — unchanged from the reviewed state.
- Diff classes vs main: recipe authority implementation (`packages/recipes/src/recipe-authority.ts`,
  `src/worker/services/recipe-authority.ts`), runtime reader routing (`routes/recipes.ts`, `routes/week.ts`,
  `routes/shopping.ts`), config validation + `Env` types, planner explicit recipe source
  (`packages/domain/src/week/planner.ts`), browser offline fallback explicit list (`src/web/services/week.ts`), tests,
  ADR-026/design/state docs. No migration, wrangler, workflow, release-check, PayOS, Qwen, auth/OCR, scan, CSP,
  lockfile or Inventory Truth file changed.
- Migrations: 35 files, highest `0035_recipe_media_layer.sql`, no 0036, `0001–0035` byte-identical to main.
- Authority: `RECIPE_CATALOG_MODES = static|shadow|canary|d1`; `USER_VISIBLE_D1_MODES = canary|d1` require
  `RECIPE_CATALOG_CUTOVER_ENABLED=true`; no query/header/body mode selection anywhere under `src/worker`.
- Readiness: `CATALOG_DIAGNOSTICS | COUNT_DRIFT | ID_DRIFT | ORDER_DRIFT | FINGERPRINT_DRIFT | D1_READ_FAILED`; a D1
  snapshot is constructed only from a `ready` assessment.
- Canary: `tenantKey = auth.householdId`, FNV-1a32 bucketing; no `Math.random`/`Date.now`/request id in assignment.
- Inventory Truth: `packages/db/src/inventory*`, `packages/domain/src/inventory*`, `src/worker/routes/inventory*`
  unchanged vs main. The `INSERT OR IGNORE INTO recipes` FK anchors in `shopping.ts` (1) and `recipes.ts` (2) exist
  on pre-merge main at the same counts → `T14D_NEW_RECIPE_WRITERS=0` (legacy; tracked for future catalog cleanup).

## Architecture (as merged)

```text
runtime_readers=14/14 migrated (6 recipes.ts, 5 week.ts, 1 shopping.ts, 2 planner hidden defaults)
unknown_runtime_readers=0 (guard: tests/unit/recipe-catalog-authority.test.ts)
modes=static|shadow|canary|d1   default=static   dangerous_mode_fence=RECIPE_CATALOG_CUTOVER_ENABLED=true (canary/d1)
fingerprint_parity=SHA-256 over canonical ordered RuntimeRecipe projection (media-free)   order_parity=YES   ingredient_order_parity=YES
d1_snapshot_statement_count=5 (one batch)   snapshot_loads_per_operation=1   cache_ttl=30s   stale_grace=5min   singleflight=YES   n_plus_one=NO
config_only_rollback=RECIPE_CATALOG_MODE=static (tested: zero D1 statements, no data change)
```

## Post-merge certification (exact `bb504cce…`, fresh sandbox run)

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm recipe:seed:check` | 3× ok (0006, 0034, 0035) |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm check:migrations` | `migration-smoke=ok` (fresh replay 0001→0035, 0034→0035, idempotent re-read) |
| `pnpm build` | exit 0 |
| Focused: `recipe-authority` 17 · `recipe-catalog-authority` 6 · `recipe-authority-routing` 7 · `recipe-d1-runtime-parity` 11 · `week-core-flow` 3 · `week-planner` 15 · T14C media 72 | **131 passed** |
| `pnpm test` | **163 files / 3801 tests passed** |
| `git diff --check` | clean; working tree clean |
| Hosted CI `validate` on `bb504cce` | SUCCESS (run 35157739716, check 105001075798) |

Mode certification (tests, local D1 harness only): static = ALL_RECIPES, zero D1 content reads, recommendation/
planner/cooking parity; shadow = static response + off-response compare, D1 failure never breaks the response;
canary = same household + same percent ⇒ same assignment, 0% none / 100% all, D1 not-ready ⇒ static 200 with
`recipe_catalog_canary_fallback`; d1 = verified snapshot, strict HTTP parity with static, D1 failure ⇒ static 200 with
error-level `recipe_catalog_d1_fallback` (`selectedSource=d1`, `actualSource=static`).

## Production debt (unchanged by this packet)

```text
production_application_expected=4ed98514f65ddd3b3d83007cd726fd7c2e2136e6
production_migration_tip_expected=0034_global_recipe_catalog_parity.sql
repo_migration_tip=0035_recipe_media_layer.sql
T14C_0035_rollout=PENDING   T14D_deployed=NO   production_recipe_mode_expected=static
RECIPE_CATALOG_MODE / RECIPE_CATALOG_CUTOVER_ENABLED / RECIPE_CATALOG_D1_CANARY_PERCENT: NOT set in wrangler.jsonc
```

No Cloudflare command was run as a gate; no remote migration, D1/R2 write or deployment was performed. See
`T14D_NEXT_HANDOFF.md` for the OPS sequence.

## Safety

```text
force_push=NO  history_rewrite=NO  main_direct_application_edit=NO  0035_modified=NO  0036_created=NO
production_D1_write=NO  production_R2_write=NO  production_deploy=NO  production_recipe_authority_switch=NO
Inventory_Truth_change=NO  Qwen_change=NO  PayOS_change=NO  auth_OCR_change=NO  DNS_change=NO  CSP_change=NO
deploy_workflow_change=NO  media_population_started=NO  T14E_started=NO
```
