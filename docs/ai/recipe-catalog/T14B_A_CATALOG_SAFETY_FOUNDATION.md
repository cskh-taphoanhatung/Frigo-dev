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

## Canonical integration refresh — 2026-09-15 UTC

T14A is now integrated through PR #11, merge
`fbd14c771070e1b5594532648d79fb60c891747d`. Its exact head
`e916d292d391ba999bcdd96bfdfec98e6b598678` passed hosted `validate` in run
`35034318031`. This T14B-A integration starts directly from that new main on
`hoplite/poteidaia-c88481ca-integrate-t14b-a-current-main`, not the stale PR #7 stack.

Only the accepted functional delta from PR #8 head
`4a1fa07cbc9c22e393234bcba9212ca2ef887d65` (code remediation
`582ced73a715e92e0476e9b9e050e86cbb36c6b9`) is imported. Functional files are
preserved byte-for-byte. The recipe decision is now **ADR-023** because current
main already contains the Auth/OCR ADR-022; no architecture was redesigned.

PR #9's production application merge `911db7fdddcd60ea1e3f3c17b4aed3f4b922bda5`
and PR #10's rollout receipt remain intact. The recorded serving Worker is
`20bc1f35-6ffe-4085-ba79-d54a0b53da71`, not historical `e6b9195`. T14B-A's
additive, non-authoritative library/tooling changes are not a production release.
Integration PR #12 merged as `a165474a623a8130c9a9ed4f1df096b3ac3b3ae9` after
exact head `3e3937419b560f1ebf0aa7f5e29a3131508b7d94` passed hosted run
`35035112092` and all fresh local gates (154 files / 3676 tests). Final canonical
baseline receipt: `T14_INTEGRATION_REFRESH.md`; old CI and “not triggered” status
below are historical.
T14B-B is not started, media remains deferred to T14C, and PR #4 remains historical
with CLOSE_ARCHIVE recommendation (not merged/deleted).

## 1. Historical precondition gate (verified at original implementation)

The old base, deployment, branch and PR states in this section are historical;
they do not describe the refreshed canonical integration above.

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
it was equivalent to branching from then-current `main` for every application path, while
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
| Explicit generator | none | `pnpm recipe:seed:check` (read-only compare; exits 1 if stale with instruction to ship a NEW migration) and `pnpm recipe:seed:render` (writes only beneath `.artifacts/recipe-seed/`) |
| Output containment (review finding B) | `--out` refused only `migrations/` and `packages/` | `scripts/recipe-seed-output-policy.mjs`: segment-aware containment (`path.relative`, not prefix matching) allows only files strictly beneath `<repo>/.artifacts/recipe-seed/`; rejects `src/`, `docs/`, `package.json`, `wrangler.jsonc`, `.artifacts/other/`, sibling prefix `.artifacts/recipe-seed-evil/`, `..` traversal, absolute paths elsewhere, and symlinked ancestors (allowed root or `.artifacts` pointing outside). Renderer exits 3 on refusal; `--check` never writes. 29 regression tests in `tests/unit/recipe-seed-output-policy.test.mjs`. |
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

## 7a. Review remediation and hosted-CI truth (2026-09-15)

Independent review accepted the architecture (no runtime-authority switch, no
migration change, no Inventory Truth/Qwen/media/CSP/payment change) and raised two
findings, both addressed here:

- **A — hosted CI misstated.** `.github/workflows/ci.yml` triggers `pull_request` only for
  `branches: [main, master]`. PR #8 targets the PR #7 branch, so at head `05685855` it had
  0 workflow runs / 0 check runs / 0 status contexts. Truthful status:
  `HOSTED_CI_VALIDATE=NOT_TRIGGERED`, `REASON=PR base is not main/master under current workflow`.
  Hosted evidence for T14B-A will exist only after PR #7 merges and PR #8 is retargeted to `main`.
  The earlier "CI pending" wording was wrong and is withdrawn.
- **B — renderer output too permissive.** Fixed as described in §5 (commit `582ced7`).

**Cuisine taxonomy caveat (document only).** `RUNTIME_RECIPE_CUISINES`
(`vietnamese|korean|japanese|chinese|thai|italian`) mirrors today's 71 recipes and the
legacy `CuisineType`. It is **not** a sufficient long-tail taxonomy for thousands of
international recipes; a taxonomy decision (open string with controlled vocabulary,
or an expanded enum plus `recipe_classifications`) is a prerequisite before any bulk
T14E ingestion. No widening in T14B-A.

**Nutrition remains truthfully unsupported.** The drift report reports
`nutrition.representation = 'unsupported_by_catalog_model'` for all 59 shared rows.
Static runtime macros must not be copied into `nutrition_profiles`/`recipe_nutrition`
without a sourcing/provenance/basis decision (ADR-004, ADR-009); that belongs to T14B-B design.

## 8. Historical verification (original head `582ced7` + original docs commit)

```
pnpm install --frozen-lockfile        exit 0 (unchanged lockfile)
pnpm recipe:seed:check                recipe-seed-check=ok (59 recipes match 0006_vietnamese_recipe_bank.sql)
pnpm typecheck                        exit 0
pnpm lint                             exit 0
pnpm check:migrations                 migration-smoke=ok
pnpm build                            ✓ built, exit 0
npx vitest run (full)                 Test Files 152 passed (152) · Tests 3673 passed (3673)
                                      (T14B-A baseline 151/3644 + 1 file/29 policy tests)
focused T14B-A suites                 recipe-seed-readonly 5 · runtime-recipe-contract 5 ·
                                      recipe-catalog-safety 6 · recipe-seed-output-policy 29
pnpm recipe:seed:render               writes only .artifacts/recipe-seed/0006_…sql (== committed 0006)
render --out <11 forbidden paths>     each refused, exit 3, nothing written
                                      (migrations/, packages/recipes/, src/worker/, src/web/, docs/,
                                       package.json, wrangler.jsonc, .artifacts/other/,
                                       .artifacts/recipe-seed-evil/, ../evil.sql, /tmp/evil.sql)
sha256sum migrations/*.sql            identical before/after every gate; 33 files; last 0033; no 0034
git status after full vitest          only the intentional docs edit; no migration/recipe source change
git diff --check                      clean
src imports of new modules            0 (ALL_RECIPES remains runtime authority)
inventory SQL-touching file set       unchanged vs T14A start

HOSTED_CI_VALIDATE=NOT_TRIGGERED
REASON=PR #8 base is hoplite/koroneia-838b0ccc (PR #7), not main/master, under .github/workflows/ci.yml
```

## 9. Historical safety confirmation (original implementation, before integration)

production deployment NO · main merge NO · migration creation NO · existing migration
modification NO (per-file SHA-256 of `migrations/*.sql` identical before/after; 33 files;
`0034` absent) · production D1/R2/KV/queue write NO · recipe authority switch NO ·
media/CSP change NO · Qwen behavior change NO · inventory behavior change NO ·
payment/PayOS change NO · DNS/secret change NO.
