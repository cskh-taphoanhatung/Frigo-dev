# T16 — Auth Funnel Recovery

## Status

`OTP_SENDER_FIX_RELEASE_CANDIDATE_RECEIPT_PENDING`

## Goal

Restore a single, trustworthy entry funnel for Takosan:

```text
landing
  -> try as guest -> onboarding preferences -> app
  -> account -> auth

auth
  -> returning account -> app
  -> new account -> onboarding preferences -> app
```

OTP delivery must never be reported as successful when no provider accepted the
message. Google Identity Services must use one runtime-configured client ID on
both client and server. Onboarding completion must be server-authoritative so a
returning account is not forced through onboarding on a new browser.

## In scope

- Cloudflare Email Service structured `send_email` API, with Resend fallback.
- Sanitized OTP delivery failures and invalidation of undelivered challenges.
- Registration, resend, and unverified-login UX for failed delivery.
- Runtime Google client ID from `/config`, including server audience validation.
- Query-driven auth entry (`mode=register`, `provider=google`).
- Session-aware landing/auth/onboarding redirects.
- Preferences-only onboarding; remove duplicate auth and unsupported Apple UI.
- Additive D1 persistence for onboarding completion.
- Focused auth/funnel tests, migration checks, browser-sized UX verification.

## Non-goals and fences

- No PayOS, billing, checkout, payment webhook, recipe authority, Inventory
  Truth, or Week behavior changes.
- Preserve HttpOnly cookie sessions, CSRF origin enforcement, Turnstile,
  household isolation, private-session fencing, and deferred guest inventory
  transfer.
- Google production auth remains signed-credential-only.

## Acceptance criteria

1. Native email sends use the structured Email Service API and expose only
   sanitized failure categories in logs/results.
2. An undelivered OTP is unusable, and register/resend/unverified-login never
   claim that it was sent.
3. Frontend and backend consume the same configured Google client ID; missing or
   blocked GIS has a clear retry state without a credential-less fallback.
4. `/auth?mode=register` opens registration and `provider=google` focuses the
   Google entry.
5. Returning onboarded accounts enter the app directly; new accounts enter
   preferences onboarding once.
6. Onboarding contains no login, registration, Google, or Apple chooser and
   persists completion with preferences on the server.
7. Landing and auth redirect authenticated sessions consistently, while guests
   can still try the product without creating an account.
8. Required repository checks and a desktop/mobile interaction pass are recorded
   in the handoff documents.

## Production receipt — 2026-09-19

- PR #34 merged to main `d6c981b1a67001b807f03166109f661bc753728c`;
  exact-head PR CI `35385363064` and exact-main CI `35385844667` passed.
- Production D1 workflow `35386276549` applied only migration 0038 and finished
  at ledger 38/tip 0038 with Time Travel bookmark
  `000000d3-00000000-000050ea-709daab542439d8e8fab731b65dab714`.
- Production Deploy `35386532369` succeeded on Worker
  `c0161a22-1987-42dd-99c4-0a5874d4fadb`, exact main SHA, while preserving
  recipe authority `shadow`, canary `0`, cutover `false`.
- Production desktop/mobile smoke passed Google provider launch and the complete
  guest onboarding path with secure cookie attributes and preference persistence.
- Real OTP delivery remains unverified because automated Turnstile did not yield
  a token; no OTP request or email receipt is claimed.

## CSP follow-up

Production browser verification exposed missing explicit CSP origins for Google
Fonts, Google GSI styles, and Cloudflare Web Analytics. Commit
`79dfca6483d90fcf33380acfe33f880c1e6ff7a5` fixes only those allowlists and adds
unit coverage, with no wildcard or script `unsafe-inline`. Full local gates pass
at 174 files / 4002 tests. PR #35 head
`c14a3755d95ddae316d5e6636ef85f9784ac4a54` passed CI `35388666150`, merged as
main `0cb5d2c08fa24479ecce6b4c4e5f73b31a920ff5`, and exact-main CI
`35388963509` passed.

Production hotfix Deploy `35389274233` succeeded on Worker
`e8164168-9566-475b-b0fa-7508368bf3e7`, preserving `shadow/0/false` and ledger
38/tip 0038. Independent mobile/desktop verification found the exact SHA, loaded
fonts and Google iframe, no overflow, and no CSP console violation. Cloudflare
Insights was allowlisted but unreachable from the verification network.

The only remaining T16 acceptance evidence is a real OTP receipt. Automated
headed/headless Chrome could render the real Turnstile checkbox but could not
obtain a token, so no OTP request was sent. Complete one manual forgot-password
request in a normal browser and confirm arrival without exposing the OTP.

## OTP resend and guest account gate follow-up — 2026-09-19

A remote-binding diagnostic reproduced the delivery failure as
`email sending not authorized for subdomain 'frigo.tungjpstore.net'`. The
Cloudflare Email Service onboarding applies to `tungjpstore.net`, not the
`frigo.tungjpstore.net` subdomain. A harmless diagnostic sent through the same
binding from `no-reply@tungjpstore.net` was accepted and returned a provider
`messageId`; this is provider-acceptance evidence only, not a real OTP receipt.

Implementation commit `31006994849ee9f6d78ae6114f82d77d41efc784`
therefore uses the apex sender, maps the known provider
message to `sender_not_verified`, keeps resend usable during optional KV
cooldown outages, clears cooldown after failed delivery, and requires a new
Turnstile token before each resend. Guest sessions can open auth; account-bound
Plus UI hides all prices/payment controls and links to
`/auth?mode=login&returnTo=%2Fplus`; successful login returns an onboarded
account to Plus. Authenticated pricing remains unchanged and protected payment
code is untouched.

Verification: focused **86 tests / 4 files**, full **176 files / 4008 tests**,
lint, typecheck, migration smoke, build and diff check PASS. Browser checks at
390x844 and 1440x1000 confirm guest price/payment suppression, login routing,
auth access and safe return-to behavior. Production is still the prior CSP
hotfix release with D1 38/0038 and recipe `shadow/0/false`; merge, deploy and a
real inbox receipt are pending.

## PWA cache and Google recovery follow-up — 2026-09-19

Live production returned cache hits for both `/auth` and `/sw.js`, and the
worker body still declared fixed cache `takosan-pwa-v2`. The app registered
`/sw.js`, while the only worker-specific cache rule targeted
`/service-worker.js`. A clean Chromium profile loaded GIS and opened the real
Google account popup, so the remaining affected-browser failure was isolated to
stale or locally blocked client state.

The recovery candidate injects the immutable release SHA into the worker and
cache name, registers the SHA-qualified URL with `updateViaCache: none`, checks
on load/online/foreground, removes only prior Takosan release caches and
navigates existing same-origin clients once after an update. HTML and `/sw.js`
are no-store; hashed assets explicitly remove inherited no-store and stay
immutable. The deploy workflow builds with the exact SHA and its post-convergence
smoke verifies live cache headers and the SHA embedded in the worker. Google GIS
now receives a valid numeric button width and its script retry exposes failure
and recovery deterministically.

Verification: focused **116/116**, full **178 files / 4046 tests**, lint,
typecheck, migration smoke, build, shell syntax and diff check PASS. Local
Wrangler proved the effective header policy. A two-release Chromium exercise
showed one clean-install document request and exactly one document navigation
on upgrade; the controller and sole Takosan cache then matched the new SHA.
The refresh of an already-open legacy tab is necessarily best-effort because
awaiting a same-client navigation during Service Worker activation deadlocks
that navigation. Reopening, reloading, or navigating always performs a fresh
worker check; after this recovery release, the new bundle also checks on load,
online recovery, and foreground return. No deployment can force a browser that
is closed, suspended, or prevented from running its Service Worker to reload.
The separately executed non-gate `pnpm audit --audit-level high` reports 21
existing lockfile advisories (6 high) under Wrangler/Miniflare, jsdom and
build-time sharp; no dependency changed in this follow-up and remediation is
deferred to a separately reviewed dependency upgrade.
No migration, production data, payment, recipe-authority or Canary change is
included. Protected production deployment must preserve `shadow/0/false`.

## PWA cache and Google production receipt — 2026-09-19

- PR #42 head `54dd81b3ba260843ed39d625c8e0b7c2f4cef831` passed exact-head CI
  `35415335137` and merged as main `6a016f185cae9c51ab5a1fc873a8a05a10a57edd`.
- Exact-main CI `35415536459` and automatic staging Deploy `35415763483`
  passed, including the new exact-SHA/header smoke.
- Protected production Deploy `35415843682` passed local gates, read-only
  schema/ledger gate, exact-SHA convergence and post-deploy smoke. Cloudflare
  Worker version is `2f228dc9-d97b-4eb1-8cff-9a0f2df3b51c`.
- Production remains D1 ledger 38 / tip `0038_auth_onboarding_completion.sql`
  and recipe authority `shadow / 0 / false`; no migration or customer-data
  mutation was performed.
- Independent public verification found readiness commit equal to main,
  database/queue OK, `/auth` and `/sw.js` no-store, exact SHA embedded in the
  worker, and hashed assets immutable. Cloudflare Assets can label the current
  `/auth` edge response `HIT`; the response body is the new release and browser
  storage is prohibited by `no-store`.
- A clean Chromium profile loaded GIS with the configured client ID, opened the
  real `accounts.google.com` account chooser, and showed the exact-SHA worker
  controller with only cache `takosan-pwa-6a016f185cae9c51ab5a1fc873a8a05a10a57edd`.
- Remaining manual evidence: receive one real OTP email without exposing its
  code. Closed/suspended/browser-blocked legacy tabs still require
  reload/reopen/navigation before any deployment can update them.
