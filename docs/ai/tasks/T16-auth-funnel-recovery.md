# T16 — Auth Funnel Recovery

## Status

`PRODUCTION_DEPLOYED_OTP_RECEIPT_PENDING`

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
