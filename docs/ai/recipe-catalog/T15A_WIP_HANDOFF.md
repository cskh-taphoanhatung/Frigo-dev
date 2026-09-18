# T15A — production rollout preflight handoff (T15A + T15A-R)

## T15P continuation checkpoint — 2026-09-18

PR #27 workflow wiring is now on canonical `main` after normal merge commit
`0fe2cf071693208f6c642d8cbd994f5a79b5a2cf`. Certified PR head `776422fb…` had exact-head CI
`35328638198` / `105547551265` SUCCESS; merge tree delta to main was 0; exact-main CI
`35329100767` / `105549031408` SUCCESS. Automatic Deploy `35329500028` passed release and staging,
skipped production; staging Worker `479efd73-12c0-4403-93e9-9bbfd8ee85ef` converged on SHA `0fe2cf0…`
in 1 attempt / 547 ms.

Production migration run `35329772751` was dispatched from `main` with target 0037 and is waiting for the
required `production` Environment reviewer `vn-taphoanhatung` after its exact-SHA gate. The current identity
cannot approve. No production mutation has started and the live pre-ledger receipt is not yet available.
Classification: `T15P_BLOCKED_PRODUCTION_ENV_APPROVAL`. Resume only after authorized approval, then inspect
the sanitized pre-ledger/identity/Time Travel receipts before allowing the pinned chain to apply. No canary,
full D1, media/R2 or T14G.

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
  **Status (T15A-R2): APPLIED AND COMMITTED LOCALLY, PUSH REJECTED AGAIN** — the patch was applied
  (`git apply` clean; resulting `git diff | sha256sum` byte-identical to `t15a-r/workflows.patch`,
  `1d5097a5…`) and committed forward-only as `4e79600` (workflows) + `917ce63` (unconditional guardrails),
  but GitHub rejected the push of both commits: `refusing to allow a GitHub App to create or update
  workflow .github/workflows/deploy.yml without workflows permission` (twice, including after credential
  rotation). Those two commits are tracked verbatim as a `git am` series in
  `t15a-r/r2-wired-series.mbox` (+ `.sha256`); applying it on top of `eecbbf0` reproduces the `917ce63`
  tree exactly (verified in a throwaway worktree). The workflow files on the remote branch are still
  identical to `main`.
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

## Blocker (still live after T15A-R2): the App credential cannot push `.github/workflows/*`

During T15A-R and again in T15A-R2 the credential was rejected on workflow files (`without workflows
permission`). Two artefacts now carry the intended change: `t15a-r/workflows.patch` (raw workflow diff,
`1d5097a5…`) and `t15a-r/r2-wired-series.mbox` (the two ready-made commits: workflows + activated
guardrails; apply with `git am docs/ai/recipe-catalog/t15a-r/r2-wired-series.mbox` on top of the branch
head). A maintainer with `workflows` scope must push them (or grant the App `workflows`) before PR #27 can
be merged and before any production migration is dispatched. Do not bypass this with alternate APIs.

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

## T15A-R2 safe stop (2026-09-18T03:4xZ, VERIFIED_LIVE)

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

**Next session (resume rule, T15A-R2 → R3):** fetch; verify `origin/main` (`70cf7e0d…` at this stop) and the
PR #27 head live; then, with a credential that has `workflows` scope (or a maintainer), `git checkout` the
branch head and `git am docs/ai/recipe-catalog/t15a-r/r2-wired-series.mbox` (verify the `.sha256` first),
run `pnpm vitest run tests/unit/release-check.test.mjs tests/unit/wait-for-deployed-release.test.mjs
tests/unit/d1-migration-check.test.mjs tests/integration/d1-schema-gate.test.ts` (expect 0 skips), push,
require exact-head CI SUCCESS, update the PR body, then (separately authorized) merge with an expected-head
guard, require exact-main CI SUCCESS, observe the automatic staging deploy (release+staging SUCCESS,
production SKIPPED, exact-SHA convergence via the helper). Do not dispatch `production-d1-migrate.yml`,
do not deploy production, do not enable shadow.

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
