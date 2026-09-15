# T08 — Inventory Truth Foundation

User-authorized 2026-09-09, repository confirmed `vn-2c/Frigo`.
This task runs independently of the T01–T07 production/release work on main.

2026-09-10 authorized amendment (DEC-006): the user approved publishing the full
T08 checkpoint on `hoplite/xanthos-7d942897` instead of the originally requested
`feature/t08-inventory-truth-foundation`. All references below to canonical
publication/checkout now mean the approved handoff branch. No other restriction
or T09 authorization changed.

## Start / takeover

1. Inspect clean/dirty Git state, branch, HEAD and fetched explicit origin/main.
2. Use only the approved handoff branch `hoplite/xanthos-7d942897` (DEC-006).
3. Read `../inventory-truth/MASTER_CONTEXT.md`, `CURRENT_STATE.md`, `TASK_BOARD.md`,
   `DECISIONS.md`, `VERIFICATION.md`, then the last 2–3 `SESSION_LOG.md` entries.
4. Diff Last Verified SHA..HEAD. State takeover summary before edits.
5. Do not merge/rebase newer main; record divergence/migration number collisions.

## Scope and contracts

Build only household storage locations, inventory lots, quantity/money/expiry/
provenance foundation, additive persistence, legacy backfill, compatibility
projection, diagnostic parity and tests. Audit existing callers before schema.
Preserve legacy inventory, event ledger, household commands, scan confirmation,
shopping import, cook completion and planner snapshots without runtime cutover.

Mandatory invariants: nonnegative representable exact quantity; valid known
ingredient FK; single-household location/lot and composite ownership relation;
durable unique synthetic legacy source; no duplicate retry writes; active synthetic
quantity parity; UNKNOWN != ZERO, ESTIMATED != CONFIRMED, OBSERVED != VERIFIED;
valid currency/minor digits/integer money; no invented purchase or expiry evidence.

## Gates

Focused domain/SQL tests, full `pnpm test`, `pnpm lint`, `pnpm typecheck`,
`pnpm check:migrations`, local D1 apply/schema gate, `pnpm build`, `git diff --check`.
Prove fresh replay and populated upgrade, retry idempotency, stale-source rollback,
quantity/storage/expiry/household preservation and unchanged legacy regressions.
Record exact commands/counts/failures against a committed implementation SHA.

Update the six inventory-truth handoff documents and parent CURRENT_STATE,
TASK_BOARD and HANDOFF every session. Append session/decision/verification evidence.
Commit atomic checkpoints and publish only canonical branch without force.
COMPLETE requires every gate plus pushed committed clean tree, all exclusions
respected and `inventory-truth/T08_VERIFICATION.md`. Otherwise IN_PROGRESS or
READY_FOR_VERIFICATION; a publication denial is a real completion blocker.

## Completion receipt

T08 COMPLETE on the user-approved handoff branch. Final implementation remains
dd2ecc6; verified/published checkpoint fb00f46 plus its docs-only final report.
Regression/static/build and migration replay/schema gates were rerun and passed;
the prior local D1 apply remains verified. Exact evidence is in
`../inventory-truth/T08_VERIFICATION.md`. No T09 work is authorized by completion.

## Exclusions / next tasks

Never modify/merge/push main, deploy staging/production, apply remote D1, change
secrets/flags, or touch PayOS/payment/billing/webhooks/migrations. Do not modify
unrelated auth, frontend or infrastructure. No new services or generic CQRS.

T09 owns commands CREATE/USE/DISCARD/OPEN/MOVE/CORRECT, FEFO, CAS/idempotency,
existing-ledger authority, dual-write, concurrency and ownership-transition policy.
T10 observations/reconciliation, T11 receipt/vision/UX V2 and T12 closed-loop
integration are prerequisites-only handoff subjects, never T08 implementation work.
