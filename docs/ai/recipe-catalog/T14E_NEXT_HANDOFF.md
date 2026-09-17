# T14E next-phase handoff — state record only (T14F NOT started)

```text
T14E_STATUS=T14E_REMEDIATED · T14E_READY_FOR_RE_REVIEW · REAL_CATALOG_GROWTH_NOT_STARTED · PRODUCTION_ROLLOUT_DEFERRED
T14E_BASE_MAIN=9ff571995bf5f2a4381c2dfc6de796e6554fd43c
T14E_FINAL_CANONICAL_MAIN=<merge SHA of the reviewed T14E PR — recorded in its post-merge comment; the ONLY valid base for T14F>
```

## 1. What T14E delivers (repository, not production)

- `packages/recipes/src/import/` — parse, schema, identity, ingredients, normalize, duplicates, sql-render,
  release-manifest, compiler (+ `catalog-release.current.json`, the reviewed 71-recipe manifest, `rel-1a047444a3632771`).
- `packages/recipes/src/catalog-fingerprint.ts` — fingerprint helpers extracted from `recipe-authority.ts` (re-exported).
- `packages/recipes/src/recipe-authority.ts` — `assessD1Readiness(baseline, hydration, release = currentCatalogRelease())`
  (manifest-driven; new codes `RELEASE_MANIFEST_INVALID`, `LEGACY_BASELINE_DRIFT`; `ready` carries `releaseId`);
  `D1RecipeAuthority` accepts a release supplier (defaults to the shipped manifest). Router untouched.
- `scripts/recipe-import.mjs`, `scripts/recipe-import-output-policy.mjs`, `pnpm recipe:import:check`.
- Tests: `tests/unit/recipe-import-factory.test.ts`, `tests/unit/recipe-import-scale.test.ts`,
  `tests/unit/recipe-import-output-policy.test.mjs`, `tests/integration/recipe-catalog-release-readiness.test.ts`,
  fixtures `tests/fixtures/recipe-import/valid-batch.json`, helpers `tests/helpers/recipe-import-fixtures.ts`.
- Docs: `T14E_BULK_RECIPE_IMPORT_FACTORY.md`, ADR-027.
- Remediation (review P1/P2/P3, forward commit on the same branch): nutrition evidence preserved end-to-end and persisted as
  ADR-004 `nutrition_profiles` + `recipe_nutrition` rows by the generated SQL; `canonicalBatchProjection` = single immutable
  batch-hash projection (schema version, license, usage note, evidence, duplicate review, content); `normalized-recipes.json`
  carries batch metadata + evidence + review decisions; manifest load/parse failure = `RELEASE_MANIFEST_INVALID` (not
  `D1_READ_FAILED`). Tests: `tests/unit/recipe-import-provenance.test.ts`. Current release `rel-1a047444a3632771` unchanged.

## 2. Unchanged (by design)

`ALL_RECIPES` = 71; migrations 35 / tip 0035 / no 0036; 0001–0035 hashes; `deploy.yml`, `production-d1-migrate.yml`,
`release-check.mjs`, `d1-migration-check.mjs`; D1 reader (5 statements); hydrator; worker authority router; Inventory
Truth (T09/T11); PayOS/auth/OCR/Qwen/CSP/DNS. Production: `4ed98514…` / D1 0034 / static (operator dispatch pending —
`T14CD_PRODUCTION_ROLLOUT_HANDOFF.md`).

## 3. T14F instructions (exact; none performed here)

1. Start from `T14E_FINAL_CANONICAL_MAIN`. If production 0035/T14D rollout has not happened, keep every T14F artifact
   forward-applicable from production 0034 (generated SQL already declares 0035 as prerequisite).
2. Collect/prepare an AUTHORIZED dataset (no scraping). Write it as a v1 batch (`.json`/`.jsonl`) with stable
   `sourceNamespace`/`sourceRecordId`, explicit `batchOrder`, reviewer slugs, non-empty `sourceReference`, license note.
3. Resolve ingredients: `node scripts/recipe-import.mjs validate --input <batch>`; fix `UNRESOLVED_INGREDIENT` /
   `AMBIGUOUS_INGREDIENT` by choosing canonical IDs. If the canonical vocabulary is insufficient, write a taxonomy
   proposal (new `CANONICAL_INGREDIENTS` + D1 `ingredients` seed migration) as its own reviewed change — never invent IDs
   in the batch and never create a parallel registry. Likewise, cuisines beyond the six runtime values need an explicit
   `RUNTIME_RECIPE_CUISINES` + `CuisineType` expansion decision first.
4. Review duplicates: inspect `duplicate-report.json`; add `duplicateReview { decision: "distinct", reason }` only after
   human review; hard duplicates must be removed.
5. Review `verificationState`: only `reviewed` records publish.
6. `node scripts/recipe-import.mjs compile --input <batch> --out .artifacts/recipe-import/<batch-id>`; then
   `verify --input <batch> --artifact <dir>` (read-only) and confirm hashes in `artifact-manifest.json` are stable
   across two compiles.
7. Inspect `migration.sql` (plain INSERT, `runtime_order = 71 + batchOrder`, pending media slots, one `nutrition_profiles`
   + `recipe_nutrition` row per evidence-backed recipe) and `catalog-release-manifest.json` (expectedRecipeCount = 71 + N,
   one approved batch whose `batchHash` commits to license/usage/evidence/review metadata — keep `normalized-recipes.json`
   with the review record for audit).
8. Promote: copy `migration.sql` → `migrations/<next-number>_<batch>.sql` (0036 if nothing lands before). Chunk large
   releases into consecutive complete-batch migrations; the manifest certifies only the complete release.
9. Copy `catalog-release-manifest.json` → `packages/recipes/src/import/catalog-release.current.json`;
   `pnpm recipe:import:check` must pass. If multiple batches ship, compose with `approvedBatches` in release order.
10. Fresh local replay: `pnpm check:migrations` (add the new file to `scripts/migration-smoke.sh` and the schema gate's
    `required_migrations`, keeping the gate at five compound-SELECT branches), `pnpm schema:check:local`, full `pnpm test`
    (readiness must be READY on the replayed ledger with the new manifest).
11. Independent review → PR → exact-head CI → merge → production: `Production D1 Migration` for each new migration in
    order (0035 first if still pending) → `Deploy` → shadow → canary → d1 per ADR-026.

## 4. Known follow-ups recorded (not fixed)

- `KNOWN_OPS_P2_STAGING_SHA_PROPAGATION_RACE`, Wrangler 4 upgrade, `CONFIG_PLUS_GRANT_SECRET_MISSING` (unchanged).
- Reduced-coverage diagnostics (`expectedReleaseCount/actualServedCount`) for static fallback are documented, not implemented.
- Legacy `INSERT OR IGNORE INTO recipes` FK anchors remain pre-existing behaviour; collision policy documented in the design doc §6.

`media_population_started=NO` · `T14F_started=NO` · `0036_created=NO`.
