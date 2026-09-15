# Frigo / Takosan current handoff — 2026-09-15

## T14B-A recipe catalog safety foundation handoff — 2026-09-15

- Branch: `hoplite/koroneia-838b0ccc--t14b-a-catalog-safety` (local alias
  `feat/t14b-a-recipe-catalog-safety-foundation`), `T14B_A_START_SHA=769e0532fadc95018bc1aedc01a36b396b91a974`
  (T14A PR #7 head; application tree identical to `main` `345cecf` and to deployed `e6b9195`).
- Preconditions: repo ID `1368281478`; PR #7 open/draft, `validate` SUCCESS, unmerged (docs-only);
  PR #4 open, historical compatibility bridge, not a base — recommend close/archive.
- Code: `packages/recipes/src/{seed-render,runtime-recipe,catalog-entry,catalog-drift}.ts`,
  `packages/db/src/recipe-content.ts`, index re-exports; `scripts/render-recipe-seed.mjs`;
  `package.json` scripts `recipe:seed:check`, `recipe:seed:render`.
- Tests: removed `tests/unit/generate-migration.test.ts`; added
  `tests/unit/recipe-seed-readonly.test.ts` (5), `tests/unit/runtime-recipe-contract.test.ts` (5),
  `tests/integration/recipe-catalog-safety.test.ts` (6).
- Docs: `docs/ai/recipe-catalog/T14B_A_CATALOG_SAFETY_FOUNDATION.md`, ADR-022, state/board/handoff.
- Verification (fresh on `62af106`, Node 24.19.0): `pnpm typecheck` 0; `pnpm lint` 0;
  `pnpm check:migrations` → `migration-smoke=ok`; `pnpm build` 0; full
  `NODE_OPTIONS=--no-experimental-webstorage npx vitest run` → **151 files / 3644 tests passed**
  (was 149/3630: −1 generator file/−2 tests, +3 files/+16 tests); focused new suites 3 files / 16
  passed; `pnpm recipe:seed:check` → `recipe-seed-check=ok (59 recipes match 0006)`;
  `recipe:seed:render --out migrations/evil.sql` refused (exit 3); render to `.artifacts/` equals
  committed 0006; per-file SHA-256 of `migrations/*.sql` identical before/after all gates (33 files,
  last `0033`, no `0034`); `git status` after full test run shows only intentional docs edits;
  `git diff --check` clean.
- Next action: maintainer review; do not merge PR #4; T14B-B per §7 of the foundation doc.

## T14A production recipe truth audit handoff — 2026-09-15

- Task: T14A audit-only. Local branch `audit/t14a-production-recipe-truth`
  from `origin/main` `345cecf388321a00c96be387744a10e8c98bd9ac`, published
  remotely as thread branch `hoplite/koroneia-838b0ccc` (identical commit);
  repository `vn-dlo/Frigo-dev` (ID `1368281478`).
- Output: `docs/ai/recipe-catalog/T14A_PRODUCTION_RECIPE_TRUTH_AUDIT.md` plus
  this docs-only state/board/handoff update. No application, migration,
  config, test, dependency or production change.
- Verified: deployed Worker `e6b91956484589c088e6d04a9835b3e59a2eb786` (live
  readiness commit matches) differs from `main` only by documentation ⇒
  `PRODUCTION_MAIN_APPLICATION_EQUIVALENCE = PASS`. Migrations `0001`–`0033`
  contiguous, no duplicates, `0023_scan_request_fingerprint.sql` present,
  `NEXT_AVAILABLE_MIGRATION = 0034` (not created).
- Executed checks: `pnpm install --frozen-lockfile` (exit 0), `pnpm typecheck`
  (0), `pnpm lint` (0), `pnpm check:migrations` (`migration-smoke=ok`),
  `pnpm build` (0), full `vitest run` 149 files / 3630 tests passed, focused
  recipe/planner/cooking/CSP suite 22 files / 255 tests passed, local sqlite3
  replay of all 33 migrations (59 recipes / 328 lines / 295 steps seeded),
  `git diff --check` clean, read-only production smoke
  (`scripts/post-deploy-smoke.sh`, anonymous `GET /api/v1/recipes`, CSP
  header). Not run: `schema:check:remote` (credentials; not required).
- Key findings: P1 external recipe images blocked by `img-src`; P1 static
  `ALL_RECIPES` is sole runtime authority while D1 is a partial shadow; P2
  foundation model drops `imageUrl`/`nutrition`/`steps`/`tags`/`category`/
  `region`; P2 Week v1 snapshots embed full recipe objects; P2 generator test
  rewrites `migrations/0006` during `pnpm test`; P2 PR #4 (`64ee9ed1`) still
  open and not on `main`. No P0.
- Recommendation: T14B Strategy A (static authority, D1 shadow + drift
  metrics; additive `0034` seeding global recipes; no authority switch).
- Next action: maintainer review of the audit report; resolve PR #4; then open
  T14B design packet `docs/ai/tasks/T14B-*.md` following §18 of the report.
  Do not implement T14B, add migrations, change CSP, or deploy from this branch.

## Production rollout handoff — 2026-09-15

Production is serving canonical Worker SHA
`e6b91956484589c088e6d04a9835b3e59a2eb786` after compatibility Worker
`64ee9ed1d986a5e521598a36656e9c2f59d682ee` was deployed ahead of the remote
bridge. D1 `frigo-db` has ledger `0001`-`0033`; `pnpm schema:check:remote`
passed. Readiness returned HTTP 200 with exact canonical commit, database and
queue healthy, AI/configured, and only the known PLUS-grant warning.

Evidence: export `/tmp/frigo-prod-pre0032-20260916.sql`, SHA-256
`378c023b15c159d140162e6eb74bbf2ad584e7b699c72384379119defe6dec6a`; health,
recipes, manifest/Takosan assets and unauthenticated mutation checks passed;
full local Vitest was `3630/3630`, frozen install/lint/typecheck/build passed.
Ad-hoc Cloudflare SQL queries were denied with `SQLITE_AUTH`, so rely on the
repository-owned schema gate rather than claiming direct PRAGMA evidence.

Open follow-up: PR #4 (`release/pre0032-schema-compat`, commit `64ee9ed1`) is
still open with no hosted checks. Do not bypass branch protection; obtain CI
and maintainer review, then merge it history-preservingly so production and
canonical `main` converge. No PayOS, DNS, secret rotation, KV/R2/queue data
mutation or T14 work was performed.

## Current canonical repository handoff

- Repository: `vn-dlo/Frigo-dev` (ID `1368281478`).
- Application freeze: `5f6853d0ed11415871dca0fd31d4981d60518310`.
- Historical superseded candidate: `e34ed16777166407acf67b2c76d733d89c7d64ca`.
- Merged PR: #2, base `main`, head `canonical/5f6853d-promotion-ci`.
- Final reviewed head: `7ede92c73a41da24500746fd0eded892689d8558`.
- Final canonical main: `a5cfb14cfd5840be23eb16b26a3689f5e2d6e805`.
- Exact PR CI: run `34972891435`, `validate` PASS.
- Post-merge main CI: run `34973522150`, `validate` PASS.
- Protection: strict `validate`, admin enforcement, force-push and branch
  deletion blocked; approval count zero under the recorded waiver.

PR #2 used a history-preserving merge commit. Its tree is identical to reviewed
head `7ede92c`, and production, Qwen, T13, Takosan and application-freeze SHAs
remain ancestors of canonical `main`. Current required action is only to publish
this docs-only post-merge receipt. Do not modify application code, deploy,
migrate production, touch production resources or start T14.

Maintainer decision: external technical review is accepted for this
consolidation at final reviewed head `7ede92c73a41da24500746fd0eded892689d8558`
(P0=0, P1=0, P2=0). The GitHub-native collaborator approval may be waived by
the owner; do not fabricate or impersonate a GitHub review. All other branch
protections and exact-head CI gates remain required.

Production deployment is complete under the separate rollout receipt above.
The automatic post-merge Deploy workflow had skipped production earlier; the
operator-authorized rollout later applied the bridge migrations and deployed
the exact canonical SHA. PR #4 is the remaining canonicalization follow-up.

# Historical production integration handoff — 2026-09-15

## Historical safe-merger planning handoff — superseded as current authority

Status: **PROMOTION BRANCH PUBLISHED; PR OPEN; MERGE/RELEASE BLOCKED ON HOSTED CI, ADMIN CONTROLS AND ROLLING COMPATIBILITY**.

The decision-complete repository-promotion plan is
`docs/integration/CANONICAL_REPOSITORY_CONSOLIDATION_PLAN.md`; production
rollout sequencing remains in `docs/integration/SAFE_PRODUCTION_MERGER_PLAN.md`.
Verified access is production
`ADMIN` and Frigo-dev `WRITE`; fetched default heads remain `05423f2` and
`d1b0673`; common base is `d1b0673`. Production already contains the adapted
frontend and platform upgrades through `d270cd4`/`57c88c5` and `3f33d11`, so
their historical branch tips must not be reapplied.
Qwen source `da41686` is not in production `main`; it is 15 commits ahead and
must remain an explicit frozen merge source.

Promotion receipt: branch `canonical/5f6853d-promotion` is
`f48e830ed9cdde2214ad5b4dbd58b8bc30c06106`; archive pointer
`archive/pre-canonical-consolidation` is `d1b06732f8a80db4e77986df31ff28d9f04641fa`;
PR #1 targets `main`. Local frozen install, lint, typecheck, migration smoke,
build, Vitest `3630/3630`, D1 `92/92`, browser `60/60`, and diff check passed.
Hosted exact-head CI has not reported. Branch protection is 404 and current
account is not admin. Do not merge.

Migration audit found exactly one semantic numbering collision: production
`0023_scan_request_fingerprint.sql` (`777f4b6f...`) versus dev
`0023_inventory_truth_foundation.sql` (`1ec671af...`). Canonical resolution is
production `0001`-`0023` unchanged plus certified T08-T13 at `0024`-`0033`.
However canonical `0032` adds a trigger that rejects the current production
Worker's `is_confirmed = 1`-only confirmation update, while the integrated
Worker assumes the new columns exist. Next action is a separately reviewed
schema-capability compatibility release and pre/post-0032 rolling rehearsal,
not a production merge or migration. Release the compatibility Worker
independently from `05423f2`, then run separate Qwen/runtime, T08-T13 bridge and
Takosan brand-only trains, each from the prior deployed production head. Do not
promote current `f26003b` directly. No remote state was changed in this audit.

Executed checks: repository/API permissions; branch heads, merge-base,
ancestry and source diff counts; all-fetched-ref migration scan; bridge/source
blob comparison; scan SQL inspection; pre/post-0032 SQLite failure probes; and
`git diff --check` (PASS). Both probes exited `1` with the expected errors. No
application suite was rerun because this continuation changed docs only.

## Historical candidate remediation handoff — superseded

Status: **INDEPENDENT-REVIEW REMEDIATION COMPLETE AND COMMITTED LOCALLY**.

`WORKING_BRANCH=integration/t13-takosan-qwen`

`PRODUCTION_BASE=05423f2ad675006a4c7913e696f1979b3fcaae59`

`COMMON_BASE=d1b06732f8a80db4e77986df31ff28d9f04641fa`

`REVIEWED_CANDIDATE_SUPERSEDED=e34ed16777166407acf67b2c76d733d89c7d64ca`

`REMEDIATION_BASE_HEAD=231d1e76e0320133e047624eea2be546ff779bd6`

`REMEDIATION_COMMIT=5f6853d`

`INTEGRATION_DOCS_HEAD=c14116e3f979f90ca42ec21187c1aa55d319185b`

The integration line combines production Qwen `da41686b`, certified T13 `32ddbb4`
(review `9c3c3d3`), hardened Takosan `ff63edf`, and byte-identical T13 migrations
renumbered to `0024`-`0033`. Production migration changes `0`, bridge mismatches
`0`, unknown inventory writers/readers `0/0`. Frozen install, lint, typecheck,
migration smoke, build, full Vitest `3628/3628` (149), real local D1 `92/92` (5),
and browser `60/60` (360/390/430, serial, last) historically passed before
review. The remediation restores protected payment UI to production base,
replaces the mocked-router integration proof with real Qwen runtime composition,
retains exact missing/0/.11/.9 evidence, preserves concrete runtime errors, and
scopes Takosan tests away from payment. Auth intentionally retains certified
T13 DEC-012 guest-transfer deferral. P3-1/P3-2 remain unchanged.

Fresh remediation receipt: focused `41/41`; affected matrix first `300/302`
(two brand assertions incorrectly included payment), corrected brand `16/16`;
full Vitest `3630/3630` in 149 files; lint, typecheck, migration smoke, build and
diff check PASS; browser `60/60` at 360/390/430 PASS.
Two intermediate typecheck attempts failed on incorrect `fetch` spy annotation
forms; the final `MockInstance<typeof globalThis.fetch>` annotation passes, as
does the post-fix focused `57/57` run.

Access preflight is READY: current GitHub account has `ADMIN` on
`Tungjpstore/Frigo` and `WRITE` on `vn-dlo/Frigo-dev`; default heads remain
`05423f2`/`d1b0673`, and neither repo reports protection/rulesets. Local
`origin=Tungjpstore/yaji`, so do not use an implicit `git push origin`.

**NO HOSTED GITHUB CI STATUS FOR INTEGRATION_APPLICATION_CANDIDATE**.

Next: independently review immutable remediation SHA `5f6853d`. No PR, push,
merge, deploy, remote migration/resource
mutation, PayOS/payment work, secret/DNS change, or T14. Exact evidence and
retained setup failures are in `docs/integration/`.

# Takosan brand handoff — 2026-09-14 (independent of the T13 handoff below)

Task: user-facing brand migration Frigo → Takosan from the supplied brand kit.
Status: **TAKOSAN BRAND MIGRATION COMPLETE — READY FOR BRAND REVIEW.**
Branch `hoplite/megara-hyblaia-6b723eb2` (Hoplite broker branch; preferred name
`feat/takosan-brand-refresh` could not be published by the broker), base
`TAKOSAN_BRAND_BASE=897102b6816c22af2e6a49f29662690e3e3206e0`,
`TAKOSAN_BRAND_APPLICATION_CHECKPOINT=e37ee2808a50a7195dc90a2e7bb01be639aa186b`;
the docs-only commit containing this section is `TAKOSAN_BRAND_DOCS_HEAD`.
T13 freeze `32ddbb4`, `42e0037`, `897102b`, main `d1b0673` unchanged.

Exact checks at `e37ee28`: `git diff --check` clean; `pnpm typecheck` PASS;
`pnpm exec eslint src/web tests/unit/takosan-brand.test.tsx scripts/generate-takosan-icons.mjs`
PASS; `pnpm build` PASS; `CI=1 pnpm test` **3480 passed / 139 files**;
`CI=1 pnpm test:browser` **60 passed / 60** (4.0 m); Playwright brand QA matrix
360/390/430 × landing/onboarding/auth/home/fridge/scan/planner/profile: 0 broken
asset requests, 0 horizontal overflow. Failures: none.

Next action: brand review of `e37ee28`; then optionally delete legacy Frigo brand
assets under `public/frigo/{brand,app-icons,illustrations}`. Do not merge to main,
deploy, touch remote D1 or PayOS. Full details in
[docs/brand/TAKOSAN_MIGRATION.md](../brand/TAKOSAN_MIGRATION.md).

# Frigo AI Handoff — T13R certified, ready for independent review #2

## Current handoff — T13R certified freeze, 2026-09-14

Task: final technical certification of the fully remediated T13 candidate
(T13R-A + T13R-B), exact application freeze, detached recertification, docs.
Status: **T13 REMEDIATION CERTIFIED — READY FOR INDEPENDENT FINAL REVIEW #2.**
Repository `vn-blo/Frigo-dev` (owner renamed from `vn-co3`; ID **1368281478**
verified via public API). Branch `hoplite/delos-f0bb1d04` — this thread's only
broker-authorized branch; it fast-forwards from `origin/hoplite/medma-164548ce`
(`83248df4f97d2110527a69e92a3ebe162aa71492`, the T13R-B safe-stop docs head, which
is itself docs-only above the T13R-B candidate `7e68e3b358f73786cc02eaa7db24537df855fba5`).

**T13R_APPLICATION_FREEZE = `32ddbb4f2bb636fdcf201e9ca99c4689d3655477`**, published
via the trusted broker and fetch-verified (`origin/hoplite/delos-f0bb1d04 ==
32ddbb4`). The docs-only commit that follows this handoff is `T13R_DOCS_HEAD`; its
explicit application-path diff against the freeze must be EMPTY. Main
`d1b06732f8a80db4e77986df31ff28d9f04641fa` unchanged. Rejected freeze
`7b7bb695ee597a46cf4022a2c534e2fea374be5d` unchanged, **DO NOT RELEASE**.

Why `7e68e3b` is not the freeze: certification required two test/fixture-only
changes. `bd2f5f3` — the T13R-B openedAt fixture seeded a `FRESH_MILK` 'Sữa tươi'
row that fridge confirmation grouped browser case C into (**3 failed / 51 passed**
first full serial run); the fixture now seeds `preview-stock-cheese`. `32ddbb4` —
new `tests/e2e/t13r-a-expiry-reopen.e2e.ts` because the packet requires browser
coverage of the explicit-expiry reopen (previously jsdom-only); RED at `7b7bb69`,
GREEN 6/6. Application source, migrations, dependencies and harness config are
byte-identical to `7e68e3b` (explicit path diff EMPTY).

Exact checks — pre-freeze (development worktree, `CI=1`, Vitest before browser)
and clean detached (`git worktree add --detach /tmp/t13r-freeze 32ddbb4`, frozen
install, Node 24.19.0, pnpm 10.26.0, Playwright 1.63.0): `pnpm lint`/`pnpm
typecheck`/`pnpm build` PASS; `pnpm test` **3471/3471 in 138 files** (identical
both runs); focused T13R-A **45/5**; focused T13R-B (7 files) **171/7**; T08
**130/2**, T09 **1259/17**, T10 **98/6**, T11 **39/2**, T12 **22/3**, T13
**320/12**; real local D1 `*-d1.test.mjs` **92/5**; `pnpm check:migrations`
`migration-smoke=ok`; fresh `wrangler d1 migrations apply --local` 32 ✅, n=32,
last 0032, FK []; `pnpm schema:check:local` PASS; legacy populated replay on real
local D1 (0001–0030 → seeded legacy lines → 0031 → seeded T13 lines → 0032) all ✅,
pre-existing `scan_items` columns identical, all new 0032 columns NULL (0
fabricated), FK [], schema gate PASS; migrations **32**, 0031 blob `c580d30b…` ==
`fc0f9c5` == `7b7bb69`, 0032 blob `48f26f7c…` == `fc0f9c5`, 0033 absent; writer
audit `src`+`packages` statement set identical to `fc0f9c5`/`7b7bb69` (only two
synthetic preview seed INSERTs added in `scripts/planner-preview-fixtures.mjs`),
reader call set identical — UNKNOWN writers **0**, UNKNOWN readers **0**, T09/T11
authority preserved; `git diff --check` PASS; browser `pnpm exec playwright test`
serial and last **60 passed / 0 failed** (20 cases × 360/390/430) pre-freeze at
`32ddbb4` and detached; detached `git status --porcelain` EMPTY.

Blocker disposition: P1-1/P1-2/P1-3/P1-4, P2-1/P2-2/P2-3/P2-4/P2-5/P2-6 and the
IngredientRow `/fridge` ReferenceError all CLOSED with permanent tests re-run at
the freeze; **P0 0, P1 0, blocking P2 0**. Original AC1–AC14 **all PASS**
(numbering from `release/T13_PROPOSED_SCOPE.md`); R3/R4/R5/R6/R7/R8/R11 and
U1/U4/U6/U7/U8/U12/U13/U14 **DONE**. **NO HOSTED GITHUB CI STATUS FOR
T13R_APPLICATION_FREEZE** (0 runs / 0 checks / 0 contexts; `ci.yml` triggers on
main/PR only).

Evidence (gitignored/sandbox): `.hoplite/artifacts/t13r-cert/{,prefreeze-bd2f5f3,
prefreeze-32ddbb4}/`, `/tmp/t13r-detached-logs/` (freeze), `/tmp/t13r-detached-logs-
bd2f5f3/`, drivers `/tmp/t13r-tools/`. Full record:
[T13R_FINAL_CERTIFICATION.md](inventory-truth/t13/T13R_FINAL_CERTIFICATION.md).

Limitations: all evidence is local; hosted CI absent for the exact freeze. Browser
evidence uses the repository's isolated synthetic harness (`SCAN_QUEUE_MODE` sync);
the async queue path is proven by the real queue processor over real migrations in
Vitest, not in the browser. `.hoplite/settings.json` overlay remains uncommitted.

Safety: main merged NO; production modified/deployed NO; remote D1 NO; PayOS NO;
T14 NO; repository reconciliation NO.

Publication (verified by brokered fetch after publishing): **T13R_DOCS_HEAD =
`42e0037f92104fd5dc3c89c633d91f67fa892724`** is remote on `hoplite/delos-f0bb1d04`
(`LOCAL_HEAD == REMOTE_HEAD`); freeze `32ddbb4` is its ancestor and the explicit
application-path diff `32ddbb4..42e0037` is EMPTY. `origin/main` remains
`d1b06732…`. `hoplite/medma-164548ce` stays at `83248df…` because the broker
refuses to publish to this thread's configured base branch; it is a strict
fast-forward ancestor and a maintainer may advance it without any rewrite. The
commit recording this paragraph is a later docs-only receipt on the same branch.

Next action: **INDEPENDENT T13 FINAL REVIEW #2** of exact freeze `32ddbb4` and its
docs-only head. Nothing else is authorized.

## Historical handoff — T13R-A application checkpoint, 2026-09-13 (superseded)

Task: T13R-A data-integrity & ownership remediation of the rejected T13 freeze.
Status: **T13R-A COMPLETE — READY FOR T13R-B.** Not a final T13 freeze.
Repository: `vn-co3/Frigo-dev` (owner renamed from `vn-co2`; ID **1368281478**
verified). Branch `hoplite/oropos-eb2d4886--t13r-a-data-integrity-ownership`.
Recovered this session from the mismatched local branch `hoplite/amisos-peiraieus-
ab9b6c4c`/`hoplite/medma-164548ce` (HEAD `b9735b4`, a docs-only ancestor of the
remote head) by `git switch --track`; no reset/rebase/cherry-pick/force-push.

**T13R_A_APPLICATION_CHECKPOINT=`fc0f9c56c53ae7b17f2d1fb4770a6bc231ebc027`**
(starting checkpoint `d589342cbcef9f80487a2c269bcf6133fe0e4415`). The docs-only
commit following this handoff is `T13R_A_DOCS_HEAD`; its non-doc diff against the
application checkpoint must be empty. Main `d1b06732f8a80db4e77986df31ff28d9f04641fa`
unchanged. Rejected freeze `7b7bb695ee597a46cf4022a2c534e2fea374be5d` unchanged,
**DO NOT RELEASE**.

Implemented (one finding at a time, REPRODUCE → RED permanent test → minimal fix →
GREEN → regression): **P1-1** async queue raw evidence + nullable confidence
(`4d73365`); **P2-A/P2-B** additive migration `0032_scan_evidence_completeness.sql`
(`ocr_canonical_id/category/storage`, `reviewed_expiry_date/kind` + fail-closed
triggers), sync+async writers, `scanItemDto`, both review pages (`ac3c35e`);
**P1-2** canonical identity preserved under free-form rename (`20bc14e`);
**P1-3/P1-4** lot-keyed detail with draft-owner check and route-id-owned receipt
review (`43e95ed`); test alignment (`bb19fc0`, `fc0f9c5`). Migrations **32**;
0001–0031 byte-identical to the freeze; no backfill in 0032.

Exact checks at the checkpoint: `pnpm lint` PASS; `pnpm typecheck` PASS;
`pnpm build` PASS; `pnpm test` **3423/3423 in 137 files**; focused
`tests/{integration,unit}/t13r-a-*` **45/45 in 5 files**; real local D1 (workerd)
`*-d1.test.mjs` **92/92 in 5 files**; `bash scripts/migration-smoke.sh` ok (includes
populated 0031→0032 upgrade over legacy pending/confirmed and T13 pending/confirmed/
rejected rows, zero fabricated evidence); `wrangler d1 migrations apply frigo-db
--local` fresh 32 ✅ and legacy freeze-tree 0001–0031 + seeded rows → 0032 ✅ with
pre-existing columns byte-identical, all new columns SQL NULL, `foreign_key_check` 0;
`pnpm schema:check:local` PASS on both; `CI=1 pnpm exec playwright test`
**42 passed / 0 failed** (14 cases × 360/390/430, includes the new
`tests/e2e/t13r-a-ownership.e2e.ts`); `git diff --check` PASS.

Authority audit: inventory `INSERT/UPDATE inventory_items|inventory_lots` statement
set and T11 reader call set are identical to the freeze; the 0032 columns are read
only by `scan-evidence.ts` → `scanItemDto()`. UNKNOWN writers **0**, UNKNOWN readers
**0**. T09 write and T11 read authority preserved.

Not changed (T13R-B, still OPEN): Cloudflare fridge `vision()` confidence clamp,
inventory conflict/refetch UX, Home estimated-expiry qualifier, `openedAt === null`
→ "Chưa mở". PayOS, auth, production infra untouched. `.hoplite/settings.json`
overlay kept uncommitted.

Limitations: hosted CI was not consulted; all evidence is local. Browser evidence
uses the repository's isolated synthetic harness (SCAN_QUEUE_MODE sync); the async
path is proven by the real queue processor over real migrations in Vitest, not in
the browser.

Publication state (verified by brokered fetch after publishing): the first
T13R-A docs head `111171d373769a2037c047d678236b97c33e60d8` (application
checkpoint `fc0f9c5` + docs) is remote on **`hoplite/medma-164548ce`**, this
thread's only broker-authorized branch. Remote
`hoplite/oropos-eb2d4886--t13r-a-data-integrity-ownership` still points at the
safe-stop `d589342` because the trusted broker refuses to publish to that branch
from this thread and the sandbox has no direct Git credentials. `111171d` (and the
docs commit that records this paragraph) descend from `d589342` by fast-forward
only; a maintainer can advance the remediation branch with
`git push origin <docs-head>:hoplite/oropos-eb2d4886--t13r-a-data-integrity-ownership`
without any rewrite. Main is unchanged.

Next action: **T13R-B** on a stacked branch from this checkpoint — fix the four
deferred blockers only, red/green each, then new application freeze → independent
recertification. No merge/deploy/remote D1/PayOS/T14/repository reconciliation.
Full detail: [T13R_A_REMEDIATION.md](inventory-truth/t13/T13R_A_REMEDIATION.md).

## Historical handoff — T13R-A safe stop, 2026-09-13T15:50:34Z (superseded)

Status: **T13R-A SAFELY CHECKPOINTED — READY FOR HANDOFF** (implementation not
started). Repository `vn-co2/Frigo-dev`, ID **1368281478**. Branch
`hoplite/oropos-eb2d4886--t13r-a-data-integrity-ownership`; starting/pre-stop SHA
`b9735b441d93dfb7d7d409a47292974c8f2f1e52`. The audit commit is docs-only, descends
from docs head `4fcbc96…`, is published remotely (`hoplite/oropos-eb2d4886`,
`git ls-remote` equality verified), and is protected from amendment.

Verified before any edit: empty non-doc delta from rejected freeze `7b7bb69…`;
origin/main `d1b06732…` unchanged; migrations 31, 0031 untouched, no 0032.
Finding status: P1-1/P1-2/P1-3/P1-4/P2-A/P2-B all **NOT STARTED**;
`NO_NEW_T13R_A_CODE_COMMIT=true`. Executed: full identity gate and
`git diff --check` PASS. Not run (nothing to test): typecheck, scoped lint,
focused/full/D1/browser suites, migration replays, authority audit.

Uncommitted preserved file: `.hoplite/settings.json` (pre-existing workspace
overlay; prohibited from commit by safe-stop rules). Complete state, exact
commands and resume point:
[T13R_A_REMEDIATION.md](inventory-truth/t13/T13R_A_REMEDIATION.md).
Safety: no freeze, no main merge, no deploy, no remote D1, no PayOS, no T14, no
repository reconciliation. Next step: begin T13R-A implementation on this branch,
starting with the P1-1/P2-A evidence schema decision, one red/green finding at a
time; deferred T13R-B blockers stay open.

## Current handoff — independent final review failed, 2026-09-13

Status: **T13 INDEPENDENT FINAL REVIEW — FAIL**. No remediation was performed.
Review branch `hoplite/oropos-eb2d4886` starts at docs head
`4fcbc96b5a5d4b3cea2c2ad0bdb5682b1866891a`. The detached application freeze
`7b7bb695ee597a46cf4022a2c534e2fea374be5d` remains clean. Repository ID 1368281478
is verified under current provider name `vn-co2/Frigo-dev`; protected main and
the certified remote branch retain their required exact SHAs. Non-doc delta from
freeze to docs is empty; all 31 migration blobs retain their introducing bytes.

Fresh verification: lint/typecheck/build, **3372/132** full, **194/10** focused,
**92/5** real local D1, **36/36** browser, migration smoke, fresh local 31-migration
apply, legacy replay/upgrade, local schema and diff PASS. Existing browser suite
ran serially after source-writing tests. Hosted exact-freeze checks are absent.

Findings: **P0 0 / P1 4 / blocking P2 6 / P3 3 groups**. Independent probes
reproduced async evidence/confidence loss, U7 canonical-identity loss and cross-lot
draft submission, receipt response-ID mismatch, fabricated fridge confidence,
lost confirmed expiry, stale generic inventory conflict recovery, unqualified
Home estimates, and false unopened labels for NULL opening evidence. Raw review
field coverage and failed-refetch handling also have source evidence.

Retained diagnostic limitations: one audit input initially used the wrong version
field; its corrected focus-refetch probe remained inconclusive and is not a
finding. Home initially lacked the synthetic onboarding prerequisite; the corrected
fixture reproduced the defect. Original historical certification logs were absent;
fresh exact-freeze gates replaced, rather than authenticated, those historical runs.

Complete report, original acceptance and roadmap matrix, exact commands and
evidence: [T13_INDEPENDENT_FINAL_REVIEW.md](release/T13_INDEPENDENT_FINAL_REVIEW.md).
Only that report and required status/handoff docs changed; pre-existing
`.hoplite/settings.json` work was preserved and excluded. No PR, merge, deploy,
remote D1, PayOS application work, T14, or repository reconciliation.

Next action: **NEW T13 REMEDIATION BRANCH → confirmed blockers only → new freeze
→ independent certification**. Do not reconcile production yet. Earlier handoffs
below are historical and superseded by this failed independent review.

## Current handoff — T13 final detached certification, 2026-09-13

Task: T13B-B repository-owned browser harness → freeze → detached certification.
Status: **T13 COMPLETE — STOP for INDEPENDENT T13 FINAL REVIEW**.
Repository: `vn-ca1/Frigo-dev`, ID **1368281478**.
Main: `d1b06732f8a80db4e77986df31ff28d9f04641fa`, unchanged.
Branch: `hoplite/mende-26679a14--browser-harness-final-cert`.
Starting HEAD: `3262eaff86333da142ada1135e5a20c58ea640eb`; application fd32aa8.
Separate U7 application fix: `47b10e25d6853a9bc4f9dfcf2e83bc01ba330bf2`.
**T13B_APPLICATION_FREEZE: `7b7bb695ee597a46cf4022a2c534e2fea374be5d`**,
published/fetched equal. Final docs publication follows separately and must have
an empty non-doc delta; its exact SHA is recorded after commit creation.

Changed: Playwright 1.63/Chromium isolated harness, mobile A–I/U7/reconciliation
tests, test-only fixture controls and privacy-safe failure artifacts. A real
browser negative test identified missing U7 existing-lot metadata fields; the
separate fix adds name/unit/category to expiry/storage through existing T09 adapters.
No prior scan hardening, inventory architecture, production configuration or schema
was redesigned. HTML report output was removed after synthetic leakage proof.

Executed: full pre-freeze **3372/132**, detached **3372/132**; browser before and
after freeze **36/36** at all three widths. Detached T08 **130/2**, T09 **1259/17**,
T10 **98/6**, T11 **39/2**, T12 **22/3**, T13/T13B **271/12**; 10-file focused
**194/194** including hardening 26 and CLI 26. Real local workerd/D1 **92/5**.
Lint/typecheck/build/migration smoke/fresh local D1/legacy replay/schema/diff PASS;
new detached checkout `/tmp/frigo-t13b-detached-cert` remains clean. Writer/reader
UNKNOWN 0/0, 31 migrations, unchanged 0031, no 0032. Original AC1–AC14 PASS and all
required roadmap rows DONE. Scoped P0/P1/blocking P2/P3: 0.

Failures: first concurrent detached browser 35/36 (H document marker lost on Vite
reload from existing generator test); same freeze passed all 36 serially afterward.
No frozen file or assertion was changed. Reproduce browser only after source-writing
checks finish. Complete chronology and exact commands:
[T13B_FINAL_HARDENING.md](inventory-truth/t13/T13B_FINAL_HARDENING.md).
Hosted: **NO HOSTED GITHUB CI STATUS FOR T13B_APPLICATION_FREEZE**.

Next action: independent final review of the frozen tree, original AC matrix,
roadmap closure and docs-only delta. Do not implement further work, merge main,
deploy, access remote D1, touch PayOS, start T14, or reconcile repositories.
Earlier handoffs below are historical and superseded by this section.

## Current handoff — fresh-session Preview safe-stop, 2026-09-13

Task: resume T13B-B browser/final-certification WIP only; do not begin T14 or integration.
Status: **T13 NOT COMPLETE — BROWSER VERIFICATION BLOCKED**; no application defect was
found or reopened.
Repository: `vn-ca1/Frigo-dev`, ID **1368281478**. Main:
`d1b06732f8a80db4e77986df31ff28d9f04641fa` (unchanged).
Branch/start: fresh thread branch `hoplite/mende-26679a14` and prior continuation
`hoplite/kos-9d39545d--t13b-b-final-certification` both started at
`a9b5904aeba0fc7e4d649165770a4e86701312a2`; initial status/diff empty.
Lineage: verified `2334a6f -> c37a9b8 -> f845d04 -> fd32aa8 -> a9b5904`, with the
`fd32aa8..a9b5904` non-doc diff empty.
Preview: effective run `node scripts/security-preview.mjs`. Three schema-valid calls
(`preview`, 120 seconds, promotion `preview:3000`) all failed before startup:
`Preview port must be a currently discovered HTTP listener owned by the managed preview run`.
Port 3000 is the harness default, but no harness listener was running; only browser
processes were listening. No settings/script change, ad-hoc server, or workaround.
Checks: workspace setup reported ready with no configured setup run. No fresh
focused/full/type/lint/build/D1/migration-replay/schema/authority checks ran; 176/9 and
26 hardening/adoption results are historical only. `CURRENT_FULL_TEST_COUNT` and
`CURRENT_FULL_FILE_COUNT` are not established. Migration integrity passed (31,
unchanged 0031, no 0032); `git diff --check` passed. Platform fault report recorded.
Not run: flows A–I, 360/390/430 checks, and real viewport-emulation capability.
Next: repair the supported managed Preview interface and resume every mandatory WIP
flow before measuring the baseline, closing AC/roadmap evidence, freezing, and clean
certification. No `T13B_APPLICATION_FREEZE` or `T13B_DOCS_HEAD`; no merge, deploy,
remote D1, PayOS, or T14 work.

## Current handoff — confirmed UX checkpoint, 2026-09-13 12:40 UTC

Task: finish T13B-B, not T14/integration/deployment.
Status: **T13 NOT COMPLETE — BROWSER VERIFICATION BLOCKED**, owner stop rule applied.
Identity: fresh verification of `vn-ca1/Frigo-dev`, ID 1368281478, historical redirect,
guarded main, old WIP branch, 2334a6f -> c37a9b8 -> f845d04 ancestry/docs-only delta.
Branch: `hoplite/kos-9d39545d--t13b-b-final-certification`, created at exact f845d04.
Published WIP: `fd32aa8deaee7df454245591015780c59f909352`, not application freeze.
Change: completed/read-only confirmed scan wording and `Xem tủ lạnh`; no confirmation
CTA/manual addition. All persisted controls disabled and previous 23 regressions retained.
Checks: 176/176 (9 files), hardening 26/26, operator 26/26, typecheck/scoped lint/diff PASS.
Failure: one fresh supported-schema Preview attempt still requires a pre-discovered
managed listener; reported platform fault. Only browser listeners exist, no isolated app.
No unsupported workaround/settings commit. Browser/mobile and final gates remain unrun.
Next: follow latest `inventory-truth/t13/T13B_B_WIP_HANDOFF.md`; unblock Preview,
verify flows A–I and widths, measure actual current full suite (not 3177/124), close
original AC/roadmap/source audit and independent diff review, then freeze/certify.
No final application/docs SHA assigned; old WIP/main preserved; no merge/deploy/remote D1/PayOS.

## Current authoritative handoff — T13B-B hardened WIP, 2026-09-13

Program: Inventory Truth Layer / T13B-B final hardening after recovery
Status: **BLOCKED_FINAL_VERIFICATION — T13 NOT COMPLETE**
Repository: `vn-ca1/Frigo-dev`, ID **1368281478**; historical `Tungjpstore/Frigo-dev`
transfer/redirect verified against that ID.
Starting WIP: `2334a6f41cf68d42ae1eba7a30440b8fe324eb31`; all specified main/rescue/
quota-WIP refs and `c31567e` ancestry passed before editing.
Branch: `hoplite/kos-9d39545d--t13b-b-final-hardening`
Published/fetched WIP: `c37a9b8d7afc66507052bbc8f1e8a24fdc896e8d`, **not a freeze**.
Changed: route-authoritative ScanResultPage, fenced polling/confirm/refetch, safe
domain errors, store-retained terminal review status, 23 permanent regressions.
Checks: final focused 173/173 (9 files), preserved backend 1122/1122 (17 files),
typecheck, scoped lint, CLI syntax and diff check PASS. Red/green diagnostic:
5 targeted cases fail against recovered WIP, all pass on continuation.
Failures resolved: missing node_modules; two incorrect test DTO TS2345 errors;
duplicate discovery of an initially nested diagnostic worktree (moved outside).
Remaining blocker: mandatory `preview_start` promotion schema rejects first startup;
reported to platform. Effective run override selects the existing isolated harness;
pre-existing settings overlay stays uncommitted. No browser/mobile proof or final
freeze/full-suite/real-D1/migration/schema/build certification was fabricated.
Migration/authority: 31 unchanged, no 0032; writer/reader UNKNOWN 0/0. Historical
`69b0dc6` is not an ancestor, but all five Part A docs were retained; no history rewrite.
Next: follow `inventory-truth/t13/T13B_B_WIP_HANDOFF.md` to unblock Preview, finish
original AC1–AC14/roadmap evidence, freeze, run clean detached gates, publish docs-only
head, then independent T13 final review. Main unchanged; no merge/deploy/remote D1/PayOS.

## Current authoritative handoff — T13B-B stopped by owner, 2026-09-13

**Quota-safe WIP; not final certification.** Read
[T13B_B_WIP_HANDOFF.md](inventory-truth/t13/T13B_B_WIP_HANDOFF.md) first.
It records the actual application-checkpoint base versus the owner's expected docs
base, all implementation/test changes, 109 passing focused tests, partial browser
evidence and the interrupted review. After initial access failures, WIP
`a8cefd13505bc6b45dd11f45a6323539deb60f93` was published/fetched with exact equality;
main was reverified unchanged. Fresh public numeric metadata still returns 404.
Preserve the checkpoint and wait for explicit permission before resuming work;
reverify identity and the documented base discrepancy first. No settings edits or
main merge. The safe-stop report records the final documentation-follow-up SHA.

## Current authoritative handoff — T13B-A backend continuation, 2026-09-13

Program: Inventory Truth Layer — T13B split continuation
Task: T13B-A BACKEND TRUTH HARDENING (Part A only)
Status: **T13B-A COMPLETE — READY FOR T13B-B**; no final T13 certification
Repository: vn-2l/frigo-dev; verified numeric ID 1364064929
Branch: hoplite/megara-hyblaia-888f1514 (platform-generated equivalent)
Base: 3458c6cb971f5d96fce8eda3abc3d708437ce713; verified HEAD before edits
origin/main: d1b06732f8a80db4e77986df31ff28d9f04641fa; unchanged, no merge/rebase
T13B_A_CHECKPOINT: c31567ec7dfa8f95808c20c834b327cbb3425f9c
Publication: application/test checkpoint pushed without force, fetched, local/remote equality PASS
Documentation: separate descendant commit; continue from final published branch HEAD
Primary handoff: docs/ai/inventory-truth/t13/T13B_A_HANDOFF.md
Decision: docs/ai/inventory-truth/DECISIONS.md, DEC-016

Actual changes: per-line T09 CREATE for adopted receipt purchases preserves old lot
and new purchase truth; fridge grouped CORRECT unchanged. Validated `scanEvidence`
is in existing receipt/event fingerprints, not a new ledger/event-envelope key.
Production `correctionOf()` use; T10 rawName from retained OCR, null when absent,
with actual subject identity. Atomic confirmation retained. Committed concurrent
twins/response loss recover through scoped status-based replay and strict T11 reads.

Executed checks: `pnpm install --frozen-lockfile`; focused Vitest **1,122/1,122
(17 suites)**; real local workerd/D1 **92/92 (5 suites)**; `pnpm typecheck`;
scoped ESLint (all six changed application/test files); `git diff --check`;
scope/ancestry/migration comparisons. All PASS. Exact commands in primary handoff.
Negative control: four new regression tests fail as expected at exact base; removed
the temporary worktree. Migration count 31; 0001–0031 untouched; 0032 absent.
Focused writer UNKNOWN = 0; canonical reader UNKNOWN = 0; no new stock SQL/readers.

Failures resolved: typed OCR/expiry mapping; incompatible top-level event metadata
(0025 guard, replaced by existing fingerprint extension); test helper binding and
storage-path assertions; intermittent D1 concurrent replay 500 (91/92 before fix,
92/92 after). No known failing Part A backend gate remains. Setup tool state issue
reported; direct locked dependency install worked without changing configuration.

NOT RUN — DEFERRED TO T13B-B FINAL VERIFICATION: full application suite/full lint/
build, dedicated migration smoke/schema/upgrade matrix, browser/mobile/UX checks,
adoption workflow, final T13 acceptance matrix/certification. No hosted CI requested.
Next action: verify repository/main guards and checkpoint ancestry, read the primary
handoff, complete Part B frontend/adoption scope and final verification. Do not
restart from main, rewrite prior T13, mutate migrations, merge or deploy.

## Current authoritative handoff — T13 Receipt/Vision Truth & Inventory UX V2, 2026-09-13

Program: Inventory Truth Layer — T08-T12 release train + T13 (final roadmap task)
Task: T13 RECEIPT/VISION TRUTH & INVENTORY UX V2 — implementation
Status: **T13 COMPLETE on branch; main NOT merged, nothing deployed**
Repository: vn-2i/frigo-dev (repository ID 1364064929 is ground truth; owner names redirect)
Branch: hoplite/lindos-0368e413
Base: exact 578f705f12cfde6e5ebe65bdc574154a0670c8df (ROADMAP_AUDIT_HEAD)
origin/main: d1b06732f8a80db4e77986df31ff28d9f04641fa (NOT advanced)
T13_APPLICATION_FREEZE: ad342703fb31a2b97d2798f1161fb83d4d0ed090
Primary documents: docs/ai/inventory-truth/t13/{README,RECEIPT_VISION_TRUTH,UX_V2,AUTHORITY_MAP,TEST_MATRIX,CONTINUATION}.md

Design: **evidence is not authority.** OCR/vision -> user review -> T10 observation ->
T09 command -> lots. T13 adds exactly ONE new write statement (a guarded INSERT into
inventory_observations riding the existing atomic batch) and ZERO new writers to
inventory_lots / inventory_items / inventory_events, and ZERO new inventory_items readers.
Writer and reader audits: UNKNOWN = 0.

Migration: 0031_scan_evidence_retention.sql, additive only. Adds ocr_raw_name, ocr_quantity,
ocr_unit, ocr_confidence (nullable: the legacy confidence column is NOT NULL DEFAULT 0.9 and
cannot represent "unknown") and review_state to scan_items, coupled to is_confirmed by
insert/update triggers rather than a column CHECK (ALTER TABLE ... ADD COLUMN ... CHECK is
evaluated against pre-existing rows and would fail on already-confirmed rows). Migrations
0001-0030 untouched.

Executed checks (clean detached worktree /tmp/t13-freeze @ ad34270, pnpm install
--frozen-lockfile, status empty): full suite **3,177/3,177 across 124 files** (218.25 s);
real D1 **81/81** (5 files); lint PASS; typecheck PASS; build PASS; check:migrations PASS
(migration-smoke=ok); schema:check:local PASS (after `wrangler d1 migrations apply
frigo-db --local` provisions the gitignored local D1 in a fresh worktree — the gate reads
existing local state and does not create it); git diff --check PASS; git status --porcelain
empty. Baseline before T13: 3,092/120 and 70 real-D1.

Browser verification (isolated preview only; no remote D1, no deployment): flows A (receipt
-> review -> confirm -> RECEIPT provenance + real purchasedAt), C (MOVE), D (stale edit ->
409 CONFLICT with prior state preserved), D' (expiry UNKNOWN -> ESTIMATED -> UNKNOWN and
UNKNOWN -> KNOWN) and E (observation -> dismiss -> RECONCILED with stock untouched) all
verified. **7 defects that the green test suite had not caught were found this way** and are
fixed with permanent regression tests; the worst was a truncation-induced lot-id collision
that made every line of one receipt share a single lot id.

Failures: none outstanding.
Known verification limits: viewport emulation was unavailable in this sandbox (set viewport
and set device both left innerWidth at 1440), so the 360/390/430 check is a computed
layout-overflow probe (0 offenders) rather than a visual check; the reconciliation accept
(CORRECT/MOVE) path was exercised through tests and the API but not through a UI click,
because the seeded preview data yields STALE_OBSERVATION verdicts with no safe proposal
(which correctly disables the button). No hosted GitHub CI status exists for this SHA.

Next action: owner review of this branch. Do NOT merge main, deploy, run remote D1, touch
PayOS, rewrite migrations 0001-0030, add a second inventory writer, or enable
MEAL_PLANNER_ENABLED / cutover flags.

## Current authoritative handoff — Roadmap reconciliation / gap audit, 2026-09-12

Program: Inventory Truth Layer — T08–T12 release train, post-certification roadmap audit
Task: ROADMAP RECONCILIATION / GAP AUDIT (original T11 Receipt/Vision Truth + Inventory UX V2 vs RC 64c5501) — audit only
Status: AUDIT_COMPLETE — verdict **T13 REQUIRED**; main NOT merged
Repository: vn-2g/frigo-dev (repository ID 1364064929; earlier owner names redirect)
Audit branch: hoplite/delphoi-499ad774 (requested logical name hoplite/inventory-truth-roadmap-reconciliation)
Base: exact 1cae11ee2e5acdc1d6c76266ad72b3ef744d7797 (re-certification docs HEAD) · Application RC: 64c5501ab0110658718b3752bd84e537f0854e12 (unchanged)
origin/main: d1b06732f8a80db4e77986df31ff28d9f04641fa (NOT advanced)
ROADMAP_AUDIT_HEAD: 3fce917ad6e079f76cf3bdd55e354ce0e35054bf (audit docs commit; verified: descends from 1cae11e,
    `git diff 64c5501 3fce917 -- . ':(exclude)docs'` empty). This SHA-recording commit follows it on the same branch.
Primary documents: docs/ai/release/INVENTORY_TRUTH_ROADMAP_RECONCILIATION.md (sources S1–S12, matrix R1–R12 / U1–U17,
    pipeline trace, materiality) and docs/ai/release/T13_PROPOSED_SCOPE.md (definition only; starting SHA = ROADMAP_AUDIT_HEAD).
Executed checks (clean detached worktree /tmp/frigo-rc @ 64c5501, status empty): pnpm install --frozen-lockfile (lockfile
    unchanged); pnpm exec vitest run tests/unit/receipt-scan.test.ts tests/unit/scans.test.ts tests/unit/scan-privacy.test.tsx
    tests/integration/scan-response-loss.test.ts tests/integration/inventory-adoption.test.ts → 55/55 (5 files, 5.37 s);
    temporary uncommitted probe tests/__audit_probe__ → 4/4 (receipt lot source_type='SCAN', purchased_at/money NULL,
    expiry_kind='KNOWN' from shelf-life default, observations 0, OCR raw overwritten on correction, altered re-confirm →
    200 idempotentReplay, cross-tenant 404/404), then deleted. Full 3,092 suite NOT rerun (no application change).
Failures: none. Release-safety findings: P0/P1/P2 none; P3 — inferred expiry as KNOWN (R6/U6), CF provider fabricated
    defaults (R5), FINAL_WRITER_MAP scan changed-payload wording (R9), pre-existing outbox permanent-409 block (U15).
Next action: owner decision — (a) authorize T13 from ROADMAP_AUDIT_HEAD per T13_PROPOSED_SCOPE.md, and/or (b) a separate
    explicit main-integration review for 64c5501 (technical certification stands; this audit does NOT declare final merge
    readiness). Do NOT implement T13, merge main, deploy, run remote D1, touch PayOS, rewrite migrations, enable
    MEAL_PLANNER_ENABLED, or commit the workspace overlay from this packet.

## Current authoritative handoff — Independent final re-certification, 2026-09-12

Program: Inventory Truth Layer — T08–T12 release train + D3/D1/D2 remediation
Task: Independent final re-certification (audit only)
Status: RECERTIFICATION_COMPLETE — RC 64c5501 TECHNICALLY CERTIFIED; main NOT merged
Repository: vn-2f/frigo-dev (repository ID 1364064929; `vb-2f` redirects)
Review branch: hoplite/akraiphia-akraiphnion-a03445c7--inventory-truth-final-recertification (base bc1532e; suggested name hoplite/inventory-truth-final-recertification)
Application RC: 64c5501ab0110658718b3752bd84e537f0854e12 · Docs HEAD reviewed: bc1532ea406525dc7fa9e59c58d320fd525774d8
origin/main: d1b06732f8a80db4e77986df31ff28d9f04641fa (unchanged)
Executed checks (clean detached /tmp/hoplite/rc2 @ 64c5501): pnpm install --frozen-lockfile (Node v24.19.0, pnpm 10.26.0,
    lockfile unchanged); pnpm test 3,092/3,092 · 120 files · 196.29 s; D3 32/32; auth regression selection 143/143;
    T09 654/654; T10 98/98; T11 39/39; T12 22/22; T08 430/430; real D1 70/70; pnpm lint/typecheck/build PASS;
    pnpm check:migrations ok (30); local D1 apply + pnpm schema:check:local PASS; git diff --check clean;
    git status --porcelain empty. Fresh real-D1 replay 0001→0030 (30/30, 200 objects identical to d156001) and
    legacy-upgrade replay (0001–0022 + legacy rows → 0023–0030) PASS. Negative control: 3/6 UI tests fail on the
    pre-fix AuthPage (4/6 with all three pre-fix client files). Browser reproduction at 64c5501 PASS.
Failures: none. Findings: P0/P1/P2 none; P3 N1 (pre-existing raw error text for generic auth errors), N2 maintainability note.
Next action: ROADMAP RECONCILIATION / GAP AUDIT of 64c5501 (separate task). Do NOT merge main from this certification alone.
Do NOT deploy, run remote D1, touch PayOS, rewrite migrations, enable MEAL_PLANNER_ENABLED, or commit the workspace overlay.

## Current authoritative handoff — Final RC targeted remediation, 2026-09-12

Program: Inventory Truth Layer — T08–T12 release train
Task: Targeted remediation of review defects D3 (P1), D1 (P2), D2 (P2)
Status: REMEDIATION_COMPLETE — D3 closed, D1 closed, D2 documented; ready for re-certification
Repository: vn-2f/frigo-dev (repository ID 1364064929; `vb-2f` redirects)
Branch: hoplite/akraiphia-akraiphnion-a03445c7--inventory-truth-final-remediation (published; requested name hoplite/inventory-truth-final-remediation) — base 32b6ec1 → 5cb4caa → d156001; main d1b0673 unchanged
NEW_APPLICATION_FREEZE: 64c5501ab0110658718b3752bd84e537f0854e12
Docs HEAD: docs-only commit on top; exact SHA in the final report
Application delta vs d156001: .hoplite/settings.json (A, main blob 3818a00), src/web/pages/AuthPage.tsx,
    src/web/services/auth.ts, src/web/services/http.ts, tests/integration/inventory-guest-transfer.test.ts (+1),
    tests/unit/auth-guest-transfer-deferred.test.tsx (new, 6). No server, migration, dependency or config change.
Executed checks (clean detached /tmp/hoplite/remed-clean @ 64c5501): pnpm install --frozen-lockfile (Node v24.19.0,
    pnpm 10.26.0, lockfile unchanged); pnpm test 3,092/3,092 · 120 files · 191.47 s; D3 suites 32/32; real D1 70/70;
    T09 654/654; T10 98/98; T11 39/39; T12 22/22; pnpm lint/typecheck/build PASS; pnpm check:migrations ok (30);
    wrangler d1 migrations apply --local + pnpm schema:check:local PASS; git diff --check clean; git status --porcelain empty.
    Browser: guest → register → deferral notice → “Tiếp tục không chuyển dữ liệu khách” → account session (isolated preview).
Failures: none. Negative control: new UI suite fails 3/6 against the pre-fix AuthPage.
Next action: independent re-certification of 64c5501 (repeat the §11 clean-checkout gates and the D3 browser check);
    then main integration is a separate, explicitly authorized step. Follow-up MEAL_PLANNER_AUTHORITY_CUTOVER before
    enabling MEAL_PLANNER_ENABLED for adopted households.
Do NOT merge main, deploy, run remote D1, touch PayOS, rewrite migrations, enable MEAL_PLANNER_ENABLED, or commit the workspace overlay.

## Current authoritative handoff — Final Release Integration Review, 2026-09-12

Program: Inventory Truth Layer — T08–T12 release train
Task: Final independent integration review / release-candidate certification
Status: REVIEW_COMPLETE — verdict RELEASE CANDIDATE NOT READY (D3 P1, D1 P2, D2 P2; no P0)
Repository: vn-2f/frigo-dev (repository ID 1364064929; packet name vb-2f redirects)
Review HEAD: 5cb4caa0d5b3c86b00954d77cd40b16027c21df1 (T12 docs); RC: d15600186c3e73faba011eb690ac6cd70e8d3d2d
origin/main: d1b06732f8a80db4e77986df31ff28d9f04641fa (unchanged; RC 54 ahead / 0 behind)
Deliverables: docs/ai/release/INVENTORY_TRUTH_RELEASE_CERTIFICATION.md,
    INVENTORY_TRUTH_ANCESTRY.md, INVENTORY_TRUTH_CHANGE_MANIFEST.md (docs only; no app code touched)
Executed checks (clean detached /tmp/hoplite/rc-app @ d156001): pnpm install --frozen-lockfile
    (Node v24.19.0, pnpm 10.26.0, lockfile unchanged); pnpm test 3,085/3,085 · 119 files · 199.68 s;
    T09 654/654 (10 suites) and 1,432/1,432 (22 suites); T10 98/98; T11 39/39; T12 22/22;
    real D1 70/70 (44+7+11+8); pnpm lint/typecheck/build PASS; pnpm check:migrations ok;
    wrangler d1 migrations apply --local 30/30 on fresh + pnpm schema:check:local PASS;
    fresh sqlite3 0001→0030 PASS; legacy-upgrade simulation on sqlite3 and real local D1 PASS;
    git diff --check clean; git status --porcelain empty (ignored dist/, node_modules/, .wrangler/ only).
Failures: none in gates. Defects found by review (not fixed here, per packet rules):
    D3 P1 guest→register 409 INVENTORY_TRANSFER_DEFERRED dead-end in web UI (reproduced via curl
    and browser on scripts/security-preview.mjs); D1 P2 .hoplite/settings.json deleted at 4553b8a;
    D2 P2 meal-planning-snapshot.ts reader undocumented (SAFE_DEFERRED, flag unbound in wrangler.jsonc).
Next action: targeted successor on the T12 branch — (1) AuthPage handles INVENTORY_TRANSFER_DEFERRED
    with an explicit retry without migrateFromHouseholdId + test; (2) git checkout d1b0673 --
    .hoplite/settings.json and commit that blob only; (3) update t11/READ_CONSUMER_MAP.md and
    t12/FINAL_AUTHORITY_MAP.md for D2. Then re-run §11 gates and the D3 browser check on the new SHA.
Do NOT merge main, deploy, run remote D1, touch PayOS, rewrite migrations, or edit the workspace overlay.

## Current authoritative handoff — T12 runtime verification fix, 2026-09-12

Program: Inventory Truth Layer — T08–T12 release train
Task: T12 final targeted hardening fix (review findings P1 + 2×P2)
Status: T12_COMPLETE (verified); awaiting separate Final Release Integration Review
Repository: vb-2f/frigo-dev (repository ID 1364064929)
Branch: hoplite/himera-6d3eda84-t10-observation-reconciliation-t11-inventory-read-authority-t12-inventory-closed-loop
Starting docs HEAD: 24668c20dfaac094aff0f84e0d59c1f0a333fbf8
Previous application freeze (superseded): 22f675d1cca76d05c93ebb2ed40bbaea11a72238
NEW T12 application freeze: d15600186c3e73faba011eb690ac6cd70e8d3d2d
Docs HEAD: docs-only commit on top; exact SHA in the final report
P1: tests/integration/inventory-closed-loop-d1.test.mjs — 8 real workerd/D1 cases
    (A accept exactly-once/replay/conflict, B DISMISS, C read→USE→read, D FEFO,
    E drift, F retry, G tenancy, H reconciliation-vs-manual STALE_SNAPSHOT).
    Real D1 62 → 70.
P2: tests/integration/inventory-closed-loop-routes.test.ts — real Hono routes
    POST /week/plans/:id/shopping/complete, POST /recipes/:id/cook/complete,
    GET /inventory (adopted; stale KV injected; replay/conflict/tenancy/no legacy batch).
P2: race regression requires LotCommandError STALE_SNAPSHOT; no receipt/commands/
    events/projection damage for the loser (integration + real D1).
Route fix: completeAdoptedCooking replays durable cooked_meals receipt before
    re-planning (response-loss retry regression found by the route proof).
Verification: baseline 3,072/117 · 62 real D1 → freeze 3,085/119 · 70 real D1;
    all gates PASS; clean detached exact-SHA checkout with EMPTY status. Migrations 30.
UNKNOWN production readers/writers = 0. Remaining P0/P1: NONE.
Next: Final Release Integration Review (separate; NOT started here). Do NOT deploy,
    run remote D1, touch PayOS, or merge main from this thread.

## Historical handoff — first T12 freeze (superseded)

Program: Inventory Truth Layer — **T08–T12 release train COMPLETE**
Task: T12 — closed-loop inventory integration & hardening (final train task)
Status: T12_COMPLETE; train ready for separate main integration
Repository: vb-2f/frigo-dev (repository ID 1364064929)
Branch: hoplite/himera-6d3eda84-t10-observation-reconciliation-t11-inventory-read-authority-t12-inventory-closed-loop
Base: T11 docs HEAD 847b0363… via train merge 14c02f8 (main d1b0673 untouched)
T12 application freeze: 22f675d1cca76d05c93ebb2ed40bbaea11a72238
Docs HEAD: docs-only commit on top; exact SHA in the final report
Closed loop: observation → reconciliation → T09 → lots → T11 → consumers,
proven by tests/integration/inventory-closed-loop.test.ts (9 tests: E2E
reconciliation exactly-once + replay + IDEMPOTENCY_CONFLICT; DISMISS inert;
recipe 500g-vs-5kg-tamper then 300g after USE; planner regeneration; shopping
idempotent retry; atomic FEFO poststate; tamper-proof notifications;
reconciliation-vs-manual single-winner race; drift matrix).
Display aliases: agreement-gated (tampered projection → canonical presentation).
Authority maps: docs/ai/inventory-truth/t12/FINAL_AUTHORITY_MAP.md and
FINAL_WRITER_MAP.md — UNKNOWN production readers/writers = 0.
Verification: baseline 3,063/116 · 62 real D1 → freeze 3,072/117 · 62 real D1;
lint/typecheck/build/30-migration smoke/schema PASS; clean detached exact-SHA
checkout repeats all with EMPTY status. No migration. Remaining P0/P1: NONE.
Next: independent review of the train; main integration happens separately.
Do NOT deploy, run remote D1, touch PayOS, or start a post-T12 task.

## Historical handoff — T11 hardening (superseded by T12)

Program: Inventory Truth Layer
Task: T11 — final targeted hardening fix (findings A–F)
Status: COMPLETE; T11_READY_FOR_INDEPENDENT_REVIEW
Repository: vb-2f/frigo-dev (repository ID 1364064929)
Branch: hoplite/himera-6d3eda84-t10-observation-reconciliation-t11-inventory-read-authority
Starting docs HEAD: e64ee7749d3110ecc7b1eb08216062fc404918d5
Previous application freeze (superseded): 657201f3a12f18dd96cc96adeac0dd1d3b75e6f4
NEW T11 application freeze: c15c9a81fc4367b3506a7e2693798ebe1424b0a9
Docs HEAD: docs-only commit on top; exact SHA in the final report
Published by direct commit publication (no PR tooling; overlay preserved
byte-for-byte uncommitted, SHA-256 6d8f5b45…). PR #3 left untouched.
A: real workerd/D1 T11 suite (11) via /read, /funnel, /read-race — real D1 62/62.
B: adopted-but-empty → native, [], no legacy/KV/auto-adoption (integration, real D1, HTTP).
C: READ vs MOVE/DISCARD/FEFO barrier tests (both harnesses); matrix complete.
D: readInventorySummary.activeCount = filtered length.
E: displayQuantity — retained kg/l alias only when label present + exact round trip;
   authority canonical; projection quantity never consulted; families never cross.
F: computeReadFreshness(expiry, state, now) deterministic; invalid → CORRUPT_LOT_ROW.
Verification: baseline 3,041/115 · 51 real D1 → freeze 3,063/116 · 62 real D1; all gates
PASS; clean detached exact-SHA checkout repeats all with EMPTY status. Migrations 30.
Remaining P0/P1: NONE. Merge-blocking P2: NONE.
Next: independent review. Do NOT merge main, deploy, run remote D1, touch PayOS, or start T12.

## Historical handoff — first T11 freeze (superseded)

Program: Inventory Truth Layer
Task: T11 — Inventory Read Authority & Projection Cutover
Status: COMPLETE; T11_READY_FOR_INDEPENDENT_REVIEW (PR #3, base = release train, main NOT a target)
Repository: vb-2f/frigo-dev (repository ID 1364064929)
Branch: hoplite/himera-6d3eda84-t10-observation-reconciliation-t11-inventory-read-authority
T11 base: train merge 30ce4ea (contains exact T10 docs HEAD c71692a)
T11 application freeze: 657201f3a12f18dd96cc96adeac0dd1d3b75e6f4
Docs HEAD: docs-only commit on the branch; exact SHA in the final report
Platform overlay auto-commit c7e2296 corrected by 4553b8a (workspace file preserved byte-for-byte, uncommitted).
Canonical answer: adopted households read inventory_lots + validated authority
metadata via readInventoryAuthority/readInventoryLot/readInventorySummary;
inventory_items is checked-for-parity compatibility, never a fallback; reads
are single-batch coherent snapshots, bounded (1000), deterministic, tenancy-
fenced, fail-closed on corruption; observations/events never decide truth.
Cutover: fetchHouseholdInventoryFromDb (GET /inventory, recipes, scans list
reads, weekly planner, notifications) + adoption gate; legacy-only raw reads
documented INTENTIONAL_LEGACY_READ. API ids/version semantics preserved
additively (READ_CONSUMER_MAP.md §identity).
Verification: baseline 3,024/3,024 · 114 files on the base tree; freeze full
3,041/3,041 · 115 files; real D1 51/51; lint/typecheck/build/30-migration
smoke/local schema/diff PASS; clean detached exact-SHA checkout repeats all
with EMPTY status. No migration (0023–0030 untouched).
Note: the T11 packet arrived truncated mid-§32; visible §0–31 + the §32
adoption gate were implemented; train conventions used for completion.
Next: independent review of PR #3. Do NOT merge main, deploy, run remote D1,
touch PayOS, or start T12.

## Historical handoff — T10 observation claim fence (superseded)

Program: Inventory Truth Layer
Task: T10 — P1 concurrency/integrity fix: atomically fence competing reconciliation decisions
Status: P1_REPRODUCED_FIXED_AND_FULLY_VERIFIED; T10_PASS_READY_FOR_INDEPENDENT_REVIEW
Repository: vb-2f/frigo-dev (repository ID 1364064929)
Branch: hoplite/himera-6d3eda84-t10-observation-reconciliation
Starting reviewed HEAD: bf86efb40e4eb13120a34679225aa24881a356b4
Previous application freeze (superseded): 4c414fa7eb33329ee12936c0899644af67e48f07
NEW T10 application freeze: 7393edcd4fb9cc8bb4df2a06628fb5dc57f8607b
Docs HEAD: docs-only commit on top of the freeze; exact SHA in the final report
T09 ancestors intact (docs d522769…, application bf391c5…). Main d1b0673… NOT merged.
Root cause: the decision batch ended with `UPDATE inventory_observations … WHERE status='OPEN'
AND version=?`; a zero-row match is a silent D1 success (proven: success=true, changes=0), so the
batch never proved the claim. Losers were only stopped by the 0030 receipt trigger (raw SQLite
error leaked); without that trigger two DISMISS decisions both committed.
Fix: `observationClaimGuard` — last batch statement, INSERT INTO inventory_events with NULL
inventory_item_id WHERE changes() <> 1 → NOT NULL abort → D1 rolls back the entire batch (T09
commands, events, projection, decision receipt, observation). Loser classification:
committed same-key exact twin → replay; altered → IDEMPOTENCY_CONFLICT; observation not OPEN at
expected version → OBSERVATION_VERSION_CONFLICT; T09 CAS → STALE_SNAPSHOT/STALE_VERSION; else
PERSISTENCE_FAILED. Pre-batch exact replay still precedes OPEN/version rejection. No
process-local locks; the mechanism is D1's own atomic batch + changes().
Regressions: fence suite 13 (all fail pre-fix); real-D1 zero-row proof + controlled workerd race.
Verification: full 3,024/3,024 (114 files); T10 focused 98/98; T09 focused 323/323; real D1
51/51; lint/typecheck/build/30-migration smoke/local schema/diff PASS; clean detached exact-SHA
checkout repeats everything with EMPTY status. No GitHub CI configured for the branch.
Preserved: multi-field composition (≤1 CORRECT + ≤1 MOVE, same lot/version, boundary
fail-closed, CORRECT+MOVE atomic via useCurrentLotVersion, unique #CORRECT/#MOVE keys,
explicit terminalState, fresh-plan authority, native/backfilled coherence).
Remaining P0/P1: NONE. Merge-blocking P2: NONE.
Next: independent review. Do NOT merge main, deploy, run remote D1, touch PayOS, or start T11.

## Historical handoff — composition fix 4c414fa (superseded)

Program: Inventory Truth Layer
Task: T10 — final targeted multi-field reconciliation composition fix
Status: P1_REPRODUCED_FIXED_AND_FULLY_VERIFIED; T10_COMPLETE_READY_FOR_INDEPENDENT_REVIEW
Repository: vb-2f/frigo-dev (repository ID 1364064929)
Branch: hoplite/himera-6d3eda84-t10-observation-reconciliation
Starting docs HEAD: aa17aeed18b61cad97a2f4f976046a102969a23a
Previous application freeze (superseded): 6c28858acd0627d2d602998107c2e260c5e4f0d5
NEW T10 application freeze: 4c414fa7eb33329ee12936c0899644af67e48f07
Docs HEAD: docs-only commit on top of the freeze; exact SHA in the final report
T09 ancestors: docs d522769ae89496fd4b3f26419f1fdfe23d9e926a, application
bf391c5fdcdd9e9c2f2257db515815e082cb4381 (both intact)
Main SHA: d1b06732f8a80db4e77986df31ff28d9f04641fa (NOT merged)
Reproduction (pre-fix): quantity+expiry → 2 CORRECT (verdict EXPIRY_UPDATE);
quantity+opened → 2 CORRECT; quantity+expiry+opened → 3 CORRECT; quantity+storage →
1 CORRECT + 1 MOVE; quantity+expiry+storage → 2 CORRECT + 1 MOVE (3 proposals).
Fix: planner merges into ≤1 CORRECT + ≤1 MOVE (contradiction → CONFLICT); decision
boundary enforces the same invariant and fails closed on malformed caller proposals;
decisionCommandSpecs re-asserts uniqueness and composes MOVE via useCurrentLotVersion.
Verification: 19 new regressions (16 fail pre-fix); full 3,009/3,009 (113 files);
T10 focused 78/78; real local D1 49/49; lint/typecheck/build/30-migration smoke/local
schema/diff PASS; clean detached exact-SHA checkout repeats everything with EMPTY status.
No migration; 0023–0030 untouched; PayOS untouched; no PR created/updated for this fix.
Remaining P0/P1: NONE. Merge-blocking P2: NONE.
Next action: independent review. Do NOT merge main, deploy, run remote D1 migrations,
touch PayOS, or start T11. Settings overlay preserved byte-for-byte/uncommitted.

## Historical handoff — initial T10 freeze 6c28858 (superseded)

Program: Inventory Truth Layer
Task: T10 — observations, evidence and reconciliation authority
Status: T10G COMPLETE; T10_COMPLETE_READY_FOR_INDEPENDENT_REVIEW
Repository: vb-2f/frigo-dev (repository ID 1364064929; task lineage vn-2e/frigo-dev)
Branch: hoplite/himera-6d3eda84-t10-observation-reconciliation (platform start-branch
successor, dashed to avoid the GitHub ref conflict with the live parent branch name)
Starting T09 docs SHA: d522769ae89496fd4b3f26419f1fdfe23d9e926a
T09 application ancestor: bf391c5fdcdd9e9c2f2257db515815e082cb4381 (intact)
Train merge: 668920fa462524e65a79d31a7b0844720baf38e0 (PR #1 himera -> kydonia,
internal base ONLY; main NOT merged)
PR tooling overlay-commit correction: 09f13c41beb826b9dd0b53037935947d6b09fd7f
(settings.json restored; overlay itself uncommitted and byte-preserved,
SHA-256 6d8f5b45041a5f41bfa6463a5f88fe1e0f5602822ecb403a5d949961f00bbee7)
T10 application freeze: 6c28858acd0627d2d602998107c2e260c5e4f0d5 (published/fetched,
local == remote == clean-checkout SHA)
T10 docs HEAD: docs-only commit on top of the freeze; exact SHA in the final report
Main SHA: d1b06732f8a80db4e77986df31ff28d9f04641fa (unchanged, NOT merged)
Baseline (pre-edit, T09 tree): 2,926 tests/108 files; 44 real local-D1; all static
gates PASS.
Verification: full 2,990/2,990 (112 files, 177.04s working tree; 175.72s clean
checkout); T10 focused 1,097/19 files; real local D1 49/49; lint/typecheck/build;
30-migration smoke incl. 0030 + T10 object/behavioral asserts; local D1 schema gate
requires 0030; fresh 0001->0030 and upgrade 0029->0030 local-only PASS;
`git diff --check` clean; clean detached exact-SHA checkout repeats everything with
EMPTY `git status --porcelain`. NO GITHUB CI STATUS for the branch.
Key design: additive 0030 observations/decisions (evidence never mutates inventory);
pure deterministic planner (9 verdicts, exact milli comparison, name-only matching
refusal, contextual units UNSUPPORTED, confirmed-expiry precedence, stale detection
by household inventory version); decision confirmation composes existing T09
CORRECT/MOVE via composeInventoryLotCommands in ONE atomic D1 batch (decision receipt
+ T09 receipts/events + observation lifecycle); response-loss replay by decision
fingerprint; altered semantics -> IDEMPOTENCY_CONFLICT; drift -> OBSERVATION_STALE
fail-closed; no second stock ledger; NO new HTTP routes (T09 precedent; T11 owns UX).
T11: NOT STARTED. T12: NOT STARTED.
Remaining P0/P1: NONE. Relevant merge-blocking P2: NONE known.
Next action: independent review of PR #2. Do NOT merge main, deploy, run remote D1
migrations, touch PayOS/payment code, or start T11 from this packet.
Details: inventory-truth/t10/{VERIFICATION,TEST_MATRIX,INVARIANT_MATRIX,CHANGE_MANIFEST,CONTINUATION}.md

## Historical T09 handoff — superseded as current (freeze remains a verified ancestor)

## Current authoritative handoff — FEFO v2 backfill compatibility, 2026-09-11

Program: Inventory Truth Layer
Task: T09 — final FEFO v2 backfilled synthetic-lot compatibility
Status: FINAL_P1_FIXED_AND_FULLY_VERIFIED; READY_FOR_FINAL_MAIN_MERGE_REVIEW
Canonical Repository: vn-2e/frigo-dev (live origin vb-2f/frigo-dev, same lineage)
Published Branch: hoplite/himera-6d3eda84 (successor at exact docs HEAD 8552fe5337245f2ac8349933c02946bf7d9dcc8f;
hoplite/kydonia-2785bb72 tip unchanged at 8552fe5337245f2ac8349933c02946bf7d9dcc8f)
Starting Docs HEAD: 8552fe5337245f2ac8349933c02946bf7d9dcc8f
Historical GLM Freeze: 9bf9ac0fe7b5e0d39615f39ae5cc30f84569af2f
Historical Astra Replay Fix: 27427383d61930ea1b67ccbc1d69bb1cc069f931
Historical PATCH Parity Freeze: e796f695bdb4228853992cdedc4e3cecf3437adb
Historical Backfill PATCH Freeze: df73bc035c2938b6fd082c57f6bca89a82d8e443
New Final FEFO Application Freeze: bf391c5fdcdd9e9c2f2257db515815e082cb4381
Docs HEAD: docs-only commit containing this receipt; exact fetched SHA in final operator report
Main SHA: d1b06732f8a80db4e77986df31ff28d9f04641fa (unchanged)
Ahead/behind main: start 29/0; application 30/0; following docs checkpoint 31/0
Changes: additive 0029 replaces the two 0027 v2 FEFO equal-ID/strict-prestate-parity
guards with authoritative adoption-mapping checks as separate shallow trigger
statements (D1 expression depth <= 100); FEFO executor drops the fail-closed TS guard
(requireParity admission now governs, exactly as v1), authenticates replay mappings
via authoritativeMapping, and writes the lot CAS with the mapped projection identity.
Migration smoke now replays 0028 (previously missed) and 0029; the local D1 schema
gate requires 0029.
Verification: 13-test permanent backfilled-FEFO matrix (single/multi/mixed incl. kg
display, terminal/partial, replay, changed-intent, stale, lost response, tenancy,
drift, four race pairs plus a multi-lot allocation race); 1,237 focused/15 files;
2,926 full/108; 44 real local-D1; lint/typecheck/build/migration/schema/diff PASS;
clean detached exact-SHA checkout repeats everything with empty status. Native
equal-ID FEFO/PATCH suites unchanged and PASS. NO GITHUB CI STATUS.
Remaining P0/P1: NONE. Relevant merge-blocking P2: NONE known.
Next action: external final main-merge review. Do not merge main, deploy, touch
remote D1/PayOS, redesign guest transfer or start T10 from this packet.
Settings overlay preserved byte-for-byte/uncommitted. Details:
inventory-truth/t09/FINAL_PATCH_VERIFICATION.md.

## Historical backfill compatibility handoff — superseded by bf391c5

Program: Inventory Truth Layer
Task: T09 — targeted legitimate backfilled-lot PATCH compatibility
Status: TARGETED_P1_FIXED_AND_VERIFIED; NOT_READY_FOR_MAIN
Canonical Repository: vn-2e/frigo-dev
Published Branch: hoplite/kydonia-2785bb72
Starting Docs HEAD: f06289b8d440071b213604c360b8839dbbf350cb
Historical GLM Freeze: 9bf9ac0fe7b5e0d39615f39ae5cc30f84569af2f
Historical Astra Replay Fix: 27427383d61930ea1b67ccbc1d69bb1cc069f931
Historical PATCH Parity Freeze: e796f695bdb4228853992cdedc4e3cecf3437adb
Final Backfill Compatibility Application Freeze: df73bc035c2938b6fd082c57f6bca89a82d8e443
Docs HEAD: docs-only commit containing this receipt; exact fetched SHA in final operator report
Main SHA: d1b06732f8a80db4e77986df31ff28d9f04641fa (unchanged)
Changes: exact adoption witness authenticates synthetic mappings; native lot CAS,
event projection ID, replay and virtual snapshot advancement use mapped projection identity.
Verification: 43 new backfill tests; previous 25 native PATCH tests; 619 focused/nine files;
2,910 full/107; 42 real local-D1; static/build/migration/schema PASS. Exact remote
SHA clean checkout: frozen install, 2,910/107, all required gates, 42 D1, empty git status.
Remaining P1: unchanged v2 FEFO SQL requires equal lot/projection IDs; no mutation
is permitted for synthetic FEFO. This shared-path limitation is not fixed by v1 PATCH.
Next action: separately authorize the additive FEFO compatibility/schema follow-up.
Do not merge, deploy, change remote D1/PayOS, implement guest transfer or start T10.
Settings overlay preserved byte-for-byte/uncommitted. Details: inventory-truth/t09/FINAL_PATCH_VERIFICATION.md.

## Historical PATCH parity handoff — superseded by df73bc0

Program: Inventory Truth Layer
Task: T09 — final targeted manual PATCH fix
Status: TARGETED_FIX_VERIFIED; NOT_READY_FOR_MAIN
Canonical Repository: vn-2e/frigo-dev
Published Branch: hoplite/kydonia-2785bb72
Start SHA: 6999b64aff0786827637b0a85f2de28c196ca288
Historical GLM Freeze: 9bf9ac0fe7b5e0d39615f39ae5cc30f84569af2f
Historical Astra First Fix: 27427383d61930ea1b67ccbc1d69bb1cc069f931
Final Application Freeze: e796f695bdb4228853992cdedc4e3cecf3437adb
Docs HEAD: the docs-only commit containing this receipt; resolve the fetched branch tip
Main SHA: d1b06732f8a80db4e77986df31ff28d9f04641fa (unchanged)
Changes: complete presence-sensitive PATCH replay; atomic projection category and
freshness; versioned metadata-only correction; retained CORRECT/MOVE response.
Verification: 515 focused/six files; 2,865 full/106; 40 isolated real local-D1;
lint/typecheck/build/migration smoke/local schema/diff PASS. Clean worktree evidence:
inventory-truth/t09/FINAL_PATCH_VERIFICATION.md.
Remaining P1: pre-existing backfilled-lot mapping refusal on PATCH (500 DRIFT_DETECTED).
Next action: separately authorize that mapping compatibility fix before main review;
do not merge, deploy, start T10 or modify remote D1. External settings overlay unchanged.

## Historical evidence — all prior freeze/readiness claims below are superseded

## T09 F/G/H complete handoff — 2026-09-11

Program: Inventory Truth Layer
Task: T09 — unchanged continuation
Phase: A–H COMPLETE (F = COMPLETE, G = COMPLETE, H = COMPLETE freeze/evidence)
Status: AWAITING_EXTERNAL_REVIEW
Canonical Repository: vn-2e/frigo-dev
T09D Frozen Base Branch/HEAD: hoplite/euhesperides-d77023a5 / 811f7e8463303e010199741d66f88ab8a817212d
Read-only configured base: hoplite/kos-2a686759 at aa44d2a2f80ea33fd4b328aba906660c0129051e
Published Branch: hoplite/kydonia-2785bb72 (platform-verified successor, same lineage)
Application Freeze SHA: 9bf9ac0fe7b5e0d39615f39ae5cc30f84569af2f (local == remote verified)
Docs SHA: recorded in REVIEW_INDEX after the docs-only commit that follows
Main anchor: d1b06732f8a80db4e77986df31ff28d9f04641fa (branch 22 ahead / 0 behind)
Fresh Checks at the application freeze: 2,837 tests / 105 files PASS; 38 isolated
real local-D1 tests PASS; lint/typecheck/build PASS; 28-migration smoke PASS;
local D1 schema gate PASS (0028 required); clean-checkout gate recorded in
inventory-truth/t09/VERIFICATION.md.
What changed since the last handoff: atomic receipt-backed adoption with
empty-household evidence (0028); every inventory writer either serves adopted
households through the lot authority or fails closed; G concurrency/tenancy matrix;
final writer map without UNKNOWN. DEC-012 remains SAFE-DEFERRED.
Independent-review follow-up `27427383d61930ea1b67ccbc1d69bb1cc069f931` restores
committed adopted PATCH response-loss replay ahead of legacy version preflight,
rejects altered idempotency-key reuse, and keeps distinct-key CAS strict. Fresh full
verification: 2,838 tests / 105 files PASS (165.25s); lint/typecheck/build and
28-migration smoke PASS.
Next action: external independent review decides readiness. Do not merge to main,
deploy, mutate remote D1, touch PayOS, or start T10 from this handoff.

## Historical continuation handoff (superseded) — 2026-09-11

Program: Inventory Truth Layer
Task: T09 — unchanged continuation
Phase: A–E complete; F in progress; G–H pending
Status: IN_PROGRESS
Canonical Repository: vn-2d/frigo-dev
T09D Frozen Base Branch: hoplite/euhesperides-d77023a5
T09D Frozen Base HEAD: 811f7e8463303e010199741d66f88ab8a817212d
Canonical Writable Continuation: hoplite/kos-2a686759
Verified Successor Base / Interrupted F SHA: 66858c5296b38715e4bfca77fca5eefe5adadf5a
Last Verified Published Prior Continuation SHA: 66858c5296b38715e4bfca77fca5eefe5adadf5a
Last Verified Application SHA: aa43e069edbff7843e9eb7532ff386b27be96a17
T09E Application SHA: 9bd1e6bc000cd2e94121469babb1a5eb63a5047f
Application Freeze: NOT FROZEN

Current Published Application SHA: aa43e069edbff7843e9eb7532ff386b27be96a17
Current Published Branch: hoplite/kos-2a686759
Current Scope: pure adoption preparation; mapped-authority legacy writer fences;
scan/shopping stock-revision fences; original scan retry identity; shopping
fingerprint/lease/committed-response recovery. DEC-012 unchanged.
Fresh Checks: 1,347 tests / 19 focused files; 2,808 / 103 full; 38 actual local-D1
tests; lint; typecheck; build; 27-migration replay; diff and protected paths PASS.
Scoped Review: two P2 findings corrected and independently re-reviewed; no remaining
P1/P2 within this partial increment, not a final T09 independent-review verdict.
Remaining: atomic adoption executor/activation marker and v3 evidence; functional
mapped-household adapters; original scan confirmation intent/result replay; full
G races/tenancy; H freeze/complete review. No new schema or active adoption yet.
Exact Next Action: implement additive, narrowly dispatched v3 ADOPT authority and
persist the pure plan in one fenced transaction, including empty-household marker;
extend writer admission before activation, then implement all functional adapters.
See F_ADOPTION_PLAN.md and VERIFICATION.md for exact constraints/failures.

## Recovery baseline and pre-transfer chronology

Transfer recovery: all canonical branches/tag fetched; required objects, full
consecutive ancestry and fsck PASS. Main unchanged at d1b0673; interrupted F was
18 ahead / 0 behind. Prior continuation is the read-only configured base;
unchanged-head publication rejected without mutation. One existing successor
starts exactly at 66858c5. Fresh baseline: 2,685 tests / 99 files and typecheck,
lint, 27-migration smoke, build PASS. Pre-existing settings overlay preserved in
stash `t09-transfer-preexisting-hoplite-settings-overlay`. Exact Next Action:
publish recovery docs, then explicit adoption/all-writer integration per
F_ADOPTION_PLAN.md; continue G/H only after real F acceptance. Previous repository
owners and the pre-transfer receipts below are historical provenance only.

Reason: Hoplite base branches are read-only; user authorized writable successor.
Ancestry and successor publication-first PASS at 8bf32ed4e41ed3341215c6376e0c13ef13043616.
E adds deterministic bounded FEFO USE, one atomic 1–32-effect batch, v2 receipt/event
authority and additive 0027; v1 predicates and 0023–0026 are unchanged. Existing
settings overlay remains outside this task. No adoption, live writer, HTTP or UI change.
Latest checks after the ordered-receipt fence: 1,172 focused / 11 files (35 actual
local D1 tests), full 2,659 / 98 files and lint/typecheck/build/migration smoke PASS.
Earlier post-replay-fix 1,170 focused / 2,657 full results predate that fence.
Isolated local D1 applied 27 migrations and schema gate returned success.
Failures fixed: D1 expression depth, SQL NULL fail-open, replay envelope/mode
misclassification; ordered-receipt follow-up and gate chronology are recorded in
`inventory-truth/t09/VERIFICATION.md`. Scoped E review has no remaining P1/P2
findings. E publication/fetch/equality/ancestry PASS. Exact Next Action: F explicit
adoption/all-writer integration per `inventory-truth/t09/F_ADOPTION_PLAN.md`;
DEC-012 guest-transfer safety is implemented with 143 focused auth/guest/outbox
tests PASS, full 2,685 / 99 and all static/build/local migration gates PASS.
No automatic guest-data fallback occurs. Adoption and other live
writers remain incomplete. Never push the frozen D base.
No main/legacy/production/staging/remote D1/PayOS/T10 changes.

## Historical T09D handoff — 2026-09-10

Program: Inventory Truth Layer
Task: T09 — Inventory Lot Engine & Event Authority
Phase: T09D complete and published; E–H pending
Status: IN_PROGRESS
Canonical Repository: vn-2b/frigo-dev (user-confirmed correction)
Canonical Branch: hoplite/euhesperides-d77023a5
T08 Base SHA: 8f8788c1a0c9e486657751ef3875a5baa5334dec
Last Verified Remote SHA: b036b257a8ad775dd6f1a445dcfdcce38a6babf1
T09D Code Checkpoint: b036b257a8ad775dd6f1a445dcfdcce38a6babf1
Development Main Anchor: d1b06732f8a80db4e77986df31ff28d9f04641fa
Application Freeze: NOT FROZEN

Completed: identity/baseline/publication-first; T09A audit/lifecycle; B contracts;
C internal native executor, additive 0024, membership/revision/CAS, receipt/event/
projection atomicity and actual local D1 proof. No HTTP or legacy-writer cutover;
unadopted/mixed households fail ADOPTION_REQUIRED rather than silently diverge.
Checks: native/combined/full regression gates, static/build, 24-migration replay,
populated upgrade and local D1 proof run; exact current counts in
inventory-truth/t09/VERIFICATION.md. Final C: 507 focused / 1,994 full (93 files),
lint/typecheck/build, 24-migration/local schema PASS. Remote-source 507 PASS.
Failure: managed setup claim blocked; workaround succeeded, platform issue filed.
D now rejects corrupt retained receipts, invalid command event binding and paired
receipt/event evidence inconsistent with written stock. Additive 0025/0026 retain
all earlier migrations and historical events. D final checks: 1,031 focused,
2,518 full / 95 files, lint/typecheck/build, 26-migration replay and local schema
PASS. Review findings and exact commands: inventory-truth/t09/VERIFICATION.md.
Full T09 E–H completion gates pending. Historical counts below are not
T09 evidence. Preserved unrelated settings overlay in named local stash; details
in inventory-truth/t09/SESSION_LOG.md. No tracked setup configuration changes.
Publication: D b036b25 committed/published/fetched; local/remote equality PASS.
Separate fetched-source worktree: 1,031 tests and typecheck PASS, clean source.
Exact Next Action: T09E deterministic FEFO, then F explicit adoption/all-writer
integration before exposing HTTP. No remaining D check failure. This documentation
receipt follows the verified code SHA; resolve latest docs HEAD via Git.
Read inventory-truth/t09/REVIEW_INDEX.md. T09 is not independent-review-ready.
Legacy Frigo/main/production/staging/remote D1/PayOS untouched; T10 not started.

## Historical handoff (not current task authority)

## Current branch handoff — published T08 completion (2026-09-10)

Repository vn-2c/Frigo. User explicitly approved the Hoplite publication branch
instead of the original canonical name; DEC-006 supersedes only that restriction.

Program: Inventory Truth Layer
Task: T08
Phase: T08F Verification/Handoff
Status: COMPLETE — verified, committed and published; not deployed
Canonical Branch: hoplite/xanthos-7d942897 (user-approved cross-account handoff)
Base Main / last fetched origin/main: d1b06732f8a80db4e77986df31ff28d9f04641fa
Last Code SHA: dd2ecc6f7066250dfdc5214a3d6c356e1479b61e
Last Verified / Confirmed Published SHA: fb00f46d4633c9659e812be9f86119533973a8bd
Final HEAD: subsequent docs-only checkpoint; read `git rev-parse HEAD`

Completed: audit; strict storage/lot contracts; additive 0023; exact milli-unit
adapter; explicit guarded/idempotent backfill; compatibility projection/parity.
Fresh final-session verification: 130 focused tests; 1,617 full tests / 89 files;
lint, typecheck, build, 23-migration replay/local schema and diff checks PASS.
Prior sandbox-local D1 apply also passed 23/23. No remaining failure; publication
succeeded through the trusted broker and its exact head was fetched/confirmed.

Remaining T08 work: none. Exact next action: next account checks out
`origin/hoplite/xanthos-7d942897`, reads `inventory-truth/T08_VERIFICATION.md` and
the six handoff files, then waits for explicit T09 authorization.
Do not force-push, merge/rebase main, deploy or touch remote D1/PayOS.
Quantity that cannot fit exact milli-units fails preflight unchanged. Legacy data
is not live-synced; unknown/estimated evidence stays distinct and guest transfer
drift is diagnostic, not an auth rewrite. T09 owns commands/event authority/dual-write.

Cross-account takeover: first read the six `inventory-truth/` documents in order;
diff Last Verified SHA..HEAD. Exact executed commands, corrected failures, source
map and future integration risks are persisted there, not dependent on this chat.
Branch pushed: YES. Main/production/staging/remote D1/PayOS untouched: YES.

## Preserved release handoff (historical, separate production track)

## Active production integration handoff (2026-09-15)

WORKING_BRANCH: `integration/t13-takosan-qwen`

PRODUCTION_BASE: `05423f2ad675006a4c7913e696f1979b3fcaae59`

COMMON_BASE: `d1b06732f8a80db4e77986df31ff28d9f04641fa`

The current authorized task is a local/published integration candidate combining
production, the Qwen runtime branch, certified T13, and hardened Takosan. Source
IDs and SHAs are verified, production migration `0023_scan_request_fingerprint.sql`
is immutable, and the T13 migration bridge is planned at `0024`-`0033`.
`docs/integration/` is the current task packet. No candidate is designated yet.

Next action: checkpoint the analysis, integrate Qwen, merge T13/Takosan with
semantic conflict resolution, then run migration/static/full/browser gates.
Production main, remote D1, deployment, production R2/KV/queue, PayOS, and T14
remain untouched.

## Authoritative release

AUTHORITATIVE REPOSITORY: `vn-2c/Frigo`

CANONICAL GITHUB REPOSITORY (redirect observed 2026-09-12): `Tungjpstore/Frigo`

The configured `github-frigo` remote retains the `vn-2c/Frigo` alias.

AUTHORITATIVE BRANCH: `main`

PRODUCTION_APPLICATION_BASE_SHA:
`23ef51d6ec12a5a3e319a2d941dca39d2775cb9d`

DEPLOYED_APPLICATION_SHA:
`d1b06732f8a80db4e77986df31ff28d9f04641fa`

MAIN_RELEASE_LINEAGE:
`d1b06732f8a80db4e77986df31ff28d9f04641fa` plus documentation-only receipt
merges; resolve the current `main` head from GitHub for a future release.

APPLICATION_RELEASE_MERGE_SHA:
`23ef51d6ec12a5a3e319a2d941dca39d2775cb9d`

PRE_CLEANUP_MAIN_HEAD:
`41d2de6bc76331322cc63e8038432b0b02f60da1`

VERIFIED APPLICATION SHA: `0b20061e7dc7405df68b18a18da4166e09494ecd`

VERIFIED RELEASE HEAD: `0420807968538f61b669569d064c404f67032174`

MAIN CI: `34396319671 SUCCESS`

PREVIOUS FINAL-HEAD CI: `34405307196 SUCCESS`

PREVIOUS RELEASE DEPLOY WORKFLOW: `34396457582 SUCCESS`

PREVIOUS DOCS-CLEANUP DEPLOY WORKFLOW: `34405457796 SUCCESS`

PRODUCTION: **DEPLOYED AND VERIFIED**

DEPLOYED_MAIN_SHA:
`d1b06732f8a80db4e77986df31ff28d9f04641fa`

PRODUCTION_WORKER_VERSION:
`df7225c9-6f20-4206-9f16-573de6a69c43` (100% traffic)

OCR_RECOVERY_BRANCH: `codex/ocr-production-recovery`

OCR_RECOVERY_BASE_SHA:
`d8ca112a5ac5eb215f36a3f89b4218e2fc691371`

OCR_RECOVERY_STATUS: **DEPLOYED AND VERIFIED**

OCR_RECOVERY_CHECKPOINT: 2026-09-13; implementation `ec87aec` merged as
`bdb0dda0b1123c4fd940058091e3cb285d5e8eb8`. Worker version
`df7225c9-6f20-4206-9f16-573de6a69c43` serves 100% traffic and production D1 is
at migration `0023`.

## Current status

T01-T07: COMPLETE

Release Integration: **COMPLETE**

Main Integration: **COMPLETE**

GitHub source of truth: main.

APPLICATION INTEGRATION: complete in main at `23ef51d6ec12a5a3e319a2d941dca39d2775cb9d`.

The main merge tree is source-equivalent to the verified release head. Changes
after the production application base on GitHub remain documentation-only; the
separate OCR recovery branch contains candidate code/config/test changes that
are not part of `main` or production.

## Production cutover receipt

**Status: COMPLETE - SCHEMA AND WORKER CUTOVER VERIFIED (2026-09-10).**
Migrations `0019` -> `0022` were applied in order after the retained D1 export,
then the Worker was deployed from a clean checkout of the approved `main` SHA.

### Live runtime

- Target: `https://frigo.tungjpstore.net` (Cloudflare Worker; no Frigo
  production process is running in this local checkout).
- Liveness and landing smoke returned HTTP 200.
- Readiness returned HTTP 200 with `status=degraded`, `environment=production`,
  and full `commit=d1b06732f8a80db4e77986df31ff28d9f04641fa`.
- Readiness services are database/queue/AI/email `ok` or `configured`, rate
  limiting is `kv-best-effort`, and the only issue is the non-blocking warning
  `CONFIG_PLUS_GRANT_SECRET_MISSING`; `config.ok=true` and no fatal issue were
  observed.
- Active Cloudflare version is `48e0c366-3c8a-4f2b-a2d5-965785995431` at 100%
  traffic (deployment started 2026-09-10T21:08:00Z).

### Source and schema comparison

- The deployed Worker reports the approved main SHA; no source-only divergence
  remains on the public runtime.
- Remote D1 ledger is exactly `0001` through `0022`; the exact schema gate passes,
  foreign-key violations are `0`, and 65 user tables are present.
- `pnpm week:reconcile:remote -- --strict --json` passes 2/2 plans, 0 orphan
  rows and 0 mismatches (14 Week days, 16 slots and 30 shopping rows observed).

### Backup and rehearsal

- Export: `.artifacts/frigo-db-pre-main-d1b0673-20260910T205627Z.sql`,
  mode 600, 521095 bytes, SHA-256
  `000c9cb88d6045afb19cca6ce3e1caa308b20ffa214dbb2cddfca0cb78d722eb`.
- Temporary-copy replay of `0019` -> `0022` passed foreign-key/integrity checks
  and all `0020` preflight guards before the remote apply.
- Key post-cutover counts remain users 28, households 28, inventory items 13,
  recipes 59, meal plans 2, scan queue jobs 15, sessions 2 and auth OTPs 0.
- Migrations are additive and order-dependent. There are no down-migrations;
  retain the additive schema and use only a schema-compatible code rollback.

### Operational finding and gate

- CORS probes now return the exact ACAO for the trusted origin and no ACAO for
  path-bearing, localhost or arbitrary origins.
- No planner flag, PayOS/payment path or production secret value was changed.

## Verification receipt

- Full: 1,487 tests / 87 files PASS.
- Focused T02-T07: 819 tests / 40 files PASS.
- D1 clean: 22 / 22 migrations PASS.
- Upgrade sanity: 0020 -> 0022 PASS.
- Existing rows preserved: 776 rows / 58 tables.
- Browser: 264 assertions / 36 phases PASS.
- Payment-adjacent: 82 tests / 7 files PASS.
- Final release CI: PASS.
- Post-cutover local gates: `pnpm lint`, `pnpm typecheck`,
  `pnpm check:migrations` and `pnpm build` PASS.
- Local `pnpm test`: 1,427/1,487 PASS; 60 failures are limited to the two shell
  UI suites because `localStorage`/`container` are unavailable in this runner.
- Hosted exact-SHA CI `34413458369`: 1,487 tests / 87 files PASS.
- Dependency audit: `pnpm audit --prod` reports 2 moderate `react-router`
  advisories (current v6 line; upstream fix requires v7.18.0). Treat the
  dependency upgrade as a separately tested follow-up; no emergency package
  change was made during this production cutover.
- `git diff --check`: PASS for the OCR candidate. `pnpm check` on 2026-09-13
  passed 1,579 tests / 93 files plus lint, typecheck, migration replay through
  `0023` and build. Hosted PR #17 CI run `34728606704` passed the same checks;
  live-provider smoke and production canary remain pending.

The local UI limitation is environmental; the hosted exact-SHA CI remains the
authoritative full-suite gate.

## OCR production-recovery candidate

The candidate is a code/config recovery with additive migration
`0023_scan_request_fingerprint.sql`; it does not amend the historical cutover
receipt or authorize a deployment.

- Qwen `qwen3.7-flash` is explicitly set as the primary provider for vision,
  receipt OCR, chat and ranking through the DashScope international endpoint
  (`QWEN_BASE_URL`, `QWEN_MODEL`); structured requests disable thinking. Groq is
  an opt-in legacy fallback through `GROQ_FALLBACK_ENABLED=true`, and is
  disabled in the candidate vars.
- Native Cloudflare vision is opt-in through `CLOUDFLARE_VISION_FALLBACK` and is
  `false` in the candidate worktree vars. DeepSeek remains the optional
  text/ranking fallback when `DEEPSEEK_FALLBACK_ENABLED=true`, and Z.ai/GLM the
  optional vision/text extension path when `GLM_FALLBACK_ENABLED=true`; GLM-5.3
  Flash is future model work, not an active claim.
- Zod plus a deterministic quality gate removes generic/placeholder labels and
  confidence below `0.6`; an empty usable result is the permanent
  `AI_SCAN_NO_USABLE_ITEMS` failure. OCR output remains reviewable draft data,
  not trusted inventory, price or safety authority.
- Typed provider failures distinguish permanent `MODEL_NOT_FOUND`, auth/permission,
  license, schema/invalid-response and quality errors from retryable
  `REQUEST_TIMEOUT`, `NETWORK_ERROR`, `RATE_LIMITED` and `UPSTREAM_ERROR` errors.
  Queue lease, idempotency, tenant fencing, attempt limits and DLQ semantics are
  unchanged.
- Scan status responses expose bounded failure codes and retry metadata without
  provider credentials or raw image content.
- The candidate adds additive migration `0023_scan_request_fingerprint.sql`.
  Local replay/schema checks cover `0001`-`0023`; production D1 now includes
  `0023` after the retained pre-0023 export. Worker deployment is verified.

Focused local checks and the full candidate gates passed on 2026-09-13:
`pnpm check` reports 1,579 tests / 93 files PASS, lint/typecheck/migration replay
through `0023` and build PASS; hosted PR #17 CI run `34728606704` is also green.
Live provider access is verified: a non-PII Qwen smoke returned HTTP 200 with
model `qwen3.7-flash` and `OK`; the key value is not stored in the repository or
logs. No separate staged canary was used; the guarded deploy went to 100% after
backup, migration and schema gate.

## Deployment and production boundary

Release packaging completed. Staging was not provisioned, so no staging deploy
occurred. The GitHub production environment/secrets are not provisioned, so the
approved release was deployed directly with Wrangler OAuth from a clean SHA
checkout; the same schema, smoke and readiness receipts were captured locally.

Production now reports candidate commit `bdb0dda0…`; readiness and liveness smoke
passed after deployment. Wrangler OAuth is authenticated as `tungbipdz@gmail.com`
for account `ef250a88911fd24073cb73d1c07e0218`.

PRODUCTION LOCAL RECONCILIATION COMPLETE - SCHEMA/CODE CUTOVER VERIFIED

Production local reconciliation: COMPLETE - post-cutover checks passed

PRODUCTION DATABASE MIGRATION COMPLETE - `frigo-db` at `0022`

Production DB migration: COMPLETE - exact ledger `0001` through `0022`

PRODUCTION DEPLOYMENT COMPLETE - Worker version `48e0c366-3c8a-4f2b-a2d5-965785995431`

Production deployment: COMPLETE - readiness commit matches `d1b06732...`

Planner rollout: NOT STARTED. `PLUS_GRANT_SECRET` remains intentionally absent
and is reported as a warning; no secret values were read or changed.

## OCR image optimization candidate (2026-09-13)

`src/web/lib/private-image.ts` contains an uncommitted client-side optimization:
gallery images are decoded in memory, constrained to a 2,000 px longest side and
encoded as JPEG quality 0.82 only when smaller than the source. Small images are
not upscaled; originals are never mutated or stored; cancellation/session fencing
and a FileReader fallback are preserved. The attached receipt measured 2,116,353
bytes as PNG versus 382,334 bytes after a local quality-0.82 conversion (81.9%
reduction, same dimensions). Focused privacy/image tests pass 11/11. The
implementation is committed locally at `ba3d872eea2d677e38f94adb8355f493c4c45852`
but is not deployed; browser/device OCR recall and latency smoke is still
required before release.

## PR #8 authoritative metadata

PR #8 METADATA:

- State: `MERGED`
- Draft: `false`
- Merged at: `2026-09-09T19:38:59Z`
- Closed at: `2026-09-09T19:38:59Z`
- Merge commit: `23ef51d6ec12a5a3e319a2d941dca39d2775cb9d`
- Base: `main`
- Head: `hoplite/kirrha-5f4057f0`
- Head SHA: `0420807968538f61b669569d064c404f67032174`

PR #8 was not reopened, re-merged or modified during this task. Its verified
release tree is already contained in main. Application integration and PR
metadata are separate facts.

## Kirrha archival state

Kirrha is two commits ahead of current main and differs only in the four
`docs/ai/` release protocol documents. It has no application differences absent
from main. Do not merge or revert this historical branch.

## Protected areas

PayOS/payment code untouched.

No real payment performed.

## Next task

Next task: MONITOR OCR QUALITY/LATENCY AND SCHEDULE REACT ROUTER UPGRADE

Keep the deployed Worker and planner flags at safe defaults while the OCR
candidate is validated. Run focused provider/queue/UI tests and all required
local gates, then obtain authorized live-provider smoke, hosted CI, readiness and
canary evidence before any production deploy. Apply and verify additive migration
`0023_scan_request_fingerprint.sql` first; no production secret change is implied.
Do not touch PayOS/payment or use a down-migration. Rollback remains code-only to a schema-compatible SHA;
reserve D1 restore/export for an incident. Configure the GitHub `production`
environment, `PRODUCTION_URL` and Cloudflare secrets before the next guarded
release, and schedule the tested React Router major upgrade separately.

## Qwen runtime governance candidate (current task)

WORKING_BRANCH: `feat/qwen-ai-runtime-cost-router`

BASE_SHA: `05423f2ad675006a4c7913e696f1979b3fcaae59`

CANONICAL_MAIN_CHANGED: **NO**

PRODUCTION_DEPLOYED: **NO CHANGE / NOT AUTHORIZED**

The branch adds a fetch-compatible `QwenTaskRuntime` behind `AIRouter`. Tasks
resolve to logical roles (`QWEN_FAST`, `QWEN_FAST_CANARY`, `QWEN_MULTIMODAL`,
`QWEN_OCR`, `QWEN_REASONING`, `QWEN_JUDGE`) in one governance table. Physical
model IDs are supplied only by `AI_MODEL_*` configuration. Normal text uses the
pinned `qwen3.7-flash-2026-07-15`; OCR uses `qwen-vl-ocr`; multimodal work uses
`qwen3.8-flash`; reasoning and judge are disabled unless explicitly enabled.

The runtime enforces per-task input/output budgets, a per-operation call/token
ceiling, one repair plus one policy-approved escalation, Zod structured-output
validation, scan quality gates and cost metadata. `AIUsageLedger` aggregates
task/model calls, tokens, costs, failures, retries, escalation and latency;
Worker logs include only non-PII metadata. `AI_QWEN_ONLY=true` prevents legacy
Groq, DeepSeek, GLM and native Cloudflare providers from being constructed.

Inventory safety is unchanged: AI returns observation/candidate data only. The
existing normalization, validation, review, reconciliation, fencing and
idempotent inventory command remain the sole authority for mutations.

Final T08-T12 Inventory Truth end-to-end certification is still pending the
later unification with the separate `frigo-dev` lineage. This candidate does
not import that code or migrations; it only proves that Qwen runtime/provider
modules have no direct authoritative inventory mutation path.

Offline evaluation assets are `tests/fixtures/ai-golden.json`,
`tests/unit/ai-golden-dataset.test.ts` and `scripts/ai-eval.mjs`; run
`pnpm ai:eval -- --dry-run`. The command makes no live provider call and no CI
test requires an Alibaba credential.

Verification recorded for this checkpoint:

- Application checkpoint: `21c442d`.
- `pnpm check`: PASS — 1,606 tests / 95 files; lint, typecheck, migration replay
  and production build all PASS. Remote D1 schema and Week parity checks were
  skipped because no release flags were supplied.
- `pnpm ai:eval -- --dry-run`: PASS; fixture-only report, no Alibaba/Qwen call.
- `git diff --check`: PASS after the documentation edits.
- Focused command (`pnpm vitest run tests/unit/ai-runtime-governance.test.ts
  tests/unit/ai-router.test.ts tests/unit/qwen-provider.test.ts
  tests/unit/config-validation.test.ts tests/unit/meal-planning-explanation.test.ts
  tests/unit/scan-privacy.test.tsx tests/integration/scan-queue-retry-policy.test.ts
  tests/integration/scan-async-canary.test.ts`): **119 tests / 8 files PASS**;
  queue/idempotency regression coverage remains green.
- `pnpm audit --prod`: FAIL (2 moderate `react-router` advisories; patched
  upstream at `>=7.18.0`). This pre-existing dependency follow-up is outside
  the Qwen runtime scope; no package upgrade was made in this checkpoint.
- Secret scan, protected-path scan and provider/model search were clean. No
  PayOS/payment, unrelated auth, remote migration, merge or deployment action
  was performed.
- Local `main` is a separate divergent ref (`f6a48a1`); canonical source for
  this candidate is `github-frigo/main` at `05423f2`, and no local ref was
  changed.
- Final review found no concrete runtime defect requiring a code fix. Readiness
  already probes the additive scan columns from migration `0023`, and the
  deployment documentation correctly scopes the native `AI` binding to the
  explicit `CLOUDFLARE_VISION_FALLBACK=true` path.
- Publication checkpoint: `feat/qwen-ai-runtime-cost-router` is now published
  on `github-frigo` by a normal non-force push; `git ls-remote` verified the
  remote branch SHA matches the local candidate and canonical `main` remains
  `05423f2`. GitHub emitted only the repository-relocation notice to
  `Tungjpstore/Frigo`; no merge, deployment, remote migration or production
  change has occurred.

Next action after publication: request code review or a separately authorized
Qwen benchmark, then promote a pinned alias only through the documented
golden-dataset process. Do not merge, migrate remotely or deploy from this
branch.

## Qwen pre-unification hardening checkpoint (2026-09-13)

Implementation is complete on `feat/qwen-ai-runtime-cost-router` and remains
ahead of canonical `github-frigo/main` at `05423f2` without changing `main` or
production. The final changes are:

The verified application publication commit is
`f8468eaa7d7fed3cbcf5ac7e780eca07ad3d71e4`; the docs checkpoint containing
this handoff is intentionally a subsequent normal commit.
The final pre-documentation branch head, including the scheduler-failure
regression test, is `a145ef5`.

- `qwen-vl-ocr` capability metadata disables unsupported provider structured
  output and thinking controls while preserving prompt JSON, application parsing,
  normalization, Zod validation and scan quality gates. The rolling alias is
  explicitly `pinned=false`; no unverified snapshot was invented.
- Pricing defaults now reflect Singapore low-context planning values and carry
  `estimate-2026-09-sg-low-context` (judge remains a documented planning
  estimate). Usage remains estimated, not Alibaba invoice truth.
- `AI_MAX_IMAGE_BYTES` and `AI_MAX_OCR_IMAGE_BYTES` default to 5 MiB and are
  bounded to 64 KiB-20 MiB. Raw/data-URL base64 is checked by decoded-byte
  estimate before any Qwen provider call; remote URLs remain upstream-limited.
- Shadow canary is lifecycle-safe: `backgroundExecutor` schedules the reserved
  promise through Worker `executionCtx.waitUntil`; hosts without an executor
  skip shadow. The default canary percentage remains zero, and scheduler
  invocation failures are isolated from successful primary responses.

Verification completed 2026-09-13:

- Focused command: **134 tests / 8 files PASS**.
- `pnpm check`: **1,623 tests / 95 files PASS**; lint, typecheck, migration
  replay and production build PASS.
- `pnpm ai:eval -- --dry-run`: PASS, six fixture cases, no live request.
- `git diff --check`: PASS.
- `pnpm audit --prod`: FAIL with two known moderate React Router advisories;
  patched upstream at `>=7.18.0`, upgrade intentionally deferred.

No live Qwen benchmark, production deploy, remote migration, secret change,
merge, PayOS/payment modification or T08-T12 Inventory Truth import occurred.
Queue/HTTP compatibility and inventory mutation boundaries remain intact. The
next action is to verify the final normal push SHA with `git ls-remote`, obtain
code review, and only then consider a separately authorized benchmark/release.
Do NOT git pull/reset directly inside running production. Production-local source
must first be snapshotted and compared against the final post-merge GitHub main
head, with
application lineage anchored at `PRODUCTION_APPLICATION_BASE_SHA`. Do not deploy,
run remote migrations, enable planner flags or alter production configuration as
part of this bookkeeping task. Do not treat `PRE_CLEANUP_MAIN_HEAD` as the final
head.

## SAFE STOP — T13R-B — 2026-09-13T21:35Z

T13R-B truth-presentation remediation checkpointed at WIP `7e68e3b` on
`hoplite/medma-164548ce` (P2-1 already committed as `4d587eb`). Full
status, test evidence, and next step: `docs/ai/inventory-truth/t13/T13R_B_REMEDIATION.md`.
Findings P2-1/P2-4/P2-5/P2-6 = FIXED (test-backed, NOT certified). No
freeze created. Main unchanged. See T13R_B_REMEDIATION.md before continuing.
## Canonical promotion CLI handoff (2026-09-15)

**HISTORICAL CHECKPOINT — SUPERSEDED BY THE MERGED PR #2 RECEIPT ABOVE.**

The canonical promotion remains intentionally unmerged. GitHub CLI verified
`vn-dlo/Frigo-dev`, PR #1, base `main`, and promotion head
`ae1689c1f5525262da3478137b402692e4e4ed45`. The head differs from the prior
receipt only by an empty commit used to request a fresh PR event; application,
migration, and documentation trees are unchanged by that commit.

The exact hosted CI gate is unresolved: `gh run list` and PR checks are empty,
and `gh workflow run` returns HTTP 422 `Actions has been disabled for this
user`. The CLI account is `Tungjpstore` with push but not admin/maintain access;
branch protection is not configured/visible. Do not merge or deploy. An admin
must enable Actions and confirm main protection, then rerun checks against the
exact head and explicitly authorize a history-preserving merge.

Follow-up: `gh` is now authenticated as repository owner `vn-dlo` with admin/
maintain access. Main protection is configured to require one PR approval and
the `validate` status, with force-push and deletion disabled. The promotion
head is `6ec7ff08ef258ef2ca95fb5d24b581b939ef1c92`; this is another empty
tree-neutral trigger commit. Actions is enabled, but no exact-head workflow run
has appeared. Do not merge until the `validate` check is actually present and
passing, then obtain explicit maintainer authorization.

Owner-visible PR #2 (`canonical/5f6853d-promotion-ci`) now has exact hosted CI
run `34968012294` passing on `8eb6d2b8d54e5e2fd08c0a11acd9f57a1e068b24`.
Hosted validate completed lint, typecheck, full Vitest, migration smoke, and
build successfully. Main protection correctly leaves the PR blocked pending
one independent approval; no merge or deployment has occurred.
