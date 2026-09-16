# T14C — Recipe Media Layer (design, audit, evidence)

```text
repository_id=1368281478   repo=vn-taphoanhatung/Frigo-dev
T14C_CANONICAL_BASE_MAIN=8d3ebc444bbaa577893dd88a9d21f308a24f0cf5
branch=feat/t14c-recipe-media-layer
migration=0035_recipe_media_layer.sql (only T14C migration; 0034 pinned/immutable; no 0036)
recipe_authority=ALL_RECIPES (unchanged)   RECIPE_CATALOG_MODE: static|shadow (no d1)
production: D1 tip 0034, Worker 56979cb5-… (4ed98514…) — NOT touched by T14C
```

## 1. Media truth audit (current source, executed on this branch)

```text
total_recipes=71
unique_image_refs=45
same_origin_refs=12        (/frigo/recipes/global/*.webp, all gl-*)
external_refs=59           (all images.unsplash.com; blocked by production CSP img-src)
local_assets_found=12      (public/frigo/recipes/{global,vietnam}/*.webp)
missing_assets=1           (gl-11 → /frigo/recipes/global/carbonara.webp does not exist)
duplicate_refs=20          (15 external URLs shared by 2–4 recipes; gl-05/07/08 share kimchi-fried-rice,
                            gl-04/09 share oyakodon, gl-06/10 share pad-krapow, gl-12 uses vietnam/dau-phu-sot-ca-chua)
prompt_entries=59          (scripts/generate-recipe-images.ts; ids/slugs 1:1 with vn-*; unique target filenames)
prompt_coverage=59/71      (0/12 global; reported, not fabricated)
```

Public assets (`public/frigo/recipes/**`, 12 files, 52–69 KB webp each) are `legacy_static` until
imported through an approved media workflow; they are NOT R2 canonical media. Referenced by recipes:
6 global + `vietnam/dau-phu-sot-ca-chua.webp`; the other 5 Vietnamese files are unreferenced by any
`imageUrl` (RecipeCard's placeholder uses `vietnam/thit-kho-trung.webp`).

## 2. Architecture

```text
ALL_RECIPES (content authority, order, ranking inputs)
   │ stable recipe id
   ▼
recipe_media (D1, 0035) ── RecipeMediaCatalog (D1RecipeMediaCatalog: bulk IN-chunks, batch)
   │                                 │
   ▼                                 ▼
RecipeMediaResolver (pure) ──► media.hero presentation (additive; imageUrl kept)
   │ canonical ready?
   ▼
GET /api/v1/recipe-media/:recipeId/:role/:version ──► IMAGES.get(<D1-trusted derived key>)
   │ immutable cache + ETag(content_hash)
   ▼
src/web/lib/recipe-media.ts resolveRecipeImage ──► <img src fallbackSrc onError(once)>
```

Invariants: media never influences eligibility/score/tie/order (enrichment runs after `rankRecipes` and
after list filtering); no generation/fetch during requests; no arbitrary R2 key; no external proxy;
no public write route; `Recipe.imageUrl` remains.

## 3. Schema (`recipe_media`)

| column | type / constraint |
| --- | --- |
| `id` | TEXT PK (`<recipe>_media_<role>_v<version>`) |
| `recipe_id` | TEXT NOT NULL → `recipes(id)` ON DELETE CASCADE |
| `role` | `hero` \| `thumbnail` |
| `version` | INTEGER, `typeof='integer' AND >= 1` |
| `status` | `pending` \| `ready` \| `rejected` \| `superseded` |
| `source_type` | NULL \| `legacy_static` \| `legacy_external` \| `generated` \| `uploaded` \| `derived` |
| `storage_key` | NULL or safe key prefixed `recipes/<recipe_id>/<role>/v<version>.` (no `..`, `\`, `/`-leading, `?`, `#`) |
| `mime_type` | NULL \| `image/webp` \| `image/avif` \| `image/jpeg` \| `image/png`; extension must match |
| `width`, `height` | NULL or integer > 0 |
| `content_length` | NULL or integer >= 0 |
| `content_hash`, `prompt_hash` | NULL or 64 lowercase hex (SHA-256) |
| `source_reference`, `generator_provider`, `generator_model` | NULL or non-empty |
| `created_at`, `updated_at` | ISO text defaults |

Constraints: `UNIQUE(recipe_id, role, version)`; ready invariant (`status<>'ready' OR storage_key, mime_type,
width, height, content_hash NOT NULL`); partial unique `idx_recipe_media_current_ready(recipe_id, role) WHERE
status='ready'`; `idx_recipe_media_recipe_role_status`; `idx_recipe_media_content_hash` (dedupe lookups);
trigger `trg_recipe_media_ready_immutable_update` (byte-identity columns frozen once ready).

State machine: `pending → ready` (promote, only with complete verified metadata) · `pending → rejected` ·
`ready → superseded` (when a newer version is promoted, same batch). No other transitions are used.

Seed: 71 rows, one `hero` `v1` `pending` per canonical recipe, `source_type=NULL`, no key/bytes.
Rendered by `renderRecipeMediaLayerSql(ALL_RECIPES)`; `pnpm recipe:seed:check` proves the committed
file equals the render (0006, 0034, 0035).

## 4. Storage key, versioning, caching

- Key: `recipes/<recipe-id>/<role>/v<version>.<webp|avif|jpg|png>` (`buildRecipeMediaStorageKey`);
  recipe id shape `^[a-z0-9]+(-[a-z0-9]+)*$` (≤64), version `1..1_000_000` strict integer.
- The route trusts a key only if it equals the derivation for that row (`isTrustedRecipeMediaStorageKey`).
- New bytes ⇒ new version (`stageRecipeMediaVersion` → verify object → `promoteRecipeMediaVersion`).
  Never overwrite `…/vN.<ext>`.
- Versioned URL `/api/v1/recipe-media/<id>/<role>/<n>`: `Cache-Control: public, max-age=31536000, immutable`,
  `ETag: "<content_hash>"`, `304` on `If-None-Match`, `HEAD` supported with the same rules.
  Error responses are `no-store`. Legacy/unversioned URLs are never marked immutable by this layer.

## 5. Serving route security

Order of checks: raw-path encoded traversal (`%2e`, `%2f`, `%5c`, `%25`, `..`, `\`) → recipe id shape →
role → strict version → D1 row exists → `status='ready'` → metadata audit (key/mime/dimensions/hash/length)
→ trusted-key equality → `IMAGES.get(row.storage_key)` → object MIME equals row MIME (415 otherwise) →
object size equals `content_length` when recorded (409 otherwise). Status classes: 404 (invalid/unknown/
object missing), 409 (pending/rejected/superseded/metadata invalid), 415 (MIME), 503 (no DB/IMAGES or
D1 failure). Diagnostics are structured, bounded (20/min/isolate) and never include bytes, keys or URLs.

## 6. API presentation

`GET /recipes`, `GET /recipes/:id`, `GET /recommendations` add per recipe:

```json
"media": { "hero": { "url": "/api/v1/recipe-media/gl-01/hero/2", "source": "canonical_r2", "version": 2, "width": 1200, "height": 800 } }
```

`source ∈ canonical_r2 | legacy_static | legacy_external | missing`; for the last three `version/width/height`
are `null` and `url` is the legacy `imageUrl` (or `null`). Nothing else from `recipe_media` is exposed.
On D1 media failure the response is identical except every `source` is legacy, plus one
`recipe_media_read_failed` diagnostic.

## 7. Frontend

`resolveRecipeImage(recipe, placeholder?)` → `{src, fallbackSrc, source, width, height, aspectRatio}` and
`recipeImageErrorHandler(fallbackSrc)` (single-step, loop-free). Applied to: `RecipeCard` (both variants),
`RecipeDetailPage`, `MealDetailPage`, `IngredientDetailPage`, `HomePage` (brand symbol as placeholder),
`MealSwapSheet`, `MealCard`. No layout/colour/typography changes. `private-image.ts` untouched.

## 8. Scale

Bulk read = `ceil(n/90)` `IN (...)` statements in one `db.batch` (5,000 ids → 56 statements, tested),
indexed by `(recipe_id, role, status)`; no bucket listing, no table scan, no per-recipe query, no bytes
or JSON blobs in D1.

## 9. Rollout plan (documented, NOT executed)

```text
production D1 = 0034  →  backup (d1 export)  →  pnpm wrangler d1 migrations apply frigo-db --remote (0035 only)
→ verify: 35 rows, recipe_media=71 pending, FK/quick_check ok, schema gate PASS
→ deploy T14C application through deploy.yml (exact SHA, hardened SHA, production approval)
→ smoke: /recipes 71/59/12 same order, media.hero sources 12 legacy_static + 59 legacy_external
→ populate canonical media in a SEPARATE reviewed task (generate/import → validate → hash → upload → promote)
```

Legacy fallback means the layer can ship before any image is populated.

## 10. Verification (this branch — see HANDOFF for exact counts)

Focused: `tests/integration/recipe-media-schema.test.ts` (10), `recipe-media-catalog.test.ts` (16),
`recipe-media-route.test.ts` (27), `tests/unit/recipe-media-presentation.test.ts` (8). Gates:
`recipe:seed:check` (3 ok), `check:migrations` (`migration-smoke=ok` incl. 0034→0035 + idempotent re-read),
typecheck, lint, build, full Vitest, `git diff --check`.

## 11. Deferred / follow-ups

- Media population (all 71 hero assets) — separate task; the 12 global recipes also need prompts.
- `thumbnail` role is modelled but unseeded.
- `KNOWN_OPS_P2_STAGING_SHA_PROPAGATION_RACE` (Deploy run 35104161981) — OPS, not T14C.
- Wrangler 4 upgrade — dependency/OPS scope. `CONFIG_PLUS_GRANT_SECRET_MISSING` — pre-existing.
