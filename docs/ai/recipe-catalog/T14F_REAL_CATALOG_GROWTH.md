# T14F real catalog growth — T14F-A pilot certification

## Current result — T14F_PILOT_CERTIFIED / T14F_SCALE_NOT_STARTED

The T14F-A task ends at the existing **101-recipe pilot**, not Batch B or 500 recipes.
All local pilot gates and exact implementation CI pass. Final certification is bound
by the [PR #25 receipt](https://github.com/frigo-4/Frigo-dev/pull/25#issuecomment-5714709031):
it records the final documentation SHA and its own hosted validate SUCCESS after
publication. A handoff cannot embed its own commit hash; use that receipt's
`T14F_PILOT_CERTIFIED_HEAD`, never an earlier implementation SHA, for future T14F-B.
Exact commands, immutable hashes and recovery protocol: `T14F_NEXT_HANDOFF.md`.

### T14F-A recovery and failure reproduction

Re-fetched numeric repository metadata (1368281478 = `frigo-4/Frigo-dev`), explicit
main/head refs and PR #25. Main is still `f0c229f2…`; branch `hoplite/massalia-c2862d7c`.
Actual start `8079a3717f9f6996ae4c98eb375c32fc1ca3e946` was inspected in full: it is
the compatible automated test-only routing fix beyond requested `585e718f…`, not
an application/catalog/migration change. Preserved the local-only settings delta.

Reproduced the pre-fix routing file in a disposable archive of `585e718f…`, without
checking the live branch backward: **5/7 pass**, line 114 D1 counter 0; line 247
second read `[5]` instead of `[]`. A separate unmocked diagnostic confirmed:
fixture count 71; shipped manifest 101; configured/selected D1, actual static;
`COUNT_DRIFT`; repeated batches `[5,5]`, D1 counter 0, static/fallback counters 2.
This was correct production fail-closed behavior, not corrupt pilot content.

### Test-local remediation and certification

Only `tests/integration/recipe-authority-routing.test.ts` changes in T14F-A:
inherited `8079a37` generates the historical release via real
`composeCatalogRelease(ALL_RECIPES, [])`; `2ee6f5cc0e144e5c522ce91bd005ab61dc124ed5`
verifies its 71/71 counts, zero imports, exact ID order and certified fingerprints,
explicit configured/selected/actual source and fallback diagnostics, and cleanup.
HTTP counters protect all parity comparisons against fallback masquerading as D1.
Inside-canary uses D1; outside stays static without content reads. Valid first read
is `[5]`, next cached HTTP operation `[]`; semantic drift still falls back with
`LEGACY_BASELINE_DRIFT` and two `[5,5]` reads, proving no verified cache.

| Executed verification | Result |
| --- | --- |
| Routing suite | 1 file / 8 tests PASS |
| Real, unmocked shipped-101 growth suites | 2 files / 21 tests PASS |
| Routing + growth together, twice | 3 files / 29 tests PASS each |
| Independent serial `--no-isolate` routing + growth | 3 files / 29 tests PASS |
| Authority/readiness/parity/media/import/Inventory Truth focused suites | 12 files / 383 tests PASS |
| Seed check, import check, typecheck, lint, migration smoke, build | All PASS |
| Full `pnpm test` | 171/171 files; 3911/3911 tests PASS |
| `git diff --check` | PASS |
| Exact implementation CI | 35223589293 / validate 105209475052 SUCCESS |

Full local test run: **2026-09-17 12:53:15 UTC**, **389.75 seconds**. Local evidence
is under `.hoplite/artifacts/t14f-a/`. The inherited invalid-D1 regression adds one
test; 8/29/3911 replace the packet's historical 7/28/3910 counts without removing
or weakening an assertion. Independent review found no P0/P1/P2 blocker.

All runtime evidence below was renewed by the focused/full suites: 101 complete,
order 0..100, FK/quick checks, five-statement reader, static/shadow/canary/full-D1,
and real local HTTP imported recipe flows. No browser/production verification is
claimed. Hash checks show protected pilot files unchanged vs `585e718f…`, exact
0036 SHA-256 unchanged, and 0001–0035 byte drift 0 vs certified main. Timestamp fix
`486409c…` remains intact. No runtime/readiness change; T09/T11 unchanged, no new
inventory writers/readers. Final-head CI binding is recorded in the receipt above.

**STOP.** T14F-B needs separate authorization. No ingredient scale preflight, Batch B,
0037, 500 manifest, production write/deploy/authority switch, media population or
T14G. PR #25 remains draft/open/unmerged; overall T14F is not development-complete.

## Historical takeover verification (superseded by T14F-A above)

## Recovery identity

Verified GitHub repository ID **1368281478**, current full name **frigo-4/Frigo-dev**.
The old handoff's `frigo-3` display name and intermediate branch/SHA are historical.

```text
certified_base=origin_main=f0c229f2e2b134904a8c0e355479394cbf53c954
resume_branch=hoplite/massalia-c2862d7c
expected_resume_head=actual_resume_head=aa7ca6ae426eb784cf5d1e9d04f753c04074a23f
focused_fix_commit=486409c5155fde337380a5ff5f912c709226da96
PR=25 (draft, open, unmerged)
```

Fetched the explicit `main` and recovery branch refs with `--prune` through the
broker, rather than unrestricted `fetch --all`. Checked out the expected checkpoint
without resetting. A pre-existing `.hoplite/settings.json` delta was preserved and
excluded from commits. PR #25 is linked to this thread with auto-fix enabled.

## Failure diagnosis: TEST_COMPARISON_NONDETERMINISM

Before editing, the exact combined invocation initially could not start because
Vitest was not installed (exit 254). Ran the repository-documented
`pnpm install --frozen-lockfile` and installed the required SQLite CLI. No lockfile,
dependency version, setup configuration, or production configuration was changed.

After installation, the exact combined invocation passed 21/21; the requested
standalone invocation **failed 1/13** at the original forward-path comparison.
A second unchanged combined invocation also passed 21/21. Therefore the inherited
"fails combined, passes alone" pattern is not deterministic and is not evidence of
cross-file shared state. The SQLite helper creates independent in-memory databases.

The standalone failure identified `recipes.created_at`, for example:

| Table | Row | Column | Fresh expected | Staged received |
| --- | --- | --- | --- | --- |
| recipes | imp-04d0b94d17ce080c | created_at | 2026-09-17 12:20:22 | 2026-09-17 12:20:23 |

Both values are SQLite TEXT / JavaScript strings, not different catalog content.
An independent SQLite replay separated by 1.1 seconds inspected **every column and
row across all seven compared tables**. Its only differences were 101 values each
of `recipes.created_at`, `recipe_media.created_at`, and `recipe_media.updated_at`.
Example legacy row `gl-01`: `2026-09-17 12:20:48` versus `2026-09-17 12:20:49`.
The full audit was retained locally at `.hoplite/artifacts/t14f/replay-diff.json`.

| Table | Clock-derived defaults | Comparison retained |
| --- | --- | --- |
| recipes | created_at: datetime('now') | All 16 other columns, explicit projection |
| recipe_ingredients | None | All 7 columns |
| recipe_steps | None | All 6 columns |
| recipe_runtime_fields | None | All 8 columns |
| recipe_runtime_ingredient_order | None | All 3 columns |
| recipe_classifications | None | All 3 columns |
| recipe_media | created_at, updated_at: strftime(..., 'now') | Existing id/recipe_id/role/version/status/storage_key projection unchanged |

## Focused fix and regression protection

Only `tests/integration/recipe-catalog-growth.test.ts` changed in the focused fix.
The production-shaped `0034 → 0035 → 0036` replay is still compared to a fresh
`0001 → 0036` replay. The recipe schema assertion fails if a new column is added
without an explicit comparison decision. Deliberate test-database timestamp drift
must preserve semantic equality; deliberate title drift must break it. Same-database
upgrade assertions still compare full legacy rows, including timestamps, to prove
the additive growth migration does not modify them.

Two consecutive focused runs passed **2 files / 21 tests** each. Independent
review of the test-only diff found no blocking issue. No source batch, review JSON,
registry, manifest, or migration 0001–0036 was changed by this continuation.

## Pilot runtime evidence

The focused tests exercise the real Worker HTTP handlers and local SQLite-backed
D1 adapter, not a deployed service or browser UI:

- Fresh and staged replay: recipes 101 = legacy 71 + imported 30; runtime order
  0..100 with 101 distinct positions; complete 101, fkStub 0, incomplete 0;
  foreign_key_check `[]`, quick_check `ok`.
- Table counts: recipe_ingredients 568, recipe_steps 469, recipe_runtime_fields 101,
  recipe_runtime_ingredient_order 568, recipe_classifications 60, recipe_media 101.
- Readiness READY against shipped `rel-193ac2b16c64a260`; static remains 71.
- Shadow serves static 71 and reports reviewed D1 growth READY 101 at info level;
  stray unmanifested rows and legacy edits still fail closed.
- Deterministic canary tenants outside/inside receive static 71 / D1 101;
  local full-D1 mode serves 101. One content batch still contains exactly 5 statements,
  with no per-recipe queries.
- HTTP list/detail by ID and slug, filters, recommendations, Week generate/regenerate,
  swap to an imported recipe, cooking start/completion, and pending-media fallback pass.
  `tom-xao-bong-cai-xanh-toi-gion-ngot` participates in recommendations and cooking;
  stock deductions and COOK events are verified, idempotent replay does not deduct twice.
- Inventory Truth implementation is unchanged: T09/T11 change NO; new writers 0;
  new canonical readers 0. No Week compatibility or household isolation change.

## Response and Worker bundle accounting (pilot, not 500)

101-recipe HTTP list: **199,242 bytes**; static 71: **144,402 bytes** (UTF-8).
Wrangler **3.114.17** binding-free, credential-free `deploy --dry-run` builds used
the same compatibility date/flag for certified base and pilot. No deploy occurred.

| Artifact | Certified base | Pilot | Delta |
| --- | --- | --- | --- |
| Emitted index.js bytes | 1,508,725 | 1,510,546 | +1,821 |
| gzip of emitted index.js (mtime=0) | 309,910 | 310,822 | +912 |
| Wrangler reported total KiB | 1473.36 | 1475.14 | +1.78 |
| Wrangler reported gzip KiB | 304.77 | 305.70 | +0.93 |

The emitted Worker contains none of the 30 pilot slugs or source record IDs, nor
the raw source path `pilot-30.jsonl`; only the compact release manifest grows. Measurements are local
dry-run artifacts, not production deployment receipts. A 500-recipe response was
not measured because no 500-recipe release exists.

## Gate result and next phase

**T14F_PILOT_BLOCKED.** Full `pnpm test` failed: **170/171 files passed;
3,908/3,910 tests passed** (374.51 seconds). Both failures are in the existing
`tests/integration/recipe-authority-routing.test.ts`, independently reproduced by
`pnpm vitest run tests/integration/recipe-authority-routing.test.ts` (5/7 pass):

1. Line 114: actual D1 selection counter is `0`, expected `> 0`.
2. Line 247: subsequent operation reads `[5]` content statements, expected cached `[]`.

The fixture stops at 0035 (71 recipes), while Worker authority loads the shipped
101-recipe manifest. A read-only Vite/SQLite diagnostic using the same service
confirmed two consecutive resolutions return `actualSource=static`,
`fallbackReason=COUNT_DRIFT`, count 71; batches `[5, 5]`; counters D1 0,
static 2, d1Fallback 2, notReady 2. The rejected snapshot is correctly not cached.
The failures expose a legacy test-fixture/manifest mismatch; successful parity
responses alone were masking static fallback, not proving D1 selection.

No remediation of these additional failures was attempted after the user's
explicit failed-pilot-gate stop. Do not weaken readiness, grow `ALL_RECIPES`, edit
the shipped 101 manifest, or remove the selection/cache assertions to make them pass.
Next proposed action is test-local alignment of the historical 71-recipe parity
fixture with a matching generated legacy manifest, then re-run all pilot gates.

| Executed gate | Result |
| --- | --- |
| pnpm recipe:seed:check | PASS (59 Vietnamese, 12 global, 71 runtime/media baseline) |
| pnpm recipe:import:check | PASS (101 recipes, 1 batch, rel-193ac2b16c64a260) |
| pnpm typecheck | PASS |
| pnpm lint | PASS |
| pnpm check:migrations | PASS (migration-smoke=ok) |
| pnpm build | PASS (web + Worker type build) |
| pnpm test | FAIL (170 passed / 1 failed file; 3908 passed / 2 failed tests) |
| git diff --check | PASS |

Exact implementation-head GitHub CI also failed on the **same two assertions**:
run [35221142005](https://github.com/frigo-4/Frigo-dev/actions/runs/35221142005),
validate job/check **105201308074**, head `486409c5155fde337380a5ff5f912c709226da96`.
CI lint/typecheck passed; tests were 170/171 files and 3908/3910 tests passing;
subsequent CI migration/build steps were skipped. Local migration/build passed
before the local full suite. A later docs-only checkpoint does not resolve these failures.

Logs are in `.hoplite/artifacts/t14f/`; the full log includes expected negative-test
warnings and is not published as general-purpose media. `T14F_NEXT_HANDOFF.md`
contains the recovery instructions. Ingredient preflight was **not run**: pilot
certification did not pass. Batch B remains unstarted; no 0037 exists; PR #25
remains draft and unmerged. Ingredient sufficiency is **not assessed**, not declared
blocked solely because the pilot uses 41/45 ingredients.

Production D1 write NO; R2 write NO; deploy NO; recipe authority switch NO.
Force push NO; history rewrite NO; main direct write NO; media population NO;
T14G NOT_STARTED. Production rollout and media population remain deferred.
