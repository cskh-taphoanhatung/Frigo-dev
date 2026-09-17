# T14F next handoff — pilot blocked after takeover

```text
classification=T14F_PILOT_BLOCKED
scale=T14F_SCALE_NOT_STARTED
repository_id=1368281478
repository_full_name=frigo-4/Frigo-dev
origin_main=f0c229f2e2b134904a8c0e355479394cbf53c954
branch=hoplite/massalia-c2862d7c
takeover_resume_head=aa7ca6ae426eb784cf5d1e9d04f753c04074a23f
verified_implementation_commit=486409c5155fde337380a5ff5f912c709226da96
PR=25
draft=YES
merged=NO
```

This handoff is committed after the verified implementation commit. It cannot
contain its own hash: recover the current remote PR head and verify that both
`aa7ca6a…` and `486409c…` are ancestors. Do not reset to either historical commit.

## Completed in takeover

- Verified numeric repository identity and exact requested branch/base/head.
- Linked existing draft PR #25; auto-fix updates enabled; no duplicate PR.
- Reproduced the original timestamp failure **standalone**, not in the two combined
  pre-fix invocations, both of which passed. Diagnosed exact values across all
  seven tables: only SQLite wall-clock timestamps differed.
- Forward-only test fix `486409c…`: explicit 16-column recipe semantic projection,
  schema guard, deterministic timestamp-exclusion and title-mutation controls.
  Other five tables retain all columns; existing media projection preserved.
- Two focused invocations each passed 21/21; independent test-diff review found no
  blocking issue. Pilot data and all migration bytes unchanged by takeover.
- Fresh/staged 101 replay, completeness, FK/quick_check, static/shadow/canary/D1,
  five-statement reader and imported HTTP recommendation/planner/swap/cooking
  checks passed. This is local SQLite/Worker-handler evidence, not browser or
  production evidence.
- QA report and Worker dry-run bundle/response accounting completed; see
  `T14F_CATALOG_QUALITY_REPORT.md` and `T14F_REAL_CATALOG_GROWTH.md`.

## Executed gates and stop reason

```text
pnpm recipe:seed:check=PASS
pnpm recipe:import:check=PASS
pnpm typecheck=PASS
pnpm lint=PASS
pnpm check:migrations=PASS (migration-smoke=ok)
pnpm build=PASS
pnpm test=FAIL (171 files: 170 pass, 1 fail; 3910 tests: 3908 pass, 2 fail)
git diff --check=PASS
```

The exact full run started 2026-09-17 12:23:10 UTC and lasted 374.51 seconds.
Implementation-head CI run **35221142005**, validate job/check **105201308074**,
also failed with the same two tests and totals at `486409c5155fde337380a5ff5f912c709226da96`.
The failed file is `tests/integration/recipe-authority-routing.test.ts`:
line 114 expects D1 counter > 0, receives 0; line 247 expects cache-hit reads `[]`,
receives `[5]`. Running that file alone reproduced both failures (5/7 pass).

**Confirmed fixture mismatch:** this historical T14D suite builds a 0035-tip
71-recipe database but uses the shipped 101 manifest. The actual authority returns
static/COUNT_DRIFT and does not cache a rejected D1 snapshot. A diagnostic of two
resolutions confirmed batches `[5,5]`, D1 counter 0, static counter 2, fallbacks 2.
The real 101-recipe growth authority suite passes. Do not mistake legacy parity
responses returned through fallback for certified D1 responses.

Per the user's explicit stop rule, additional failure remediation was **not**
attempted. Pilot is NOT certified. Ingredient preflight and Batch B are NOT started.

## Next action (requires resuming blocked pilot work)

1. Fetch explicit `main` and `hoplite/massalia-c2862d7c` refs; inspect status and
   ancestry. Preserve unrelated local changes. Never force push or rewrite history.
2. Reproduce `pnpm vitest run tests/integration/recipe-authority-routing.test.ts`.
3. Align the historical parity test's 71-recipe fixture with an explicit generated
   71-recipe release using a test-local seam/mock, while retaining the unmocked
   shipped-101 growth tests. Assert actual D1/canary selection so static fallback
   cannot fake parity. Preserve real failure/fallback and cache expectations.
   Do not alter production readiness or the shipped manifest for a test fixture.
4. Re-run the two focused growth suites, the routing suite, then **all gates above**.
   Only a fully passing pilot may be `T14F_PILOT_CERTIFIED`.
5. Only then perform the required Batch B ingredient coverage design. Current
   canonical size is 45; pilot uses 41. Sufficiency for 399 high-quality distinct
   recipes has not been assessed. Do not infer infeasibility from usage count alone,
   invent ingredients, silently expand truth, or pad trivial variants.
6. Follow the user's T14F scale sequence only if preflight passes; otherwise stop
   `T14F_INGREDIENT_COVERAGE_BLOCKED`. Keep #25 draft until all 500-recipe gates pass.

## Immutable pilot state

```text
batch=t14f-pilot-30-v1
count=30
batch_hash=4d13915c075cd1b418d2454f7f03968349b779766cdb96b92df90f4138bc8cce
0036_sha256=04228788e60d59a2427d70956d4d8a108d0a6c1c4a643c47641402f658120ba9
release_id=rel-193ac2b16c64a260
legacy_static=71
expected_recipe_count=101
approved_batches=1
runtime_order=0..100 (101 distinct)
complete=101
fk_stub=0
incomplete=0
scale_count=0
scale_batch_hash=N/A
0037=N/A
```

Never change `pilot-30.jsonl`, `pilot-review.json`, `approved-batches.json`, the
shipped manifest, or 0036 to fix these test-comparison/fixture defects.

## Local workspace and safety

The initial checkout already had a `.hoplite/settings.json` delta (inferred
`pnpm dev` / null setup versus the versioned isolated preview setup). It is preserved
and intentionally uncommitted. Dependencies were installed with the frozen lockfile
and SQLite CLI for tests; no preview or production server was started. Local evidence
under `.hoplite/artifacts/t14f/` is ignored; durable results are recorded in these docs.

Production D1/R2 write NO; deploy NO; authority activation NO; main write NO;
force push NO; history rewrite NO; migration rewrite NO; media population NO;
T14G NOT_STARTED. No PayOS/payments/billing/checkout/webhook/auth implementation
changes. Inventory T09/T11 unchanged, zero new writers/readers. PR #25 remains
draft/unmerged; rollout and media remain deferred.
