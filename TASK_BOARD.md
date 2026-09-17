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
