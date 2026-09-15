# T14A / T14B-A integration refresh

## Scope and canonical identity

Reconcile approved T14 knowledge and safety tooling with the newer Auth/OCR
production lineage. No redesign, T14B-B, recipe-data change or deployment.

```text
repo=vn-clo/Frigo-dev
repository_id=1368281478
CURRENT_MAIN=055913596acd3bef049aa0eb007bde2873a658a9
T14A_AUDIT_BASE_MAIN=345cecf388321a00c96be387744a10e8c98bd9ac
PR7_STATE=open,draft
PR7_HEAD=769e0532fadc95018bc1aedc01a36b396b91a974
PR7_BASE=main (historical base SHA 345cecf388321a00c96be387744a10e8c98bd9ac)
PR8_STATE=open,draft
PR8_HEAD=4a1fa07cbc9c22e393234bcba9212ca2ef887d65
PR8_BASE=hoplite/koroneia-838b0ccc
PR4_STATE=open; recommended disposition=CLOSE_ARCHIVE; no action taken
PR9_MERGE_SHA=911db7fdddcd60ea1e3f3c17b4aed3f4b922bda5
PR10_MERGE_SHA=055913596acd3bef049aa0eb007bde2873a658a9
```

Fresh brokered fetches used explicit branches (the authorized equivalent of the
requested all-ref fetch; no wildcard fetch or branch rewrite). Public repository
metadata confirmed the canonical name, numeric ID and default branch. The
pre-existing `.hoplite/settings.json` modification was saved in a named local
stash and a private patch, excluded from all integration commits.

## Production-preservation baseline

`git diff --name-status 911db7f origin/main` contains exactly five docs paths:
`PROJECT_STATUS.md`, `TASK_BOARD.md`, `docs/ai/CURRENT_STATE.md`,
`docs/ai/HANDOFF.md`, `docs/ai/TASK_BOARD.md`. The application-path diff is empty.
PR #9 contains the Auth/GIS popup fix, OCR pending UX and SPA/API COOP distinction;
none of its source, public-header or regression-test changes may be replaced.
Old audit base → current main has no recipe-package, recipe-reader, recipe-route,
planner-source, recipe-media or migration changes.

Current recorded production application merge:
`911db7fdddcd60ea1e3f3c17b4aed3f4b922bda5`.
Current recorded production Worker version:
`20bc1f35-6ffe-4085-ba79-d54a0b53da71` (100% custom-domain rollout, PR #10
receipt). This supersedes `e6b9195`; it is existing release evidence, not a fresh
deployment or production probe by this task.

## Integration sequence

1. T14A: semantic docs-only reconciliation on
   `hoplite/poteidaia-c88481ca`, directly from `0559135`. Preserve the full audit,
   label its old lineage historical, and retain PR #9/#10 production receipts.
2. Require fresh local gates and exact-head hosted `validate` before normal merge.
3. Start a fresh authorized thread branch from that resulting main; apply only
   PR #8's accepted T14B-A delta. Preserve all accepted functional blobs.
4. Require fresh local safety evidence and exact-head hosted validation before
   normal merge. T14B-B remains blocked until both integrations actually land.

The source PRs #7/#8 are historical references, not branches to merge blindly.
Historical CI runs on their old lineage do not certify this integration.

## Verification checkpoint

- `pnpm install --frozen-lockfile`: exit 0, Node 24.19.0 / pnpm 10.26.0.
- Canonical setup's SQLite prerequisite installed locally; no config change.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:migrations`,
  `pnpm build`, `git diff --check`: all exit 0. Full Vitest: **151 files /
  3633 tests passed**; migration smoke: `migration-smoke=ok`.
- `sha256sum -c` on the 33-file baseline: all OK after the full suite.
- `git diff --exit-code origin/main -- src packages migrations public package.json
  pnpm-lock.yaml wrangler.jsonc scripts tests`: exit 0, empty. Working-tree changes
  are exclusively the seven T14A integration documentation paths.
- Exact-head hosted integration CI: pending publication, not replaced by old CI.
- Migration SHA-256 baseline captured for all 33 files before any test execution.
- No merge or production action performed at this checkpoint.

## Separate OPS / RELEASE blocker

Starting-main CI run `35030996228`, head `0559135`: **SUCCESS**.
Deploy run `35031212139`: release **SUCCESS**, staging **FAILURE**, production
**SKIPPED**. Job `104589946815` failed at “Deploy to Cloudflare staging” with
Wrangler's non-interactive `CLOUDFLARE_API_TOKEN` requirement.

`DEPLOY_WORKFLOW_BLOCKER=CLOUDFLARE_API_TOKEN_MISSING_IN_STAGING_ENV`

This is not a T14 application regression. Do not change secrets/workflows or
manually deploy. Configured automatic staging attempts after merges may fail for
the same reason; record them separately. Production requires a separate explicit
release decision and is not authorized by this task.

## Safety and next action

No force-push/history rewrite; no PR #4 merge; no migration 0034; no production
D1/R2/KV/queue, secret, DNS, PayOS, Qwen, Inventory Truth or media/CSP change.
Runtime authority stays `ALL_RECIPES`, 71 recipes (59 Vietnamese + 12 global).
Next action: publish the locally verified T14A docs-only integration, obtain exact-head
hosted CI, then merge through normal protection. **T14B-B NOT STARTED.**
