# T15B-SHADOW — production Shadow certification

Date: 2026-09-18

## Canonical identity

```text
repository_id=1368281478
repository_full_name=frigo-6/Frigo-dev
starting_main_sha=0fe2cf071693208f6c642d8cbd994f5a79b5a2cf
shadow_release_sha=88e8b54de121125866b2ff813e56e33277decf1c
main_unchanged_during_deploy_and_certification=YES (stable at shadow_release_sha)
PR29_merged_during_rollout=NO (PR #29 remains OPEN/CONFLICTING and stale)
PR30_head=ad3e1d1656418aaf495b130443d6514926b8bdca
PR30_merge=88e8b54de121125866b2ff813e56e33277decf1c
PR30_tree_delta_to_main=0 files
```

PR #30 was the reviewed, minimal Shadow wiring change. Its merge was the only intentional main movement; no unrelated application, migration, Inventory Truth, authentication, payment, media, or T14G change was introduced.

## Existing D1 certification

```text
migration_run=35329772751
migration_result=SUCCESS
database_name=frigo-db
database_id=f975ec39-b2c8-4a2a-80e1-0366054599d3
final_tip=0037_recipe_catalog_scale.sql
ledger_count=37
recipes=500
runtime_fields=500
recipe_ingredients=2702
recipe_steps=2064
runtime_ingredient_order=2702
approved_batches=2/2
release_id=rel-bd00a4f53fcaeee4
foreign_key_check=[]
quick_check=ok
schema_gate=PASS
media=500 hero slots pending, ready=0
migration_receipt_artifact=d1-migration-receipt-35329772751-1
migration_receipt_artifact_id=10540849823
migration_receipt_sha256=6c27c41f71333882e4f7b91016b8429e5f5ba2326837d5268c09958bf622e3bd
production_migration_dispatch_this_task=NO
```

The immutable receipt and the production workflow's read-only ledger/schema step were used. No migration, manual SQL, ledger edit, restore, or additional D1 write was performed.

## Authority path audit

```text
static_configuration_source=deploy.yml workflow_run default (workflow_run => static) and validated static input
shadow_configuration_source=deploy.yml workflow_dispatch recipe_catalog_mode=shadow -> release gate -> immutable manifest/output -> Wrangler RECIPE_CATALOG_MODE
shadow_path_type=B (approved existing deploy workflow input; Worker variable propagation is repository-controlled)
canary_configuration_source=unavailable; release gate rejects canary
full_d1_configuration_source=unavailable; release gate rejects d1/full modes
cutover_enabled=NO
```

The production Environment protection rule remained enabled with required reviewer `vn-taphoanhatung`. The deployment status progressed through `waiting` -> `in_progress` -> `success`; no protection bypass was used.

## Main and staging certification

```text
exact_main_ci_run=35336548833 SUCCESS
automatic_staging_deploy_run=35336830786
staging_release_job=105573491592 SUCCESS
staging_job=105573548372 SUCCESS
staging_production_job=105573549271 SKIPPED
staging_worker_version=580acb76-a006-4c0a-b991-618ebde07e88
staging_deployed_sha=88e8b54de121125866b2ff813e56e33277decf1c
staging_authority=static
staging_served_count=71
staging_convergence_attempts=1
staging_convergence_wait_ms=556
```

## Production Shadow deploy

```text
workflow_run=35337110268
release_job=105574386006 SUCCESS
production_job=105574426707 SUCCESS
staging_job=105574428123 SKIPPED
environment_approval=required production reviewer gate approved; no bypass
previous_worker_version=ab8ff038-2aaa-468b-a9de-8c5d94f14052
new_shadow_worker_version=c6fa2ce8-f35b-4485-ad38-09dbc19738d1
deployed_sha=88e8b54de121125866b2ff813e56e33277decf1c
exact_sha_convergence=PASS
convergence_attempts=1
convergence_wait_ms=574
configured_authority=shadow
```

The immutable production artifact was `release-production-35337110268-1` (artifact ID `10543890458`). Its manifest recorded `recipeCatalogMode=shadow`, schema tip `0037_recipe_catalog_scale.sql`, ledger count 37, and the observed migration ledger.

## Independent live Shadow certification

Target: `https://frigo.tungjpstore.net`, read-only anonymous requests only.

```text
health_readiness=degraded, database=ok, queue=ok, fatal_config_issues=0
readiness_warning=CONFIG_PLUS_GRANT_SECRET_MISSING (pre-existing non-fatal warning)
readiness_commit=88e8b54de121125866b2ff813e56e33277decf1c
repeated_catalog_checks=5/5 HTTP 200, each count=71
legacy_recipe_vn-canh-01=HTTP 200
legacy_recipe_gl-12=HTTP 200
imported_ids_tested=imp-199ff78d3d8c8ab3, imp-ab36e38b07f3a57b, imp-26a36c69306143bc, imp-b87b71d57128cc07, imp-511a92d180408e0a
imported_recipe_user_route=5/5 HTTP 404 (no authority leak)
```

Cloudflare `workers_tail` captured sanitized `recipe_catalog_shadow` records for the live requests:

```text
catalog_mode=shadow
catalog_source=static
status=compared
level=info
catalog_static_count=71
catalog_d1_count=500
catalog_complete_count=500
catalog_hydrated_count=500
catalog_static_only_count=0
catalog_d1_only_count=429 (reviewed growth)
catalog_drift_count=0
catalog_order_drift_count=0
catalog_hydration_failure_count=0
release_id=rel-bd00a4f53fcaeee4
release_expected_count=500
release_readiness=ready
release_readiness_code=null
shadow_errors=0
fallback_reason=none
authority_leak=NO
```

The user-facing route continued to select and serve STATIC71 while D1500 was read and compared in the background. No household payloads, tokens, or recipe row dumps were logged.

## Rollback and safety

```text
rollback_available=YES
rollback_mechanism=approved deploy.yml workflow with the same SHA and recipe_catalog_mode=static, normal production approval
production_D1_additional_write=NO
production_R2_write=NO
media_population=NO (500 pending hero slots remain; ready=0)
canary_enabled=NO
full_D1_enabled=NO
T14G_started=NO
T09_change=NO
T11_change=NO
Inventory_Truth_change=NO
PR29_merged_during_rollout=NO
force_push=NO
history_rewrite=NO
environment_protection_bypass=NO
```

No rollback was required. The next authorized phase is a separate canary/full-D1 decision; this task stops with Shadow certified.

## Final classification

```text
P0=0
P1=0
release_blocking_P2=0
P3=P3_FUTURE_MEDIA_GATE_COMPATIBILITY (deferred)
T15A_R_COMPLETE=YES
T15A_PRODUCTION_D1_0037=YES
T15A_PRODUCTION_CATALOG_500_READY=YES
T15A_STATIC_DEPLOY_CERTIFIED=YES
T15A_SHADOW_CERTIFIED=YES
T15B_SHADOW_COMPLETE=YES
T15B_CANARY_NOT_STARTED=YES
MEDIA_POPULATION_DEFERRED=YES
T14G_NOT_STARTED=YES
```

## Verification commands

```text
gh api repositories/1368281478
gh api repos/frigo-6/Frigo-dev/commits/main
gh run view 35336548833
gh run view 35336830786
gh run view 35337110268
gh run download 35337110268 --name release-production-35337110268-1
pnpm wrangler deployments list --name frigo --json
pnpm wrangler tail frigo --format json
curl .../api/v1/health/ready
curl .../api/v1/recipes (5 repetitions)
curl .../api/v1/recipes/vn-canh-01
curl .../api/v1/recipes/gl-12
curl .../api/v1/recipes/<five reviewed imported IDs>
```

All production checks above were read-only. This receipt branch is documentation-only and must receive exact-head CI plus independent documentation review; it is not merged automatically.
