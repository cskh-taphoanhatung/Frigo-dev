# T15C-D — production 1% canary certification safe stop

Date: 2026-09-19 UTC

Classification: **`T15C_D_BLOCKED_AUTHORIZED_TEST_HOUSEHOLDS_UNAVAILABLE`**

This run took over the merged T15C-C implementation and completed every safe
pre-canary check available without selecting or enumerating production
customers. The mandatory operator-owned INCLUDE and EXCLUDE households were
not supplied through the approved inputs or secret path, so cohort secrets were
not provisioned and production Canary was not dispatched.

## Repository

```text
repository_id=1368281478
repository_full_name=frigo-6/Frigo-dev
starting_main=347b536950cf54d25a2d6a880c3c2cb3d8c8f329
ending_main=347b536950cf54d25a2d6a880c3c2cb3d8c8f329
task_branch=codex/t15c-production-canary-1pct
PR=NOT_OPEN_AT_AUDIT_TIME
merge_sha=NOT_APPLICABLE
```

Repository ID was resolved through the GitHub API. PR #38 is merged as
`8163f05ed1af361f9c0658361df745227e6eae20`; PR #39 is merged as the current
main `347b536950cf54d25a2d6a880c3c2cb3d8c8f329`. The task branch was created
from that exact clean canonical main.

## Automatic staging deploy

Post-merge Deploy run `35409964105` is successful on exact SHA `347b536...`:

```text
staging_conclusion=SUCCESS
production_job=SKIPPED
recipe_mode=static
canary_percent=0
cutover=false
exact_sha_convergence=PASS (1 attempt / 422 ms)
```

The corresponding exact-main CI run `35409762462` is also successful.

## Baseline

Executed from the clean task branch:

```text
pnpm install --frozen-lockfile=PASS
pnpm recipe:seed:check=PASS (59 Vietnamese + 12 global parity + 71 media slots)
pnpm recipe:import:check=PASS (release rel-bd00a4f53fcaeee4; 500 recipes; 2 batches)
pnpm typecheck=PASS
pnpm lint=PASS
pnpm check:migrations=PASS
migration_tip=0038_auth_onboarding_completion.sql
pnpm build=PASS
pnpm test=PASS (178 files / 4044 tests)
git diff --check=PASS
```

## Pre-canary production

Public read-only checks and the latest immutable production Deploy receipt show:

```text
worker_sha=b41aa4682481447795350fc1a9eeb1e80887bd0e
worker_version=6c336889-680d-4cc3-b03b-1007849aa738
production_deploy_run=35404106102
authority_mode=shadow
canary_percent=0
cutover=false
health=PASS
readiness=degraded but config-valid; database/queue/email OK
readiness_warning=CONFIG_PLUS_GRANT_SECRET_MISSING
served_recipe_count=71 (5/5 deterministic reads; 71 unique)
legacy_recipe_detail=HTTP 200
sampled_D1_only_recipe_detail=HTTP 404
migration_ledger=38
migration_tip=0038_auth_onboarding_completion.sql
```

The latest production artifact records the complete observed migration ledger
through 0038 and exact-SHA convergence. A fresh direct D1 catalog/fingerprint/FK/
quick-check audit and bounded Worker tail could not be run because this local
Wrangler session is unauthenticated. The historical certified catalog state is
500 recipes / release `rel-bd00a4f53fcaeee4` / media 500 pending and 0 ready;
it is not promoted here as a fresh T15C-D D1 certification.

## Cohort preflight

```text
authorized_include_households=0 supplied
authorized_exclude_households=0 supplied
cohort_enabled=NO CHANGE
raw_ids_inspected=NO
raw_ids_logged=NO
digests_computed=NO
digests_logged=NO
customer_accounts_enumerated=NO
```

The GitHub `production` Environment still has its required reviewer and the two
Cloudflare deployment credential secret names. It has no operator cohort input
secret names. Local Cloudflare credential presence checks were negative and
`wrangler whoami` reported unauthenticated. Neither fact authorizes deriving a
household ID from production data, an existing user, or browser state.

T15C-D requires two explicitly authorized operator-owned households before any
secret provisioning or Canary deploy:

- INCLUDE: forced D1 and used for the full inside/E2E matrix.
- EXCLUDE: forced static and used as the outside control.

Because that pair was unavailable, the safe-stop condition in the task packet
was reached before any production mutation.

## Canary and rollback

```text
cohort_secret_change=NO
deploy=NO
config_change=NO
D1_write=NO
migration=NO
R2_write=NO
media_promotion=NO
full_D1=NO
canary_inside_verification=NOT_RUN
canary_outside_verification=NOT_RUN
end_to_end_matrix=NOT_RUN
rollback_deploy=NOT_REQUIRED
```

Production therefore remains in the required safe state:

```text
authority_mode=shadow
canary_percent=0
cutover=false
served_recipe_count=71
D1_user_visible=NO
```

## Exact resume action

1. Supply one INCLUDE and one EXCLUDE operator-owned production household
   through an approved private operator channel. Do not put either raw ID in
   chat, git, a workflow input, logs, docs, or an artifact.
2. Authenticate an operator Wrangler session with the intended Cloudflare
   account, then repeat the full read-only D1 catalog certification and bounded
   tail. Stop on any drift.
3. Compute the two namespaced SHA-256 digests without printing IDs or digests;
   provision only the three Worker cohort secrets and verify retained-secret
   Shadow remains healthy and serves 71.
4. Dispatch protected `deploy.yml` on exact current main with
   `canary / 1 / true`, obtain Environment approval, certify EXCLUDE first,
   INCLUDE second, then the complete E2E/telemetry matrix.
5. Roll back through the same protected workflow to `shadow / 0 / false` while
   retaining the cohort secrets, and stop. Do not advance to 2%, 5%, `d1`,
   T14G, or media population.

