# T14F-A next handoff — certified pilot; scale not started

## Scope and certification boundary

**T14F_PILOT_CERTIFIED · T14F_SCALE_NOT_STARTED.** This is a pilot-only checkpoint,
not T14F development completion, a 500-recipe release, or production authorization.
The T14F-A packet supersedes the earlier instruction to continue into scale work.
**STOP after pilot certification. No ingredient scale preflight or Batch B in T14F-A.**

The final exact-head certificate is the [PR #25 certification receipt](https://github.com/frigo-4/Frigo-dev/pull/25#issuecomment-5714709031).
A committed handoff cannot contain its own commit hash. Therefore that stable receipt
records `T14F_PILOT_CERTIFIED_HEAD`, final validate run/check, and `SUCCESS` **after**
this documentation checkpoint is published and its hosted CI passes. Until the receipt
contains those exact final-head values, certification is not valid for a T14F-B handoff.
Do not substitute an earlier implementation SHA or an unchecked moving PR head.

```text
repository_id=1368281478
repository_full_name=frigo-4/Frigo-dev
origin_main=f0c229f2e2b134904a8c0e355479394cbf53c954
branch=hoplite/massalia-c2862d7c
requested_blocked_checkpoint=585e718f4452155f6dae060e894c7fe5e0fd5d26
T14F_A_actual_start_head=8079a3717f9f6996ae4c98eb375c32fc1ca3e946
routing_fix_commit=8079a3717f9f6996ae4c98eb375c32fc1ca3e946
verified_implementation_head=2ee6f5cc0e144e5c522ce91bd005ab61dc124ed5
implementation_validate_run=35223589293
implementation_validate_check=105209475052
implementation_validate_result=SUCCESS
PR=25
draft=YES
merged=NO
```

The only intervening commit beyond the requested blocked checkpoint was the
compatible automated routing-test fix `8079a37`. Inspected it before continuing:
no application, catalog, migration, or production configuration change. All commits
remain forward descendants of `aa7ca6a…`, `486409c…`, and `585e718f…`; no reset,
rebase, force push, or main write occurred. Numeric repository metadata was fetched
from `/repositories/1368281478`; explicit main/head refs were fetched through the broker.

## Reproduction and remediation

- Reproduced the pre-fix file from a disposable archive of `585e718f…`, without
  moving the live checkout: **5/7 pass**, failures at lines 114 (D1 counter 0)
  and 247 (second read `[5]`, expected `[]`). The archive was removed afterward.
- Independent unmocked SQLite/Vite diagnostics: fixture 71 vs shipped manifest 101;
  configured/selected `d1`, actual `static`, readiness/fallback `COUNT_DRIFT`;
  two attempts produced batches `[5,5]`, D1 counter 0, static/fallback counters 2.
  Correct fail-closed behavior; no verified snapshot was cached.
- `tests/integration/recipe-authority-routing.test.ts` alone changes for T14F-A.
  Its file-local JSON module mock calls the real
  `composeCatalogRelease(ALL_RECIPES, [])`; generated legacy/expected count 71,
  zero import batches, exact `ALL_RECIPES` ID order, both fingerprints
  `9ae153e64d34b30d72bb985d4070d8e210201219c0e8f8998ce8f99057fc7c3f`.
- HTTP source counters prove parity is not static fallback. Direct resolution
  assertions verify configured/selected/actual D1, null fallback, and exactly the
  `recipe_catalog_authority_selected` diagnostic; inside-canary uses D1 and outside
  stays static without a content read. First content batch `[5]`, cached request `[]`.
- Added negative semantic-drift coverage: `LEGACY_BASELINE_DRIFT`, actual static,
  fallback diagnostic, and repeated `[5,5]` reads prove rejected snapshots are uncached.
  It adds one test; the expected original 7/28/3910 totals become **8/29/3911**.
- Cache/counters reset after each test; the release mock is removed with
  `vi.doUnmock` and module cache reset after the file. Real growth tests are unmocked.
  Independent review found no P0/P1/P2 blocker and passed a serial `--no-isolate` run.
- Timestamp-comparison fix `486409c…` is preserved. Production readiness/runtime,
  shipped manifest, pilot data/review/registry, and migrations are untouched.

## Exact checks executed on the implementation checkpoint

```sh
pnpm vitest run tests/integration/recipe-authority-routing.test.ts
# 1 file / 8 tests PASS
pnpm vitest run tests/integration/recipe-catalog-growth.test.ts tests/integration/recipe-catalog-growth-authority.test.ts
# 2 files / 21 tests PASS
pnpm vitest run tests/integration/recipe-authority-routing.test.ts tests/integration/recipe-catalog-growth.test.ts tests/integration/recipe-catalog-growth-authority.test.ts
# 3 files / 29 tests PASS; executed twice
pnpm vitest run --no-isolate --no-file-parallelism --maxWorkers=1 tests/integration/recipe-authority-routing.test.ts tests/integration/recipe-catalog-growth.test.ts tests/integration/recipe-catalog-growth-authority.test.ts
# Independent reviewer: 3 files / 29 tests PASS
pnpm vitest run tests/unit/recipe-authority.test.ts tests/integration/recipe-catalog-release-readiness.test.ts tests/integration/recipe-d1-parity.test.ts tests/integration/recipe-d1-runtime-parity.test.ts tests/integration/recipe-media-catalog.test.ts tests/integration/recipe-media-schema.test.ts tests/integration/recipe-media-route.test.ts tests/unit/recipe-import-provenance.test.ts tests/unit/recipe-import-output-policy.test.mjs tests/integration/inventory-lot-commands.test.ts tests/integration/inventory-read-authority.test.ts tests/integration/inventory-truth.test.ts
# 12 files / 383 tests PASS
pnpm recipe:seed:check
pnpm recipe:import:check
pnpm typecheck
pnpm lint
pnpm check:migrations
pnpm build
pnpm test
# Every gate PASS. Full suite: 171/171 files, 3911/3911 tests.
git diff --check
# PASS
git status --short
# Only pre-existing, deliberately uncommitted .hoplite/settings.json delta.
```

Also executed `pnpm exec tsc -p tsconfig.json --noEmit` (PASS). Full local test run
started **2026-09-17 12:53:15 UTC**, duration **389.75 seconds**. Local logs are
ignored under `.hoplite/artifacts/t14f-a/`; durable facts are recorded here.
Hosted implementation validate **35223589293 / 105209475052** passed lint,
typecheck, tests, migration smoke and build at exact `2ee6f5cc…`.
The final documentation head must also have hosted `SUCCESS`, recorded in the receipt.

## Immutable pilot and renewed runtime evidence

```text
batch=t14f-pilot-30-v1
pilot_count=30
batch_hash=4d13915c075cd1b418d2454f7f03968349b779766cdb96b92df90f4138bc8cce
0036_sha256=04228788e60d59a2427d70956d4d8a108d0a6c1c4a643c47641402f658120ba9
0001_0035_hash_drift=0
release_id=rel-193ac2b16c64a260
legacy_static_count=71
expected_recipe_count=101
approved_import_batches=1
runtime_order_min=0
runtime_order_max=100
runtime_order_distinct=101
complete=101
fkStub=0
incomplete=0
```

Recompared all five protected pilot files against `585e718f…`, recomputed 0036's
SHA-256, and byte-compared migrations 0001–0035 with certified main: no drift.
Fresh/staged replay, FK/quick checks, and current-release readiness pass.
Static/shadow response 71; shadow D1 READY 101; canary outside 71 static / inside
101 D1; full D1 101. Reader stays five statements, no N+1. Real local Worker HTTP
list/detail, recommendations, planner/generate/regenerate/swap, cooking deductions
and idempotency, and media fallback pass. These are SQLite/HTTP-handler checks,
**not browser, production, or newly populated media evidence**. T09/T11 unchanged;
new inventory writers/readers 0; household isolation and Week compatibility preserved.

## Next task — separate authorization required

**T14F-B — Batch B Ingredient Coverage + 399 Recipe Expansion**.
Recommended model from the task packet: **GLM 5.3 Flash / Flash Max**.
Do not launch it as part of T14F-A. When separately authorized:

1. Read the final receipt and obtain its exact `T14F_PILOT_CERTIFIED_HEAD` and
   successful final validate run/check. Fetch that SHA and the explicit branch/main
   refs; verify identity, ancestry, safe worktree, and PR #25 draft/unmerged state.
2. Start only from that final certified documentation head, not `8079a37`,
   `2ee6f5cc`, or an unverified newer head. Investigate any intervening changes.
3. Follow the separately supplied T14F-B packet. Ingredient sufficiency for 399
   high-quality recipes is **not assessed**. The historical pilot's 41/45 usage
   neither proves sufficiency nor authorizes ingredient invention or trivial variants.

T14F-A ends here. Batch B NOT_STARTED; ingredient scale preflight NOT_RUN;
0037/500 manifest absent; media population DEFERRED; T14G NOT_STARTED;
PRODUCTION_ROLLOUT_DEFERRED. No production D1/R2 write, deployment, authority
switch, PayOS/payment/auth change, or merge. PR #25 remains draft, open, unmerged,
and subscribed to auto-fix updates. Preserve the unrelated local settings delta.



## T14F-B status (final)

T14F-B resumed from the certified base and **completed**: 399 reviewed records authored/QA-clean,
double deterministic compile, candidate-500 composition proven, all repository gates green
(171 files / 3911 tests). Shipped release still 101; 0037 NOT created. Classification:
`T14F_B_SCALE_BATCH_CERTIFIED` / `T14F_SCALE_DATA_COMPLETE` / `T14F_C_NOT_STARTED`.
Exact head and handoff: `T14F_B_SCALE_BATCH_CERTIFICATION.md` + PR #25 receipt.
Next task: **T14F-C** (promote 0037, 500 shipped manifest, 500-authority certification) — separate authorization.

## T14F-C status (final) — T14F development complete

T14F-C **closed** on 2026-09-17: 0037 promoted byte-identical (`68e52e6d…`), shipped manifest
500 recipes / 2 batches (`rel-bd00a4f53fcaeee4`), replay / D1 readiness / authority modes / user
flows certified, full closure gates green (171 files / 3913 tests) and hosted exact-head validate
SUCCESS on the final head. One closure fix (`8c6080aa…`, tests only) keeps the five real-D1 suites
under workerd's 1 MiB statement cache now that the migration chain carries 0037; a second (`tests/helpers/vitest-event-loop-yield.ts`, vitest setupFiles) keeps workers from tripping the 60 s `onTaskUpdate` RPC timeout on the slow hosted runner after all tests pass.

```text
T14F-A=CERTIFIED  T14F-B=CERTIFIED  T14F-C=CERTIFIED
T14F_DEVELOPMENT_COMPLETE  T14F_REAL_CATALOG_500_COMPLETE  T14F_500_AUTHORITY_CERTIFIED
PRODUCTION_ROLLOUT_DEFERRED  MEDIA_POPULATION_DEFERRED  T14G_NOT_STARTED
PR_25=READY_FOR_REVIEW  PR_25_MERGED=NO
```

Certificate: `T14F_C_500_CATALOG_CERTIFICATION.md`; exact final head + validate ids: PR #25 final
certification receipt. Production does **not** contain 500 recipes; rollout (production ledger →
0036/0037 via the OPS workflow, readiness verify, shadow → canary → d1), media population and T14G
each require separate authorization.
