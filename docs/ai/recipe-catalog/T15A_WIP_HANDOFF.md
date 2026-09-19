# T15A — production rollout preflight handoff (T15A + T15A-R)

```text
classification=T15A_PRE_PRODUCTION_HARDENING_COMPLETE (PR #26 + PR #27 on main; production rollout NOT started)
T15A_SCHEMA_GATE_HARDENED=YES (PR #26 → main 70cf7e0dae675ca19efbac2ceed0d1380d837024)
T15A_WORKFLOW_WIRING_HARDENED=YES  T15A_DEPLOY_READINESS_RACE_HARDENED=YES (PR #27 → main 0fe2cf071693208f6c642d8cbd994f5a79b5a2cf)
T15A_R_MERGED_TO_MAIN=YES  T15A_R_MAIN_CERTIFIED=YES  T15A_R_STAGING_CERTIFIED=YES (receipt at the end of this file)
T15A_PRODUCTION_D1_0037=NOT_STARTED  T15A_STATIC_DEPLOY_CERTIFIED=NO  T15A_SHADOW_CERTIFIED=NO
T15B_CANARY_NOT_STARTED  MEDIA_POPULATION_DEFERRED  T14G_NOT_STARTED
repository_id=1368281478  repository_full_name=frigo-6/Frigo-dev (ID authoritative; owner display was frigo-5 in older receipts)
T14F_main=9be395d0a2e7437fb22b78415489444fa42e600f
T15A_hardening_merge=70cf7e0dae675ca19efbac2ceed0d1380d837024 (push CI 35287827109 SUCCESS)
T15A_R_merge=0fe2cf071693208f6c642d8cbd994f5a79b5a2cf (push CI 35329100767 SUCCESS; Deploy 35329500028 release/staging SUCCESS, production SKIPPED)
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
  **Status: APPLIED TO PR #27** — the patch (`git apply` clean; `git diff | sha256sum` byte-identical to
  `t15a-r/workflows.patch`, `1d5097a5…`) is committed on the remote branch as `366dbd1` (workflows) +
  `776422f` (unconditional guardrails). The App's direct pushes of these commits were rejected during
  T15A-R2 (`without workflows permission`), so they were preserved as the `git am` series
  `t15a-r/r2-wired-series.mbox`; they were subsequently published to the branch through the platform's
  authorized publisher and verified: `origin/main..branch` workflow diff equals the tracked patch, and
  the `.github`/`scripts`/`tests` tree is identical to the locally certified `917ce63`. Both patch
  artefacts are now consumed audit evidence; the workflow files are authoritative.
- **Deploy readiness race** — Deploy run 35288137887 failed at `release-check.mjs deployed` although
  the staging Worker (`e00a78d3…`) was live: the edge briefly answered `/health/ready` from the previous
  version, so a single immediate curl saw the old `commit`. Fix: `scripts/wait-for-deployed-release.mjs`
  polls readiness (deadline 90 s, interval 3 s, 15 s request timeout) and retries **only** the case
  `verifyDeployedRelease` now classifies as `RELEASE_PROPAGATION_PENDING` (healthy, right environment,
  *different valid full SHA* — valid-SHA propagation pending; the helper does not claim that SHA is the
  previous Worker). Wrong environment, unhealthy status/DB/config, malformed JSON, 4xx → fail immediately;
  5xx/429/timeouts tolerated up to 3 times. Both staging and production jobs use it; on timeout the job
  fails and the `if: always()` receipt upload keeps the manifest. Nothing redeploys.
- **Commit identity contract (T15A-R2)** — `readiness.commit` must be a canonical full Git SHA
  (`/^[a-f0-9]{40}$/`, same convention as `release-check.mjs` / `d1-migration-check.mjs`). Missing, null,
  empty, short, uppercase, non-hex, or non-string commit identities fail closed immediately
  (`Readiness commit is not a canonical full Git SHA`) and are never `RELEASE_PROPAGATION_PENDING`.
  Regression tests A–J in `tests/unit/release-check.test.mjs` + polling-level tests in
  `tests/unit/wait-for-deployed-release.test.mjs`.
- **P3_FUTURE_MEDIA_GATE_COMPATIBILITY** — the `catalog` invariant `media_ready == 0` is a
  pre-media-rollout condition. Revisit before any migration that follows media population.

## Historical blocker (resolved): the App credential could not push `.github/workflows/*` directly

During T15A-R and T15A-R2 the App's `git push` was rejected on workflow files (`without workflows
permission`). The intended change was carried as `t15a-r/workflows.patch` (raw diff, `1d5097a5…`) and
`t15a-r/r2-wired-series.mbox` (two ready-made commits). Those two commits now exist on the PR branch
(`366dbd1`, `776422f`), so the blocker is closed for PR #27. Keep both files as audit evidence.

## T15A-R safe stop (2026-09-18T01:4xZ, VERIFIED_LIVE) — superseded by the T15A-R2 safe stop below

```text
classification=T15A_R_BLOCKED_WORKFLOW_PERMISSION (pre-PR phase: readiness fix implemented, focused tests pass, full gates pass; PR #27 open, NOT ready to merge)
origin_main=70cf7e0dae675ca19efbac2ceed0d1380d837024 (unchanged throughout; VERIFIED_LIVE)
branch=hoplite/sparta-lakedaimon-43461860--t15a-r-workflow-readiness (created from 70cf7e0d; no rebase/force push)
resume_from_head=<branch HEAD at handoff, bound in the PR #27 body/receipt>
PR=27 open base=main@70cf7e0d mergeable clean unresolved_threads=0 draft=NO merged=NO (do not merge until the patch is applied)
readiness_fix=FULL_GATES_PASS on this tree (helper scripts/wait-for-deployed-release.mjs: deadline 90 s, interval 3 s, 15 s request timeout;
  retryable = RELEASE_PROPAGATION_PENDING only; fail-closed = wrong env, unhealthy, malformed JSON, 4xx; ≤3 transient 5xx/429/timeouts)
staging/production hooks=PATCH WITHHELD (deploy.yml single-shot replaced only in the patch); helper smoke-tested read-only against live staging
workflow_wiring=PATCH WITHHELD for production-d1-migrate.yml too (catalog step order gate→…→verify→catalog→schema-gate; input interpolation removed in patch)
guardrails=self-activating in tests/unit/release-check.test.mjs: unwired 51 passed / 2 skipped (CI green); patch applied 66 passed / 0 skipped (VERIFIED_LOCAL both ways)
focused_tests=97/97 (release-check 53 incl. 2 skipped unwired, wait-for-deployed-release 13, d1-migration-check, d1-schema-gate)
full_gates=seed ok · import ok (500/2) · typecheck 0 · lint PASS · migration-smoke ok · build PASS · vitest 173 files / 3943 tests PASS (586 s) · diff-check clean
migration_integrity=migrations/ diff vs main = 0; 0036 04228788… ; 0037 68e52e6d… ; 0038_created=NO (VERIFIED_LIVE)
production_safety=D1_write NO · R2 NO · deploy NO · authority NO · migration dispatch NO (0 runs) · media NO · T14G NO; prod Worker 4ed98514… / static 71 (VERIFIED_LIVE)
CI=exact-head on the branch head must be SUCCESS before handoff ends (bound in the PR body; the 6ce20fc4 run 35295687199 failed on the pre-activation guardrails and was superseded by this fix)
```

Changed/pushed on the branch (relative to main `70cf7e0d`): `scripts/release-check.mjs` (propagation
classification), `scripts/wait-for-deployed-release.mjs` (new), `scripts/d1-migration-check.mjs`
(media-gate comment), `tests/unit/release-check.test.mjs`, `tests/unit/wait-for-deployed-release.test.mjs`
(new), `docs/ai/recipe-catalog/T15A_WIP_HANDOFF.md` (this file), `docs/ai/recipe-catalog/t15a-r/workflows.patch`
(+ `.sha256`, the withheld workflow diff), `docs/ai/CURRENT_STATE.md`, `docs/ai/HANDOFF.md`, `TASK_BOARD.md`.
Local-only uncommitted (intentional, documented): `git diff` on `.github/workflows/deploy.yml` and
`.github/workflows/production-d1-migrate.yml` — identical to the tracked patch; do not commit (push is rejected).

**Next session (resume rule):** fetch, read this file, verify `origin/main` and the branch head live,
then: apply `docs/ai/recipe-catalog/t15a-r/workflows.patch` on this branch (or a maintainer branch), commit
forward-only (the guardrails self-activate), run focused + full gates, push, require exact-head CI SUCCESS,
then (only with separate authorization) merge with an expected-head guard and require exact-main CI SUCCESS.
Do not dispatch `production-d1-migrate.yml` and do not deploy production from this branch.

## T15A-R2 safe stop (2026-09-18T03:4xZ) — superseded by the T15A-R2 wired-branch receipt below

```text
classification=T15A_R2_BLOCKED_WORKFLOW_PERMISSION (NOT merged; NOT main-certified; NOT staging-certified; production untouched)
repository_id=1368281478  repository_full_name=frigo-6/Frigo-dev (GitHub owner display; ID authoritative)
starting_main=70cf7e0dae675ca19efbac2ceed0d1380d837024  starting_head=9ca4bae426f4adf8ee6ddd05a5d5fe04e8d2f8f5 (4 ahead / 0 behind; VERIFIED_LIVE)
pushed_forward_commits=eecbbf0090c037adb5d6f5a90da9af2a63e5ae06 fix(t15a-r) commit identity · docs(t15a-r) this commit (both non-workflow; push ACCEPTED)
rejected_forward_commits=4e79600 ops(t15a-r) workflow patch applied · 917ce63 test(t15a-r) unconditional guardrails (push REJECTED: no `workflows` permission,
  twice incl. after credential rotation; preserved verbatim in t15a-r/r2-wired-series.mbox, sha256 in the sibling .sha256 file; `git am` on eecbbf0 → 917ce63 tree)
workflow_patch=APPLIED LOCALLY, NOT ON REMOTE — tracked patch sha256 1d5097a571c8e4826e9436920c7c427fd8ee5753e853c7891f1243e6333bb8e4 verified; `git apply --check` clean;
  local `git diff` sha256 identical to the tracked patch (semantics match: staging+production use wait-for-deployed-release.mjs after
  post-deploy-smoke; catalog step after verify / before d1-schema-gate.sh remote; inputs.migration via env; chain-aware descriptions;
  permissions contents:read/actions:read; workflow_dispatch only; cancel-in-progress:false; environment: production)
remote_workflow_files=IDENTICAL TO MAIN (deploy.yml, production-d1-migrate.yml) — T15A workflow wiring is NOT shipped on the remote branch
commit_identity_contract=/^[a-f0-9]{40}$/ — missing/null/empty/short/uppercase/non-hex/non-string → immediate FAIL (no code); different valid SHA on healthy
  correct-environment body → RELEASE_PROPAGATION_PENDING (only retryable class); wrong env or unhealthy + valid different SHA → immediate FAIL
guardrails=unconditional (no `it.skip` wiring gate); against unwired main workflows they FAIL (verified by stashing the workflow diff); wired: PASS
  (that unconditional version lives only in the rejected 917ce63 / mbox series; the PUSHED head keeps the self-activating guardrails
  from 7241cc8, which skip 2 workflow-wiring tests while the remote workflow files equal main)
focused_tests(local wired tree 917ce63)=123 passed / 0 skipped (release-check 70, wait-for-deployed-release 22, d1-migration-check 23, d1-schema-gate 8)
focused_tests(pushed tree eecbbf0)=release-check 69 (67 passed / 2 skipped unwired) + wait-for-deployed-release 22 passed
full_gates(local wired tree)=recipe:seed:check PASS · recipe:import:check PASS · typecheck PASS · lint PASS · check:migrations PASS · build PASS ·
  pnpm test 173 files / 3969 tests PASS (7m13s; previous baseline 3943, +26 new) · git diff --check clean
migration_integrity=migrations/ diff vs origin/main = 0; 0036 04228788e60d59a2427d70956d4d8a108d0a6c1c4a643c47641402f658120ba9;
  0037 68e52e6d8b9d44054f609a3d405c9fa329d093521ffc8c97009c76fbf7317ad6; 0038_created=NO
application_safety=src/ diff vs main = 0; ALL_RECIPES=71 static; shipped catalog expectation 500 / approved batches 2; T09/T11 unchanged;
  new inventory writers 0; PayOS/payment/auth untouched
production_safety=D1 write NO · R2 write NO · deploy NO · authority switch NO · production-d1-migrate.yml dispatch NO · media NO · T14G NO
historical_production_tip=0034 (NOT re-queried live in T15A-R2; Phase B must re-query before any mutation)
P3_FUTURE_MEDIA_GATE_COMPATIBILITY=open (catalog requires media_ready=0; revisit before any post-media migration)
merge=NOT PERFORMED (merge gate unmet: workflow files not on remote); main_CI=n/a; staging_convergence=n/a; production_job=n/a
final_PR_head=309d049e17c692d197e4c03660e6e992ab1cd764 (local == remote; VERIFIED_LIVE) — exact-head validate run 35304048116 / job 105472477135 SUCCESS
PR_state=OPEN draft=NO merged=NO mergeable=MERGEABLE/CLEAN unresolved_threads=0 (must NOT merge: wiring absent on remote)
```

## T15A-R2 wired-branch receipt (2026-09-18T09:2xZ) — superseded by the final receipt below

```text
classification=T15A_R2_WIRED_PRE_MERGE (state at 09:2xZ before the merge was observed)
origin_main=70cf7e0dae675ca19efbac2ceed0d1380d837024 (unchanged; VERIFIED_LIVE)
branch_commits_after_309d049=d01f547 docs CI binding (App push) · 366dbd1 ops(t15a-r) workflow patch applied · 776422f test(t15a-r) unconditional guardrails
  (366dbd1/776422f = the r2-wired-series.mbox commits published via the platform's authorized publisher; forward-only from d01f547; no rebase/force)
workflow_wiring=ON REMOTE BRANCH — `git diff origin/main..branch -- .github/workflows` equals t15a-r/workflows.patch (1d5097a5…) minus index lines;
  .github + scripts + tests tree identical to the locally certified 917ce63 (`git diff 917ce63 branch -- .github scripts tests` empty)
remote_workflow_files=deploy.yml + production-d1-migrate.yml DIFFER FROM MAIN as intended (staging+production use wait-for-deployed-release.mjs after
  post-deploy-smoke; catalog step after verify / before d1-schema-gate.sh remote; inputs.migration via env; chain-aware descriptions;
  permissions contents:read/actions:read; workflow_dispatch only; cancel-in-progress:false; environment: production; no direct `run:` input interpolation)
guardrails=unconditional on the branch head (no wiring skip); focused_tests=123 passed / 0 skipped on 776422f (release-check 70, wait 22, d1-migration-check 23,
  d1-schema-gate 8) VERIFIED_LOCAL; full gates certified on the identical code tree (917ce63): 173 files / 3969 tests PASS, seed/import/typecheck/lint/
  check:migrations/build PASS; hosted exact-head validate on 776422f: run 35328638198 SUCCESS
migration_integrity=migrations/ diff vs main = 0; 0036 04228788…; 0037 68e52e6d…; 0038_created=NO (re-verified on 776422f)
production_safety=D1 write NO · R2 write NO · deploy NO · authority switch NO · production-d1-migrate.yml dispatch NO · media NO · T14G NO
historical_production_tip=0034 (NOT re-queried live; Phase B must re-query before any mutation)
PR_state=OPEN draft=NO merged=NO mergeable=MERGEABLE/CLEAN unresolved_threads=0
```

## T15A-R final receipt (2026-09-18T09:3xZ, VERIFIED_LIVE) — pre-production hardening COMPLETE

```text
classification=T15A_PRE_PRODUCTION_HARDENING_COMPLETE  P0=0 P1=0 release_blocking_P2=0 P3=1 (P3_FUTURE_MEDIA_GATE_COMPATIBILITY)
T15A_R_CERTIFIED_HEAD=776422fb7b141669df7a29973bbf4ac0a5516a01 (PR #27 head at merge; exact-head validate run 35328638198 SUCCESS)
merge=PR #27 merged by maintainer vn-dlo at 2026-09-18T09:21:22Z via merge commit (2 parents; not squash/rebase); merge performed by a human, not by the agent
T15A_R_MERGE_SHA=0fe2cf071693208f6c642d8cbd994f5a79b5a2cf = origin/main (VERIFIED_LIVE)
merge_tree=certified head 776422fb is ancestor of main YES · old main 70cf7e0d is ancestor of main YES · `git diff 776422fb 0fe2cf07` = 0 files
main_CI=push validate run 35329100767 / job 105549031408 SUCCESS on exact SHA 0fe2cf07
staging=automatic Deploy run 35329500028 (workflow_run on 0fe2cf07): release job 105550302971 SUCCESS · staging job 105550350571 SUCCESS ·
  production job 105550351700 SKIPPED (no production deploy)
staging_convergence=helper `wait-for-deployed-release.mjs` used (log: "attempt 1: readiness identifies release 0fe2cf07 in staging");
  receipt artifact release-staging-35329500028-1: deployed.sha=0fe2cf071693208f6c642d8cbd994f5a79b5a2cf environment=staging attempts=1 waitedMs=547;
  staging Worker version 479efd73-12c0-4403-93e9-9bbfd8ee85ef; post-deploy smoke ok (landing 200, liveness 200, readiness ok/db ok/staging)
workflow_wiring_on_main=deploy.yml (staging+production via helper) + production-d1-migrate.yml (catalog after verify, before schema gate; env-passed input;
  chain-aware descriptions; contents:read/actions:read; workflow_dispatch only) — identical to t15a-r/workflows.patch (consumed audit evidence)
late_docs_commit=637a848 (docs only) was pushed to the PR branch ~3 min after the merge and is NOT in main; its content is re-applied by the follow-up docs PR
  that carries this receipt
production_safety=D1 write NO · R2 write NO · production deploy NO (job SKIPPED) · authority switch NO · production-d1-migrate.yml dispatch NO (0 runs) ·
  media NO · T14G NO · T09/T11 unchanged · migrations/ unchanged (0036 04228788…, 0037 68e52e6d…, no 0038)
historical_production_tip=0034  live_production_tip_requeried=NO (Phase B must re-query the live ledger before any mutation)
```

**Next phase (T15A Phase B — separate session, operator approval):** start from the live production state; see the
resume requirements below. Do not dispatch `production-d1-migrate.yml`, deploy production, or enable shadow
without that authorization.

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
