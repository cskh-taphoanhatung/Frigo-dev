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
