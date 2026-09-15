# Canonical repository migration record

## Current authoritative receipt

```text
CANONICAL_REPOSITORY=vn-dlo/Frigo-dev
CANONICAL_REPO_ID=1368281478
CANONICAL_BASE=d1b06732f8a80db4e77986df31ff28d9f04641fa
APPLICATION_FREEZE=5f6853d0ed11415871dca0fd31d4981d60518310
HISTORICAL_INTEGRATION_CANDIDATE=e34ed16777166407acf67b2c76d733d89c7d64ca SUPERSEDED
CANONICAL_REMOTE=canonical-frigo-dev
PROMOTION_BRANCH=canonical/5f6853d-promotion-ci
ARCHIVE_BRANCH_SHA=d1b06732f8a80db4e77986df31ff28d9f04641fa
PR_NUMBER=2
PR_TITLE=Promote certified Frigo/Takosan integration to canonical main
FINAL_REVIEWED_HEAD=7ede92c73a41da24500746fd0eded892689d8558
PR_HOSTED_CI=34972891435 validate PASS
POST_MERGE_CI=34973522150 validate PASS
EXTERNAL_TECHNICAL_REVIEW=APPROVED
REVIEWED_HEAD=7ede92c73a41da24500746fd0eded892689d8558
REVIEW_FINDINGS=P0=0 P1=0 P2=0
MAINTAINER_DECISION=External technical review accepted as sufficient for canonical repository consolidation
GITHUB_NATIVE_COLLABORATOR_APPROVAL=WAIVED BY EXPLICIT MAINTAINER DECISION
BRANCH_PROTECTION=ENABLED
REQUIRED_APPROVALS=0
REQUIRED_STATUS=validate
FORCE_PUSH=BLOCKED
BRANCH_DELETE=BLOCKED
MERGE_COMMIT=a5cfb14cfd5840be23eb16b26a3689f5e2d6e805
FINAL_CANONICAL_MAIN=a5cfb14cfd5840be23eb16b26a3689f5e2d6e805
MERGED=YES
MERGE_TREE_EQUALS_REVIEWED_HEAD=YES
STAGING_DEPLOYED=NO (staging configuration absent; deploy steps skipped)
PRODUCTION_DEPLOYED=NO
REMOTE_PRODUCTION_MIGRATIONS=NO
T14_STARTED=NO
```

## Canonical repository status

**CANONICAL REPOSITORY CONSOLIDATION COMPLETE.** PR #2 merged reviewed head `7ede92c` with history-preserving merge commit `a5cfb14`. The merge tree is identical to the reviewed head and all required source SHAs remain ancestors of `main`.
The exact PR CI run `34972891435` and post-merge main CI run `34973522150`
passed. The immutable application freeze remains
`5f6853d0ed11415871dca0fd31d4981d60518310`.

The maintainer has now accepted the external technical review for this
consolidation: P0=0, P1=0, P2=0. Branch protection still requires strict
`validate`, blocks force-push and deletion, and enforces admins; approval count
is zero under the recorded waiver.

## Production deployment status

**NOT AUTHORIZED / NOT READY FOR DIRECT ROLLOUT.** Repository promotion does not
certify production deployment. The rolling-schema compatibility issue around
canonical migration `0032` remains governed by
`SAFE_PRODUCTION_MERGER_PLAN.md`. This task authorizes no deployment, remote
D1 migration, KV/R2/queue mutation, PayOS change, secret change or DNS change.

## Historical / superseded state

- `e34ed16777166407acf67b2c76d733d89c7d64ca` was the earlier integration
  candidate and is superseded by `5f6853d0ed11415871dca0fd31d4981d60518310`.
- `231d1e76e0320133e047624eea2be546ff779bd6` was a prior published docs head.
- PR #1 and its missing-CI/admin-control notes were a prior attempt; PR #1 is
  closed and PR #2 is the current promotion PR.

## Invariants

- No re-integration, cherry-pick replay, history rewrite, squash or rebase.
- Production migrations `0001`-`0023` remain byte-identical.
- T08-T13 bridge is exactly canonical `0024`-`0033` with no mixed numbering.
- Payment, PayOS, secrets, DNS, remote D1/KV/R2/queues and deployment remain
  untouched by repository consolidation.
- The `0032` rolling schema compatibility blocker is recorded separately and
  cannot be silently converted into a production certification.
