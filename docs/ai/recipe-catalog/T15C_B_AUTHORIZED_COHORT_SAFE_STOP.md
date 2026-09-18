# T15C-B — authorized cohort safe stop

Date: 2026-09-18

This task merged the certified T15C canary control plane, certified exact-main CI
and automatic staging, and rechecked production Shadow/D1 read-only. Production
Canary was **not dispatched** because no authorized operator-owned inside-1% and
outside-1% production test cohorts were available in the repository, environment,
or operator-provided inputs. No customer household IDs were inspected.

## Canonical identity

```text
repository_id=1368281478
repository_full_name=frigo-6/Frigo-dev
starting_main=6f589d0201499a3729d343e42ccb6d19fdff217a
PR32_certified_head=a7b3d23f2ad8b48203328116d0e35425390d2127
PR32_merge_sha=a6e81cd89b9e4c6b923cfc39947b01faf44ff5f3
CANARY_RELEASE_SHA=not deployed
```

## PR #32 closure

```text
state_before=OPEN
mergeable=MERGEABLE
unresolved_threads=0
exact_head_CI_run=35344089103
exact_head_CI_result=SUCCESS
merge_method=merge
expected_head_guard=a7b3d23f2ad8b48203328116d0e35425390d2127
PR_head_ancestor_of_main=YES
tree_delta_PR_head_to_main=0 files
```

The merge used the GitHub expected-head SHA guard. The old main and PR head are
both ancestors of merge main `a6e81cd89b9e4c6b923cfc39947b01faf44ff5f3`.

## Main and staging certification

```text
main_CI_run=35347246583
main_CI_job=105606601599 / validate
main_CI_result=SUCCESS

automatic_deploy_run=35347579284
release_job=105607673991 SUCCESS
staging_job=105607807690 SUCCESS
production_job=105607809241 SKIPPED
staging_worker_version=12623f3b-ac64-4255-9fbf-c429b6225e1d
staging_sha=a6e81cd89b9e4c6b923cfc39947b01faf44ff5f3
staging_mode=static
staging_canary_percent=0
staging_cutover_enabled=false
exact_sha_convergence=PASS (3 attempts / 7691 ms)
```

The release and staging manifests both recorded `static/0/false`. Automatic
`workflow_run` production remained skipped.

## Production pre-state and D1

Read-only checks against `https://frigo.tungjpstore.net` and production D1 were
performed after staging. No deployment, migration, SQL mutation, or resource
write was performed.

```text
worker_version=c6fa2ce8-f35b-4485-ad38-09dbc19738d1
deployed_sha=88e8b54de121125866b2ff813e56e33277decf1c
configured_mode=shadow (prior immutable Shadow manifest)
actual_source=static
served_count=71 (five repeated list checks)
d1_candidate_count=500
d1_readiness=READY (fresh release-manifest catalog certification)

database_name=frigo-db
database_id=f975ec39-b2c8-4a2a-80e1-0366054599d3
tip=0037_recipe_catalog_scale.sql
ledger_count=37
recipes=500
runtime_fields=500
media=500 pending / 0 ready
release_id=rel-bd00a4f53fcaeee4
additional_write_this_task=NO
migration_dispatch_this_task=NO
```

Live readiness returned production/database OK with the pre-existing warning
`CONFIG_PLUS_GRANT_SECRET_MISSING`; five `/api/v1/recipes` checks returned 71,
`vn-canh-01` and `gl-12` returned 200, and five reviewed D1-only IDs returned
404. Each D1 SELECT reported `changes=0` and `rows_written=0`.
The fresh aggregate catalog certification reported 500 recipes, approved batches
2/2, release `rel-bd00a4f53fcaeee4`, `changes=0`, and `rows_written=0`.

## Authorized cohort preflight and stop

```text
inside_test_household_available=NO
outside_test_household_available=NO
raw_household_ids_logged=NO
assignment_algorithm_verified=YES (repository audit only; no cohort supplied)
```

The repository, local environment files, and process environment contained no
authorized operator-owned production cohort credentials or IDs. Per the packet,
the task stopped before production Canary activation:

```text
classification=T15C_B_AUTHORIZED_TEST_COHORT_UNAVAILABLE
```

No production Canary workflow run, Environment approval request, or Canary live
certification exists for this task.

## Canary, rollback, and safety fields

```text
production_canary_deploy=NOT EXECUTED
manifest_mode=NOT EXECUTED
manifest_canary_percent=NOT EXECUTED
manifest_cutover_enabled=NOT EXECUTED
exact_sha_convergence=NOT EXECUTED
live_canary_certification=NOT EXECUTED
rollback_available=YES (approved Deploy workflow, static/0/false, normal approval)
rollback_executed=NO

canary_widened_above_1_percent=NO
production_D1_write=NO
production_migration_dispatch=NO
production_R2_write=NO
media_population=NO
full_D1_enabled=NO
T14G_started=NO
T09_change=NO
T11_change=NO
force_push=NO
history_rewrite=NO
environment_protection_bypass=NO
public_canary_override_added=NO
```

## Next action

An authorized operator must provide both an inside-1% and an outside-1%
operator-owned production test cohort through the approved process. Resume only
from merge main `a6e81cd89b9e4c6b923cfc39947b01faf44ff5f3`, recheck production
pre-state, and dispatch exactly 1% through the normal protected workflow. Do not
widen above 1%, enable full D1, populate media/R2, or inspect arbitrary customer
households.
