# Integration handoff

## Full canonical-consolidation audit handoff — 2026-09-15

Status: **PLAN COMPLETE; CURRENT CANDIDATE NOT PRODUCTION-READY**.

The authoritative repository-promotion plan is
`CANONICAL_REPOSITORY_CONSOLIDATION_PLAN.md`; it contains the independent
strengths/weaknesses matrix and merge decisions. Production frontend and
platform upgrade tips are already represented by adapted main lineages, so they
must be semantically checked but not cherry-picked again.
Qwen source `da41686` is 15 commits ahead of production `main` and remains a
required integration source; it is not already in production.
Migration numbering has one confirmed collision (`0023`); the canonical
`0001`-`0023` + `0024`-`0033` bridge is correct by filename/blob mapping.

The separate production rollout plan still has a blocker: canonical `0032`
creates a review-state trigger that rejects
the current production Worker's legacy confirmation update. The integrated
Worker also assumes the new columns exist. A compatibility release and rolling
pre/post-0032 rehearsal are required before any production migration/deploy.
The failure was reproduced locally with real migration SQL. No remote state,
production resource, merge, deployment or payment path was changed.

Required production-rollout sequence: create and independently release a
schema-compatible
Worker from production `05423f2`; after it is merged and serving all traffic,
freeze the new production head and use three release trains: Qwen/runtime,
T08-T13 plus migrations, then Takosan brand-only. Each starts from the prior
deployed head. Do not deploy current `f26003b` directly; repository promotion
is a separate history-preserving gate.

The repository deploy workflow automatically deploys staging after successful
CI on a `main` push. Therefore Train B cannot merge until canonical staging D1
is already at `0033` under the compatible Qwen Worker. Production remains a
separate manual confirmed dispatch.

Audit checks executed: repository metadata/API permission lookup; branch heads,
merge-base, ancestry and diff inventories; all-fetched-ref migration variant
scan; certified-source/bridge Git-blob comparison; production and integrated
scan SQL inspection; two in-memory SQLite ordering probes; `git diff --check`;
and protected-path diff inspection. The negative probes exited `1` with the two
expected schema errors recorded in `TEST_MATRIX.md`. No application suite was
rerun because this continuation changes documentation only. One initial shell
ancestry loop and one text-search command had quoting/word-splitting errors;
both were rerun with direct commands and did not modify files.

## Historical independent-review remediation handoff — 2026-09-15

Status: **FIXES COMPLETE AND LOCAL GATES GREEN**.

The old candidate `e34ed16777166407acf67b2c76d733d89c7d64ca` failed
independent review. Remediation is committed as `5f6853d` on top of branch HEAD
`231d1e7`; the immutable application candidate is now `5f6853d`.

- Protected `VietQRModal.tsx` and `PlusPaywallPage.tsx` are restored exactly to
  `PRODUCTION_BASE`; payment diff to base is empty.
- The production scan integration test no longer mocks `@frigo/ai`; it uses real
  Qwen routing/runtime and mocks only DashScope HTTP through queue persistence
  and T13 confirmation.
- Missing, `0`, `.11` and `.9` confidence is retained truthfully. Low confidence
  remains reviewable draft evidence; generic labels remain unusable.
- Disabled escalation preserves the previous typed provider/validation failure.
- Brand enforcement excludes the protected payment surfaces. Auth intentionally
  retains T13 DEC-012 `INVENTORY_TRANSFER_DEFERRED` behavior.

Checks: focused `41/41`; affected matrix first ran `300/302` with two expected
brand-scope failures, then brand `16/16`; full Vitest `3630/3630` in 149 files;
lint, typecheck, migration smoke, build and diff check PASS; browser `60/60`
serial at 360/390/430 PASS. No deploy, merge, push or remote resource mutation.
Two intermediate typechecks rejected incorrect spy annotations; the final
`MockInstance<typeof globalThis.fetch>` form and focused `57/57` rerun pass.

Access: current GitHub identity `Tungjpstore` is `ADMIN` on production and
`WRITE` on Frigo-dev. Both default heads are unchanged and both repos allow the
configured merge methods with no protection/rulesets returned. The local
`origin` is unrelated (`Tungjpstore/yaji`), so any later authorized publication
must target the verified production repository explicitly.

Next: perform another independent review against immutable SHA `5f6853d`.

Status: **HISTORICAL ANALYSIS CHECKPOINT — SUPERSEDED BY THE REMEDIATION HANDOFF ABOVE**.

- Repository identity and both source repositories are verified by numeric ID.
- `PRODUCTION_BASE=05423f2ad675006a4c7913e696f1979b3fcaae59`.
- `COMMON_BASE=d1b06732f8a80db4e77986df31ff28d9f04641fa`.
- Integration branch `integration/t13-takosan-qwen` starts exactly at the
  production base and passes the base-ancestor check.
- Production migration maximum is 23; bridge starts at 24.
- No production resource, remote D1, deployment, main merge, PayOS path, or T14
  work has occurred.

Historical next action completed by the final application handoff below.

## Final application handoff — 2026-09-15

Status: **HISTORICAL CANDIDATE — FAILED INDEPENDENT REVIEW AND SUPERSEDED**.

```text
WORKING_BRANCH=integration/t13-takosan-qwen
PRODUCTION_BASE=05423f2ad675006a4c7913e696f1979b3fcaae59
COMMON_BASE=d1b06732f8a80db4e77986df31ff28d9f04641fa
QWEN_SOURCE=da41686bb8613af9d0a487496d72479d04cb0d70
T13_APPLICATION_FREEZE=32ddbb4f2bb636fdcf201e9ca99c4689d3655477
T13_INDEPENDENT_REVIEW=9c3c3d3b842685f1b8ad82746621f4f5c41962f1
TAKOSAN_APPLICATION_SOURCE=ff63edfbde2857769d466b232d96b432c67f02d2
INTEGRATION_APPLICATION_CANDIDATE=e34ed16777166407acf67b2c76d733d89c7d64ca
INTEGRATION_DOCS_HEAD=c14116e3f979f90ca42ec21187c1aa55d319185b
```

Production identity is verified as `Tungjpstore/Frigo` (ID `1360256196`) and
`main` remains exactly `PRODUCTION_BASE`. The candidate preserves production
Qwen/runtime capabilities, certified T13 evidence and authority, hardened
Takosan branding, and the additive byte-identical migration bridge `0024`-`0033`.

Receipt: frozen install, lint, typecheck, migration smoke, build, full Vitest
`3628/3628` in 149 files, real local D1 `92/92` in 5 files, browser `60/60`
serial at 360/390/430, production migration changes `0`, bridge mismatches `0`,
and unknown inventory writers/readers `0/0`. P3-1 and P3-2 remain unchanged.

**NO HOSTED GITHUB CI STATUS FOR INTEGRATION_APPLICATION_CANDIDATE**

Next: create the docs-only checkpoint, verify candidate-to-docs is documentation
only, push only `integration/t13-takosan-qwen` without force, fetch, verify local
equals remote and production `main` still equals `PRODUCTION_BASE`, then await
independent integration review. No PR, deploy, remote migration, PayOS/payment
work, production resource mutation, or T14.
