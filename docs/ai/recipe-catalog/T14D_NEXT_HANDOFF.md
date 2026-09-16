# T14D next-phase handoff — state record only (no next task started)

```text
T14D_STATUS=T14D_DEVELOPMENT_COMPLETE · T14D_MAIN_CERTIFIED · PRODUCTION_ROLLOUT_DEFERRED
T14D_POST_MERGE_MAIN=bb504cce7476927249b3c6e4d5bc634600a45883
T14D_FINAL_CANONICAL_MAIN=<the merge SHA of the docs-closure PR that lands this file; recorded in that PR's
                          post-merge comment and in CURRENT_STATE.md — the ONLY valid base for the next major task>
```

Do not base new work on `d0856b48…`, `f2831805…` or `bb504cce…` once the docs closure has advanced main.

## 1. Canonical application architecture state (repository main)

- **Recipe content authority:** `RecipeAuthoritySnapshot` resolved once per request/operation by
  `resolveRecipeAuthority(env, { tenantKey: householdId })` (`src/worker/services/recipe-authority.ts`).
  Modes `static | shadow | canary | d1`; `canary`/`d1` require `RECIPE_CATALOG_CUTOVER_ENABLED=true`;
  invalid values are fatal in production validation and served-static-with-error at request time.
  Static provider = `ALL_RECIPES` exact order (rollback baseline). D1 provider = T14B-B `readRecipeContent`
  (5-statement batch) + `hydrateRuntimeRecipes`, user-visible only after `assessD1Readiness` proves count/ID/order/
  field/fingerprint parity with the static baseline. Per-isolate cache 30 s TTL, 5 min stale grace, singleflight.
  Rollback is `RECIPE_CATALOG_MODE=static` (read routing only). ADR-026; `T14D_RECIPE_AUTHORITY_CUTOVER.md`.
- **Runtime readers:** 14/14 migrated; unknown runtime readers = 0, enforced by
  `tests/unit/recipe-catalog-authority.test.ts` (allowlist: static definitions/providers, seed + migration renderers,
  shadow oracle, browser offline fallbacks). `generateWeeklyMealPlan`/`getSwapAlternatives` require an explicit list.
- **Recipe media (T14C, ADR-025):** `recipe_media` (0035) + verified promotion (existence/MIME/size/SHA-256) +
  same-origin `/api/v1/recipe-media/:id/:role/:version`; independent of content authority; 0 ready rows anywhere.
- **Inventory Truth:** T09 mutation / T11 read authority unchanged; recipe authority adds no inventory writers/readers.
- **Legacy note:** `INSERT OR IGNORE INTO recipes` FK anchors in `routes/shopping.ts` and `routes/recipes.ts` predate
  T14D (pre-existing behaviour, `T14D_NEW_RECIPE_WRITERS=0`); candidates for T14E/catalog cleanup.

## 2. Migration debt

```text
repository: 35 migrations, tip 0035_recipe_media_layer.sql, no 0036; 0001–0035 pinned/immutable
production D1 frigo-db (f975ec39-b2c8-4a2a-80e1-0366054599d3): expected tip 0034_global_recipe_catalog_parity.sql
→ 0035 is NOT applied to production (T14C rollout PENDING)
```

## 3. Production deployment debt

```text
production application: 4ed98514f65ddd3b3d83007cd726fd7c2e2136e6 (T14B-B lineage)
NOT deployed: T14C (3a1e6be6…), T14C receipt (d0856b48…), T14D (bb504cce…), this closure
production recipe authority: static (RECIPE_CATALOG_MODE unset); CUTOVER fence unset; canary percent unset
last observed /api/v1/health/ready (read-only, 2026-09-16T20:36Z): commit 4ed98514, database ok, pre-existing CONFIG_PLUS_GRANT_SECRET_MISSING warning
```

Known OPS follow-ups retained (not fixed): `KNOWN_OPS_P2_STAGING_SHA_PROPAGATION_RACE` (deploy.yml / release-check
untouched), Wrangler 4 upgrade, `CONFIG_PLUS_GRANT_SECRET_MISSING`.

## 4. Eventual Codex OPS sequence (human-controlled; each step a config/ops action, none automatic)

```text
 1. authenticate Cloudflare (wrangler OAuth or CLOUDFLARE_API_TOKEN)
 2. prove production D1 identity: binding DB → frigo-db / f975ec39-b2c8-4a2a-80e1-0366054599d3 (d1 list + d1 info)
 3. verify ledger tip 0034 (34 rows; 0035/0036 absent) — if 0035 already present, certify instead of re-applying
 4. backup: pnpm wrangler d1 export frigo-db --remote --output <path>; record path/size/SHA-256/timestamp
 5. apply 0035: pnpm wrangler d1 migrations apply frigo-db --remote (plan must show exactly 0035)
 6. verify recipe_media: 71 rows / 71 hero v1 pending / 0 ready; FK check []; quick_check ok; catalog 71/59/12,
    385/341/71/385; non-recipe aggregates unchanged; bash scripts/d1-schema-gate.sh remote = PASS
 7. deploy the final certified canonical main via Deploy workflow_dispatch (staging → production, confirm_production,
    environment approval) with RECIPE_CATALOG_MODE still unset/static
 8. smoke: /health, /health/ready (commit = deployed main), /recipes 71/59/12 same order with media.hero all legacy,
    /api/v1/recipe-media/<id>/hero/1 → 409 RECIPE_MEDIA_PENDING, recommendations/planner/inventory unchanged
 9. enable RECIPE_CATALOG_MODE=shadow deliberately
10. observe recipe_catalog_shadow: drift 0 / order drift 0 / hydration failures 0 over a chosen window
11. enable RECIPE_CATALOG_CUTOVER_ENABLED=true + RECIPE_CATALOG_MODE=canary + RECIPE_CATALOG_D1_CANARY_PERCENT=1..5
12. observe recipe_catalog_authority_selected / canary_fallback / d1_not_ready counts; expect zero fallbacks
13. widen RECIPE_CATALOG_D1_CANARY_PERCENT deliberately (e.g. 10 → 25 → 50)
14. RECIPE_CATALOG_MODE=d1 only after explicit operator approval; rollback at any step = RECIPE_CATALOG_MODE=static
```

If future repository migrations exist before OPS rollout, apply them sequentially in canonical order before step 7.

## 5. T14E interaction rule

If T14E (bulk recipe import) begins before the OPS rollout, it must NOT assume production has 0035, T14D code or D1
authority. All new migrations/code must remain forward-applicable from the current production debt (0034 +
`4ed98514…`). Intentional catalog growth beyond `ALL_RECIPES` will also require a new readiness policy: today
`assessD1Readiness` demands exact parity with the static baseline (count, IDs, order, fingerprint).

## 6. Possible next development tracks (recorded, NOT chosen, NOT started)

```text
Track A — T14E Bulk Recipe Import Factory (hundreds/thousands of recipes; forward-applicable migrations; new readiness policy)
Track B — Recipe Media Population (generate/import → decode + dimensions + MIME + size + SHA-256 → upload → verified promote;
          NEVER overwrite bytes behind a ready key: new bytes → new version → new key)
Track C — other non-production architecture tasks
```

`media_population_started=NO` · `T14E_started=NO`.
