## Current T15C-C — authorized canary test cohort mechanism (dormant) — 2026-09-19

- [done] `packages/recipes/src/recipe-canary-cohort.ts` + `src/worker/services/recipe-authority.ts`: server-side override for operator-owned test households — `RECIPE_CATALOG_TEST_COHORT_ENABLED` / `RECIPE_CATALOG_TEST_INCLUDE` / `RECIPE_CATALOG_TEST_EXCLUDE` (Worker secrets; SHA-256 digests of `recipe-catalog-test-cohort:<householdId>`, never raw IDs). Precedence exclude > include > deterministic FNV bucket; disabled by default; canary+cutover only; zero effect in static/shadow/d1 or without a tenant; every malformed/half-applied shape fails closed (`CONFIG_RECIPE_CATALOG_TEST_COHORT` fatal; static + loud diagnostic at request time). Request input cannot reach it. `fnv1a32`/`recipeCanaryBucket`/thresholds unchanged.
- [done] Tests: 25 unit + 4 HTTP (request-control attempts, guest, static/shadow) + workflow/wrangler/manifest guardrail; no migration, no workflow change.
- [status] `T15C_AUTHORIZED_TEST_COHORT_READY` — NOT `T15C_CANARY_COMPLETE`. Production still `shadow / 0 / false`; no deploy/config/D1/R2 change. Receipt: `docs/ai/recipe-catalog/T15C_AUTHORIZED_TEST_COHORT.md`. Previous safe stops (T15C-B, `T15C_PRODUCTION_CANARY_SAFE_STOP.md`) remain valid history.
- [next] Operator supplies the two authorized households → digests as production secrets → T15C-B 1% canary through the protected workflow (separate authorization).

## Current T15B-SHADOW — production Shadow certified; stop before canary — 2026-09-18

- [done] PR #30 merged as `88e8b54de121125866b2ff813e56e33277decf1c`; exact-main CI `35336548833` and automatic staging Deploy `35336830786` succeeded. Staging stayed STATIC71 on Worker `580acb76-a006-4c0a-b991-618ebde07e88`.
- [done] Production Shadow Deploy `35337110268` succeeded after the required Environment approval: Worker `c6fa2ce8-f35b-4485-ad38-09dbc19738d1`, exact SHA, convergence 1 attempt / 574 ms.
- [done] Independent live checks: 5/5 catalog reads returned 71, legacy IDs returned 200, five D1-only IDs returned 404; Shadow tail showed D1 500/500 hydrated, release READY, zero drift/errors, no authority leak.
- [done] D1 stayed tip 0037 / ledger 37 / release `rel-bd00a4f53fcaeee4`; no migration or other D1 write. Receipt: `docs/ai/recipe-catalog/T15B_SHADOW_CERTIFICATION.md`.
- [stop] `T15B_SHADOW_COMPLETE`; no canary, full D1, cutover, media/R2, T14G, Inventory Truth/T09/T11, PayOS/auth, or stale PR #29 merge.

## Previous T15B-PRE checkpoint — STATIC certified; SHADOW wiring PR ready — superseded 2026-09-18

- [done] Canonical repository `1368281478` / `frigo-6/Frigo-dev`, main `0fe2cf071693208f6c642d8cbd994f5a79b5a2cf`; PR #29 remained open and unmerged.
- [done] Immutable production D1 receipt `35329772751`: tip 0037, 500 recipes, release `rel-bd00a4f53fcaeee4`, schema gate PASS, FK `[]`, quick check `ok`, 500 pending media rows / 0 ready.
- [done] Static Deploy `35333517052` approved and SUCCESS: Worker `ab8ff038-2aaa-468b-a9de-8c5d94f14052`, exact SHA convergence PASS, five repeated live checks served 71 static recipes.
- [done] Rollback evidence: previous Worker `56979cb5-e1a8-4241-8a4c-2432d41cc439`; rollback mode `RECIPE_CATALOG_MODE=static`.
- [ready for review] PR #30 (`codex/t15b-shadow-wiring`) adds only validated `static|shadow` workflow plumbing and tests; implementation head `97aff50d…` exact CI `35335079345` SUCCESS. Final docs head must also have exact-head CI SUCCESS. Do not merge or activate in this task.
- [not started] Shadow activation/certification, canary, full D1, media/R2, T14G; Inventory Truth/T09/T11 unchanged.

## Current T15A — pre-production rollout hardening — 2026-09-18

- [done] PR #26 merged (`70cf7e0d…`): schema gate derived from `migrations/`, pinned migration chain, `catalog` certification command.
- [done, PR #27 / T15A-R2, pushed] `wait-for-deployed-release.mjs` bounded exact-SHA convergence helper; `readiness.commit` must be a canonical 40-hex SHA (malformed/missing → fail closed, only a different *valid* SHA retries; regression tests A–J).
- [blocked, T15A-R2] Workflow wiring (`catalog` step in `production-d1-migrate.yml`, input interpolation removed, staging+production using the helper) and the unconditional guardrail tests are committed locally but the App credential still lacks `workflows` permission → push rejected twice. Ready-made commits tracked as `docs/ai/recipe-catalog/t15a-r/r2-wired-series.mbox` (`git am`); raw diff `t15a-r/workflows.patch`. PR #27 must NOT be merged until they are on the branch with exact-head CI SUCCESS. Classification `T15A_R2_BLOCKED_WORKFLOW_PERMISSION`.
- [status] T15A pre-production hardening NOT complete (not merged, not main/staging certified). Production rollout still NOT started.
- [next] T15A Phase B (live production re-query → migrate 0035–0037 via workflow → static deploy → shadow) only with credentials + operator approval; historical last verified production tip = 0034 (must be re-queried live first). No canary/d1/media/T14G. P3_FUTURE_MEDIA_GATE_COMPATIBILITY: `catalog` requires `media_ready=0`; revisit before any migration after media population.

## Historical T14F — T14F_DEVELOPMENT_COMPLETE (T14F-A/B/C certified; production untouched) — 2026-09-17

- T14F-C completed and committed (on top of authorized base `7d667523…`): 0037 promoted byte-identical (`68e52e6d…`), shipped manifest regenerated to 500/2 batches (`rel-bd00a4f53fcaeee4`, `fa47d31f…`), replay (fresh 0001→0037, 0036→0037, 0034→…→0037) PASS, D1 readiness READY 500, static/shadow/canary/full-D1 PASS, user flows incl. Batch B cuisines PASS. Development certificate: `docs/ai/recipe-catalog/T14F_C_500_CATALOG_CERTIFICATION.md`.
- **T14F-C CLOSED**: safe stop `44c0ad38…` resolved. Full closure gates PASS — lint, build, full `pnpm test` **171 files / 3913 tests**, typecheck, migration smoke through 0037, seed/import checks (500/2), diff check. One real blocker fixed forward-only in `8c6080aa…` (tests only): the five real-D1 suites overflowed workerd 1.20250718's 1 MiB statement cache when replaying 0001→0037 in one process (cloudflare/workerd#5977); `tests/helpers/local-d1-worker.mjs` recycles workerd before that. No migration/catalog/runtime change. Second blocker (docs heads): hosted Vitest passed 171/3913 but exited 1 on a vitest-worker `onTaskUpdate` RPC timeout — fixed forward-only via `tests/helpers/vitest-event-loop-yield.ts` (setupFiles; test config only).
- Final head + hosted exact-head validate SUCCESS bound in the PR #25 final certification receipt. Classification: `T14F_DEVELOPMENT_COMPLETE` · `T14F_REAL_CATALOG_500_COMPLETE` · `T14F_500_AUTHORITY_CERTIFIED` · `PRODUCTION_ROLLOUT_DEFERRED` · `MEDIA_POPULATION_DEFERRED` · `T14G_NOT_STARTED`; P3 = 1 (~780 KB unpaginated `/recipes`, T14G).
- PR #25 **ready for review, unmerged**. Production does **not** contain 500 recipes. Merge, production rollout, media population and T14G each need separate authorization.

## Historical T14F — T14F_B_SCALE_BATCH_CERTIFIED — 2026-09-17

- T14F-A pilot certified (`b0150d0…`). T14F-B scale batch completed: **399/399 records** (`t14f-scale-399-v1`) validated publishable, 0 hard duplicates, 0 unresolved ingredients; QA `ok` 0 findings; double compile byte-identical; candidate-500 composition proven (500 unique, order verified).
- Shipped release was 101 (`rel-193ac2b16c64a260`) at the time; approved-batches/current manifest unchanged then; 0036 SHA-256 unchanged; 0037 not yet created; no production action.
- Full gates PASS (171 files / 3911 tests, 2026-09-17). Certified head in PR #25 receipt / `T14F_B_SCALE_BATCH_CERTIFICATION.md`.
- Next: T14F-C only with separate authorization (0037 + 500 manifest). PR #25 stays draft/unmerged.

- Repository ID 1368281478; unchanged main; forward-only `hoplite/massalia-c2862d7c`;
  PR #25 draft/unmerged. Inherited routing fix `8079a37`, verification commit `2ee6f5cc…`.
- Original 5/7 failure independently reproduced: strict 71/101 COUNT_DRIFT is correct.
  Generated test-local 71 release now proves real D1/canary, null fallback, `[5]`/`[]` cache,
  invalid-drift rejection and cleanup; no runtime, pilot, manifest or migration change.
- Routing 8/8, growth 21/21, combined 29/29 twice, non-isolated 29/29, subsystem 383/383 PASS.
  Executed seed/import/typecheck/lint/migration smoke/build/test/diff: all PASS;
  full suite **171 files / 3911 tests**. Exact implementation CI **35223589293 / 105209475052 SUCCESS**.
- Final documentation SHA + hosted CI SUCCESS are bound in the [certification receipt](https://github.com/frigo-4/Frigo-dev/pull/25#issuecomment-5714709031).
  That final certified SHA, not the implementation commit, is the only valid future T14F-B base.
- Pilot 30 + legacy 71 = 101, complete 101/order 0..100, five statements/no N+1;
  replay, authority modes, imported HTTP flows and Inventory Truth regressions PASS.
- **STOP.** Await separately authorized T14F-B. No ingredient scale preflight, Batch B, 0037,
  500 manifest, production/media/T14G action or merge. Overall T14F is not complete.
- Exact commands/hashes: `docs/ai/recipe-catalog/T14F_NEXT_HANDOFF.md`. Local-only settings preserved.

## Historical T14F — WIP SAFE STOP — 2026-09-17 (superseded by takeover above)

- Pilot batch `t14f-pilot-30-v1`: 30 original recipes authored + reviewed + compiled via T14E (30/30
  publishable, 0 duplicates, 0 unresolved ingredients); `0036_recipe_catalog_pilot.sql` promoted
  byte-identical; manifest `rel-193ac2b16c64a260` 101 recipes / 1 batch; `ALL_RECIPES` still 71.
- Checks: typecheck, `check:migrations`, seed check, import check, diff check PASS; focused growth
  suites 20/21 — `production forward path 0034 → 0035 → growth` fails when both growth suites run
  together, passes alone (root cause unknown). Lint/build/full tests/bundle NOT run. Batch B not started.
- Full state and exact next steps: `docs/ai/recipe-catalog/T14F_WIP_HANDOFF.md`.

## T14E — BULK RECIPE IMPORT FACTORY — 2026-09-17 (MERGED main f7a55408…; main certified; NOT deployed; T14F not started)

- PR #23 merged (normal merge, remediated head `ba1a45d4…`); main CI green; 169/3889; app tree preserved. Release still
  `rel-1a047444a3632771` 71/0; 35 migrations / no 0036; no real recipes. Production still `4ed98514…` / 0034 / static.
  Receipt `docs/ai/recipe-catalog/T14E_MERGE_RECEIPT.md`; T14F only from `T14E_FINAL_CANONICAL_MAIN` per `T14E_NEXT_HANDOFF.md`.

## T14E — REMEDIATION — 2026-09-17 (review P1/P2/P3 closed; PR #23 ready for re-review, unmerged)

- Nutrition evidence preserved end-to-end (ADR-004 `nutrition_profiles` persistence), immutable batch hash covers all reviewed
  metadata, manifest failure telemetry corrected. No 0036, no real recipes, no production action.

## T14E — BULK RECIPE IMPORT FACTORY — 2026-09-17 (development complete on feature branch; PR unmerged)

- Import factory (`packages/recipes/src/import/`), CLI, 71-recipe Catalog Release Manifest, manifest-driven D1 readiness
  (ALL_RECIPES stays the 71 rollback baseline). No 0036, no real recipes, no production action, T14F not started.
  Docs: `docs/ai/recipe-catalog/T14E_BULK_RECIPE_IMPORT_FACTORY.md`, ADR-027, `T14E_NEXT_HANDOFF.md`.

## T14C/T14D OPS — PRODUCTION D1 MIGRATION WORKFLOW — 2026-09-17 (MERGED main 6910a7b4…; awaiting operator dispatch)

- PR #21 merged; main CI green; app tree unchanged. Production still `4ed98514…` / 0034 / static. Operator dispatch inputs in
  `docs/ai/recipe-catalog/T14CD_PRODUCTION_ROLLOUT_HANDOFF.md`. Schema gate fixed to D1's 5-term compound-SELECT limit.

## T14D — RECIPE AUTHORITY CUTOVER — 2026-09-16 (MERGED main bb504cce…; main certified; NOT deployed)

- PR #19 merged; main CI green; 163/3801. Production still `4ed98514…` / 0034 / static — OPS sequence in
  `docs/ai/recipe-catalog/T14D_NEXT_HANDOFF.md`.

## T14D — RECIPE AUTHORITY CUTOVER — 2026-09-16 (development receipt)

- Authority router static|shadow|canary|d1 (fenced), verified D1 snapshot, deterministic canary, config-only rollback;
  no migration. Production still static / 0034. Docs: `docs/ai/recipe-catalog/T14D_RECIPE_AUTHORITY_CUTOVER.md`, ADR-026.

## T14C — RECIPE MEDIA LAYER — 2026-09-16 (MERGED main 3a1e6be6…; production 0035/deploy pending operator)

- PR #17 merged; main CI green; staging auto-deploy green. Production D1 still 0034, Worker still 4ed98514… —
  operator runbook: `docs/ai/recipe-catalog/T14C_MERGE_RECEIPT.md`.

## T14C — RECIPE MEDIA LAYER — 2026-09-16 (development receipt)

- 0035 `recipe_media` + catalog/resolver/route/frontend fallback; 0034 pinned; gates green locally.
- Review remediation: promotion verifies the R2 object (MIME/size/SHA-256) before ready; SQL enforces exact storage key.
- Production still 0034; media population and T14D/T14E deferred. Docs: `docs/ai/recipe-catalog/T14C_RECIPE_MEDIA_LAYER.md`.

## T14B-B — COMPLETE 2026-09-16 (D1 0034 in production; Worker `56979cb5-…` = main `4ed98514…`)

- Ledger 33→34 after backup; catalog certified; schema gate PASS; Deploy 35101845374 (staging) and
  35102115354 (production) SUCCESS; smoke green. Details: `docs/ai/recipe-catalog/T14B_B_FINAL_COMPLETION.md`.
- T14C ready to start (`docs/ai/recipe-catalog/T14C_HANDOFF.md`, branch `feat/t14c-recipe-media-layer`).

## T14B-B — MERGED TO MAIN 2026-09-16; PRODUCTION ROLLOUT BLOCKED (OPS SECRET) — historical

- PR #14 merged as `c7455160`; main CI green; fresh main gates green (157 files / 3704 tests).
- Blocked on OPS: production D1 0034 apply + Cloudflare deploy secrets (`CLOUDFLARE_API_TOKEN` missing
  in GitHub staging env; Deploy run 35073197948 failed there). Production app unchanged.
- T14C not started. Receipt: `docs/ai/recipe-catalog/T14B_B_MERGE_RECEIPT.md`.

## T14B-B — MERGED TO MAIN 2026-09-16; PRODUCTION ROLLOUT BLOCKED (OPS SECRET)

## T14B-B — D1 CATALOG PARITY & SHADOW FOUNDATION — 2026-09-16 (merged; details)

- Migration `0034_global_recipe_catalog_parity.sql`: 12 global recipes persisted, D1 = 71
  complete, `recipe_runtime_fields` (persisted `runtime_order`, typed open `category`, closed
  `region`, legacy nutrition) + `recipe_runtime_ingredient_order` added; `0001–0033` unchanged
  (fixed hash manifest).
- D1 → `RuntimeRecipe` hydration is lossless and order-preserving for all 71; recommendation,
  tie-sensitive ranking, planner (incl. tie fixture), >5-alternative swap and cooking parity
  proved on the actual D1 catalog output. **`ALL_RECIPES` remains production authority**; shadow
  mode is opt-in and production-rejected. Media → T14C; cutover → T14D; bulk import → T14E.
- Gates: lint, typecheck, build, `migration-smoke=ok`, seed check, full Vitest (totals in
  `docs/ai/recipe-catalog/T14B_B_REMEDIATION_HANDOFF.md` §10); PR #14 not merged.
- Details: `docs/ai/recipe-catalog/T14B_B_D1_PARITY_SHADOW.md`, ADR-024.

## Auth/OCR production hardening — 2026-09-16

- [done] Remove the credential-less Google production fallback.
- [done] Harden async GIS initialization and retry/unavailable UX.
- [done] Add staged OCR pending UI to upload and review screens.
- [done] Focused `54/54`, full Vitest `3632/3632`, lint, typecheck,
  migration smoke, build and diff check pass.
- [next] Browser smoke, hosted CI and maintainer review; no deployment yet.

## 2026-09-16 auth popup follow-up

- [done] Fix COOP precedence that broke Google GIS popup opener handshake.
- [done] Preserve strict `same-origin` on API responses.
- [done] Add SPA/API regression test; focused `17/17`, lint and typecheck pass.
- [done] Publish PR #9 and deploy Worker version
  `20bc1f35-6ffe-4085-ba79-d54a0b53da71`.
- [done] Production smoke, readiness and live SPA/API COOP checks pass; no
  migration or production data resource was mutated.

## CURRENT — T14 integration refresh, 2026-09-15 UTC

- `vn-clo/Frigo-dev` (ID `1368281478`), verified main before this docs-only receipt
  `a165474a623a8130c9a9ed4f1df096b3ac3b3ae9`; final tip is in its PR post-merge comment.
- PR #9 Auth/OCR production lineage `911db7f`; Worker version
  `20bc1f35-6ffe-4085-ba79-d54a0b53da71`; PR #10 rollout receipt preserved.
- T14A merged via PR #11 after exact-head CI `35034318031` passed. Accepted
  T14B-A merged via PR #12 after exact-head CI `35035112092` and all fresh local
  gates passed (154 files / 3676 tests). T14B-B NOT STARTED; prerequisites ready.
  Static authority 71/59/12,
  migrations 0001–0033 unchanged; media deferred to T14C.
- Main CI passed; Deploy staging missing-token blocker is separate OPS work.
- PR #4: CLOSE_ARCHIVE recommended, not merged or deleted.
- Exact evidence and next action: `docs/ai/recipe-catalog/T14_INTEGRATION_REFRESH.md`.

# Historical boards — superseded by the current refresh above

## CANONICAL REPOSITORY CONSOLIDATION COMPLETE — 2026-09-15

- `vn-dlo/Frigo-dev` (ID `1368281478`) is now the canonical long-term
  repository. PR #2 merged reviewed head `7ede92c` into `main` as merge commit
  `a5cfb14cfd5840be23eb16b26a3689f5e2d6e805`.
- Merge tree equals the reviewed tree; application freeze `5f6853d`, production
  `05423f2`, Qwen `da41686`, T13 `32ddbb4`, and Takosan `ff63edf` remain
  ancestors of canonical main.
- PR CI `34972891435` and post-merge CI `34973522150` passed. Strict `validate`,
  force-push/deletion blocks, and admin enforcement remain active.
- No staging or production deployment occurred. Production migration/D1/KV/R2/
  queue/PayOS/DNS/T14 work remains blocked and out of scope.

## T13R CERTIFIED — 2026-09-14

- **T13 REMEDIATION CERTIFIED — READY FOR INDEPENDENT FINAL REVIEW #2.**
  `T13R_APPLICATION_FREEZE=32ddbb4f2bb636fdcf201e9ca99c4689d3655477` on
  `hoplite/delos-f0bb1d04` (repo ID 1368281478; main `d1b06732…` unchanged).
- Pre-freeze and clean-detached gates: full Vitest 3471/138, focused T13R-A 45/5,
  T13R-B 171/7, real local D1 92/5, browser 60/60 (360/390/430), 32 migrations
  (0031/0032 unchanged, 0033 absent), fresh + legacy real D1 replay, schema gate,
  writer/reader UNKNOWN 0/0, diff-check, detached porcelain EMPTY. No hosted CI for
  the exact freeze. P0/P1/blocking P2 = 0/0/0; AC1–AC14 PASS; roadmap rows DONE.
- Next and only step: INDEPENDENT T13 FINAL REVIEW #2. See
  `docs/ai/inventory-truth/t13/T13R_FINAL_CERTIFICATION.md`.

## SAFE STOP — T13R-B — 2026-09-13T21:35Z

- P2-1 FIXED (commit `4d587eb`), P2-4/P2-5/P2-6 FIXED in WIP `7e68e3b`
  (unit + integration + 12/12 t13r-b-presentation browser cases GREEN at
  360/390/430; full Playwright suite 51 passed; typecheck PASS).
- Certification (full Vitest, build, migrations, D1, authority audit,
  freeze) NOT started. Next: resume certification per
  `docs/ai/inventory-truth/t13/T13R_B_REMEDIATION.md`.
## Production rollout receipt — 2026-09-15

- Production D1 `frigo-db`: migrations `0001`-`0033`, remote schema gate PASS.
- Deployed compatibility SHA `64ee9ed1`; deployed canonical SHA
  `e6b91956484589c088e6d04a9835b3e59a2eb786`.
- Readiness exact-SHA PASS; DB/queue/AI/config healthy, PLUS-grant warning only.
- Full Vitest `3630/3630`, lint/typecheck/build and frozen install PASS.
- Follow-up blocked on hosted CI/review for open PR #4; no protection bypass.
