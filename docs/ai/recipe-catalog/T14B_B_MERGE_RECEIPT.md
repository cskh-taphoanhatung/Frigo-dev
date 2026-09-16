# T14B-B merge receipt — PR #14 merged into canonical main (2026-09-16)

```text
repo=cskh-taphoanhatung/Frigo-dev
repository_id=1368281478
PRE_MERGE_MAIN=c1c1c14a2a7dccc883f1030d0dee7043754fb4a9
PR=14
PRE_MERGE_PR_HEAD=004e5a320397b71e7bff5a65b8f5efa9a7a09065
PR_BASE=main   PR_BEHIND=0   PR_MERGEABLE=true   PR_MERGEABLE_STATE=clean
PR14_CI=run 35067589351 / check 104701297658 / validate=SUCCESS (exact head 004e5a32)
MERGE_METHOD=merge (normal protected merge commit; no squash/rebase; no force push; no history rewrite)
MERGE_SHA=c7455160bfc8d279d38bc7ca4c0751542012a3c5
POST_MERGE_MAIN=c7455160bfc8d279d38bc7ca4c0751542012a3c5
MERGE_PARENTS=c1c1c14a2a7dccc883f1030d0dee7043754fb4a9 004e5a320397b71e7bff5a65b8f5efa9a7a09065
PR_HEAD_IN_MAIN=YES (git merge-base --is-ancestor)
APPLICATION_TREE_PRESERVED=YES (git diff 004e5a32 c7455160 --stat is empty)
MAIN_CI=run 35072991882 / check 104718663685 / validate=SUCCESS (exact head c7455160)
```

## Pre-merge audit (executed immediately before the merge)

- `git fetch --all --prune`: `origin/main` = `c1c1c14a…`, PR head = `004e5a32…`, behind 0 — matched the
  independently reviewed state exactly; nothing had moved.
- Migrations `0001–0033` byte-identical to main; `0034_global_recipe_catalog_parity.sql` present;
  no `0035`; `.hoplite/settings.json` identical to main.
- Protected PR #9 / Auth / OCR files byte-identical to main: `public/_headers`,
  `src/web/components/scan/ScanProcessingState.tsx`, `src/web/pages/{AuthPage,ReceiptReviewPage,ScanPage,ScanResultPage}.tsx`,
  `src/worker/index.ts`, `tests/integration/worker-cors.test.mjs`, `tests/unit/auth-google-credential.test.tsx`,
  `tests/unit/scan-processing-state.test.tsx`.
- Authority: `RecipeCatalogMode = 'static' | 'shadow'` (no `d1`); `validateEnvironment` fails closed with
  `CONFIG_RECIPE_CATALOG_MODE` for any non-static production value; `wrangler.jsonc` does not set
  `RECIPE_CATALOG_MODE`.

## Post-merge main certification (exact `c7455160…`, fresh)

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm recipe:seed:check` | 0006 ok (59), 0034 ok (12 globals + 71 runtime field rows) |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm check:migrations` | `migration-smoke=ok` |
| `pnpm build` | exit 0 |
| `pnpm test` | **157 files / 3704 tests passed** |
| `git diff --check` | clean |
| Hosted CI `validate` on `c7455160` | SUCCESS (run 35072991882, check 104718663685) |

## Migration 0034 status

```text
repository_ledger=0001–0034 (34 files; highest 0034_global_recipe_catalog_parity.sql; no 0035)
production_D1_binding=DB → database_name=frigo-db, database_id=f975ec39-b2c8-4a2a-80e1-0366054599d3 (wrangler.jsonc)
production_ledger_read=NOT_PERFORMED (no Cloudflare credentials available to this session; `wrangler whoami` → not authenticated)
production_0034_applied=NO (not attempted — identity/ledger/backup gates could not be executed without credentials)
```

Per `DEPLOYMENT.md`, the pipeline never applies remote migrations. An operator with Cloudflare
access must, in order: read the production `d1_migrations` ledger (expected tip
`0033_scan_evidence_completeness.sql`), export/back up `frigo-db`, then run
`pnpm wrangler d1 migrations apply frigo-db --remote`, then verify: 34 ledger rows, `recipes=71`
(59 vietnamese / 12 global), `recipe_runtime_fields=71` with `runtime_order` distinct `0..70`,
`recipe_runtime_ingredient_order=385` (one row per `recipe_ingredients` row, per-recipe positions
`0..N-1`), `PRAGMA foreign_key_check` empty, `integrity_check=ok`, and unchanged aggregate counts for
users/households/inventory/cooked_meals/meal_plans/scans. Only then does the read-only pre-deploy
schema gate (`scripts/d1-schema-gate.sql`, which now requires 0034 + `runtime_order` + `position`) pass.

## Production rollout status

```text
auto_deploy_run=35073197948 (workflow_run after main CI) → release job SUCCESS, staging job FAILURE, production job SKIPPED
staging_failure_cause=CLOUDFLARE_API_TOKEN not set in the GitHub `staging` environment
  (wrangler: "In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN")
classification=T14B_B_PRODUCTION_DEPLOY_BLOCKED_BY_EXISTING_OPS_SECRET (identical failure on the three previous main pushes: runs 35035612637, 35036504160)
production_deploy=NOT_PERFORMED (manual `workflow_dispatch` to production also needs the same Cloudflare secrets and an operator's `confirm_production`)
deployed_application_sha=unchanged (pre-T14B-B lineage; readiness reports commit=null)
```

Read-only production probe at `https://frigo.tungjpstore.net` (no mutation, no auth, no scans):
`/api/v1/health` 200 `ok`; `/api/v1/health/ready` 200 `degraded` (database ok, queue ok, ai/email
configured, rate limiting kv-best-effort; existing warning `CONFIG_PLUS_GRANT_SECRET_MISSING` — pre-existing,
not T14B-B); `/api/v1/recipes` 200 with **71 recipes, first `vn-canh-01`, last `gl-12`, 59 vietnamese /
12 global** (static `ALL_RECIPES` authority, as expected; this endpoint does not depend on 0034);
`/api/v1/recommendations` unauthenticated → 401; `/api/v1/auth/google/config` 200; CORS preflight 204;
`content-security-policy` / `x-frame-options` present. No T14B-B code is deployed yet, so these confirm
the pre-rollout baseline is healthy, not the rollout.

## Authority status (unchanged by the merge)

```text
user_visible_recipe_authority=ALL_RECIPES
D1_recipe_role=shadow/parity candidate
production_recipe_mode=static (RECIPE_CATALOG_MODE unset; production validation rejects non-static)
D1_authority_mode=DOES_NOT_EXIST
RECIPE_CATALOG_SHADOW_INTERVAL_MS=unset (default 60 s; clamped 1 s–24 h)
```

## Completion status

```text
T14B_B_INTEGRATION=COMPLETE (merged + main certified)
T14B_B_PRODUCTION_MIGRATION=NOT_APPLIED (blocked: no Cloudflare credentials in this session)
T14B_B_PRODUCTION_ROLLOUT=BLOCKED (existing OPS secret issue; not a T14B-B code failure)
T14B_B_STATUS=T14B_B_ROLLOUT_BLOCKED
T14C_STARTED=NO (no handoff document is written until the rollout closes)
PR14_branch_deleted=NO (kept for audit)
```

Related: `T14B_B_D1_PARITY_SHADOW.md` (design/evidence), `T14B_B_REMEDIATION_HANDOFF.md`
(review remediation), ADR-024 in `docs/ai/DECISIONS.md`.
