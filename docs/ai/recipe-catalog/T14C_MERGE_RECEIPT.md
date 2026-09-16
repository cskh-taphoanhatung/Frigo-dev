# T14C merge receipt — PR #17 merged into canonical main; production rollout pending operator credentials (2026-09-16)

```text
repo=frigo-1/Frigo-dev (formerly vn-taphoanhatung/Frigo-dev; canonical identity is repository_id)
repository_id=1368281478
PRE_MERGE_MAIN=8d3ebc444bbaa577893dd88a9d21f308a24f0cf5
PR=17   branch=feat/t14c-recipe-media-layer
PRE_MERGE_PR_HEAD=7b37325fe4be1366706e2a87a094c2d8023539ca   (reviewed head af017f58… preserved as its parent)
PR_BASE=main   PR_BEHIND=0   PR_MERGEABLE=mergeable   PR_REVIEW_THREADS=0 unresolved
PR17_CI=run 35118097449 / check 104868578664 / validate=SUCCESS (exact head 7b37325f)
MERGE_METHOD=merge (normal merge commit, consistent with #14/#15/#16; no squash/rebase; no force push; no history rewrite)
MERGE_SHA=3a1e6be610085d7f9cfed8a53f43ef6ea006ed5c
POST_MERGE_MAIN=3a1e6be610085d7f9cfed8a53f43ef6ea006ed5c
MERGE_PARENTS=8d3ebc444bbaa577893dd88a9d21f308a24f0cf5 7b37325fe4be1366706e2a87a094c2d8023539ca
PR_HEAD_IN_MAIN=YES (git merge-base --is-ancestor)
APPLICATION_TREE_PRESERVED=YES (git diff 7b37325f 3a1e6be6 --stat is empty)
MAIN_CI=run 35147336385 / check 104966628291 / validate=SUCCESS (exact head 3a1e6be6; ESLint, Typecheck, Vitest, Migration smoke, Build)
STATUS=T14C_MERGED_MAIN_CERTIFIED / T14C_PRODUCTION_MIGRATION_BLOCKED (credentials)
```

## Pre-merge gates (executed immediately before the merge, fresh `git fetch --all --prune`)

- `origin/main` = `8d3ebc44…`, PR head = `7b37325f…`, behind 0, mergeable, status rollup SUCCESS — matched the
  independently reviewed state exactly; nothing had moved.
- Migrations: 35 files, highest `0035_recipe_media_layer.sql`, no `0036`; `0001–0034` byte-identical to main;
  `tests/fixtures/migration-sha256.json` (34 pins incl. production-applied `0034`) drift = 0.
- Architecture: `RecipeCatalogMode = 'static' | 'shadow'` (no `d1`); `validateEnvironment` fails closed with
  `CONFIG_RECIPE_CATALOG_MODE` for any non-static production value. Diff vs main touches only T14C files
  (recipe-media modules/tests, 7 image surfaces, gates, docs, migration-count assertion in
  `tests/unit/recipe-seed-readonly.test.ts`); payments, auth, scan/OCR, inventory, `packages/ai`, `.github`,
  `public/_headers`, `wrangler*.jsonc`, `scripts/release-check.mjs`, `pnpm-lock.yaml` untouched.
- Ready integrity: `promoteRecipeMediaVersion(db, images, recipeId, role, version)` is the only path to
  `ready`; it verifies object existence, exact MIME, exact size and SHA-256 of the actual bytes; the proof
  type is module-private; no `markReady`-style export exists.
- Storage key: SQL `CHECK` equals `buildRecipeMediaStorageKey`; `v2.foo.webp`, `v2..webp`, `v2.extra.webp`,
  `v02.webp`, `v2.jpeg` rejected (schema tests).

## Post-merge main certification (exact `3a1e6be6…`, fresh sandbox run)

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm recipe:seed:check` | 3× ok (0006, 0034, 0035) |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm check:migrations` | `migration-smoke=ok` (fresh replay 0001→0035, 0034→0035 upgrade, idempotent re-read) |
| `pnpm build` | exit 0 |
| `pnpm test` | **161 files / 3776 tests passed** (equals the reviewed T14C baseline) |
| `git diff --check` | clean; working tree clean |
| Hosted CI `validate` on `3a1e6be6` | SUCCESS (run 35147336385, check 104966628291) |

## Automatic staging deployment (workflow_run from main CI)

```text
STAGING_DEPLOY_RUN=35147682739 (Deploy #16, event=workflow_run, head=3a1e6be6…)
  release=SUCCESS · staging=SUCCESS (Build, exact-head recheck, Deploy to Cloudflare staging,
  "Staging post-deploy smoke and SHA receipt" all SUCCESS) · production=SKIPPED (dispatch-only)
```

Staging uses its own D1 (`frigo-db-staging-v3`) and R2 bucket; nothing in production was touched.

## Production rollout — NOT executed in this session

```text
production_D1=frigo-db (f975ec39-b2c8-4a2a-80e1-0366054599d3, binding DB — from wrangler.jsonc)
production_ledger_read=NOT_PERFORMED     (`wrangler whoami` → not authenticated; no CLOUDFLARE_API_TOKEN in the sandbox)
backup=NOT_CREATED
0035_applied=NO
production_deploy=NO                     (production job is workflow_dispatch + confirm_production + environment approval only)
production_app_observed=commit 4ed98514… (GET /api/v1/health/ready, read-only, 2026-09-16T20:36Z; database ok;
                                          pre-existing CONFIG_PLUS_GRANT_SECRET_MISSING warning)
```

The packet's stop condition "Cloudflare account/D1 identity cannot be proven" applies. No raw SQL, no
handcrafted patch, no bypass was attempted.

## Operator runbook for the remaining steps (strict order; see `T14C_RECIPE_MEDIA_LAYER.md` §9)

1. `pnpm wrangler whoami` — confirm account `ef250a88…` and `wrangler d1 info frigo-db` →
   `f975ec39-b2c8-4a2a-80e1-0366054599d3`.
2. Ledger pre-state: `SELECT name FROM d1_migrations ORDER BY name` → 34 rows, tip
   `0034_global_recipe_catalog_parity.sql`, no 0035/0036. If 0035 is already present, switch to
   certification only (do not re-apply).
3. Backup: `pnpm wrangler d1 export frigo-db --remote --output <path>`; record path, size, SHA-256, timestamp.
4. Aggregate baseline (counts only): users, households, inventory_items/lots/events/commands, meal_plans,
   cooked_meals, scans, recipes (71), recipe_ingredients (385), recipe_steps (341), recipe_runtime_fields (71),
   recipe_runtime_ingredient_order (385).
5. Plan: `pnpm wrangler d1 migrations list frigo-db --remote` must show exactly `0035_recipe_media_layer.sql`.
6. Apply: `pnpm wrangler d1 migrations apply frigo-db --remote`.
7. Verify: ledger 35 rows / tip 0035; `recipe_media` rows=71, hero=71, thumbnail=0, pending=71, ready=0,
   rejected=0, superseded=0; every recipe has exactly one `hero/v1/pending`; `PRAGMA foreign_key_check` = [];
   `PRAGMA quick_check` = ok (`integrity_check` is SQLITE_AUTH-blocked on hosted D1 — document, do not treat as
   corruption); catalog still 71/59/12, 385/341/71/385; non-recipe aggregates unchanged;
   `bash scripts/d1-schema-gate.sh remote` = PASS (now requires 0035).
8. Deploy `3a1e6be610085d7f9cfed8a53f43ef6ea006ed5c` via `Deploy` workflow_dispatch: staging first (already
   green from run 35147682739), then `environment=production`, `ref=3a1e6be6…`, `hardened_sha=<approved>`,
   `confirm_production=true`, environment approval in GitHub UI. The pre-deploy schema gate blocks
   deployment until step 6 is done — never deploy before 0035.
9. Smoke: `/api/v1/health`, `/api/v1/health/ready` (commit 3a1e6be6…), `GET /recipes` 71/59/12 same order
   with `media.hero.source` all legacy (canonical_r2 = 0), `/api/v1/recipe-media/<id>/hero/1` → 409
   `RECIPE_MEDIA_PENDING`, recommendations/planner/inventory unchanged, auth/google/config + CORS preflight.
10. Then write `T14C_FINAL_COMPLETION.md` + `T14C_NEXT_HANDOFF.md`, mark `T14C_COMPLETE`, freeze the final
    canonical main.

## Authority and safety

```text
recipe_authority=ALL_RECIPES   d1_recipe_role=shadow/parity candidate   production_recipe_mode=static   d1_authority_mode_exists=NO
force_push=NO  history_rewrite=NO  0034_modified=NO  0036_created=NO  raw_prod_patch=NO
production_media_population=NO  production_ready_media_created=NO  recipe_authority_switch=NO
Inventory_Truth_change=NO  Qwen_change=NO  PayOS_change=NO  auth_OCR_change=NO  DNS_change=NO  CSP_change=NO
deploy_workflow_change=NO  T14D_started=NO  T14E_started=NO
```
