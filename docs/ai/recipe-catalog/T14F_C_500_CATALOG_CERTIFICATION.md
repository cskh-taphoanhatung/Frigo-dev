# T14F-C — 500-recipe catalog development certification

## Summary

```text
classification=T14F_DEVELOPMENT_COMPLETE
T14F_REAL_CATALOG_500_COMPLETE
T14F_500_AUTHORITY_CERTIFIED
PRODUCTION_ROLLOUT_DEFERRED
MEDIA_POPULATION_DEFERRED
T14G_NOT_STARTED
P0=0 P1=0 release_blocking_P2=0 P3=1 (list payload size, see Performance)
repository_id=1368281478
repository_full_name=frigo-4/Frigo-dev
T14F_C_base=7d6675232aea5389b421747dc7d728ad1aeb9b50
branch=hoplite/massalia-c2862d7c
origin_main=f0c229f2e2b134904a8c0e355479394cbf53c954 (untouched)
PR=25 (merge remains a separate explicit decision)
T14F_FINAL_CERTIFIED_HEAD=<bound in the PR #25 certification receipt; a committed file cannot hash itself>
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

## Repository gates (filled from the final local run)

```text
recipe_seed_check=PASS
recipe_import_check=PASS (500 / 2 batches)
typecheck=PASS
lint=PASS
check_migrations=PASS (migration-smoke through 0037)
build=PASS
full_vitest_files=<see receipt>  full_vitest_tests=<see receipt>
git_diff_check=PASS
working_tree=clean (local-only .hoplite/settings.json delta intentionally uncommitted)
secret_scan=PASS (no keys/tokens/private URLs/local paths in the T14F-C diff)
```

## Hosted CI

Implementation and final-head validate run/check ids are bound in the PR #25 receipt.

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
