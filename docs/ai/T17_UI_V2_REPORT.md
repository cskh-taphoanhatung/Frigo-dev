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

1. Migrate per-screen motion to the shared primitives (inventory list layout,
   scan crossfade, cooking step direction, planner layout) and replace the
   remaining indiscriminate `transition-all` utilities with scoped properties.
2. Extend the state-class matrix (bottom sheet, long Vietnamese text,
   loading/offline per surface) and have a human design-review the captured
   screenshots; only then baseline them.
3. Finish per-screen semantic-token migration for the remaining
   legacy-styled pages (Home, Inventory, Recipes, Week fallback pages,
   scan/cooking) — these currently still use `takosan-*`/`slate-*` classes.

## Delivery note

Branch pushed to origin as `feat/t17-takosan-ui-v2` (this file cannot contain
its own commit hash). `main` was not modified; no merge or deploy was
performed. `.hoplite/settings.json` carries platform-managed preview metadata
modified by the session environment, intentionally excluded from T17 commits.
