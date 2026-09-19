# T15B-PRE — static production certification and shadow safe stop

Date: 2026-09-18

## Canonical identity

```text
repository_id=1368281478
repository_full_name=frigo-6/Frigo-dev
main_sha=0fe2cf071693208f6c642d8cbd994f5a79b5a2cf
main_unchanged_during_rollout=YES
PR29_merged_during_rollout=NO
```

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
migration_receipt_artifact=d1-migration-receipt-35329772751-1 (artifact 10540849823, digest sha256:6c27c41f71333882e4f7b91016b8429e5f5ba2326837d5268c09958bf622e3bd)
media=500 hero pending, 0 ready
production_migration_dispatch_this_task=NO (receipt proves the earlier approved run)
```

The receipt records the pinned 0035 → 0036 → 0037 chain, no aggregate drift, and the captured Time Travel bookmark. No restore, manual SQL, or additional D1 write was performed.

## Static deployment

```text
workflow_run=35333517052
release_job=SUCCESS (105563003928)
production_job=SUCCESS (105563057055)
environment_approval=approved by required production Environment reviewer gate
previous_worker_version=56979cb5-e1a8-4241-8a4c-2432d41cc439
new_worker_version=ab8ff038-2aaa-468b-a9de-8c5d94f14052
deployed_sha=0fe2cf071693208f6c642d8cbd994f5a79b5a2cf
exact_sha_convergence=PASS
convergence_attempts=1
convergence_wait_ms=587
health=degraded only because pre-existing CONFIG_PLUS_GRANT_SECRET_MISSING warning; database/queue/config fatal checks green
configured_authority=static (RECIPE_CATALOG_MODE unset; repository default)
selected_source=static
actual_source=static
served_recipe_count=71
d1_candidate_count=500
d1_readiness=READY by immutable migration catalog certification and release manifest
rollback_available=YES (previous Worker version retained; config rollback is RECIPE_CATALOG_MODE=static)
```

Independent post-deploy checks: five repeated readiness/list requests all returned the deployed SHA and 71 recipes; known legacy IDs `vn-canh-01` and `gl-12` returned 200; sampled Batch B IDs were absent from ordinary static responses. No user action was performed.

## Shadow safe stop

The repository had no approved existing Shadow mutation path: `wrangler.jsonc` omits the mode, `deploy.yml` had no authority input, and no reviewed Cloudflare dashboard/API path was documented. No undocumented dashboard/API change was attempted.

PR #30 adds the minimal reviewed workflow plumbing in `.github/workflows/deploy.yml`, `scripts/release-check.mjs`, and `tests/unit/release-check.test.mjs`: a validated `static|shadow` input, manifest/output propagation, and explicit rejection of `canary`/`d1`. Full gates pass locally. Implementation head `97aff50d52b7448709e943aa7f861475689bcec6` has exact-head CI run `35335079345` SUCCESS. The final documentation head must also pass exact-head CI and the PR must receive independent review before any merge or Shadow deployment.

```text
shadow_activation=NOT_PERFORMED
shadow_certified=NO
classification=T15B_PRE_SHADOW_WIRING_PR_READY
canary=NOT_STARTED
full_d1=NOT_STARTED
media_population=DEFERRED
T14G=NOT_STARTED
```

## Verification

```text
focused: pnpm vitest run tests/unit/release-check.test.mjs tests/unit/wait-for-deployed-release.test.mjs -> 2 files / 99 tests PASS
full: pnpm lint -> PASS
full: pnpm typecheck -> PASS
full: pnpm test -> 173 files / 3976 tests PASS
full: pnpm check:migrations -> migration-smoke=ok
full: pnpm build -> PASS
full: git diff --check -> PASS
```

Next action: independent review and exact-head CI for the wiring PR; do not merge it or activate Shadow in this task.
