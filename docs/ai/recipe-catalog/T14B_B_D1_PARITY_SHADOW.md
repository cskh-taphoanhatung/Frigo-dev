# T14B-B — D1 Catalog Parity, Runtime View & Shadow Foundation (2026-09-16)

```
USER-VISIBLE AUTHORITY  = ALL_RECIPES (71)            unchanged; every route still imports it
D1 RECIPE CATALOG       = 71 complete rows, hydratable to RuntimeRecipe, shadow/parity capable
SHADOW MODE             = RECIPE_CATALOG_MODE=shadow  off-response comparison only; production default static
NO authority cutover · NO media remediation (T14C) · NO bulk import (T14E) · NO production mutation
```

## 1. Verified starting baseline

| Item | Value |
| --- | --- |
| Repository | `vn-clo/Frigo-dev`, ID `1368281478`, default `main`, protected (`protected=true`) |
| `T14B_B_START_MAIN` / `T14B_B_START_SHA` | `c1c1c14a2a7dccc883f1030d0dee7043754fb4a9` (= PR #13 receipt merge; T14A `fbd14c77…`, T14B-A `a165474a…`, PR #9 `911db7fd…` all ancestors) |
| Branch | `hoplite/poteidaia-c88481ca-integrate-t14b-a-current-main-t14-canonical-merge-receipt-t14b-b-d1-recipe-parity-shadow` (Hoplite-generated; the packet's `feat/t14b-b-d1-recipe-parity-shadow` equivalent), created from exact `origin/main` |
| `MIGRATION_COUNT` / `MIGRATION_MAX` at start | 33 / `0033`; every hash identical to the T14A/T14B-A baseline fingerprint (`HASH_DRIFT=NONE`) |
| `STATIC_RUNTIME_COUNT` | 71 (59 Vietnamese + 12 global) |
| `D1_COMPLETE_COUNT` at start | 59 (globals `gl-01..gl-12` static-only, `d1Only=[]`) |
| PR #4 | open, historical, `CLOSE_ARCHIVE` recommended, not merged, not a base |
| Working tree at start | only the pre-existing uncommitted `.hoplite/settings.json` sandbox change (never committed) |
| Deployed application | recorded PR #9 lineage, Worker `20bc1f35-6ffe-4085-ba79-d54a0b53da71`; final canonical main was **not** deployed and this task does not deploy |

## 2. Migration `0034_global_recipe_catalog_parity.sql`

`NEXT_MIGRATION = max(0001..0033) + 1 = 0034`, discovered from the directory, not assumed.
SHA-256 `05f868eb623f7c0ce06c06503c0cedd9a45643423fecae21b53389a5fab4336d`.

Design (all additive, D1/Wrangler-parser-safe: plain multi-row `INSERT … ON CONFLICT DO UPDATE`,
`CREATE TABLE IF NOT EXISTS`, no `SELECT CASE … RAISE` trigger bodies, no `.read`/dot commands):

1. **12 global recipes** `gl-01..gl-12` into `recipes`, `recipe_ingredients` (57 lines, IDs
   `<recipe>_ing_<n>` exactly as 0006), `recipe_steps` (46 steps, IDs `<recipe>_step_<n>`).
   IDs and slugs are the static IDs — no regeneration, no title/UUID IDs. `ON CONFLICT(id)`
   upgrades a 7-column cooking/shopping FK anchor left on a populated database into a complete
   entry **without touching** `source_type`/`verification_state`/`version`/`created_at`
   (proved by the populated-0033 upgrade test with a real `cooked_meals` reference).
2. **`recipe_runtime_fields`** (new table, PK `recipe_id → recipes ON DELETE CASCADE`):
   `category TEXT` (non-blank), `region TEXT CHECK IN ('bac','trung','nam','toan_quoc')`,
   `legacy_calories/legacy_protein_g/legacy_fat_g/legacy_carb_g REAL` with an all-or-nothing
   CHECK; partial indexes on `(category, recipe_id)` and `(region, recipe_id)`. One row per
   runtime recipe (71): 59 Vietnamese rows carry category+region, 12 global rows carry `NULL`
   for both (the static catalog has none — nothing invented), all 71 carry legacy macros.
3. Nothing else: `0006` and every other historical file are byte-identical; no recipe row that
   existed before is updated (Vietnamese rows/lines/steps are proved byte-equal before/after in
   `scripts/migration-smoke.sh`); no inventory, user, Week or scan table is touched.

Ingredient FK integrity: the 21 canonical IDs referenced by the globals
(`CABBAGE … TOMATO`) all exist in `ingredients` after 0001–0033; no ingredient was added.

Generation safety: `renderGlobalRecipeParitySql(GLOBAL_RECIPES, ALL_RECIPES)`
(`packages/recipes/src/seed-render.ts`) is pure; `pnpm recipe:seed:check` proves committed
0006 **and** 0034 match the static catalog byte-for-byte; `pnpm recipe:seed:render` writes both
renders only beneath `.artifacts/recipe-seed/` (existing containment policy, exit 3 elsewhere).
The 0034 file was rendered to `.artifacts/`, reviewed, replayed (fresh + populated + re-run)
and copied once. The renderer refuses to encode category/region as `cat:`/`region:` tag markers
and refuses marker-prefixed static tags.

## 3. Runtime-only field policy (Goal C)

| Field | Representation | Hydration | Truth label |
| --- | --- | --- | --- |
| `category` | `recipe_runtime_fields.category` (typed, queryable, indexed) | copied; absent when NULL | authoritative for the persisted catalog; legacy `cat:` markers in `recipes.tags` are stripped and must agree |
| `region` | `recipe_runtime_fields.region` (closed CHECK vocabulary) | copied; absent when NULL | same; conflict with a `region:` marker fails closed |
| `imageUrl` | `recipes.image_url` mirror of the static reference | copied verbatim | **LEGACY_MEDIA_COMPATIBILITY_ONLY / MEDIA_AUTHORITY_DEFERRED_TO_T14C**; `NULL`/empty fails closed |
| `nutrition` | `recipe_runtime_fields.legacy_*` | `{calories, proteinG, fatG, carbG}` when present | **legacy_compatibility** projection of static macros; NOT `nutrition_profiles` (ADR-004/009 untouched); no basis/provenance is claimed |
| `steps` | `recipe_steps` | `ORDER BY step_number`, `tip`/`timerMinutes` only when non-NULL | lossless; duplicate step numbers fail closed |
| `tags` | `recipes.tags` JSON array minus legacy markers | verbatim order | lossless; non-array JSON or duplicate tags fail closed |

Category/region were **not** hidden in JSON and no second taxonomy was introduced;
`recipe_classifications` (kinds `meal_type/dietary/allergen/method/equipment/suitability`) is
the wrong vocabulary for a Vietnamese dish category or culinary region and stays untouched.
Not chosen: widening `RecipeDefinition` (would change the T02/T04 planning contract).

## 4. Nutrition policy — Path 1 (compatibility projection)

`nutrition_profiles` demands `basis_unit`, `source_type ∈ {authoritative, imported, calculated,
estimated}` and a `source_reference`; the static macros have none of that evidence. Copying them
there would fabricate provenance, so they live in `recipe_runtime_fields.legacy_*`, are labelled
`legacy_compatibility` in the drift report, and are audited for parity (`nutrition.changed = []`).
The `recipe_nutrition` link path (ADR-009, version-bound) remains the only future authoritative
model; `nutrition_profiles` and `recipe_nutrition` are still empty (0 rows).

## 5. Provenance policy

All 71 rows: `source_type='legacy'`, `verification_state='unverified'`, `version=1`,
`source_reference=NULL` (test-asserted as the only distinct tuple). Nothing is marked
curated/reviewed/verified; no reference was invented. The static catalog has no
`sourceReference` for any recipe, so none is preserved.

## 6. Hydration architecture (Goals B, D)

```
readRecipeContent(db)                      packages/db/src/recipe-content.ts  — ONE batch, 5 SELECTs
   ↓ D1RecipeContentSnapshot               (recipes, recipe_ingredients, recipe_steps, recipe_nutrition ids, recipe_runtime_fields)
hydrateRuntimeRecipes(snapshot)            packages/recipes/src/runtime-hydration.ts — fail-closed, O(rows)
   ↓ { recipes: RuntimeRecipe[] (by id), failures[], classifications[] }
RuntimeRecipeCatalog                        packages/recipes/src/runtime-catalog.ts
   StaticRuntimeRecipeCatalog (ALL_RECIPES)  = production authority
   D1RuntimeRecipeCatalog (snapshot once/instance) = shadow candidate
compareRuntimeCatalogs(static, snapshot)   → RecipeCatalogShadowDiagnostics (ID-keyed maps, O(N))
```

Fail-closed codes: `fk_stub`, `rejected_entry` (foundation contract: bad servings, unknown
unit, non-canonical ingredient…), `incomplete_entry` (NULL/blank description, no steps — the
description is re-checked before assembly so no value is ever defaulted),
`missing_runtime_fields`, `missing_media_compatibility`, `invalid_tags`,
`legacy_marker_conflict`, `invalid_region`, `invalid_cuisine`, `duplicate_recipe_id` (both
rows fail), `duplicate_step_number`, `runtime_contract_violation` (`RuntimeRecipeSchema.strict()`).
No default is substituted for any field. Query count: **5 per snapshot**, never per recipe;
comparison is O(N) via `Map<id>`; static→hydrated order is re-imposed only in test harnesses.

## 7. Shadow mode (Goals D/E, §19–22)

`RECIPE_CATALOG_MODE` (`src/worker/types.ts`): `static` (default; `undefined`/`''` resolve to it)
or `shadow`. **There is no `d1` value**; `resolveRecipeCatalogMode('d1')` throws and the
production config gate (`src/worker/config/validation.ts`) fails closed with
`CONFIG_RECIPE_CATALOG_MODE` for anything but `static`. `wrangler.jsonc` does not set the var.

In `shadow`, `GET /recipes` and `GET /recommendations` (`src/worker/routes/recipes.ts`) still
answer from `ALL_RECIPES`; `scheduleRecipeCatalogShadow` is invoked per request but **admits at
most one comparison per isolate per `RECIPE_CATALOG_SHADOW_INTERVAL_MS`** (default 60 000 ms,
clamped to 1 s–24 h; throttled requests return `throttled` and touch neither D1 nor the log).
An admitted run executes via `executionCtx.waitUntil` (detached, never awaited by the response),
reads the snapshot once, hydrates, compares and logs one PII-free JSON record
(`event=recipe_catalog_shadow`, `catalog_source`, `catalog_mode`, `catalog_static_count`,
`catalog_d1_count`, `catalog_complete_count`, `catalog_hydrated_count`,
`catalog_static_only_count`, `catalog_d1_only_count`, `catalog_drift_count`,
`catalog_hydration_failure_count`, `catalog_lookup_ms`, bounded 10-item `drift_sample` /
`hydration_failure_sample` of IDs+field names/codes). D1 failure → `status=shadow_error`
(warn), never a static "success", never a user-visible change (test-proved with a throwing DB).
`planner_candidate_count_*` is not emitted at runtime because the planner is not wired to D1;
the equivalent evidence is the planner parity harness (§9).

## 8. Snapshot policy (§24)

Discovered behaviour: Week v1 (`routes/week.ts`) persists `JSON.stringify(slot)` into
`meal_plan_slots.snapshot_json` (and `_v2`) — the **complete recipe object** (ingredients, steps,
tags, imageUrl, nutrition) — and on read uses `storedSlot.recipe` first, falling back to
`ALL_RECIPES.find(id|slug)` only when the payload lacks one. T04 `generated_meal_plans` store
`result_json` snapshots with recipe IDs + versions and never re-hydrate old plans.

`SNAPSHOT_POLICY=IMMUTABLE_PAYLOAD_AUTHORITATIVE`: historical slot payloads remain the meaning
of historical plans; nothing re-interprets them through D1. Any future cutover only affects
future candidate resolution and the ID-based fallback, which is why stable IDs/slugs for all 71
(incl. `gl-01..gl-12`) are regression-tested.

## 9. Parity evidence (fresh, this head)

- **Migration**: fresh 0001→0034 replay → `recipes=71`, `recipe_ingredients=385` (328+57),
  `recipe_steps=341` (295+46), `recipe_runtime_fields=71` (59 with category/region, 71 with
  macros), `recipe_classifications=0`, `recipe_nutrition=0`, `nutrition_profiles=0`,
  `ingredients=45`; `PRAGMA foreign_key_check`/`integrity_check` clean; no orphan lines, steps
  or field rows. Populated-0033 upgrade (FK stub `gl-03` + `cooked_meals` + inventory + user):
  only 0034 applied, Vietnamese rows/lines/steps, cooked meal, inventory and users byte-equal,
  stub upgraded in place with `created_at` preserved, re-run is a no-op. `pnpm check:migrations`
  now exercises the same populated upgrade with 20 assertions (negative control verified to fail).
- **Drift audit** (`auditCatalogDrift`): `staticCount=71 d1Rows=71 d1Complete=71 staticOnly=[]
  d1Only=[] coreChanged=[] requirementsChanged=[] unitsChanged=[] stepsChanged=[] tagsChanged=[]
  media={missingInD1:[],changed:[]} nutrition={representation:legacy_compatibility,missingInD1:[],changed:[]}
  classification=118 × typed_runtime_field (59 recipes × category/region) incompleteRows=[] rejectedRows=[]`.
- **Hydrator**: all 71 hydrated recipes `toStrictEqual` the static `RuntimeRecipe` (key presence
  included); ingredients (id/qty/unit/optional), steps, tags, category, region, imageUrl,
  nutrition asserted per recipe; global slugs stable; `StaticRuntimeRecipeCatalog` and
  `D1RuntimeRecipeCatalog` agree on list and ID/slug lookups with exactly one snapshot read.
- **Recommendation parity**: `rankRecipes`/`evaluateRecipeMatch` `toStrictEqual` across 6
  inventory fixtures (empty fridge, fully stocked global, partial Vietnamese, partial global,
  expiring, mixed units) × 5 contexts (default, cuisine preference, max time, no-buy filter,
  recently cooked): candidate IDs, score, match %, missing required, expiring usage,
  no-buy status and ordering identical.
- **Planner parity**: `isRecipeEligible` and `evaluateWeeklyCandidate` for all 71; full
  `generateWeeklyMealPlan` (all slots, restrictions, dislikes, cuisine preference, budget) equal
  after stripping timestamps; regenerate (dinner-only re-generation) equal; `getSwapAlternatives`
  identical candidate list/order; `swapMealInPlan` equal. Planner randomness is only the plan ID
  (fixed via `planId`) and `createdAt/updatedAt` (stripped).
- **Cooking boundary**: `gl-03` and `vn-canh-01` hydrated recipes drive `POST
  /recipes/:id/cook/start|complete` with identical deductions; one `cooked_meals` row, one
  `inventory_events` per deduction, idempotent replay adds none; the 0034 row makes cooking's
  `INSERT OR IGNORE` anchor a no-op. New recipe modules contain **zero** SQL inventory writes.
- **Authority**: static guard test — every production flow imports `ALL_RECIPES`; no `src/`
  file except the shadow service references the hydrator/D1 catalog; `wrangler.jsonc` has no
  `RECIPE_CATALOG_MODE`; production validation rejects `shadow`/`d1`.

## 10. Offline / PWA (§30)

`src/web/services/recipes.ts`, `week.ts` and `IngredientDetailPage.tsx` import `ALL_RECIPES`
directly: offline reads are bundle-resident and unchanged by this task. A future authority
cutover must keep an offline recipe source (bundled snapshot or cached D1 view) or those
screens lose offline behaviour; documented here, not built.

## 11. Boundaries kept

- `LONG_TAIL_CUISINE_TAXONOMY_DEFERRED` — `cuisine` stays the 6-value runtime union; a taxonomy
  decision precedes T14E.
- `MEDIA_DEFERRED_TO_T14C` / `T14C_DEFERRED=YES` — blocked Unsplash hosts, duplicate images,
  `gl-11` missing asset, CSP: untouched.
- Inventory Truth: T09 writer / T11 reader authority unchanged; the only files touched under
  `src/worker/routes/recipes.ts` add the off-response shadow hook (no SQL change); no
  `packages/db/src/inventory-*` change. `tests/integration/inventory-truth.test.ts` no longer
  pins the ledger tip (it asserts 0033 is applied); ledger length/tip live in the migration suites.
- Qwen/AI, PayOS, DNS, secrets, PR #4: untouched. No production D1 migration, Worker deploy or
  resource mutation; local SQLite only.

## 12. Commits (this branch)

| Checkpoint | SHA |
| --- | --- |
| 1 — 0034 parity migration, renderer, smoke/gate, ledger tests | `724ed3fb0065c2e164a03458895c1ca1eae2e94d` |
| 2 — hydrator, runtime catalog, drift audit typed fields, shadow service, config gate | `550eef0dda7448bf3e49dcedefd3560549a1a712` |
| 3 — parity/fail-closed/planner/recommendation/cooking/authority tests | `a210c72fb936a3b92a339cba174e1eab8e3ad972` |
| 4 — docs/ADR-024 | `330add8bae0d82391e1a58a87a9b4eff1008113b` |
| 5 — review fixes: per-isolate shadow interval bound, no description default, Inventory Truth test decoupled from ledger tip | recorded in PR #14 after commit |

## 13. Remaining work (not started)

- **T14C** — recipe media layer (R2, CSP `img-src`, Unsplash replacement, duplicate/missing assets).
- **T14D** — authority cutover/canary from static to the D1 runtime view (needs offline strategy,
  planner/route wiring, snapshot fallback review).
- **T14E** — bulk recipe import factory (needs cuisine taxonomy + provenance/import pipeline).
