# T14F-C — 500-recipe catalog development certification

## Summary

```text
classification=T14F_DEVELOPMENT_COMPLETE
T14F_REAL_CATALOG_500_COMPLETE
T14F_500_AUTHORITY_CERTIFIED
T14F_C_CLOSED
PRODUCTION_ROLLOUT_DEFERRED
MEDIA_POPULATION_DEFERRED
T14G_NOT_STARTED
P0=0 P1=0 release_blocking_P2=0 P3=1 (list payload size, see Performance)
repository_id=1368281478
repository_full_name=frigo-4/Frigo-dev
T14F_C_base=7d6675232aea5389b421747dc7d728ad1aeb9b50
T14F_C_safe_stop_head=44c0ad382c9296ab0a416e127b6150c80e803449 (resolved; see Closure)
T14F_C_closure_fix_head=8c6080aa85ed20b21ef4cbd4f610eebe1425415c (test harness only)
branch=hoplite/massalia-c2862d7c
origin_main=f0c229f2e2b134904a8c0e355479394cbf53c954 (untouched)
PR=25 (ready for review; merge remains a separate explicit decision)
T14F_FINAL_CERTIFIED_HEAD=<bound in the PR #25 final certification receipt; a committed file cannot hash itself>
```

This certifies that the **repository** now carries a complete, reviewed, deterministic
500-recipe catalog (71 legacy static + 30 pilot + 399 scale) with D1 authority proven
READY at 500 and every user flow working across all four authority modes. It is a
**development** certificate. Production D1 still sits at its own migration tip; nothing
here migrated, deployed, or switched production.

## Phase 1 — certified artifact regeneration (no drift)

Batch B was recompiled twice from the committed source with the T14E factory into
`.artifacts/recipe-import/t14f-c/rebuild-1|2` (byte-identical, `diff -r` clean):

```text
input_sha256=3998603ae133d221607dbc02e3e35b4cef6dd4c6eac57634a0ad0455ce7269f2      (matches T14F-B)
normalized_sha256=246d7cb172109cc3625f3d281698cdbbae98e16d2ead83db0b3a4767f2a86ada (matches)
migration_artifact_sha256=68e52e6d8b9d44054f609a3d405c9fa329d093521ffc8c97009c76fbf7317ad6 (matches)
batch_hash=1bdf29bde821b5183f0f41d920c7b747a5290f7772e6adc1a51de60ba3adda35         (matches)
candidate_release_id=rel-bd00a4f53fcaeee4                                              (matches)
candidate_manifest_sha256=fa47d31f344736d338dc0ba50654e4604f793089fe97e44857e7dd5dd0134ac0 (matches)
artifact_drift=NONE
```

Source files (`scale-399.jsonl`, concept matrix, ingredient preflight, `pilot-30.jsonl`)
were **not** modified.

## Phase 2 — migration promotion

```text
0037_path=migrations/0037_recipe_catalog_scale.sql
0037_sha256=68e52e6d8b9d44054f609a3d405c9fa329d093521ffc8c97009c76fbf7317ad6  (byte-identical to the factory artifact — same convention as 0036)
0001_0035_hash_drift=0 (git diff base..HEAD touches only the new 0037 under migrations/)
0036_sha256=04228788e60d59a2427d70956d4d8a108d0a6c1c4a643c47641402f658120ba9 (unchanged)
0036_changed=NO
additive=YES (plain INSERT, 399 recipe rows, runtime order 101..499; no schema, no UPDATE/DELETE)
```

## Phase 3 — shipped release

`data/recipe-import/approved-batches.json` registers Batch B as the second approved
batch; `packages/recipes/src/import/catalog-release.current.json` was regenerated with
`node scripts/recipe-import.mjs release-manifest` (not hand-composed) and is
**byte-identical** to the certified candidate manifest.

```text
release_id=rel-bd00a4f53fcaeee4
expected_recipe_count=500
approved_batches=2  (t14f-pilot-30-v1 4d13915c…; t14f-scale-399-v1 1bdf29bd…)
legacy_count=71 pilot_count=30 scale_count=399
ordered_ids=500 unique_ids=500
legacy_fingerprint=9ae153e64d34b30d72bb985d4070d8e210201219c0e8f8998ce8f99057fc7c3f
manifest_sha256=fa47d31f344736d338dc0ba50654e4604f793089fe97e44857e7dd5dd0134ac0
ALL_RECIPES_count=71 (static remains the rollback authority; no imported recipe moved into static)
recipe_import_check=ok (releaseId=rel-bd00a4f53fcaeee4 recipes=500 batches=2)
```

## Phase 4 — migration replay

Tests: `tests/integration/recipe-catalog-growth.test.ts` (14) and `scripts/migration-smoke.sh`
(`pnpm check:migrations`, now asserting through 0037).

```text
fresh_replay_0001_to_0037=recipes 500, runtime_fields 500, order min 0 / max 499 / distinct 500,
  complete 500, fk_stub 0, incomplete 0, foreign_key_check [], quick_check ok,
  hero media pending 500 / ready 0, no imported nutrition rows
pilot_forward_0036_to_0037=101 → 500; all 101 pre-existing recipe/runtime/media rows byte-preserved;
  scale rows occupy 101..499; second application of 0037 aborts on PRIMARY KEY (no duplication)
production_forward_0034_to_0035_to_0036_to_0037=500; deterministic comparison to fresh replay identical
  (recipes minus created_at, ingredients, steps, runtime fields, ingredient order, classifications, media projection)
upgrade_path_0035_populated_ledger=71 → 500 with user/inventory/plan rows untouched
semantic_divergence=NONE
```

## Phase 5 — D1 readiness (real shipped manifest, no mocks)

```text
d1_readiness=READY source=d1 recipeCount=500 releaseId=rel-bd00a4f53fcaeee4
fingerprintMatch=true legacyBaselineMatch=true hydrationFailureCount=0
negative controls (fail closed, uncached): count_drift ✔ id_drift ✔ order_drift ✔
  legacy_baseline_drift ✔ fingerprint_drift ✔ stub row ✔ pilot-only DB vs 500 manifest ✔
  legacy-only ledger vs shipped manifest → NOT READY, static fallback 71 ✔
```

## Phase 6 — authority modes and reader

```text
static_count=71 (actual source static)
shadow_served_count=71 shadow_d1_ready_count=500 (logged level info, drift 0, order drift 0)
canary_outside_source=static canary_outside_count=71
canary_inside_source=d1 canary_inside_count=500 fallbackReason=null
full_d1_source=d1 full_d1_count=500 fallbackReason=null
reader_statement_count=5 (RECIPE_CONTENT_READ_STATEMENT_COUNT) at catalog size 500
verified_cache_additional_reads=0 within TTL; rejected snapshots never cached; stale-grace tests retained
n_plus_one=NO
```

## User flows — 500 authority (`recipe-catalog-growth-authority.test.ts`, 9 tests)

```text
recipe_list=✔ (500 in release order, legacy prefix identical to static)
recipe_detail=✔ by id and slug (pilot + Batch B), static 404s imported ids
recommendations=✔ equals rankRecipes over 500, deterministic ties, >50 Batch B recipes ranked
planner=✔ regenerate=✔ swap=✔ (executed swap onto a Korean Batch B recipe)
shopping_attribution=✔ (planner path) cook_start=✔ cook_complete=✔ cook_idempotent_replay=✔
media_fallback=✔ (pending hero → legacy/placeholder, never canonical_r2)
pilot_recipe_flow=✔ batch_b_recipe_flow=✔ (one sample per cuisine: VN/CN/JP/KR/TH/IT; Thai recipe cooked)
```

## Inventory Truth

```text
T09_change=NO  T11_change=NO
new_inventory_writers=0  new_canonical_inventory_readers=0
inventory-truth 54/54, inventory-writer-fence, inventory-read-authority 28/28 PASS
Cooking deductions still flow through the existing inventory mutation path (COOK events only).
```

## Performance evidence (local, indicative — not hard claims)

```text
recipe_list_500_response_bytes=778619 (static 71 = 144402 bytes)
local_handler_duration=~0.3–0.45 s per D1 list request in the vitest harness (SQLite-backed)
worker_bundle_size=1484.67 KiB (gzip 311.59 KiB) via `wrangler deploy --dry-run`; raw source data absent from bundle
performance_blocker=NONE (P3: the unpaginated 500-item list is ~780 KB; pagination/search belong to T14G)
```

## Raw source bundle safety

Worker bundle grep: `scale-399.jsonl`/`pilot-30.jsonl`/record ids/concept text → 0 hits;
release manifest id present. Runtime ships only compiled release metadata/code.

## Closure — safe stop resolved

The safe stop at `44c0ad38…` (`T14F_C_WIP_HANDOFF.md`) left `pnpm lint`, `pnpm build`,
the full `pnpm test` and hosted validate outstanding. Running them surfaced one real
closure blocker, fixed forward-only in `8c6080aa…` (tests only):

```text
finding=hosted validate on 44c0ad38… (run 35266591460 attempt 2, job 105359053711) FAILED:
  5 real-D1 suites (inventory-lot-d1, inventory-closed-loop-d1, inventory-observation-d1,
  inventory-read-authority-d1, t13-receipt-vision-d1) → "Error: Network connection lost";
  reproduced locally (166/171 files, 92 tests skipped after beforeAll failure).
root_cause=workerd 1.20250718 SqlStorage keeps a 1 MiB LRU of prepared statements
  (SQL_STATEMENT_CACHE_MAX_SIZE); replaying 0001→0037 in one process crosses it once
  0037 (829,117 bytes of INSERT SQL) lands (cumulative 1,223,932 > 1,048,576). Eviction
  corrupts the kj HashIndex and workerd SIGSEGVs (cloudflare/workerd#5977). Not a
  migration, catalog, or runtime defect: 0037 replays cleanly one file per process,
  `migration-smoke` and every SqliteD1 suite already passed.
fix=tests/helpers/local-d1-worker.mjs — persisted local D1, one batch per migration file
  (semantics unchanged), workerd restarted before cumulative SQL exceeds 512 KiB, and a
  hard error if any single migration ever exceeds 1 MiB. All five suites use it.
not_changed=migrations/0037, approved-batches.json, catalog-release.current.json, recipe
  data, authority runtime, Inventory Truth, worker/test helper script.
```

## Repository gates (final local run on 8c6080aa…, 2026-09-17)

```text
recipe_seed_check=PASS
recipe_import_check=PASS (500 / 2 batches)
typecheck=PASS
lint=PASS
check_migrations=PASS (migration-smoke through 0037)
build=PASS
full_vitest_files=171/171  full_vitest_tests=3913/3913 (0 skipped)  duration=419.58 s
  (historical 171 / 3911 + 2 T14F-C tests; no coverage removed)
real_d1_suites=5 files / 92 tests PASS (22.75 s focused; also inside the full run)
git_diff_check=PASS
working_tree=clean
secret_scan=PASS (no keys/tokens/private URLs/local paths in the T14F-C diff)
```

## Hosted CI

```text
safe_stop_head_validate=44c0ad38… run 35266591460: attempt 1 CANCELLED (runner shutdown),
  attempt 2 FAILURE (job 105359053711, Vitest step — the five real-D1 suites above)
closure_fix_head_validate=8c6080aa… run 35271630025 / job 105372187543 SUCCESS
  (ESLint, typecheck, full Vitest, migration smoke, build all green)
docs_heads_validate=026c37c4… run 35272118131 / job 105373779604 FAILURE and
  853a9822… run 35272924086 / job 105376418801 FAILURE — both with 171/171 files and
  3913/3913 tests PASSED, then one unhandled `[vitest-worker]: Timeout calling
  "onTaskUpdate"` → exit 1. Code-identical to 8c6080aa… (SUCCESS). Fixed forward-only, see
  "Second closure blocker" below.
final_head_validate=recorded in the PR #25 final certification receipt (run + job ids, SUCCESS)
```

### Second closure blocker — vitest worker RPC timeout (fixed forward-only, test config only)

```text
finding=on the 2-vCPU hosted runner the Vitest step passed every test but exited 1 with an
  unhandled `[vitest-worker]: Timeout calling "onTaskUpdate"` (2 of 2 docs-only heads; the
  code-identical fix head 8c6080aa… passed 20 min earlier — runner-load dependent).
root_cause=vitest 3.2.7 workers report task progress to the main process over birpc with a
  fixed 60 s reply timeout; the reply arrives as an IPC macrotask. Suites built on the
  synchronous SqliteD1 adapter (inventory-lot-authority 306 tests ≈ 72 s, inventory-fefo
  1,000-lot case ≈ 37 s, event-authority 205 tests ≈ 42 s on the slow run) resolve only
  microtasks between tests, so a worker can go > 60 s without draining its IPC queue and the
  overdue timer fires first. Not a test, migration or runtime defect.
fix=tests/helpers/vitest-event-loop-yield.ts registered via vitest `setupFiles`: one
  `setImmediate` yield in `afterEach` (real timer captured before fake timers), so every
  worker drains pending RPC replies at least once per test. Focused check: lot-authority +
  output-policy (execFileSync) + planner-hook (jsdom) + growth = 393/393 PASS.
not_changed=test bodies, timeouts, thresholds, migrations, catalog, runtime.
```

The exact final certified SHA, its validate run/job ids and result are bound in the PR #25
final certification receipt (a committed file cannot contain its own commit SHA).

## Production safety

```text
production_D1_write=NO production_R2_write=NO production_deploy=NO
production_recipe_authority_switch=NO production_migration_workflow_dispatch=NO
media_population=NO T14G_started=NO
```

## Known limitations

- Unpaginated `GET /recipes` at 500 returns ~780 KB (P3); search/pagination redesign is T14G.
- All 429 imported recipes have **pending** hero media by contract; no images populated.
- Production is **not** at 0037 and does **not** contain 500 recipes.

## Next: production rollout requirements (separate authorization)

1. Production ledger at 0034/0035/0036 → apply 0035 (if needed), 0036, 0037 through the
   existing OPS migration workflow with `EXPECTED_PRE_TIP` pinning; never re-apply.
2. Verify D1 readiness READY 500 against the shipped manifest before any authority change.
3. Shadow → canary → d1 rollout per the T14D/T14F-A routing contract; static 71 remains
   the emergency fallback.
4. Media population (T14C contract) only after rollout; T14G search/pagination separately.
