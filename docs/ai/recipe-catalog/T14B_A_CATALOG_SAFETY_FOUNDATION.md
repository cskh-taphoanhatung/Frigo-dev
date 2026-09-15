# T14B-A — Recipe Catalog Safety Foundation (2026-09-15)

Follows `T14A_PRODUCTION_RECIPE_TRUTH_AUDIT.md`. T14B-A adds a small, tested safety
layer so recipe-catalog migration can proceed later **without** changing recipe
runtime authority, production behavior, recipe data, D1 schema or Inventory Truth.

```
PRODUCTION RUNTIME ──▶ ALL_RECIPES (71)      unchanged, still the ONLY authority
D1 / catalog infra ──▶ can classify complete entries, exclude FK stubs, audit drift
NO authority switch · NO migration · NO production behavior change
pnpm test = READ-ONLY · applied migrations = IMMUTABLE
```

## 1. Precondition gate (verified)

| Item | Value |
| --- | --- |
| Repository | `vn-dlo/Frigo-dev`, ID `1368281478`, default `main` |
| `origin/main` at start | `345cecf388321a00c96be387744a10e8c98bd9ac` (unchanged since T14A) |
| T14A PR #7 | **OPEN, draft**, head `769e0532…`, `validate` SUCCESS, not merged. Its tree = `main` + 5 docs paths (application diff vs `main`: empty). |
| PR #4 `release/pre0032-schema-compat` (`64ee9ed1`) | **OPEN**, base `d3d50cc`, no hosted checks. Historical rollout compatibility bridge; **not** used as a base. Recommendation: close/archive (production already at `0033` on `e6b9195`). Not acted on. |
| Deployed production Worker | `e6b91956484589c088e6d04a9835b3e59a2eb786`; application-path diff vs `main`: empty ⇒ equivalence PASS |
| `T14B_A_START_SHA` | `769e0532fadc95018bc1aedc01a36b396b91a974` (= `main` `345cecf` + T14A docs; application tree identical to `main` and to production) |
| Branch | `hoplite/koroneia-838b0ccc--t14b-a-catalog-safety` (stacked on PR #7; local alias `feat/t14b-a-recipe-catalog-safety-foundation`) |

Because PR #7 is docs-only and its application tree equals `main`, stacking T14B-A on
it is equivalent to branching from current `main` for every application path, while
keeping the audit report available to readers of this document.

## 2. T14A findings re-verified before changes

| Finding | Reproduces? | Evidence |
| --- | --- | --- |
| F-02 static `ALL_RECIPES` is production authority | YES | `rg ALL_RECIPES src` → `routes/recipes.ts` (list/detail/recommendations/cook start/cook complete), `routes/week.ts` (generate/regenerate/swap/hydration fallback), `routes/shopping.ts`, `web/services/{recipes,week}.ts`, `web/pages/IngredientDetailPage.tsx`; `readRecipeCatalog` only reached via `loadMealPlanningSnapshot` (T04, flag off) |
| F-04 `RecipeDefinition` lossy vs runtime `Recipe` | YES | `RecipeDefinitionSchema` lacks `category`, `region`, `imageUrl`, `nutrition`, `steps`, `tags`; now test-asserted (`RUNTIME_ONLY_FIELDS`) |
| F-05 cooking/shopping insert FK anchor rows | YES | `INSERT OR IGNORE INTO recipes (id, slug, title, cuisine, cook_time_minutes, servings, difficulty)` at `routes/recipes.ts:465,700`, `routes/shopping.ts:155` |
| F-08 generator test writes tracked files | YES | `tests/unit/generate-migration.test.ts` `fs.writeFileSync` on `packages/recipes/src/vietnamese-bank.ts` (line 31) and `migrations/0006_vietnamese_recipe_bank.sql` (line 135) |
| F-09 12 global recipes absent from D1 | YES | local 33-migration replay: `recipes` = 59, all `vietnamese`; drift report `identity.staticOnly = gl-01..gl-12` |

## 3. Recipe contracts

```
RecipeDefinition (packages/recipes/src/foundation.ts)
  normalized catalog/planning contract: id, slug, title, description?, cuisine, servings,
  prepTimeMinutes?, cookTimeMinutes, difficulty, familyId?, provenance, ingredients[]
  → validation, identities, requirements, provenance, T04 planning. NOT a runtime DTO.

RuntimeRecipe (packages/recipes/src/runtime-recipe.ts)  == legacy `Recipe` (types.ts)
  complete production shape: + category?, region?, imageUrl, nutrition?, steps[] (tip, timerMinutes), tags[]
  → what /recipes, recommendations, Week v1, cooking, offline client consume today.
  RUNTIME_ONLY_FIELDS = category, region, imageUrl, nutrition, steps, tags (not in RecipeDefinition).
  toRuntimeRecipe(recipe) is a strict validation, proven lossless for all 71 static recipes.

D1 raw row (recipes + recipe_ingredients + recipe_steps + recipe_nutrition)
  may be: complete catalog entry | FK stub | rejected
  read-only projection: packages/db/src/recipe-content.ts (readRecipeContent, 4 SELECTs)

Complete catalog entry  = classifyCatalogEntry(...).state === 'complete'
  foundation-valid AND has description AND (when steps are loaded) ≥1 step.
FK stub row             = state 'incomplete', fkStub=true
  exactly the 7-column INSERT OR IGNORE shape: no ingredients, no description, no other
  content, default provenance (legacy/unverified/v1). Never a catalog entry. Never repaired.
Rejected                = has content but violates RecipeDefinitionSchema (reasons = invalid:<path>).
```

**Media decision:** `image_url` is **not** a completeness criterion. Recipe media
architecture is deferred to T14C (`MEDIA_DEFERRED_TO_T14C=true`); the runtime contract
keeps `imageUrl: string` for compatibility and the drift audit *reports* media drift
without judging validity.

## 4. Authority

```
STATIC ALL_RECIPES  = runtime authority (all production-enabled flows, unchanged)
D1 recipes tables   = shadow data only (T04 planner reader when flag-enabled; drift audit)
```

Verified after implementation (`rg` over `src/`): no production route imports
`recipe-content`, `catalog-drift`, `catalog-entry` or `runtime-recipe`; `readRecipeCatalog`
callers unchanged (`meal-planning-snapshot.ts` only). `src/worker/routes/*`, cooking
mutation code and `wrangler.jsonc` are untouched.

## 5. F-08 remediation

| | Before | After |
| --- | --- | --- |
| Behavior | `tests/unit/generate-migration.test.ts` rewrote `vietnamese-bank.ts` and regenerated `migrations/0006` on every `pnpm test` | Test deleted. `renderVietnameseRecipeSeedSql()` (pure, no `fs`) renders the seed in memory; `tests/unit/recipe-seed-readonly.test.ts` asserts byte-equality with committed `0006`, asserts bank image references, snapshots migration/bank hashes+mtimes before/after, and scans `tests/` for repo-relative `writeFile` calls |
| Explicit generator | none | `pnpm recipe:seed:check` (read-only compare; exits 1 if stale with instruction to ship a NEW migration) and `pnpm recipe:seed:render` (writes only to `.artifacts/recipe-seed/`, refuses any path under `migrations/` or `packages/`) |
| Invocation from tests/CI | implicit | never; CI workflow unchanged |

## 6. Drift framework — actual current output

`auditCatalogDrift(ALL_RECIPES, readRecipeContent(db))` over the full 0001–0033 ledger:

```
staticCount 71 · d1RowCount 59 · d1CompleteCount 59
identity.staticOnly  = gl-01 … gl-12 (12)      identity.d1Only = []      slugMismatch = []
core.changed = []   requirements.changed = []   units.changed = []
content.steps.changed = []          content.tags.changed = []
content.media  = { missingInD1: [], changed: [] }   (59 Unsplash URLs match static)
content.nutrition = { representation: 'unsupported_by_catalog_model', missingInD1: 59 ids }
content.classification = 118 entries, all 'represented_through_legacy_tags' (cat:/region: markers)
incompleteRows = []   rejectedRows = []
```

With a simulated cooking FK stub for `gl-01`: `d1RowCount 60`, `d1CompleteCount 59`,
`incompleteRows = [{ id: 'gl-01', state: 'incomplete', fkStub: true, reasons: [fk_anchor_shape, no_description, no_requirements] }]`,
`identity.staticOnly` still lists `gl-01`; the existing foundation reader also excludes
the stub (`invalid_recipe` diagnostic). No D1 write occurs. This truthful drift is the
input T14B-B must close; it was **not** weakened to pass.

## 7. Future lifecycle

```
T14B-A  contract + completeness + drift safety            (this task)
T14B-B  migration 0034 (if still unused) + 71/71 D1 parity + lossless D1 runtime-view reader
T14B-C  sampled shadow reads + telemetry (no authority switch)
T14C    recipe media (CSP/self-hosting/resolver; F-01, F-06, F-13, F-16)
future  per-flow authority migration behind flags with per-flow rollback
```

### T14B-B handoff
- Branch from the accepted T14B-A baseline (after PR review/merge).
- Verify `ls migrations | tail -1` = `0033_*` and create `0034` additively: seed `gl-01..gl-12`
  (+ `recipe_ingredients`, `recipe_steps`); do not touch `0006`. Then `pnpm recipe:seed:check`
  stays green (it validates 0006 only) and `identity.staticOnly` must become `[]`.
- Add a lossless D1 `RuntimeRecipe` reader (source `RUNTIME_ONLY_FIELDS` from `image_url`,
  `tags` (strip `cat:`/`region:` into `category`/`region`), `recipe_steps`; nutrition needs an
  explicit decision — `recipe_nutrition` is empty and the runtime `nutrition` block is unsourced).
- Keep `ALL_RECIPES` as authority; no shadow HTTP reads unless explicitly approved.
- Acceptance: `auditCatalogDrift` shows `staticOnly = d1Only = []`, `core/requirements/units/steps/tags/media.changed = []`,
  `incompleteRows = rejectedRows = []`; runtime view of every D1 row `toEqual` the static recipe.

## 8. Verification (fresh, this branch)

```
pnpm install --frozen-lockfile        exit 0 (T14A sandbox, unchanged lockfile)
pnpm typecheck                        exit 0
pnpm lint                             exit 0
pnpm check:migrations                 migration-smoke=ok
pnpm build                            ✓ built, exit 0
npx vitest run (full)                 Test Files 151 passed (151) · Tests 3644 passed (3644)
npx vitest run <3 new suites>         3 files / 16 tests passed
pnpm recipe:seed:check                recipe-seed-check=ok (59 recipes match 0006_vietnamese_recipe_bank.sql)
node scripts/render-recipe-seed.mjs --out migrations/evil.sql   refused, exit 3
sha256sum migrations/*.sql (before vs after every gate)          identical, 33 files, last 0033, no 0034
git status after full vitest          only intentional docs edits; no migration/recipe source change
git diff --check                      clean
```

## 9. Safety confirmation

production deployment NO · main merge NO · migration creation NO · existing migration
modification NO (per-file SHA-256 of `migrations/*.sql` identical before/after; 33 files;
`0034` absent) · production D1/R2/KV/queue write NO · recipe authority switch NO ·
media/CSP change NO · Qwen behavior change NO · inventory behavior change NO ·
payment/PayOS change NO · DNS/secret change NO.
