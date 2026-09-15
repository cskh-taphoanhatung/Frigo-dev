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
CURRENT_PRE_DOCS_HEAD=c8acd0aa5ae746aeed628c6ca730ac26d71c3b4b
PREVIOUS_HOSTED_CI=34968469709 validate PASS
BRANCH_PROTECTION=ENABLED
REQUIRED_APPROVALS=1
REQUIRED_STATUS=validate
FORCE_PUSH=BLOCKED
BRANCH_DELETE=BLOCKED
FINAL_CANONICAL_MAIN=UNCHANGED d1b06732f8a80db4e77986df31ff28d9f04641fa
MERGED=NO
PRODUCTION_DEPLOYED=NO
REMOTE_PRODUCTION_MIGRATIONS=NO
T14_STARTED=NO
```

## Canonical repository status

**READY FOR INDEPENDENT REVIEW / MERGE.** Application integration is complete
at immutable freeze `5f6853d0ed11415871dca0fd31ff28d9f04641fa` and promotion
PR #2 is open. The docs head created after this receipt must receive an exact-
head `CI / validate` PASS, followed by one independent approving review.

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
