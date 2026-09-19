# T15C-C — authorized production canary test cohort

Date: 2026-09-19 (UTC). Verification on implementation `c5d2d63a`: seed/import/typecheck/lint/check:migrations/build PASS; `pnpm test` 178 files / 4038 tests PASS; focused 215; `git diff --check` clean. Status: **`T15C_AUTHORIZED_TEST_COHORT_READY`** (development complete,
dormant by default). This is NOT `T15C_CANARY_COMPLETE`: production remains `shadow / 0 / false`
until a separately authorized rollout.

## Problem

Production canary membership is `recipeCanaryBucket(householdId)` — FNV-1a 32 over
`recipe-catalog-canary:<householdId>`, 10 000 buckets, 1 % = buckets 0..99 (2 % = 0..199,
5 % = 0..499). That is correct for customers, but no operator-owned household is guaranteed to
land inside the first 1 %, so T15C-B and the T15C re-run both stopped with
`T15C_CANARY_BLOCKED_AUTHORIZED_COHORT_UNAVAILABLE` (see `T15C_B_AUTHORIZED_COHORT_SAFE_STOP.md`,
`T15C_PRODUCTION_CANARY_SAFE_STOP.md`; that history stands). Searching customer IDs for a
convenient bucket, widening the percentage to find one, or adding a request-controlled switch
were all ruled out.

## Design

`packages/recipes/src/recipe-canary-cohort.ts` (pure) + wiring in
`src/worker/services/recipe-authority.ts`:

```text
authenticated householdId (tenantKey)
        │
        ├── RECIPE_CATALOG_MODE=canary AND RECIPE_CATALOG_CUTOVER_ENABLED=true AND test cohort enabled
        │       ├── digest ∈ EXCLUDE → canary=false  (reason authorized_exclude)   ← highest precedence
        │       ├── digest ∈ INCLUDE → canary=true   (reason authorized_include)
        │       └── otherwise        → isRecipeCanaryTenant(tenantKey, percent) (reason deterministic_bucket)
        └── everything else (static / shadow / d1 / invalid config / no tenant) → override never evaluated
```

`digest = SHA-256(hex, lower-case) of "recipe-catalog-test-cohort:" + householdId`
(`recipeTestCohortDigest`). Deterministic identifier representation so no raw production household
ID lives in configuration or diagnostics; it is not claimed to be a security boundary — the Worker
secret store is.

Normal users are unaffected: `fnv1a32`, `recipeCanaryBucket`, `RECIPE_CANARY_BUCKETS`, and the
threshold arithmetic are untouched (pinned by test vectors), and without a cohort
`resolveRecipeCanaryAssignment` is exactly `isRecipeCanaryTenant`.

## Configuration (Worker secrets only)

| Variable | Default | Accepted |
| --- | --- | --- |
| `RECIPE_CATALOG_TEST_COHORT_ENABLED` | absent → disabled | exactly `true` or `false` (`''` = disabled) |
| `RECIPE_CATALOG_TEST_INCLUDE` | absent → empty | comma-separated 64-char lower-case hex digests, ≤ 16 |
| `RECIPE_CATALOG_TEST_EXCLUDE` | absent → empty | same |

Set with `wrangler secret put <NAME>` on the production Worker (never in `wrangler*.jsonc`,
`deploy.yml` inputs/outputs, the release manifest, artifacts, or docs). A guardrail test asserts
none of those files mention the variables.

### Validation rules (all fail closed)

| Condition | Code | Effect |
| --- | --- | --- |
| switch not exactly `true`/`false`/empty | `TEST_COHORT_ENABLED_INVALID` | fatal / static |
| entry not 64-char lower-case hex (raw ID, 0x, upper-case, wrong length, non-string) | `TEST_COHORT_DIGEST_INVALID` | fatal / static |
| same digest twice in one list | `TEST_COHORT_DIGEST_DUPLICATE` | fatal / static |
| > 16 digests in a list | `TEST_COHORT_TOO_LARGE` | fatal / static |
| digest in both lists | `TEST_COHORT_INCLUDE_EXCLUDE_OVERLAP` | fatal / static |
| enabled but both lists empty | `TEST_COHORT_ENABLED_WITHOUT_MEMBERS` | fatal / static |
| lists set but switch not `true` | `TEST_COHORT_MEMBERS_WITHOUT_ENABLE` | fatal / static |
| cohort enabled with mode ≠ `canary` (static, shadow, d1) | `TEST_COHORT_OUTSIDE_CANARY` | fatal / static |
| canary without cutover (pre-existing) | `CUTOVER_NOT_ENABLED` | fatal / static (checked before cohort) |

"fatal" = `validateEnvironment` fatal issue `CONFIG_RECIPE_CATALOG_TEST_COHORT` in production, so
`/health/ready` fails and the deploy smoke refuses the release; "static" = at request time
`resolveRecipeAuthority` serves STATIC with an error-level `recipe_catalog_config_invalid`
diagnostic carrying only the code. When valid and active, readiness emits the warning
`CONFIG_RECIPE_CATALOG_TEST_COHORT_ACTIVE` with member **counts** only.

## Guarantees

- **No request control.** The matcher receives only `auth.householdId` from the session/JWT.
  HTTP regression covers query (`?forceD1=true`, `canary=1`, mode/env-named params), headers
  (`X-Recipe-Catalog-Mode`, `X-Canary`, `X-Household-Id`, `X-Frigo-Expected-Household-Id`…),
  cookies, route params; none changes the assignment or reaches D1.
- **No PII / secrets in output.** Diagnostics add only `assignmentReason ∈ {missing_tenant,
  authorized_exclude, authorized_include, deterministic_bucket}`; counters add
  `authorizedInclude` / `authorizedExclude`. Tests assert household IDs and digests appear in no
  log line, readiness output, or API response. Nothing is exposed to the browser bundle.
- **Unauthenticated never canary.** Missing tenant ⇒ `missing_tenant`, static, even with an
  include list (guest `hh_guest_anonymous` follows the bucket as before).
- **Not a feature-flag engine.** Two disjoint digest sets, ≤ 16 each, canary mode only.

## Tests

`tests/unit/recipe-canary-test-cohort.test.ts` (25): digest contract; default-disabled; every
malformed shape; pure precedence with synthetic tenants; FNV vectors + 10 000 buckets +
monotonic 1 ⊂ 2 ⊂ 5; router fences (default identical to pre-T15C-C, include→D1, exclude→static,
ordinary→bucket, missing tenant, static/shadow/d1 zero effect, cutover-before-cohort, malformed →
static & no D1 read); production readiness (silent / counted warning / fatal).
`tests/integration/recipe-canary-test-cohort-http.test.ts` (4): real routes with JWT tenants —
include served verified D1 with identical content, exclude served static, request-input attempts,
guest, static/shadow.
`tests/unit/release-check.test.mjs`: cohort variables absent from `deploy.yml`,
`production-d1-migrate.yml`, `wrangler*.jsonc`, `.dev.vars.example`, `release-check.mjs`.
`tests/unit/recipe-catalog-authority.test.ts`: config shape now includes `testCohort: null`.

## Production setup procedure (future T15C-B resume; not executed here)

1. Operator obtains the two operator-owned production test households through the approved
   process (an INCLUDE test household and an EXCLUDE control household). Their IDs are never
   pasted into chat, git, or tickets.
2. Compute digests offline: `printf 'recipe-catalog-test-cohort:%s' "$HOUSEHOLD_ID" | sha256sum`.
   Verify determinism against `recipeTestCohortDigest` if desired (same input ⇒ same hex).
3. `wrangler secret put RECIPE_CATALOG_TEST_INCLUDE` / `…_EXCLUDE` / `…_COHORT_ENABLED=true` on the
   production Worker. Secrets on a `shadow` Worker are a **fatal** readiness error by design
   (`TEST_COHORT_OUTSIDE_CANARY`); set them in the same change window as the canary dispatch, or
   set INCLUDE/EXCLUDE first and flip ENABLED together with the canary deploy.
4. Dispatch `deploy.yml` production with `mode=canary`, `percent=1` (cutover derived) through the
   protected workflow with Environment approval; prove exact-SHA convergence; certify inside
   (test household → `source=d1`, 500) and outside (control household → `source=static`, 71) plus
   the T15C flow matrix. Readiness must show `CONFIG_RECIPE_CATALOG_TEST_COHORT_ACTIVE` with
   `1 include / 1 exclude`.

## Rollback

Configuration only, no data change:
- `RECIPE_CATALOG_TEST_COHORT_ENABLED=false` (and delete INCLUDE/EXCLUDE secrets, or readiness
  fails `TEST_COHORT_MEMBERS_WITHOUT_ENABLE` — a deliberate half-applied-state trap) → normal
  bucket routing; or
- `deploy.yml` with `mode=shadow`/`static`, percent 0 → override never evaluated regardless of
  secrets (they then become a fatal readiness error until removed, which is the loud reminder).

## Next T15C step

T15C-B production canary at exactly 1 % using this mechanism, per
`T15C_PRODUCTION_CANARY_SAFE_STOP.md` resume instructions. Requires: authorized cohort supplied,
Cloudflare credentials for D1/tail evidence, `production` Environment reviewer. Do not widen past
1→2→5, do not enable `d1`, no media/R2, no T14G.
