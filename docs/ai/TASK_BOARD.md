# Frigo / Takosan current task board — 2026-09-19

## Current T17 — Takosan UI V2 redesign — `T17_PARTIAL` (2026-09-19)

- [done] Baseline gates on live main `769d08597563f816ef9c1dd9523fdafb687de3e2`: lint, typecheck, vitest 178 files / 4046 tests, migration smoke (sqlite3 CLI installed per repo setup), build — all PASS; branch `feat/t17-takosan-ui-v2` created; `main` untouched.
- [done] Audit recorded in `docs/ai/T17_UI_V2_AUDIT.md` (routes, migration map, Frigo leaks, phone wrappers, Week/Planner + settings + notification overlap, fake-flow survey).
- [done] Semantic design system: `--semantic-*` tokens + tailwind `semantic-*` family, kit type/radius/shadow scales, `motion@13.4.0` with reduced-motion provider, shared primitives (Page/PageHeader/Switch/SettingsRow/StatusBadge/UnavailableState/…).
- [done] AppShell V2: bottom nav / 80px rail / 256px sidebar from one navigation model, immersive-only hiding, real links + `aria-current`; legacy `BottomNav` retired with migrated equivalent test.
- [done] Settings IA split (screens 19-26) on real server contracts; inbox/preferences separated; fabricated household invite/join/QR and privacy export/delete fakes replaced with honest unavailable states.
- [done] Planner canonical (flag-gated) with param-preserving Week redirects; onboarding step routes; phone-width emulation removed from 20+ shell pages; fixed CTAs clear the nav/rail/sidebar; Landing/Auth h1 fixes.
- [done] Brand cleanup: zero `emerald-*`, zero user-visible "Frigo Plus"; VietQRModal copy rebranded presentation-only.
- [done] Gates after implementation: lint PASS, typecheck PASS, `pnpm test` 178/4046 PASS, `pnpm check:migrations` PASS, `pnpm build` PASS, T17 Playwright **33/33 PASS** at 390/768/1440.
- [done] PayOS/payment zero application change certified: `git diff 769d085 -- src/worker` empty; payment path diff presentation-only.
- [limit] `T17_COMPLETE` not claimed. Remaining: AuthPage (930 lines) decomposition, per-screen motion/semantic-token migration, visual matrix at 360/430/1024 + state classes + canonical screenshots, full a11y pass. Exact list in `docs/ai/T17_UI_V2_REPORT.md`.
- [safety] No merge, deploy, D1/migration, PayOS, Inventory Truth, OCR/AI, recipe-authority, or planning-algorithm change. Production untouched.

### T17 continuation 2 (same day)

- [done] AuthPage decomposed into `features/auth/*` components with mode-presence transition; security semantics byte-compatible (Turnstile single-use tokens, GSI retry/width, DEC-012 deferred transfer, private-session capture); auth suites **11/11 PASS**.
- [done] No-op animation utilities retired (zero `animate-in`/`zoom-in-95`/`slide-in-from-*` remain); overlay/toast/step entrances now use reduced-motion-safe utilities.
- [done] T17 visual suite extended to all six certification widths; canonical screenshots of 17 surfaces captured at 390/768/1440; destructive-dialog focus and empty-inbox honesty asserted.
- [done] Real 360px `/shopping` horizontal overflow found by the matrix and fixed (`min-w-0` on quick-add controls).
- [done] Gates after continuation: lint PASS, typecheck PASS, vitest **178/4046 PASS**, migration smoke PASS, build PASS, T17 Playwright **42/42 PASS** at certified widths (full matrix green).
- [limit] Still `T17_PARTIAL`: per-screen `transition-all`/motion-primitive migration, semantic-token migration of legacy-styled pages (Home/Inventory/Recipes/Week fallbacks/scan/cooking), partial state-class matrix, and human design review of screenshots.
- [safety] Worker/PayOS diff zero; `main` untouched; production untouched.

### T17 continuation 3 (same day)

- [done] All 86 `transition-all` utilities replaced with the scoped `transition-tap` token (explicit property list; zero remain).
- [done] Motion stories: cooking-step directional Slide, inventory AnimatePresence/layout keyed by server identity, scan crossfade verified reduced-motion-safe.
- [done] State-class matrix: bottom sheet, honest offline banner (browser events), 200% text zoom survival added to the T17 suite.
- [done] Real 200% zoom overflow defects found and fixed (nav min-content, Profile/Home truncation, RecipeCard/IngredientRow wrapping, inventory search `min-w-0`); probed clean at 390/360 desktop + mobile emulation.
- [done] Gates: lint PASS, typecheck PASS, vitest 178/4046 PASS, migration smoke PASS, build PASS; T17 matrix green (two test-code defects fixed test-only and re-verified 12/12 at all six widths).
- [limit] Still `T17_PARTIAL`: 856 `slate-*` sites on legacy pages (kit permits `takosan-*` brand aliases), human screenshot review pending, T13 Playwright suite never run in this environment.
- [safety] No product-code change after the full-suite run; worker/PayOS diff zero; production untouched.

### T17 continuation 4 — full-diff code review (same day)

### T17 continuation 5 — release preparation (same day)

- [done] P1: kebab-case Tailwind `semantic` keys — 25/28 semantic utilities were compiling to nothing; guard test added; built-CSS audit 28/28.
- [done] Fresh canonical screenshots at 390/768/1440 inspected; T17 suite 51/51 at those widths; vitest 178/4047; lint/typecheck/build PASS.
- [done] PR opened `feat/t17-takosan-ui-v2 → main` with verification evidence; CI hosted tracked.
- [operator] Merge → main CI → staging auto-deploy → manual production dispatch (`DEPLOYMENT.md` §Production gate). Agent does not deploy (rule 19).

- [done] 4b second pass: FoodPreferences no longer flips onboarding client-side; per-nav indicator `layoutId`; dev-OTP autofill is a `<button>`.
- [done] First local T13 Playwright run: 54/60 → **60/60** (logout test target `/profile`→`/me`; presentation test's fake-onboarding shim replaced by the real flow — pre-existing failure confirmed on base).
- [done] Full T17 matrix: 360 16/16; other widths 82 pass + 2 by-design skips; one test-only `networkidle` stall fixed and re-verified 12/12 at all six widths.

- [done] Reviewed all 76 changed files against base `769d085` for routing, tenancy, honesty, a11y, motion and fixed-layer defects.
- [done] Fixed P1: unscoped query keys on new settings pages (tenancy leak risk) → scoped `queryKeys` + invalidate-after-write; offline planning save falsely reporting success → pending-sync state; offline planning read hanging → unavailable state.
- [done] Fixed P2: TopBar hub detection/legacy nav targets; `/scan/*` review workspaces wrongly immersive + ReceiptReview CTA/nav collision; auth label/OTP/reveal/autocomplete a11y; Switch `aria-describedby` + transform thumb; BottomCTA/StickyActions under the mobile nav.
- [done] Fixed P3: fabricated household status badge; inventory row enter/exit motion. Test-only: screenshot spec `networkidle` stall.
- [done] Gates: lint PASS, typecheck PASS, vitest 178/4046 PASS, migrations PASS, build PASS, focused UI/auth 65/65, T17 regressions re-verified 6/6. Worker diff 0.
- [limit] Still `T17_PARTIAL`: 856 `slate-*` sites, human screenshot review, T13 Playwright local run.

## Current T16 follow-up — PWA cache and Google recovery deployed (2026-09-19)

- [done] Confirmed live `/auth` and `/sw.js` were edge-cache hits and production still served fixed cache `takosan-pwa-v2`; repository path mismatch was `/sw.js` registration versus `/service-worker.js` header rule.
- [done] Added release-SHA Service Worker cache/version injection, SHA-qualified registration with bypassed update cache, load/online/foreground checks, prior-release eviction, best-effort one-time navigation of stale open clients after claim, and fetch-lifetime-safe cache writes.
- [done] Corrected effective cache policy: HTML and `/sw.js` no-store; hashed `/assets/*` explicitly unsets the global header and is one-year immutable; manifest retains its intended one-hour policy.
- [done] Hardened Google GIS rendering with a numeric clamped width and an explicit retry-script failure/referrer path; added blocked-script -> successful-retry coverage.
- [done] Extended protected deploy smoke to wait for exact-SHA readiness first, then verify `/auth`, `/sw.js`, hashed-asset cache headers and the exact SHA embedded in `sw.js`.
- [done] Independent release review findings were remediated. Local Wrangler effective-header check passed; two-release Chromium check showed no extra clean-install document request and exactly one update navigation, new controller/cache only.
- [limit] Closed, suspended, or browser-blocked legacy tabs cannot be forced by a deployment; reload/reopen/navigation is the reliable recovery boundary. Awaiting same-client navigation during activation was rejected because it deadlocks the document fetch.
- [done] Gates PASS: focused **116 tests / 3 files**, full **178 files / 4046 tests**, lint, typecheck, migration smoke, production build, shell syntax and diff check.
- [done] PR #42 head `54dd81b...` passed CI `35415335137`, merged as main `6a016f1...`; exact-main CI `35415536459` and staging Deploy `35415763483` passed.
- [done] Protected production Deploy `35415843682` passed on Worker `2f228dc9-d97b-4eb1-8cff-9a0f2df3b51c`, D1 38/0038, recipe `shadow/0/false`.
- [done] Live verification: exact readiness SHA, `/auth` and `/sw.js` no-store, exact SHA embedded in the worker, hashed asset immutable, clean Google popup, exact-SHA controller and sole matching cache.
- [pending] Manual real-inbox OTP receipt only; do not record or expose the OTP value.
- [safety] No migration, D1/R2/customer-data mutation, PayOS/payment change, Canary activation, full D1 cutover, Inventory Truth change or Week change.

## Current T15C-D — production 1% Canary certification — safe stop (2026-09-19)

- [done] Resolved repository ID `1368281478`, fetched exact main `347b536950cf54d25a2d6a880c3c2cb3d8c8f329`, verified clean tree and merged PR #38/#39, and created `codex/t15c-production-canary-1pct` from canonical main.
- [done] Verified exact-main CI `35409762462` and automatic staging Deploy `35409964105`: SUCCESS, staging `static/0/false`, production SKIPPED.
- [done] Fresh baseline PASS: frozen install, recipe seed/import, typecheck, lint, migrations through 0038, build, full Vitest **178 files / 4044 tests**, diff check.
- [done] Public production audit: Worker `6c336889-680d-4cc3-b03b-1007849aa738` / SHA `b41aa468...`; readiness config-valid, DB/queue/email OK; recipe authority receipt `shadow/0/false`; 5/5 lists = 71 and D1-only samples remain 404.
- [blocked] Mandatory operator-owned INCLUDE + EXCLUDE household pair was not supplied. Local Wrangler is unauthenticated, so the fresh direct D1/tail certification and cohort secret provisioning are unavailable. No customer IDs were inspected and no production mutation occurred.
- [status] `T15C_D_BLOCKED_AUTHORIZED_TEST_HOUSEHOLDS_UNAVAILABLE`; final production remains `shadow/0/false`. Receipt: `docs/ai/recipe-catalog/T15C_D_PRODUCTION_1PCT_CANARY_CERTIFICATION.md`.
- [done] Receipt commit `16958c6...` passed CI `35410893001`; PR #40 merged as `763d7e9...`; exact-main CI `35411093064` and automatic staging Deploy `35411300235` passed with `static/0/false` and production skipped.
- [next] Supply both authorized household IDs privately and authenticate the Cloudflare operator session; then repeat D1 certification, provision hashed secrets, prove retained-secret Shadow, run only 1% protected Canary, certify both cohorts/E2E, and rollback to Shadow. No 2%, 5%, full D1, media, or T14G.

## Current T15C-C — authorized canary test cohort mechanism (dormant) — 2026-09-19

- [done] `packages/recipes/src/recipe-canary-cohort.ts` + `src/worker/services/recipe-authority.ts`: server-side override for operator-owned test households — `RECIPE_CATALOG_TEST_COHORT_ENABLED` / `RECIPE_CATALOG_TEST_INCLUDE` / `RECIPE_CATALOG_TEST_EXCLUDE` (Worker secrets; SHA-256 digests of `recipe-catalog-test-cohort:<householdId>`, never raw IDs). Precedence exclude > include > deterministic FNV bucket; disabled by default; canary+cutover only; zero effect in static/shadow/d1 or without a tenant; every malformed/half-applied shape fails closed in canary mode (`CONFIG_RECIPE_CATALOG_TEST_COHORT` fatal; static + loud diagnostic at request time). **R1 remediation:** cohort variables are inert in static/shadow/d1 (rollback = single mode change, no secret cleanup — P1 resolved) and an active cohort requires BOTH an include and an exclude household (`TEST_COHORT_PAIR_REQUIRED` — P2 resolved). Request input cannot reach it. `fnv1a32`/`recipeCanaryBucket`/thresholds unchanged.
- [done] Tests: 25 unit + 4 HTTP (request-control attempts, guest, static/shadow) + workflow/wrangler/manifest guardrail; no migration, no workflow change.
- [status] `T15C_AUTHORIZED_TEST_COHORT_READY` — NOT `T15C_CANARY_COMPLETE`. Production still `shadow / 0 / false`; no deploy/config/D1/R2 change. Receipt: `docs/ai/recipe-catalog/T15C_AUTHORIZED_TEST_COHORT.md`. Previous safe stops (T15C-B, `T15C_PRODUCTION_CANARY_SAFE_STOP.md`) remain valid history.
- [next] Operator supplies the two authorized households → digests as production secrets → T15C-B 1% canary through the protected workflow (separate authorization).
## Current T15C — production Canary safe stop (authorized cohort unavailable) — 2026-09-18

- [done] Fresh audit on canonical main `b41aa4682481447795350fc1a9eeb1e80887bd0e` (resolved by repository ID 1368281478): seed/import/typecheck/lint/check:migrations(0038)/build PASS; full `pnpm test` 176 files / 4008 tests PASS.
- [done] Read-only public production audit: readiness commit == main `b41aa468…`, database ok, 5/5 catalog reads = 71 deterministic, legacy IDs 200, D1-only IDs 404. Latest production Deploy receipt 35404106102 = `shadow / 0 / false` on that exact SHA (helper convergence 2 attempts).
- [stop] No operator-owned inside-1%/outside-1% production test cohort and no Cloudflare credentials in this environment; no customer IDs inspected; no dispatch/approval/D1/R2/config change. Classification `T15C_CANARY_BLOCKED_AUTHORIZED_COHORT_UNAVAILABLE`. Receipt: `docs/ai/recipe-catalog/T15C_PRODUCTION_CANARY_SAFE_STOP.md`.
- [next] Operator provides both authorized cohorts + read-only CF credentials + Environment reviewer; resume at exactly 1% via the protected `deploy.yml`; no widening beyond the 1→2→5 ladder, no `d1`, no media/R2, no T14G.

## Current T16 follow-up — OTP sender and guest account gate release candidate — 2026-09-19

- [done] Reproduced the production email-provider failure through the real Cloudflare Email Service binding: sender `no-reply@frigo.tungjpstore.net` is unauthorized because the subdomain is not onboarded separately.
- [done] Proved the onboarded apex sender path: `no-reply@tungjpstore.net` was accepted by the same binding and returned a provider `messageId`; real OTP inbox receipt remains pending.
- [done] Changed the transactional sender to the onboarded apex and sanitized the known provider error as `sender_not_verified`; no recipient, OTP, subject, or provider exception text is retained in logs.
- [done] Hardened resend: optional KV cooldown failure no longer blocks recovery, failed delivery clears the cooldown best-effort, unexpected failures return `503 OTP_RESEND_UNAVAILABLE`, and the frontend requires a fresh Turnstile token for each resend.
- [done] Added guest account gates: guest `/plus` hides prices and payment UI, presents an explicit login CTA, and preserves `/plus` through a safe local `returnTo`; the guest profile upgrade CTA points to the same auth flow.
- [done] Preserved authenticated Plus behavior and left PayOS, billing, checkout, payment webhooks and settlement untouched.
- [done] Added regression coverage for the apex sender, provider-error sanitization, KV outage, Turnstile token renewal, guest Plus gate, guest profile CTA, and authenticated Plus visibility.
- [done] Application/test checkpoint committed as `31006994849ee9f6d78ae6114f82d77d41efc784`.
- [done] Local gates: focused **86 tests / 4 files**, full `pnpm test` **176 files / 4008 tests**, lint, typecheck, migration smoke, build and diff check PASS.
- [done] Browser checks at 390x844 and 1440x1000: guest pricing/payment absent, auth CTA correct, auth accessible to guests, `returnTo=%2Fplus` retained, authenticated prices unchanged.
- [pending] Commit/push, exact-head hosted CI, merge, exact-main CI, and protected production deploy with recipe authority fixed at `shadow/0/false`.
- [pending] After deploy, perform one normal-browser OTP request/resend and confirm actual email receipt without exposing the code. Provider acceptance alone is not delivery certification.
- [safety] No migration, D1 write, recipe authority/canary change, Inventory Truth change, Week change, or production infrastructure redesign.

## Current T16 — production + CSP hotfix deployed; OTP receipt pending — 2026-09-19

- [done] Replaced the landing/auth/onboarding loop with one funnel: guest or account on landing; returning accounts enter the app; new accounts complete three preference-only steps once.
- [done] Added migration `0038_auth_onboarding_completion.sql`; `/me` and auth responses expose server-authoritative onboarding state; preferences and completion persist in one D1 batch.
- [done] Migrated OTP delivery to structured Cloudflare Email Service with Resend fallback, sanitized errors, honest 503 responses, and production invalidation of undelivered OTPs.
- [done] Unified Google client ID through `/config` and backend audience validation; retained signed-credential-only production auth and added a real GIS reload state.
- [done] Added/updated auth, email, migration, and UI tests. Full gates pass: lint, typecheck, migration smoke, build, **174 files / 4002 tests**, seed/import checks, local schema gate through 0038, diff check.
- [done with limits] Browser-sized pass at 390x844 and 1440x900 verified landing, three onboarding steps, offline guest completion, registration query entry, and no horizontal overflow. Local GIS reached Google but loopback origin is not authorized; Vite proxy mutation CSRF cannot represent the deployed same-origin path, while direct Worker and integration checks pass.
- [known audit debt] UX audit remains repo-wide FAIL: repository 19 issues / 686 warnings / 47 passed; `src/web/pages` 6 unrelated existing issues / 303 warnings / 15 passed. No T16 landing/auth/onboarding blocker was reported by the audit.
- [done] PR #34 merged as main `d6c981b1a67001b807f03166109f661bc753728c`; PR CI `35385363064` and exact-main CI `35385844667` succeeded.
- [done] Production D1 run `35386276549` applied 0038 only; ledger 38/tip 0038, bookmark `000000d3-00000000-000050ea-709daab542439d8e8fab731b65dab714`, FK/quick-check/drift/media/catalog gates passed.
- [done] Production Deploy `35386532369` succeeded on Worker `c0161a22-1987-42dd-99c4-0a5874d4fadb`, exact main SHA, with recipe authority preserved at `shadow/0/false`; rollback Worker is `c6fa2ce8-f35b-4485-ad38-09dbc19738d1`.
- [done] Production browser smoke at mobile/desktop passed landing, Google provider launch, guest session, reload-safe onboarding, preference persistence, cookie security, and responsive width.
- [done] CSP hotfix `79dfca6483d90fcf33380acfe33f880c1e6ff7a5` permits only the observed Google Fonts/GSI and Cloudflare Insights origins; no wildcard or script `unsafe-inline`. Full local gates remain 174 files / 4002 tests plus focused CSP 3/3.
- [done] PR #35 head `c14a3755d95ddae316d5e6636ef85f9784ac4a54` passed CI `35388666150`, merged as `0cb5d2c08fa24479ecce6b4c4e5f73b31a920ff5`, and exact-main CI `35388963509` passed.
- [done] Production hotfix Deploy `35389274233` succeeded on Worker `e8164168-9566-475b-b0fa-7508368bf3e7`; exact SHA and `shadow/0/false` verified, D1 stayed at 38/0038, and previous Worker `c0161a22-1987-42dd-99c4-0a5874d4fadb` remains the rollback reference.
- [done with limit] Independent mobile/desktop verification found no CSP console violations, loaded Google fonts/GSI, one Google frame, no overflow, and 71 Shadow/static recipes. Cloudflare Insights was policy-allowed but unreachable from the verification network.
- [limit] Real OTP receipt is not certified: automated headed/headless Chrome displayed Turnstile but did not yield a token, no forgot-password request was sent, and the existing account prevents using that address as a new-registration proof.
- [next] In a normal user browser, complete Turnstile on Forgot password for the existing account, submit once, and confirm message receipt without sharing or logging the OTP. No code/deploy action is otherwise pending.

## Current T15C-B — merged control plane; safe stop before production Canary — 2026-09-18

- [done] Merged PR #32 with expected head `a7b3d23f2ad8b48203328116d0e35425390d2127` as `a6e81cd89b9e4c6b923cfc39947b01faf44ff5f3`; PR head ancestor and tree delta 0 files.
- [done] Exact-head PR CI `35344089103` SUCCESS; unresolved review threads `0`; exact-main CI `35347246583` / job `105606601599` SUCCESS.
- [done] Automatic Deploy `35347579284`: release/staging SUCCESS, production SKIPPED; staging Worker `12623f3b-ac64-4255-9fbf-c429b6225e1d`, exact merge SHA, `static/0/false`.
- [done] Read-only production recheck: Shadow/static Worker `c6fa2ce8-f35b-4485-ad38-09dbc19738d1`, SHA `88e8b54d…`, five 71-count checks, legacy 200, reviewed D1-only 404; D1 500 READY.
- [stop] No authorized operator-owned inside/outside 1% cohorts were available; no customer households were inspected and no Canary dispatch/approval was attempted. Classification `T15C_B_AUTHORIZED_TEST_COHORT_UNAVAILABLE`.
- [next] Operator must provide both authorized cohorts. Resume only with exactly 1%; do not widen, enable full D1, populate media/R2, start T14G, or touch Inventory Truth/T09/T11/PayOS/auth. Receipt: `docs/ai/recipe-catalog/T15C_B_AUTHORIZED_COHORT_SAFE_STOP.md`.

## Current T15C-A — bounded canary control plane — 2026-09-18

- [done] Re-verified repository `1368281478` / `frigo-6/Frigo-dev`, main `88e8b54d…`, PR #31 exact head and docs-only tree; exact-head CI `35338372250` SUCCESS.
- [done] Merged PR #31 with expected-head guard as `6f589d0201499a3729d343e42ccb6d19fdff217a`; post-merge CI `35340599941` SUCCESS.
- [done] Automatic Deploy `35340976739`: release/staging SUCCESS, production SKIPPED; automatic staging policy remained STATIC.
- [done] Closed PR #29 without merge with supersession comment.
- [done] Audited existing runtime canary: deterministic household FNV-1a assignment, readiness-gated D1, static fallback, 30s TTL / 5m stale grace; runtime left unchanged.
- [done] Branch `codex/t15c-canary-control-plane` from certified main; implemented bounded `static|shadow|canary` release policy, 0/1/2/5 choices, derived cutover, immutable manifest fields, and validated Wrangler propagation.
- [done] Focused 121/121; full 173 files / 3995 tests; seed/import/lint/typecheck/check:migrations/build/diff-check PASS. No migration or production action.
- [done] Opened Canary wiring PR #32; implementation/receipt head `44c1e80b…` and later docs checkpoint `642b4f8b…` each passed exact-head CI. The authoritative final head/CI receipt is posted on the PR after the last docs commit because a commit cannot contain its own hash.
- [in review] PR #32 remains OPEN; require the PR receipt to show final exact-head CI SUCCESS and zero unresolved review threads, then stop for independent review. Do not merge or activate canary.

## Current T15B-SHADOW — production Shadow certified; stop before canary — 2026-09-18

- [done] PR #30 merged as `88e8b54de121125866b2ff813e56e33277decf1c`; PR head `ad3e1d1656418aaf495b130443d6514926b8bdca` is an ancestor and tree delta is 0 files. Exact-main CI `35336548833` SUCCESS.
- [done] Automatic staging Deploy `35336830786` SUCCESS: staging Worker `580acb76-a006-4c0a-b991-618ebde07e88`, STATIC authority, exact SHA, 71 recipes; production skipped.
- [done] Production Shadow Deploy `35337110268` SUCCESS: release `105574386006`, production `105574426707`, required Environment approval, Worker `c6fa2ce8-f35b-4485-ad38-09dbc19738d1`, exact-SHA convergence 1 attempt / 574 ms.
- [done] Live Shadow certification: 5/5 catalog reads served 71, legacy IDs 200, five D1-only IDs 404; tail diagnostics show Shadow/static, D1 500 hydrated, release `rel-bd00a4f53fcaeee4`, readiness `ready`, zero drift/order/hydration errors, zero Shadow errors.
- [done] Durable receipt added at `docs/ai/recipe-catalog/T15B_SHADOW_CERTIFICATION.md`; rollback Worker `ab8ff038-2aaa-468b-a9de-8c5d94f14052` retained and static config rollback documented.
- [stop] Do not enable canary/full D1/cutover, write media/R2, start T14G, alter Inventory Truth/T09/T11, or merge stale PR #29. Classification `T15B_SHADOW_COMPLETE`.

## Previous T15B-PRE checkpoint — STATIC certified; SHADOW wiring PR ready — superseded 2026-09-18

- [done] Re-verified canonical repository `1368281478` / `frigo-6/Frigo-dev`, main `0fe2cf071693208f6c642d8cbd994f5a79b5a2cf`, and PR #29 remained unmerged.
- [done] Re-read immutable migration receipt run `35329772751`: D1 tip 0037, 500 catalog, release `rel-bd00a4f53fcaeee4`, schema gate PASS, FK `[]`, quick check `ok`, media 500 pending/0 ready.
- [done] Static production Deploy `35333517052`: required reviewer approval, production SUCCESS, Worker `ab8ff038-2aaa-468b-a9de-8c5d94f14052`, exact SHA convergence PASS, live user-facing count 71 across five repeated checks.
- [done] Rollback evidence retained: previous Worker `56979cb5-e1a8-4241-8a4c-2432d41cc439`; rollback contract is `RECIPE_CATALOG_MODE=static`.
- [ready for review] No approved existing Shadow config path was present. PR #30 adds minimal `static|shadow` workflow/config plumbing and tests; implementation head `97aff50d…` exact CI `35335079345` SUCCESS. Require independent review and final docs-head CI. Do not merge or activate in this task.
- [not started] Shadow activation/certification, canary, full D1, media/R2, T14G. T09/T11 and Inventory Truth unchanged.

## Current T14F — T14F_DEVELOPMENT_COMPLETE (T14F-A/B/C certified; production untouched)

- [done] T14F-C: 0037 promoted byte-identical (`68e52e6d…`; 0036 `04228788…` unchanged), shipped manifest 500 / 2 batches (`rel-bd00a4f53fcaeee4`), `ALL_RECIPES` 71.
- [done] Replay fresh 0001→0037 / 0036→0037 / 0034→…→0037 PASS; D1 readiness READY 500; static/shadow/canary/full-D1 PASS; reader 5 statements, no N+1; user flows incl. Batch B VN/CN/JP/KR/TH/IT PASS; T09/T11 unchanged.
- [done] Closure gates (safe stop `44c0ad38…` resolved): lint, build, full test **171 files / 3913 tests**, typecheck, migration smoke, seed/import checks, diff check — PASS.
- [done] Closure blocker fixed forward-only `8c6080aa…` (tests only): real-D1 suites now recycle workerd before its 1 MiB statement cache overflows on the 0001→0037 replay (cloudflare/workerd#5977). Hosted validate on `44c0ad38…` had failed exactly there.
- [done] Second closure blocker fixed forward-only (test config only): docs-only heads passed 171/3913 on hosted CI but exited 1 on a vitest-worker `onTaskUpdate` birpc timeout starved by long synchronous SqliteD1 suites; `tests/helpers/vitest-event-loop-yield.ts` (setupFiles) yields once per test.
- [done] Hosted exact-final-head validate SUCCESS + `T14F_FINAL_CERTIFIED_HEAD` bound in the PR #25 final certification receipt. PR #25 ready for review, **unmerged**.
- [next] **STOP.** Merge = separate decision after independent review. Production rollout, media population and T14G = separate authorization. Production does not contain 500 recipes.
- [P3] Unpaginated `GET /recipes` ≈ 780 KB at 500 recipes — T14G scope, not release-blocking for development certification.

## Historical T14F — T14F_B_SCALE_BATCH_CERTIFIED

- [done] T14F-A pilot certified at `b0150d0…` (routing fix, 171/3911).
- [done] T14F-B resumed: ingredient preflight + 399-concept matrix committed.
- [done] **399 records authored** (`t14f-scale-399-v1`); factory 399/399 publishable, 0 hard dups, 0 unresolved; QA `ok` 0 findings.
- [done] Deterministic double compile (byte-identical) with hashes; candidate-500 (71+30+399=500) composition verified; shipped 101 manifest + 0036 unchanged; 0037 absent.
- [done] Full gates: seed/import/typecheck/lint/migrations/build/test (171 files / 3911) PASS.
- [next] **T14F-C only under separate authorization**: promote 0037 from the artifact, regenerate shipped 500 manifest, 500-authority certification. Do NOT start here.
- [not started] 0037 promotion, 500 shipped manifest, production/media/T14G. PR #25 draft/unmerged.

- [done] Verified repository ID 1368281478, unchanged main, forward-only branch and inherited
  test-only `8079a37`; PR #25 remains draft/unmerged. Preserved timestamp fix `486409c…`.
- [done] Reproduced 5/7 pre-fix routing failure and strict 71/101 COUNT_DRIFT fallback.
  `2ee6f5cc…` verifies generated legacy release, actual sources/diagnostics, cache and cleanup.
- [done] Routing 8/8, growth 21/21, combined 29/29 twice; non-isolated 29/29; subsystem 383/383.
  Seed/import/typecheck/lint/migration smoke/build/full test/diff PASS: **171 files / 3911 tests**.
- [done] Implementation CI **35223589293 / 105209475052 SUCCESS**. Final exact-head
  [receipt](https://github.com/frigo-4/Frigo-dev/pull/25#issuecomment-5714709031) must bind the
  documentation SHA and hosted SUCCESS before it is accepted as the T14F-B base.
- [done] Pilot 30 / release 101 / static 71 / migrations unchanged; complete 101/order 0..100;
  reader 5/no N+1, imported HTTP flows and inventory regressions PASS.
- [next] **STOP**; await separate T14F-B authorization, using only the final certified SHA.
  Exact commands/hashes and receipt protocol: `recipe-catalog/T14F_NEXT_HANDOFF.md`.
- [not started] Ingredient scale preflight, Batch B 399, 0037, 500 release, media population,
  T14G; no production write/deploy/authority switch. Overall T14F is not complete.

## Historical entries (not current T14F status)

## T14F — WIP safe stop — 2026-09-17 (branch `feat/t14f-recipe-catalog-500`, unpushed→pushed checkpoint; pilot NOT certified)

- [done] Pilot 30 (`t14f-pilot-30-v1`) authored, reviewed, T14E-compiled; `0036` promoted byte-identical;
  manifest 101/1 batch; static 71 unchanged; 0001–0035 untouched.
- [done] Safe-stop verification: typecheck, `check:migrations`, seed check, import check, `git diff --check`
  PASS; handoff `docs/ai/recipe-catalog/T14F_WIP_HANDOFF.md`.
- [open, blocker for pilot certification] focused growth suites 20/21: `production forward path
  0034 → 0035 → growth` fails when both growth suites run together, passes alone — fix test isolation
  WITHOUT regenerating data/0036.
- [not done] lint, build, full `pnpm test`, bundle accounting, pilot QA report, Batch B (399), 0037,
  final 500 manifest, PR. Do NOT merge; do NOT start T14G; no production action.

## T14E — merged + main certified — 2026-09-17 (PR #23 → main `f7a55408…`; production untouched; T14F not started)

- [done] PR #23 merged by normal merge (`f7a5540841db27be31cdab9e0c2010cd92bc3861`); `ba1a45d4…` and `7b4edcc8…` in main ancestry;
  tree delta PR head → main = 0; exact-head main validate SUCCESS (run 35182568280 / job 105077715190).
- [done, fresh on exact merge SHA] install, seed check ×3, import check (71/0), typecheck, lint, `migration-smoke=ok` (35, no 0036),
  build, `pnpm test` 169 files / 3889 tests, focused 88, regression 275 + 160, `git diff --check` clean.
- [done] `recipe-catalog/T14E_MERGE_RECEIPT.md`; `T14E_NEXT_HANDOFF.md` finalized (T14F prerequisites, chunking evaluation, release strategy).
- [not done, by design] 0036, real recipe growth, media population, production D1/R2/deploy, authority activation, T14F.
- [next] T14F starts ONLY from `T14E_FINAL_CANONICAL_MAIN` (docs-closure merge SHA). Production 0035 + T14D deploy still
  `PENDING_OPERATOR` per `recipe-catalog/T14CD_PRODUCTION_ROLLOUT_HANDOFF.md`.

## T14E remediation — 2026-09-17 (P1 nutrition evidence, P2 immutable batch hash, P3 manifest telemetry; PR #23 unmerged)

- [done, local-verified] evidence preserved + persisted as ADR-004 profiles; `canonicalBatchProjection` covers all reviewed metadata;
  `RELEASE_MANIFEST_INVALID` error classification; `tests/unit/recipe-import-provenance.test.ts` (11); 169 files / 3889 tests.
- [next] independent re-review of PR #23 → merge → `T14E_FINAL_CANONICAL_MAIN` → T14F per `recipe-catalog/T14E_NEXT_HANDOFF.md`.

## T14E — Bulk Recipe Import Factory + Release Manifest — 2026-09-17 (development complete; PR open, NOT merged)

- [done, local-verified] import factory module + CLI + output policy; 71-recipe Catalog Release Manifest committed and checked;
  manifest-driven growth-ready readiness (legacy baseline protected); synthetic expanded-release READY proof; 500/5000 scale.
- [not done — by design] 0036, real recipes, media population, production/Cloudflare action, authority activation, T14F.
- [next] independent review of the T14E PR → merge → freeze `T14E_FINAL_CANONICAL_MAIN` → T14F per `recipe-catalog/T14E_NEXT_HANDOFF.md`.
  Production debt unchanged (operator dispatch pending).

## T14C/T14D OPS — Production D1 Migration workflow — 2026-09-17 (MERGED main 6910a7b4…; production NOT yet mutated)

- [done] PR #21: `production-d1-migrate.yml` (manual, fail-closed, production Environment) + `d1-migration-check.mjs` (+17 tests);
  schema gate reduced to 5 compound terms (D1 limit); docs. Exact-head validate SUCCESS (35168563076). App tree unchanged.
- [done] local rehearsal of the full migration path on a fresh local D1 (0034→0035: 71/71/0, FK [], quick_check ok, drift none, gate PASS).
- [blocked — dispatch] operator must dispatch `Production D1 Migration` (ref 6910a7b4…, pre 0034, 0035, confirm=true) then
  `Deploy` production (ref 6910a7b4…, hardened bb504cce…, confirm_production=true). Inputs: `recipe-catalog/T14CD_PRODUCTION_ROLLOUT_HANDOFF.md`.
- [not started] shadow/canary/d1 activation; media population; T14E.

## T14D — Recipe Catalog Authority Cutover — 2026-09-16 (MERGED main bb504cce…; T14D_MAIN_CERTIFIED; rollout DEFERRED)

- [done] PR #19 merged (normal merge, head f2831805… in ancestry); main exact-head CI SUCCESS (35157739716);
  local certification 163/3801; receipt `recipe-catalog/T14D_MERGE_RECEIPT.md`; handoff `T14D_NEXT_HANDOFF.md`.
- [deferred — OPS] 0035 production apply, deploy, shadow → canary → d1 progression (config-only, human-controlled).
- [not started] T14E bulk import; media population.

## T14D — Recipe Catalog Authority Cutover — 2026-09-16 (development receipt; PR #19 — merged, see above)

- [done, local-verified] authority snapshot abstraction + static/D1 providers (T14B-B hydration reused); fingerprint +
  strict readiness; modes static|shadow|canary|d1 with cutover fence; deterministic household canary; bounded cache;
  fallbacks + diagnostics; all runtime readers migrated (unknown = 0, guarded); HTTP parity static/d1/canary.
- [not done — by design] production deploy, enabling shadow/canary/d1 in production, T14C 0035 rollout, T14E, media population.
- [next] Independent review → merge → OPS sequence (0035 → deploy static → shadow → canary → d1, config-only).

## T14C — Recipe Media Layer — 2026-09-16 (MERGED to main 3a1e6be6…; production rollout pending operator)

- [done] PR #17 merged (normal merge, head 7b37325f… in ancestry); main exact-head CI SUCCESS
  (35147336385); local certification 161/3776; automatic staging deploy SUCCESS (35147682739).
- [blocked — credentials] production D1 backup + 0035 apply + production deploy + smoke; runbook in
  `recipe-catalog/T14C_MERGE_RECEIPT.md`. Production remains 0034 / Worker 4ed98514….
- [not started] T14C_FINAL_COMPLETION.md, T14C_NEXT_HANDOFF.md (after rollout); media population; T14D; T14E.

## T14C — Recipe Media Layer — 2026-09-16 (development; PR #17 — merged, see above)

- [done, local-verified] 0035 + `recipe_media` schema/invariants/seed; catalog (no N+1) + resolver;
  secure same-origin media route; additive API `media.hero`; frontend resolver on 7 surfaces;
  schema gate/smoke/seed-check extended; 0034 pinned; ADR-025; design doc.
- [not done — by design] media population (71 assets), global prompts (0/12), thumbnail seeding,
  production 0035 apply, deployment. T14D/T14E not started.
- [done, local-verified] independent-review remediation: R2-verified promotion (existence/MIME/size/SHA-256),
  exact SQL storage-key CHECK, `content_length` required for ready; 0035 regenerated (no 0036).
- [next] Independent re-review of PR #17; then rollout: backup → apply 0035 → deploy → populate separately.

## T14B-B — COMPLETE 2026-09-16 (production D1 0034 applied; Worker deployed)

- [done] Cloudflare identity verified (account `ef250a88…0218`, D1 `frigo-db` `f975ec39-…`); ledger 33→34;
  backup exported (SHA-256 `ab082dd4…343c`); `0034` applied; catalog/ordinal/integrity/schema-gate certified.
- [done] GitHub env secrets `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` (staging+production), production
  required reviewer, `STAGING_URL`/`PRODUCTION_URL` vars; Deploy runs 35101845374 (staging) and
  35102115354 (production) SUCCESS; Worker `56979cb5-…` serves `4ed98514…`; smoke green.
- [not started] T14C recipe media layer — handoff `recipe-catalog/T14C_HANDOFF.md`; branch
  `feat/t14c-recipe-media-layer` from the frozen `T14C_CANONICAL_BASE_MAIN`. T14D/T14E not started.

## T14B-B — MERGED 2026-09-16; production rollout BLOCKED (existing OPS secret)

- [done] PR #14 merged → main `c7455160bfc8d279d38bc7ca4c0751542012a3c5`; main CI validate SUCCESS
  (run 35072991882); fresh main gates green (157 files / 3704 tests). Receipt:
  `recipe-catalog/T14B_B_MERGE_RECEIPT.md`.
- [blocked-OPS] Apply 0034 to production `frigo-db` (`pnpm wrangler d1 migrations apply frigo-db
  --remote` after ledger read + backup), verify 71/71/385 + integrity; set `CLOUDFLARE_API_TOKEN` /
  `CLOUDFLARE_ACCOUNT_ID` in the GitHub staging/production environments; dispatch Deploy. Auto
  Deploy run 35073197948 failed on the missing staging token (not a code failure).
- [not started] T14C handoff/implementation — only after rollout closes. T14D/T14E not started.

## Historical — T14B-B remediation FINAL (review-ready)

- [done, local-verified] Persisted canonical `runtime_order`; explicit ingredient positions
  (`recipe_runtime_ingredient_order`); hydrator/static catalog order parity; shadow `orderDrift`;
  migration fingerprint manifest (`tests/fixtures/migration-sha256.json`, 33/33 pinned from
  `c1c1c14a…`); 0034 re-rendered and adopted (checkpoint `d9130b69…`).
- [done] `recipe-d1-runtime-parity` rewritten on actual `D1RuntimeRecipeCatalog` output (no
  reordering): strict-equal list, recommendation, tie-sensitive ranking, planner tie fixture,
  >5-alternative swap regression + executed swap, shadow health; reversed-catalog negative
  controls; mutation check fails 8/11 with an ID-sorting hydrator (`19b144a5`).
- [done] Docs: category = typed open non-empty string, region = closed vocabulary; ADR-024,
  design doc, handoff, PR #14 body updated.
- [next] Maintainer review + protected merge of PR #14 after fresh exact-head hosted `validate`
  (recorded in the PR body). Do not enable shadow in production; no deploy.
- [not started] T14C media · T14D authority cutover · T14E bulk import.

## T14B-B — D1 catalog parity, runtime view & shadow — 2026-09-16 (READY FOR REVIEW)

- [done] Fresh baseline verified: main `c1c1c14a…`, protected, 33 migrations, 71/59/12, D1 59.
- [done] Goal A: `0034` seeds `gl-01..gl-12` (stable IDs) → D1 complete 71, staticOnly `[]`.
- [done] Goal B: fail-closed `hydrateRuntimeRecipes` → 71 `RuntimeRecipe` strict-equal to static.
- [done] Goal C: `recipe_runtime_fields` (typed category/region, legacy nutrition compat);
  image URL legacy-compat only; steps/tags lossless; provenance legacy/unverified/1.
- [done] Goal D: `compareRuntimeCatalogs` + `RECIPE_CATALOG_MODE=shadow` diagnostics; no d1 mode.
- [done] Goal E: recommendation/planner/regenerate/swap/cooking/snapshot compatibility proved.
- [done] Full gates: lint, typecheck, build, migration smoke, seed check, 157 files / 3697 tests.
- [done] Independent review findings (shadow cost bound, description default, Inventory Truth
  test scope) fixed in `0284a96c`.
- [next] PR #14: exact-head hosted `validate`, maintainer review of ADR-024, protected merge.
- [not started] T14C media · T14D authority cutover · T14E bulk import.

## Current T14 integration refresh — 2026-09-15 UTC

- [done] Canonical main before the final docs-only receipt is
  `a165474a623a8130c9a9ed4f1df096b3ac3b3ae9`, verified in `vn-clo/Frigo-dev`
  (ID `1368281478`). Final tip is recorded in the receipt PR's post-merge comment.
- [done] PR #9 Auth/OCR production merge `911db7f` and PR #10 docs-only
  receipt preserved; deployed Worker recorded as `20bc1f35-6ffe-4085-ba79-d54a0b53da71`.
- [done] PR #9/#10 left recipe architecture and migrations unchanged; this
  integration preserves runtime authority while adding the accepted safety library.
- [done] T14A docs semantically reconciled on current main; fresh frozen install,
  lint, typecheck, test (151 files / 3633 tests), migration smoke, build and diff
  check pass; application diff empty and all 33 migration hashes unchanged.
- [done] T14A exact-head hosted run `35034318031` passed on `e916d292`;
  PR #11 merged normally as `fbd14c771070e1b5594532648d79fb60c891747d`.
- [done] Accepted T14B-A delta from PR #8 reconciled on resulting new main;
  PR #12 exact head `3e393741` passed hosted run `35035112092` and all local
  gates (154 files / 3676 tests), merged as `a165474a` through protected flow.
- [done] All 15 accepted functional paths, PR #9 protected files, 33 migration
  hashes and Inventory Truth authority preserved; renderer leaves tree clean.
- [finalization] Publish this docs-only merge receipt, then record final main /
  `T14B_B_BASE_MAIN` in its post-merge comment. Integration prerequisites ready.
- [done] Preserve Auth/OCR ADR-022; renumber imported recipe ADR to ADR-023
  without changing its accepted architecture.
- [not started] T14B-B. No migration 0034, data parity write or authority switch.
- [deferred] Media to T14C; runtime remains static `ALL_RECIPES` (71/59/12).
- [OPS blocked] Deploy `35035612637`: release success, staging missing-token
  failure, production skipped; main CI `35035415271` passed. Not a T14 regression.
- [historical PR] #4 remains open; recommend CLOSE_ARCHIVE, never merge here.
- Checks and next action: `recipe-catalog/T14_INTEGRATION_REFRESH.md`.

# Historical task boards — superseded as current status

Prior “T14 not started”, production baseline and PR #4 merge recommendations
below are retained historical evidence, not instructions for this integration.

## Auth/OCR production hardening — 2026-09-16

- [done] Remove credential-less Google fallback and keep production sign-in
  bound to a real Google Identity Services credential.
- [done] Make GIS initialization resilient to the async script-load race and
  show an explicit retry/unavailable state.
- [done] Add staged OCR pending UX to upload, fridge review and receipt review
  without changing server status or inventory authority.
- [done] Add auth and scan-processing regression tests; focused `54/54` and
  full `3632/3632` Vitest pass.
- [done] Run lint, typecheck, migration smoke, build and diff check.
- [next] Run browser auth/OCR smoke against the exact PR head, obtain hosted CI
  and review, then decide separately whether a production deploy is authorized.

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

## Auth/OAuth production hardening follow-up (2026-09-16)

- [done] Isolate Safari/Google GIS blank popup to Worker COOP precedence.
- [done] Use `same-origin-allow-popups` for SPA documents and retain
  `same-origin` for `/api/*` responses.
- [done] Add regression coverage; focused `17/17`, lint, typecheck and diff
  check pass.
- [done] Published through PR #9 and deployed Worker version
  `20bc1f35-6ffe-4085-ba79-d54a0b53da71` to 100% of the custom domain.
- [done] Post-deploy smoke, health/readiness and SPA/API COOP header checks
  pass. Only the pre-existing `CONFIG_PLUS_GRANT_SECRET_MISSING` warning
  remains.
