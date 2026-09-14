# Production consolidation analysis

## Divergence classification

The production/Qwen side changes 45 paths from `PRODUCTION_BASE`. The
Takosan/T13 side changes 308 paths from `COMMON_BASE`. Nine paths overlap:

- `docs/ai/CURRENT_STATE.md`
- `docs/ai/HANDOFF.md`
- `docs/ai/TASK_BOARD.md`
- `package.json`
- `packages/ai/src/providers/cloudflare.ts`
- `packages/ai/src/schemas.ts`
- `src/web/components/scan/CameraViewfinder.tsx`
- `src/worker/routes/scans.ts`
- `src/worker/services/scan-queue.ts`

| Group | Classification |
| --- | --- |
| `PRODUCTION_ONLY` | Qwen task runtime/governance, provider error handling, request fingerprint, quota/idempotency reconciliation, R2/queue hardening, readiness/config, client image normalization |
| `DEV_ONLY` | T08-T13 lot/evidence/authority modules, Takosan assets/UI, adoption/reconciliation surfaces, browser harness and authority tests |
| `BOTH_CHANGED` | The nine paths listed above |
| `MIGRATION_COLLISION` | Production `0023_scan_request_fingerprint.sql` versus development `0023_inventory_truth_foundation.sql`; development `0023`-`0032` must become production `0024`-`0033` |
| `CONFIG_COLLISION` | `package.json`, lockfile intent, Wrangler AI vars and browser scripts |
| `AI_RUNTIME_COLLISION` | Cloudflare provider schemas/normalization and `AIRouter` composition |
| `SCAN_PIPELINE_COLLISION` | Scan route and async queue persistence |
| `FRONTEND_COLLISION` | Camera upload preprocessing plus the Takosan/T13 scan surfaces |
| `TEST_COLLISION` | Production Qwen/queue tests and T13/brand/browser suites must all survive |
| `DOCS_ONLY` | Historical state packets from both repositories; integration docs become current authority for this branch |

## Production preservation matrix

| Feature | Production path | Development path | Resolution | Proof |
| --- | --- | --- | --- | --- |
| Qwen/DashScope runtime | `packages/ai/src/task-runtime.ts`, Qwen provider, Worker AI config | Existing generic providers | Preserve production runtime; feed T13 scan evidence contract | Provider/runtime and queue integration tests |
| Typed provider errors | `packages/ai/src/errors.ts` | Legacy provider behavior | Preserve production classification | Provider error tests |
| Async queue | `src/worker/services/scan-queue.ts` | T13 evidence persistence changes same consumer | Combine queue fencing/retry with all `ocr_*` fields | Real consumer persistence matrix |
| R2 image flow | scan route/queue image keys | Compatible T13 route | Preserve production object-reference path | Scan async/R2 tests |
| Request fingerprint | production migration `0023`, scans route | T13 confirmation flow | Preserve unchanged migration and fingerprint fields | Migration hash audit and confirmation regression |
| Quota/idempotency | scan quota services and route | T09 command receipts | Preserve both fences; no duplicate T09 effects | Replay regression |
| Quality gate | production AI normalization/quality gate | T13 raw evidence | Reject/classify without rewriting confidence | Missing/0/.11/.9 tests |
| Readiness/config | Worker config/health/scripts | Additional schema requirements | Extend additively | Config and schema gate tests |

## Conflict-resolution rule

Every overlapping application path retains both intents. No bulk ours/theirs
resolution was used; the final resolution table follows.

## Final resolution and preservation receipt — 2026-09-15

The application candidate is `e34ed16777166407acf67b2c76d733d89c7d64ca`.
The Qwen merge checkpoint is `9c78c1ac9c3927b110c3cd25176ac3f5ff004835`; the
T13/Takosan merge checkpoint is `c50dc76fbbb2e1150ed7be5d9cfa7a6bb64d9dd7`.
No unrelated-history merge or bulk ours/theirs resolution was used.

| Path/group | Resolution | Proof |
| --- | --- | --- |
| `package.json` / lockfile | Semantic union of Qwen runtime, browser tooling, and direct `sharp@0.33.5`; frozen install passes | `pnpm install --frozen-lockfile`, build |
| AI schemas/provider/quality | Preserve production typed provider/runtime behavior while accepting nullable T13 evidence; no confidence rewrite | Qwen/provider, quality, and queue evidence suites |
| Scan route + queue | Production fingerprint/quota/fencing/R2 flow feeds T13 raw evidence and T09 commands/T10 observations; status commits last | `production-integration-scan-flow`, queue fencing/retry, T13 suites |
| Camera/UI | Preserve production image preprocessing with Takosan styling and assets | Brand tests and browser `60/60` |
| Migrations | Keep production `0023_scan_request_fingerprint.sql` byte-identical; add T13 `0024`-`0033` byte-copied bridge | Hash audit, bridge test, migration smoke |
| State docs | Preserve historical records and add current integration authority sections | Candidate-to-docs diff is docs-only |

Post-merge authority audit: `UNKNOWN INVENTORY WRITERS=0`,
`UNKNOWN CANONICAL READERS=0`; T09 remains mutation authority and T11 remains
canonical read authority. Household/receipt/lot ownership, private-session,
Week compatibility, and queue tenancy remain covered. No PayOS/payment,
billing, checkout, webhook, auth, secret, DNS, or production infrastructure
behavior was intentionally changed.
