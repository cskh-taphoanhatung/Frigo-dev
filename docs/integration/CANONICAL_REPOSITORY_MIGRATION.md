# Canonical repository migration record

Status: **TEMPLATE - NOT EXECUTED**

This record is reserved for the actual repository-authority transition. It must
not be treated as evidence that a push, PR, merge, branch-protection change or
deployment has occurred. The execution plan is
`CANONICAL_REPOSITORY_CONSOLIDATION_PLAN.md`; production rollout remains a
separate task governed by `SAFE_PRODUCTION_MERGER_PLAN.md`.

## Intended authority

- Old development source: `vn-dlo/Frigo-dev` main at `d1b06732f8a80db4e77986df31ff28d9f04641fa`
- Legacy production source: `Tungjpstore/Frigo` at `05423f2ad675006a4c7913e696f1979b3fcaae59`
- Certified application freeze: `5f6853d0ed11415871dca0fd31d4981d60518310`
- Previous published integration docs head: `f26003b6bd9f32f8cddda4119d0ced2f532c9017`
- New canonical repository: `vn-dlo/Frigo-dev` (repository ID `1368281478`)
- Intended promotion branch: `canonical/5f6853d-promotion`

## Required execution receipt

Populate only after independently verifying each item:

```text
CANONICAL_REPO_ID=
CANONICAL_BASE=
CANONICAL_REMOTE=
PROMOTION_BRANCH_SHA=
ARCHIVE_BRANCH_SHA=
CANONICAL_DOCS_HEAD=
PR_NUMBER=
HOSTED_CI_RESULT=
BRANCH_PROTECTION_RESULT=
FINAL_CANONICAL_MAIN=
```

## Invariants

- No re-integration, cherry-pick replay, history rewrite, squash or rebase.
- Production migrations `0001`-`0023` remain byte-identical.
- T08-T13 bridge is exactly canonical `0024`-`0033` with no mixed numbering.
- Payment, PayOS, secrets, DNS, remote D1/KV/R2/queues and deployment remain
  untouched by repository consolidation.
- The `0032` rolling schema compatibility blocker is recorded separately and
  cannot be silently converted into a production certification.
