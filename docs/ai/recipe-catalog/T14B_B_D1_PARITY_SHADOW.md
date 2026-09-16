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
SHA-256 `23f356458a294b240e683fec14012bc932a8b7e57ad0c932e4fc184329bada4d` (post-remediation render; the original `05f868eb…` render had no
`runtime_order` column and no `recipe_runtime_ingredient_order` table — 0034 is unmerged and
undeployed, so it was re-rendered in place rather than adding 0035).

Design (all additive, D1/Wrangler-parser-safe: plain multi-row `INSERT … ON CONFLICT DO UPDATE`,
`CREATE TABLE IF NOT EXISTS`, no `SELECT CASE … RAISE` trigger bodies, no `.read`/dot commands):

1. **12 global recipes** `gl-01..gl-12` into `recipes`, `recipe_ingredients` (57 lines, IDs
   `<recipe>_ing_<n>` exactly as 0006), `recipe_steps` (46 steps, IDs `<recipe>_step_<n>`).
   IDs and slugs are the static IDs — no regeneration, no title/UUID IDs. `ON CONFLICT(id)`
   upgrades a 7-column cooking/shopping FK anchor left on a populated database into a complete
   entry **without touching** `source_type`/`verification_state`/`version`/`created_at`
   (proved by the populated-0033 upgrade test with a real `cooked_meals` reference).
2. **`recipe_runtime_fields`** (new table, PK `recipe_id → recipes ON DELETE CASCADE`):
   `runtime_order INTEGER NOT NULL` (0-based position in `ALL_RECIPES`, `UNIQUE` index —
   canonical runtime order), `category TEXT` (typed **open** field: any non-empty string,
   `CHECK length(trim(category)) > 0`), `region TEXT` (**closed** vocabulary:
   `CHECK IN ('bac','trung','nam','toan_quoc')`),
   `legacy_calories/legacy_protein_g/legacy_fat_g/legacy_carb_g REAL` with an all-or-nothing
   CHECK; partial indexes on `(category, recipe_id)` and `(region, recipe_id)`. One row per
   runtime recipe (71): 59 Vietnamese rows carry category+region, 12 global rows carry `NULL`
   for both (the static catalog has none — nothing invented), all 71 carry legacy macros and a
   `runtime_order` in `0..70`.
3. **`recipe_runtime_ingredient_order`** (new table, PK `recipe_ingredient_id → recipe_ingredients
   ON DELETE CASCADE`, `recipe_id`, `position INTEGER NOT NULL CHECK >= 0`,
   `UNIQUE(recipe_id, position)`): one explicit 0-based ordinal per persisted ingredient line
   (385 rows). Ingredient order is therefore carried by data, not by the lexical order of row IDs
   (`_ing_1, _ing_10, _ing_11, _ing_2 …`).
4. Nothing else: `0006` and every other historical file are byte-identical; no recipe row that
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
| `category` | `recipe_runtime_fields.category` (typed **open** field: non-empty-string validation, queryable, indexed) | copied; absent when NULL | authoritative for the persisted catalog; legacy `cat:` markers in `recipes.tags` are stripped and must agree |
| `region` | `recipe_runtime_fields.region` (**closed** vocabulary `bac|trung|nam|toan_quoc`) | copied; absent when NULL | same; conflict with a `region:` marker fails closed |
| catalog order | `recipe_runtime_fields.runtime_order` (0-based, UNIQUE) | recipes emitted `ORDER BY runtime_order` | canonical; behaviourally significant (ranking ties, planner tie-break, swap candidate subset); missing/invalid/duplicate fails closed |
| ingredient order | `recipe_runtime_ingredient_order.position` (0-based, `UNIQUE(recipe_id, position)`) | lines emitted by position | explicit ordinal representation; missing/invalid/duplicate/gapped positions fail closed — never a lexical-ID fallback |
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
   ↓ D1RecipeContentSnapshot               (recipes, recipe_ingredients ⟕ recipe_runtime_ingredient_order.position,
                                             recipe_steps, recipe_nutrition ids, recipe_runtime_fields incl. runtime_order)
hydrateRuntimeRecipes(snapshot)            packages/recipes/src/runtime-hydration.ts — fail-closed, O(rows)
   ↓ { recipes: RuntimeRecipe[] (ORDER BY runtime_order; ingredients by position), failures[], classifications[] }
RuntimeRecipeCatalog                        packages/recipes/src/runtime-catalog.ts
   StaticRuntimeRecipeCatalog (ALL_RECIPES)  = production authority; preserves input order verbatim (never sorts)
   D1RuntimeRecipeCatalog (snapshot once/instance) = shadow candidate; emits persisted runtime order,
                                             never reorders itself by consulting ALL_RECIPES
compareRuntimeCatalogs(static, snapshot)   → RecipeCatalogShadowDiagnostics (ID-keyed maps, O(N),
                                             + orderDriftCount/orderDrift over the shared-ID set)
```

Order representation: `ALL_RECIPES` source order → renderer → `recipe_runtime_fields.runtime_order`
→ D1 → `hydrateRuntimeRecipes()` → `D1RuntimeRecipeCatalog`. The D1 view reproduces the static
order independently; nothing in production or test code re-imposes static order on D1 output.

Fail-closed codes: `fk_stub`, `rejected_entry` (foundation contract: bad servings, unknown
unit, non-canonical ingredient…), `incomplete_entry` (NULL/blank description, no steps — the
description is re-checked before assembly so no value is ever defaulted),
`missing_runtime_fields`, `missing_media_compatibility`, `invalid_tags`,
`legacy_marker_conflict`, `invalid_region`, `invalid_cuisine`, `duplicate_recipe_id` (both
rows fail), `duplicate_step_number`, `missing_runtime_order`, `invalid_runtime_order`,
`duplicate_runtime_order`, `missing_ingredient_position`, `invalid_ingredient_position`
(non-integer, negative, out of range, duplicate or gapped positions), `runtime_contract_violation`
(`RuntimeRecipeSchema.strict()`). No default is substituted for any field and no lexical-ID
ordering fallback exists. Query count: **5 per snapshot**, never per recipe; comparison is O(N)
via `Map<id>`. Order is never re-imposed anywhere: the hydrated list is consumed as emitted.

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
`catalog_order_drift_count`, `catalog_hydration_failure_count`, `catalog_lookup_ms`, bounded
10-item `drift_sample` / `order_drift_sample` (`{id, staticPosition, d1Position}`) /
`hydration_failure_sample` of IDs+field names/codes). Healthy = `staticOnly = d1Only = drift =
orderDrift = hydrationFailures = 0` → `level=info`; any non-zero count → `level=warn`
(order drift alone is enough). D1 failure → `status=shadow_error`
(warn), never a static "success", never a user-visible change (test-proved with a throwing DB).
`planner_candidate_count_*` is not emitted at runtime because the planner is not wired to D1;
the equivalent evidence is the planner parity harness (§9).

Schema gate / smoke: `scripts/d1-schema-gate.sql` requires 0034 in the ledger plus
`recipe_runtime_fields.runtime_order` and `recipe_runtime_ingredient_order.position`;
`scripts/migration-smoke.sh` asserts `runtime_order` is a complete `0..70` permutation and that
every `recipe_ingredients` row has exactly one ordinal with per-recipe positions `0..N-1`.

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

## 9. Parity evidence (fresh, remediation head)

**Method.** Behavioural parity is measured on the **actual catalog outputs**:
`staticRecipes = await new StaticRuntimeRecipeCatalog().listRuntimeRecipes()` and
`d1Recipes = await new D1RuntimeRecipeCatalog(() => readRecipeContent(db)).listRuntimeRecipes()`.
The first assertion is `expect(d1Recipes).toStrictEqual(staticRecipes)` with no reordering, and
`d1Recipes.map(id) === ALL_RECIPES.map(id)` without sorting either side. Both lists are then passed
**as-is** to `rankRecipes`, `evaluateRecipeMatch`, `isRecipeEligible`, `evaluateWeeklyCandidate`,
`generateWeeklyMealPlan` (generate + regenerate), `getSwapAlternatives` and `swapMealInPlan`. No
test maps D1 recipes back through `ALL_RECIPES`, sorts by static IDs or normalises array order;
only `createdAt/updatedAt` are stripped. A mutation check (hydrator temporarily ID-sorting its
output) fails 8/11 tests in `recipe-d1-runtime-parity`, proving the suite detects the original
ordering defect. Negative controls use a deliberately reversed catalog **inside the tests only**.

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
- **Runtime order**: `d1Recipes.map(id) === ALL_RECIPES.map(id)` (71, begins `vn-canh-01…`, ends
  `…gl-12`, provably not ID-sorted); `runtime_order` is `0..70` UNIQUE; snapshot row order is
  irrelevant (reversed read → identical output); global-first ordinals → `orderDriftCount=71`;
  reversed static list → 70; real ledger → `orderDriftCount=0`.
- **Ingredient order**: all 71 ingredient arrays strict-equal by catalog position; every
  `recipe_ingredients` row has exactly one `recipe_runtime_ingredient_order` row (no orphans, no
  missing), positions are exactly `0..N-1` per recipe; synthetic 12-line recipe `gl-99`
  (`_ing_1.._ing_12`, lexically `_ing_1,_ing_10,_ing_11,_ing_12,_ing_2…`) round-trips `1..12` and
  fails closed (`missing_ingredient_position`) when unmapped.
- **Migration hash manifest**: `tests/fixtures/migration-sha256.json` pins fixed SHA-256 values for
  0001–0033 captured from canonical main `c1c1c14a…`; the test hashes the working tree against the
  manifest (never both sides from the same file). 0034 is deliberately not pinned (current feature
  migration).
- **Recommendation parity**: `rankRecipes(d1Recipes)` `toStrictEqual` `rankRecipes(staticRecipes)`
  across 6 inventory fixtures (empty fridge, fully stocked global, partial Vietnamese, partial
  global, expiring, mixed units) × 5 contexts (default, cuisine preference, max time, no-buy
  filter, recently cooked); `evaluateRecipeMatch` pairwise by catalog position.
- **Tie-sensitive ranking**: with an empty fridge the real catalog has ≥5 groups with equal
  `score|matchPercentage|cookTimeMinutes` (e.g. `25|0|10` = `vn-xao-01, vn-sang-02, gl-03, gl-12`);
  their final order is input order. D1 reproduces every group exactly; the reversed negative
  control reverses every tie group (`gl-12, gl-03, vn-sang-02, vn-xao-01`) and a minimal two-recipe
  fixture (`vn-xao-01`/`gl-03`, identical keys) flips on reversal.
- **Planner parity**: `isRecipeEligible` and `evaluateWeeklyCandidate` pairwise for all 71; full
  `generateWeeklyMealPlan` (all slots, restrictions, dislikes, cuisine preference, budget) equal
  after stripping timestamps; regenerate (dinner-only) equal; `getSwapAlternatives` from each
  catalog's own plan/slot strict-equal; `swapMealInPlan` executed with each catalog's returned
  alternative → equal plans. Planner randomness is only the plan ID (fixed via `planId`) and
  `createdAt/updatedAt` (stripped).
- **Planner tie fixture**: empty fridge → 29 recipes share the top weekly score (48); the planner's
  stable sort picks the first in input order (`vn-canh-01`). D1 picks the same recipe IDs for every
  slot; the reversed control picks a different (still top-scored) recipe first. A three-recipe
  equal-score fixture (`vn-canh-01, vn-canh-05, gl-03`) picks `vn-canh-01` from both catalogs and
  `gl-03` when reversed.
- **>5 swap alternatives**: `getSwapAlternatives` inspects only `alternatives.slice(0, 5)` before
  ranking by `matchPercent`, so with 70 valid alternatives the returned set IS the first five
  non-current recipes in catalog order. D1 returns exactly the static IDs/order/matchPercent/
  badges/budgetDelta/cookingTimeDelta; the reversed control returns a different subset. An
  eight-recipe controlled fixture behaves the same. A swap is then executed with the same-rank
  alternative from each returned set and the resulting plans are equal.
- **Shadow health**: `runRecipeCatalogShadow(db,'shadow')` on the real ledger →
  `level=info`, all five counts 0, `order_drift_sample=[]`; a global-first D1 view → `level=warn`,
  `catalog_order_drift_count=71`, bounded 10-item sample.
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
| 5 — review fixes: per-isolate shadow interval bound, no description default, Inventory Truth test decoupled from ledger tip | `0284a96c33ede25b9206f7b3332f182a651b6d8d` |
| 6 — docs: PR #14 record | `f8813d50f9edd08b19e0f104817640781dca5f57` |
| 7 — remediation checkpoint: `runtime_order`, `recipe_runtime_ingredient_order`, hash manifest, order-drift diagnostics | `32593686053857945f4cfc1f09eeba2d543ab72c` |
| 8 — remediation handoff SHAs (safe checkpoint; hosted validate SUCCESS run 35053041994) | `d9130b69f3df27f4f071153c9824d66ca3750001` |
| 9 — order-sensitive behavioural parity on actual D1 catalog output (tie, planner tie, >5 swap, negative controls, shadow health) | `19b144a543e1d492d6540e0701eb255f3daae0c7` |
| 10 — final remediation docs (category/region wording, ADR-024, this doc, handoff) | this docs commit (branch head; exact SHA recorded in the PR #14 body) |

See `T14B_B_REMEDIATION_HANDOFF.md` for the review-remediation record.

## 13. Remaining work (not started)

- **T14C** — recipe media layer (R2, CSP `img-src`, Unsplash replacement, duplicate/missing assets).
- **T14D** — authority cutover/canary from static to the D1 runtime view (needs offline strategy,
  planner/route wiring, snapshot fallback review).
- **T14E** — bulk recipe import factory (needs cuisine taxonomy + provenance/import pipeline).
