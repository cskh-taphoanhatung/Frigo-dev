# T17 — Takosan UI V2 report — 2026-09-19 (final HEAD evidence)

Task: T17 Takosan UI V2 Full Product Redesign per the Takosan Redesign OS
v2.0.0 design contract. Branch `feat/t17-takosan-ui-v2`, PR #44 into `main`.
T17 base: remote `main` `769d08597563f816ef9c1dd9523fdafb687de3e2`.

Every statement below describes the **final HEAD of this branch only**.
Superseded intermediate claims from earlier continuations were removed rather
than annotated; the commit list is the history.

## Status: `T17_PARTIAL`

Everything the contract asked for that could be verified inside this sandbox
is implemented, mechanically certified and recorded here. Two Definition-of-
Done items cannot honestly be ticked at this HEAD and are named exactly under
"Remaining blockers". Nothing in this report is marked PASS unless the
command in the "Verification" section was executed at the recorded HEAD.

## Repository / PR identity (verified live)

- Canonical repository id `1368281478` → `tako-san1/Frigo-dev` (GitHub API,
  `gh api repositories/1368281478`; `default_branch=main`, not a fork). The
  task text named `frigo-7/Frigo-dev`; the earlier audit recorded
  `frigo-6` → `frigo-7`. All three are renames of the same id-stable
  repository; history and receipts match.
- PR #44 head at continuation start: `221648477cd720fa2150a3673a8f874f3d491bf4`
  (11 commits over base). All prior T17 commits preserved; this continuation
  adds commits on top (see "Commits").
- Pre-continuation baseline on `2216484`: `pnpm lint` PASS, `pnpm typecheck`
  PASS, `pnpm test` 178 files / 4047 tests — **1 timeout** in
  `client-session.test.ts › does not repopulate Week memory…` (5 s budget,
  concurrent with a Playwright browser download); the file re-run alone passed
  **33/33**, so the baseline is treated as green with a noted flake.

## Contract availability (limitation)

The user-attached `takosan-redesign-os-v2.0.0.zip` was **not present in this
sandbox** (no attachment mount; the earlier extraction under
`.hoplite/extracted/` did not survive the workspace rebuild). Reconciliation
therefore used the contract facts already recorded in-repo — the audit's route
inventory and migration map, the kit document names and screen numbers cited
in code comments (`02`, `03`, `04-06`, `09`, `19-26`), the DoD checklist items
quoted in the previous report, and the explicit requirements in the task text
(`/auth/verify`, canonical `scan-review`, reduced-motion surfaces, WCAG-AA,
27 registered screens). The 27-entry registry used for certification is in
`tests/e2e/t17-ui/screen-registry.ts`; entries whose number is recorded in-repo
are tagged `source: 'kit'`, the rest `source: 'reconstructed'`. Anyone holding
the ZIP can diff that file against `SCREEN_REGISTRY` in one pass.

## Commits in this continuation

- `dfdd0ab` — `/auth/verify` route, semantic-token migration, sheet/dialog
  semantics, registry/state/motion/a11y certification suites.
- `227e36b` — visual-review fixes (canvas width cap, aligned fixed bars,
  Plus/cooking width tokens, 44 px brand links, honest OTP subtitle).
- `8f25fbd` — cooking header title shrinks within 390 px (found by the
  registry overflow gate during the matrix run).
- `463bf29` — chip rails never shrink chips (Recipes/Inventory/Home filter
  rails were clipping labels at 390), rail labels truncate, status chips stay
  single-line; a11y spec audits the settled receipt-review state.
- docs checkpoint (this file, audit, CURRENT_STATE, TASK_BOARD, HANDOFF) —
  the commit after `463bf29` in `git log`.

## 1. Screen 03 — `/auth/verify` (contract discrepancy closed)

Finding: the registry requires `/auth/verify`; the router exposed `/auth`
only and OTP was an internal `AuthPage` mode. Fix (no security change):

- `App.tsx` registers `/auth/verify` with the **same** session guard as
  `/auth` (signed-in non-guest → `/` or `/onboarding`).
- `AuthPage` derives `mode = 'otp_verify'` from the route; the other modes stay
  component state. Registration / unverified-login enter verification by
  `navigate('/auth/verify')`; Back leaves with `replace` to `/auth`.
- `features/auth/verify-context.ts`: tab-scoped (`sessionStorage`)
  `{ email, resendAvailableAt, delivered }`. **Never** stores the OTP code,
  the dev OTP or a token; corrupt/missing values read as absent. It exists
  only so refresh/back/forward does not strand the user; the server remains
  the sole authority on code validity.
- `features/auth/VerifyUnavailable.tsx`: direct load with no context renders
  an honest "Không có yêu cầu xác thực đang chờ" note with real exits
  (register / login). No OTP form, no request is issued for an unknown user.
- Undelivered email (`OTP_DELIVERY_UNAVAILABLE`, `otpDelivered:false`) is
  persisted as `delivered:false` so a refresh cannot upgrade "not sent" into
  "sent": cooldown 0, error alert shown, resend enabled.
- `AuthShell` subtitle no longer prints "đã gửi tới " with an empty email.

Unchanged: Turnstile single-use tokens, `api.verifyOtp`/`resendOtp` bodies,
DEC-012 guest-transfer deferral, private-session capture, exact server error
mapping. `git diff 769d085 -- src/worker` = **0 lines**.

Tests — `tests/unit/auth-verify-route.test.tsx` **14/14**: direct load without
context (no form, no request, both exits); registration → `/auth/verify` with
60 s cooldown and code-free context; refresh restores email + cooldown and
completes against the server, context cleared after success; undelivered
context shows the delivery error and enables resend; six-digit typing / focus
advance / non-digit rejection / Backspace-back; paste of `" 49-38 17abc"` →
`493817` with focus on the last box; short submit refused locally with alert
and no request; wrong/expired code shows the exact server error and stays on
the route; resend locked during cooldown, then re-requests same email+purpose
and restarts the cooldown; `OTP_DELIVERY_UNAVAILABLE` on register reaches the
route honestly; failed resend keeps resend available; Back clears context so
re-entry is honest; corrupt storage treated as absent. Existing suites
`auth-funnel-ui`, `auth-resend-turnstile`, `auth-guest-transfer-deferred`
(router now declares `/auth/verify`), `auth-google-credential` pass.

## 2. Mechanical certification of the 27 registered screens

`tests/e2e/t17-ui/t17-registry.e2e.ts` walks every registry entry in the real
router: public screens without a session (01–03; 03 asserts the honest empty
state and zero OTP inputs), onboarding steps 04–06 by route, then on real
seeded truth: onboarding completed through the UI, T13 scan evidence seeded
(`t13-scans`) for screen 09, a plan generated through the planner for 16–18
(the meal route is followed from the plan's real link), catalog slug
`canh-chua-ca-loc-nam-bo` for 13/14, seeded lot `preview-stock-egg` for 11.
For each: visible proof (h1 / label / test id), navigation rule (visible on
standard screens, absent on immersive ones), no horizontal overflow. Asserts
27 distinct ids and attaches `screen-registry-results` JSON. A second test
certifies legacy redirects (`/profile`, `/family`, `/settings`, `/inventory`,
`/week`, `/week/setup`) land on registered screens.

Result: **PASS at all six widths** (see Verification).

## 3. Semantic-token migration

- Codemod `scripts/t17/migrate-semantic-tokens.mjs` (explicit map, word-
  bounded class tokens only; never touches identifiers, storage keys, headers,
  `frigo-assets.ts` or the payment UI): **991 replacements in 55 files**.
  Remaining dark-context and status-hue sites were migrated by hand
  (`semantic-overlay/*` scrims, `text-white` on green heroes, `takosan-yellow`
  for the torch/upgrade accents, `text-semantic-text-inverse` dark chips).
- Two arbitrary hex values removed (`hover:bg-[#164E3D]` →
  `takosan-green-hover`; `text-[#FACC15]` → `takosan-yellow`).
- Tokens added (mirrored in `takosan-tokens.css` and `tailwind.config.js`):
  `semantic-overlay` (kit scrim colour), `semantic-warning-strong` `#8F5307`,
  `semantic-danger-strong` `#B53434`; `semantic-text-muted` darkened from the
  kit's `#7B776F` (4.24:1 on background — fails AA body text) to `#6F6B64`
  (5.04:1). These are the only deviations from kit values and are documented
  as contrast corrections.
- Residual authority: `scripts/t17/style-residuals.mjs` scans `src/web` for
  raw palette classes, arbitrary colour values and legacy motion utilities and
  fails unless each hit matches an allowlist entry with a written reason.
  Enforced by `takosan-brand.test.tsx`. **Result: total=43, allowlisted=43,
  unjustified=0.** The single allowlist entry is `payment-boundary`
  (`components/payment/VietQRModal.tsx`, 43 occurrences): the PayOS/payment UI
  is a protected boundary (AGENT_RULES rule 7); this continuation added **0
  lines** to it. Zero `emerald-*`, zero `transition-all`, zero
  `animate-in|zoom-in-95|slide-in-from-*` in `src/web`.
- `rg -o 'slate-[0-9]+' src/web | wc -l` → **41** (all in the allowlisted
  payment file; 856 before).

## 4. Visual-regression contract

`t17-screenshots.e2e.ts` canonical loop now captures **25 surfaces** at
390/768/1440: landing, auth, onboarding, home, inventory, **scan**,
**scan-review**, **receipt-review**, recipes, recipe-detail, cook, planner,
shopping, **notifications**, profile, preferences, **household**,
planning-settings, notification-preferences, privacy, app-settings, plus,
**otp-empty** (+ logout-dialog, notifications-empty from the existing tests).
State evidence (`t17-states.e2e.ts`, deterministic, seeded preview, network
shaped with Playwright routes/controls — never production): loading (held
inventory read → announced `role=status`), error (armed synthetic 500 →
`role=alert` + retry recovers), empty (shopping/notifications honest empties),
offline (banner from `offline`/`online` events), bottom sheet (labelled
`role=dialog`, focus in, Tab cycling, Escape, focus return), destructive dialog
(`alertdialog`, cancel focused first, danger styling, Escape + focus return),
long Vietnamese text (93-char name through sheet → list → detail with no
overflow), keyboard focus (Tab order over /me: only interactive elements, each
with a visible ring), mobile fixed action (scan-review CTA above the bottom
nav; stays inside a 55 %-height viewport with an input focused — the
virtual-keyboard proxy available headlessly).

Captures are preserved per width under
`.hoplite/artifacts/t17-cert/canonical/<width>/*.png` and
`.hoplite/artifacts/t17-cert/states/<width>/*.png` (private artifact dir).

## 5. Reduced-motion certification

`t17-reduced-motion.e2e.ts` emulates `prefers-reduced-motion: reduce` and, on
auth (login/register/`/auth/verify`), onboarding (3 steps), inventory sheet +
logout dialog, cooking (next/back), planner (setup → generated week →
shopping) and scan review, asserts: the surface is usable, **no CSS keyframe
animation is running** (spinners excluded — they signal progress) and **no
spatial transition (`transform`/`all`/`width`/`height`) longer than 200 ms is
declared**. Product changes this required: `animate-pulse/bounce/ping` and
`transition-tap/transition-transform` collapse under the media query
(`index.css`). Animation is never part of functional logic — the timer,
step index and plan truth are asserted independently.

## 6. Accessibility certification

Measured, not asserted:

- **Contrast** — `scripts/t17/contrast-audit.mjs` computes WCAG ratios for 33
  semantic pairs read from `tailwind.config.js`: **33/33 pass** (text ≥ 4.5,
  UI ≥ 3.0). Lowest text pair: `action-primary on background` 4.75;
  `text-muted on background` 5.04 after the correction above. `border-strong
  on surface` 1.77 is reported as *decorative* (inputs also change fill and
  show a 3 px focus ring). Translucent white body copy on green heroes
  (`text-white/80-90`, 3.8–4.4:1) was made solid white (5.0:1+).
- **axe-core** (`@axe-core/playwright` 4.10.2, tags wcag2a/2aa/21a/21aa +
  best-practice) over 25 surfaces + the OTP flow: **0 serious/critical
  violations** at final HEAD. Fixed on the way: `meta viewport` had
  `maximum-scale=1, user-scalable=no` (WCAG 1.4.4 critical → removed);
  onboarding progress grid carried `aria-label` on a `div` → `role=progressbar`
  with value attributes; scan-review outline button text 3.9:1 → primary text;
  preferences chips → `*-strong`/`hover` shades.
- **Heading structure** — exactly one `h1` per canonical surface (Fridge,
  Recipes, Cook and Scan had none; fixed — Scan uses `sr-only`).
- **Image alternatives** — 0 `<img>` without `alt` on any surface; scan
  preview alt made descriptive.
- **44×44 targets** — every interactive element measured ≥ 44 px (counting a
  positioned `::before` hit-area on the Switch). Fixed: TopBar/Header icon
  buttons 36→44, rail/sidebar brand link 32→44, onboarding cuisine chips,
  Home "Không mua thêm gì", Profile "Nâng cấp", auth "Quên mật khẩu?",
  receipt-review inputs/selects 34→44.
- **Dialog/sheet semantics** — shared `design-system/use-modal-focus.ts`
  (focus in, Tab trap, Escape, focus return) now drives `ConfirmDialog`, the
  new `BottomSheet` primitive (inventory add, scan manual-add), `MealSwapSheet`
  and `WeekExportModal`; all expose `role=dialog|alertdialog`, `aria-modal`,
  `aria-labelledby`. Inventory add-sheet fields are label-associated; expiry
  chips are a labelled group with `aria-pressed`.
- **OTP announcements** — digits are a `role=group` labelled "Mã OTP 6 chữ số"
  with per-digit names, `inputmode=numeric`, `autocomplete=one-time-code`;
  delivery outcome is a `status` (sent) or `alert` (not sent); short-submit
  and server errors are `role=alert`; success is `role=status`.
- **200 % zoom, keyboard order, visible focus, non-colour state** — covered by
  `t17-ui.e2e.ts` (200 % on 5 surfaces), `t17-states.e2e.ts` (Tab order +
  ring), status chips carry text labels not only colour, `aria-current` on
  nav, `aria-pressed` on toggles.
- **Not executed** (recorded honestly): a human screen-reader walkthrough
  with NVDA/VoiceOver. Semantics were verified through the accessibility tree
  (axe + role queries) only.

## 7. Human visual review of captures (390 / 768 / 1440)

Reviewed by inspecting the freshly captured PNGs at final HEAD. Fixes made
before baselining (none blindly accepted):

- Desktop canvas stretched reading lines edge-to-edge → `AppLayout` caps the
  content canvas at `--content-wide` (75 rem) and centres it.
- Fixed action bars spanned the full viewport, detached from content → inner
  content of all seven fixed bars capped to the same width; inventory floating
  CTA clears the nav/rail and is right-aligned auto-width on desktop.
- Plus page still used a `max-w-md` phone wrapper (clipped TopBar on desktop)
  → `--content-compact`; cooking wrapper likewise; auth shell keeps its narrow
  form column by design.
- Cooking header title truncated at 180 px on desktop → responsive max width.
- Home "use soon" chip showed UNKNOWN expiry in warning tone → neutral tone
  (UNKNOWN ≠ warning; ESTIMATED = info; KNOWN countdown = warning).
- Boards vs truth: the boards were unavailable in this sandbox (see
  "Contract availability"), so the review used the per-screen contracts as
  recorded in-repo and Takosan brand rules. Screenshots are **not** baselined
  as golden images; they are evidence for the human reviewer holding the
  boards.

## Verification (exact, at final HEAD)

Environment: Node v24.19.0, pnpm 10.26.0, Playwright 1.63.0 chromium
headless-shell (installed in-session), `sqlite3` 3.45.1 installed via the
repo setup script's own `apt-get` line (sandbox lacked it).

| Gate | Command | Result |
| --- | --- | --- |
| Lint | `pnpm lint` | PASS |
| Typecheck | `pnpm typecheck` | PASS (app + worker) |
| Unit/integration | `pnpm test` | **179 files / 4062 tests PASS** (+1 file, +15 tests vs. start) |
| Migration smoke | `pnpm check:migrations` | PASS (`migration-smoke=ok`) |
| Production build | `pnpm build` | PASS — `index-*.js` 437.01 kB / 121.08 kB gzip |
| Style residuals | `node scripts/t17/style-residuals.mjs` | total 43 / allowlisted 43 / unjustified 0 |
| Contrast | `node scripts/t17/contrast-audit.mjs` | 33/33 pass |
| Raw greps | `rg emerald- src/web` / `rg transition-all src/web` / `rg 'animate-in\|zoom-in-95\|slide-in-from' src/web` | 0 / 0 / 0 |
| T17 suite 360×800 | `playwright test --config playwright.t17.config.ts --project mobile-360` | **35 passed / 1 skipped (by design) / 0 failed** |
| T17 suite 390×844 | `… --project mobile-390` | **36 passed / 0 failed** |
| T17 suite 430×932 | `… --project mobile-430` | **35 passed / 1 skipped (by design) / 0 failed** |
| T17 suite 768×1024 | `… --project tablet-768` | **35 passed / 1 skipped (by design) / 0 failed** |
| T17 suite 1024×768 | `… --project desktop-1024` | **34 passed / 2 skipped (by design) / 0 failed** |
| T17 suite 1440×900 | `… --project desktop-1440` | **35 passed / 1 skipped (by design) / 0 failed** |
| Canonical captures | part of the 390/768/1440 runs above | 25 surfaces × 3 widths preserved under `.hoplite/artifacts/t17-cert/canonical/` |
| T13 inventory suite | `pnpm exec playwright test` (playwright.config.ts, 20 cases × 360/390/430) | **60 passed / 0 failed** (7.4 m) |
| Worker boundary | `git diff 769d085 -- src/worker` | **0 lines** |
| Payment boundary | `git diff 769d085 -- src/web/components/payment src/web/services` | `VietQRModal.tsx` 16+/16− presentation-only lines from earlier T17 commits (class names, "Takosan Plus" copy); **0 lines added by this continuation**; services untouched |
| Whitespace | `git diff --check` | clean |
| Worktree | `git status --short` | clean after the docs checkpoint (only the platform-managed `.hoplite/settings.json` may show as modified in-session; it is restored and never committed) |

Skips by design: the mobile-only fixed-action test skips at ≥768 (1 skip at
768/1440, 2 at 1024 together with the screenshot skip); the canonical
screenshot test skips at 360/430/1024 (captures are 390/768/1440 per the
visual-regression plan). All six widths were run **after** the last product
commit `463bf29`; the 390/430 runs in the first matrix pass caught the cooking
header overflow (`8f25fbd`) and the a11y run at 390 caught the transitional
receipt-review CTA frame (test-only wait), both re-verified green.

Test changes (justified, none weakened): `t13b-browser.e2e.ts` UNKNOWN-expiry
class assertion `bg-slate-100` → `bg-semantic-border/60` (+ asserts not
mint/emerald) because the token migration renamed the class, not the
behaviour; `auth-guest-transfer-deferred.test.tsx` declares the new
`/auth/verify` route in its MemoryRouter.

## DoD evidence (QA/definition-of-done.md)

- [x] 27 screen contracts represented — mechanically certified per width
  (`t17-registry.e2e.ts`), including `/auth/verify`.
- [x] One semantic design system + shared primitive authority — residual audit
  zero-unjustified; `BottomSheet`/`useModalFocus` shared.
- [x] Mobile/tablet/desktop AppShell; fullscreen exceptions (suite).
- [x] Required motion works; reduced motion certified on auth, onboarding,
  sheet/dialog, cooking, Planner (+ scan review).
- [x] Settings/account IA separated correctly (suite).
- [x] Planner canonical with Week compatibility redirects (suite).
- [x] Visible Frigo presentation leaks removed (greps; seeded display name
  "Frigo Preview" is fixture data, not UI copy).
- [x] No fake success/data/truth clone introduced; `/auth/verify` without
  context is an honest empty state.
- [x] Auth, Inventory Truth, OCR/AI, recipe authority, planning algorithms
  preserved — worker diff 0; full regression green.
- [x] PayOS/payment: zero application change; payment UI untouched by this
  continuation.
- [x] Required regression commands pass (table above).
- [x] T17 Playwright suite passes at all six widths; canonical `scan-review`
  captured; state matrix evidenced.
- [~] Accessibility: contrast measured, axe clean, headings/alt/targets/
  dialogs/OTP semantics verified. **Not executed:** assistive-technology
  walkthrough (screen reader).
- [~] Human design review against the **three Takosan boards** — the boards
  (in the ZIP) were not available in this sandbox; captures were reviewed
  against in-repo contracts and fixed, but the board comparison itself is
  outstanding.
- [x] Audit + this report reflect final HEAD only.
- [x] Branch pushed to `feat/t17-takosan-ui-v2`; `main` untouched; no merge;
  no deploy; production untouched.

## Remaining blockers (why not `T17_COMPLETE`)

1. **Board comparison** — a reviewer with the ZIP must compare
   `.hoplite/artifacts/t17-cert/canonical/{390,768,1440}/*.png` against the
   three Takosan boards and `screens/*.md`, and diff
   `tests/e2e/t17-ui/screen-registry.ts` against `SCREEN_REGISTRY`.
2. **Screen-reader walkthrough** — NVDA/VoiceOver pass over the canonical
   surfaces (automated semantics are clean; the human check is unexecuted).

## Known limitations

- Kit ZIP absent in sandbox (above). Contrast corrections to `text-muted`,
  `warning-strong`, `danger-strong` deviate from kit hexes for AA compliance.
- Virtual keyboard is approximated by a reduced-height viewport; real
  `visualViewport` resize on device is not reproducible headlessly.
- The payment UI keeps 43 raw neutral classes by explicit allowlist.
- Screenshot PNGs live in the private artifact directory, not in git.
