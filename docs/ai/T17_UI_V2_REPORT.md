# T17 — Takosan UI V2 report — 2026-09-19

Task: T17 Takosan UI V2 Full Product Redesign per the attached
`takosan-redesign-os-v2.0.0.zip` design contract. Branch:
`feat/t17-takosan-ui-v2`. Base: remote main `769d08597563f816ef9c1dd9523fdafb687de3e2`
(fetched live; historical kit SHA not pinned per the kit's own rule).

## Status: `T17_PARTIAL`

The design-system foundation, responsive AppShell, settings/account IA,
honest-state migration, planner canonicalization (flag-gated), brand cleanup,
the isolated T17 visual suite, the AuthPage decomposition, the no-op
animation-utility retirement, and the full 6-width viewport matrix with
canonical screenshots are implemented and verified. Exact gaps preventing
`T17_COMPLETE` are listed under "DoD evidence".

## Implemented

- **Baseline** (on `769d085`, before edits): `pnpm lint`, `pnpm typecheck`,
  `pnpm test` (178 files / 4046 tests), `pnpm check:migrations`
  (sqlite3 installed — the repo setup script's own requirement),
  `pnpm build` — all pass.
- **Audit**: `docs/ai/T17_UI_V2_AUDIT.md` (routes, migration map, duplicate
  primitives, Frigo leaks, phone-width wrappers, Week/Planner + settings +
  notification overlap, fake-flow survey, baseline record).
- **Semantic design system**: full kit token set in
  `src/web/styles/takosan-tokens.css` (`--semantic-*`, motion, z-index,
  content widths) + tailwind `semantic-*` color family (rgb channels, alpha
  modifier support), type scale (`text-type-*`), radius (`rounded-card/feature/hero/pill`),
  elevation/focus ring (`shadow-t17-*`). Legacy values untouched.
- **Motion system**: `motion@13.4.0` added (kit-preferred API; build verified),
  `MotionProvider` (`MotionConfig reducedMotion="user"`) wraps the app;
  `design-system/motion.tsx` exports PageTransition/Slide/Fade/ScalePress/
  AnimatedDialog/AnimatedSheet/SharedIndicator with token durations;
  CSS `prefers-reduced-motion` gate stops skeleton pulse and legacy entrance
  animations.
- **Shared primitives**: `design-system/primitives.tsx` (Page with semantic
  width, PageHeader, Section, Surface, BottomCTA, StickyActions, Switch with
  `role=switch`/`aria-checked`, SettingsRow as real links, StatusBadge,
  UnavailableState, Skeleton). Existing `components/common` remains the
  component authority — extended, not duplicated.
- **AppShell V2**: `AppLayout` owns viewport composition — mobile edge-to-edge
  canvas + bottom nav, tablet 80px rail, desktop 256px sidebar; nav hidden
  only in immersive surfaces (scan/cook/auth/onboarding) including planner and
  settings (previously lost). One navigation model (`design-system/navigation.tsx`)
  renders all three breakpoints with real `<Link>` + `aria-current="page"`;
  the central scan action stays a contextual action. Legacy `BottomNav.tsx`
  retired after its test migrated to the new component with equivalent
  assertions (brand grammar, `aria-label="Quét AI"`, `aria-current`).
- **Settings/account IA (screens 19-26)**: `/me` hub (ProfilePage navigation
  rows are now real links to dedicated routes); new `/me/preferences`
  (FoodPreferencesPage over real GET/PATCH `/preferences`), `/me/household`
  (honest unavailable states; the fabricated invite code, fake join success,
  demo members, and external QR service were removed), `/settings/planning`
  (PlanningSettingsPage over real GET/PATCH `/week/preferences`; explicitly
  not the new-plan flow), `/settings/notifications` (preferences; device-local
  toggles with honest push/email unavailability), `/settings/privacy`
  (real permission display; honest export/delete unavailability — no fake
  flows), `/settings/app` (PWA/cache/language/version; logout stays in /me).
  Redirects: `/profile`→`/me`, `/family`→`/me/household`, `/settings`→`/settings/app`.
  Inbox `/notifications` no longer contains delivery toggles.
- **Planner canonicalization**: when `VITE_MEAL_PLANNER_ENABLED=true`, `/week`,
  `/week/setup`, `/week/:planId`, `/week/:planId/meal/:mealId`,
  `/week/:planId/shopping` redirect to planner equivalents with params
  preserved (dedicated redirect components — `Navigate` does not interpolate
  params); `/week/:planId/settings` → `/settings/planning`. Flag off keeps
  the existing Week surface (rollout contract preserved).
- **Onboarding step routes**: `/onboarding/household`, `/onboarding/preferences`,
  `/onboarding/goals` (kit screens 04-06) render the server-authoritative flow
  at the right step.
- **Brand cleanup**: zero `emerald-*` classes remain in tsx; "Frigo Plus"
  user-visible strings → "Takosan Plus"; PlusPaywallPage hero/pricing/chips
  moved to semantic tokens, plan selector is a real `button` with
  `aria-pressed`; Plus hero uses the canonical celebrate mascot. Internal
  `X-Frigo-*` headers, route names and storage keys retained (rule 11).
- **Phone-emulation removal**: `max-w-md mx-auto` wrappers removed from 20+
  shell pages; fixed CTAs now sit above the mobile bottom nav and start after
  the rail/sidebar on md/lg; Landing/Auth h1 fixes (heading hierarchy).
- **T17 visual suite** (isolated from T13): `playwright.t17.config.ts` +
  `tests/e2e/t17-ui/t17-ui.e2e.ts` — 33 tests at mobile-390 / tablet-768 /
  desktop-1440. **Result: 33 passed** (`pnpm exec playwright test --config
  playwright.t17.config.ts`, 4.7m). Coverage: shell surfaces without
  horizontal overflow (`layout()`), nav visible per breakpoint, immersive nav
  hiding, settings IA + redirects, honest unavailable states (asserts absence
  of the old fake `FRG-` code), week→planner param-preserving redirects, real
  onboarding completion (the Home gate trusts server truth — the suite drives
  screens 04-06 through the UI), food-preferences PATCH round-trip,
  planning-settings save without plan generation, public landing/auth without
  auth, reduced-motion usability, keyboard focus. No production/private data;
  deterministic seeded preview only; screenshots/traces in
  `.hoplite/artifacts/t17-playwright/`.

## Continuation (same date, second checkpoint)

- **AuthPage decomposed** (screen 02 acceptance criterion): the 930-line
  monolith is now a state machine page composing `src/web/features/auth/*` —
  `AuthShell` (brand chrome, mode switcher, alerts, dev-OTP badge, footer),
  `LoginMode`, `RegisterMode`, `OtpMode`, `ForgotPasswordMode`,
  `GoogleAuthSection`, `AuthField`, `auth-shared`. Security semantics are
  untouched: Turnstile single-use tokens, Google GSI retry/width contract,
  DEC-012 deferred guest transfer, private-session capture, exact server error
  mapping. Mode changes now animate with the kit auth transition (fade + 12px
  horizontal) via the shared Slide primitive; controlled values live in the
  page so input is never cleared. The four auth suites pass: **11/11**
  (`auth-funnel-ui`, `auth-resend-turnstile`, `auth-guest-transfer-deferred`,
  `auth-google-credential`).
- **No-op animation utilities retired**: the codebase never installed the
  tailwindcss-animate plugin, so every `animate-in` / `zoom-in-95` /
  `slide-in-from-*` class was dead weight. All 15 occurrences across overlays,
  toasts, step bodies and modals were replaced with the real, reduced-motion
  gated `animate-fade-in` / `animate-slide-up` utilities; zero remain
  (`rg 'animate-in|zoom-in-95|slide-in-from-' src/web` → 0).
- **Full viewport matrix**: the T17 config now certifies 360/390/430/768/1024/
  1440. The 360 run exposed a **real horizontal overflow** on `/shopping`
  (scrollWidth 379 > 360: the quick-add input refused to shrink below its
  placeholder width); fixed with `min-w-0` on the input/select and re-probed
  clean. Final suite results: run 6 (all six widths) — every test except the
  then-buggy screenshot locator passed; run 7 (certified widths) —
  **42/42 passed** in 5.9m.
- **Canonical screenshots** (`t17-screenshots.e2e.ts`): 17 surfaces captured at
  390 / 768 / 1440 — landing, auth, onboarding, home, inventory, recipes,
  recipe-detail, cook, planner, shopping, profile, preferences,
  planning-settings, notification-preferences, privacy, app-settings, plus —
  under `.hoplite/artifacts/t17-playwright/results/t17-screenshots.e2e.ts-…/
  *.png`. Deterministic seeded fixtures only. Includes a destructive-dialog
  focus-trap/Escape/focus-return assertion and an empty-inbox honesty check.

## Continuation 3 (same date, third checkpoint)

- **Indiscriminate `transition-all` retired**: a named `transition-tap`
  token (explicitly enumerated `transform, background-color, border-color,
  color, box-shadow, opacity` — layout properties are never transitioned)
  was added to the tailwind config; all 86 occurrences across 32 files were
  migrated. `rg 'transition-all' src/web` → 0.
- **Per-screen motion stories implemented**: cooking steps now transition
  directionally (forward +24px, reverse on Back, via the shared Slide primitive
  keyed by step index; timer logic never depends on animation frames); the
  inventory list animates add/remove/layout keyed by stable server identity
  (AnimatePresence + layout, instant under reduced motion); the scan
  camera→processing crossfade was verified already reduced-motion-safe over
  preserved capture context.
- **State-class matrix extended**: new suite tests for the inventory bottom
  sheet (labelled, closable, in-viewport), the honest offline banner (browser
  offline/online events; Playwright's `setOffline` only fails requests and is
  not the trigger this component listens to), and 200% text zoom survival.
- **Real 200% zoom defects found and fixed** by the new tests and probe
  scripts (mobile.md: no horizontal scrolling at 200% text zoom): rem-sized
  navigation icons forced flex min-content overflow (nav items now `min-w-0`
  with shrinkable icon boxes), the Profile hub card and Home header refused to
  truncate (`min-w-0`/`truncate`/`shrink-0` chains), the RecipeCard meta row
  and IngredientRow action cluster could not wrap (`flex-wrap`/`ml-auto`),
  and the inventory search input lacked `min-w-0`. Verified clean by probe at
  390 and 360, desktop and mobile emulation, and by the suite at all six
  widths (`requestAnimationFrame`-settled measurement).
- **Gates after continuation 3**: `pnpm lint` PASS, `pnpm typecheck` PASS,
  `pnpm test` **178 files / 4046 tests PASS**, `pnpm check:migrations` PASS
  (`migration-smoke=ok`), `pnpm build` PASS (436.34 kB / 120.90 kB gzip),
  full T17 matrix run: 92 passed with 7 failures that were test-code defects
  (offline-banner case-sensitive regex; zoom measured before layout settle) —
  both fixed test-only and re-verified: **12/12 passed** for those tests at
  all six widths. No product code changed after the full-suite run.

## Continuation 4 — full-diff code review of the redesign (same date)

Every file in `git diff 769d085..HEAD` (76 files) was reviewed for latent
defects across routing, data contracts, tenancy, accessibility, motion, and
the fixed-action layer. Findings and fixes (all product-code unless noted):

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| 1 | P1 tenancy | New `FoodPreferencesPage`/`PlanningSettingsPage` used bare query keys (`['food-preferences']`, `['planning-preferences']`), violating the repo rule that every server-state key embeds user+household so caches cannot leak across account/household switches. | Added `queryKeys.foodPreferences()` / `queryKeys.planningPreferences()` (scoped) and switched both pages; saves now `invalidateQueries` so the server is the authority after write. |
| 2 | P1 honesty | `weekApi.updateWeekPreferences` returns `{ pendingSync: true }` when offline (queued replay); the planning page showed "Đã lưu" as if the server had it. | Detect `pendingSync` and show an explicit "chưa có mạng — sẽ đồng bộ khi kết nối lại" state instead of success. |
| 3 | P1 UX | `weekApi.getWeekPreferences` returns `null` offline; the planning page then hung on the loading state forever. | Explicit `UnavailableState` when the query succeeds with `null`. |
| 4 | P2 IA | `TopBar` detected the hub with `pathname === '/profile'`; after the `/me` move the settings gear never rendered on the hub, and TopBar/Header/Home still navigated to legacy `/profile` and `/settings` (extra redirect hops). | Detect `/me` (and legacy `/profile`); navigate to `/me` and `/settings/app` directly. Regression assertion added to the T17 suite. |
| 5 | P2 layout | `AppLayout` treated every `/scan/*` path as immersive, so the scan review workspaces (screen 09: `/scan/:id/review`, `/scan/receipt-review`) lost navigation and `ReceiptReviewPage` still used a phone-width wrapper with a fixed CTA at `bottom-0` (would collide with the bottom nav once nav was restored). | Immersive is now camera-only (`/^\/scan\/?$/`); ReceiptReview wrapper removed and its CTA follows the shared nav-clearing offsets. Regression assertion added. |
| 6 | P2 a11y | New auth field components rendered `<label>` without `htmlFor`/`id`, OTP digit inputs had no accessible name, password reveal buttons had no name/state, and inputs had no `autocomplete` (kit screen 02/03 requirements). | `AuthField` uses `useId` + `htmlFor`; every inline auth input gets an id, label association, `autocomplete` (`email` / `current-password` / `new-password` / `one-time-code`); OTP groups get `role="group"` + `aria-labelledby` and per-digit `aria-label`; reveal buttons get `aria-label` + `aria-pressed`; the login/register mode switcher exposes `aria-pressed`. |
| 7 | P2 a11y/motion | `Switch` primitive: description text was not associated (`aria-describedby`), and the thumb animated with `layout` on an absolutely-positioned child (unreliable travel, not governed by the reduced-motion config). | `aria-describedby` wired; thumb is now a transform-driven `animate={{ x }}` spring (deterministic, respects `MotionConfig`). |
| 8 | P2 layout | `BottomCTA` / `StickyActions` primitives pinned to `bottom-0` on mobile, i.e. underneath the 68px bottom nav; the sticky variant also lacked the rail/sidebar offsets. | Both clear the nav on mobile (`bottom-[calc(68px+safe-area)]`) and revert to true bottom at `md+`; BottomCTA offsets for the rail. |
| 9 | P3 honesty | Household page asserted a server "Đang hoạt động" status badge nothing on the server provides. | Badge now states only the session-derived fact ("Hộ của bạn"). |
| 10 | P3 motion | Inventory `AnimatePresence` rows had `layout` but no `initial/animate/exit`, so removals disappeared instantly while insertions shifted — the "stable-key insertion/removal" story was half-implemented. | Added opacity enter/exit alongside `layout`. |
| 11 | test | Screenshot spec waited on `networkidle`, which stalls behind background polling on desktop and hit the 60s budget. | Waits on the main landmark + one settle frame; per-test timeout raised to 180s for the 17-capture loop. |

Reviewed and intentionally left as-is: the centered toast in ReceiptReview
keeps `max-w-md mx-auto` (a centered toast is correct, not a phone shell);
`OnboardingPage`/`HomePage` still link to `/week/setup` and `/week/:id` because
the router redirects them to Planner when the flag is on and they are the
correct targets when it is off; internal `X-Frigo-*` headers and storage keys
stay per rule 11.

Verification after the review fixes: `pnpm lint` PASS, `pnpm typecheck` PASS,
focused UI/auth suites **65/65 PASS**, full `pnpm test` **178 files / 4046
tests PASS**, `pnpm check:migrations` PASS, `pnpm build` PASS
(436.44 kB / 120.93 kB gzip), T17 Playwright at 390 + 1440: 33 passed + the
one screenshot timeout (test-only, fixed, then **6/6** re-verified for the
screenshot and both new regression assertions). `git diff 769d085 -- src/worker`
remains **0 lines** (PayOS/payment untouched).

### Continuation 4b — second pass + first local T13 run

Asked whether the review was truly exhaustive, a second pass added:

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| 12 | P2 truth | `FoodPreferencesPage` saved through `setOnboardingData`, which unconditionally flips `isOnboarded=true` and writes `frigo_onboarded=true` — a client-side onboarding claim the server never made (screen 20: "never touch onboarding completion"). | Uses `setOnboardingFromServer(auth.isOnboarded, draft)` so only preference fields change. |
| 13 | P2 motion | Bottom bar and rail share one `layoutId="t17-nav-indicator"`; both navs are mounted (one is `display:none`), so the shared-layout indicator could animate from/to the hidden nav's zero-size box. | Per-nav indicator ids; indicator marked `aria-hidden`. |
| 14 | P3 a11y | Dev-OTP autofill affordance in `AuthShell` was a clickable `<div>` (no keyboard access/name). | Real `<button type="button">` with `tap-target`, icon `aria-hidden`. |

**First local T13 Playwright run** (`playwright.config.ts`, 20 cases × 360/390/430):
**54 passed / 6 failed** before fixes. Both failures were consistent across all
three widths and were bisected against base `769d085` in a clean worktree:

- `t13b-ownership E` (logout fences a delayed GET) — **T17 regression**: the
  test navigated to `/profile`, which is now a redirect to `/me`, so the
  fixture's exact-URL assertion failed. Test target updated to `/me` (the
  behavior under test — logout resets the private session — is unchanged).
- `t13r-b-presentation C` (Home shows ESTIMATED qualifier) — **pre-existing on
  base, not T17**: it fails identically at `769d085`. Migration 0038 made
  onboarding server-authoritative (`GET /me` → `onboardingCompleted`), so the
  test's `localStorage.frigo_onboarded='true'` shim is overwritten on hydrate
  and `/` redirects to onboarding. Fixed in the test only: it now completes the
  real onboarding flow (same helper pattern as the T17 suite) instead of faking
  state. A first attempt seeded the preview profile as onboarded in
  `scripts/planner-preview-fixtures.mjs`; that was reverted because the T17
  screenshot spec (and the kit's screens 04-06) need the fresh preview user to
  land on onboarding. No product code was changed for this case.

**T13 full re-run: 60 passed / 0 failed (7.8 m)** — the first locally
certified zero-regression result for the rebuilt AppShell (run with the
interim fixture seed; after reverting to the test-flow fix the two affected
cases were re-verified **6/6** at 360/390/430, so the 60/60 result holds).
Harness consumers `tests/e2e/planner-preview.test.mjs` (17/17),
`tests/integration/t13b-preview-fixtures.test.mjs` + `tests/e2e/t07-operations.test.mjs`
(10/10) pass.

**Full T17 six-width matrix after all continuation-4 fixes:** mobile-360
**16/16**; 390/430/768/1024/1440 **82 passed, 2 skipped (by design: the
screenshot spec runs only at 390/768/1440), 1 failed** — the failure was a
second `networkidle` stall in the notifications screenshot (test-only, same
root cause as #11). Fixed by waiting on the query's loading label instead; the
200%-zoom test's `networkidle` was replaced the same way pre-emptively. Both
re-verified **12/12** across all six widths. An earlier full-matrix attempt
showed 1.0 m timeouts at 360 that did not reproduce when 360 ran alone
(16/16) — attributed to a leaked preview server from a killed run holding the
port, not to product code.

Honest residual: this is a *review* pass, not a proof of absence. Areas not
mechanically re-audited in this continuation: WCAG contrast measurements of the
remaining `slate-*` legacy palette (still the largest open gap), screen-reader
walkthroughs of legacy pages, and the 17 canonical screenshots still await
human design review before baselining. Status remains `T17_PARTIAL`.

## Continuation 5 — release preparation (same date)

Preparing the pull request surfaced a **P1 visual defect** while inspecting
the freshly captured desktop screenshot: the sidebar "Quét nguyên liệu" CTA
rendered as an empty white pill. Root cause: the Tailwind `semantic` color
keys were declared camelCase (`actionPrimary`), which Tailwind exposes
verbatim as `bg-semantic-actionPrimary`, while every page uses the kit's
kebab-case utilities (`bg-semantic-action-primary`). Only the single-word keys
(`background`, `surface`, `border`) compiled; **25 of 28** semantic utilities
referenced in `src/web` produced no CSS — so most of the new semantic layer
(text colours, action colours, soft fills, strong borders) was silently
falling through to the browser default on every new screen.

Fix: kebab-case keys in `tailwind.config.js`; a new unit guard
(`takosan-brand.test.tsx › every semantic-* utility referenced in src/web
resolves to a Tailwind color key`) fails against the old config and passes
now. Built-CSS audit after rebuild: **28/28** used utilities present.

This is exactly the class of defect the outstanding "human design review of
screenshots" gap was meant to catch; it was found by inspecting the captures
rather than by any automated gate, which is why that review remains listed as
required before `T17_COMPLETE`.

Verification after the token fix: `pnpm lint` PASS, `pnpm typecheck` PASS,
full `pnpm test` **178 files / 4047 tests PASS** (one new guard), `pnpm build`
PASS, T17 Playwright at 390/768/1440 **51 passed / 0 failed** with fresh
canonical captures inspected (sidebar CTA, active-nav highlight, selected
chips and semantic text now render). Worker diff remains 0.

### Release path (what this branch can and cannot do)

Per `AGENT_RULES.md` rule 19 and `DEPLOYMENT.md`, the agent does not deploy.
The branch is delivered as a pull request into `main`; hosted CI must pass on
the PR and again on the `main` push; staging deploys automatically from `main`
(`wrangler.staging.jsonc` is present); production is a manual
`workflow_dispatch` by an operator under the `production` Environment with
`confirm_production: true`, a full SHA contained in `main`, and the approved
`hardened_sha`. There are **no new migrations** in this branch, so the
separate D1 migration workflow is not required for this release.

## Verification (exact, post-implementation)

- `pnpm lint` — pass (no output).
- `pnpm typecheck` — pass (app + worker).
- `pnpm test` — **178 files / 4046 tests passed** (exit 0), re-run after the
  AuthPage decomposition and animation-utility retirement.
- `pnpm check:migrations` — pass (`migration-smoke=ok`).
- `pnpm build` — pass (vite + worker tsc; index 435.97 kB / 120.74 kB gzip —
  the motion dependency accounts for the increase from 303.48 kB / 77.86 kB).
- `pnpm exec playwright test --config playwright.t17.config.ts` —
  **42/42 passed** at the certified widths (360/430/1024 also green in the
  full-matrix run).
- PayOS/payment certification: `git diff 769d085 -- src/worker` is **empty**
  (zero backend change); `src/web/services/api.ts` billing functions
  untouched; `components/payment/VietQRModal.tsx` diff is 12/12
  presentation-only lines (class names + visible strings) — payment logic,
  endpoints, polling, and grant verification unchanged.
- Test updates (all justified, none weakened): app-shell ancestry test now
  includes the presentation-only MotionProvider (containment ordering
  unchanged); notification-honesty tests wrap the page in MemoryRouter (the
  inbox now links to the preferences route); brand test targets the new
  navigation primitive with the same icon/aria assertions.
- Environment: Node v24.19.0, pnpm 10.26.0; Playwright chromium-headless
  installed in-session (not a repo change).

## DoD evidence (QA/definition-of-done.md)

- [x] 27 screen contracts represented: all 27 registry routes exist (2-6, 19-26
  are the new/reworked surfaces; 16-18 planner covers `:planId` routes).
- [x] One semantic design system + shared primitive authority.
- [x] Mobile/tablet/desktop AppShell; fullscreen exceptions work (suite).
- [~] Required motion works (provider + primitives wired; reduced motion
  verified; auth mode transitions + all overlay/toast entrances now animate
  with reduced-motion-safe utilities). **Gap:** layout animations on inventory
  list / scan crossfade / cooking-step direction and the remaining
  `transition-all` utilities are not yet migrated.
- [x] Settings/account IA separated correctly (suite).
- [x] Planner canonical with Week compatibility redirects (flag-gated,
  params preserved; suite).
- [x] Visible Frigo presentation leaks removed from migrated UI (audit
  grep: zero emerald, zero user-visible "Frigo Plus"; internal identifiers
  retained by rule 11).
- [x] No fake success/data/truth clone introduced; fake household/privacy
  flows removed.
- [x] Auth, Inventory Truth, OCR/AI, recipe authority, planning algorithms
  preserved (full regression green; no service/worker changes).
- [x] PayOS/payment: zero application change (path diff certified above).
- [x] Required regression commands pass.
- [x] T17 Playwright suite passes at all six certification widths;
  canonical screenshots of the surfaces captured at 390/768/1440.
  **Gap:** the full state-class matrix (bottom sheet, long Vietnamese text,
  loading/offline per surface) is covered only partially, and the screenshots
  await human design review.
- [~] Accessibility: h1/heading hierarchy fixed on landing/auth; real links in
  nav/profile; `role=switch`; `aria-pressed` selection; 44px targets.
  **Gap:** a full WCAG-AA contrast/zoom/screen-reader pass per screen is not
  evidenced.
- [x] Audit + this report complete.
- [ ] Worktree clean and branch pushed — see delivery note.
- [x] `main` untouched; no merge; no deploy; production untouched.

## Known gaps → next actions (in order)

1. Finish per-screen semantic-token migration for the remaining
   legacy-styled pages (Home, Inventory, Recipes, Week fallback pages,
   scan/cooking) — 856 `slate-*` occurrences remain; `takosan-*` brand aliases
   are permitted to stay per the kit's legacy-alias rule, but the neutral
   slate palette is not part of the Takosan system.
2. Have a human design-review the captured screenshots; only then baseline
   them (loading-state e2e remains unit-covered only; long Vietnamese text is
   asserted via the 200%-zoom and overflow gates).
3. Execute the T13 Playwright inventory suite in an environment where it was
   never run locally, to certify zero regression against the rebuilt shell.

## Delivery note

Branch pushed to origin as `feat/t17-takosan-ui-v2` (this file cannot contain
its own commit hash). `main` was not modified; no merge or deploy was
performed. `.hoplite/settings.json` carries platform-managed preview metadata
modified by the session environment, intentionally excluded from T17 commits.
