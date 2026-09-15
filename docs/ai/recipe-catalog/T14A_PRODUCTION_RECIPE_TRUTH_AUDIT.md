# T14A — Production Recipe Truth Audit (2026-09-15)

**Task type:** AUDIT-ONLY / READ-ONLY. No application, migration, config,
dependency, test or production change was made. This document is the only
artifact (plus the docs-only state/handoff updates listed in §16).

**Audit branch:** `audit/t14a-production-recipe-truth` created locally from
exact `origin/main` `345cecf388321a00c96be387744a10e8c98bd9ac`. The
platform's brokered Git path only publishes the thread branch, so the identical
commit is published remotely as `hoplite/koroneia-838b0ccc` (same tree, same
parent `345cecf`; no history rewrite).

---

## 0. How to read this document

| Section | Content |
| --- | --- |
| §1 | VERIFIED CURRENT STATE — repository, production and main identity |
| §2 | HISTORICAL CONTEXT — lineage graph (verified from Git) |
| §3 | Migration truth |
| §4 | RECIPE AUTHORITY MAP — every runtime flow |
| §5 | Recipe domain-model drift matrix |
| §6 | Catalog abstraction status |
| §7 | SCALE ANALYSIS |
| §8 | MEDIA AUTHORITY MAP + CSP |
| §9 | Ingredient-image comparison |
| §10 | Planner dependency audit |
| §11 | Cooking / Inventory Truth boundary |
| §12 | AI runtime boundary |
| §13 | Offline / PWA impact |
| §14 | Test coverage matrix |
| §15 | Data-quality audit |
| §16 | Observability, production boundaries, documentation changes |
| §17 | FINDINGS (P0→P3), BLOCKERS, NON-BLOCKING DEBT |
| §18 | T14B RECOMMENDATION (exactly one strategy) + draft acceptance criteria |
| §19 | Verification evidence (exact commands, fresh results) |
| §20 | Safety confirmation |

Every statement labelled **VERIFIED** was produced by a command executed in
this audit (see §19). Statements labelled **HISTORICAL** come from prior
integration documents and are quoted only for lineage context.

---

## 1. VERIFIED CURRENT STATE

### 1.1 Repository identity

| Item | Value | Evidence |
| --- | --- | --- |
| Remote | `https://github.com/vn-dlo/Frigo-dev.git` | `git remote -v` |
| GitHub repository ID | `1368281478` | `curl api.github.com/repos/vn-dlo/Frigo-dev` → `.id` |
| Default branch | `main` | same API call |
| `origin/main` at audit start | `345cecf388321a00c96be387744a10e8c98bd9ac` | `git fetch origin main && git rev-parse origin/main` |
| Audit branch | `audit/t14a-production-recipe-truth` | `git checkout -b … origin/main` |
| Workspace dirt at start | only `.hoplite/settings.json` (sandbox preview config, not committed) | `git status --short` |

Repository identity **MATCHES** the expected canonical repository.

### 1.2 Production identity and FIRST GATE

| Item | Value |
| --- | --- |
| Deployed application SHA (rollout receipt) | `e6b91956484589c088e6d04a9835b3e59a2eb786` |
| Live readiness `commit` field (fetched 2026-09-15T20:23Z, read-only GET) | `e6b91956484589c088e6d04a9835b3e59a2eb786` |
| Readiness status | `degraded` (only `CONFIG_PLUS_GRANT_SECRET_MISSING` warning); `database=ok`, `queue=ok`, `ai=configured`, `config.ok=true` |
| Current `origin/main` | `345cecf388321a00c96be387744a10e8c98bd9ac` |
| Is `e6b9195` an ancestor of `main`? | **YES** (`git merge-base --is-ancestor`) |
| Commits between | `6665c66` (docs: record production rollout receipt) and merge `345cecf` |

`git diff --name-status e6b9195 origin/main`:

```
M  PROJECT_STATUS.md                                          DOCS_ONLY
M  TASK_BOARD.md                                              DOCS_ONLY
M  docs/ai/CURRENT_STATE.md                                   DOCS_ONLY
M  docs/ai/HANDOFF.md                                         DOCS_ONLY
M  docs/ai/TASK_BOARD.md                                      DOCS_ONLY
M  docs/integration/HANDOFF.md                                DOCS_ONLY
A  docs/integration/PRODUCTION_ROLLOUT_RECEIPT_2026-09-15.md  DOCS_ONLY
```

`git diff --stat e6b9195 origin/main -- src packages migrations package.json
pnpm-lock.yaml wrangler.jsonc wrangler.staging.jsonc wrangler.staging.jsonc.example
scripts tests public index.html vite.config.ts tsconfig.json tsconfig.worker.json
eslint.config.js tailwind.config.js postcss.config.js playwright.config.ts
.dev.vars.example` → **empty**.

Classification totals: APPLICATION 0, MIGRATION 0, CONFIG 0, DEPENDENCY 0,
TEST 0, SCRIPT 0, DOCS_ONLY 7.

```
PRODUCTION_MAIN_APPLICATION_EQUIVALENCE = PASS
```

Caveat (not a divergence of `main`): the compatibility Worker
`64ee9ed1d986a5e521598a36656e9c2f59d682ee` (PR #4 `release/pre0032-schema-compat`,
still **open**, base `d3d50cc`) was deployed *before* `e6b9195` and is **not**
reachable from `main`. The currently serving Worker is `e6b9195`, so this does
not affect the gate, but PR #4 must be merged or closed before T14B so that
T14B's base is unambiguous (Finding F-11).

### 1.3 Rollout documents present

All expected documents exist: `docs/integration/PRODUCTION_CONSOLIDATION.md`,
`PRODUCTION_ROLLOUT_RECEIPT_2026-09-15.md`, `HANDOFF.md`, `T13_MIGRATION_BRIDGE.md`,
`SAFE_PRODUCTION_MERGER_PLAN.md`; T13 certification material in
`docs/ai/inventory-truth/t13/T13R_FINAL_CERTIFICATION.md`,
`docs/ai/release/T13_INDEPENDENT_FINAL_REVIEW.md`,
`INVENTORY_TRUTH_RELEASE_CERTIFICATION.md`, `INVENTORY_TRUTH_RECERTIFICATION.md`.

---

## 2. HISTORICAL CONTEXT — production lineage (verified graph)

All SHAs below were resolved with `git rev-parse`, `git log`, `git rev-parse
<sha>^1 ^2` and `git merge-base --is-ancestor <sha> origin/main` (all = yes).

```
Production/Qwen lineage                       T13 / Takosan lineage
------------------------                      ---------------------
d1b06732  old canonical main                  32ddbb4  T13R certified application freeze
   |      (archive/pre-canonical-consolidation) |       (2026-09-14)
   |  first-parent: 89eeb52 … 05423f2 (PR #18)  |
   |  8fe30a6 docs: consolidation plan          42e0037/897102b docs T13R
   |                                            e37ee28 feat(brand): Frigo -> Takosan
9c78c1a  merge: preserve governed qwen          d3d2446 docs brand checkpoint
   |     production runtime (da41686 side)      ff63edf feat(brand): harden Takosan palette
   |                                               |
   +-------------------- c50dc76 merge: integrate certified t13 and hardened takosan
                            |    (parents 9c78c1a, ff63edf)
                         e34ed16  test(integration): certify qwen inventory bridge  [SUPERSEDED candidate]
                         c14116e / 231d1e7 docs
                         5f6853d  fix(integration): remediate independent review blockers  [APPLICATION FREEZE]
                         f26003b … 7ede92c  docs-only certification / promotion / CI receipts
                            |
a5cfb14  Promote certified Frigo/Takosan integration to canonical main
         (merge; parents d1b06732, 7ede92c)  -- PR #2
   |
d3d50cc  Merge PR #3 (1e1f3ee docs: record canonical merge completion)
   |
   |   ff2da3b fix(d1): make inventory migrations wrangler-safe
   |           (rewrites 0025–0028, 0030, 0031 trigger guards; adds wrangler.staging.jsonc)
e6b9195  Merge PR #5 ← ff2da3b                       ==> DEPLOYED PRODUCTION WORKER
   |
   |   6665c66 docs: record production rollout receipt
345cecf  Merge PR #6 (docs-only)                     ==> CURRENT origin/main
```

Side branch not on `main`: `64ee9ed1` (PR #4, compatibility Worker deployed
first during rollout; base `d3d50cc`).

Rejected freeze `7b7bb69` and superseded candidate `e34ed16` are ancestors of
`main` (history preserved) but are **not** authorities. Old main `d1b06732` is
an ancestor of `main` via `a5cfb14^1`; a doc line saying "main unchanged at
d1b0673" is HISTORICAL and false today.

Important for T14: the D1 compatibility fix `ff2da3b` **only** touched
inventory migrations and staging config. No recipe-related file changed
between the T13 freeze and the deployed Worker except through the Takosan brand
commits (UI/assets), verified below by inspecting current recipe sources.

---

## 3. MIGRATION TRUTH

| Item | Verified value |
| --- | --- |
| Migration files | 33 (`ls migrations \| wc -l`) |
| First | `0001_initial_schema.sql` |
| Last / highest | `0033_scan_evidence_completeness.sql` |
| Contiguous 0001–0033 | YES (no gaps) |
| Duplicate numbers | NONE (`ls migrations \| sed 's/_.*//' \| uniq -d` → empty) |
| Production `0023_scan_request_fingerprint.sql` | PRESENT |
| `0034+` | NONE |
| T13 renumbering | dev `0023`–`0031` → bridge `0024`–`0032` byte-copied (per `T13_MIGRATION_BRIDGE.md`), then `ff2da3b` rewrote trigger guards in `0025–0028,0030,0031` for Wrangler's statement splitter |
| Production ledger (rollout receipt + `schema:check:remote` PASS) | `0001`–`0033` |

```
NEXT_AVAILABLE_MIGRATION = 0034   (verified: highest existing = 0033, no 0034+)
```

**Recipe-related migrations** (grep `recipe` in `migrations/*.sql`):

| Migration | Recipe relevance |
| --- | --- |
| `0001_initial_schema.sql` | `recipes` (id, slug UNIQUE, title, description, cuisine, cook_time_minutes, servings, difficulty, image_url, tags JSON, created_at), `recipe_ingredients`, `recipe_steps`, `cooked_meals` |
| `0003`, `0005`, `0007`, `0008`, `0010` | Week planner tables referencing `recipe_id` and `snapshot_json` |
| `0006_vietnamese_recipe_bank.sql` | **Only recipe seed.** `INSERT INTO recipes` 59 rows, `recipe_ingredients` 328 rows, `recipe_steps` 295 rows, plus 14 `INSERT OR IGNORE INTO ingredients`. Global recipes `gl-01..gl-12` are **not** seeded. `image_url` = Unsplash URLs; `tags` JSON carries `cat:<category>` and `region:<region>` markers |
| `0019_recipe_domain_foundation.sql` | Adds `recipes.family_id, prep_time_minutes, source_type('legacy' default), source_reference, verification_state('unverified'), version`; creates `recipe_families`, `recipe_family_slots`, `recipe_family_options`, `recipe_nutrition`, `recipe_classifications`, `measurement_units`; validation triggers on `recipes` and `recipe_ingredients` |
| `0020_t01_foundation_hardening.sql` | foundation hardening |
| `0021_recipe_personalization.sql` | ranking preferences/feedback |
| `0022_generated_meal_plans.sql` | T04 generated plans |

Local full-ledger replay (`sqlite3`, all 33 files, `PRAGMA foreign_keys=ON`,
`.bail on`) → OK. Resulting recipe rows:

```
recipes                59   (all cuisine='vietnamese')
recipe_ingredients    328
recipe_steps          295
recipe_families         0
recipe_classifications  0
recipe_nutrition        0
image_url NULL          0   (59 × https://images.unsplash.com/…)
source_type/verification_state: legacy/unverified × 59
```

Enforcement commands (read from `package.json`, `scripts/*.sh`):

| Purpose | Command | Runs where | Mutating? |
| --- | --- | --- | --- |
| Migration replay + fixture upgrade assertions | `pnpm check:migrations` → `scripts/migration-smoke.sh` (sqlite3 `:memory:`) | local | No |
| Local D1 schema gate | `pnpm schema:check:local` → `d1-schema-gate.sh local` (wrangler `--local`) | local | No |
| Remote schema gate (read-only SELECT-only SQL) | `pnpm schema:check:remote` (requires Cloudflare auth; gated behind `CHECK_REMOTE_SCHEMA=1` in `deploy-check.sh`) | remote | No (read-only) — **not run in T14A (no credentials, not required)** |
| Combined local gate | `pnpm check` → `scripts/deploy-check.sh` | local | No |

---

## 4. RECIPE AUTHORITY MAP

### 4.1 Static source (`ALL_RECIPES`)

`ALL_RECIPES` **exists** and is the production recipe authority.

```
packages/recipes/src/data.ts
  export const GLOBAL_RECIPES: Recipe[] = [ gl-01 … gl-12 ]   // 12, hand-written TS
  export const SEED_RECIPES  = [...VIETNAMESE_RECIPES, ...GLOBAL_RECIPES];
  export const ALL_RECIPES   = SEED_RECIPES;
packages/recipes/src/vietnamese-bank.ts
  export const VIETNAMESE_RECIPES: Recipe[] = [ 59 recipes, imageUrl: VIETNAMESE_DISH_IMAGES[slug] ]
packages/recipes/src/vietnamese-images.ts
  export const VIETNAMESE_DISH_IMAGES: Record<string,string>  // 59 slug → Unsplash URL
```

Counts (VERIFIED by bundling `@frigo/recipes` with esbuild and executing an
audit script outside the repo — see §19):

| Metric | Value |
| --- | --- |
| Total recipes | **71** (59 Vietnamese + 12 global) |
| By cuisine | vietnamese 59, korean 3, chinese 3, italian 2, japanese 2, thai 2 |
| By Vietnamese category | mon_canh 6, mon_kho 6, mon_xao 6, mon_chien 6, mon_hap_luoc 6, mon_cuon_nom 6, mon_bun_pho 6, mon_chay 6, mon_nhanh_sang 6, mon_lau_tiec 5; (none) 12 global |
| By region | toan_quoc 26, bac 18, nam 11, trung 4; (none) 12 |
| By difficulty | easy 44, medium 23, hard 4 |
| Ingredient lines | 385 (4 optional) |
| Distinct canonical ingredient IDs referenced | all within the 45 `CANONICAL_INGREDIENTS` |
| Steps | avg 4.80/recipe; 69 steps with timers, 5 with tips |
| Serialized JSON | 131,686 bytes (matches production `GET /recipes` 131,698 bytes) |

Recipe IDs (`vn-<category>-NN`, `gl-NN`) and slugs originate **manually** in
the TypeScript files. Recipes are hand-maintained TypeScript data with no
generator in the build path. `tests/unit/generate-migration.test.ts` is a
*side-effecting* generator disguised as a test (rewrites `vietnamese-bank.ts`
image references and regenerates `migrations/0006_*.sql`) — idempotent today,
tree clean after run (Finding F-08).

### 4.2 D1 recipe source

| Question | Answer (VERIFIED) |
| --- | --- |
| Does production D1 contain recipes? | Migration ledger `0001–0033` applied ⇒ **59 Vietnamese seed rows** from `0006` are present (plus any `INSERT OR IGNORE INTO recipes` rows created by cooking/shopping completion for global `gl-*` recipes — see §11). Direct row count on production was **not** queried (no credentials; out of scope). |
| Which migrations seed recipes? | `0006` only |
| Columns now | `recipes`: id, slug, title, description, cuisine, cook_time_minutes, servings, difficulty, image_url, tags, created_at, family_id, prep_time_minutes, source_type, source_reference, verification_state, version. `recipe_ingredients`: id, recipe_id, ingredient_id, name, required_quantity, unit, is_optional. `recipe_steps`: id, recipe_id, step_number, instruction, tip, timer_minutes |
| Are D1 rows complete enough to power runtime? | **Partially.** For the 59 VN recipes: ingredients, steps, image_url, tags (with `cat:`/`region:` encoded) exist. Missing vs. runtime `Recipe`: `nutrition` (no rows in `recipe_nutrition`), typed `category`/`region` columns (only encoded inside `tags` JSON), and the 12 global recipes are absent. `INSERT OR IGNORE` rows created by cooking carry **no** description/image/tags/ingredients/steps. |
| Does `packages/db/src/recipe-catalog.ts` read production recipe data? | It reads `recipes`, `recipe_ingredients`, `recipe_families(+slots/options)`, `ingredient_aliases`, `recipe_classifications` in one 8-statement `db.batch`. It does **not** read `image_url`, `tags`, `recipe_steps`, or nutrition (steps are read separately by `meal-planning-snapshot.ts`). |
| Is that reader used by production request paths? | **Only** by T04 `/api/v1/meal-planning/*` (via `loadMealPlanningSnapshot`), and those routes return 404 `MEAL_PLANNER_DISABLED` unless `MEAL_PLANNER_ENABLED === 'true'`. `wrangler.jsonc` production `vars` do **not** set `MEAL_PLANNER_ENABLED`; the frontend `/planner` routes redirect to `/week` unless `VITE_MEAL_PLANNER_ENABLED === 'true'`. ⇒ **the D1 reader is present in the deployed bundle but inert in production.** |

### 4.3 Runtime authority per flow

Legend: STATIC = `ALL_RECIPES` TS array in the Worker/client bundle; D1 =
`readRecipeCatalog`/`loadMealPlanningSnapshot`; SNAPSHOT = persisted JSON.

```
FLOW:     1. GET /api/v1/recipes
SOURCE:   ALL_RECIPES (in-memory filter by cuisine/category/region/q)
FILE:     src/worker/routes/recipes.ts:179-202
FUNCTION: recipeRoutes.get('/recipes')
TYPE:     STATIC
FALLBACK: none (no DB access; anonymous GET allowed by auth middleware)

FLOW:     2. GET /api/v1/recipes/:id
SOURCE:   ALL_RECIPES.find(id || slug) + evaluateRecipeMatch(recipe, {inventory from D1})
FILE:     src/worker/routes/recipes.ts:205-220
FUNCTION: recipeRoutes.get('/recipes/:id')
TYPE:     STATIC (recipe) + D1 (inventory only)
FALLBACK: 404 'Recipe not found'

FLOW:     3. GET /api/v1/recommendations
SOURCE:   ALL_RECIPES filtered → rankRecipes(targetRecipes, {inventory})
FILE:     src/worker/routes/recipes.ts:223-256; packages/recipes/src/engine.ts
FUNCTION: recipeRoutes.get('/recommendations'), rankRecipes, evaluateRecipeMatch
TYPE:     STATIC (recipes) + D1 (household inventory via fetchHouseholdInventoryFromDb)
FALLBACK: none

FLOW:     4. weekly-plan generation (Week v1, POST /api/v1/week/plans)
SOURCE:   generateWeeklyMealPlan(input, inventory, ALL_RECIPES)
FILE:     src/worker/routes/week.ts:1022; packages/domain/src/week/planner.ts:24
FUNCTION: generateWeeklyMealPlan (default param availableRecipes = ALL_RECIPES)
TYPE:     STATIC; result persisted as SNAPSHOT (full Recipe object per slot, see 4.4)
FALLBACK: evaluated[0] || availableRecipes[0] (first static recipe) when nothing eligible

FLOW:     5. weekly-plan regeneration (POST /api/v1/week/plans/:id/regenerate)
SOURCE:   generateWeeklyMealPlan(..., inventory, ALL_RECIPES)
FILE:     src/worker/routes/week.ts:1075-1086
TYPE:     STATIC → SNAPSHOT
FALLBACK: as flow 4

FLOW:     6. swap alternatives (Week v1)
SOURCE:   getSwapAlternatives(targetSlot, inventory, availableRecipes = ALL_RECIPES)
FILE:     src/worker/routes/week.ts:1143; packages/domain/src/week/planner.ts:320
TYPE:     STATIC (candidates) + SNAPSHOT (current slot recipe)
FALLBACK: none

FLOW:     7. execute swap (Week v1)
SOURCE:   ALL_RECIPES.find(recipeId || slug) → swapMealInPlan(plan, mealId, newRecipe, inventory)
FILE:     src/worker/routes/week.ts:1148-1160
TYPE:     STATIC → SNAPSHOT (recommitted via commitPlan)
FALLBACK: 404 NOT_FOUND

FLOW:     8. cooking start (POST /api/v1/recipes/:id/cook/start)
SOURCE:   ALL_RECIPES.find(id || slug)
FILE:     src/worker/routes/recipes.ts:259-275
TYPE:     STATIC (no persistence; returns stepsCount)
FALLBACK: 404

FLOW:     9. cooking complete / deduction (POST /api/v1/recipes/:id/cook/complete)
SOURCE:   ALL_RECIPES.find(id || slug) for title/units; deductions from client body;
          writes `INSERT OR IGNORE INTO recipes (7 columns)` + cooked_meals + inventory mutation
FILE:     src/worker/routes/recipes.ts:278-560 (legacy), completeAdoptedCooking 560-751 (native)
TYPE:     STATIC (recipe) + D1 (inventory authority) — see §11
FALLBACK: 404 NOT_FOUND / 503 DATABASE_UNAVAILABLE

FLOW:    10. meal detail (client MealDetailPage)
SOURCE:   targetSlot.recipe from useWeekStore.currentPlan (SNAPSHOT hydrated by GET /week/plans/:id)
FILE:     src/web/pages/MealDetailPage.tsx:77; src/worker/routes/week.ts:765-870 (getMealPlan)
TYPE:     SNAPSHOT; server falls back to ALL_RECIPES.find(recipe_id) only for legacy rows lacking snapshot_json (week.ts:812)
FALLBACK: STATIC lookup by id/slug

FLOW:    11. recipe detail (client RecipeDetailPage)
SOURCE:   recipesApi.getRecipeById → GET /recipes/:id (STATIC on server)
FILE:     src/web/services/recipes.ts:43-58
TYPE:     STATIC (server) ; offline → STATIC (client bundle copy of ALL_RECIPES)
FALLBACK: client ALL_RECIPES.find + evaluateRecipeMatch with localStorage inventory

FLOW:    12. offline mode
SOURCE:   client-bundled ALL_RECIPES; recipesApi.getRecommendations → rankRecipes; week.ts → generateWeeklyMealPlan/swapMealInPlan; IngredientDetailPage → ALL_RECIPES.filter (always client-side, even online)
FILE:     src/web/services/recipes.ts, src/web/services/week.ts:66,159, src/web/pages/IngredientDetailPage.tsx:142
TYPE:     STATIC (client copy — identical module, separate bundle)
FALLBACK: n/a (this *is* the fallback)

FLOW:    13. persisted weekly-plan hydration (GET /week/plans/:id, /week/plans/current)
SOURCE:   meal_plans.snapshot_json (version 1, full MealPlan incl. slot.recipe objects); else relational rows + slot snapshot_json; else ALL_RECIPES.find(recipe_id)
FILE:     src/worker/routes/week.ts:765-870 parseMealPlanSnapshot / getMealPlan
TYPE:     SNAPSHOT → STATIC fallback
FALLBACK: as stated; KV `plan_<id>` is cache only (populated after D1 read)

FLOW:    14. AI recipe-related routes
SOURCE:   T04 POST /meal-planning/plans/:id/explanation → explainMealReasons; transport = AIRouter task 'recipe_explanation' (Qwen) only orders grounded reason-code IDs. Gated by MEAL_PLANNER_ENABLED + MEAL_PLANNER_AI_ENABLED (both unset in production wrangler.jsonc).
FILE:     src/worker/services/meal-planning-explanation.ts; packages/ai/src/router.ts (rankRecipes task 'recipe_ranking' exists but has no Worker/HTTP caller)
TYPE:     OTHER (AI over reason codes only; recipe data comes from D1 snapshot inside T04)
FALLBACK: deterministic explanation path when transport undefined / mock mode

FLOW:    (T04) POST /meal-planning/plans, /regenerate, /swap, /alternatives, /shopping
SOURCE:   loadMealPlanningSnapshot(db) → mapRecipeCatalogRead (D1 recipes/ingredients/families/classifications/aliases) + recipe_steps + inventory_items + ranking context
FILE:     packages/db/src/meal-planning-snapshot.ts; src/worker/services/meal-planning.ts; packages/recipes/src/weekly-planner.ts
TYPE:     D1 (feature-flagged OFF in production)
FALLBACK: none; 404 MEAL_PLANNER_DISABLED when flag off

FLOW:    shopping list creation (POST /api/v1/shopping/lists)
SOURCE:   ALL_RECIPES.find(sourceRecipeId || sourceRecipeTitle); INSERT OR IGNORE INTO recipes (7 cols)
FILE:     src/worker/routes/shopping.ts:147-160
TYPE:     STATIC + D1 upsert of stub recipe row
```

**Answer to "Is D1 actually authoritative for recipes?": NO.** Every
production-enabled read/write flow resolves recipes from `ALL_RECIPES`. D1
`recipes` rows are (a) a seed shadow for 59 VN recipes, (b) a foreign-key
anchor for `cooked_meals`/`shopping_lists` (stub rows inserted lazily), and
(c) the input of the flag-disabled T04 planner.

### 4.4 Snapshot persistence (Week v1)

`commitPlan` writes `meal_plans.snapshot_json = { version: 1, plan }` where each
`slot.recipe` is the **full `Recipe` object** (id, slug, title, description,
cuisine, category, region, cookTimeMinutes, servings, difficulty, **imageUrl**,
nutrition, ingredients, steps, tags). `meal_plan_slots.recipe_id` +
`snapshot_json = JSON.stringify(slot)` are also written (and v2 tables in
`dual` mode). ⇒ **SNAPSHOT HYBRID: full recipe object + raw image URL + recipe ID.**

Consequence: if a recipe's image or ingredients change in `ALL_RECIPES`, saved
Week plans keep the old embedded copy indefinitely; MealDetailPage renders the
stale `imageUrl`. There is no revalidation of `slot.recipe` against the catalog.

T04 generated plans (`generated_meal_plans.result_json`) store
`source: {kind, id, version, variantId}`, `title`, `cuisine`, `instructions`
(copied from `recipe_steps`) and fingerprints (`catalog` fingerprint ⇒
`stale_catalog` freshness reason). **No image URL** is stored in T04 DTOs
(`meal-planning-dto.ts` has no image field).

---

## 5. RECIPE DOMAIN-MODEL DRIFT (legacy `Recipe` vs foundation `RecipeDefinition`)

Sources: `packages/recipes/src/types.ts` (legacy, runtime), `packages/recipes/src/foundation.ts` + `catalog.ts` (foundation), `migrations/0001`+`0019` (D1).

| Field | Legacy `Recipe` | Foundation `RecipeDefinition` | D1 column | Classification |
| --- | --- | --- | --- | --- |
| id | `string` (free) | `CatalogIdSchema` `/^[A-Za-z0-9][A-Za-z0-9_-]*$/` ≤100 | `recipes.id` | BOTH (all 71 current IDs conform) |
| slug | `string` | `CatalogIdSchema` | `recipes.slug UNIQUE` | BOTH |
| title | `string` | `CatalogTextSchema` (trim, 1–300) | `title` | BOTH |
| description | `string` (required) | `string ≤10000` optional | `description` nullable | PARTIAL (optionality differs) |
| cuisine | `CuisineType` enum of 6 | `CatalogIdSchema` (free ID) | `cuisine TEXT` | PARTIAL (typed enum → free string) |
| country | — | — | — | NEITHER |
| region | `CulinaryRegion` optional | — | only inside `tags` JSON as `region:x` | **LEGACY ONLY** (runtime filter `GET /recipes?region=` depends on it) |
| category | `VietnameseCategory \| string` optional | — (would map to `recipe_classifications.kind='meal_type'`? not implemented) | only inside `tags` JSON as `cat:x` | **LEGACY ONLY** (runtime filter `?category=` depends on it) |
| servings | `number` | int positive | `servings INTEGER` | BOTH |
| prep time | — | `prepTimeMinutes` optional | `prep_time_minutes` | FOUNDATION ONLY |
| cook time | `cookTimeMinutes` | `cookTimeMinutes` nonneg int | `cook_time_minutes` | BOTH |
| difficulty | easy/medium/hard | same enum | `difficulty` + trigger | BOTH |
| ingredients[] | `RecipeIngredient{ingredientId,name,requiredQuantity,unit,isOptional?}` | `StructuredRecipeIngredient` (same shape, `ingredientId` strict `/^[A-Z][A-Z0-9_]*$/`, quantity >0, `isOptional` default false) | `recipe_ingredients` | BOTH |
| optional semantics | `isOptional?` undefined = required | `isOptional` boolean default false | `is_optional 0/1` | BOTH (adapter normalizes `?? false`) |
| units | `StandardUnit` (8) | `StandardUnitSchema` (same 8) | `measurement_units` FK trigger | BOTH |
| steps/instructions | `RecipeStep{stepNumber,instruction,tip?,timerMinutes?}` (required array) | — (not in `RecipeDefinition`; T04 reads `recipe_steps` separately, instruction only) | `recipe_steps` (step_number, instruction, tip, timer_minutes) | **LEGACY ONLY in the catalog model**; D1 has the table; `tip`/`timerMinutes` are dropped by T04 DTO |
| nutrition | `{calories,proteinG,fatG,carbG}` optional (present on all 71) | — (`recipe_nutrition` → `nutrition_profiles`, 0 rows) | `recipe_nutrition` empty | **LEGACY ONLY** (runtime shows kcal in RecipeCard) |
| tags | `string[]` (UI chips + search) | `recipe_classifications` (kind ∈ meal_type/dietary/allergen/method/equipment/suitability) | `tags` JSON + `recipe_classifications` (0 rows) | PARTIAL/DIFFERENT SEMANTICS (free UI labels vs typed facts) |
| familyId | — | optional `CatalogIdSchema` | `family_id` | FOUNDATION ONLY |
| provenance | — (adapter stamps `legacy/unverified`) | `{sourceType, sourceReference, verificationState, version}` | `source_type, source_reference, verification_state, version` | FOUNDATION ONLY |
| source type | — | enum legacy/curated/imported/ai_generated/user_generated | `source_type` | FOUNDATION ONLY |
| source reference | — | required for imported/ai | `source_reference` | FOUNDATION ONLY |
| verification state | — | unverified/reviewed/rejected | `verification_state` | FOUNDATION ONLY |
| version | — | int ≥1 | `version` | FOUNDATION ONLY |
| media / image | `imageUrl: string` (required) | — | `image_url` (nullable, not read by catalog reader) | **LEGACY ONLY** in the model; D1 column exists but is not part of the foundation contract |

**Data that would be LOST by using the foundation model as-is:** `imageUrl`,
`nutrition`, `steps` (tip, timerMinutes; instruction survives only via T04's
separate read), `tags`, typed `category`, typed `region`, required
`description`. `adaptStaticRecipeCatalog` (catalog.ts:369-395) already drops
exactly these fields when adapting static → snapshot.

---

## 6. RECIPE CATALOG ABSTRACTION STATUS

| Capability | Present? | Where |
| --- | --- | --- |
| `RecipeCatalogSnapshot` type (`source: 'static'\|'d1'\|'provided'`, ingredientIds, recipes, families, classifications, diagnostics) | YES | `packages/recipes/src/catalog.ts` |
| `createRecipeCatalog` validator (excludes invalid/duplicate/unknown refs, deterministic sorting) | YES | catalog.ts:215-366 |
| Static → catalog adapter | YES `adaptStaticRecipeCatalog(CANONICAL_INGREDIENTS, ALL_RECIPES)` | catalog.ts:369 |
| D1 → catalog loader | YES `readRecipeCatalog(db)` / `prepareRecipeCatalogRead` + `mapRecipeCatalogRead` (8-statement batch) | `packages/db/src/recipe-catalog.ts` |
| Requirement comparison | YES `auditRecipeCatalogs(staticSnap, d1Snap)` → `requirements[]` multiset diff | catalog.ts:397+ |
| Unit drift detection | YES `units.{staticOnly,d1Only,requirementDifferences}` | same |
| Recipe-ID drift | YES `recipeIds.{staticOnly,d1Only,changed}` | same |
| Legacy alias audit (no promotion) | YES | recipe-catalog.ts `auditLegacyAliases` |
| Planner consumes snapshot | YES (T04 only) `createPlanningContext({catalog})` enforces `PLANNER_LIMITS.catalogRecipes = 500` | planner-context.ts |
| Runtime routes use it | **NO** for `/recipes`, `/recommendations`, `/week/*`, cooking, shopping | §4.3 |
| Drift audit exercised | test only: `tests/integration/recipe-catalog.test.ts` "audits the unchanged static and D1 seed catalogs" expects `staticOnly = gl-01..gl-12`, everything else empty (PASS in this audit) | |

```
IS_RECIPE_CATALOG_ABSTRACTION_PRESENT = YES
IS_RECIPE_CATALOG_RUNTIME_AUTHORITY   = NO
```

The abstraction is **read-only, side-effect free, and test-proven for
static/D1 parity on ingredient requirements and units**, but it deliberately
excludes media, nutrition, steps and UI tags, and there is no write path.

---

## 7. SCALE ANALYSIS

Facts measured in this audit:

- Static data bundle (`packages/recipes/src/data.ts`, esbuild minified): 157,662 B raw, **28,544 B gzip** for 71 recipes ⇒ ≈2.2 KB raw / ≈0.4 KB gzip per recipe.
- Client production build: `index-*.js` 297 KB (75 KB gzip) contains all 59 Unsplash URLs (verified by grep) ⇒ **recipe data is in the main SPA chunk, not lazy**.
- Worker bundle (esbuild estimate, unminified) 1.36 MB incl. recipe data.
- `GET /recipes` payload today: 131,698 B uncompressed (production, measured), no `Cache-Control` header set by the route.
- `GET /recipes` filters with `Array.filter` + `includes` per request: O(N) per request, plus JSON serialization of all matching recipes (no pagination).
- `/recommendations`: `rankRecipes` = O(N × I) with I ≈ 5.4 ingredients; sort O(N log N); returns **all** ranked recipes (no limit).
- Week v1 planner: for each of up to 7 days × slots, `availableRecipes.filter(isRecipeEligible)` then `evaluateWeeklyCandidate` for every eligible recipe ⇒ O(slots × N × I). Plan snapshot embeds full recipe objects per slot (bounded by slot count, not N).
- T04 planner: `PLANNER_LIMITS.catalogRecipes = 500` hard input cap (throws above), `recipeLimit` default 80 (`select(catalog.recipes, 'recipe', policy.recipeLimit)` truncates), beam 6/16, `maxSearchStates` 1024/4096, `candidateLimitPerSlot` 8/32. `loadMealPlanningSnapshot` reads **all** recipes + all lines + all steps in one batch per request and fingerprints them (SHA-256 over canonical JSON).
- D1 access pattern for T04: full-table scans of `recipes`, `recipe_ingredients`, `recipe_steps` every planning request; no LIMIT, no household scoping (catalog is global).
- Search: substring `includes` over title/description/tags/ingredient names; no index.
- Caching: none for recipe payloads (KV is used for inventory `inv_<hh>` and `plan_<id>` only).
- Family expansion: `recipe_families` 0 rows; `familyLimit` 4, `variantCandidatesPerFamily` 16, `variantSearchStatesPerFamily` 128 — bounded.

| Scale | Verdict | Exact bottleneck |
| --- | --- | --- |
| 100 recipes | **SAFE** | ~40 KB gzip client data, ~185 KB `/recipes` JSON; all loops trivial. |
| 1,000 recipes | **ACCEPTABLE WITH LIMITS** | Client main chunk grows by ≈2.2 MB raw / ≈0.4 MB gzip (hand-written TS ⇒ also compile/lint time); `/recipes` and `/recommendations` return ≈1.8 MB JSON with no pagination/cache; Week v1 planner still fine (≈7×1000×5 ops); T04 would **throw** `Planning catalog input limit exceeded` at >500 recipes unless `PLANNER_LIMITS.catalogRecipes` is raised, and its per-request full-catalog D1 read + SHA-256 fingerprint becomes the dominant cost. Requires: server-side pagination, response caching, lazy client catalog, T04 catalog pre-filter. |
| 5,000 recipes | **REQUIRES ARCHITECTURE CHANGE** | Static TS array is no longer viable (≈11 MB source, ≈2 MB gzip shipped to every PWA client; Worker script size grows toward the 3 MB gzip Workers limit — unverified exact but directionally certain); `/recipes` unpaginated ≈9 MB; T04 full-catalog batch read + JSON fingerprint per request; Week v1 O(slots×N) still OK CPU-wise but its input list must come from a query, not a module constant. Needs D1-backed paginated queries (cuisine/category/region indexes exist only for `cuisine`), server-side candidate pre-selection, and an offline subset strategy. |
| 20,000 recipes | **REQUIRES ARCHITECTURE CHANGE** | Everything above plus: full-text search needs an index (SQLite FTS5 is not available in D1; LIKE scans over 20k rows × several columns per request are slow but feasible only with LIMIT + indexes); candidate generation must be pre-filtered by inventory/ingredient inverted index (`idx_recipe_ingredients_ingredient` exists); planner catalog must be a query result of ≤500 (T04 cap) or ≤80 (policy). Vectorize is **not** required by any evidence in this audit; a keyword/ingredient inverted index in D1 is sufficient for the current feature set. |

---

## 8. MEDIA AUTHORITY MAP

### 8.1 Inventory (VERIFIED from `ALL_RECIPES` + `public/`)

| Metric | Value |
| --- | --- |
| Total recipe records | 71 |
| Recipes with local self-hosted image (`/frigo/recipes/...`) | 12 (all `gl-*`) |
| Recipes with external URL | 59 (all `vn-*`, all `https://images.unsplash.com/photo-*?auto=format&fit=crop&w=800&q=80`) |
| Unique image URLs | 45 of 71 |
| Unique Unsplash photo IDs | 37 for 59 recipes |
| Recipes sharing an image with another recipe | **46** (20 shared groups; worst: `photo-1547592180-85f173990554` used by 4 unrelated dishes: canh cua đồng, canh nấm hạt sen, cháo thịt bằm, lẩu nấm; `photo-1546069901-ba9599a7e63c` by 4; `kimchi-fried-rice.webp` by 3 Korean dishes) |
| Broken local asset references | **1**: `gl-11 spaghetti-bolognese → /frigo/recipes/global/carbonara.webp` (file absent in `public/`; production returns HTTP 200 `text/html` SPA fallback instead of an image — verified) |
| Cuisine/asset mismatch | `gl-12 chinese-tomato-egg → /frigo/recipes/vietnam/dau-phu-sot-ca-chua.webp` (tofu-in-tomato image for an egg dish) |
| Recipes with no image field | 0 |
| Local recipe asset files present | 12 files, 740 KB total (`public/frigo/recipes/{global,vietnam}`); `canh-chua-ca.webp`, `com-chien-trung.webp`, `ga-kho-gung.webp`, `rau-muong-xao-toi.webp`, `thit-kho-trung.webp` exist but are **unused** by any VN recipe (VN recipes all point to Unsplash) |
| D1 `recipes.image_url` | 59 Unsplash URLs (mirrors static; not read by any runtime path) |
| Takosan recipe media | none (`public/takosan/` = app icons, brand, mascots only) |
| `scripts/generate-recipe-images.ts` | prompt catalog for 59 VN AI images (`targetFilename: <slug>.webp`); never wired into build or data |

### 8.2 External domains vs production CSP

Production CSP (fetched from `https://frigo.tungjpstore.net/` response header,
identical to `spaCsp()` and `public/_headers`):

```
img-src 'self' data: blob: https://lh3.googleusercontent.com
```

| Domain / scheme | Used by | CSP status |
| --- | --- | --- |
| `images.unsplash.com` | 59 VN recipe `imageUrl` (static, D1 `image_url`, Week snapshots) | **BLOCKED** |
| `'self'` (`/frigo/recipes/...`) | 12 global recipes, RecipeCard fallback | ALLOWED |
| `data:` | none in recipe data | ALLOWED (unused) |
| `blob:` | scan previews only | ALLOWED |
| `https://lh3.googleusercontent.com` | Google avatar | ALLOWED (exception, not recipe) |
| Takosan assets (`/takosan/...`) | brand/mascot | ALLOWED (`'self'`) |

**Consequence (CONFIRMED by code + live header):** in production every one of
the 59 Vietnamese recipe images is refused by the browser. Consumers that have
an `onError` handler (RecipeCard, HomePage hero) fall back to
`/frigo/recipes/vietnam/thit-kho-trung.webp` (RecipeCard) or the Takosan symbol
(HomePage); consumers without `onError` (RecipeDetailPage hero, MealDetailPage
hero, IngredientDetailPage thumbnails) render a broken image. Because 59/71
recipes fall back to the *same* braised-pork photo in lists, the visible
catalog appears near-uniform. **T14A does not change CSP**; this is recorded as
Finding F-01.

### 8.3 R2 `IMAGES`

`wrangler.jsonc` binds `IMAGES → bucket frigo-images`. All usages
(`src/worker/routes/scans.ts`, `src/worker/services/scan-queue.ts`) use key
convention `users/<userId>/scans/<scanId>/original.webp` for **user scan
images**. No recipe-related key convention, no recipe `put/get`, no public
serving route. `config/validation.ts` requires IMAGES only for async scan
replay.

```
R2_IMAGES_CONTENT = user scan images only  (recipe images: NONE)
```

### 8.4 UI consumers

| Consumer | Source | Lazy | `onError` fallback | Fallback target |
| --- | --- | --- | --- | --- |
| `RecipeCard` (compact + full; used by RecipesPage) | `recipe.imageUrl` from `/recommendations` DTO | `loading="lazy"` | YES | `/frigo/recipes/vietnam/thit-kho-trung.webp` (hard-coded) |
| `RecipeDetailPage` hero | `recipe.imageUrl` (GET /recipes/:id or offline static) | no (eager, width/height set) | **NO** | broken image |
| `MealDetailPage` hero | `targetSlot.recipe.imageUrl` (Week snapshot) | no | **NO** | broken image |
| `IngredientDetailPage` "recipes using this" | client `ALL_RECIPES.filter` | no | **NO** | broken image |
| `HomePage` today's meal | `todayMeal.recipe.imageUrl` (Week snapshot via home-meal) | no | YES | `TAKOSAN_BRAND.symbol` |
| `WeekDashboardPage`, `PlannerPage`/`features/planner/*`, `CookingModePage`, `CookingCompletePage`, `WeekShoppingPage` | no recipe image rendered (illustrations/mascots/ingredient icons only) | — | — | — |

Consistency: **INCONSISTENT** — three different fallback behaviors (specific
dish photo, brand symbol, none).

### 8.5 Service Worker

`public/sw.js` (hand-written, `takosan-pwa-v2`): precaches only shell/brand
assets; cache-first for `/frigo/`, `/takosan/`, `/assets/` and Google Fonts
hosts; **does not** cache `images.unsplash.com` (and could not display them
anyway under CSP); API responses are network-with-cache-fallback (only
previously fetched GETs). `vite-plugin-pwa` is in devDependencies but **not**
configured in `vite.config.ts`.

---

## 9. INGREDIENT IMAGE ARCHITECTURE COMPARISON

`src/web/lib/ingredient-images.ts` `getIngredientImage(ingredientId?, name?)`:

| Property | Ingredient images | Recipe images |
| --- | --- | --- |
| Canonical ID | YES (`CANONICAL_INGREDIENTS`, 45 IDs, strict regex) | YES (recipe `id`/`slug`) |
| Centralized resolver | YES (single function, ~32 ID/name rules) | NO (raw `imageUrl` string on the data object) |
| Deterministic local asset mapping | YES → `FRIGO_ASSETS.ingredients.{pantry,vegetables}` (51 PNG files under `public/frigo/ingredients`) | Partial: 12 local files, 59 external |
| Fallback | YES, deterministic (`tomato.png`) | Inconsistent per consumer (§8.4) |
| Substring name matching | YES (Vietnamese substrings, e.g. `'cá'` matches any fish) — over-broad but bounded | n/a |
| Data-vs-media coupling | Decoupled: data has no image field; resolver derives from ID | Coupled: URL embedded in data and in persisted Week snapshots |

Reusable conceptually for recipe media: **ID-keyed resolver + deterministic
local path derivation + single fallback**. E.g. `recipeImageFor(slug)` →
`/frigo/recipes/<cuisine-dir>/<slug>.webp` with existence known at build time,
and the persisted snapshot storing only `recipe.id` for media. **Not reusable:**
substring name matching (recipes have no stable name→asset relation), and the
static `FRIGO_ASSETS` manifest pattern cannot scale to thousands of recipe
images bundled in the client — it would need a manifest/resolver that maps ID →
URL without shipping all URLs.

---

## 10. WEEKLY PLANNER RECIPE DEPENDENCY AUDIT (Week v1 = production; T04 = flagged off)

| Dependency | Where | If recipes move to D1… | Class |
| --- | --- | --- | --- |
| `generateWeeklyMealPlan(input, inventory, availableRecipes = ALL_RECIPES)` default parameter | `packages/domain/src/week/planner.ts:27` | default must be replaced by an injected list loaded before the call; callers in `week.ts:1022,1086` already pass `ALL_RECIPES` explicitly (client `week.ts:66` too) | NEEDS ADAPTER |
| `getSwapAlternatives(slot, inventory, ALL_RECIPES)` default | planner.ts:323; `week.ts:1143` calls **without** third arg → relies on default | inject catalog | NEEDS ADAPTER |
| `ALL_RECIPES.find(id \|\| slug)` for swap execution | `week.ts:1148` | replace with catalog lookup by id/slug | NEEDS ADAPTER |
| Fallback `availableRecipes[0]` when nothing eligible | planner.ts:152 | ordering of a D1 list is not the TS array order ⇒ nondeterministic fallback unless ORDER BY fixed | NEEDS ADAPTER (determinism rule) |
| Eligibility/`isRecipeEligible` uses `recipe.ingredients[].name`, `tags`, `cuisine` | planner.ts / score.ts | requires full legacy `Recipe` shape (not `RecipeDefinition`) | NEEDS ADAPTER (legacy-shape reader) |
| `evaluateWeeklyCandidate` uses `nutrition`, `cookTimeMinutes`, `ingredients` | week/score.ts | nutrition missing in D1 today | HIGH RISK (behavior change if nutrition absent) |
| Persisted `slot.recipe` full object in `snapshot_json` | week.ts:430-480 | old plans keep static copies; hydration fallback `ALL_RECIPES.find(recipe_id)` for legacy rows must become a D1 lookup | NEEDS SNAPSHOT MIGRATION (or explicit "snapshot is immutable" rule) |
| Client offline generation uses bundled `ALL_RECIPES` | `src/web/services/week.ts:66,159` | offline behavior diverges from server catalog unless a client cache exists | HIGH RISK (parity) |
| `home-meal.ts`, `MealDetailPage` read `slot.recipe` from snapshot | client | unaffected as long as snapshot shape is preserved | SAFE |
| Region filter `r.region === x \|\| r.region === 'toan_quoc'` in `/recipes`, `/recommendations`, client | recipes.ts, web/services/recipes.ts | D1 has no `region` column (only `tags` JSON) | NEEDS ADAPTER (schema or JSON extraction) |
| T04 `createPlanningContext` catalog ≤500 recipes, `recipeLimit` 80 | planner-context.ts, planner-policy.ts | already D1-driven; catalog growth beyond 500 throws | SAFE today / NEEDS LIMIT REVIEW at scale |
| T04 `stale_catalog` fingerprint over full catalog | meal-planning-snapshot.ts | any D1 recipe edit invalidates every stored plan's freshness (by design) | SAFE (explicit) |

---

## 11. COOKING / INVENTORY TRUTH BOUNDARY

Trace (`src/worker/routes/recipes.ts` `/recipes/:id/cook/complete`):

```
recipe (ALL_RECIPES.find)  ── only supplies: id, slug, title, cuisine, cookTime, servings, difficulty,
                              ingredient units (resolveCookingDeductionUnits) and error text
        ↓
CookingCompleteSchema (client deductions: ingredientId, name?, quantityDeducted, unit?)
        ↓
readInventoryAuthorityMode(db, householdId)
   ├─ 'native'  → completeAdoptedCooking: readAdoptedLotSnapshot → FEFO (compareFefoLots) →
   │              composeInventoryLotCommands(USE specs, clientKey `cook:<cookId>:use:<lotId>`)
   │              → db.batch([...composed.statements, households/recipes INSERT OR IGNORE, cooked_meals])
   └─ 'legacy'  → allocateCookingLots (unit-family compatible, optimistic version) →
                  runLegacyInventoryBatch(db, householdId, [households, recipes stub, cooked_meals,
                  UPDATE inventory_items … WHERE version = ?, COOK_GUARD sentinel, INSERT inventory_events])
        ↓
KV `inv_<hh>` invalidated; response returns fresh inventory
```

Confirmations (VERIFIED by reading code; tests `cooking-route-allocation`,
`command-route-integrity`, `week-core-flow` PASS):

- Recipe system **does not bypass** T09 authority: adopted households go through `composeInventoryLotCommands`; legacy households go through `runLegacyInventoryBatch` (writer fence). No direct `UPDATE inventory_items` outside the fence.
- A recipe-catalog change **cannot** create a second inventory writer: the recipe object contributes no SQL against inventory tables; deductions are client-supplied and validated against lot units.
- Units: `areUnitsCompatible`/`convertUnit` (legacy) and `toLotQuantity` (native) enforce unit families; `UNIT_MISMATCH` 422 on failure.
- Canonical ingredient IDs: `findCanonicalIngredient(name)` then `ingredientId` (`OTHER` → name match). Recipe IDs are all canonical (§15), so no `OTHER` path is exercised by recipe data today.
- Idempotency: `stableCookingCommandId(householdId, Idempotency-Key)` + `cookingRequestFingerprint` replay/409 conflict intact.
- **Side effect relevant to T14:** cooking (and shopping-list creation) performs `INSERT OR IGNORE INTO recipes (id, slug, title, cuisine, cook_time_minutes, servings, difficulty)` — a **stub row** for global `gl-*` recipes not seeded by `0006`. Any future D1-authoritative catalog must treat such rows as "referenced stubs", not catalog entries (Finding F-05). This is a recipe-table writer that lives inside inventory routes.

---

## 12. QWEN / AI RUNTIME BOUNDARY

| Question | Answer |
| --- | --- |
| Is recipe generation runtime-AI-driven? | **NO.** `recipe_generation` exists as a prompt/task ID in `packages/ai/src/prompts.ts` and `schemas.ts` but has **no** Worker or client caller. |
| Is recommendation deterministic? | **YES.** `rankRecipes` weighted score (availability 35, expiry 25, cuisine 15, time 10, quantity 10, history 5). `AIRouter.rankRecipes` (`recipe_ranking`) exists but has no HTTP caller. |
| AI touchpoints today | T04 `recipe_explanation` (orders grounded reason-code IDs; Qwen via `AIRouter`, 2.5 s timeout, 256 tokens, deterministic fallback) — production-disabled by flags. Scan pipeline (fridge/receipt vision, OCR) is unrelated to recipes. |
| Providers | Qwen (primary, `AI_QWEN_ONLY=true`), Cloudflare AI binding (legacy path for explanation when Qwen secret absent), Groq/GLM/DeepSeek fallbacks all `false` in production. |
| Tasks future recipe generation could legitimately route through existing runtime | `recipe_generation` (structured, `STATIC_RULES` forbid inventory math) and `recipe_ranking` via `AIRouter.generate({task, schema})` with the existing `model-governance`/`quality-gate`/`telemetry` layers. |
| Interfaces T14B/T14F must preserve | `AIRouter.generate` contract, task IDs above, `aiConfigFromEnv`, `logAIUsage`, the "deterministic constraints outside LLMs" rule (AGENT_RULES §12), `AI_MOCK_MODE` behavior, and the explanation transport signature. No recipe-specific provider. |

---

## 13. OFFLINE / PWA IMPACT

Current implementation = **bundled seed only**: the entire `ALL_RECIPES`
module is compiled into the SPA main chunk (`index-*.js`, 297 KB / 75 KB gzip;
recipe data ≈ 28.5 KB gzip of that) and is used (a) as offline fallback for
recommendations/recipe detail/week generation/swap and (b) **always** for
IngredientDetailPage "recipes using this ingredient", even online.

| Concern | Today (71) | 1,000 | 5,000 |
| --- | --- | --- | --- |
| Client bundle | +28 KB gzip | +≈0.4 MB gzip in main chunk on every cold start | +≈2 MB gzip — unacceptable for mobile PWA |
| SW precache | shell only; recipe data arrives with JS | same | same |
| Offline recipe availability | 100 % (static) | 100 % but heavy | infeasible as bundled |
| Offline recommendation | full `rankRecipes` client-side | OK CPU | OK CPU, data cost dominates |
| Offline week generation | full planner client-side | OK | OK CPU |
| localStorage/session cache | inventory, week plan, private-session keyed; **no** recipe cache | | |
| Mobile startup | parse 157 KB JS extra | ≈2 MB JS parse | ≈11 MB |

Recommended eventual strategy (design only): **server-only catalog with
minimal offline subset + IndexedDB page cache** — ship a small curated seed
(e.g. ≤100 "core" recipes or the user's recent/planned recipes) for offline
recommendation and week fallback, cache `/recipes` pages and viewed recipe
details in IndexedDB/Cache Storage via the SW, and keep planner/cooking offline
behavior explicitly bounded to the cached subset. Chosen because (1) offline
generation is already a fallback path with `queueWrite` replay, (2) the SW is
hand-written and can add a runtime cache route without `vite-plugin-pwa`, and
(3) Week snapshots already embed the recipes a user actually needs offline.

---

## 14. TEST COVERAGE MATRIX

Focused run in this audit: 22 files / 255 tests PASS (list in §19). Full
`vitest run` also executed (§19).

| AREA | COVERED | TEST FILES | GAP |
| --- | --- | --- | --- |
| Recipe parsing / foundation schemas | YES | `tests/integration/recipe-foundation.test.ts`, `tests/unit/domain-foundation.test.ts` | — |
| Static recipe data integrity | PARTIAL | `tests/unit/vietnamese-recipe-bank.test.ts` (≥55 VN, categories/regions, timers), `domain-foundation` (all IDs canonical) | no duplicate-ID/slug/title test, no image-existence test, global recipes barely covered |
| D1 recipe catalog reader | YES | `tests/integration/recipe-catalog.test.ts` (7), `meal-planning-snapshot.test.ts` | no test for `image_url`/`tags`/steps parity |
| Recipe requirement / unit drift | YES | `recipe-catalog.test.ts` "audits … static and D1 seed catalogs" | asserts gl-01..12 static-only — will need update when globals are seeded |
| Ranking (legacy) | YES | `tests/unit/recipe-engine.test.ts` (4) | small |
| Ranking (T03) | YES | `tests/unit/recipe-ranking.test.ts` (63), `ranking-nutrition`, `recipe-personalization` | — |
| Recommendation API HTTP | PARTIAL | `tests/unit/command-route-integrity.test.ts`, `frontend-services.test.ts` | no explicit `/recommendations` filter/ordering HTTP test found |
| Planner recipe inputs (Week v1) | YES | `tests/unit/week-planner.test.ts` (15), `integration/week-core-flow.test.ts` (3) | tests pass explicit recipe lists; default-param path lightly covered |
| Planner recipe inputs (T04) | YES | `weekly-planner.test.ts` ×2, `recipe-candidates` ×2, `planner-*` | — |
| Swap | YES | `week-core-flow`, `week-planner` | — |
| Cooking | YES | `cooking-route-allocation.test.ts`, `cooking-store.test.ts`, `command-route-integrity.test.ts` (uses `vn-kho-01`) | — |
| Offline recipe fallback | PARTIAL | `frontend-services.test.ts` (offline `getRecipeById`) | no offline week-generation test found |
| Recipe images | **NO** | — | no test asserts image URL scheme, local file existence, or duplicate assignment |
| Broken media / `onError` | **NO** | — | — |
| CSP | PARTIAL | `tests/unit/csp.test.ts` (3: api none, script-src, style-src) | no `img-src` assertion; no test that recipe image hosts are allowed |
| Meal-plan snapshot compatibility | YES | `week-route-serialization.test.ts` (6), `production-migration-bridge.test.ts`, `week-reconciliation` | no test for recipe change after snapshot |
| Migration generator side effects | RISK | `tests/unit/generate-migration.test.ts` **writes** `packages/recipes/src/vietnamese-bank.ts` and `migrations/0006_*.sql` during `pnpm test` | idempotent today; would silently rewrite a migration if data changed (F-08) |

---

## 15. CURRENT RECIPE QUALITY AUDIT (VERIFIED, script in §19)

| Check | Result | Examples |
| --- | --- | --- |
| Duplicate IDs | 0 | |
| Duplicate slugs | 0 | |
| Duplicate titles (exact, case-folded) | 0 | |
| Fuzzy duplicate dishes | **1 pair** by content (not by title heuristic): `gl-03 tomato-egg-stir-fry` "Cà chua xào trứng Trung Hoa" and `gl-12 chinese-tomato-egg` "Trứng xào cà chua kiểu Trung Hoa" — same dish, same nutrition, different ingredient lists | |
| Same image reused for unrelated dishes | **46 recipes in 20 groups** (§8.1) | canh cua đồng / canh nấm / cháo / lẩu nấm share one photo |
| Missing local assets | 1 | `gl-11 → carbonara.webp` |
| Unsupported ingredient IDs | 0 (all 385 lines resolve to the 45 canonical IDs) | |
| Duplicate ingredient lines within a recipe | 0 | |
| Non-positive / non-finite quantities | 0 | |
| Unsupported units | 0 | |
| Empty steps | 0 | |
| Duplicate step numbers | 0; non-sequential 0 | |
| Missing nutrition | 0 (all present; values are unverified estimates) | |
| Missing provenance | 71/71 in the legacy model; adapter stamps `legacy/unverified`; D1 rows `legacy/unverified` | |
| Unverified recipes used as production-trusted data | **71/71** — there is no `reviewed` recipe anywhere | |
| Cuisine/category mismatch | 12 global recipes have no `category`/`region` (filters `?category=`/`?region=` exclude them by design); `gl-12` (chinese) uses a Vietnamese asset path | |
| Ingredient ID semantic looseness | canonical IDs are reused as approximations (e.g. `SPINACH` for "rau đay & mồng tơi", `GARLIC` for "hành tím", `GROUND_PORK` for "thịt bò băm" in `gl-11`) — data quality, not schema violation | |
| Static adapter diagnostics | `adaptStaticRecipeCatalog` → 0 diagnostics for 71 recipes / 45 ingredient IDs | |

---

## 16. OBSERVABILITY, PRODUCTION BOUNDARIES, DOCUMENTATION

### 16.1 Observability (recipe/catalog/media)

Existing: structured request log (path/status/duration per request);
`meal_planning_result` (T04 status/conclusion/truncated/states);
`meal_shopping_result` (catalogStatus); AI usage logs (`logAIUsage`,
`ai_recipe_rank_failed`). **None** for: recipe lookup misses (404 path logs
only via the generic request log), recommendation counts, Week v1 planner
candidate counts, catalog source, image load failures (client-side `onError`
is silent), media fallback, catalog drift, `stale_catalog` frequency.

Minimal metrics suggested for T14B/T14C (design only): `recipe_lookup`
{source, hit}, `recommendation_result` {catalogSize, returned, noBuy},
`week_plan_result` {catalogSize, eligible, fallbackUsed}, `catalog_drift`
{staticOnly, d1Only, changed, unitDiffs} emitted by a scheduled/shadow job,
client `recipe_image_error` {recipeId, host} batched to an existing telemetry
path, and `catalog_source` on every recipe response header or log line.

### 16.2 Production boundaries T14 must preserve (observed)

| Item | Observed state |
| --- | --- |
| `CONFIG_PLUS_GRANT_SECRET_MISSING` | present as the only readiness warning (live) |
| PayOS/payment | `src/worker/routes/billing.ts`, `src/web/components/payment/*` untouched; not inspected beyond confirming isolation |
| Qwen runtime | `AI_QWEN_ONLY=true`, `qwen3.7-flash`, fallbacks disabled |
| Scan queue | `SCAN_QUEUE_MODE=async`, `frigo-scan-queue` + DLQ |
| R2 scan storage | `frigo-images`, keys `users/<uid>/scans/<scanId>/original.webp` |
| Recipe routes | anonymous GET `/recipes*` allowed by auth middleware (guest context) |
| Takosan frontend | brand assets under `/takosan/`; recipe UI uses Takosan tokens |
| Migration bridge | `0024–0033` renumbered + Wrangler-safe rewrite in `ff2da3b` |
| Branch protection | `validate` required, force-push/deletion blocked (per receipts; not re-queried) |
| Staging config | `wrangler.staging.jsonc` (added by `ff2da3b`), `AI_MOCK_MODE=true` |
| Release scripts | `scripts/deploy-check.sh`, `post-deploy-smoke.sh` (read-only), `d1-schema-gate.sh` |
| Week schema mode | `WEEK_SCHEMA_MODE=dual` |
| T04 planner | `MEAL_PLANNER_ENABLED`/`MEAL_PLANNER_AI_ENABLED`/`VITE_MEAL_PLANNER_ENABLED` unset ⇒ disabled |

### 16.3 Documentation changes made by T14A

- Added: this file `docs/ai/recipe-catalog/T14A_PRODUCTION_RECIPE_TRUTH_AUDIT.md` (new directory, mirrors `docs/ai/inventory-truth/` convention).
- Updated (docs-only, per AGENT_RULES §17): `docs/ai/CURRENT_STATE.md`, `docs/ai/TASK_BOARD.md`, `docs/ai/HANDOFF.md`, `TASK_BOARD.md` with a T14A section.

---

## 17. FINDINGS (sorted P0 → P3)

No P0 finding. No STOP condition was triggered.

| ID | Sev | Category | Status | Finding | Evidence |
| --- | --- | --- | --- | --- | --- |
| F-01 | **P1** | CSP / MEDIA | CONFIRMED | All 59 Vietnamese recipe images point to `images.unsplash.com`, which is absent from production `img-src`. Lists degrade to one shared fallback photo; detail heroes and IngredientDetail thumbnails render broken images. | §8.2 live CSP header; `vietnamese-images.ts`; consumer table §8.4 |
| F-02 | **P1** | RECIPE_AUTHORITY | CONFIRMED | Production recipe truth is the static TypeScript `ALL_RECIPES` (71). D1 `recipes` is a 59-row seed shadow + lazily inserted stubs; the D1 catalog reader is only used by the flag-disabled T04 planner. Any T14B that "switches to D1" without a legacy-shape adapter changes every recipe flow at once. | §4.3 |
| F-03 | **P1** | PLANNER / RECIPE_AUTHORITY | CONFIRMED | Week v1 snapshots embed full `Recipe` objects incl. `imageUrl`, `nutrition`, `steps`; hydration falls back to `ALL_RECIPES.find`. Moving recipes to D1 needs an explicit snapshot policy (immutable copy vs. re-resolve by ID). | §4.4, §10 |
| F-04 | **P2** | RECIPE_AUTHORITY / MIGRATION | CONFIRMED | Foundation `RecipeDefinition`/D1 catalog reader drop `imageUrl`, `nutrition`, `steps.tip/timerMinutes`, `tags`, typed `category`/`region`, required `description`. Using the foundation model as runtime truth today would lose runtime-visible data. | §5 |
| F-05 | **P2** | RECIPE_AUTHORITY / COOKING | CONFIRMED | Cooking-complete and shopping-list routes `INSERT OR IGNORE INTO recipes` 7-column stub rows for un-seeded global recipes. These are FK anchors, not catalog entries; a D1-authoritative catalog must not surface or "repair" them implicitly. | `recipes.ts:465-470,700`, `shopping.ts:155` |
| F-06 | **P2** | DATA_QUALITY / MEDIA | CONFIRMED | 46/71 recipes share an image with an unrelated dish (20 groups; 4-way collisions); `gl-11` references a missing local file (`carbonara.webp` → SPA HTML 200); `gl-12` uses a Vietnamese tofu asset for a Chinese egg dish. | §8.1, §15 |
| F-07 | **P2** | CATALOG_SCALE / OFFLINE | CONFIRMED | Full recipe catalog is compiled into the SPA main chunk and the Worker; `/recipes` and `/recommendations` are unpaginated, uncached, O(N) per request. Safe ≤100, acceptable with limits ≤1,000, architecture change ≥5,000. T04 hard-caps catalog input at 500 recipes. | §7, §13 |
| F-08 | **P2** | TEST_COVERAGE / MIGRATION | CONFIRMED | `tests/unit/generate-migration.test.ts` rewrites `vietnamese-bank.ts` and regenerates `migrations/0006_vietnamese_recipe_bank.sql` during `pnpm test`. Idempotent today (tree clean after run) but it is a latent migration-rewrite hazard for any recipe-data change and violates "never rewrite applied migrations". | test file lines 31, 135; `git status` clean after run |
| F-09 | **P2** | DATA_QUALITY | CONFIRMED | 12 global recipes are absent from D1 seed; static-vs-D1 drift audit reports `staticOnly = gl-01..gl-12` (test-asserted). D1 parity for the full catalog does not exist today. | `recipe-catalog.test.ts:286-318` PASS |
| F-10 | **P2** | DATA_QUALITY | CONFIRMED | 71/71 recipes are `legacy/unverified`; no reviewed provenance; nutrition values are unsourced estimates; `gl-03`/`gl-12` are the same dish. | §15 |
| F-11 | **P2** | PRODUCTION_DIVERGENCE | CONFIRMED / NON_BLOCKING for the gate | Compatibility Worker `64ee9ed1` (PR #4, open) was deployed before `e6b9195` and is not on `main`. Current serving SHA is `e6b9195` (= main minus docs), so `PRODUCTION_MAIN_APPLICATION_EQUIVALENCE = PASS`, but PR #4 must be merged/closed before T14B branches so its scan-confirmation bridge is not lost or duplicated. | §1.2; PR list |
| F-12 | **P3** | OBSERVABILITY | CONFIRMED | No metrics/logs for recipe lookup misses, recommendation counts, Week v1 candidate counts, catalog source, image failures or drift. | §16.1 |
| F-13 | **P3** | MEDIA | CONFIRMED | Inconsistent image fallback across consumers (dish photo / brand symbol / none); `RecipeDetailPage` and `MealDetailPage` heroes have no `onError`. | §8.4 |
| F-14 | **P3** | TEST_COVERAGE | CONFIRMED | No tests for image URL scheme/existence, `img-src` CSP allowance, offline week generation, or recipe-change-after-snapshot behavior. | §14 |
| F-15 | **P3** | DOCUMENTATION | HISTORICAL | Multiple docs still contain "main unchanged at d1b0673" / freeze-era "current authoritative" sections; they are superseded by the rollout receipt. `docs/ai/RECIPE_ENGINE.md` correctly states the catalog abstraction does not replace `ALL_RECIPES`. | §2 |
| F-16 | **P3** | MEDIA | CONFIRMED | Five local VN recipe assets (`canh-chua-ca.webp`, `com-chien-trung.webp`, `ga-kho-gung.webp`, `rau-muong-xao-toi.webp`, `thit-kho-trung.webp`) exist but are unused by any VN recipe (only as RecipeCard fallback); `scripts/generate-recipe-images.ts` prompt catalog is unwired. | §8.1 |

### BLOCKERS for T14B (must be resolved or explicitly designed around)

- F-11: PR #4 disposition (merge or close) before T14B branch creation.
- F-04 + F-03: adapter and snapshot policy design are prerequisites for any authority switch.
- F-08: the generator-test must be neutralized (moved to an explicit script or made read-only) **before** any recipe data edit, otherwise `pnpm test` would rewrite an applied migration.

### NON-BLOCKING DEBT

F-06, F-07 (until catalog grows), F-09, F-10, F-12, F-13, F-14, F-15, F-16.
F-01 is user-visible today but is **not** a T14B blocker; it is a candidate
for an independent, small CSP/asset decision (self-host the 59 images or allow
the host) that T14B should sequence explicitly rather than fold in silently.

---

## 18. T14B RECOMMENDATION

### 18.1 Chosen strategy: **Strategy A — Static runtime remains authority; D1 becomes shadow catalog.**

Why not the others (evidence-based):

- **B** ("D1 already has sufficient parity") is false: D1 lacks 12 global recipes, nutrition, typed category/region, and image/steps are outside the catalog contract (F-04, F-09).
- **C** ("runtime already D1-backed") is false: every production-enabled flow is static (F-02).
- **D** is unnecessary: A describes the current architecture exactly — static authority with a read-only D1 reader and drift audit already present (§6).

### 18.2 Strategy A design envelope (for T14B — not implemented here)

**Prerequisites**

1. PR #4 merged/closed; T14B branches from post-decision `origin/main`.
2. `tests/unit/generate-migration.test.ts` converted to a non-mutating check or an explicit `scripts/` generator that is never run by `pnpm test` (F-08).
3. Decide and document (ADR in `docs/ai/DECISIONS.md`) the **legacy-shape catalog contract**: a `RuntimeRecipe` view = legacy `Recipe` (with `imageUrl`, `nutrition`, `steps`, `tags`, `category`, `region`) so no runtime data is lost; foundation `RecipeDefinition` remains the validation/planning contract.
4. Decide media policy separately (self-hosted `/frigo/recipes/<slug>.webp` derived by ID, or CSP allow-list). T14B should **not** treat `imageUrl` strings as domain truth (AC 18).

**Migration order (additive only; next number `0034`)**

1. `0034`: seed the 12 global recipes (+ their `recipe_ingredients`/`recipe_steps`) into D1 so static/D1 recipe-ID parity becomes total; optionally add explicit `category`/`region` columns **or** a documented `tags`→classification mapping — do not delete `tags`.
2. Later (T14C+): `recipe_nutrition` rows for the 71 recipes with `source_type='estimated'` provenance, `recipe_media` only after the media ADR.
3. Never rewrite `0006`.

**Compatibility rules**

- `ALL_RECIPES` remains the only runtime authority for all §4.3 flows during T14B.
- A shadow reader (`readRecipeCatalog` + a new legacy-shape D1 reader) runs **beside** the static path and emits `catalog_drift` metrics; it must never influence responses.
- Week v1 snapshots stay immutable copies; hydration fallback keeps using the static list until a later task defines re-resolution.
- No new inventory writer; cooking/shopping stub inserts remain unchanged.
- `MEAL_PLANNER_ENABLED` stays unset in production.

**Rollback boundary**

- All T14B changes must be revertible by (a) reverting the Worker deploy and (b) leaving `0034` in place (additive seed rows are harmless to the static path). No down-migration.

**Acceptance criteria** — see §18.3.

**Production canary**

- Stage 1: deploy with shadow reader **disabled** by flag (`RECIPE_CATALOG_SHADOW=false`), verify `PRODUCTION_MAIN_APPLICATION_EQUIVALENCE` gate and readiness.
- Stage 2: enable shadow read on a sampled percentage of `/recipes` requests (env var), observe `catalog_drift` = 0 changed/0 unit diffs and latency delta; responses still static.
- Stage 3 (T14C decision, not T14B): only after N days of zero drift, design the authority switch behind its own flag with per-flow rollout (start with `GET /recipes` list, end with cooking).

### 18.3 Draft T14B acceptance criteria (design gates, not claimed to pass)

1. **No production-main divergence**: `git diff --stat <deployed-sha> origin/main -- <application paths>` empty before branching; PR #4 resolved.
2. **Stable recipe identity**: all 71 IDs/slugs unchanged; D1 `recipes.id` = static `id` for every recipe; drift `recipeIds.staticOnly = d1Only = changed = []`.
3. **Static/D1 recipe parity**: title, description, cuisine, servings, cookTime, difficulty identical for all 71 (extend `auditRecipeCatalogs` or add a legacy-shape audit).
4. **Ingredient requirement parity**: `requirements = []` in drift audit for all 71.
5. **Unit parity**: `units.staticOnly = d1Only = requirementDifferences = []`.
6. **Recommendation parity**: `/recommendations` response bytes/order identical before and after deploy for fixed fixture inventories (shadow compare).
7. **Planner candidate parity**: Week v1 `generateWeeklyMealPlan` output identical for fixed inputs (static list unchanged); T04 snapshot fingerprint documented as changing only when `0034` seeds rows.
8. **Swap parity**: alternatives list identical for fixed slot/inventory.
9. **Cooking deduction parity**: `cooking-route-allocation`, `command-route-integrity`, adopted/legacy cooking tests unchanged and passing; no new SQL against `inventory_*`/`lot*` tables.
10. **Offline behavior explicitly defined**: ADR states that offline continues to use the bundled static catalog in T14B.
11. **No second inventory writer**: grep/AST gate — recipe/catalog modules import nothing from `inventory-writer-fence`/`inventory-lot-commands` except the existing cooking route.
12. **No Qwen runtime regression**: `packages/ai` untouched; scan integration tests pass.
13. **No scan/queue regression**: scan route/queue tests pass; `wrangler.jsonc` queue/R2 bindings unchanged.
14. **Migration backward compatibility**: `pnpm check:migrations` passes with `0034`; `0001–0033` byte-identical; `schema:check:remote` extended read-only.
15. **Deterministic rollback**: documented single-step Worker rollback; `0034` proven harmless to previous Worker (`e6b9195`) via local replay + old-code test run.
16. **Observability**: `catalog_drift` and `recipe_lookup` events emitted (shadow only) with zero PII.
17. **Performance at target size**: shadow read adds ≤ X ms p95 at 71 recipes (X set in T14B); load test at 500 seeded recipes on staging documents `/recipes` and T04 snapshot latency.
18. **No recipe image URL treated as domain truth**: no new code path persists or compares `imageUrl`; media resolution is by recipe ID.

---

## 19. VERIFICATION EVIDENCE (exact commands, fresh results)

Environment: Node `v24.19.0`, pnpm `10.26.0`, sqlite3 `3.45.1` (installed in
sandbox via apt for `check:migrations`), `pnpm install --frozen-lockfile` →
`Done in 16.5s`, exit 0.

```
git status --short                      → " M .hoplite/settings.json" (sandbox-only, untracked change, not committed)
git rev-parse HEAD                      → 345cecf388321a00c96be387744a10e8c98bd9ac
git fetch origin main; git rev-parse origin/main → 345cecf388321a00c96be387744a10e8c98bd9ac
git checkout -b audit/t14a-production-recipe-truth origin/main
git log --oneline --decorate --graph -40 origin/main   (graph in §2)
git diff --check                        → clean
git diff --name-status e6b9195 origin/main             → 7 docs paths (§1.2)
git diff --stat e6b9195 origin/main -- src packages migrations package.json pnpm-lock.yaml wrangler.jsonc wrangler.staging.jsonc wrangler.staging.jsonc.example scripts tests public index.html vite.config.ts tsconfig.json tsconfig.worker.json eslint.config.js tailwind.config.js postcss.config.js playwright.config.ts .dev.vars.example → (empty)
git merge-base --is-ancestor e6b9195 origin/main       → yes
curl -s https://api.github.com/repos/vn-dlo/Frigo-dev | jq '.id,.default_branch' → 1368281478 "main"

pnpm typecheck                          → EXIT=0
pnpm lint                               → EXIT=0
pnpm check:migrations                   → migration-smoke=ok, EXIT=0
GIT_COMMIT=$(git rev-parse HEAD) pnpm build → ✓ built in 12.10s, EXIT=0 (dist/ removed afterwards; ignored by git)
sqlite3 /tmp/t14a-local.sqlite  (.bail on; PRAGMA foreign_keys=ON; .read migrations/0001..0033) → REPLAY OK; counts in §3

npx vitest run <22 recipe/catalog/planner/cooking/csp/week files>
  → Test Files 22 passed (22), Tests 255 passed (255), Duration 34.88s
    files: unit/recipe-engine, vietnamese-recipe-bank, recipe-candidates, recipe-ranking, recipe-families,
           cooking-route-allocation, cooking-store, csp, week-planner, weekly-planner, planner-inventory,
           frontend-services, week-route-serialization; integration/recipe-catalog, recipe-candidates,
           recipe-foundation, recipe-personalization, meal-planning-snapshot, weekly-planner,
           week-core-flow, production-migration-bridge, ranking-nutrition
npx vitest run tests/unit/generate-migration.test.ts (isolated) → 2 passed; git status afterwards unchanged
npx vitest run (full suite)             → Test Files 149 passed (149), Tests 3630 passed (3630), EXIT=0
                                          (git status unchanged afterwards; generator test idempotent)

Static audit script (outside repo, /tmp/t14a/audit-entry.ts bundled with esbuild 0.25.12 using the repo's
@frigo/* aliases; read-only import of packages/recipes + packages/domain) → JSON in §4.1/§8.1/§15.

Read-only production checks (anonymous GETs only):
  bash scripts/post-deploy-smoke.sh https://frigo.tungjpstore.net → "Smoke passed"
  GET /api/v1/health/ready → commit e6b91956484589c088e6d04a9835b3e59a2eb786, status degraded (PLUS-grant warning only)
  GET /api/v1/recipes → 200, 131,698 bytes, 71 recipes (59 vn / 12 global), 59 external + 12 local imageUrl
  HEAD / → content-security-policy img-src 'self' data: blob: https://lh3.googleusercontent.com
  GET /frigo/recipes/vietnam/thit-kho-trung.webp → 200 image/webp
  GET /frigo/recipes/global/carbonara.webp → 200 text/html (missing asset, SPA fallback)
NOT run: pnpm schema:check:remote (needs Cloudflare credentials; not required — rollout receipt records PASS),
         any authenticated request, any wrangler d1 execute, any deploy.
```

---

## 20. SAFETY CONFIRMATION

| Item | Answer |
| --- | --- |
| application code changed | **NO** |
| migrations changed | **NO** (`migrations/` untouched; `0034` not created) |
| tests changed | **NO** |
| dependencies / config changed | **NO** (`.hoplite/settings.json` sandbox preview file is uncommitted tooling state) |
| production D1 writes | **NO** |
| R2 writes | **NO** |
| KV writes | **NO** |
| queue writes | **NO** |
| deployment | **NO** |
| PayOS / payment changes | **NO** |
| DNS changes | **NO** |
| secrets changed | **NO** |
| branch protection changed | **NO** |
| main merged / force-push / history rewrite | **NO** |
