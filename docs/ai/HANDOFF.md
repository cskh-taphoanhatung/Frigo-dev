# Frigo / Takosan current handoff — 2026-09-19

## Current handoff — T17 Takosan UI V2 partial redesign on feat/t17-takosan-ui-v2

### Continuation 4 (same day) — full-diff review, latent defects fixed

### Continuation 5 (same day) — release preparation

- **P1 found from screenshots, not tests:** camelCase `semantic` colour keys in `tailwind.config.js` meant `bg-semantic-action-primary`, `text-semantic-text-*`, `*-soft`, `border-strong` etc. compiled to **no CSS**. Fixed (kebab keys); `takosan-brand.test.tsx` now guards every `semantic-*` utility in `src/web` against the config. Re-verified: vitest 178/4047, T17 390/768/1440 51/51, build PASS.
- **Release path:** PR into `main` opened from this branch; CI hosted must be green; staging deploys automatically from `main`; production is a manual operator dispatch (`Deploy` workflow, `production` Environment, `confirm_production`, full SHA + `hardened_sha`). No new migrations in this branch. The agent does not deploy (rule 19).
- **Still open before `T17_COMPLETE`:** slate-palette migration (856 sites), human design review of the captures (this continuation shows why), WCAG contrast on legacy pages.

**4b addendum:** three more fixes (FoodPreferences onboarding-flag leak; per-nav `layoutId`; dev-OTP `<button>`). **T13 suite first local run: 60/60** after two test-only fixes — `/profile`→`/me` target, and the presentation test's `localStorage.frigo_onboarded` shim (broken on base by migration 0038, not by T17) replaced with the real onboarding flow. Do **not** seed the preview profile as onboarded: the T17 screenshot spec and screens 04-06 need the fresh preview user to land on onboarding. Full T17 matrix green after one more test-only `networkidle` fix (12/12 re-verify, 6 widths). Prefer `--reporter=line` and make sure no `security-preview.mjs` is left listening on :3000 before a Playwright run — a leaked server from a killed run caused spurious 1.0 m timeouts once.

- **Scope:** every file in `git diff 769d085..HEAD` reviewed; 10 product defects + 1 test defect fixed. Table with severity/finding/fix in `docs/ai/T17_UI_V2_REPORT.md` §Continuation 4.
- **Most important:** (P1) new settings pages had unscoped React Query keys — fixed with scoped `queryKeys.foodPreferences()`/`planningPreferences()` and invalidate-after-write; (P1) offline planning save showed success while only queued — now explicit pending-sync copy; (P1) offline planning read hung — now honest unavailable state.
- **IA/layout:** TopBar detects `/me`, navigates to `/me` and `/settings/app` directly; immersive shell is camera-only so `/scan/:id/review` and `/scan/receipt-review` keep navigation; ReceiptReview wrapper removed and its CTA clears the nav; `BottomCTA`/`StickyActions` primitives clear the mobile nav.
- **A11y/motion:** auth fields label-associated with ids, autocomplete, OTP group/digit names, reveal-button name/state, mode switcher `aria-pressed`; Switch gets `aria-describedby` and a transform-driven, reduced-motion-governed thumb; inventory rows fade on enter/exit.
- **Verification:** lint PASS, typecheck PASS, full vitest **178/4046 PASS**, migration smoke PASS, build PASS, focused UI/auth **65/65**, T17 Playwright at 390 + 1440 (33 pass + screenshot timeout fixed test-only, then 6/6 re-verified incl. two new regression assertions). `git diff 769d085 -- src/worker` = 0 lines.
- **Next exact actions:** unchanged — slate-palette semantic migration, human screenshot review before baselining, first local T13 Playwright run. Status `T17_PARTIAL`.

### Continuation 3 (same day, same branch)

- **Scoped transitions:** named `transition-tap` token added to tailwind (explicit `transform, background-color, border-color, color, box-shadow, opacity`; layout never transitions); all 86 `transition-all` sites across 32 files migrated; zero remain.
- **Motion stories:** cooking steps slide directionally (+24px forward, reverse on Back; timers never depend on animation frames); inventory rows animate add/remove/layout via AnimatePresence + layout keyed by stable server identity (instant under reduced motion); scan camera→processing crossfade verified already reduced-motion-safe over preserved context.
- **State matrix:** new suite tests — inventory bottom sheet (labelled/closable/in-viewport), honest offline banner (driven by browser offline/online events; Playwright `setOffline` only fails requests and is not this component's trigger), and 200% text-zoom survival on Home/Fridge/Recipes/Shopping/Profile.
- **Real zoom bugs fixed:** the 200% gate exposed rem-sized nav icons forcing flex min-content overflow, Profile-hub/Home truncation gaps, unwrappable RecipeCard meta and IngredientRow action rows, and a missing `min-w-0` on the inventory search. Verified clean by probe at 390 and 360 (desktop and mobile emulation) and by the suite at all six widths (settled measurement).
- **Gates:** lint PASS, typecheck PASS, full vitest **178/4046 PASS**, migration smoke PASS, build PASS (436.34 kB / 120.90 kB gzip). Full T17 matrix run passed except two test-code defects (case-sensitive offline regex; zoom measured pre-settle) — fixed test-only and re-verified **12/12** at all six widths; no product code changed after the full-suite run.
- **Next exact actions:** (1) migrate the 856 remaining `slate-*` neutral-palette sites on legacy pages to semantic tokens (brand `takosan-*` aliases may stay per the kit); (2) human design-review of the canonical screenshots before baselining; (3) first local run of the T13 Playwright inventory suite. Status stays `T17_PARTIAL`.
- **Safety:** worker/PayOS diff zero; `main` untouched; production untouched.

### Continuation 2 (same day, same branch)

- **Auth decomposed:** `AuthPage.tsx` is now a state machine composing `src/web/features/auth/*` (AuthShell, LoginMode, RegisterMode, OtpMode, ForgotPasswordMode, GoogleAuthSection, AuthField, auth-shared) with the kit's auth-state transition. Security semantics byte-compatible (Turnstile single-use token rotation, GSI retry/width/credential-only contract, DEC-012 deferred guest transfer with explicit continue-without-transfer, private-session capture, exact server error mapping). Auth suites **11/11 PASS**.
- **Dead animation classes retired:** the plugin that defines `animate-in`/`zoom-in-95`/`slide-in-from-*` was never installed, so those classes did nothing; all 15 occurrences moved to the real reduced-motion-gated `animate-fade-in`/`animate-slide-up`. Zero remain (`rg` proves absence).
- **Visual matrix complete:** T17 config certifies 360/390/430/768/1024/1440; 17 canonical screenshots captured per certified width under `.hoplite/artifacts/t17-playwright/results/t17-screenshots.e2e.ts-*`; destructive-dialog focus-trap/Escape/focus-return and empty-inbox honesty asserted. The 360 run exposed a real `/shopping` overflow (quick-add input refused to shrink) — fixed with `min-w-0` and re-probed at scrollWidth 360.
- **Gates after continuation:** lint PASS, typecheck PASS, full vitest **178 files / 4046 tests PASS**, migration smoke PASS, build PASS (index 436.21 kB / 120.84 kB gzip), T17 Playwright **42/42 PASS** at certified widths, full 6-width matrix green.
- **Next exact actions:** (1) migrate per-screen motion to the shared primitives (inventory list layout, scan crossfade, cooking-step direction, planner layout) and replace indiscriminate `transition-all`; (2) extend the state-class matrix (bottom sheet, long Vietnamese text, loading/offline) and human design-review the screenshots before baselining; (3) per-screen semantic-token migration for legacy-styled pages (Home, Inventory, Recipes, Week fallbacks, scan/cooking). Status stays `T17_PARTIAL` until those are evidenced.
- **Safety:** worker diff zero again this continuation; PayOS/payment untouched; `main` untouched; no deploy.

- **Branch/base:** `feat/t17-takosan-ui-v2` from live remote main `769d08597563f816ef9c1dd9523fdafb687de3e2`; `main` untouched, no merge/deploy. Status **`T17_PARTIAL`**; full evidence and exact gaps in `docs/ai/T17_UI_V2_REPORT.md`, audit in `docs/ai/T17_UI_V2_AUDIT.md`.
- **Design contract:** attached `takosan-redesign-os-v2.0.0.zip` (kit read in full: rules, tokens, layout, motion, states, components, 27 screens, engineering, QA). Kit assets that a prior migration had missed (search/notification/expiry/settings/budget/nutrition/scan/shopping-list/leaf icons) were installed under `public/takosan/`.
- **Implementation:** semantic token layer (CSS `--semantic-*` + tailwind `semantic-*`, type/radius/elevation scales); `motion@13.4.0` + `MotionConfig reducedMotion="user"` provider and motion primitives; shared primitives module; AppShell V2 (mobile bottom nav / tablet rail / desktop sidebar, immersive-only hiding, real links + `aria-current`; legacy `BottomNav` retired with migrated test); settings IA split with dedicated pages over real GET/PATCH `/preferences` and `/week/preferences`, `/settings/notifications`, `/settings/privacy`, `/settings/app`, honest household/privacy unavailable states replacing fabricated flows; inbox/preferences separated; planner canonical with param-preserving Week redirects (flag-gated, flag-off keeps Week rollout surface); onboarding step routes; phone-width emulation removed from 20+ pages; fixed CTAs clear nav/rail/sidebar; Landing/Auth h1; zero emerald/user-visible "Frigo Plus".
- **Verification:** baseline on `769d085` and post-implementation both: `pnpm lint`, `pnpm typecheck`, `pnpm test` **178 files / 4046 tests**, `pnpm check:migrations`, `pnpm build` all PASS; new isolated suite `pnpm exec playwright test --config playwright.t17.config.ts` **33/33 PASS** at 390/768/1440 (sqlite3 CLI installed in-session as the repo setup script does; Playwright chromium downloaded in-session). Test changes are documented and justified (MotionProvider in the shell-ancestry assertion, MemoryRouter wrapping for the inbox link, navigation primitive in the brand test) — no coverage weakened.
- **PayOS/payment:** zero application change — `git diff 769d085 -- src/worker` is empty; the only payment-path diff is 12/12 presentation-only lines in `VietQRModal.tsx`; billing service functions untouched.
- **Known limits / next exact actions:** (1) decompose `AuthPage.tsx` (930 lines) into `features/auth/*` with mode-presence transitions keeping auth tests green; (2) migrate per-screen motion + semantic tokens on legacy-styled pages; (3) extend the T17 suite to 360/430/1024, the state-class matrix and canonical screenshots; (4) full a11y (contrast/zoom/SR) pass. Only then consider `T17_COMPLETE`.
- **Safety:** no production/D1/R2/PayOS mutation, no canary change, Inventory Truth/OCR/AI/recipe authority/planning algorithms untouched; `.hoplite/settings.json` is platform-managed session metadata excluded from T17 commits.

## Current handoff — T16 PWA cache and Google recovery deployed

- **Branch/base:** `codex/auth-pwa-cache-google-recovery` from canonical main `ff07773ce8e146923870698928a1b8b4c451f8e6`.
- **Root cause:** production `/auth` and `/sw.js` were Cloudflare cache hits; app registration used `/sw.js` while `_headers` configured `/service-worker.js`; worker cache name was fixed at `takosan-pwa-v2`. A clean browser loaded real Google GIS and opened the Google account popup, isolating the reported GIS failure to stale/blocked client state rather than the backend credential contract.
- **Implementation:** release SHA is injected into `dist/client/sw.js`; registration uses `/sw.js?v=<sha>` plus `updateViaCache: none`; update checks run on load/online/foreground; activation removes only prior Takosan caches, claims clients, then best-effort navigates stale same-origin clients once; navigation refreshes cached `/index.html`; cache writes are awaited. Google button width is numeric/clamped and retry script errors are explicit.
- **Headers/workflow:** effective `/auth` and `/sw.js` policy is no-store, hashed assets are immutable without inherited no-store, and deploy builds receive the exact SHA. Exact-SHA convergence now precedes smoke; smoke validates the shell/worker/asset headers plus embedded Worker SHA.
- **Verification:** focused 116/116, full Vitest 178 files / 4046 tests, lint, typecheck, migration smoke, build, shell syntax and diff check PASS. Local Wrangler returned the intended effective headers. Two-release Chromium proved one clean-install document request, one update navigation, exact new controller and only the new release cache.
- **Browser limit:** no release can force a closed, suspended or browser-blocked old tab to execute new code. Awaiting its navigation inside Service Worker activation deadlocks the document fetch, so refresh is best-effort after claim; reload/reopen/navigation is the reliable recovery path, and clients on this release gain load/online/foreground checks for future updates.
- **Recorded non-gate failure:** `pnpm audit --audit-level high` reports the unchanged lockfile's 21 advisories / 6 high in Wrangler/Miniflare, jsdom and build-time sharp paths. No dependency changed here and these packages are not added to the browser runtime; handle in a separate reviewed dependency upgrade.
- **Merge/deploy receipt:** PR #42 head `54dd81b3ba260843ed39d625c8e0b7c2f4cef831` passed CI `35415335137`, merged as main `6a016f185cae9c51ab5a1fc873a8a05a10a57edd`, then passed exact-main CI `35415536459` and staging Deploy `35415763483`. Protected production Deploy `35415843682` succeeded on Worker `2f228dc9-d97b-4eb1-8cff-9a0f2df3b51c`, D1 ledger 38 / tip 0038, recipe `shadow/0/false`.
- **Production verification:** readiness identifies the exact main SHA; DB/queue are OK and only `CONFIG_PLUS_GRANT_SECRET_MISSING` remains. `/auth` is current + no-store (Cloudflare Assets reports HIT), `/sw.js` is MISS + no-store and embeds the exact SHA, hashed assets are immutable. Clean Chromium opened the real Google account chooser and showed the exact-SHA controller plus sole matching Takosan cache.
- **Safety:** no migration, D1/R2/customer-data write, payment/PayOS change, Canary activation, full-D1 cutover, Inventory Truth change or Week change. Real inbox OTP receipt remains a separate manual evidence item.

## Current handoff — T15C-D production 1% Canary blocked before mutation (2026-09-19)

- **Canonical base:** repository `1368281478` / `frigo-6/Frigo-dev`; main and task base `347b536950cf54d25a2d6a880c3c2cb3d8c8f329`; branch `codex/t15c-production-canary-1pct`.
- **Merged prerequisites:** PR #38 -> `8163f05ed1af361f9c0658361df745227e6eae20`; PR #39 -> `347b536950cf54d25a2d6a880c3c2cb3d8c8f329`. Exact-main CI `35409762462` and staging Deploy `35409964105` succeeded; production job was skipped and staging stayed `static/0/false`.
- **Fresh gates:** frozen install, seed/import, typecheck, lint, migration smoke through 0038, build, diff check, and full Vitest **178 files / 4044 tests** passed.
- **Production read-only evidence:** Deploy `35404106102`, Worker `6c336889-680d-4cc3-b03b-1007849aa738`, SHA `b41aa468...`, `shadow/0/false`; readiness config-valid with DB/queue/email OK and only `CONFIG_PLUS_GRANT_SECRET_MISSING`; 5/5 recipe reads served the same 71 IDs, legacy details returned 200, sampled D1-only details returned 404.
- **Safe stop:** no authorized operator-owned INCLUDE and EXCLUDE household pair was supplied; customer/user IDs were not searched. Local Wrangler is unauthenticated, so no fresh direct D1/tail audit or secret provisioning was possible. No production mutation occurred. Classification `T15C_D_BLOCKED_AUTHORIZED_TEST_HOUSEHOLDS_UNAVAILABLE`.
- **Receipt merge:** commit `16958c605c1d4659591f2c02faecf593d81a7a6a` passed exact-head CI `35410893001`; PR #40 merged as `763d7e904798dc513c60d4da5f876598570c12fb`; exact-main CI `35411093064` and automatic staging Deploy `35411300235` passed on `static/0/false`, with production skipped.
- **Next exact action:** privately supply the two operator-owned household IDs, authenticate the intended Cloudflare operator session, repeat direct D1 certification, provision the three hashed cohort Worker secrets without printing IDs/digests, prove Shadow remains inert, deploy exactly 1% through protected `deploy.yml`, certify EXCLUDE then INCLUDE plus E2E/telemetry, and rollback to `shadow/0/false` with secrets retained. Receipt: `recipe-catalog/T15C_D_PRODUCTION_1PCT_CANARY_CERTIFICATION.md`.

## Current handoff — T15C-C authorized test cohort mechanism ready, dormant (2026-09-19)

- **Base/branch:** canonical main `b41aa4682481447795350fc1a9eeb1e80887bd0e`; branch `hoplite/aigeai-eca96ae8--t15c-cohort` (PR in body). Implementation `c5d2d63aa06ad51727aaeac6bd6cf01349598e29`.
- **What:** secret-configured include/exclude digest sets let operator-owned test households prove INSIDE/OUTSIDE 1% canary without touching the customer algorithm or adding any request-controlled switch. Default disabled; parsed/validated only in `canary` mode with cutover — inert in static/shadow/d1 so rollback is a single mode change with no secret cleanup (review P1 resolved); an active cohort requires both an include and an exclude household (`TEST_COHORT_PAIR_REQUIRED`, review P2 resolved); fail-closed validation; no IDs/digests in logs, readiness, API, manifest, workflow, or wrangler config. Details/setup/rollback: `recipe-catalog/T15C_AUTHORIZED_TEST_COHORT.md`.
- **Production:** unchanged — `shadow / 0 / false`, Worker == main. Classification `T15C_AUTHORIZED_TEST_COHORT_READY`; canary activation remains a separate authorized T15C-B step.
## Current handoff — T15C production Canary safe stop (2026-09-18, after T16 merges)

- **Base:** canonical main `b41aa4682481447795350fc1a9eeb1e80887bd0e` (unchanged during the session); docs-only branch `hoplite/aigeai-eca96ae8--t15c-canary`.
- **Production (read-only, public endpoints):** Worker commit == main, authority `shadow / 0 / false` per Deploy 35404106102 receipt, 71 served deterministically, D1-only IDs 404. D1 aggregates not re-queried (no credential here) — historical from T15C-B: 500 / tip 0037 / `rel-bd00a4f53fcaeee4` / media 500 pending, 0 ready.
- **Blocker:** authorized inside/outside 1% cohorts and Cloudflare credentials unavailable → `T15C_CANARY_BLOCKED_AUTHORIZED_COHORT_UNAVAILABLE`. No production mutation of any kind. Receipt + resume steps: `recipe-catalog/T15C_PRODUCTION_CANARY_SAFE_STOP.md`.

## Current handoff — T16 OTP resend and guest account gates ready for release

- **Branch/base:** `codex/auth-otp-guest-account-gates` from canonical main `14f06ff7f3ede72e676e2cb42b9949cca074a070`; this checkpoint contains the application, tests and documentation candidate, while production is unchanged.
- **Implementation checkpoint:** `31006994849ee9f6d78ae6114f82d77d41efc784` (`fix(auth): restore OTP resend and gate guest upgrades`).
- **Confirmed root cause:** the real Cloudflare Email Service binding rejects `no-reply@frigo.tungjpstore.net` because that subdomain is not onboarded as a sending domain. The onboarded apex sender `no-reply@tungjpstore.net` was accepted and returned a provider `messageId`. Do not claim inbox delivery until a real OTP message is received.
- **OTP fix:** `src/worker/services/email.ts` uses the apex sender and sanitizes the known subdomain error. `src/worker/routes/auth.ts` tolerates optional KV cooldown outages, releases cooldown after failed sends, and returns `503 OTP_RESEND_UNAVAILABLE` for unexpected failures. `src/web/pages/AuthPage.tsx` requires and renews a Turnstile token for resend.
- **Guest UX:** guest `/plus` shows an account-required state with `/auth?mode=login&returnTo=%2Fplus`, never the price cards or `VietQRModal`. The guest profile CTA links directly to that login path. Auth accepts guest sessions and safe local `returnTo` routing sends an onboarded account back to Plus after login.
- **Payment boundary:** no PayOS, billing, checkout, payment webhook or settlement code changed; authenticated users retain the existing pricing/payment flow.
- **Verification:** focused **86 tests / 4 files PASS**; full `pnpm test` **176 files / 4008 tests PASS**; `pnpm lint`, `pnpm typecheck`, `pnpm check:migrations` (`migration-smoke=ok`), `pnpm build`, and `git diff --check` PASS. Browser checks at 390x844 and 1440x1000 confirmed the guest gate and return path.
- **Production pre-state:** Worker `e8164168-9566-475b-b0fa-7508368bf3e7`, main `0cb5d2c08fa24479ecce6b4c4e5f73b31a920ff5`, D1 ledger 38 / tip 0038, recipe `shadow/0/false`; only the known `CONFIG_PLUS_GRANT_SECRET_MISSING` readiness warning.
- **Next exact action:** commit coherently, push/open PR, require exact-head CI and review, merge normally, require exact-main CI, dispatch `.github/workflows/deploy.yml` with production confirmation and `shadow/0/false`, verify exact SHA/ledger/readiness, then use a normal browser to request/resend one OTP and confirm receipt without recording the code.

## Current handoff — T16 production and CSP hotfix deployed; OTP receipt pending

- **Merged release:** PR #34 contains implementation `3633a2fa8a0827a6aa31a3c86da7fb680a6e0f2a` plus docs `66e8073161cf418ffe4df2ed6cece75d56087af1`, merged as main `d6c981b1a67001b807f03166109f661bc753728c`. PR CI `35385363064` and exact-main CI `35385844667` passed.
- **User-facing result:** landing has two explicit choices; auth supports query-driven registration/Google entry; returning users skip completed onboarding; new users see three preference-only steps; onboarding has no duplicate account or unsupported Apple choice.
- **OTP/email:** `src/worker/services/email.ts` uses the structured Cloudflare Email Service API and sanitized error categories, with Resend fallback. Production delivery failure invalidates the challenge and register/resend return honest `503 OTP_DELIVERY_UNAVAILABLE`; development still exposes `devOtp` for local tests.
- **Google:** `/config` exposes the runtime `GOOGLE_CLIENT_ID`; frontend GIS and backend `aud` validation use that same value. Missing config fails clearly, retry reloads the GIS script, and no credential-less production fallback exists.
- **Persistence:** migration `0038_auth_onboarding_completion.sql` adds `profiles.onboarding_completed_at`; `/me`, auth responses, the auth store, and `SessionBoundary` hydrate server authority. `PATCH /preferences` validates input and batches preferences with completion.
- **Production D1:** workflow `35386276549` applied only 0038; ledger 38/tip `0038_auth_onboarding_completion.sql`; bookmark `000000d3-00000000-000050ea-709daab542439d8e8fab731b65dab714`; FK, quick check, aggregate drift, recipe media and catalog certification passed.
- **Production deploy:** workflow `35386532369` succeeded after Environment approval. Worker `c0161a22-1987-42dd-99c4-0a5874d4fadb` serves exact SHA `d6c981b1a67001b807f03166109f661bc753728c`; rollback Worker `c6fa2ce8-f35b-4485-ad38-09dbc19738d1`. Recipe settings are unchanged at `shadow/0/false`. Readiness is exact-SHA and operational, degraded only by existing `CONFIG_PLUS_GRANT_SECRET_MISSING`; post-deploy smoke passed.
- **Browser evidence:** production Playwright at 390x844 and 1440x900 found no overflow; Google GIS rendered and opened Google Accounts without an origin error. The live guest path survived reload, completed all three onboarding steps, persisted preferences with HTTP 200, reached `/`, and retained the secure `__Host-frigo_session` attributes.
- **CSP hotfix release:** implementation `79dfca6483d90fcf33380acfe33f880c1e6ff7a5`; PR #35 head `c14a3755d95ddae316d5e6636ef85f9784ac4a54`; PR CI `35388666150`; merge/main `0cb5d2c08fa24479ecce6b4c4e5f73b31a920ff5`; exact-main CI `35388963509`. The policy adds only the required Google Fonts/GSI and Cloudflare Insights origins, with no wildcard or script `unsafe-inline`.
- **Hotfix production deploy:** workflow `35389274233` / production job `105743646947` succeeded after Environment approval. Worker `e8164168-9566-475b-b0fa-7508368bf3e7` serves exact merge SHA; previous Worker `c0161a22-1987-42dd-99c4-0a5874d4fadb` is the immediate rollback reference. Full gates, exact-head CI recheck, read-only ledger/schema gate, smoke and one-attempt convergence passed. Manifest and live API remain `shadow/0/false`, 71 recipes, ledger 38/tip 0038.
- **Independent hotfix verification:** readiness exact SHA; DB/queue/email configured; only `CONFIG_PLUS_GRANT_SECRET_MISSING` warning. Mobile/desktop Playwright loaded fonts and one Google iframe with no overflow or CSP console violation. The Insights request was no longer CSP-blocked but its external host refused the connection from the verification network.
- **UX audit:** repository audit remains FAIL with 19 issues / 686 warnings / 47 passed; pages-only audit remains FAIL with 6 issues / 303 warnings / 15 passed. Reported issues are existing unrelated pages/tests/styles, not the T16 landing/auth/onboarding surfaces.
- **Remaining limitation:** real OTP delivery is not certified. `tungjpstore@gmail.com` already exists; automated headed and headless Chrome displayed the real Turnstile checkbox but did not produce a token. No forgot-password request was sent and no email receipt may be claimed. One legitimate production guest test record remains by design.
- **Safety boundary:** no PayOS/payment, recipe authority, canary percentage, Inventory Truth, Week behavior, media/R2, or unrelated production setting changed.
- **Next exact action:** in a normal user browser, open Forgot password for the existing account, complete Turnstile, submit once, and confirm the email arrived without exposing the OTP. No code, migration, or deploy action is otherwise pending.

## Current handoff — T15C-B merged control plane; authorized-cohort safe stop (2026-09-18)

PR #32 merged with expected head `a7b3d23f2ad8b48203328116d0e35425390d2127` as
`a6e81cd89b9e4c6b923cfc39947b01faf44ff5f3`. Exact-head PR CI `35344089103`,
unresolved threads `0`, and exact-main CI `35347246583` / job `105606601599`
are SUCCESS. Automatic Deploy `35347579284` passed release and staging, skipped
production, and its release/staging manifests are `static/0/false`; staging
deployed the exact merge SHA on Worker `12623f3b-ac64-4255-9fbf-c429b6225e1d`.

Production was rechecked read-only and remains Shadow/static user authority on
Worker `c6fa2ce8-f35b-4485-ad38-09dbc19738d1`, SHA
`88e8b54de121125866b2ff813e56e33277decf1c`: five catalog responses at 71,
legacy IDs 200, reviewed D1-only IDs 404. D1 `frigo-db` remains ledger 37 / tip
0037, 500 recipes, 500 runtime fields, 500 pending media / 0 ready; all SELECTs
reported `changes=0`, `rows_written=0`, and fresh aggregate catalog certification
passed at 500 recipes / 2 approved batches / release `rel-bd00a4f53fcaeee4`.
No migration, D1 write, R2/media write, or production deployment occurred in
this task.

The required authorized operator-owned inside-1% and outside-1% production test
cohorts were unavailable in repository/env/operator inputs. No arbitrary customer
households were inspected. Production Canary was not dispatched, so no
Environment approval was requested and no Canary certification fields exist.
Classification: `T15C_B_AUTHORIZED_TEST_COHORT_UNAVAILABLE`.

Next exact action: an authorized operator provides both cohorts; then recheck
production pre-state and dispatch exactly 1% through the protected workflow.
Do not widen above 1%, enable full D1, populate media/R2, start T14G, or modify
Inventory Truth/T09/T11, PayOS, or auth. Durable receipt:
`docs/ai/recipe-catalog/T15C_B_AUTHORIZED_COHORT_SAFE_STOP.md`.

## Current handoff — T15C-A bounded canary control plane (stop before activation)

- **Base:** certified main `6f589d0201499a3729d343e42ccb6d19fdff217a`; branch `codex/t15c-canary-control-plane`.
- **Remote closures:** PR #31 merged normally as `6f589d0…` after exact head `bb14ba3d…`; PR #29 closed, not merged, with a supersession comment. Automatic Deploy `35340976739` passed release/staging and skipped production.
- **Implementation:** `.github/workflows/deploy.yml` exposes only `static|shadow|canary`; canary choices are strings `0|1|2|5`; `scripts/release-check.mjs` validates the full combination and derives cutover; manifest/output/Wrangler propagation binds mode, percent, and cutover. Runtime authority files are unchanged.
- **Receipt:** `docs/ai/recipe-catalog/T15C_A_CANARY_CONTROL_PLANE.md` distinguishes runtime support from production authorization and documents T15C-B only.
- **Verification:** focused 121/121; full `pnpm test` 173 files / 3995 tests; `pnpm recipe:seed:check`, `pnpm recipe:import:check`, `pnpm lint`, `pnpm typecheck`, `pnpm check:migrations`, `pnpm build`, and `git diff --check` PASS. Migration 0036 SHA-256 `04228788e60d59a2427d70956d4d8a108d0a6c1c4a643c47641402f658120ba9`; 0037 SHA-256 `68e52e6d8b9d44054f609a3d405c9fa329d093521ffc8c97009c76fbf7317ad6`; no 0038.
- **Safety:** no production redeploy, canary activation, D1 write/migration dispatch, R2/media population, T14G, T09/T11, PayOS/auth, force-push, or history rewrite. Production remains Shadow/static user authority with 71 served and D1 500 READY per T15B receipt.
- **Canary PR:** #32 is open and mergeable. In-file checkpoints through `642b4f8bc88c4a5987c047570ef408ef277efd1b` passed exact-head CI. The authoritative final head, final CI run, unresolved-thread count, and production recheck are recorded in the PR's post-publication receipt because this file cannot contain the hash of its own commit.
- **Next exact action:** confirm that PR receipt, then independent review of PR #32. Do not merge, dispatch production, activate canary, or widen the policy in this task.

## Current — T15B-SHADOW production certification complete; stop before canary (2026-09-18)

See `recipe-catalog/T15B_SHADOW_CERTIFICATION.md` for the durable receipt. Canonical repository `1368281478` is `frigo-6/Frigo-dev`; PR #30 head `ad3e1d1656418aaf495b130443d6514926b8bdca` merged as main `88e8b54de121125866b2ff813e56e33277decf1c` with zero tree delta. Exact-main CI `35336548833` succeeded. Automatic staging Deploy `35336830786` succeeded and remained STATIC71 on Worker `580acb76-a006-4c0a-b991-618ebde07e88`.

Production Shadow Deploy `35337110268` succeeded after the normal required Environment reviewer gate: release job `105574386006`, production job `105574426707`, Worker `c6fa2ce8-f35b-4485-ad38-09dbc19738d1`, exact SHA convergence in one attempt / 574 ms. The immutable manifest records `recipeCatalogMode=shadow`, schema tip 0037 and ledger 37. Existing production D1 migration run `35329772751` was not rerun and no manual/additional D1 write occurred.

Independent production certification performed five repeated readiness/catalog checks: every request returned exact SHA and 71 user-facing recipes; `vn-canh-01` and `gl-12` remained HTTP 200; five reviewed imported IDs remained HTTP 404. Sanitized Cloudflare tail diagnostics proved `catalog_mode=shadow`, `catalog_source=static`, D1 500 complete/hydrated, release `rel-bd00a4f53fcaeee4` READY, zero drift/order/hydration errors, zero Shadow errors, and no authority leak. Previous Worker `ab8ff038-2aaa-468b-a9de-8c5d94f14052` remains retained; rollback is the approved Deploy workflow with the same SHA and `recipe_catalog_mode=static` plus normal approval.

Next action: independent review of the docs-only receipt PR. Do not merge stale/conflicting PR #29 as-is. Do not enable canary, full D1, or cutover; do not populate media/R2; do not start T14G; do not modify Inventory Truth/T09/T11, PayOS, or auth. Classification: `T15B_SHADOW_COMPLETE`.

## Previous — T15B-PRE STATIC certified; SHADOW wiring PR ready (superseded 2026-09-18)

See `recipe-catalog/T15B_PRE_STATIC_RECEIPT.md` for the durable receipt. Main stayed at `0fe2cf071693208f6c642d8cbd994f5a79b5a2cf`; PR #29 was not merged. Existing D1 migration run `35329772751` is SUCCESS at 0037/500 and was not rerun. Static Deploy run `35333517052` is SUCCESS with required Environment approval, Worker version `ab8ff038-2aaa-468b-a9de-8c5d94f14052`, exact SHA convergence in one attempt/587 ms, and five repeated live STATIC71 checks. Previous Worker `56979cb5-e1a8-4241-8a4c-2432d41cc439` remains available for rollback.

No approved Shadow switch existed in the certified main workflow/config path, so no undocumented Cloudflare mutation was attempted. PR #30 from `codex/t15b-shadow-wiring` adds only validated `static|shadow` deploy input/manifest propagation plus tests; canary/full-D1 remain unavailable. Full local gates pass: focused 99/99; lint, typecheck, full 173 files/3976 tests, migration smoke, build, diff-check. Implementation head `97aff50d…` exact CI `35335079345` is SUCCESS; require independent review and final docs-head exact CI, then stop. Do not merge, activate Shadow, enable canary/full D1, write R2/media, start T14G, change Inventory Truth/T09/T11, PayOS, auth, or production infrastructure.

## Current — T15A pre-production hardening COMPLETE; Phase B (production) not started

See `recipe-catalog/T15A_WIP_HANDOFF.md` for the final T15A-R receipt: PR #27 merged to main `0fe2cf071693208f6c642d8cbd994f5a79b5a2cf` (merge commit by maintainer; certified head `776422fb…`; tree delta 0), exact-main CI SUCCESS, automatic staging deploy SUCCESS with exact-SHA convergence through `wait-for-deployed-release.mjs`, production job SKIPPED. Historical last verified production tip = 0034; Phase B must re-query the live ledger before any mutation. No production D1/R2/deploy/authority change has occurred.

## Current T14F — T14F_DEVELOPMENT_COMPLETE (T14F-C certified + closed; production untouched)

T14F-C ran on top of the certified T14F-B base `7d667523…` and completed the 500-recipe development certification: 0037 promoted byte-identical to the certified factory artifact (`68e52e6d…`), `approved-batches.json` + shipped manifest regenerated to 500 recipes / 2 batches (`rel-bd00a4f53fcaeee4`, manifest `fa47d31f…`), fresh/staged/production-forward replay PASS, D1 readiness READY 500, static/shadow/canary/full-D1 authority PASS, and user flows incl. Batch B recipes across six cuisines PASS. Certificate: `recipe-catalog/T14F_C_500_CATALOG_CERTIFICATION.md` (with the closure section).

**Closure executed** (safe stop `44c0ad38…` resolved): `pnpm lint` PASS, `pnpm build` PASS, full `pnpm test` **171/171 files, 3913/3913 tests** (419.6 s), `pnpm typecheck`, `pnpm check:migrations` (smoke through 0037), `pnpm recipe:seed:check`, `pnpm recipe:import:check` (500/2), `git diff --check` PASS; working tree clean. Hosted validate on `44c0ad38…` (run 35266591460) was cancelled by a runner shutdown, then on rerun **failed** the five real-D1 suites (`Error: Network connection lost`): replaying 0001→0037 in one workerd overflows the 1 MiB prepared-statement cache in workerd 1.20250718, whose eviction segfaults (cloudflare/workerd#5977). Fix `8c6080aa…` is tests-only (`tests/helpers/local-d1-worker.mjs`: persisted local D1, one batch per migration, workerd restart before the cache would overflow); real-D1 suites 5 files / 92 tests PASS. No migration, catalog, runtime, Inventory Truth, PayOS or auth change. A second, distinct closure blocker then surfaced on the docs-only heads: the hosted Vitest step passed 171/3913 but exited 1 with an unhandled `[vitest-worker]: Timeout calling "onTaskUpdate"` (birpc 60 s reply timeout starved by long synchronous SqliteD1 suites on the 2-vCPU runner). Fixed forward-only with `tests/helpers/vitest-event-loop-yield.ts` (vitest `setupFiles`, one `setImmediate` yield per test) — test config only.

Final head and hosted exact-head validate SUCCESS (run/job ids) are bound in the PR #25 **final certification receipt**; PR #25 is marked ready for review and stays **unmerged**. Next action: **STOP.** Merge is a separate explicit decision after independent review. Production rollout (production ledger → 0036/0037 via the OPS migration workflow with `EXPECTED_PRE_TIP`, D1 readiness READY 500 verify, shadow → canary → d1), media population and T14G each require separate authorization. Production currently does **not** contain 500 recipes. `recipe-catalog/T14F_C_WIP_HANDOFF.md` is historical only — do not resume from it.

### T14F-A — pilot certified (earlier)

- Recovery: repository ID 1368281478; `frigo-4/Frigo-dev`; `hoplite/massalia-c2862d7c`;
  main `f0c229f2…` unchanged; start `8079a37` inspected as a compatible test-only fix.
- Implementation: `2ee6f5cc0e144e5c522ce91bd005ab61dc124ed5`. The legacy routing suite uses
  a generated test-local 71 release, verifies actual D1/canary selection and null fallback,
  retains first batch `[5]` / cached `[]`, rejects and does not cache semantic drift,
  and cleans up its mock. Timestamp fix `486409c…` and production semantics preserved.
- Failure history: reproduced pre-remediation 5/7; independent 71/101 mismatch diagnostics
  confirm correct COUNT_DRIFT/static fallback. Both stale-fixture failures are resolved.
- Verification: routing 8/8, growth 21/21, combined 29/29 twice, focused subsystem 383/383;
  independent serial/non-isolated 29/29; no P0/P1/P2 review blocker. Executed seed/import,
  typecheck, lint, migration smoke, build, full `pnpm test`, diff: all PASS;
  full suite 171/171 files, 3911/3911 tests. Exact commands are in the next handoff.
- Hosted implementation validate **35223589293 / 105209475052 SUCCESS**. The
  [final certification receipt](https://github.com/frigo-4/Frigo-dev/pull/25#issuecomment-5714709031)
  binds the final documentation head to its own hosted SUCCESS; required for a valid T14F-B base.
- Pilot remains 30 + legacy 71 = 101 READY, complete 101/order 0..100, five statements/no N+1;
  fresh/staged replay, authority modes, imported HTTP flows and inventory regressions pass.
  Pilot sources/review/registry/manifest, 0036 hash and all historical migration bytes unchanged.
- Next action: **STOP.** Await separate T14F-B authorization; start only from the final SHA
  in the receipt, not an earlier implementation SHA. No ingredient scale preflight, Batch B,
  0037, 500 manifest, production mutation/deploy/switch, media population or T14G.
  PR #25 stays draft/unmerged and auto-fix subscribed. Pre-existing local settings delta preserved.
- Durable recovery, exact commands and hashes: `recipe-catalog/T14F_NEXT_HANDOFF.md`;
  full history: `T14F_REAL_CATALOG_GROWTH.md`; pilot quality: `T14F_CATALOG_QUALITY_REPORT.md`.

## Historical handoffs (not current T14F status)

## Current handoff — T14F WIP SAFE STOP on `feat/t14f-recipe-catalog-500`; pilot 30 compiled + 0036 promoted; ONE focused test failing; Batch B not started (2026-09-17)

- **Implementation state:** uncommitted T14F pilot WIP checkpointed and pushed on
  `feat/t14f-recipe-catalog-500` (base `f0c229f2…` = T14E certified main, still origin/main). See
  `docs/ai/recipe-catalog/T14F_WIP_HANDOFF.md` for the authoritative state, hashes and next steps.
- **Pilot:** `data/recipe-import/t14f/pilot-30.jsonl` (30 original recipes, reviewed) → T14E compile
  30/30 publishable, 0 duplicates / 0 unresolved ingredients → `migrations/0036_recipe_catalog_pilot.sql`
  byte-identical to artifact; manifest `rel-193ac2b16c64a260` = 101 recipes / 1 approved batch;
  `ALL_RECIPES` stays 71; migrations 36 / tip 0036; 0001–0035 unchanged.
- **Verification:** typecheck, `check:migrations`, seed check, import check, diff check PASS. Focused
  growth suites 20/21: `production forward path 0034 → 0035 → growth` fails only when both growth
  suites run together (passes alone; root cause unknown — fix before any Batch B work). Lint, build,
  full `pnpm test`, bundle accounting NOT run.
- **Next exact step:** checkout the branch, reproduce/fix the failing growth test (test isolation only —
  do NOT regenerate data or 0036), then continue the T14F packet pilot gate before Batch B.
- **Not done:** Batch B (399), final 500 manifest, QA/architecture docs, PR, production anything.

## Current handoff — T14E MERGED to main `f7a55408…`; main certified; production untouched; T14F not started (2026-09-17)

- **Implementation state:** PR #23 (`hoplite/syrakousai-f7b7c8a0-…-t14e-bulk-recipe-import-factory`, remediated head
  `ba1a45d43f2f4b85d4f7500eba36fe094a7d3655`, original reviewed head `7b4edcc8…` as ancestor) merged by normal merge commit
  `f7a5540841db27be31cdab9e0c2010cd92bc3861` onto `9ff57199…`. Main contains exactly the reviewed tree (diff PR head → main = 0).
  Merged: `packages/recipes/src/import/*` + `catalog-release.current.json` (`rel-1a047444a3632771`, 71/0), `catalog-fingerprint.ts`,
  manifest-driven `recipe-authority.ts`, `scripts/recipe-import*.mjs`, `pnpm recipe:import:check`, tests, ADR-027, docs.
  Migrations 35 / tip 0035 / no 0036; protected paths (`migrations/`, `.github/`, wrangler, `src/`, `packages/db|domain|ai`) diff = 0.
- **Executed checks (fresh, exact `f7a55408…`):** `pnpm install --frozen-lockfile`; `recipe:seed:check` ok ×3; `recipe:import:check`
  ok (`rel-1a047444a3632771`, 71, 0); `typecheck` 0 errors; `lint` PASS; `check:migrations` `migration-smoke=ok`; `build` PASS;
  `pnpm test` **169 files / 3889 tests PASS**; focused T14E 6 files / 88; regression 15 files / 275 (authority modes, catalog safety,
  D1 parity, engine/candidates, planner, cooking, media, Inventory Truth) + 7 files / 160 (ranking ties, meal-planning http/persistence/
  snapshot, week core flow); `git diff --check` clean; working tree clean. Hosted: PR validate 35179141504 SUCCESS; main validate
  35182568280 / job 105077715190 SUCCESS; incidental staging Deploy 35182789974 SUCCESS (production job skipped).
  Scale (50 % evidence-backed): 500 → 826,455 B; 2,000 → 3,326,028 B; 5,000 → 8,322,981 B SQL.
- **Not done — by design:** 0036, real recipe growth, media population, production D1/R2/deploy, Cloudflare vars/secrets, authority
  activation (production stays `static`), T14F. Production still `4ed98514…` / D1 0034 / static — `PENDING_OPERATOR` dispatch per
  `recipe-catalog/T14CD_PRODUCTION_ROLLOUT_HANDOFF.md`.
- **Next action:** merge the docs-only closure PR (this file, `T14E_MERGE_RECEIPT.md`, `T14E_NEXT_HANDOFF.md`, state docs) → freeze
  `T14E_FINAL_CANONICAL_MAIN` = its merge SHA (exact-head validate SUCCESS required) → T14F only from that SHA per
  `recipe-catalog/T14E_NEXT_HANDOFF.md` §4–§7 (authorized dataset, validation, ingredient/duplicate/provenance review, deterministic
  compile, chunking decision, promotion, manifest update, SQLite replay, parity, independent review).

## Current handoff — T14E remediation (P1/P2/P3) on the feature branch; PR #23 unmerged, awaiting re-review (2026-09-17)

- **Implementation state:** forward commit after `7b4edcc8…`. `packages/recipes/src/import/{types,schema,normalize,compiler,
  sql-render,release-manifest}.ts`: `nutritionEvidence` + `duplicateReview` on the normalized model; `canonicalBatchProjection`
  (single hash projection); SQL renders `nutrition_profiles` (`<id>_nutrition_v1`, per serving, source_type/source_reference from the
  reviewed evidence) + `recipe_nutrition` rows; `normalized-recipes.json` carries batch metadata (incl. license/usageNote) and per-recipe
  evidence/review; `NUTRITION_EVIDENCE_LOST` guard. `recipe-authority.ts`: error union `D1_READ_FAILED | RELEASE_MANIFEST_INVALID`;
  manifest supplier failure ⇒ `RELEASE_MANIFEST_INVALID`. Migrations 35 / 0035 / no 0036; hash set unchanged. Protected paths untouched.
- **Executed checks:** `pnpm install --frozen-lockfile`, `recipe:seed:check` 3× ok, `recipe:import:check` ok (`rel-1a047444a3632771`, 71/0),
  `typecheck`, `lint`, `check:migrations` (`migration-smoke=ok`), `build`, `pnpm test` **169 files / 3889 tests PASS**; focused:
  provenance 11, factory 16, scale 4, output-policy+CLI 25, release-readiness 15, authority 17 (88); `git diff --check` clean.
  Scale (50 % evidence-backed): 500 → 826,455 B; 2,000 → 3,326,028 B; 5,000 → 8,322,981 B SQL.
- **Not done — by design:** merge, 0036, real recipes, media population, production/Cloudflare action, authority activation, T14F.
- **Next action:** independent re-review of PR #23 (exact head recorded in the PR post-push comment) → merge → freeze
  `T14E_FINAL_CANONICAL_MAIN` → T14F per `recipe-catalog/T14E_NEXT_HANDOFF.md`. Production dispatch still pending per
  `T14CD_PRODUCTION_ROLLOUT_HANDOFF.md`.

## Current handoff — T14E import factory development complete on feature branch; PR open, NOT merged (2026-09-17)

- **Implementation state:** `packages/recipes/src/import/{types,schema,parse,identity,ingredients,normalize,duplicates,
  sql-render,release-manifest,compiler,index}.ts` + `catalog-release.current.json`; `packages/recipes/src/catalog-fingerprint.ts`
  (extracted, re-exported); `recipe-authority.ts` readiness now takes a release manifest (default = shipped manifest) and
  `D1RecipeAuthority` a release supplier; `scripts/recipe-import.mjs` + `recipe-import-output-policy.mjs`; `pnpm recipe:import:check`;
  tests + fixtures listed in `recipe-catalog/T14E_NEXT_HANDOFF.md`; ADR-027; design doc. Migrations 35 / tip 0035 / no 0036;
  0001–0035 byte-identical (hash set unchanged). `ALL_RECIPES` = 71. Worker router, D1 reader, hydrator, Inventory Truth untouched.
- **Executed checks:** `pnpm lint`, `pnpm typecheck`, `pnpm recipe:seed:check` (3× ok), `pnpm recipe:import:check` (ok,
  `rel-1a047444a3632771`, 71/0), `pnpm check:migrations` (`migration-smoke=ok`), `pnpm build`, `pnpm test` **168 files /
  3878 tests PASS** (baseline 164/3818); focused: import factory 16, scale 4 (500/2000/5000), output policy + CLI 25, release
  readiness 15, updated T14D authority 17; `git diff --check` clean. Synthetic 500/2000/5000 SQL ≈ 0.78/3.1/7.9 MB.
- **Behavioural equivalence:** T14D negative controls now report `LEGACY_BASELINE_DRIFT` for a legacy field change (was
  `FINGERPRINT_DRIFT`); `ready` readiness carries `releaseId`. Everything else identical; client bundle unchanged.
- **Not done — by design:** 0036, real recipe growth, media population, any production/Cloudflare action, authority activation,
  T14F. Production remains `4ed98514…` / D1 0034 / static (operator dispatch pending per `T14CD_PRODUCTION_ROLLOUT_HANDOFF.md`).
- **Next action:** independent review of the T14E PR (do not merge automatically) → merge → record `T14E_FINAL_CANONICAL_MAIN`
  → T14F only per `recipe-catalog/T14E_NEXT_HANDOFF.md`.

## Current handoff — T14C/T14D OPS workflow merged (main 6910a7b4…); production D1/Worker untouched; operator dispatch required (2026-09-17)

- **Implementation state:** OPS-only. `.github/workflows/production-d1-migrate.yml`, `scripts/d1-migration-check.mjs`,
  `tests/unit/d1-migration-check.test.mjs`, `scripts/d1-schema-gate.sql` (5-branch), `DEPLOYMENT.md`, `docs/D1_SCHEMA_GATE.md`
  via PR #21 → `6910a7b4aee875f061454528daf6b4f0777e7f1a`. `deploy.yml`, migrations 0001–0035, `src/`, `packages/`, wrangler
  configs unchanged. Production Worker `4ed98514…`, production D1 expected tip 0034 (not read this session), recipe mode static.
- **Executed checks:** `pnpm lint`, `pnpm typecheck`, `pnpm check:migrations` (`migration-smoke=ok`), `pnpm build`, `pnpm test`
  **164 files / 3818 tests PASS**; real-repo candidate gate dry run at `ed34c6b9…` (35 migrations, tip 0035, 34 pins, `ref=main`
  rejected); full local-D1 rehearsal 0034→0035 (pre-ledger 34/apply, baseline 71/59/12 · 385/341/71/385, plan exactly 0035, post
  35/0035, `recipe_media` 71/71/0, FK `[]`, `quick_check ok`, drift none, schema gate PASS; certify mode with empty plan OK);
  schema-gate negative test (missing index + trigger → exit 1); 6-term gate reproduces `too many terms in compound SELECT` on local D1;
  hosted validate SUCCESS on PR head `2c39e484…` (35168307081) and on main `6910a7b4…` (35168563076); auto staging Deploy
  35168741683 SUCCESS with readiness `commit=6910a7b4…`; read-only prod probes (ready `4ed98514…`, recipes 71/59/12, media route 401
  on old Worker).
- **Not executed:** production ledger read, Time Travel bookmark, 0035 apply, production deploy, post-deploy smoke — all require the
  GitHub Actions production Environment, which needs a `workflow_dispatch` the Hoplite toolset cannot issue (sandbox `gh`
  unauthenticated; API 401). Reported as missing tooling.
- **Limitations:** `PRAGMA integrity_check` unsupported on hosted D1 (workflow uses `quick_check` + FK); `d1 info` may need extra
  token scope (workflow falls back to `d1 list` identity and warns); `CONFIG_PLUS_GRANT_SECRET_MISSING` pre-existing; Wrangler 3.114.17.
- **Next action:** operator dispatches `Production D1 Migration` (ref `6910a7b4…`, `0034_global_recipe_catalog_parity.sql`,
  `0035_recipe_media_layer.sql`, confirm=true) and approves the production Environment; on PASS dispatch `Deploy`
  (production, ref `6910a7b4…`, hardened `bb504cce…`, confirm_production=true); then smoke + write `T14C_FINAL_COMPLETION.md` /
  `T14D_PRODUCTION_DEPLOY_RECEIPT.md` per `recipe-catalog/T14CD_PRODUCTION_ROLLOUT_HANDOFF.md`. Do NOT set `RECIPE_CATALOG_MODE`.

## Current handoff — T14D merged and certified on main (bb504cce…); production rollout deferred to OPS

- **Done this packet:** fresh pre-merge gates (main/PR head unchanged; diff within T14D scope; migrations 35 / no 0036 /
  0001–0035 unchanged; modes + fence + no user-controlled mode; readiness codes; canary determinism; Inventory Truth
  files untouched; legacy recipe FK anchors pre-existing); PR #19 merged (`MERGE_SHA=bb504cce…`, PR head in main,
  tree preserved); post-merge main certified locally (seed 3×ok, typecheck, lint, `migration-smoke=ok`, build,
  **163 files / 3801 tests**, focused 131, diff-check clean) and by hosted CI (35157739716 / 105001075798 SUCCESS);
  incidental auto-staging Deploy 35158032832 SUCCESS (staging only). Docs closure: `T14D_MERGE_RECEIPT.md`,
  `T14D_NEXT_HANDOFF.md`, state docs.
- **Not done — by design:** Cloudflare login, 0035 production apply, any deploy, enabling shadow/canary/d1, T14E,
  media population. Production remains `4ed98514…` / 0034 / static.
- **Next action:** freeze `T14D_FINAL_CANONICAL_MAIN` (docs-closure merge SHA, exact-head CI green) as the only base
  for the next task; choose a track from `recipe-catalog/T14D_NEXT_HANDOFF.md` §6 (A: T14E import factory, B: media
  population, C: other) or run the Codex OPS sequence (§4) when Cloudflare access is available.

## Previous handoff — T14D recipe authority cutover architecture, development complete pending review

- **Branch/base:** `feat/t14d-recipe-authority-cutover` from `d0856b48e043c72d1793002e7c6047a186ac890d` (exact
  `origin/main` at start). Final head/PR/CI receipt: PR body + post-publication comment.
- **Implementation:** `packages/recipes/src/recipe-authority.ts`; `src/worker/services/recipe-authority.ts`;
  `src/worker/services/recipe-catalog-shadow.ts` (mode parser delegated; shadow unchanged); `src/worker/config/validation.ts`
  (fence/percent validation); `src/worker/types.ts`; routes `recipes.ts`, `week.ts`, `shopping.ts`;
  `packages/domain/src/week/planner.ts` (no hidden static default). Tests: `tests/unit/recipe-authority.test.ts`,
  `tests/unit/recipe-catalog-authority.test.ts` (reader guard), `tests/integration/recipe-authority-routing.test.ts`.
- **Database state:** no schema change; local replay still 35 migrations; production D1 remains 0034 (0035 pending OPS).
- **Checks executed:** `pnpm recipe:seed:check`, `pnpm typecheck`, `pnpm lint`, `pnpm check:migrations`, `pnpm build`,
  focused suites, full `pnpm test`, `git diff --check` — exact totals in the PR body.
- **Limitations:** no Cloudflare action by design; production remains static; canary/d1 exercised only against the
  in-memory D1 harness. Readiness requires exact D1 == ALL_RECIPES parity (T14E growth needs a new policy).
- **Next action:** independent review → merge → Codex OPS: apply 0035, deploy static, then config-only progression
  `shadow → canary (fenced, small %) → d1` per `recipe-catalog/T14D_RECIPE_AUTHORITY_CUTOVER.md` §12. Do NOT enable
  canary/d1 in production without `RECIPE_CATALOG_CUTOVER_ENABLED=true` and operator approval. T14E / media population not started.

## Current handoff — T14C merged (main 3a1e6be6…); production 0035 apply + deploy pending operator credentials

- **Done this session:** fresh pre-merge gates (main/PR head unchanged, migrations 35/no 0036/0001–0034 drift 0,
  ready-integrity + storage-key gates, protected areas untouched); PR #17 merged (`MERGE_SHA=3a1e6be6…`,
  PR head in main, tree preserved); post-merge main certified locally (seed check 3× ok, typecheck, lint,
  `migration-smoke=ok`, build, **161 files / 3776 tests**, diff-check clean) and by hosted CI
  (run 35147336385 / check 104966628291 SUCCESS); automatic staging Deploy run 35147682739 SUCCESS.
- **Not done — blocked:** production D1 ledger read, backup, `0035` apply, production deploy, production smoke.
  `wrangler whoami` → not authenticated and no `CLOUDFLARE_API_TOKEN` in the sandbox; the packet's stop
  condition (Cloudflare identity cannot be proven) applies. Nothing in production was mutated.
- **Next action (operator with Cloudflare access):** follow the 10-step runbook in
  `recipe-catalog/T14C_MERGE_RECEIPT.md` — identity → ledger (expect 34 / tip 0034) → export backup →
  aggregate baseline → plan (exactly 0035) → apply → verify 71 pending / 0 ready, FK/quick_check, schema gate →
  dispatch `Deploy` for `3a1e6be6…` (production, confirm_production, approval) → smoke → write
  `T14C_FINAL_COMPLETION.md` + `T14C_NEXT_HANDOFF.md`, mark `T14C_COMPLETE`, freeze final main.
  Do NOT deploy before 0035 is applied; do NOT populate media; do NOT start T14D/T14E.

## Previous handoff — T14C Recipe Media Layer, development complete pending review

- **Branch/base:** `feat/t14c-recipe-media-layer` from `8d3ebc444bbaa577893dd88a9d21f308a24f0cf5`
  (exact `origin/main` at start; unchanged). Final head/PR/CI receipt: see the PR body and the
  post-publication comment; not embeddable here (a handoff cannot contain its own commit).
- **Implementation:** `migrations/0035_recipe_media_layer.sql`; `packages/recipes/src/recipe-media.ts`;
  `packages/db/src/recipe-media.ts`; `src/worker/routes/recipe-media.ts`; `src/worker/services/recipe-media.ts`;
  `src/worker/routes/recipes.ts` (post-ranking enrichment only); `src/worker/index.ts` (public mount);
  `src/web/lib/recipe-media.ts` + 7 surfaces; `scripts/d1-schema-gate.{sql,sh}`, `scripts/migration-smoke.sh`,
  `scripts/render-recipe-seed.mjs` (media render/check); `tests/fixtures/migration-sha256.json` (0034 pinned).
- **Database state:** local fresh replay 0001→0035 = 35 migrations, `recipe_media` 71 pending hero
  slots, 0 ready; production untouched at 0034.
- **Checks executed:** `pnpm recipe:seed:check` (3× ok), `pnpm check:migrations` (`migration-smoke=ok`,
  incl. 0034→0035 upgrade + idempotent re-read), `pnpm typecheck`, `pnpm lint`, `pnpm build`,
  focused Vitest (schema 10 / catalog 16 / route+API 27 / presentation 8), full `pnpm test`,
  `git diff --check` — exact totals recorded in the PR body.
- **Limitations:** no production/staging execution; no R2 objects exist (all 71 resolve to legacy
  images exactly as before); `PRAGMA integrity_check` unavailable on hosted D1 (local only).
- **Independent-review remediation (2026-09-16, forward commit on the same branch):** P1 READY_INTEGRITY —
  `promoteRecipeMediaVersion(db, images, …)` verifies the actual R2 object (existence / MIME / size /
  SHA-256 of bytes, bounded 16 MiB) before an atomic guarded D1 batch; typed `OBJECT_*` errors; failure
  keeps target pending and old ready intact. P2 STORAGE_KEY_SQL_CONTRACT — 0035 renderer regenerated:
  exact `storage_key` CHECK (`CASE mime_type`), `content_length NOT NULL` for ready. Tests:
  `tests/helpers/recipe-media-r2.ts` (realistic R2 double), schema 13 / catalog 24 / route 27 /
  presentation 8. Checks re-executed: `recipe:seed:check`, `typecheck`, `lint`, `check:migrations`,
  `build`, full `pnpm test`, `git diff --check` — totals in the PR body. Still no production/staging
  action; 0001–0034 byte-identical; no 0036.
- **Next action:** independent review of the remediated PR #17 → merge → operator rollout (backup, apply
  0035, deploy via `deploy.yml`, smoke) → separate media population task (new bytes ⇒ new version ⇒ new
  key; never overwrite a ready key). Do NOT apply 0035 remotely before review.

# Frigo / Takosan current handoff — 2026-09-15

## Current handoff — T14B-B COMPLETE; T14C ready to start, 2026-09-16

- **Implementation state:** no application code changed; this checkpoint is OPS + docs. Production D1
  ledger tip `0034`; production Worker `56979cb5-e1a8-4241-8a4c-2432d41cc439` = main `4ed98514…`.
- **Executed checks (hosted/production):** `wrangler whoami`; `d1 list/info`; ledger SELECTs before/after;
  `d1 export` (SHA-256 `ab082dd4…343c`); `d1 migrations apply --remote` (0034 ✅); catalog/ordinal/FK/
  quick_check SQL; `scripts/d1-schema-gate.sh remote` PASS; Deploy runs 35101845374 + 35102115354 SUCCESS
  (production job ran lint/typecheck/test/check:migrations/build + schema gate + smoke on the runner);
  curl smoke of health/ready/recipes/auth-config/CORS/SPA; `wrangler tail` 25 s: 0 exceptions.
- **Not executed locally in this session:** `pnpm check` (docs-only change; hosted `validate` on the PR head
  is the gate). `PRAGMA integrity_check` is refused by hosted D1 (SQLITE_AUTH) — recorded.
- **Limitations:** backup lives in the thread sandbox (`/tmp/d1-backup/…`), copy out if retention needed;
  `CONFIG_PLUS_GRANT_SECRET_MISSING` readiness warning pre-exists; Wrangler 3.x outdated.
- **Next action:** merge this docs-only PR → freeze `T14C_CANONICAL_BASE_MAIN` = resulting main SHA →
  start T14C on `feat/t14c-recipe-media-layer` per `recipe-catalog/T14C_HANDOFF.md`. Do not enable
  `RECIPE_CATALOG_MODE=shadow` in production without a separate decision.

## Current handoff — T14B-B MERGED to main; production rollout blocked by existing OPS secret, 2026-09-16

- PR #14 (head `004e5a32`) merged into `main` as `c7455160bfc8d279d38bc7ca4c0751542012a3c5` (normal
  merge commit; PR content byte-identical in main). Main CI `validate` SUCCESS (run 35072991882);
  fresh main gates: typecheck, lint, seed check, `migration-smoke=ok`, build, 157 files / 3704 tests.
- Production D1 (`frigo-db`, `f975ec39-…`) still needs 0034 applied by an operator with Cloudflare
  credentials (none available here); the auto Deploy run 35073197948 failed at "Deploy to Cloudflare
  staging" with `CLOUDFLARE_API_TOKEN` missing — the known OPS blocker. Production application is
  unchanged (pre-T14B-B lineage). Read-only prod probe healthy (71 static recipes served).
- Status: `T14B_B_ROLLOUT_BLOCKED`; T14C NOT started (no handoff written until rollout closes).
  Receipt: `recipe-catalog/T14B_B_MERGE_RECEIPT.md`. Next: operator applies 0034 remotely, verifies
  ledger/counts/integrity, sets the staging/production Cloudflare secrets, dispatches Deploy.

## Historical — T14B-B remediation FINAL (review-ready), 2026-09-16

- Continued from safe checkpoint `d9130b69…` (hosted validate SUCCESS run 35053041994, now
  historical). Commit A `19b144a5` rewrites `tests/integration/recipe-d1-runtime-parity.test.ts`
  to consume `D1RuntimeRecipeCatalog.listRuntimeRecipes()` as emitted (no `byId`/`ALL_RECIPES`
  re-mapping, no sorting): strict-equal list + unsorted ID order, recommendation parity,
  tie-sensitive ranking, planner tie fixture, >5-alternative swap regression, executed swap,
  ingredient-ordinal integrity and shadow health (info at 0 order drift, warn otherwise), each with
  a reversed-catalog negative control. Mutation check: an ID-sorting hydrator fails 8/11 tests.
  Commit B finalises docs: category = typed open (non-empty string), region = closed vocabulary;
  ADR-024 records persisted runtime order, explicit ingredient ordinals and static authority.
- Focused: `recipe-d1-parity` 12, `recipe-d1-runtime-parity` 11, `recipe-catalog-authority` 5,
  `recipe-catalog-safety` 6 → 4 files / 34 tests. Full gates and fresh exact-head hosted CI are
  recorded in `recipe-catalog/T14B_B_REMEDIATION_HANDOFF.md` §10 and the PR #14 body.
- Authority unchanged: `ALL_RECIPES`; no `d1` mode; production static; shadow throttle unchanged;
  0001–0033 byte-identical; 0034 re-rendered in place (unmerged). PR #14 NOT merged; PR #4
  untouched; T14C/T14D/T14E not started. Next action: maintainer review + protected merge of #14.

## Historical — T14B-B remediation SAFE STOP, 2026-09-16

- Work stopped by instruction mid-remediation; nothing discarded, checkpoint pushed to PR #14's
  branch only. Superseded by the FINAL entry above; kept for lineage:
  `recipe-catalog/T14B_B_REMEDIATION_HANDOFF.md`.
- Implemented and locally verified on the checkpoint tree: persisted canonical `runtime_order`
  (0034, renderer-owned), explicit `recipe_runtime_ingredient_order` positions (reader/hydrator,
  fail-closed), `StaticRuntimeRecipeCatalog` preserves input order, shadow `orderDrift`
  diagnostics, and the 33/33 migration fingerprint manifest pinned from `c1c1c14a…`.
- Not finished: rewrite `tests/integration/recipe-d1-runtime-parity.test.ts` without the
  ALL_RECIPES-reordering workaround (tie + >5-alternative swap tests), correct category wording
  (typed open, not closed) in ADR-024/PR body, rerun full gates, obtain fresh exact-head CI.
- Tree at stop: typecheck/lint/seed-check/migration-smoke/build/full test (157 files / 3699
  tests) all exit 0; `git diff --check` clean; hosted CI on the checkpoint SHA NOT_RUN; last
  known green head `f8813d50…` (run 35050720485).
- Authority unchanged: `ALL_RECIPES`; no `d1` mode; production static; no deploy/production
  mutation. PR #14 and PR #4 remain unmerged. Do not start T14C/T14D/T14E.

## Current handoff — T14B-B D1 parity & shadow, 2026-09-16

- Task: T14B-B (D1 catalog parity, runtime view, shadow foundation). NOT the authority cutover.
- Repository: `vn-clo/Frigo-dev`, ID `1368281478`; start main `c1c1c14a2a7dccc883f1030d0dee7043754fb4a9`.
- Branch: `hoplite/poteidaia-c88481ca-integrate-t14b-a-current-main-t14-canonical-merge-receipt-t14b-b-d1-recipe-parity-shadow`.
  Commits: `724ed3fb` (0034 + renderer + smoke/gate), `550eef0d` (hydrator, runtime catalog,
  drift typed fields, shadow service, config gate), `a210c72f` (parity/fail-closed/planner/
  recommendation/cooking/authority tests), `330add8b` (docs/ADR-024), `0284a96c` (review fixes:
  per-isolate shadow interval bound, no description default, Inventory Truth test decoupled).
  PR #14 against `main`; exact-head hosted `validate` passed on `71e338a1` (run 104647097626);
  the rerun on `0284a96c` is recorded in the PR.
- Migration: `0034_global_recipe_catalog_parity.sql`; `0001–0033` hash drift NONE; fresh replay
  and populated-0033 upgrade (FK stub + cooked meal) pass in tests and `pnpm check:migrations`.
- Checks executed (this head): `pnpm install --frozen-lockfile`, `pnpm recipe:seed:check` (0006 +
  0034 ok), `pnpm typecheck`, `pnpm lint`, `pnpm check:migrations` (`migration-smoke=ok`),
  `pnpm build`, `pnpm test` → **157 files / 3697 tests passed**, `git diff --check` clean.
  Focused: `recipe-d1-parity` 10/10, `recipe-d1-runtime-parity` 6/6, `recipe-catalog-authority`
  5/5, `recipe-catalog-safety` 6/6. Remote schema gate not run (no credentials; not required).
- Truth: static 71 (59+12); D1 71 complete, staticOnly `[]`, d1Only `[]`, all drift `[]`;
  nutrition `legacy_compatibility`; category/region `typed_runtime_field`; media legacy compat only.
- Authority: `ALL_RECIPES` on every route/web/planner path (static guard test); shadow mode is
  opt-in, off-response, production-rejected; no `d1` mode.
- Not done / deferred: T14C media, T14D cutover, T14E bulk import; PR #4 untouched
  (`CLOSE_ARCHIVE` recommended); Deploy staging token blocker remains an OPS issue.
- Next action: maintainer review of PR #14 (ADR-024, `recipe-catalog/T14B_B_D1_PARITY_SHADOW.md`)
  with exact-head hosted `validate` green, then normal protected merge. Do not enable shadow in
  production or deploy. T14C/T14D/T14E remain separate packets.

## Current handoff — T14 integration refresh, 2026-09-15 UTC

- Task: reconcile T14A then accepted T14B-A; no redesign or T14B-B.
- Repository: `vn-clo/Frigo-dev`, ID `1368281478`; verified canonical main before
  this docs-only receipt `a165474a623a8130c9a9ed4f1df096b3ac3b3ae9`.
- Merges: T14A PR #11 → `fbd14c771070e1b5594532648d79fb60c891747d`, then
  T14B-A PR #12 → `a165474a623a8130c9a9ed4f1df096b3ac3b3ae9`. Normal protected
  flow, no history rewrite. Source PRs #7/#8 remain historical references.
- Branch: docs-only final merge receipt from both completed integrations.
- Output: historical audit retained with explicit lineage refresh; current
  production truth wins over old shared-status prose. Detailed receipt:
  `recipe-catalog/T14_INTEGRATION_REFRESH.md`.
- Production: PR #9 merge `911db7fdddcd60ea1e3f3c17b4aed3f4b922bda5`, Worker
  `20bc1f35-6ffe-4085-ba79-d54a0b53da71` recorded at 100%; PR #10 receipt
  adds docs only. No fresh deploy or production probe was performed here.
- Checks: fresh frozen install, lint, typecheck, test (**151 files / 3633 tests**),
  migration smoke, build and diff check all exit 0. All 33 migration hashes match;
  T14A application-path diff is empty. Exact T14A hosted head `e916d292` passed
  run `35034318031`. T14B-A exact head `3e393741` passed hosted run `35035112092`
  and every fresh required local gate: 154 files / 3676 tests, seed check/render,
  typecheck, lint, migration smoke, build, diff check; post-run tree empty.
- Blockers: Deploy `35035612637` staging lacks `CLOUDFLARE_API_TOKEN`; release
  succeeded, production skipped. Main CI `35035415271` passed. Do not fix secrets.
- Safety: migrations 0001–0033, static `ALL_RECIPES` authority, Inventory Truth,
  Qwen, PayOS and PR #9 headers/source remain unchanged; media deferred to T14C.
  PR #4 remains open with CLOSE_ARCHIVE recommendation, not merge.
- Architecture: accepted safety modules remain non-authoritative. Recipe ADR-023
  only renumbers the historical ADR-022 to preserve PR #9's Auth/OCR decision.
- Recipe truth: 71/59/12 runtime; fresh local D1 replay complete 59, static-only
  globals 12, d1-only/incomplete/rejected empty, supported-field drift zero;
  nutrition unsupported, not fabricated parity. Renderer containment intact.
- Next action: finish the protected docs-only receipt. Its post-merge PR comment
  records exact final main / `T14B_B_BASE_MAIN` and final CI/Deploy status (a commit
  cannot embed its own eventual merge SHA). Then use that final main for a
  separately authorized T14B-B packet. **READY_FOR_T14B_B** prerequisites only.
  **T14B-B NOT STARTED; do not create 0034 or deploy.**

# Historical handoffs — not current next-action authority

Retained verbatim below; old main/production SHAs and unfinished-task statements
describe their original checkpoints, not the current refresh above.

## Auth/OCR production hardening handoff — 2026-09-16

Branch: `codex/auth-ocr-production-fix`.

The live auth error was traced to a frontend-only credential-less Google fallback
that sent `userInfo` without an ID token; it is removed. GIS initialization now
waits for the async SDK and provides a safe retry state. A shared
`ScanProcessingState` gives the upload, fridge review and receipt review screens
visible pending stages and elapsed-time reassurance while preserving the server
status contract and review-before-confirm rule.

Checks executed: focused auth/OCR `54/54`; full Vitest `3632/3632` (151 files);
`pnpm lint`; `pnpm typecheck`; `pnpm check:migrations`; `pnpm build`; and
`git diff --check` all passed. Known test stderr is expected injected failure or
KV-degraded limiter logging; no test failed.

No deployment, remote D1 migration, secret/configuration mutation, production
KV/R2/queue mutation, PayOS change or T14 work occurred. Next action is exact
branch browser smoke and PR/hosted-CI review. Do not deploy from this branch
until those gates pass and an explicit maintainer release decision exists.

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

## Current auth handoff (2026-09-16)

Safari showed a blank Google OAuth popup at `accounts.google.com/gsi/transform`.
The live `/auth` headers included `Cross-Origin-Opener-Policy: same-origin`.
Hono `secureHeaders` was the effective source because it ran after the custom
header middleware and overwrote the GIS-compatible value. The fix disables
that one Hono default and sets COOP by path: SPA `same-origin-allow-popups`, API
`same-origin`. The regression test is green (`17/17` focused tests), with lint,
typecheck and diff check green. PR #9 merged as `911db7f`; Worker version
`20bc1f35-6ffe-4085-ba79-d54a0b53da71` is live at 100%. Production smoke and
readiness pass, `/auth` now returns `same-origin-allow-popups`, and `/api/*`
retains `same-origin`. The only readiness warning is the pre-existing
`CONFIG_PLUS_GRANT_SECRET_MISSING`; no migration or production data resource
was changed.
