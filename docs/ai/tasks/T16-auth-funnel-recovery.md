# T16 — Auth Funnel Recovery

## Status

`DEVELOPMENT_COMPLETE_READY_FOR_REVIEW`

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

- No production deploy, migration dispatch, Worker setting mutation, or Email
  Service domain onboarding in this task.
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
