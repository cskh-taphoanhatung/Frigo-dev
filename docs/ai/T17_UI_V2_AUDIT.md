# T17 — Takosan UI V2 audit — 2026-09-19

Pre-edit record required by `03_REPO_BASELINE.md` of the Takosan Redesign OS
v2.0.0 kit. Design contract: attached `takosan-redesign-os-v2.0.0.zip`,
extracted outside tracked paths under `.hoplite/extracted/` (untracked,
git-ignored attachment area).

## Environment record

- Checkout path: `/tmp/hoplite/workspace` (Hoplite thread workspace).
- `git remote -v`: `origin https://github.com/frigo-7/Frigo-dev.git` (fetch/push).
  The kit names `frigo-6/Frigo-dev`; `docs/ai` records canonical repository ID
  `1368281478` resolving to `frigo-6/Frigo-dev`. The GitHub account has been
  renamed/transferred to `frigo-7`; history, task packets, and prior receipts
  match this exact project, so this is the same canonical repository. The kit
  itself says it does not pin a SHA and the org rename is a display identity
  change, not a different codebase. Recorded as an identity note, not a blocker.
- Worktree at audit start: only `.hoplite/settings.json` (platform-managed
  preview metadata, rewritten by Hoplite, excluded from T17 commits) and the
  untracked `.hoplite/extracted/` kit copy. No user work overlaps T17 files.
- Fetched remote `main` SHA (live, after `git fetch origin main`):
  `769d08597563f816ef9c1dd9523fdafb687de3e2` — ahead of the kit's historical
  observation `14f06ff7f3ede72e676e2cb42b9949cca074a070` (T15C/T16 work merged
  since). Per the kit, the live SHA is used and history was not moved.
- Branch created: `feat/t17-takosan-ui-v2` from `769d085` (commit
  `90b6ea1` adds only canonical kit icon assets that the previous brand
  migration had not installed). `main` untouched.
- Node `v24.19.0`, pnpm `10.26.0`, lockfile installed with
  `pnpm install --frozen-lockfile` (no lockfile changes).
- T13 Playwright config: `playwright.config.ts` targets
  `t13b-*.e2e.ts`/`t13r-*.e2e.ts` at 360/390/430 mobile widths via
  `scripts/security-preview.mjs`; T17 coverage must be isolated from it.

## Baseline gates (on `769d085`, before any T17 edit)

- `pnpm lint` — pass (no output).
- `pnpm typecheck` — pass (app + worker configs).
- `pnpm test` — pass: **178 files / 4046 tests**.
- `pnpm check:migrations` — pass through tip `0038_auth_onboarding_completion.sql`.
- `pnpm build` — pass (vite build + worker tsc).
- Known pre-existing debt (not introduced by T17): `pnpm audit --audit-level
  high` reports 21 advisories (6 high) in wrangler/miniflare/jsdom/sharp
  dev/deploy tooling per prior receipts; no browser-bundle impact.

## Routes inventory (current)

| Route | Page | Notes |
| --- | --- | --- |
| `/landing` | LandingPage | public, no forced auth |
| `/auth` | AuthPage | 930-line monolith (login/register/OTP/GG in one file) |
| `/onboarding` | OnboardingPage | single route, internal step state |
| `/` | HomePage | inside AppLayout |
| `/fridge`, `/inventory`→`/fridge` | InventoryPage | |
| `/ingredients/:id`, `/inventory/:id` | IngredientDetailPage | kit target is `/fridge/:id`; today detail lives at `/ingredients/:id` and `/inventory/:id` |
| `/inventory-reconciliation` | ReconciliationPage | |
| `/scan`, `/scan/:id/review`, `/scan/receipt-review` | ScanPage/ScanResultPage/ReceiptReviewPage | |
| `/recipes`, `/recipes/:slug`, `/recipes/id/:id` | RecipesPage/RecipeDetailPage | |
| `/cook/:slug`, `/cooking/:id`, `/cooking/complete` | CookingModePage/CookingCompletePage | fullscreen |
| `/week`, `/week/setup`, `/week/generating`, `/week/:planId`, `/week/:planId/meal/:mealId`, `/week/:planId/shopping`, `/week/:planId/settings` | Week* pages + MealDetailPage | legacy Week surface |
| `/planner`, `/planner/new`, `/planner/:planId`, `/planner/:planId/meal/:slotId`, `/planner/:planId/shopping` | PlannerPage (gated by `VITE_MEAL_PLANNER_ENABLED`) | redirects to `/week` when flag off |
| `/shopping` | ShoppingPage | |
| `/notifications` | NotificationsPage | inbox + device-local toggles mixed in |
| `/profile` | ProfilePage | menu dump; links food prefs → generic `/settings`, planning → `/week/setup` |
| `/family` | FamilySharingPage | |
| `/settings` | SettingsPage | PWA + language + cache + logout mix |
| `/plus` | PlusPaywallPage | visible "Frigo Week Planner" copy; emerald styling |

## Migration map (mandatory audit findings)

| Current file/pattern | Current responsibility | Target authority | Action | Risk/tests |
| --- | --- | --- | --- | --- |
| `AppLayout.tsx` centered `max-w-md sm:max-w-lg md:max-w-2xl` shell | phone-emulation container on desktop | AppShell V2 owns width; mobile bottom nav, tablet rail, desktop sidebar | adapt | all pages gain responsive canvas; T17 visual suite at 360/390/430/768/1024/1440 |
| `BottomNav.tsx` `<button onClick=navigate>` items | nav without real links | one Navigation primitive rendering bottom bar/rail/sidebar with real `<Link>` + `aria-current` | adapt | unit tests for nav semantics; T13 e2e untouched |
| `hideBottomNavPaths` hides nav on `/planner`, `/week/*` | nav lost on planner screens | AppShell keeps nav on standard pages; hide only in immersive contexts (scan/cook/auth/onboarding) | adapt | planner reachable via nav at all widths |
| 28 pages with `max-w-md mx-auto` phone wrappers | per-page width emulation | `Page` primitive requests semantic width; AppShell owns gutters | adapt | visual suite overflow checks per viewport |
| `pages/AuthPage.tsx` 930 lines (login+register+OTP+Google+forgot) | monolith | `features/auth/*` composed by thin page; mode transition with presence | adapt | existing auth unit tests + e2e keep passing; no endpoint/CSRF/Turnstile/GSI change |
| `pages/OnboardingPage.tsx` internal steps | onboarding flow | decompose into step components per kit; server draft authority preserved | adapt | onboarding unit tests; completion redirect unchanged |
| local `Button/Card/Badge/StatusChip/EmptyState/ConfirmDialog/QuantityStepper` in `components/common` | existing shared primitives | keep as the primitive authority; extend to kit semantics (focus ring, loading, sizes) — no parallel family | retain+extend | unit tests around primitives |
| `components/payment/VietQRModal.tsx` "Frigo Plus", "Frigo Week" strings + emerald | payment success UI copy | Takosan Plus naming + semantic tokens; **payment logic zero change** | adapt (presentation only) | PayOS path diff must be zero; manual copy inventory |
| `pages/PlusPaywallPage.tsx` "Frigo Week Planner" copy, emerald pricing | Plus presentation | Takosan Plus value section, real entitlement/price source | adapt | Plus tests; no grant/payment change |
| 15 `emerald-*` usages in tsx | hardcoded legacy green presentation | semantic `action` tokens | adapt | grep gate + visual checks |
| `transition-all`/`animate-in`/`fade-in`/`slide-in` across 21 files | ad-hoc animation classes | motion primitives with token durations; reduce `transition-all` | adapt | reduced-motion suite |
| `/week/*` routes + Week pages; `/planner/*` behind `VITE_MEAL_PLANNER_ENABLED` redirecting to `/week` | competing Week/Planner products | Planner canonical when enabled; Week routes redirect with params preserved; flag-off fallback keeps Week (honor existing deployments) | bridge | legacy-redirect tests: `/week/:planId` → `/planner/:planId`, `/week/:planId/shopping` → `/planner/:planId/shopping`, `/week/:planId/meal/:mealId` → `/planner/:planId/meal/:mealId`, `/week/setup` → `/planner/new`, `/week` → `/planner` |
| `/week/:planId/settings` (WeekSettingsPage) | plan-scoped settings used as global settings | when planner enabled redirect to `/settings/planning`; WeekSetup stays the new-plan flow | redirect | settings tests |
| ProfilePage menu dump (`/profile`) | identity + mixed settings nav | `/me` hub; `/me/preferences`, `/me/household` dedicated screens; `/profile` redirects to `/me` | adapt+redirect | nav tests |
| NotificationsPage inbox + device-local toggles | inbox mixed with delivery preferences | `/notifications` inbox only; `/settings/notifications` preferences (device-local persistence stays, clearly labelled) | adapt | notification tests |
| SettingsPage PWA/lang/cache/logout mix | generic settings | `/settings/app` (PWA/lang/cache/version) + `/settings/privacy` (AI/data) split; `/settings` redirects to `/settings/app` | adapt | settings tests |
| `/family` (FamilySharingPage) | household sharing | `/me/household` authority; `/family` redirects there | redirect | family tests |
| no `/fridge/:id` route | ingredient detail | kit target `/fridge/:id`; keep old paths redirecting | add+redirect | detail tests |
| `styles/frigo-tokens.css` legacy `--frigo-*` aliases | compatibility aliases onto Takosan values | keep until no consumer reads them, then retire after proof | bridge→retire | grep for `var(--frigo-` consumers |
| `public/frigo/*` legacy PNG brand assets | old icons/mark | superseded by `/takosan/*`; retire only when no live consumer | retire after proof | grep + build |
| `services/http.ts` `X-Frigo-Expected-*` headers | internal API contract | internal identifier — keep (rule 11: cosmetic rename forbidden) | retain | integration tests |
| `TakosanIcon.tsx` inline SVG icon set | icon component | keep; extend with kit icon set where nav/feature icons needed | retain+extend | icon rendering tests |

## Duplicate/overlap findings

- Duplicate plan surfaces: WeekDashboardPage/WeekSetupPage/WeekShoppingPage/
  MealDetailPage vs `features/planner` (PlannerShell/PlannerWeek/PlannerMeal/
  PlannerShopping) — two presentation layers over the same plan truth.
- Settings overlap: Profile menu links food preferences to `/settings`;
  SettingsPage mixes PWA, language, cache, logout, privacy copy.
- Notification overlap: delivery toggles live inside the inbox page.
- Modal variants: ConfirmDialog, LogoutDialog, VietQRModal, MealSwapSheet,
  WeekExportModal are separately styled overlay components — one overlay
  authority (Dialog/AlertDialog/BottomSheet) with shared focus semantics.
- Honest-state survey: household invite in FamilySharingPage has no backend
  invite contract — must show unavailable, not a fake success; guest upgrade
  path must keep honest gating; WeekExportModal local text export is real and
  stays labelled as local download.

## Baseline conclusion

Safe to proceed. No stop condition from `03_REPO_BASELINE.md` applies: the
worktree is clean apart from platform-managed `.hoplite/settings.json`
(excluded from T17 commits), remote `main` resolves, and baseline gates pass.
Canonical kit icon assets referenced by `takosan-brand.ts` that were missing
from the earlier brand migration (search, notification, expiry, settings,
budget, nutrition, scan, shopping-list, leaf) were installed in the baseline
commit so existing code paths render the canonical assets.
