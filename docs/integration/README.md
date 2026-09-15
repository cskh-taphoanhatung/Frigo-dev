# Production integration candidate

## Current canonical-consolidation status — 2026-09-15

The authoritative repository-promotion plan is
[`CANONICAL_REPOSITORY_CONSOLIDATION_PLAN.md`](CANONICAL_REPOSITORY_CONSOLIDATION_PLAN.md).
It now includes the independent strengths/weaknesses matrix for production and
Frigo-dev, the complete upgrade inventory, the `0023` collision decision and
the exact gaps that remain after composition. The target canonical repository is
`vn-dlo/Frigo-dev`; no push, PR, merge or deployment is authorized by this
planning update.

[`SAFE_PRODUCTION_MERGER_PLAN.md`](SAFE_PRODUCTION_MERGER_PLAN.md) remains the
separate production rollout plan. Its pre/post-`0032` compatibility blocker is
still real and must be solved before remote bridge migrations or production
deployment, but it does not justify re-integrating or dropping certified Git
lineage during repository promotion. Historical production tips `fafe1cc`,
`2052932` and `089c406` must not be cherry-picked when their adapted behavior is
already in production `main`; Qwen `da41686` remains the explicit missing source.

## Historical independent-review remediation — 2026-09-15

Status: **REMEDIATED AND VALIDATED LOCALLY; SUPERSEDED AS RELEASE AUTHORITY BY
THE MERGER PLAN ABOVE**.

The reviewed application candidate `e34ed16777166407acf67b2c76d733d89c7d64ca`
is superseded by remediation commit `5f6853d` on top of `231d1e7`. Protected payment
UI is restored byte-for-byte to `PRODUCTION_BASE`; its candidate-to-base diff is
empty. The Takosan brand tests now explicitly exclude those protected payment
surfaces instead of requiring payment edits.

The production integration scan regression now composes the real `AIRouter`,
`QwenTaskRuntime`, Qwen provider, queue consumer, migrated SQLite persistence and
T13 confirmation. Only synthetic DashScope HTTP is mocked. Missing, `0`, `.11`
and `.9` confidence survive without fabrication; low-confidence usable labels
remain reviewable evidence, while generic labels are rejected. Runtime
escalation also preserves the concrete preceding provider/validation error when
a later role is disabled.

The only intentional auth behavior difference from production remains certified
T13 DEC-012: guest inventory transfer is safely deferred with
`INVENTORY_TRANSFER_DEFERRED`; it is not a payment or unrelated auth rewrite.

Fresh remediation checks: focused scan/runtime/router `41/41`; broader affected
matrix `300/302` initially failed only the two over-broad brand assertions, then
brand `16/16` passed after scoping; full Vitest `3630/3630` in 149 files; lint,
typecheck, migration smoke, build and `git diff --check` pass; browser `60/60`
passes serially at 360/390/430. No deploy, push, merge or remote mutation occurred.

Access preflight is sufficient for a future controlled publication/merge:
GitHub account `Tungjpstore` has `ADMIN` on `Tungjpstore/Frigo` and `WRITE` on
`vn-dlo/Frigo-dev`; both repositories are active and their default heads remain
`05423f2` and `d1b0673`. Neither repository reports branch protection or active
rulesets. Local safety caveat: `origin` points to `Tungjpstore/yaji`; use the
explicit production repository/verified production remote, never a blind
`git push origin`, if publication is later authorized.

This packet records the semantic integration of the current production line,
the production Qwen runtime candidate, certified T13 Inventory Truth, and the
hardened Takosan application. It is an integration-review artifact only.

## Fixed authorities

| Field | Value |
| --- | --- |
| Production repository | `Tungjpstore/Frigo` |
| Production repository ID | `1360256196` |
| Production default branch | `main` |
| `PRODUCTION_BASE` | `05423f2ad675006a4c7913e696f1979b3fcaae59` |
| Qwen source | `da41686bb8613af9d0a487496d72479d04cb0d70` |
| Development repository | `vn-dlo/Frigo-dev` |
| Development repository ID | `1368281478` |
| `COMMON_BASE` | `d1b06732f8a80db4e77986df31ff28d9f04641fa` |
| T13 application freeze | `32ddbb4f2bb636fdcf201e9ca99c4689d3655477` |
| T13 review #2 | `9c3c3d3b842685f1b8ad82746621f4f5c41962f1` |
| Takosan application source | `ff63edfbde2857769d466b232d96b432c67f02d2` |
| Takosan docs source | `60ab7d40649084ac046f0f941571d4bb517dcaf8` |
| Integration branch | `integration/t13-takosan-qwen` |

The production branch is not merged or modified by this work. Deployment,
remote D1, production R2/KV/queues, secrets, PayOS, and T14 are out of scope.

## Execution order

1. Release a minimal pre/post-0032 compatibility Worker from production main.
2. Integrate and independently release Qwen/runtime with no new migration.
3. Integrate and independently release certified T08-T13 plus `0024`-`0033`.
4. Apply Takosan as a final brand-only train with zero payment/migration change.
5. Start each train from the exact preceding deployed production SHA and repeat
   local, hosted, staging and production gates for that train.

See `PRODUCTION_CONSOLIDATION.md`, `T13_MIGRATION_BRIDGE.md`, `TEST_MATRIX.md`,
and `HANDOFF.md` for the final evidence.

## Historical final certification — 2026-09-15

Status: **HISTORICAL CERTIFICATION OF THE REVIEWED CANDIDATE; SUPERSEDED BY THE
REMEDIATION SECTION ABOVE**.

| Field | Value |
| --- | --- |
| `PRODUCTION_BASE` | `05423f2ad675006a4c7913e696f1979b3fcaae59` |
| `COMMON_BASE` | `d1b06732f8a80db4e77986df31ff28d9f04641fa` |
| Qwen source | `da41686bb8613af9d0a487496d72479d04cb0d70` |
| T13 freeze / review | `32ddbb4f2bb636fdcf201e9ca99c4689d3655477` / `9c3c3d3b842685f1b8ad82746621f4f5c41962f1` |
| Takosan source | `ff63edfbde2857769d466b232d96b432c67f02d2` |
| Application candidate | `e34ed16777166407acf67b2c76d733d89c7d64ca` |
| `INTEGRATION_DOCS_HEAD` | `c14116e3f979f90ca42ec21187c1aa55d319185b` |

Production repository identity is verified as `Tungjpstore/Frigo`, ID
`1360256196`; development identity is `vn-dlo/Frigo-dev`, ID `1368281478`.
Production `main` remains at `PRODUCTION_BASE`. The candidate preserves the
Qwen runtime, T13 evidence/authority chain, Takosan shell, and immutable
production migration `0023`; T13 migrations are byte-identical at `0024`-`0033`.

Historical candidate gates were green: frozen install, lint, typecheck,
migration smoke, build, full Vitest `3628/3628` (149 files), real local D1
`92/92` (5 files), and browser
`60/60` (serial, widths 360/390/430). Production migration changes `0`, bridge
blob mismatches `0`, and unknown inventory writers/readers `0/0`.

P3-1 and P3-2 remain intentionally unchanged. The remediation restores protected
payment UI to production base and retains DEC-012 auth deferral. No deployment,
main merge, remote D1/R2/KV/queue mutation, PayOS backend change, secret/DNS
change, or T14 work occurred.

**NO HOSTED GITHUB CI STATUS FOR INTEGRATION_APPLICATION_CANDIDATE**
