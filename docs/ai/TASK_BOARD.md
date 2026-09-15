# Frigo / Takosan current task board — 2026-09-15

## T14B-A — Recipe catalog safety foundation — IMPLEMENTED (pending review)

- [done] F-08 neutralized: generator test deleted; read-only seed validation +
  explicit `recipe:seed:check` / `recipe:seed:render` (never writes `migrations/`).
- [done] `RuntimeRecipe` contract + lossless proof for 71 recipes; `RUNTIME_ONLY_FIELDS`.
- [done] `classifyCatalogEntry` completeness semantics; FK stub excluded, never repaired.
- [done] `auditCatalogDrift` + `readRecipeContent` (4 read-only SELECTs); deterministic JSON.
- [done] ADR-022; `docs/ai/recipe-catalog/T14B_A_CATALOG_SAFETY_FOUNDATION.md`.
- [invariant] `ALL_RECIPES` authority unchanged; migrations 0001–0033 byte-identical; no 0034.
- [next] Review/merge PR #7 then T14B-A PR; close/archive PR #4; start T14B-B (0034 + 71/71 parity).

## T14A — Production recipe truth audit — COMPLETE (docs-only)

- [done] First gate `PRODUCTION_MAIN_APPLICATION_EQUIVALENCE = PASS`
  (`e6b9195` → `345cecf` differs only in 7 docs paths).
- [done] Lineage, migration (`0001`–`0033`, next `0034`), recipe authority,
  domain-model drift, catalog abstraction, scale, media/CSP, planner, cooking
  boundary, AI boundary, offline, tests, data quality recorded in
  `docs/ai/recipe-catalog/T14A_PRODUCTION_RECIPE_TRUTH_AUDIT.md`.
- [done] Local gates: frozen install, typecheck, lint, `check:migrations`,
  build, full Vitest `3630/3630` (149 files), focused recipe suite `255/255`.
- [finding P1] Vietnamese recipe images blocked by production CSP `img-src`.
- [finding P1] Static `ALL_RECIPES` is the sole runtime recipe authority; D1
  is a partial seed shadow (12 global recipes absent, nutrition/steps/media
  outside the catalog contract).
- [blocked-for-T14B] PR #4 disposition; generator test
  `tests/unit/generate-migration.test.ts` rewrites `0006` during `pnpm test`.
- [next] T14B design per Strategy A (static authority, D1 shadow) — not started.

## Production rollout receipt — COMPLETE

- [done] Production D1 migration applied and verified at `0001`-`0033`.
- [done] Pre-migration SQL export recorded (SHA-256
  `378c023b15c159d140162e6eb74bbf2ad584e7b699c72384379119defe6dec6a`).
- [done] Compatibility Worker `64ee9ed1` deployed before schema cutover.
- [done] Canonical Worker `e6b91956484589c088e6d04a9835b3e59a2eb786` deployed
  and readiness verified on the production custom domain.
- [done] Remote schema gate, build, lint, typecheck and full Vitest `3630/3630`
  passed; smoke covered health, readiness, recipes, PWA manifest and auth
  boundaries.
- [blocked] PR #4 must receive hosted CI/review and be merged so the deployed
  compatibility bridge is reachable from canonical `main`.

## Canonical consolidation finalization

- [done] Application integration frozen at
  `5f6853d0ed11415871dca0fd31d4981d60518310`.
- [done] Independent remediation completed; `e34ed167` is historical and
  superseded.
- [done] Canonical promotion branch published as
  `canonical/5f6853d-promotion-ci`.
- [done] Main protection enabled: strict `validate`, no force-push or branch
  deletion, admin enforcement; approval count zero under the recorded waiver.
- [done] PR #2 opened against `main`.
- [done] Hosted CI run `34968469709` passed on pre-docs head `c8acd0aa`.
- [done] Final reviewed head `7ede92c...` passed exact PR CI run `34972891435`.
- [done] History-preserving merge commit `a5cfb14cfd5840be23eb16b26a3689f5e2d6e805` created by PR #2.
- [done] Merge tree matches reviewed head; required source lineage is preserved.
- [done] Post-merge main CI run `34973522150` passed.
- [done] Automatic Deploy workflow made no deployment: staging unconfigured,
  production skipped.
- [in progress] Publish this docs-only post-merge receipt through a separate PR.
- [done] Maintainer accepted external technical review for final head `7ede92c...`
  with P0/P1/P2 = 0; native collaborator approval may be waived only for this
  consolidation.
- [done] Production rollout completed through D1 `0033` and canonical Worker
  `e6b9195`; PR #4 compatibility bridge remains a follow-up.
- [not started] T14.

# Historical production integration remediation — 2026-09-15

## Historical canonical-promotion task — superseded as current authority

- Canonical repository plan: `docs/integration/CANONICAL_REPOSITORY_CONSOLIDATION_PLAN.md`.
- Production rollout plan (separate): `docs/integration/SAFE_PRODUCTION_MERGER_PLAN.md`.
- Promotion branch: `canonical/5f6853d-promotion` at `f48e830`.
- Archive pointer: `archive/pre-canonical-consolidation` at `d1b06732`.
- PR: `vn-dlo/Frigo-dev#1`, base `main`, head `canonical/5f6853d-promotion`.
- Production frontend/platform branches are represented by later production
  lineage; do not cherry-pick `fafe1cc`, `2052932` or `089c406` again.
- Qwen source `da41686` is not in production `main`; integrate it only after the
  compatibility release, from its frozen source SHA.
- Migration numbering decision: preserve production `0001`-`0023`; map the ten
  certified T08-T13 migrations to `0024`-`0033`; no other collision found.
- Release blocker: old production confirmation writes only `is_confirmed`, but
  canonical `0032` requires matching `review_state`; current integrated code
  also cannot run before the evidence columns exist.
- Next production-rollout task: build/test/review a pre/post-0032 compatibility
  release directly from production `05423f2`. After it is independently merged
  and deployed by an authorized operator, run three independently gated trains:
  Qwen/runtime, T08-T13 plus bridge, then Takosan brand-only. Do not deploy
  `f26003b` as-is; repository promotion is governed separately by the canonical
  consolidation plan.
- Fresh audit: source/ancestry/path/migration hashes reverified; both unsafe
  schema orders reproduced with SQLite; docs-only `git diff --check` PASS.
  Full application gates were not rerun because no code/schema changed.
- Hosted exact-head CI has not reported; branch protection is unavailable to the
  current `WRITE` account. Do not merge until hosted CI and admin protection/
  no-deploy controls are reviewed.
- No merge, deploy, remote D1, production resource or PayOS action authorized.

## Historical candidate remediation — superseded as next-action authority

- Reviewed candidate `e34ed16777166407acf67b2c76d733d89c7d64ca` is
  superseded. Remediation commit is `5f6853d` on top of `231d1e7`.
- Qwen production runtime, certified T13 Inventory Truth, hardened Takosan, and
  the additive byte-identical `0024`-`0033` migration bridge are integrated.
- Fixed: protected payment UI restored to production base; real Qwen runtime is
  composed in the queue integration test; truthful missing/0/.11/.9 confidence;
  prior typed runtime error retained; brand tests exclude payment scope.
- Intentional auth difference: certified T13 DEC-012 guest transfer deferral.
- PASS: focused `41/41`; brand `16/16`; full Vitest `3630/3630` (149 files),
  lint, typecheck, migration smoke, build, diff check and browser `60/60`.
- Retained failure evidence: affected matrix first ran `300/302`; both failures
  were over-broad brand assertions against the protected payment files.
- Two intermediate typechecks rejected incorrect `fetch` spy annotations; the
  final typed `MockInstance` form passes typecheck and focused `57/57`.
- Access READY: production `ADMIN`, Frigo-dev `WRITE`, both heads unchanged;
  local `origin` is unrelated `Tungjpstore/yaji`, so publish only to an explicit
  verified production target if separately authorized.
- P3-1/P3-2 deliberately preserved. Hosted exact-candidate CI is absent.
- Next: independently review immutable remediation SHA `5f6853d`. Do not
  merge/deploy/apply remote migrations.

# Takosan brand branch board — 2026-09-14 (independent of T13 board below)

- **TAKOSAN BRAND MIGRATION — application checkpoint `e37ee28` published** on
  `hoplite/megara-hyblaia-6b723eb2` from base `897102b`. Not T13 remediation, not
  T14. T13 freeze `32ddbb4` and main `d1b0673` unchanged.
- Done: kit assets installed, PWA icons generated, brand contract, tokens,
  typography, PWA/HTML metadata, SW cache bump, Landing/Onboarding/Auth/chrome/
  empty+success states, copy rename, 9 branding tests. Gates: Vitest 3480/139,
  browser 60/60, QA matrix clean.
- Next: brand review of the checkpoint; on acceptance remove legacy
  `public/frigo/{brand,app-icons,illustrations}`; maintainer decision on domain.
  No merge/deploy/remote D1/PayOS.

# Frigo task board

## Active integration work (2026-09-15)

- Production + Qwen runtime + certified T13 + hardened Takosan consolidation:
  **IN PROGRESS** on `integration/t13-takosan-qwen`.
- Fixed base: `05423f2ad675006a4c7913e696f1979b3fcaae59`; bridge migration
  range planned as production `0024`-`0033` while preserving production `0023`.
- Current checkpoint: repository/source identity, common ancestry, divergence
  classes, preservation matrix, and migration map recorded under
  `docs/integration/`.
- Next action: integrate Qwen lineage, then resolve T13/Takosan semantically and
  run the local release-candidate matrix. Do not merge/deploy/apply remote D1.
## Current board — T13R certified freeze, 2026-09-14

- **T13 REMEDIATION CERTIFIED — READY FOR INDEPENDENT FINAL REVIEW #2.** Repo
  `vn-blo/Frigo-dev`, ID 1368281478; branch `hoplite/delos-f0bb1d04`;
  **T13R_APPLICATION_FREEZE `32ddbb4f2bb636fdcf201e9ca99c4689d3655477`** (remote
  == local, verified). Main `d1b06732…` unchanged. Rejected `7b7bb69…` **DO NOT
  RELEASE**.
- Freeze = `7e68e3b` application tree + two test/fixture-only commits (`bd2f5f3`
  fixture collision fix after a 3 failed/51 passed browser run; `32ddbb4` new
  P2-B browser reopen spec, RED at `7b7bb69`). Application/migrations/deps/harness
  config byte-identical to `7e68e3b`.
- Blockers P0/P1/blocking P2 **0/0/0**; AC1–AC14 **all PASS**; roadmap rows all
  **DONE**. Gates (pre-freeze and clean detached): full **3471/138**, T13R-A
  **45/5**, T13R-B **171/7**, real D1 **92/5**, browser **60/60**, 32 migrations
  (0031/0032 unchanged, 0033 absent), fresh + legacy populated real D1 replay,
  schema gate, writer/reader UNKNOWN 0/0, diff-check, detached porcelain EMPTY.
  **NO HOSTED CI FOR THE EXACT FREEZE.**
- Next: **INDEPENDENT T13 FINAL REVIEW #2** of `32ddbb4` and its docs head. No
  merge/deploy/remote D1/PayOS/T14/reconciliation. Details:
  [T13R_FINAL_CERTIFICATION.md](inventory-truth/t13/T13R_FINAL_CERTIFICATION.md).

## Historical board — T13R-A complete, 2026-09-13 (superseded)

- **T13R-A COMPLETE — READY FOR T13R-B.** Branch
  `hoplite/oropos-eb2d4886--t13r-a-data-integrity-ownership`;
  application checkpoint `fc0f9c5`; docs head follows. Main `d1b06732…`
  unchanged. Rejected freeze `7b7bb69…` still **DO NOT RELEASE**. This is not a
  final T13 freeze.
- FIXED with red→green permanent tests: P1-1 async evidence, P1-2 canonical
  rename, P1-3 lot-bound draft, P1-4 receipt ownership, P2-A raw evidence
  completeness, P2-B confirmed expiry round-trip. New additive migration
  `0032_scan_evidence_completeness.sql` (32 total; 0031 byte-identical).
- Gates: lint/typecheck/build PASS; **3423/137** full; **45/5** focused T13R-A;
  **92/5** real local D1; **42/42** browser; migration smoke, fresh + legacy
  populated 0031→0032 local D1, schema gate PASS. Writer/reader authority sets
  unchanged from the freeze.
- Next: **T13R-B** — Cloudflare fridge confidence fabrication, inventory
  conflict/refetch UX, Home estimated-expiry qualifier, NULL opened-state truth —
  then a new application freeze and independent recertification. No merge/
  deploy/remote D1/PayOS/T14/reconciliation.

## Historical board — T13R-A safe stop, 2026-09-13T15:50:34Z (superseded)

- **T13R-A CHECKPOINTED, IMPLEMENTATION NOT STARTED.** Branch
  `hoplite/oropos-eb2d4886--t13r-a-data-integrity-ownership` at audit commit
  `b9735b4` (also remote on `hoplite/oropos-eb2d4886`, verified equal). Main
  `d1b06732…` unchanged. Rejected freeze `7b7bb69…` remains **DO NOT RELEASE**.
- All target findings **NOT STARTED**: P1-1 async evidence, P1-2 canonical rename,
  P1-3 lot-bound draft, P1-4 receipt ownership, P2-A raw evidence completeness,
  P2-B confirmed expiry round-trip. No 0032; 31 migrations unchanged.
- `git diff --check` PASS; no code changed, so typecheck/scoped lint/tests are
  intentionally not run. `.hoplite/settings.json` overlay preserved uncommitted.
- Next: implement T13R-A findings one at a time with red/green regressions per
  [T13R_A_REMEDIATION.md](inventory-truth/t13/T13R_A_REMEDIATION.md). T13R-B
  blockers (Cloudflare confidence, conflict UX, Home estimates, opened-state
  truth) remain deferred. No merge/deploy/remote D1/PayOS/T14/reconciliation.

## Current board — T13 independent review failed, 2026-09-13

- **T13 BLOCKED — INDEPENDENT FINAL REVIEW FAILED.** Exact freeze
  `7b7bb695ee597a46cf4022a2c534e2fea374be5d`; reviewed docs head
  `4fcbc96b5a5d4b3cea2c2ad0bdb5682b1866891a`; numeric repo ID 1368281478.
- Fresh gates passed: **3372/132** full, **194/10** focused, **92/5** local D1,
  **36/36** browser, lint/typecheck/build, 31-migration smoke/replay, populated
  legacy upgrade, local schema and diff checks. No hosted exact-freeze results.
- Review found **4 P1 and 6 blocking P2** defects despite those green gates.
  Original AC4/6/10/12 fail; AC9/11 remain partial. R5/R7/R8 and
  U4/U7/U8/U12/U13 are not closed. Do not treat the old DONE table as approval.
- Read [T13_INDEPENDENT_FINAL_REVIEW.md](release/T13_INDEPENDENT_FINAL_REVIEW.md)
  for reproducible findings, evidence boundaries and retained failed probes.
- Next task, not started here: **new T13 remediation branch**, confirmed blockers
  only, new application freeze, independent recertification. Reconciliation,
  merge, deploy, remote D1, PayOS and T14 remain prohibited.
- Application/permanent tests/migrations/harness remain unchanged; this review
  only updates audit/status documents. Earlier board sections are historical.

## Current board — T13 complete, 2026-09-13

- **T13 COMPLETE — STOP for INDEPENDENT T13 FINAL REVIEW.** Repo
  `vn-ca1/Frigo-dev`, ID 1368281478; branch
  `hoplite/mende-26679a14--browser-harness-final-cert`.
- Published/fetched application freeze:
  `7b7bb695ee597a46cf4022a2c534e2fea374be5d`. Separate browser-proven U7 fix:
  `47b10e25d6853a9bc4f9dfcf2e83bc01ba330bf2`. Final checkpoint is docs-only.
- Original **AC1–AC14 PASS**. **R3/R4/R5/R6/R7/R8/R11 and
  U1/U4/U6/U7/U8/U12/U13/U14 DONE**, including both review editors and existing-lot
  metadata edits. Current matrices: [T13 TEST_MATRIX](inventory-truth/t13/TEST_MATRIX.md).
- Pre-freeze and detached full: **3372 tests / 132 files**; browser **36/36** before
  and after freeze at 360/390/430. Focused **194/10**; T08 **130/2**, T09 **1259/17**,
  T10 **98/6**, T11 **39/2**, T12 **22/3**, T13/T13B **271/12**; real D1 **92/5**.
  Static/build/migration/legacy/fresh local replay/schema/diff gates PASS; clean
  detached status EMPTY. Writer/reader UNKNOWN 0/0; 31 migrations, unchanged 0031/no 0032.
- Resolved certification interference: first detached browser 35/36 under concurrent
  source-writing tests; unchanged complete browser suite passed 36/36 serially.
  Exact checks/failures: [T13B_FINAL_HARDENING](inventory-truth/t13/T13B_FINAL_HARDENING.md).
- **NO HOSTED GITHUB CI STATUS FOR T13B_APPLICATION_FREEZE**. No merge/deploy/remote
  D1/PayOS/T14/reconciliation. Main remains
  `d1b06732f8a80db4e77986df31ff28d9f04641fa`.
- Only next task: **INDEPENDENT T13 FINAL REVIEW**. All board sections below are
  historical checkpoints, not current blockers or authorization to resume other work.

## Current board — fresh-session Preview safe-stop, 2026-09-13

- **T13 NOT COMPLETE — BROWSER VERIFICATION BLOCKED.** Fresh metadata: `vn-ca1/Frigo-dev`,
  ID 1368281478; main remains `d1b06732f8a80db4e77986df31ff28d9f04641fa` and the
  prior continuation/current fresh-thread start is `a9b5904aeba0fc7e4d649165770a4e86701312a2`.
  The required `2334a6f -> c37a9b8 -> f845d04 -> fd32aa8 -> a9b5904` lineage and empty
  `fd32aa8..a9b5904` non-doc delta were reverified with a clean starting worktree.
- BLOCKED: all three schema-valid managed Preview attempts (`preview`, 120 seconds,
  promotion `preview:3000`) failed before starting `scripts/security-preview.mjs`:
  `Preview port must be a currently discovered HTTP listener owned by the managed preview run`.
  Only browser processes were listening. No settings edit, alternate server, or workaround.
- NOT RUN in this fresh session: flows A–I, 360/390/430 checks, viewport-emulation
  capability, focused/full suite, typecheck, lint, build, D1/migration-replay/schema and
  authority audits. Historical 176/9 and 26 hardening/adoption results are not current
  certification; current full counts are unestablished.
- Fresh checks: migration integrity PASS (31, unchanged 0031, no 0032),
  `git diff --check` PASS. Platform report recorded. Docs-only WIP publication target:
  `hoplite/mende-26679a14`; prior continuation branch preserved.
- NEXT: repair the supported managed Preview interface; resume all mandatory WIP flows,
  then establish the real baseline and complete AC/roadmap, freeze, and certification gates.
  No application freeze/final docs head, merge, deploy, remote D1, PayOS, or T14 work.

## Current board — confirmed UX fixed; browser gate blocked, 2026-09-13 12:40 UTC

- New branch: `hoplite/kos-9d39545d--t13b-b-final-certification`, exact f845d04 base.
- Saved/published WIP: `fd32aa8deaee7df454245591015780c59f909352`; old WIP/main preserved.
- Confirmed-review P3: completed wording, real read-only header/controls, no confirm
  CTA/manual addition, working `Xem tủ lạnh` navigation; A/B/A terminal state retained.
- PASS: 176/176 tests in 9 files (26 hardening), typecheck/scoped lint/diff check.
- BLOCKED: one fresh Preview startup reproduced the platform promotion-schema error;
  no supported existing server available. Owner's stop-before-freeze rule applied.
- NOT RUN: browser/mobile flows, actual current full baseline, final AC/roadmap/source
  audits, application freeze, detached full/D1/migration/schema certification, final docs.
- NEXT: unblock Preview, complete all nine flows, measure current full runtime counts
  (not obsolete 3177/124), then follow the freeze/certification gates in the WIP handoff.
- **T13 NOT COMPLETE.** No settings commit, merge, deployment, remote D1 or PayOS change.

## T13B-B continuation — 2026-09-13, BLOCKED_FINAL_VERIFICATION

- Repository transfer verified: `vn-ca1/Frigo-dev`, ID 1368281478; exact recovered
  WIP/guarded main/rescue refs and ancestry passed before edits.
- Branch `hoplite/kos-9d39545d--t13b-b-final-hardening`; published WIP
  `c37a9b8d7afc66507052bbc8f1e8a24fdc896e8d`, not application freeze.
- P1 route/store mismatch and private-session race: fixed. P2 safe fridge domain
  errors/refetch and confirmed-review remount truthfulness: fixed. 23 regressions.
- PASS: final focused 173 tests/9 files; T13B-A backend 1122/17; typecheck, scoped
  lint, operator syntax, diff check. Writer/reader UNKNOWN 0/0; 31 unchanged migrations.
- BLOCKER: managed Preview's required promotion argument prevents initial startup.
  Reported platform fault; fresh browser flows and widths remain unverified.
- NEXT: unblock managed Preview, complete all browser/AC/roadmap gates, then create
  application freeze and run clean detached/full/D1/migration/schema/build gates.
  Only afterwards update final T13 documents and create final docs HEAD.
- **T13 NOT COMPLETE.** No main merge, production deploy, remote D1 or PayOS change.
  See `inventory-truth/t13/T13B_B_WIP_HANDOFF.md` for exact commands/failures/lineage.

## Current authoritative board — T13B-B quota stop, 2026-09-13

- WIP implemented: receipt/fridge full review, truthful evidence/confidence, explicit
  persisted rejection, adoption operator CLI, two truth-presentation fixes and tests.
- Focused combined preflight: **109/109, 6 files PASS**. No final full-suite freeze.
- SAVED: WIP `a8cefd13505bc6b45dd11f45a6323539deb60f93` was published/fetched with
  equality after initial repository-access failures. Public numeric metadata still
  returns 404. Base discrepancy is recorded, not repaired by reset/rebase.
- PENDING: interrupted review, affected browser rerun, original AC/roadmap matrix,
  final authority audits, full/D1/lint/typecheck/build/migration/schema/freeze gates.
- Next: wait for explicit resumption authorization, then reverify identity/base and
  continue from saved WIP. Details: [WIP handoff](inventory-truth/t13/T13B_B_WIP_HANDOFF.md).

## Current authoritative board — T13B-A / T13B-B split, 2026-09-13

- **T13B-A COMPLETE — READY FOR T13B-B**, backend-only. Prior T13 completion
  statements below do not certify the remaining Part B scope.
- Application/test continuation checkpoint:
  `c31567ec7dfa8f95808c20c834b327cbb3425f9c`; branch
  `hoplite/megara-hyblaia-888f1514`; base `3458c6cb971f5d96fce8eda3abc3d708437ce713`.
  Checkpoint pushed/fetched with equality verified; docs follow separately.
- DONE: separate adopted receipt purchase lots; unchanged older lot provenance;
  exact new purchase facts; preserved fridge CORRECT semantics; production
  raw/confirmed correction metadata in the existing command/event fingerprint;
  retained OCR T10 rawName; atomic rollback and concurrent/response-loss replay.
- PASS: focused **1,122/1,122 / 17 files**, real D1 **92/92 / 5 files**, typecheck,
  scoped ESLint, diff/scope/ancestry checks. Four pre-fix negative controls fail as
  expected. Initial event-envelope and race failures were corrected; exact commands
  and iteration failures are in `inventory-truth/t13/T13B_A_HANDOFF.md`.
- Migrations **31**, all unchanged; no 0032. Writer UNKNOWN **0**; canonical
  reader UNKNOWN **0**. Main `d1b0673` unchanged, nothing merged/deployed.
- NEXT: Part B ReceiptReviewPage/ScanResultPage UX, adoption product/operator path,
  final matrix and full verification. **NOT RUN — DEFERRED TO T13B-B FINAL
  VERIFICATION:** full suite/lint/build, dedicated migration smoke/schema/upgrade
  matrix, browser/mobile checks and final certification. Preserve DEC-016 and the
  backend checkpoint; do not rewrite T13 or begin from main.

## Current authoritative board — T13 Receipt/Vision Truth & Inventory UX V2, 2026-09-13

- **T13 COMPLETE on branch `hoplite/lindos-0368e413`; NOT merged to main.** Freeze
  `ad342703fb31a2b97d2798f1161fb83d4d0ed090`; base `578f705`; `origin/main` still `d1b0673`.
- Docs: `docs/ai/inventory-truth/t13/` (README, RECEIPT_VISION_TRUTH, UX_V2, AUTHORITY_MAP,
  TEST_MATRIX, CONTINUATION).
- All 14 acceptance criteria covered by permanent tests. Full suite 3,177/124 files; real D1
  81/81; lint/typecheck/build/migrations(31)/schema gate/diff-check PASS from a clean
  detached worktree at the freeze SHA with an empty status.
- Authority unchanged: one writer (T09). One new write statement, to
  `inventory_observations` (evidence). Writer/reader audits UNKNOWN = 0.
- P3 notes from the roadmap audit are now CLOSED: inferred expiry no longer persists as
  `KNOWN`; the Cloudflare provider no longer fabricates confidence/merchant/date/price.
- 7 defects found by browser verification (not by the green suite) are fixed with regression
  tests; see `docs/ai/inventory-truth/t13/CONTINUATION.md`.
- OPEN follow-ups retained: `MEAL_PLANNER_AUTHORITY_CUTOVER`; AuthPage raw error text (P3).
- NEW follow-ups: viewport emulation was unavailable in the sandbox, so the 360/390/430
  check is a computed overflow probe rather than a visual check; the reconciliation
  accept (CORRECT/MOVE) path was exercised via tests/API but not via a UI click, because
  seeded preview data yields no actionable verdict.
- Main NOT merged; nothing deployed; remote D1 NOT touched; PayOS untouched.

## Current authoritative board — Roadmap reconciliation / gap audit, 2026-09-12

- Audit of RC `64c5501` against the original T08–T12 roadmap COMPLETE: mismatch CONFIRMED;
  **T13 REQUIRED**. Receipt: `docs/ai/release/INVENTORY_TRUTH_ROADMAP_RECONCILIATION.md`.
- T13 defined (not implemented): `docs/ai/release/T13_PROPOSED_SCOPE.md` — Receipt/Vision
  Truth & Inventory UX V2 (RECEIPT provenance, purchase facts, truthful expiry kind, raw-vs-
  confirmed evidence, observation integration or DEC, UX endpoints, detail/edit/move/
  reconciliation UX, adoption path, error-code UX). 14 acceptance criteria. Starting point =
  this audit's docs HEAD (`ROADMAP_AUDIT_HEAD` in HANDOFF), not main.
- P3 notes for T13 (no release blocker): inferred expiry persisted as `KNOWN`; CF provider
  fabricated defaults; `FINAL_WRITER_MAP` scan changed-payload wording; outbox permanent-409
  head-of-line block (pre-existing).
- Owner decision pending: merge `64c5501` before T13 (release management) vs run T13 on the
  train first. This audit does not authorize either.
- OPEN follow-ups retained: `MEAL_PLANNER_AUTHORITY_CUTOVER`; AuthPage raw error text (P3).
- Main NOT merged; production/staging NOT deployed; remote D1 NOT touched; PayOS untouched.

## Current authoritative board — Final re-certification, 2026-09-12

- RC `64c5501` independently re-certified (technical): all gates PASS from a clean
  exact-SHA checkout; no P0/P1/P2. Receipt: `docs/ai/release/INVENTORY_TRUTH_RECERTIFICATION.md`.
- NEXT (separate task): ROADMAP RECONCILIATION / GAP AUDIT before any main integration.
- OPEN follow-ups: `MEAL_PLANNER_AUTHORITY_CUTOVER` (before enabling `MEAL_PLANNER_ENABLED`
  for adopted households); P3 UX note — AuthPage shows raw `err.message` for generic auth
  errors (pre-existing on main).
- Main NOT merged; production/staging NOT deployed; remote D1 NOT touched; PayOS untouched.

## Current authoritative board — Final RC targeted remediation, 2026-09-12

- D3 P1 CLOSED at app freeze `64c5501ab0110658718b3752bd84e537f0854e12` (client
  deferral flow + 7 new tests; server DEC-012 unchanged). D1 P2 CLOSED (main blob of
  `.hoplite/settings.json` restored). D2 P2 DOCUMENTED (SAFE_DEFERRED in T11/T12 maps).
- Clean-checkout gates: 3,092/3,092 (120 files); real D1 70/70; T09 654 / T10 98 /
  T11 39 / T12 22; lint/typecheck/build/migrations(30)/schema/diff-check PASS; status empty.
- FOLLOW-UP (must land before `MEAL_PLANNER_ENABLED` is enabled for adopted
  households): **MEAL_PLANNER_AUTHORITY_CUTOVER** — route `loadMealPlanningSnapshot`
  inventory reads through T11 read authority / `fetchHouseholdInventoryFromDb`.
- Next: re-certification of `64c5501` as the release candidate; main NOT merged;
  production/staging NOT deployed; remote D1 NOT touched; PayOS untouched.

## Current authoritative board — Final Release Integration Review, 2026-09-12

- Review of RC `d15600186c3e73faba011eb690ac6cd70e8d3d2d` from docs HEAD `5cb4caa`
  complete: **RELEASE CANDIDATE NOT READY** (0 P0, 1 P1, 2 P2). Evidence in
  `docs/ai/release/INVENTORY_TRUTH_RELEASE_CERTIFICATION.md` (+ ANCESTRY, CHANGE_MANIFEST).
- Certified PASS: lineage, main divergence (main still `d1b0673`), task survival,
  architecture invariant, reader/writer audits, migration chain (sqlite + real D1),
  legacy upgrade simulation, clean-checkout gates (3,085/3,085; real D1 70/70; all
  static gates), smoke matrix, concurrency/idempotency/tenancy/fail-closed/cache,
  API compatibility, dependency/config (no change).
- OPEN — D3 (P1): guest→email registration dead-ends with `409
  INVENTORY_TRANSFER_DEFERRED` in the shipped web client. Next: client-only successor
  fix on the T12 branch (explicit “continue without transfer” retry), test, re-run gates.
- OPEN — D1 (P2): restore main blob of `.hoplite/settings.json` on the T12 branch.
- OPEN — D2 (P2): document `meal-planning-snapshot.ts` reader as SAFE_DEFERRED in the
  T11/T12 maps; cut it over to read authority before enabling `MEAL_PLANNER_ENABLED`.
- Main NOT merged; production/staging NOT deployed; remote D1 NOT touched; PayOS untouched.

## Current authoritative board — T12 runtime verification, 2026-09-12

- Review findings P1/P2 closed at new freeze `d15600186c3e73faba011eb690ac6cd70e8d3d2d` (`22f675d` superseded):
  real-D1 T12 suite (8), route-level suite (5), explicit STALE_SNAPSHOT race
  classification, adopted-cook replay-first fix.
- 3,085 full/119 files; 70 real D1; all gates PASS from clean exact-SHA checkout.
- No migration; no new writers; PayOS untouched; PR tooling not used.
- Remaining P0/P1: NONE. Main NOT merged; production NOT deployed; Final
  Release Integration Review NOT started.

## Historical board — first T12 freeze (superseded)

- T12 CLOSED-LOOP COMPLETE at freeze `22f675d1cca76d05c93ebb2ed40bbaea11a72238`: closed-loop suite (9), authority
  maps (UNKNOWN readers/writers = 0), alias tightening. 3,072 full/117 files;
  62 real D1; all gates PASS. **T08–T12 release train COMPLETE.**
- Remaining P0/P1: NONE. P3: bounded legacy compatibility for non-adopted
  households (removal conditions documented in FINAL_AUTHORITY_MAP.md).
- Main NOT merged; production NOT deployed; PayOS untouched; no post-T12 task.

## Historical T11 board — read authority hardening (superseded by T12)

- Findings A–F closed (real-D1 proof, adopted-empty, MOVE/DISCARD/FEFO races,
  activeCount, display aliases, freshness fail-closed) → VERIFIED from a clean
  published checkout. New freeze `c15c9a81fc4367b3506a7e2693798ebe1424b0a9`; `657201f` superseded.
- 3,063 full/116 files; 62 real local-D1; all static/30-migration/schema gates PASS.
- No migration; no new writers; PayOS untouched; PR #3 left alone (no PR tooling).
  Main NOT merged; production NOT deployed; T12 NOT STARTED.
- Remaining P0/P1: NONE. Verdict: **T11 COMPLETE — READY FOR INDEPENDENT REVIEW.**

## Historical T11 board — first freeze (superseded)

- Canonical read authority: REPRODUCED the dual-truth risk (all product reads
  funnelled through the `inventory_items` projection + 1h KV cache) → CUT OVER
  (`fetchHouseholdInventoryFromDb` authority-backed for adopted households; KV
  bypassed; fail-closed; legacy path preserved behind the adoption gate) →
  VERIFIED from a clean published checkout.
- Read consumer audit: production UNKNOWN = 0 (READ_CONSUMER_MAP.md).
- Application freeze: `657201f3a12f18dd96cc96adeac0dd1d3b75e6f4` (PR #3; corrective `4553b8a`).
- 3,041 full/115 files; 51 real local-D1; lint/typecheck/build/30-migration
  smoke/local schema/diff PASS; clean exact-SHA checkout repeats all.
- No migration; PayOS untouched. Main NOT merged; production NOT deployed;
  T12 NOT STARTED.
- Remaining P0/P1: NONE. Verdict: **T11 COMPLETE — READY FOR INDEPENDENT REVIEW.**

## Historical T10 board — observation claim fence (superseded)

- Concurrency P1 (competing decisions on one OPEN observation): REPRODUCED (silent zero-row
  UPDATE; trigger-dependent; double commit without trigger) → FIXED (in-batch changes() claim
  guard, atomic loser rollback, `OBSERVATION_VERSION_CONFLICT`, twin replay preserved) →
  VERIFIED from a clean published checkout.
- New application freeze: `7393edcd4fb9cc8bb4df2a06628fb5dc57f8607b`; `4c414fa` superseded.
- 3,024 full/114 files; T10 focused 98/98; T09 focused 323/323; 51 real local-D1;
  lint/typecheck/build/30-migration smoke/local schema/diff PASS; clean exact-SHA checkout repeats all.
- No migration; PayOS untouched; no PR created/updated. Main NOT merged; T11 NOT STARTED.
- Remaining P0/P1: NONE. Verdict: **T10 PASS — READY FOR INDEPENDENT REVIEW**.

## Historical T10 board — composition fix 4c414fa (superseded)

- Multi-field composition P1: REPRODUCED (2–3 CORRECT per lot; expiry-only verdict on mixed
  claims) → FIXED (single merged CORRECT + ≤1 MOVE; boundary invariant; T09 atomic compose)
  → VERIFIED from a clean published checkout.
- New application freeze: `4c414fa7eb33329ee12936c0899644af67e48f07`, published/fetched, local == remote.
  Previous `6c28858` superseded.
- 3,009 full/113 files; T10 focused 78/78; 49 real local-D1; lint/typecheck/build/
  30-migration smoke/local schema/diff PASS; clean exact-SHA checkout repeats all.
- No migration; historical migrations untouched. Main NOT merged; production NOT deployed;
  remote D1 NOT touched. T11 NOT STARTED.
- Remaining P0/P1: NONE. Verdict: **T10 COMPLETE — READY FOR INDEPENDENT REVIEW**.
  Receipt: `inventory-truth/t10/VERIFICATION.md`.

## Historical T10 board — initial freeze 6c28858 (superseded)

- T10A source audit: COMPLETE (`inventory-truth/t10/OBSERVATION_SOURCE_MAP.md`).
- T10B domain contracts: COMPLETE (categorical evidence, deterministic identity, pure planner).
- T10C persistence: COMPLETE (additive 0030; evidence never mutates inventory; smoke + schema gate require 0030).
- T10D reconciliation planner: COMPLETE (9 verdicts; exact quantities; no name matching; expiry precedence).
- T10E decision authority: COMPLETE (T09 CORRECT/MOVE composition, one atomic batch, receipt replay, idempotency).
- T10F concurrency/tenancy/corruption matrix: COMPLETE (F1–F5 races, real-D1 trigger battery).
- T10G verification/freeze/handoff: COMPLETE.
- Application freeze: `6c28858acd0627d2d602998107c2e260c5e4f0d5`, published/fetched,
  local == remote == clean-checkout SHA. Full 2,990/112; focused 1,097/19; real D1 49/49;
  lint/typecheck/build/migration/schema/diff PASS from the clean checkout (empty status).
- Remaining P0/P1: NONE. Verdict: **T10 COMPLETE — READY FOR INDEPENDENT REVIEW**.
- T11: NOT STARTED. T12: NOT STARTED.
- Next: independent review of PR #2. No merge of main, no deploy, no remote D1, no PayOS.
  Full receipt: `inventory-truth/t10/VERIFICATION.md`.

## Historical T09 board — FEFO v2 backfill compatibility (train-merged internally; main merge remains human-gated)

- Final FEFO backfill P1: REPRODUCED → FIXED (additive 0029 + executor mapping fix)
  → VERIFIED from a clean published checkout.
- New final application freeze: `bf391c5fdcdd9e9c2f2257db515815e082cb4381`, published/fetched, local == remote.
- 1,237 focused/15 files; 2,926 full/108; 44 real local-D1; lint/typecheck/build/
  29-migration smoke/local schema/diff PASS; clean exact-SHA checkout repeats all.
- Native equal-ID FEFO, PATCH, replay, concurrency, adoption and writer-fence
  suites unchanged and PASS. Historical migrations 0023-0028 untouched.
- Remaining P0/P1: NONE. Verdict: **READY FOR FINAL MAIN MERGE REVIEW**.
- Next: external main-merge review. No merge/deploy/remote D1/PayOS/T10 by this agent.
  Full receipt: `inventory-truth/t09/FINAL_PATCH_VERIFICATION.md`.

## Historical backfill compatibility board — superseded by bf391c5

- Backfilled manual PATCH P1: REPRODUCED → FIXED → VERIFIED, no migration.
- Final application freeze: `df73bc035c2938b6fd082c57f6bca89a82d8e443`, published/fetched.
- 619 focused/nine files; 2,910 full/107; 42 real local-D1; all static/build/schema
  gates PASS. Exact fetched-source clean checkout repeats full suite and every gate PASS.
- **NOT READY FOR MAIN**: shared v2 FEFO equal-ID SQL restriction remains P1.
- Next: separately authorize FEFO compatibility/schema work. No T10/merge/deploy.
  Full receipt: `inventory-truth/t09/FINAL_PATCH_VERIFICATION.md`.

## Historical PATCH parity board — superseded by df73bc0

- Final targeted PATCH fixes A/storage and B/category: REPRODUCED, FIXED, VERIFIED.
- Published application freeze: `e796f695bdb4228853992cdedc4e3cecf3437adb`.
- Fresh gates: 515 focused/six files; 2,865 full/106; 40 isolated local-D1;
  lint/typecheck/build/28-migration smoke/local schema/diff PASS.
- **NOT READY FOR MAIN**: inherited P1 backfilled-lot PATCH mapping refusal remains.
- Next: separately scoped mapping compatibility authorization, then main review.
  No merge/deployment/remote D1/PayOS/T10 work. Exact evidence:
  `inventory-truth/t09/FINAL_PATCH_VERIFICATION.md`.

## Historical evidence — all prior freeze/readiness claims below are superseded

## T09 F/G/H complete — 2026-09-11

Independent-review follow-up `27427383d61930ea1b67ccbc1d69bb1cc069f931` is published: adopted PATCH retries now replay retained receipt evidence before stale-version rejection; altered reuse conflicts and a new key retains CAS. Fresh full suite: 2,838 tests / 105 files PASS (165.25s); lint, typecheck, migration smoke and build PASS. Next action remains external review; do not start T10.

T09F = COMPLETE; T09G = COMPLETE; T09H = COMPLETE (freeze/evidence, no main merge).
Application freeze `9bf9ac0fe7b5e0d39615f39ae5cc30f84569af2f` published/fetched on **hoplite/kydonia-2785bb72**
(successor of the read-only base `hoplite/kos-2a686759` at `aa44d2a2f80ea33fd4b328aba906660c0129051e`);
local/remote equality PASS. Full gates at this checkpoint: **2,837 tests / 105 files PASS** (155s), including the new 19-test adoption suite, 9-test G concurrency matrix and rewritten 14-test writer-fence suite; 38 isolated real local-D1 tests PASS; lint PASS; typecheck PASS; build PASS; 28-migration smoke PASS; local D1 schema gate PASS (0028 required).
All writers classified in `inventory-truth/t09/WRITER_MAP.md` (no UNKNOWN). DEC-012
intact. Next decision belongs to the external review; do not start T10 from here.

## Historical board — 2026-09-11 (superseded)

Published F safety/preparation checkpoint: `aa43e069edbff7843e9eb7532ff386b27be96a17`.
Pure adoption planner and writer/retry safety are verified, not full F completion.
Fresh PASS: 1,347 focused / 19 files; 2,808 full / 103; lint/typecheck/build;
27-migration replay; 38 actual local-D1 tests; diff/protected-path checks.
Next: atomic adoption receipt/activation authority → functional manual/scan/
shopping/cook adapters → G matrix → H freeze/review. No freeze/readiness claim.

Same T09 task, canonical repository **vn-2d/frigo-dev**. Writable successor
**hoplite/kos-2a686759** directly from interrupted F `66858c5`; previous
continuation `hoplite/orchemenos-e002591e` is read-only. Transfer/ancestry and
fresh 2,685-test / 99-file baseline plus all static/build/migration gates PASS.
A–E COMPLETE; F IN_PROGRESS; G/H NOT_STARTED. Current authority:
`inventory-truth/t09/CONTINUATION.md`. Previous owners are historical provenance.
Frozen D base remains `811f7e8463303e010199741d66f88ab8a817212d`.

The following E/guest-only verification is retained pre-recovery history.
A–E complete; E atomic multi-effect FEFO published/fetched at
`9bd1e6bc000cd2e94121469babb1a5eb63a5047f`, equality/ancestry PASS. F–H not complete.
Successor docs 8bf32ed4e41ed3341215c6376e0c13ef13043616
published/fetched before E. Latest post-fence: 1,172 focused / 11 files and
static/build/migration gates PASS; final full rerun 2,659 / 98 files PASS. Earlier
1,170 focused / 2,657 full results predate this fence. Scoped E review has no
remaining P1/P2 findings. F guest transfer SAFE-DEFERRED (143 focused auth/guest/
outbox tests PASS; full 2,685 / 99 and all static/build/migration gates PASS);
explicit adoption and other writers remain pending. See `inventory-truth/t09/VERIFICATION.md` and
`inventory-truth/t09/CONTINUATION.md`; no main/production/PayOS/T10 work or readiness claim.

## Historical T09D checkpoint (2026-09-10)

IN_PROGRESS in vn-2b/frigo-dev on hoplite/euhesperides-d77023a5, exact T08 base
8f8788c1a0c9e486657751ef3875a5baa5334dec. Publication-first and A/B published;
C internal native persistence/schema and real local D1 proof implemented. No HTTP
or legacy-writer cutover. Latest gates/failures are in t09/VERIFICATION.md.
Published C 13133b3: 507 focused and 1,994 full tests PASS, static/build/local
migration gates PASS, remote-source 507 PASS.
D receipt/event/poststate authority verified locally: 1,031 focused / 2,518 full,
static/build and 26-migration/local schema PASS. D b036b25 published/fetched;
remote-source 1,031 tests and typecheck PASS. Next: E/F;
G/H acceptance and final T09 readiness remain pending.
See inventory-truth/TASK_BOARD.md and t09/REVIEW_INDEX.md.
No production reconciliation, legacy/main synchronization or T10 in this task.

## Completed release work

- T01-T07: COMPLETE.
- T01 ✅
- T02 ✅
- T03 ✅
- T04 ✅
- T05 ✅
- T06A ✅
- T06B ✅
- T07 ✅
- Release Integration ✅
- Release Publication ✅
- Main Integration ✅
- Main CI ✅

| Task | Status | Evidence |
| --- | --- | --- |
| T01 Domain/data foundation | COMPLETE | Preserved foundation and hardening lineage |
| T02 Recipe engine | COMPLETE | `0051276` / `ef13acd` in the merged release |
| T03 Ranking/personalization | COMPLETE | `01f9d87` / `3592de9` |
| T04 Weekly planner | COMPLETE | `ebd538b` |
| T05 Shopping/budget/waste | COMPLETE | `4f3f539` / `899b6d7` |
| T06A Backend/API/trust/persistence | COMPLETE | `9f420c0` / `ca60ced` / `c46330c` |
| T06B Frontend/UX/AI presentation/E2E | COMPLETE | `0fc78a4` / `6d4e873` |
| T07 Final hardening | COMPLETE | Final application SHA `0b20061e` |
| Release Integration | ✅ COMPLETE | Application integration in main at `23ef51d` |
| Release Publication | ✅ COMPLETE | Release docs published |
| Main Integration | ✅ COMPLETE | Main merge SHA `23ef51d6ec12a5a3e319a2d941dca39d2775cb9d` |
| Main CI | ✅ PASS | Run `34396319671` |

## T08 independent branch work — explicitly authorized 2026-09-09

- T08A Audit: complete; dependency map in `inventory-truth/MASTER_CONTEXT.md`.
- T08B–E Domain/persistence/backfill/projection/parity: implemented and locally verified.
- T08F Verification/handoff: COMPLETE. User approved `hoplite/xanthos-7d942897`
  instead of the original feature name (DEC-006); trusted publish/fetch confirmed
  fb00f46 and the docs-only final receipt follows it on the same branch.
- Verified code: `dd2ecc6f7066250dfdc5214a3d6c356e1479b61e`.
- Fresh final-session PASS: 130 focused tests, 1,617 full tests / 89 files,
  lint/typecheck/build, 23-migration replay/local schema and diff checks.
  Prior local D1 apply passed 23/23. Source unchanged since dd2ecc6.
- Remaining T08 work: none; final report `inventory-truth/T08_VERIFICATION.md`.
  Cross-account checkout: `origin/hoplite/xanthos-7d942897`. T09–T12 not started.
- Full checklist/failures/next action: `inventory-truth/TASK_BOARD.md`,
  `inventory-truth/VERIFICATION.md`, `inventory-truth/CURRENT_STATE.md`.

## Independent production/release work (not authorized by T08)

- Production Reconciliation ✅ COMPLETE - post-cutover verified
- Production DB Migration ✅ COMPLETE - `frigo-db` ledger `0001`-`0023`
- Controlled Production Deployment ✅ COMPLETE - Worker SHA `bdb0dda0`
- OCR production recovery (maintenance) ✅ COMPLETE - deployed and verified
- Planner Rollout ⏳

Do not invent T08. OCR recovery is a bounded maintenance candidate, not a new
product task or a production deployment. Planner rollout remains separately
authorized work.
The original release packet did not authorize T08; the separate user-authorized
T08 packet now governs only its isolated branch. Production work remains pending
and must be separately authorized; this branch does not perform or update it.

GitHub source of truth: main.
Deployed application SHA: `bdb0dda0b1123c4fd940058091e3cb285d5e8eb8`.
Post-deployment GitHub `main` changes are documentation-only receipt merges; the
OCR candidate is merged and deployed at 100% traffic.
Current `github-frigo/main`: `db2377fd9f63d1be38ce3882c6d8173e0bf9e497`;
the `codex/ocr-production-recovery` branch was merged via PR #17 and its code is
deployed in production.
Release Integration: COMPLETE.
Main Integration: COMPLETE.
PRE_CLEANUP_MAIN_HEAD: `41d2de6bc76331322cc63e8038432b0b02f60da1`.
APPLICATION INTEGRATION: complete in main at `23ef51d6ec12a5a3e319a2d941dca39d2775cb9d`.
Production reconciliation: COMPLETE - schema/code/health/traffic verified.
Production DB migration: COMPLETE - exact ledger `0001` through `0023`.
Production deployment: COMPLETE - version `df7225c9-6f20-4206-9f16-573de6a69c43`.
Planner rollout: NOT STARTED.

## OCR image optimization maintenance (2026-09-13)

- Browser preprocessing candidate: **IMPLEMENTED LOCALLY, NOT DEPLOYED**.
- Scope: in-memory resize cap (2,000 px), JPEG quality 0.82, smaller-output
  guard, cancellation/session fencing and FileReader fallback.
- Evidence: 11/11 focused privacy/image tests pass; sample receipt conversion
  measured 81.9% smaller at unchanged 1,086x1,448 dimensions.
- Gate: run browser/device OCR recall and latency smoke before committing or
  promoting; do not alter PayOS, schema or provider secrets.
OCR recovery status: COMPLETE - DEPLOYED AND VERIFIED.
Next task: monitor OCR quality/latency and schedule the separate React Router upgrade.

## Frozen release evidence

- PRODUCTION_APPLICATION_BASE_SHA:
  `23ef51d6ec12a5a3e319a2d941dca39d2775cb9d`.
- Verified application SHA: `0b20061e7dc7405df68b18a18da4166e09494ecd`.
- Verified release head: `0420807968538f61b669569d064c404f67032174`.
- Previous final-head CI: `34405307196 SUCCESS`.
- Previous release deploy workflow: `34396457582 SUCCESS`.
- Full: **1,487 tests / 87 files PASS**; focused: **819 tests / 40 files PASS**.
- D1: **23 / 23 migrations PASS**; upgrade **0020 -> 0023 PASS**.
- Existing rows preserved: **776 rows / 58 tables**.
- Browser: **264 assertions / 36 phases PASS**.
- Payment-adjacent: **82 tests / 7 files PASS**.
- Previous docs-cleanup deploy workflow `34405457796`: packaging completed; staging was not
  provisioned and no staging deploy occurred. The current production cutover was
  completed directly with Wrangler OAuth because GitHub production configuration
  is not provisioned.

## PR #8 metadata and archival branches

PR #8 METADATA: `MERGED`, `isDraft=false`, merged and closed at
`2026-09-09T19:38:59Z`, merge commit `23ef51d6ec12a5a3e319a2d941dca39d2775cb9d`.
Application integration is complete in main at `23ef51d`; do not merge PR #8 or
kirrha again. Kirrha remains archival documentation-only divergence.

## Protected areas

PayOS/payment code untouched.

No real payment performed.

Local production source checkout is untouched; the production D1 schema was
updated only through the approved additive migrations.

The OCR recovery worktree is separate from the production checkout. It adds the
unapplied candidate migration `0023_scan_request_fingerprint.sql` locally and
has not changed remote D1, production secrets or Worker traffic.

## Production cutover receipt (2026-09-10)

- Worker readiness: `status=degraded`, `environment=production`, full commit
  `bdb0dda0b1123c4fd940058091e3cb285d5e8eb8`; active version
  `df7225c9-6f20-4206-9f16-573de6a69c43` at 100%.
- Landing/liveness/readiness smoke passed; readiness database/queue/AI/email are
  healthy/configured and only `CONFIG_PLUS_GRANT_SECRET_MISSING` remains as a
  warning.
- Remote D1 exact ledger is `0001`-`0023`; schema gate passes and FK violations are `0`.
- Strict Week reconciliation passes 2/2 plans with 0 orphans and 0 mismatches.
- Preserved counts: users 28, households 28, inventory items 13, recipes 59,
  meal plans 2, scan queue jobs 15, sessions 2 and auth OTPs 0.
- Backup export is retained at
  `.artifacts/frigo-db-pre-main-d1b0673-20260910T205627Z.sql` with
  SHA-256 `000c9cb88d6045afb19cca6ce3e1caa308b20ffa214dbb2cddfca0cb78d722eb`.
- CORS allows the exact trusted origin and emits no ACAO for path-bearing,
  localhost or arbitrary origins. No planner flag, PayOS/payment path or secret
  value was changed. The separate T08 `xanthos` branch contains
  application/migration changes and is not part of authoritative `main`.
- Follow-up: test and schedule the React Router `>=7.18.0` upgrade for the two
  moderate production dependency advisories; do not patch it ad hoc in this
  receipt-only cutover.

## OCR production-recovery candidate (2026-09-12)

| Area | Candidate state | Release boundary |
| --- | --- | --- |
| Provider/model | Qwen `qwen3.7-flash` via DashScope international (`QWEN_BASE_URL`/`QWEN_MODEL`) is primary for vision, receipt OCR, chat and ranking; Groq is disabled unless `GROQ_FALLBACK_ENABLED=true`; Cloudflare vision fallback is opt-in via `CLOUDFLARE_VISION_FALLBACK`; DeepSeek requires `DEEPSEEK_FALLBACK_ENABLED=true` and GLM requires `GLM_FALLBACK_ENABLED=true` | Deployed at 100%; readiness `ai=configured` |
| Output quality | Zod validation plus rejection of generic/placeholder labels and confidence below `0.6`; empty usable output is `AI_SCAN_NO_USABLE_ITEMS` | OCR remains untrusted draft data and requires review/confirmation |
| Queue failures | Typed permanent `MODEL_NOT_FOUND`/auth/permission/license/schema/invalid-response/quality failures; bounded retries for `REQUEST_TIMEOUT`/`NETWORK_ERROR`/`RATE_LIMITED`/`UPSTREAM_ERROR` | Existing lease, idempotency, tenant fencing, max attempts and DLQ remain authoritative |
| Schema/data | Additive `0023_scan_request_fingerprint.sql`; no backfill or inventory/auth/Week/PayOS change | Local and remote D1 cover `0001`-`0023`; Worker deploy remains pending |
| Verification | Local/hosted gates PASS; live Qwen `qwen3.7-flash` smoke HTTP 200; D1 `0023` applied and gated; Worker version `df7225c9-6f20-4206-9f16-573de6a69c43` readiness HTTP 200 at 100% traffic | Monitor quality/latency; only `CONFIG_PLUS_GRANT_SECRET_MISSING` remains as a warning |

Candidate commits `ec87aec` and `56968ba` were merged through PR #17. Local and
hosted validation, live Qwen smoke, migration, deployment and readiness receipts
are complete; continue monitoring OCR quality and latency.

## Qwen-only runtime / cost governance candidate (2026-09-13)

| Area | Status | Evidence / next action |
| --- | --- | --- |
| Task taxonomy and logical role routing | IMPLEMENTED LOCALLY | `packages/ai/src/model-governance.ts`, `task-runtime.ts`; routing coverage is included in the full 1,606-test gate |
| Qwen-only Worker composition | IMPLEMENTED LOCALLY | scan HTTP, queue and explanation use shared config; production vars set `AI_QWEN_ONLY=true`; legacy adapters are not constructed on this path |
| Budgets, structured validation and escalation | IMPLEMENTED LOCALLY | bounded attempts/calls/tokens, Zod parse, quality gate, repair and model-capability fallback tests pass |
| Cost/usage telemetry | IMPLEMENTED LOCALLY | `AIUsageLedger`, non-PII Worker usage logs, provider usage parsing, and shadow budget reservation |
| Golden fixtures / offline harness | IMPLEMENTED LOCALLY | `tests/fixtures/ai-golden.json`; `pnpm ai:eval -- --dry-run` PASS with no live request |
| Local application checkpoint | `21c442d` | `pnpm check` PASS: 1,606 tests / 95 files, lint/typecheck/migrations/build PASS |
| Dependency audit | FOLLOW-UP REQUIRED | `pnpm audit --prod` reports two moderate `react-router` advisories; test the separate `>=7.18.0` upgrade |
| Production deployment | NOT AUTHORIZED | Do not deploy; obtain review, benchmark and hosted CI evidence first |

The candidate branch is based on canonical main SHA
`05423f2ad675006a4c7913e696f1979b3fcaae59`; canonical main and production
remain untouched. Reasoning and judge roles are disabled by default, and the
rolling `qwen3.7-flash` alias is canary-only.

## Qwen candidate recertification and publication checkpoint (2026-09-13)

- Review result: **NO CONCRETE CODE DEFECT FOUND**. Retry ownership is bounded
  by `QwenTaskRuntime`; operation token/call budgets are cumulative; production
  Qwen-only composition fails closed; structured output, quality gates,
  telemetry and Worker AbortSignal handling remain intact. Legacy providers are
  retained only for explicit compatibility paths.
- Focused command: `pnpm vitest run tests/unit/ai-runtime-governance.test.ts tests/unit/ai-router.test.ts tests/unit/qwen-provider.test.ts tests/unit/config-validation.test.ts tests/unit/meal-planning-explanation.test.ts tests/unit/scan-privacy.test.tsx tests/integration/scan-queue-retry-policy.test.ts tests/integration/scan-async-canary.test.ts` - **119 tests / 8 files PASS**.
- Full command: `pnpm check` - **1,606 tests / 95 files PASS**; lint,
  typecheck, migration replay and production build PASS. Remote D1 schema and
  Week parity checks were intentionally skipped without release flags.
- Offline command: `pnpm ai:eval -- --dry-run` - PASS; six fixture cases,
  no live Alibaba/Qwen request. `git diff --check` - PASS.
- Audit command: `pnpm audit --prod` - FAIL with two pre-existing moderate
  `react-router` advisories, patched upstream at `>=7.18.0`; no dependency
  upgrade is in this candidate.
- Documentation updated in `docs/ai/CURRENT_STATE.md`,
  `docs/ai/HANDOFF.md` and `docs/ai/QWEN_RUNTIME.md` to state the pending
  post-unification T08-T12 Inventory Truth recertification and the unchanged
  production boundary. Local `main` remains `f6a48a1`; canonical main remains
  `github-frigo/main` at `05423f2`.
- Publication status: **PUBLISHED FOR REVIEW** to `github-frigo` with a normal
  non-force push; `git ls-remote` verified the published branch SHA matches the
  local candidate, and canonical `main` remains unchanged at `05423f2`.
  GitHub reported the repository relocation notice to `Tungjpstore/Frigo`, but
  the push completed successfully. Next action is code review or a separately
  authorized benchmark. Do not merge, deploy, migrate remotely or alter
  production.

## Qwen pre-unification hardening checkpoint (2026-09-13)

- Application implementation/publication SHA: `f8468eaa7d7fed3cbcf5ac7e780eca07ad3d71e4`;
  remote branch verification passed before this documentation checkpoint.
- Final pre-documentation branch head (including the scheduler-failure
  regression test) is `a145ef5`; this documentation checkpoint follows it.
- **OCR capability:** centralized model capabilities prevent unsupported
  `response_format`/`enable_thinking` on rolling `qwen-vl-ocr`; OCR remains
  prompt-JSON plus application parsing, normalization, Zod and quality gates.
- **Pricing:** Singapore low-context estimates are versioned
  `estimate-2026-09-sg-low-context`; judge pricing is retained only as a
  planning estimate. `estimatedCostUsd` remains non-authoritative.
- **Image guard:** decoded raw base64/data URL payloads are rejected before
  provider calls at 5 MiB defaults (`AI_MAX_IMAGE_BYTES` and
  `AI_MAX_OCR_IMAGE_BYTES`, bounded 64 KiB-20 MiB). Remote URLs remain an
  upstream storage/upload responsibility.
- **Shadow lifecycle:** `backgroundExecutor` is optional and Worker HTTP routes
  pass `executionCtx.waitUntil`; queue processing safely skips shadow without an
  executor. Shadow remains off by default and retains budget reservation;
  scheduler invocation failures cannot fail the primary response.
- **Evidence:** focused **134/134 tests across 8 files PASS**; full
  `pnpm check` **1,623 tests / 95 files PASS** with lint/typecheck/migrations/
  build green; offline AI eval and diff check pass. `pnpm audit --prod` still
  reports the two known moderate React Router advisories.
- **Boundary:** canonical `main` and production are unchanged; no live Qwen
  benchmark, deploy, remote migration, secret update, PayOS/payment change or
  T08-T12 import. T08-T12 remains pending U01/U02. After normal publication,
  verify the branch SHA and request review before any release action.
## Historical canonical promotion attempts (superseded by PR #2)

- [historical] PR #1 exact-head hosted CI: GitHub reported no checks and rejected
  workflow dispatch because Actions is disabled for the current user.
- [historical] Main protection/admin review: the earlier CLI identity had push only;
  branch protection endpoint is unavailable (`404`) and no rulesets were
  observed.
- [done] Re-pushed promotion head after an empty, tree-neutral retrigger commit
  `ae1689c1f5525262da3478137b402692e4e4ed45`.
- [resolved] Repository owner `vn-dlo` authenticated, Actions enabled, and main
  protection configured; PR #2 replaced the stale PR #1 attempt.
- [done] Authenticated `gh` as `vn-dlo`; confirmed repository admin/maintain
  permission and enabled main protection with required `validate` status.
- [historical] Exact-head CI remained absent after owner-authored tree-neutral
  trigger `6ec7ff08ef258ef2ca95fb5d24b581b939ef1c92`.
- [done] Owner-visible PR #2 exact-head CI run `34968012294` passed all hosted
  validation steps on `8eb6d2b8d54e5e2fd08c0a11acd9f57a1e068b24`.
- [current gate] PR #2 still needs one independent approving review before merge.
