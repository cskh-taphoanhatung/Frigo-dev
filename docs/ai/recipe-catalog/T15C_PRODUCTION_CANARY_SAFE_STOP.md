# T15C — production Canary safe stop (authorized cohort still unavailable)

Date: 2026-09-18 (UTC evening)

This session re-ran the T15C packet from a fresh repository and production audit on
the current canonical `main`. Production Canary was **not dispatched**: the hard
safety rule in the packet (§8) requires an operator-owned inside-1% **and**
outside-1% production test cohort, or a reviewed cohort fixture mechanism, and
neither exists in the repository, the process environment, or operator-provided
inputs. No customer household or user IDs were inspected, no production write,
deploy, config change, approval request, or Cloudflare credential use occurred.

## Repository

```text
repository_id=1368281478
repository_full_name=frigo-6/Frigo-dev (resolved by ID)
CANONICAL_MAIN_START=b41aa4682481447795350fc1a9eeb1e80887bd0e
ending_main=b41aa4682481447795350fc1a9eeb1e80887bd0e (unchanged during the session)
TASK_BRANCH=hoplite/aigeai-eca96ae8--t15c-canary (from main; docs-only)
PR=#38 (docs-only receipt; code head 3b8e4653aa9f7fee8ce93f79988f637de70286f5, exact-head validate run 35406083881 SUCCESS)
merge_sha=NOT MERGED
working_tree_clean=YES at start (after checkout of main)
```

Main has moved well past the historical T14F/T15A SHAs: PRs #30–#37 landed
(T15B shadow wiring + certification, T15C-A canary control plane, T15C-B safe
stop, T16 auth funnel/CSP/OTP/guest-gate work). `migrations/` tip is now
`0038_auth_onboarding_completion.sql` (T16), not 0037; this is expected and not a
recipe-catalog drift.

## Main certification (this session, on b41aa468)

```text
pnpm install --frozen-lockfile  OK
pnpm recipe:seed:check          PASS
pnpm recipe:import:check        PASS
pnpm typecheck                  PASS
pnpm lint                       PASS
pnpm check:migrations           PASS (through 0038)
pnpm build                      PASS
pnpm test                       PASS — 176 files / 4008 tests (5m10s)
git diff --check                clean
```

## Production audit — read-only, anonymous public endpoints only

No Cloudflare API token, account ID, or wrangler credential is present in this
environment (presence checks only; no values read), so D1 SQL, Worker version
listing, and `wrangler tail` could not be run here. Evidence below is limited to
public HTTP and GitHub Actions receipts.

```text
target=https://frigo.tungjpstore.net
readiness.status=degraded (pre-existing non-fatal CONFIG_PLUS_GRANT_SECRET_MISSING warning)
readiness.environment=production
readiness.commit=b41aa4682481447795350fc1a9eeb1e80887bd0e (== canonical main; exact SHA proven)
readiness.services.database=ok  queue=ok
GET /api/v1/recipes x5: HTTP 200, count=71, unique=71, first=vn-canh-01, last=gl-12 (deterministic order)
GET /api/v1/recipes/vn-canh-01=200  gl-12=200 (legacy present)
GET /api/v1/recipes/{imp-199ff78d3d8c8ab3, imp-ab36e38b07f3a57b, imp-26a36c69306143bc}=404 (no D1 authority leak)
```

Latest production Deploy receipt (run 35404106102, `workflow_dispatch`, jobs
release SUCCESS / production SUCCESS / staging SKIPPED; artifact
`release-production-35404106102-1`):

```text
sha=b41aa4682481447795350fc1a9eeb1e80887bd0e
environment=production
recipeCatalogMode=shadow
recipeCatalogCanaryPercent=0
recipeCatalogCutoverEnabled=false
deployed.attempts=2  deployed.waitedMs=3846 (bounded exact-SHA convergence helper)
```

Production authority is therefore still `shadow / 0 / false` on the exact
current main. D1-side facts (500 recipes, 500 runtime fields, media 500 pending /
0 ready, ledger 37 recipe tip 0037, release `rel-bd00a4f53fcaeee4`) are carried
forward from the T15C-B read-only certification and were **not** re-queried here
(no credential); they are historical for this receipt.

## Authorized cohort preflight

```text
inside_test_household_available=NO
outside_test_household_available=NO
cohort_fixture_mechanism_in_repo=NO (runtime assigns FNV-1a32(householdId) mod 10000; no operator override, by design)
raw_household_ids_inspected=NO
customer_data_inspected=NO
```

Stop condition §8 / §23 (`authorized cohort unavailable`, `required credentials
unavailable`) applies.

## Production mutation

```text
deploy=NO
config_change=NO
D1_write=NO
migration=NO
R2_write=NO
media_promotion=NO
canary_percent_change=NO (remains 0)
full_D1=NO
T14G=NO
Inventory Truth / T09 / T11 / PayOS / Auth(T16)=untouched
```

## Final classification

```text
T15C_CANARY_BLOCKED_AUTHORIZED_COHORT_UNAVAILABLE
```

## Resume instructions

1. Operator supplies, through the approved process, an inside-1% and an
   outside-1% operator-owned production test household (or a reviewed cohort
   fixture mechanism), plus Cloudflare read-only credentials for D1/tail
   evidence and the `production` Environment reviewer.
2. Start from the then-current canonical `main` (re-verify; do not assume
   `b41aa468`). Re-run the read-only production audit including D1 aggregates
   and a bounded Shadow tail.
3. Dispatch `deploy.yml` production with `mode=canary`, `percent=1` (cutover is
   derived) through the protected workflow only; prove exact-SHA convergence;
   certify inside/outside cohorts and the full flow matrix (§10–§12); keep the
   `static/0/false` rollback path; never widen past the ladder or enable `d1`.
