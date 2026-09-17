# T14F — WIP HANDOFF (SAFE STOP)

## Superseding takeover checkpoint — 2026-09-17

**Current status: T14F_PILOT_BLOCKED; T14F_SCALE_NOT_STARTED.** The historical
safe-stop record below is retained, not the current recovery procedure. Read
`T14F_NEXT_HANDOFF.md` and `T14F_REAL_CATALOG_GROWTH.md` first for continuation.

Recovered exact `aa7ca6ae426eb784cf5d1e9d04f753c04074a23f` on
`hoplite/massalia-c2862d7c`; repository ID 1368281478 now resolves to
`frigo-4/Frigo-dev`. PR #25 is draft/open/unmerged, with auto-fix subscribed.
Forward fix `486409c5155fde337380a5ff5f912c709226da96` diagnoses and removes only
`recipes.created_at` from independent-replay equality (all semantic fields remain).
Focused suites pass 21/21 twice. Pilot source/manifest and 0001–0036 remain unchanged.

Full gates were executed: seed/import/typecheck/lint/migration smoke/build PASS;
`pnpm test` FAIL (170/171 files, 3908/3910 tests pass). The two additional failures
are `recipe-authority-routing.test.ts:114,247`: the historical 71-recipe fixture
is rejected by the shipped 101 manifest, causing static fallback and no D1 cache.
Both reproduce alone. The user's failed-gate stop was honored: no further code
fix, ingredient preflight, Batch B, or 0037. See the next handoff for exact commands.

---

## Historical original safe-stop record (superseded above)

Status: **T14F_SAFE_STOPPED_PILOT_WIP** — pilot batch is compiled and promoted, but pilot
certification has one known failing focused test and the full T14F gates were NOT run.
Batch B (scale, 399) has NOT been started. This file was created by the safe-stop
protocol; nothing below should be read as "T14F complete".

## 1. Identity

```text
repository_id=1368281478
repository_full_name=frigo-3/Frigo-dev
T14F_certified_base=f0c229f2e2b134904a8c0e355479394cbf53c954
origin_main=f0c229f2e2b134904a8c0e355479394cbf53c954 (unchanged at safe stop)
branch=feat/t14f-recipe-catalog-500
current_head_before_safe_stop=f0c229f2e2b134904a8c0e355479394cbf53c954 (no T14F commits yet; all WIP was uncommitted)
safe_stop_commit=148b7a1c7ed4acf766053ecde94fadfd723529ba ("chore(t14f): checkpoint WIP and safe handoff")
remote_branch_head=148b7a1c7ed4acf766053ecde94fadfd723529ba on origin/hoplite/massalia-c2862d7c
  (pushed via draft PR #25 — feat/t14f-recipe-catalog-500 could not be published because it is
  not a Hoplite-authorized branch; PR: https://github.com/frigo-3/Frigo-dev/pull/25, base main,
  head hoplite/massalia-c2862d7c at this SHA. PR is DRAFT and must NOT be merged.)
safe_stop_pr=25 (draft; local HEAD == remote branch head == PR head verified 2026-09-17)
```

## 2. Phase

```text
T14F_PHASE=T14F_PILOT_MIGRATION_CREATED (safe-stop classification: T14F_SAFE_STOPPED_PILOT_WIP)
```

Human summary: the pilot source batch (30 original Vietnamese-language recipes) was authored,
editorially reviewed, compiled through the T14E factory, promoted byte-identically to
`0036_recipe_catalog_pilot.sql`, and the shipped Catalog Release Manifest was regenerated to
101 recipes / 1 approved batch. Focused certification tests were written; 20/21 pass, one
fails when the two growth suites run together. The full T14F gate list (full vitest, lint,
build, bundle accounting, QA report, docs) was never run. Batch B was never generated.

## 3. Completed work (with evidence)

- Pilot source data: `data/recipe-import/t14f/pilot-30.jsonl` (30 records, `sourceRecordId`
  `t14f-a-001`…`t14f-a-030`, `sourceNamespace=frigo.t14f.original.v1`, `sourceType=ai_generated`,
  Vietnamese user-facing text matching catalog convention, no nutrition macros).
- Editorial review: `data/recipe-import/t14f/pilot-review.json` (30/30 accepted, 0 rejected,
  1 editorial fix during review: `t14f-a-012` THIN_STEP).
- Provenance: `data/recipe-import/t14f/provenance.md`; batch registry
  `data/recipe-import/approved-batches.json` (batch → migration mapping).
- T14E compile artifacts: `.artifacts/recipe-import/t14f-pilot-30-v1/` — validation-report
  30/30 valid, publishable 30, errors 0, duplicates 0, possibleDuplicates 0,
  unresolvedIngredients 0, unsupportedCuisine 0; deterministic double-compile proven by test
  (`compile is deterministic (byte-identical artifacts across two compiles)` — passing).
- Ingredient coverage: pilot used 41 distinct ingredients, all resolved against the 45-item
  canonical catalog; `unresolved-ingredients.json` = `[]`.
- Migration promotion: `migrations/0036_recipe_catalog_pilot.sql` is **byte-identical** to
  `.artifacts/recipe-import/t14f-pilot-30-v1/migration.sql`
  (both `04228788e60d59a2427d70956d4d8a108d0a6c1c4a643c47641402f658120ba9`).
- Release manifest: `packages/recipes/src/import/catalog-release.current.json` regenerated via
  `node scripts/recipe-import.mjs release-manifest` — `releaseId=rel-193ac2b16c64a260`,
  `legacyBaselineCount=71`, `expectedRecipeCount=101`, `approvedImportBatches=1`,
  legacy fingerprint unchanged (`9ae153e64d34b30d72bb985d4070d8e210201219c0e8f8998ce8f99057fc7c3f`).
- Tests: new `tests/integration/recipe-catalog-growth.test.ts` (13 tests) and
  `tests/integration/recipe-catalog-growth-authority.test.ts` (8 tests) plus
  `tests/helpers/recipe-catalog-growth.ts`; existing authority/parity/media/import tests were
  updated for the grown ledger; `scripts/recipe-catalog-qa.mjs` (QA report generator) added;
  `scripts/migration-smoke.sh` extended to walk growth migrations.

## 4. Incomplete work

- **Known failing focused test** (see §10): `production forward path 0034 → 0035 → growth`
  fails when both growth suites run in the same vitest invocation; passes when the growth
  suite runs alone. Root cause not yet diagnosed (suspected cross-test-file state
  interference, not yet confirmed).
- Full test gates NOT run: `pnpm lint`, `pnpm build`, full `pnpm test`, bundle size
  before/after accounting, `git status` cleanliness after commit.
- T14F QA report (`docs/ai/recipe-catalog/T14F_CATALOG_QUALITY_REPORT.md`) NOT created.
- T14F architecture/handoff docs (`T14F_REAL_CATALOG_GROWTH.md`, `T14F_NEXT_HANDOFF.md`) NOT created.
- Batch B (scale, 399 recipes): NOT_STARTED — no source, no compile, no 0037.
- Final 500 manifest, final fresh replay to 500, static-71/D1-500 authority docs: NOT_STARTED.
- PR: NOT created (safe-stop protocol; branch push + this handoff is the deliverable).

## 5. Recipe counts

```text
legacy_recipes=71 (ALL_RECIPES unchanged; seed check passes)
pilot_target=30
pilot_present=30
pilot_valid=30
pilot_reviewed=30
pilot_publishable=30
scale_target=399
scale_present=0
scale_valid=0
scale_reviewed=0
scale_publishable=0
current_expected_total=101 (manifest) / 71+30=101 (data)
```

## 6. Source batches

```text
Batch A:
path=data/recipe-import/t14f/pilot-30.jsonl
batchId=t14f-pilot-30-v1
batchHash=4d13915c075cd1b418d2454f7f03968349b779766cdb96b92df90f4138bc8cce
inputSha256=53b8adb215313cef029ef37a0a395990df6fb9c7a1e8ac833cf62bba89f150d3
normalizedSha256=ee80f29eca531578562c3a493fb58c617acffa8c0ac91d529f37ccedc31c5216
status=compiled + promoted to 0036 (byte-identical)
Batch B:
path=NOT_CREATED
batchId=NOT_CREATED (suggested t14f-scale-399-v1)
batchHash=NOT_CREATED
status=NOT_STARTED
```

Release manifest hashes at pilot state: `releaseManifestSha256=a1f3a0f2ed5949ff64a3d68c71c5b4866caa500d267cd552105dc567bf15bb5a`,
`releaseId=rel-193ac2b16c64a260`.

## 7. Ingredient blockers

```text
resolved=41/41 distinct pilot ingredients (canonical catalog = 45)
unresolved=0
ambiguous=0
ingredient_blockers=none observed for the pilot; Batch B coverage audit NOT yet run.
  Note: 41 of 45 canonical ingredients are already used by the pilot alone; the scale batch
  must run the coverage preflight early (T14F packet §27) and STOP with
  T14F_INGREDIENT_COVERAGE_BLOCKED if legitimate ingredients are missing.
```

## 8. Duplicate state

```text
hard_duplicates=0
possible_duplicates=0
duplicate_waivers=0
unreviewed_candidates=0
(pilot only; cross-batch duplicate check for Batch B not yet possible)
```

## 9. Migrations

```text
migration_count=36
highest_migration=0036_recipe_catalog_pilot.sql
0036:
path=migrations/0036_recipe_catalog_pilot.sql
sha256=04228788e60d59a2427d70956d4d8a108d0a6c1c4a643c47641402f658120ba9
status=REVIEWED_ARTIFACT_PROMOTED (byte-identical to T14E compiler output; additive only)
0037:
path=NOT_CREATED
sha256=N/A
status=NOT_STARTED
0001_0035_hash_drift=0 (git diff shows no modified file under migrations/ except new 0036)
```

## 10. Test state (exact commands and outcomes, 2026-09-17)

```text
git diff --check=PASS
pnpm typecheck=PASS (tsc app + worker, exit 0)
pnpm check:migrations=PASS (scripts/migration-smoke.sh → migration-smoke=ok)
pnpm recipe:seed:check=PASS (vietnamese 59 + parity 12 + 71 runtime fields + 71 pending media)
pnpm recipe:import:check=PASS (releaseId=rel-193ac2b16c64a260 recipes=101 batches=1)
focused_tests=PARTIAL: pnpm vitest run tests/integration/recipe-catalog-growth.test.ts
  tests/integration/recipe-catalog-growth-authority.test.ts → 21 tests, 20 pass, 1 FAIL:
  "T14F — fresh SQLite replay of the full ledger (0001 → tip) > production forward path
  0034 → 0035 → growth: a 0034-tip database applies the same chain and lands on the same
  catalog" (AssertionError at recipe-catalog-growth.test.ts:229, table `recipes` deep-equal
  between staged 0034→tip replay and fresh replay, ~101 rows both sides). Running the growth
  file ALONE passes 13/13; failure reproduces when both growth suites run together —
  suspected cross-file test interference, ROOT CAUSE NOT DIAGNOSED. Do not mark pilot
  certified until this is fixed or proven environmental.
full_tests=NOT_RUN
build=NOT_RUN
lint=NOT_RUN
working_tree=committed at safe stop (see §13)
```

## 11. Release manifest state

```text
release_id=rel-193ac2b16c64a260
legacy_baseline_count=71
legacy_baseline_fingerprint=9ae153e64d34b30d72bb985d4070d8e210201219c0e8f8998ce8f99057fc7c3f (unchanged)
expected_recipe_count=101
approved_import_batches=1 (t14f-pilot-30-v1)
manifest_status=PILOT_101_WIP (generated by scripts/recipe-import.mjs, re-proven by recipe:import:check)
```

## 12. Production state

```text
production_app_expected=4ed98514f65ddd3b3d83007cd726fd7c2e2136e6
production_D1_tip_expected=0034_global_recipe_catalog_parity.sql
repo_pre_T14F_tip=0035_recipe_media_layer.sql
production_D1_write=NO
production_R2_write=NO
production_deploy=NO
production_authority_switch=NO
production_mutation_from_safe_stop=NO
```

No wrangler command was run; no Cloudflare credentials used; no workflow dispatched.

## 13. Next exact steps

1. `git checkout feat/t14f-recipe-catalog-500` and verify HEAD equals the safe-stop commit
   (`git log --oneline -2`; parent must be `f0c229f2e2b134904a8c0e355479394cbf53c954`).
2. Reproduce the known failure:
   `pnpm vitest run tests/integration/recipe-catalog-growth.test.ts tests/integration/recipe-catalog-growth-authority.test.ts`
   then run the growth file alone to confirm the isolation effect.
3. Diagnose/fix the interference (inspect `tests/helpers/recipe-catalog-growth.ts` compile
   cache and `tests/helpers/sqlite-d1.ts` temp-DB lifecycle; suspect shared temp paths or the
   `compiledCache` promise across files when run in parallel). This is a test-isolation fix,
   NOT a data change: do not regenerate the pilot batch or 0036.
4. Re-run focused suites to 21/21, then run the remaining pilot gates from the T14F packet:
   `pnpm lint`, `pnpm build`, full `pnpm test`, bundle before/after, then commit Phase A as
   the packet's pilot commit if not already split.
5. Only after the pilot gate passes: run the ingredient coverage preflight for Batch B, then
   author `data/recipe-import/t14f/scale-399.jsonl` under `t14f-scale-399-v1`, compile with
   T14E, cross-check duplicates vs legacy+Batch A, promote 0037, regenerate the 500 manifest.
6. Follow the full T14F packet (docs/ai/AGENT_RULES.md task packet) through final replay,
   authority tests, QA report, architecture docs, state docs, PR — then STOP at
   T14F_READY_FOR_REVIEW. DO NOT MERGE.

## 14. DO NOT (unchanged from T14F packet)

```text
DO NOT merge
DO NOT deploy
DO NOT apply remote migrations
DO NOT force push
DO NOT rewrite migration history
DO NOT modify 0001–0035 or 0036 content by hand
DO NOT append new recipes to ALL_RECIPES
DO NOT start T14G
DO NOT touch PayOS/payments/billing/checkout/payment webhooks
```
