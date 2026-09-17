# T14E — Bulk Recipe Import Factory + Catalog Release Manifest (ADR-027)

```text
STATUS=T14E_DEVELOPMENT_COMPLETE · REAL_CATALOG_GROWTH_NOT_STARTED · PRODUCTION_ROLLOUT_DEFERRED
base=9ff571995bf5f2a4381c2dfc6de796e6554fd43c   (canonical main at start)
migrations=35, highest=0035_recipe_media_layer.sql, 0036=absent   (unchanged by T14E)
ALL_RECIPES=71 (unchanged) · current release manifest=71 recipes / 0 approved batches
```

T14E builds the machine that makes adding hundreds/thousands of recipes safe. It adds **no** real recipe, **no**
migration, **no** production action. T14F will use it.

## 1. Pipeline

```text
authorized raw batch (.json | .jsonl)
  → parse         packages/recipes/src/import/parse.ts       UTF-8 (fatal), JSON, non-object rows, duplicate keys, 64 KiB/record, 10,000 records
  → schema        import/schema.ts                            versioned batch contract (schemaVersion 1), strict, bounded
  → normalize     import/normalize.ts                         NFKC/trim, tags dedupe, closed vocabularies, RuntimeRecipeSchema
  → identity      import/identity.ts                          imp-<sha256(ns:record)[0:16]>, slug policy, canonical JSON
  → ingredients   import/ingredients.ts                       exact canonical resolution (no substring, no invented IDs)
  → duplicates    import/duplicates.ts                        bucketed hard/semantic detection + explicit waivers
  → quality gates (all of the above; any error ⇒ not publishable)
  → SQL render    import/sql-render.ts                        deterministic data-only INSERTs for a future migration
  → release       import/release-manifest.ts                  legacy + approved batches ⇒ Catalog Release Manifest
  → artifacts     import/compiler.ts                          7 files + hashes; written by the CLI beneath .artifacts/recipe-import/
```

CLI: `scripts/recipe-import.mjs` (`validate | compile | verify | check | release-manifest`), output policy
`scripts/recipe-import-output-policy.mjs`. `pnpm recipe:import:check` verifies the committed manifest offline.

## 2. Input schema (batch v1)

```jsonc
{
  "schemaVersion": 1,
  "batchId": "editorial-2026-10-a",                 // ^[A-Za-z0-9][A-Za-z0-9._-]*$
  "source": {
    "sourceType": "curated" | "imported" | "ai_generated",   // user_generated is NOT accepted for bulk editorial imports
    "sourceNamespace": "provider.dataset",          // stable identity namespace
    "sourceReference": "dataset/batch/provider ref",// REQUIRED, non-empty → recipes.source_reference
    "license": "…", "usageNote": "…"                // optional provenance notes (no secrets)
  },
  "recipes": [ {
    "sourceRecordId": "rec-001",                    // stable per source; identity = namespace:recordId
    "batchOrder": 0,                                // explicit 0..N-1; file order is never authority
    "verificationState": "reviewed",                // only reviewed records are publishable
    "title": "…", "description": "…",
    "slug": "romanized-slug",                       // ^[a-z0-9]+(?:-[a-z0-9]+)*$, ≤100, reviewer-supplied (no auto transliteration)
    "cuisine": "vietnamese|korean|japanese|chinese|thai|italian",
    "category": "open text (optional)", "region": "bac|trung|nam|toan_quoc (vietnamese only, optional)",
    "cookTimeMinutes": 30, "servings": 4, "difficulty": "easy|medium|hard",
    "imageUrl": "/frigo/…​.webp (optional, same-origin only)",
    "nutrition": { "calories", "proteinG", "fatG", "carbG", "evidence": "REQUIRED" },   // optional block; never fabricated
    "ingredients": [ { "text": "Thịt ba chỉ", "ingredientId": "PORK_BELLY (optional explicit)", "quantity": 500, "unit": "g", "isOptional": false } ],
    "steps": [ { "stepNumber": 1, "instruction": "…", "tip": "…", "timerMinutes": 10 } ],   // 1..N contiguous
    "tags": ["…"], "classifications": [ { "kind": "meal_type|dietary|allergen|method|equipment|suitability", "tag": "…" } ],
    "duplicateReview": { "decision": "distinct", "reason": "…" }   // required to publish a semantic duplicate candidate
  } ]
}
```

JSONL: first line = header (everything but `recipes`), then one record per line.

## 3. Policies

| Concern | Policy |
| --- | --- |
| Identity | `imp-` + first 16 hex of SHA-256(`sourceNamespace:sourceRecordId`). Same source ⇒ same ID forever; title/slug/position never influence it. Matches `^[a-z0-9]+(?:-[a-z0-9]+)*$` (T14C media keys). Collisions (ID/slug/source/content, legacy, within batch, across approved batches) FAIL; never renumbered. |
| Slug | Reviewer-supplied romanized `^[a-z0-9]+(?:-[a-z0-9]+)*$`; no locale-dependent transliteration. Collision FAIL. |
| Order | `runtime_order = releaseBaseCount + batchOrder`; legacy 71 keep 0..70; batches append. `batchOrder` must be exactly 0..N-1. Reordering rows in the file yields byte-identical SQL/manifest (tested). |
| Ingredients | Exact match against `CANONICAL_INGREDIENTS` (ID, or normalized name/alias mapping to exactly one ingredient). Unresolved/ambiguous ⇒ `UNRESOLVED_INGREDIENT`/`AMBIGUOUS_INGREDIENT`, non-publishable, bounded token-based candidates in `unresolved-ingredients.json` for review. No parallel registry; taxonomy growth is a documented T14F proposal, not an import side effect. |
| Units / quantity | `StandardUnitSchema` only (`g kg ml l piece pack bunch slice`); `cup/tbsp/tsp/pinch` ⇒ `UNSUPPORTED_UNIT`. Quantity finite and > 0 (NaN/Infinity/strings are rejected at JSON/schema level). `isOptional` preserved exactly. |
| Steps | Integers, start at 1, contiguous, unique, non-empty; `tip`/`timerMinutes` optional. IDs `<recipe>_step_<n>`, ingredient rows `<recipe>_ing_<1-based>`, positions in `recipe_runtime_ingredient_order`. |
| Cuisine / region / category | Closed runtime vocabularies for cuisine (`UNSUPPORTED_CUISINE`) and region (`INVALID_REGION`; VN only). Category typed-open, normalized, non-empty. |
| Tags / classifications | NFKC + trim + dedupe, order preserved, legacy `cat:`/`region:` markers rejected; classification kinds are the existing six; no health/dietary inference. |
| Nutrition | Optional. Requires `evidence`; finite non-negative macros; lands in `recipe_runtime_fields.legacy_*` (compatibility projection). Never fabricated. `nutrition_profiles` evidence remains a separate system (ADR-004). |
| Media / imageUrl | Import never downloads/generates images. SQL creates one truthful `recipe_media` hero v1 **pending** slot per recipe (no storage key/hash). `imageUrl` compatibility: same-origin raster path or the audited placeholder `/frigo/illustrations/delicious-meal.png` (classifies `legacy_static`); external URLs are rejected (no new CSP debt). |
| Provenance | `recipes.source_type/source_reference/verification_state/version` = batch sourceType / batch sourceReference / `reviewed` / 1. Stricter than the historical schema (which allows NULL references). AI-generated input passes identical gates. |
| Duplicates | Hard (error, unwaivable): same source key, same ID, same slug, identical content fingerprint. Semantic (review): normalized title within cuisine, identical ingredient signature. Bucketed maps ⇒ O(N + M). Waiver = `duplicateReview { decision: "distinct", reason }`, recorded in `duplicate-report.json`. |
| SQL | One literal renderer (`'` doubled, NUL refused, finite numbers only). Plain `INSERT` (abort on collision; no `ON CONFLICT DO UPDATE`). Rows: recipes, recipe_ingredients, recipe_steps, recipe_runtime_fields, recipe_runtime_ingredient_order, recipe_classifications, recipe_media. Prerequisite: canonical ordering through 0035. |
| Determinism | No `Date.now()`, randomness, filesystem order, locale or timezone. Canonical key-sorted JSON everywhere; issues sorted (subject, code, path, detail). Same input + same previous release ⇒ byte-identical artifacts (only `artifact-manifest.json.inputSha256` reflects the physical bytes). |
| Artifacts | `normalized-recipes.json`, `validation-report.json`, `duplicate-report.json`, `unresolved-ingredients.json`, `migration.sql` (publishable only), `catalog-release-manifest.json` (publishable only), `artifact-manifest.json` (schemaVersion, batchId, batchHash, inputSha256, normalizedSha256, migrationSha256, releaseManifestSha256, releaseId, counts). Written only beneath `.artifacts/recipe-import/<dir>/`; traversal, sibling-prefix dirs, absolute paths and symlink escapes are refused; `verify` is read-only. |
| Fail-closed | Any error ⇒ exit 1, `publishable=false`, no `migration.sql`/manifest; diagnostics still written. Warnings are currently unused (no integrity issue is downgraded). |

## 4. Catalog Release Manifest and growth-ready readiness

```text
ALL_RECIPES (71)                 immutable legacy/static rollback baseline
+ approved batch 1 (hash, N1)    runtime_order 71..71+N1-1
+ approved batch 2 (hash, N2)    …
= Catalog Release Manifest       releaseId, legacyBaselineCount/Fingerprint, expectedRecipeCount, orderedRecipeIds,
                                 expectedRuntimeFingerprint, approvedImportBatches[]
D1 authority READY  ⇔  hydration failures = 0
                     ∧ count == expectedRecipeCount                       (COUNT_DRIFT)
                     ∧ ordered IDs == orderedRecipeIds                    (ID_DRIFT / ORDER_DRIFT)
                     ∧ D1[0..70] fingerprint == static baseline           (LEGACY_BASELINE_DRIFT)
                     ∧ full fingerprint == expectedRuntimeFingerprint     (FINGERPRINT_DRIFT)
                     ∧ manifest describes this build's baseline           (RELEASE_MANIFEST_INVALID)
```

`packages/recipes/src/import/catalog-release.current.json` = today's release (`rel-1a047444a3632771`, 71 recipes, 0
batches, fingerprint `9ae153e6…7c3f` == static). `assessD1Readiness(baseline, hydration, release = currentCatalogRelease())`
and `D1RecipeAuthority` default to it; the worker router (`src/worker/services/recipe-authority.ts`) is unchanged. The
manifest is reviewed metadata compiled into the bundle — never request/header/query/KV/D1-row controlled.

Proven on a real SQLite replay of 0001→0035 + generated batch SQL (tests): 71 READY (identical to T14D), 77 READY with
`ALL_RECIPES` still 71, 78 vs 77 ⇒ COUNT_DRIFT, 76 vs 77 ⇒ COUNT_DRIFT, swapped ID ⇒ ID_DRIFT, imported field change ⇒
FINGERPRINT_DRIFT, legacy field change ⇒ LEGACY_BASELINE_DRIFT, reordered ⇒ ORDER_DRIFT, stub ⇒ CATALOG_DIAGNOSTICS, stale
71-manifest over 77 rows ⇒ COUNT_DRIFT (never READY).

**Rollback semantics (documented for T14F):** `RECIPE_CATALOG_MODE=static` or any D1 fallback serves the 71-recipe
baseline even when the release is 500+. Availability wins, but coverage shrinks; `actualSource=static` +
`recipe_catalog_d1_fallback`/`canary_fallback` diagnostics already make it visible. A future bounded
`expectedReleaseCount/actualServedCount` field can be added to those diagnostics without new infrastructure.

## 5. Scale characteristics (synthetic, in-memory, not committed)

| Batch | recipes | ingredient lines | steps | generated SQL |
| --- | --- | --- | --- | --- |
| 500 | 500 | 2,000 | 1,750 | ≈ 0.78 MB |
| 2,000 | 2,000 | 8,000 | 7,000 | ≈ 3.1 MB |
| 5,000 | 5,000 | 20,000 | 17,500 | ≈ 7.9 MB |

Duplicate algorithm: hash-bucketed exact keys (source, ID, slug, content fingerprint) + semantic buckets (cuisine+normalized
title, ingredient signature) — O(N + M), no pairwise scan (structural test: bucket visits ≪ N²). Composer: O(total recipes)
with ID/slug maps. D1 reader stays `RECIPE_CONTENT_READ_STATEMENT_COUNT=5`; hydration O(rows); readiness O(catalog). No
wall-clock thresholds are asserted.

**Chunking (T14F):** a 5,000-recipe release ≈ 8 MB of SQL. Wrangler/D1 migration files should stay well below that, so
T14F should promote batches as consecutive migrations (`0036`, `0037`, …), each a complete batch, and regenerate the
manifest only once every chunk of the intended release is present — partial chunks must never certify D1 authority.

## 6. Legacy FK anchors

Cooking/shopping routes still `INSERT OR IGNORE INTO recipes (7 cols)` for unknown IDs (pre-existing, T14D-documented).
Imported IDs use the `imp-` namespace, so an anchor can only exist for an imported ID if a flow referenced that ID before
promotion. Policy: the plain-INSERT migration then aborts (PRIMARY KEY collision) and nothing is upgraded silently; the
operator must resolve the stub explicitly. A publishable import always classifies `complete` via `classifyCatalogEntry`;
an anchor with an imported ID classifies `fk_stub` and fails hydration (tested).

## 7. Promotion flow (T14F — NOT performed in T14E)

```text
raw batch → validate → review/fix → compile → artifact hashes stable → human/independent review
→ copy migration.sql to migrations/00NN_<batch>.sql (next actual number; 0036 if nothing lands first)
→ copy catalog-release-manifest.json over packages/recipes/src/import/catalog-release.current.json
→ pnpm recipe:import:check (must stay green: manifest == composed truth) → pnpm check:migrations (fresh replay)
→ CI → PR → merge → production 0035…00NN via Production D1 Migration workflow → deploy → shadow/canary/d1 rollout (ADR-026)
```

The compiler never writes into `migrations/` or `packages/recipes/src`.

## 8. Production debt (unchanged, restated truthfully)

Production application expected `4ed98514f65ddd3b3d83007cd726fd7c2e2136e6`; production D1 expected tip
`0034_global_recipe_catalog_parity.sql`; 0035 rollout and T14D runtime deployment pending operator dispatch
(`T14CD_PRODUCTION_ROLLOUT_HANDOFF.md`). T14E does not assume 0035 or T14D in production; generated SQL declares 0035 as
its prerequisite and relies on canonical migration ordering (0034 → 0035 → 0036+).

## 9. Non-goals / safety

No scraping/crawling, no network in core tests, no LLM calls, no image download, no media population, no production or
Cloudflare action, no `RECIPE_CATALOG_MODE` change, no Inventory Truth change (T09/T11 untouched; no new inventory
readers/writers), no PayOS/auth/OCR/Qwen/DNS/deploy-workflow change, no 0036, no T14F.
