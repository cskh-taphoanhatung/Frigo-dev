# T15A — production rollout preflight handoff (T15A + T15A-R)

```text
classification=T15A_PRE_PRODUCTION_HARDENING (exact heads/CI bound in the PR receipts below)
T15A_SCHEMA_GATE_HARDENED=YES (PR #26 → main 70cf7e0dae675ca19efbac2ceed0d1380d837024)
T15A_WORKFLOW_WIRING_HARDENED / T15A_DEPLOY_READINESS_RACE_HARDENED = this branch (PR #27 receipt)
T15A_PRODUCTION_D1_0037=NOT_STARTED  T15A_STATIC_DEPLOY_CERTIFIED=NO  T15A_SHADOW_CERTIFIED=NO
T15B_CANARY_NOT_STARTED  MEDIA_POPULATION_DEFERRED  T14G_NOT_STARTED
repository_id=1368281478  repository_full_name=frigo-5/Frigo-dev
T14F_main=9be395d0a2e7437fb22b78415489444fa42e600f
T15A_hardening_merge=70cf7e0dae675ca19efbac2ceed0d1380d837024 (push CI 35287827109 SUCCESS)
```

## What is on main after PR #26 (T15A)

- `scripts/d1-schema-gate.mjs` renders the gate's `required_migrations` from `migrations/` (contiguous
  `0001..tip`, fail closed on gaps); the ledger must equal it exactly (`missing_migration` /
  `unexpected_migration`). `d1-schema-gate.sh` uses the renderer. One source of truth, same inventory
  `release-check.mjs` derives from `git ls-tree` at the pinned SHA.
- `scripts/d1-migration-check.mjs`: exact pinned chain `expected_pre_tip → migration` (all hashes at one
  SHA), plan must equal the chain in order, catalog tables may grow only for registered batches, new
  `catalog` command certifies the DB against the shipped release manifest + `approved-batches.json`
  (0034/0035 → 71, 0036 → 101, 0037 → 500; runtime order `0..n-1`; complete rows; `media_ready = 0`).

## T15A-R (this branch)

- **Workflow wiring** — `production-d1-migrate.yml`: `catalog` step between `verify` and the schema
  gate; `${{ inputs.migration }}` moved out of the shell into `env`; chain-aware input descriptions.
  Permissions unchanged (`contents: read`, `actions: read`); still `workflow_dispatch` only.
- **Deploy readiness race** — Deploy run 35288137887 failed at `release-check.mjs deployed` although
  the staging Worker (`e00a78d3…`) was live: the edge briefly answered `/health/ready` from the previous
  version, so a single immediate curl saw the old `commit`. Fix: `scripts/wait-for-deployed-release.mjs`
  polls readiness (deadline 90 s, interval 3 s, 15 s request timeout) and retries **only** the case
  `verifyDeployedRelease` now classifies as `RELEASE_PROPAGATION_PENDING` (healthy, right environment,
  previous SHA). Wrong environment, unhealthy status/DB/config, malformed JSON, 4xx → fail immediately;
  5xx/429/timeouts tolerated up to 3 times. Both staging and production jobs use it; on timeout the job
  fails and the `if: always()` receipt upload keeps the manifest. Nothing redeploys.
- **P3_FUTURE_MEDIA_GATE_COMPATIBILITY** — the `catalog` invariant `media_ready == 0` is a
  pre-media-rollout condition. Revisit before any migration that follows media population.

## Blocked here: the App credential cannot push `.github/workflows/*`

GitHub rejects pushes touching workflow files (`without workflows permission`) and `workflow_dispatch`
returns 403. The non-workflow code/tests on this branch are pushed; the two workflow diffs are attached
as a patch on the PR (see receipt comment; sha256 recorded there). A maintainer must apply the patch on
a follow-up branch (or grant the App `workflows`) before any production migration is dispatched.

## Production resume requirements (T15A Phase B — separate session, operator approval)

1. Workflow wiring (catalog step) **and** bounded exact-SHA convergence present on canonical `main`,
   exact-main push CI SUCCESS, staging auto-deploy SUCCESS on that main (or accepted test evidence).
2. Cloudflare production credentials, `workflow_dispatch` permission and a `production` Environment
   reviewer available to the executing account.
3. Re-query production **read-only** first (ledger, tip, recipes, runtime fields, FK/quick_check, Worker
   commit, authority). Historical only: tip 0034 (Deploy 35102115354, 2026-09-16); Worker `4ed98514…`;
   `/recipes` serves 71 static.
4. Dispatch `production-d1-migrate.yml` with `ref=<main SHA>`, `expected_pre_tip=<observed tip>`,
   `migration=0037_recipe_catalog_scale.sql`, confirm=true. Dry-run at 70cf7e0d from 0034: chain
   `0035 (a2c01724…) → 0036 (04228788…) → 0037 (68e52e6d…)`, 34 pinned hashes verified.
5. Then `deploy.yml` production with `RECIPE_CATALOG_MODE` unset (static 71); then `shadow` per T14D.
   No canary / d1 / media / T14G in T15A.
