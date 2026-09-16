# T14C handoff — recipe media layer (docs-only; implementation NOT started)

```text
T14B_B_STATUS=T14B_B_COMPLETE            (see T14B_B_FINAL_COMPLETION.md)
T14C_STATUS=READY_TO_START               (no T14C code, migration, or config exists)
T14C_CANONICAL_BASE_MAIN=<frozen after this docs PR merges; recorded in the PR's post-merge comment and CURRENT_STATE.md>
PRE_DOCS_MAIN=4ed98514f65ddd3b3d83007cd726fd7c2e2136e6
RECOMMENDED_BRANCH=feat/t14c-recipe-media-layer
```

## Production truth at handoff

- Worker version `56979cb5-e1a8-4241-8a4c-2432d41cc439` serves `https://frigo.tungjpstore.net` at 100%,
  built from `4ed98514…` (Deploy run 35102115354).
- Production D1 `frigo-db` (`f975ec39-b2c8-4a2a-80e1-0366054599d3`) ledger tip = `0034_global_recipe_catalog_parity.sql`
  (34 rows). Catalog: 71 recipes (59 VN + 12 global), 385 ingredients, 341 steps, 71 runtime-field rows,
  385 ingredient ordinals; drift zero vs static.
- Recipe authority remains **static `ALL_RECIPES`**; `RECIPE_CATALOG_MODE` unset (= `static`); `shadow`
  is opt-in and not enabled in production; no `d1` authority mode exists.
- Pre-0034 backup SHA-256 `ab082dd4f8a73062f6678d9e46406a7914d14012b609cb45891515862280343c` (sandbox-local
  export; operator should copy to durable storage if retention is required).

## Deferred to T14C (from T14B-B)

`MEDIA_DEFERRED_TO_T14C` — `recipes.image_url` is a verbatim mirror of the static reference
(`LEGACY_MEDIA_COMPATIBILITY_ONLY`). Known issues recorded in `T14B_B_D1_PARITY_SHADOW.md` §"media":
blocked Unsplash hosts under the production CSP/`public/_headers`, duplicate images across recipes, and
no media authority/ownership model. T14C must define the media authority (R2 `IMAGES` bucket
`frigo-images` is bound but unused for recipes), CSP-compatible hosting, dedupe, and a migration path
that keeps `hydrateRuntimeRecipes` fail-closed semantics (`NULL`/empty image fails closed today).

## Constraints carried forward

- Do not change runtime ordering (`runtime_order`), ingredient ordinals, ranking/planner/swap, Inventory
  Truth (T09/T11), Qwen runtime, PayOS, auth/OCR, DNS.
- Any new migration is `0035_*`; never edit `0034`. Keep `tests/fixtures/migration-sha256.json` pinned.
- Follow `AGENT_RULES.md` gates (`pnpm check`), `DEPLOYMENT.md` release path (exact SHA + hardened SHA
  + production environment approval). GitHub environments `staging`/`production` now hold
  `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`; `STAGING_URL`/`PRODUCTION_URL` repo variables exist.

## First actions for the T14C agent

1. `git fetch origin main`; confirm `origin/main` equals `T14C_CANONICAL_BASE_MAIN` recorded in
   `CURRENT_STATE.md`; branch `feat/t14c-recipe-media-layer` from it.
2. Read `T14B_B_D1_PARITY_SHADOW.md` (media section), ADR-024, `public/_headers` CSP, `wrangler.jsonc` R2 binding.
3. Write the T14C task packet / ADR before any code.
