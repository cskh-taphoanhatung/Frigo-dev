# Integration test matrix

| Gate | Required evidence | Status |
| --- | --- | --- |
| Production migration hashes | 23 existing path/blob pairs unchanged | PASS |
| Fresh install | All 33 migrations, schema PASS, FK 0 | PASS |
| Production-shaped upgrade | Apply 0001-0023, seed, apply 0024-0033 | PASS |
| Legacy/populated upgrade | No fabricated evidence or row loss | PASS |
| Queue evidence | Missing, 0, .11, .9 through `processScanJob` | PASS |
| Fingerprint + T13 confirm | Fingerprint retained | PASS |
| Replay/idempotency | No duplicate T09 lot/event effects | PASS |
| Receipt/fridge provenance | Survives async queue | PASS |
| T09/T11 authority audit | Unknown writers/readers 0/0 | PASS |
| Takosan shell/brand | Brand unit tests and assets | PASS |
| Static/build | diff, frozen install, lint, typecheck, build | PASS |
| Full Vitest | No material test-count regression | PASS: 3628/3628 |
| Browser last | 60 cases at 360/390/430 | PASS: 60/60 |

No paid provider or production resource is used by this matrix.

## Final certification receipt — 2026-09-15

All mandatory local gates pass at application candidate
`e34ed16777166407acf67b2c76d733d89c7d64ca`:

| Gate | Result |
| --- | --- |
| Frozen install, lint, typecheck, migration smoke, build, diff check | PASS |
| Full Vitest | `3628/3628`, 149 files |
| Real local workerd/D1 | `92/92`, 5 files |
| Focused integration matrix | `102/102`, 6 files |
| Browser last/serial | `60/60`, widths 360/390/430 |
| Production migration hashes | Changed `0` |
| Bridge blob comparison | Mismatches `0` |
| Authority audit | Unknown writers/readers `0/0` |

Permanent regressions are `tests/integration/production-integration-scan-flow.test.ts`
and `tests/integration/production-migration-bridge.test.ts`: they exercise the
real `processScanJob` consumer, missing/zero/.11/.9 evidence, receipt/fridge
provenance, fingerprint retention, T09/T11 confirmation, replay idempotency, and
production-shaped `0023` -> `0024`-`0033` upgrades.

Retained diagnostics: port `8787` was occupied by unrelated PID 954 on the first
browser attempt; the next attempt lacked Chromium and failed before cases;
`pnpm exec playwright install chromium` fixed that, and
`PORT=3100 PREVIEW_API_PORT=8877 pnpm test:browser` passed. Initial audit helper
commands had zsh path/word-splitting mistakes; corrected commands proved zero
changes and ten matches. A concurrent D1 run emitted transient Wrangler temp
noise; the clean serial run passed `92/92`.

**NO HOSTED GITHUB CI STATUS FOR INTEGRATION_APPLICATION_CANDIDATE**

Exact primary commands:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm check:migrations
pnpm build
pnpm test
pnpm vitest run tests/integration/*-d1.test.mjs
PORT=3100 PREVIEW_API_PORT=8877 pnpm test:browser
git diff --check
```

Environment: Node `25.9.0`, pnpm `10.33.2`, Vitest `3.2.7`, Playwright `1.63.0`.
