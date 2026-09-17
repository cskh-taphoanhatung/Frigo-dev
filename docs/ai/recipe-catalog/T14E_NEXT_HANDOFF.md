# T14E next-phase handoff — final state record (T14F NOT started)

```text
T14E_STATUS=T14E_DEVELOPMENT_COMPLETE · T14E_MAIN_CERTIFIED · REAL_CATALOG_GROWTH_NOT_STARTED · PRODUCTION_ROLLOUT_DEFERRED · T14F_NOT_STARTED
T14E_BASE_MAIN=9ff571995bf5f2a4381c2dfc6de796e6554fd43c
PR23_ORIGINAL_HEAD=7b4edcc825b9061d373bd1b271b4a33967ccad76
PR23_REMEDIATED_HEAD=ba1a45d43f2f4b85d4f7500eba36fe094a7d3655
PR23_MERGE_SHA=POST_PR23_MERGE_MAIN=f7a5540841db27be31cdab9e0c2010cd92bc3861   (normal merge; validate run 35182568280 SUCCESS)
T14E_FINAL_CANONICAL_MAIN=<merge SHA of the docs-only closure PR carrying this file — recorded in that PR's post-merge comment>
```

`T14E_FINAL_CANONICAL_MAIN` is the ONLY valid development base for T14F. Do not base T14F on `9ff57199…`, `7b4edcc8…`,
`ba1a45d4…` or the PR #23 merge SHA `f7a55408…` once the docs closure has advanced main. Receipt: `T14E_MERGE_RECEIPT.md`.

## 1. Exact post-merge state (certified on `f7a55408…`)

- **Merged code:** `packages/recipes/src/import/` (types, schema, parse, identity, ingredients, normalize, duplicates,
  sql-render, release-manifest, compiler, index, `catalog-release.current.json`), `packages/recipes/src/catalog-fingerprint.ts`
  (fingerprint helpers, re-exported), `packages/recipes/src/recipe-authority.ts` (manifest-driven `assessD1Readiness`;
  `D1RecipeAuthority` release supplier; codes `RELEASE_MANIFEST_INVALID`, `LEGACY_BASELINE_DRIFT`), `scripts/recipe-import.mjs`
  (`validate | compile | verify | check | release-manifest`), `scripts/recipe-import-output-policy.mjs`, `pnpm recipe:import:check`.
- **Tests:** `tests/unit/recipe-import-{provenance,factory,scale}.test.ts`, `tests/unit/recipe-import-output-policy.test.mjs`,
  `tests/integration/recipe-catalog-release-readiness.test.ts`, `tests/unit/recipe-authority.test.ts`; fixtures
  `tests/fixtures/recipe-import/valid-batch.json`, helpers `tests/helpers/recipe-import-fixtures.ts`. Full suite 169 files / 3889 tests.
- **Current release:** `rel-1a047444a3632771` · legacyBaselineCount 71 · expectedRecipeCount 71 · approvedImportBatches 0 ·
  fingerprint `9ae153e64d34b30d72bb985d4070d8e210201219c0e8f8998ce8f99057fc7c3f` (== static baseline == expected runtime).
- **Growth model (do not weaken):** `ALL_RECIPES` = 71 legacy recipes = static emergency rollback baseline; Catalog Release
  Manifest = reviewed expected D1 release; D1 READY ⇔ hydration clean ∧ count/IDs/order match ∧ legacy prefix == `ALL_RECIPES`
  fingerprint ∧ full release fingerprint == manifest. Reason codes: `CATALOG_DIAGNOSTICS | COUNT_DRIFT | ID_DRIFT | ORDER_DRIFT |
  LEGACY_BASELINE_DRIFT | FINGERPRINT_DRIFT | RELEASE_MANIFEST_INVALID | D1_READ_FAILED`. Never `count > 0` / `count >= 71`.
- **Identity model (do not weaken):** runtime fingerprint = runtime recipe semantics only; `batchHash` = `canonicalBatchProjection`
  (schemaVersion, batchId, sourceType/namespace/reference, license, usageNote, per-recipe batchOrder/sourceKey/runtime/provenance/
  classifications/nutritionEvidence/duplicateReview); `releaseId` = reviewed release identity. Evidence/license/usageNote/review
  changes ⇒ new batchHash ⇒ new releaseId while the runtime fingerprint may stay identical — intentional.
- **Nutrition provenance (do not remove):** `NormalizedImportRecipe.nutritionEvidence`, `NUTRITION_EVIDENCE_LOST`, renderer
  invariants, `nutrition_profiles` (`<id>_nutrition_v1`, per serving) + `recipe_nutrition` link at version 1.

## 2. Unchanged (by design)

`ALL_RECIPES` = 71; migrations 35 / tip `0035_recipe_media_layer.sql` / **no 0036**; 0001–0035 hashes; `deploy.yml`,
`production-d1-migrate.yml`, `release-check.mjs`, `d1-migration-check.mjs`; D1 reader (5 statements); hydrator; worker authority
router; Inventory Truth (T09/T11, 0 new writers / 0 new canonical readers); T14C media architecture (no media populated);
PayOS/auth/OCR/Qwen/CSP/DNS.

## 3. Production debt — T14F MUST NOT assume production is current

```text
production_application_expected=4ed98514f65ddd3b3d83007cd726fd7c2e2136e6
production_D1_tip_expected=0034_global_recipe_catalog_parity.sql   (0035 NOT applied remotely as of this record)
production_recipe_mode=static   shadow_activated=NO   canary_activated=NO   d1_activated=NO
Production D1 Migration workflow: exists   Deploy workflow: exists   operator dispatch: PENDING_OPERATOR
```

T14F migration design must stay forward-applicable `0034 → 0035 → future T14F migrations`. Generated import SQL already declares
0035 as its prerequisite (pending `recipe_media` hero slots). Operator inputs for 0035 + T14D deploy:
`T14CD_PRODUCTION_ROLLOUT_HANDOFF.md`. Do not merge T14F work that requires 0035 to already be live without stating so.

## 4. T14F prerequisites (must all hold before T14F starts)

1. Base = `T14E_FINAL_CANONICAL_MAIN` with exact-head `validate=SUCCESS`.
2. `pnpm recipe:import:check` = ok on that base (`rel-1a047444a3632771`, 71, 0 batches).
3. Migrations still 35 / 0035 / no 0036 on that base.
4. An AUTHORIZED dataset with a recorded license/usage note (no scraping, no unlicensed content).
5. A named human reviewer for ingredient resolution, duplicate candidates and provenance.

## 5. T14F sequence (exact; none performed in T14E)

1. **Prepare the authorized recipe dataset** as a v1 batch (`.json`/`.jsonl`): stable `sourceNamespace`/`sourceRecordId`,
   explicit `batchOrder` 0..N-1, reviewer romanized `slug`, non-empty batch `sourceReference`, `license`, `usageNote`,
   `verificationState: reviewed`, nutrition only with `evidence` (+ optional ADR-004 `sourceType`).
2. **Run T14E validation:** `node scripts/recipe-import.mjs validate --input <batch>`.
3. **Resolve all ingredients** to exact canonical IDs / aliases. If the canonical vocabulary is insufficient, ship a taxonomy
   proposal (new `CANONICAL_INGREDIENTS` + D1 `ingredients` seed migration) as its own reviewed change first — never invent IDs,
   never create a parallel registry. Cuisines beyond the six runtime values need an explicit `RUNTIME_RECIPE_CUISINES` +
   `CuisineType` decision first.
4. **Review duplicate candidates** (`duplicate-report.json`): hard duplicates are removed; semantic candidates get
   `duplicateReview { decision: "distinct", reason }` only after human review.
5. **Verify provenance / license** for the batch and for every evidence-backed nutrition record.
6. **Compile deterministic artifacts:** `compile --input <batch> --out .artifacts/recipe-import/<batch-id>`; compile twice and
   confirm `artifact-manifest.json` hashes are identical.
7. **Review SQL + hashes:** `migration.sql` (plain INSERT, `runtime_order = 71 + batchOrder`, pending media slots, one
   `nutrition_profiles` + `recipe_nutrition` row per evidence-backed recipe), `normalized-recipes.json` (audit record),
   `catalog-release-manifest.json` (`expectedRecipeCount = 71 + N`, one approved batch with its `batchHash`);
   `verify --input <batch> --artifact <dir>` (read-only).
8. **Choose safe migration chunking** (§6). Decide the number/order of migrations before reserving any number.
9. **Promote the reviewed artifact** into the next migration(s): copy `migration.sql` → `migrations/<next>_<batch>.sql`
   (0036 if nothing lands before). Add each file to `scripts/migration-smoke.sh` and the schema gate's `required_migrations`,
   keeping the gate at five compound-SELECT branches (hosted D1 limit).
10. **Update the Catalog Release Manifest:** copy `catalog-release-manifest.json` →
    `packages/recipes/src/import/catalog-release.current.json` (compose with `approvedBatches` in release order when several
    batches ship); `pnpm recipe:import:check` must pass and the manifest must describe the COMPLETE intended release.
11. **SQLite replay:** `pnpm check:migrations`, `pnpm schema:check:local`; readiness must be READY on the replayed ledger
    with the new manifest while `ALL_RECIPES` stays 71.
12. **Parity / readiness tests:** full `pnpm test`; extend `recipe-catalog-release-readiness` with the real batch if
    fixture-sized.
13. **Independent review** → PR → exact-head CI → normal merge → production only through the existing OPS sequence
    (`Production D1 Migration` per migration in order, 0035 first if still pending → `Deploy` → shadow → canary → d1 per ADR-026).

## 6. Migration chunking — T14F must evaluate (document only; nothing implemented here)

T14E scale evidence (synthetic, 50 % evidence-backed): 500 recipes ≈ 826 KB SQL, 2,000 ≈ 3.3 MB, 5,000 ≈ 8.3 MB. A single
5,000-recipe migration file is large for hosted D1 migration application and for review. T14F should evaluate deterministic
chunking into consecutive complete-batch migrations, e.g. `0036` batch A, `0037` batch B, `0038` batch C, …, where each file is
one complete reviewed batch (own `batchId`/`batchHash`) and the final Catalog Release Manifest composes all approved batches in
release order and certifies only the complete release. Constraints: each chunk must be independently plain-INSERT, FK-safe on
top of the previous chunk, and byte-deterministic; `runtime_order` continues across chunks (`releaseBase + batchOrder`);
readiness stays NOT READY until the last chunk of the manifested release is applied. T14E reserves no migration number.

## 7. T14F release strategy (recommended; exact sizes belong to T14F)

Do not jump `71 → 5,000` in one unreviewed batch. Progression: first reviewed pilot batch → verify on staging (readiness
READY, parity, media pending slots, nutrition reader) → grow toward ~500 → certify → then larger expansion. Every step keeps
`ALL_RECIPES` = 71 as the config-only rollback (`RECIPE_CATALOG_MODE=static`).

## 8. Known follow-ups recorded (not fixed)

- `KNOWN_OPS_P2_STAGING_SHA_PROPAGATION_RACE` (did not occur on the `f7a55408…` staging deploy), Wrangler 4 upgrade,
  `CONFIG_PLUS_GRANT_SECRET_MISSING` (unchanged).
- Reduced-coverage diagnostics (`expectedReleaseCount/actualServedCount`) for static fallback are documented, not implemented.
- Legacy `INSERT OR IGNORE INTO recipes` FK anchors remain pre-existing behaviour; collision policy in the design doc §6.

`media_population_started=NO` · `T14F_started=NO` · `0036_created=NO` · `real_recipe_growth=NO`.
