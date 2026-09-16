# T14D — Recipe Catalog Authority Cutover Architecture (design, audit, evidence)

```text
repository_id=1368281478   repo=frigo-1/Frigo-dev
START_MAIN=d0856b48e043c72d1793002e7c6047a186ac890d
branch=feat/t14d-recipe-authority-cutover
migration=NONE (repo tip stays 0035_recipe_media_layer.sql; no 0036)
production: application 4ed98514…, D1 tip 0034, RECIPE_CATALOG_MODE unset (= static) — NOT touched by T14D
STATUS=T14D_DEVELOPMENT_COMPLETE / PRODUCTION_ROLLOUT_DEFERRED
```

T14D makes the static → D1 recipe-content authority flip **safe, observable and reversible by configuration**.
It does not flip production. Media (T14C), Inventory Truth (T09/T11), AI, PayOS are untouched.

## 1. Runtime reader audit

Every reference to `ALL_RECIPES | SEED_RECIPES | VIETNAMESE_RECIPES | GLOBAL_RECIPES` in non-test code, classified:

| File | Classification | Action |
| --- | --- | --- |
| `src/worker/routes/recipes.ts` (list, detail, recommendations, cook start, cook complete) | RUNTIME_AUTHORITY_READ ×6 | migrated → `recipeAuthority(c).snapshot` |
| `src/worker/routes/week.ts` (create, regenerate, swap alternatives, executed swap, legacy slot rehydration) | RUNTIME_AUTHORITY_READ ×5 | migrated → `weekRecipeAuthority(c)` threaded through `getMealPlan` |
| `src/worker/routes/shopping.ts` (source-recipe attribution) | RUNTIME_AUTHORITY_READ ×1 | migrated → snapshot lookup |
| `packages/domain/src/week/planner.ts` (`= ALL_RECIPES` defaults) | RUNTIME_AUTHORITY_READ (hidden default) ×2 | default removed; callers must pass the snapshot list |
| `packages/recipes/src/runtime-catalog.ts`, `recipe-authority.ts` | STATIC_DEFINITION / provider | approved |
| `packages/recipes/src/data.ts`, `vietnamese-bank.ts` | STATIC_DEFINITION | approved |
| `packages/recipes/src/seed-render.ts`, `recipe-media.ts`, `scripts/render-recipe-seed.mjs` | SEED_RENDERER / MIGRATION_GENERATOR | approved |
| `src/worker/services/recipe-catalog-shadow.ts` | PARITY_ORACLE | approved |
| `src/web/services/recipes.ts`, `src/web/services/week.ts`, `src/web/pages/IngredientDetailPage.tsx` | offline browser fallback (client bundle has no D1; used only when the API is unreachable) | approved, documented |
| `migrations/0034`, `0035`, docs | MIGRATION_GENERATOR output / DOCS | n/a |
| `tests/**` | TEST_FIXTURE / PARITY_ORACLE | n/a |

```text
runtime_recipe_readers_before=14   (6 recipes.ts + 5 week.ts + 1 shopping.ts + 2 planner defaults)
runtime_recipe_readers_migrated=14
runtime_recipe_readers_remaining=0
unknown_runtime_readers=0
approved_direct_ALL_RECIPES_uses=10 files (allowlist in tests/unit/recipe-catalog-authority.test.ts)
```

Guard: `tests/unit/recipe-catalog-authority.test.ts` walks `src/` and `packages/` and fails on any static-collection
import outside the allowlist, on any `ALL_RECIPES` mention in the four migrated files, on a restored planner default,
on any file other than the router/shadow service importing the hydrator, and on any user-controlled mode parameter.

## 2. Authority model

```text
Request (auth.householdId)
   ↓
resolveRecipeAuthority(env, { tenantKey, backgroundExecutor })      src/worker/services/recipe-authority.ts
   ↓  RECIPE_CATALOG_MODE + RECIPE_CATALOG_D1_CANARY_PERCENT + RECIPE_CATALOG_CUTOVER_ENABLED
   ├── static  → StaticRecipeAuthority (ALL_RECIPES, exact order)              actualSource=static
   ├── shadow  → static + T14B-B off-response compare (unchanged, throttled)    actualSource=static
   ├── canary  → household bucket < percent ? verified D1 : static             actualSource=d1|static
   └── d1      → verified D1                                                    actualSource=d1|static(emergency)
   ↓
RecipeAuthoritySnapshot { source, fingerprint, loadedAt, size, list(), findById(), findByIdOrSlug() }
   ↓  ONE snapshot per request/operation, passed down
recipes list/detail · rankRecipes · cook start/complete · generateWeeklyMealPlan · getSwapAlternatives/swapMealInPlan · shopping attribution
   ↓
enrichRecipesWithMedia (T14C, unchanged)
```

`packages/recipes/src/recipe-authority.ts` (pure): snapshot, static provider, D1 provider, fingerprint, readiness,
canary hashing. `src/worker/services/recipe-authority.ts`: config parsing/fence, per-isolate cache, routing,
diagnostics. The D1 provider **reuses** T14B-B `readRecipeContent` (5-statement batch) + `hydrateRuntimeRecipes`; there
is no second hydrator.

## 3. Mode semantics and config

| Var | Values | Default | Notes |
| --- | --- | --- | --- |
| `RECIPE_CATALOG_MODE` | `static` \| `shadow` \| `canary` \| `d1` | `static` | exact match; `D1`, `dl`, `d1-prod` → `INVALID_MODE` (never coerced to static) |
| `RECIPE_CATALOG_D1_CANARY_PERCENT` | integer `0..100` | `0` | `5.5`, `05`, `101`, `1e1` → `INVALID_CANARY_PERCENT` |
| `RECIPE_CATALOG_CUTOVER_ENABLED` | exactly `true` | unset | required for `canary` and `d1`; not for `shadow` |

Production validation (`validateEnvironment`): invalid mode/percent or unfenced canary/d1 ⇒ fatal
`CONFIG_RECIPE_CATALOG_MODE` (readiness fails, deploy smoke refuses); fenced canary/d1 ⇒ warning
`CONFIG_RECIPE_CATALOG_D1_AUTHORITY` so the enabled authority is visible in `/health/ready`. At request time an invalid
config still serves static with an error-level `recipe_catalog_config_invalid` diagnostic — loud, never a 500, never
silently static. Authority mode is never readable from query/header/body.

## 4. D1 readiness and fingerprint

`fingerprintRecipes(list) = SHA-256(stableJson(list.map(project)))` where `project` keeps exactly
`RUNTIME_RECIPE_FIELDS` (id, slug, title, description, cuisine, category, region, cookTimeMinutes, servings,
difficulty, imageUrl, nutrition, ingredients (ordered), steps (ordered), tags) with sorted object keys; array order is
significant. Stray properties (row ids, timestamps, media presentation) are **rejected** by the strict schema rather
than hashed. `recipe_media`, R2 URLs and media readiness are never part of it.

`assessD1Readiness(baseline, hydration)` (in order): hydration failures ⇒ `CATALOG_DIAGNOSTICS`; length ⇒ `COUNT_DRIFT`;
ID sets ⇒ `ID_DRIFT`; positions ⇒ `ORDER_DRIFT`; hash ⇒ `FINGERPRINT_DRIFT` (with a ≤5 per-recipe field-drift sample);
otherwise `ready` with the shared fingerprint. Read exceptions ⇒ `D1_READ_FAILED`. A D1 snapshot is only ever
constructed from a `ready` assessment, so holding one is proof of parity at load time. Expected count/fingerprint derive
from `ALL_RECIPES` (71 today) — nothing hardcodes 71; intentional growth (T14E) is a later policy change.

## 5. Canary

Key = `auth.householdId`. `bucket = FNV-1a32("recipe-catalog-canary:" + householdId) % 10000`; in canary iff
`bucket < percent × 100`. Deterministic, dependency-free, monotonic in percent (widening never flips a household out).
No `Math.random`, `Date.now` or request ids. Tests: known FNV vectors, repeat stability, 0%/100%, monotonicity over 200
households, ±1.5-point distribution over 20,000 synthetic ids. Diagnostics carry `canary: true|false`, never the id.

## 6. Cache, fallback and failure policy

Per-isolate: one verified D1 snapshot, `RECIPE_AUTHORITY_D1_TTL_MS = 30 s`, singleflight refresh (10 concurrent
first requests ⇒ 1 batch). After TTL, if a refresh fails/loses parity, a previously verified snapshot may still serve up
to `RECIPE_AUTHORITY_D1_STALE_GRACE_MS = 5 min` (`recipe_catalog_d1_stale_served`, warn); beyond that the cache is
dropped. No timers, no background loop, no KV.

| Situation | canary | d1 |
| --- | --- | --- |
| verified fresh/cached | serve D1 | serve D1 |
| verified stale (≤5 min) | serve D1 + warn | serve D1 + warn |
| not ready / read failed | **static** + `recipe_catalog_canary_fallback` (warn) | **static** + `recipe_catalog_d1_fallback` (**error**) — emergency policy, availability over purity |

`selectedSource` vs `actualSource` always distinguish "intended D1" from "served static"; static is never labelled D1.

## 7. Observability

Events: `recipe_catalog_authority_selected` (info, D1 served), `recipe_catalog_d1_not_ready`,
`recipe_catalog_d1_stale_served`, `recipe_catalog_canary_fallback` (warn), `recipe_catalog_d1_fallback`,
`recipe_catalog_config_invalid` (error). Fields: `configuredMode, selectedSource, actualSource, canary, reasonCode,
fingerprintMatch, staleAgeMs, recipeCount` — never recipes, tenant ids or inventory. Per-isolate counters
(`recipeAuthorityCounters()`): static, d1, canaryFallback, d1Fallback, staleServed, notReady. No public header.

## 8. Rollback (config-only)

`RECIPE_CATALOG_MODE=static` (or unset). Read routing only: no migration, no data deletion, no Git revert. Tested:
after serving D1, static mode issues zero D1 statements and `recipes`/`recipe_runtime_fields` are unchanged.

## 9. Performance

One D1 authority hydration = **1 batch of 5 statements** for any catalog size (T14B-B reader). One snapshot per
operation: `/recommendations` in d1 mode reads the catalog once; a following `/week/plans` within the TTL reads zero
times. Lookups are `Map`-indexed by id and slug (5,000-recipe snapshot tested). No per-recipe queries anywhere.

## 10. Inventory Truth boundary

Cook complete resolves ingredients/units from the snapshot, then hands the unchanged deduction plan to the existing
legacy/adopted inventory paths. Parity test proves identical deductions, event counts, stock deltas, `cooked_meals`
rows and idempotent replay for static vs d1; `recipes`/`recipe_runtime_fields` row counts are unchanged. New inventory
writers = 0; new canonical readers = 0; T09/T11 files untouched.

## 11. Verification (this branch)

Focused: `tests/unit/recipe-authority.test.ts` (17), `tests/unit/recipe-catalog-authority.test.ts` (6),
`tests/integration/recipe-authority-routing.test.ts` (7) — static vs d1 vs canary strict parity for list/filters/
search/detail, recommendations (ids/scores/%/order = `rankRecipes(ALL_RECIPES)`), media enrichment, cook start/complete
+ idempotency, week create/regenerate/swap alternatives (first five, order-sensitive)/executed swap/shopping attribution,
canary+d1 failure ⇒ static 200, outside-canary ⇒ zero D1 content reads, one snapshot per operation. Existing T14B-B
parity (11), T14C media (72), week flows, planner, config validation all green. Gates: `recipe:seed:check`,
`typecheck`, `lint`, `check:migrations`, `build`, full `pnpm test`, `git diff --check` — totals in the PR body.

## 12. Production-deferred state and future OPS sequence

```text
production application=4ed98514…   production D1 tip=0034   repo tip=0035   T14C 0035 rollout=PENDING
T14D code=NOT deployed             production recipe authority=static
```

Codex OPS sequence (human-controlled at every step; no timers):
1. authenticate Cloudflare → 2. verify D1 tip 0034 → 3. backup → 4. apply 0035 → 5. verify `recipe_media` 71 pending /
0 ready → 6. deploy final certified main with `RECIPE_CATALOG_MODE` unset (static) → 7. smoke → 8. optionally
`RECIPE_CATALOG_MODE=shadow`, observe `recipe_catalog_shadow` parity → 9. `RECIPE_CATALOG_CUTOVER_ENABLED=true`,
`RECIPE_CATALOG_MODE=canary`, `RECIPE_CATALOG_D1_CANARY_PERCENT=1..5`, observe `recipe_catalog_*` events/counters →
10. widen deliberately → 11. `RECIPE_CATALOG_MODE=d1` only after explicit operator approval. Each step is a config
rollout, not a build; rollback at any step = `RECIPE_CATALOG_MODE=static`.

Known OPS follow-ups retained (not T14D): `KNOWN_OPS_P2_STAGING_SHA_PROPAGATION_RACE`, Wrangler 4 upgrade,
`CONFIG_PLUS_GRANT_SECRET_MISSING`.
