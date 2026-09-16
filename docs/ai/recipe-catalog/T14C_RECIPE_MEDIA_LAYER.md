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
| `storage_key` | NULL or EXACTLY `'recipes/' \|\| recipe_id \|\| '/' \|\| role \|\| '/v' \|\| version \|\| CASE mime_type … END` (`.webp`/`.avif`/`.jpg`/`.png`); requires `mime_type`; also no `..`, `\`, `/`-leading, `?`, `#` |
| `mime_type` | NULL \| `image/webp` \| `image/avif` \| `image/jpeg` \| `image/png` |
| `width`, `height` | NULL or integer > 0 |
| `content_length` | NULL or integer >= 0; NOT NULL when ready |
| `content_hash`, `prompt_hash` | NULL or 64 lowercase hex (SHA-256) |
| `source_reference`, `generator_provider`, `generator_model` | NULL or non-empty |
| `created_at`, `updated_at` | ISO text defaults |

Constraints: `UNIQUE(recipe_id, role, version)`; ready invariant (`status<>'ready' OR storage_key, mime_type,
width, height, content_length, content_hash NOT NULL`); exact-key CHECK (SQL derives the same key as
`buildRecipeMediaStorageKey`, so `recipes/gl-01/hero/v2.foo.webp`, `v2..webp`, `v2.jpeg` etc. are rejected
by the database, not only by the application); partial unique `idx_recipe_media_current_ready(recipe_id,
role) WHERE status='ready'`; `idx_recipe_media_recipe_role_status`; `idx_recipe_media_content_hash` (dedupe
lookups); trigger `trg_recipe_media_ready_immutable_update` (byte-identity columns frozen once ready).
`auditReadyRecipeMediaRecord()` mirrors the same core invariants (tested for parity, including
`missing_content_length` and `untrusted_storage_key`).

State machine: `pending → ready` (verified promotion only, §3a) · `pending → rejected` ·
`ready → superseded` (when a newer version is promoted, same batch). No other transitions are used.

### 3a. Verified promotion contract (independent-review remediation P1)

```text
ready = metadata valid
        AND canonical R2 object exists at the D1-derived key
        AND object.httpMetadata.contentType == mime_type   (absent MIME fails)
        AND object.size == content_length
        AND SHA-256(actual object bytes) == content_hash    (lowercase hex)
```

`promoteRecipeMediaVersion(db, images, recipeId, role, version)` (`packages/db/src/recipe-media.ts`)
is the only path to `ready`. It reads the pending row, runs the internal `verifyRecipeMediaObject`
(metadata audit → exact key re-derivation → `IMAGES.get(storage_key)` → MIME → size → single bounded
`arrayBuffer()` read, ≤ `RECIPE_MEDIA_MAX_VERIFY_BYTES` = 16 MiB → `crypto.subtle.digest('SHA-256')`)
and only then runs the D1 batch. The verification result is a module-private class, so no caller can
mark `ready` without it and there is no generic `markReady`. Failures are typed and distinct:
`METADATA_INCOMPLETE`, `OBJECT_MISSING`, `OBJECT_MIME_MISMATCH`, `OBJECT_SIZE_MISMATCH`,
`OBJECT_HASH_MISMATCH`, `OBJECT_TOO_LARGE`, `OBJECT_READ_FAILED`; any failure leaves the target
`pending` and the existing ready version untouched (tested for every class).

Atomicity: `old ready → superseded` and `target pending → ready` are one `db.batch`; both statements
are guarded by the same predicate (`id`, `status='pending'`, verified `storage_key`/`mime_type`/
`content_length`/`content_hash`), so a row re-staged between verification and the batch produces a
no-op batch and `READY_CONFLICT`, never a half transition. Batch `success` and `meta.changes = 1` are
checked explicitly; the partial unique index remains the final DB fence against two ready rows.

Hashing happens once, at promotion. The public GET route never hashes bytes; it trusts ready metadata
and streams the object. **`ETag: "<content_hash>"` is trustworthy precisely because the hash was
verified against the actual R2 bytes at the promotion boundary.**

R2 overwrite policy: **a ready storage key must never be overwritten with different bytes.** Future
population/import tooling must use `new bytes ⇒ new version ⇒ new key` (`stageRecipeMediaVersion` with
`version + 1`), never `IMAGES.put` onto an existing `…/vN.<ext>`.

Seed: 71 rows, one `hero` `v1` `pending` per canonical recipe, `source_type=NULL`, no key/bytes.
Rendered by `renderRecipeMediaLayerSql(ALL_RECIPES)`; `pnpm recipe:seed:check` proves the committed
file equals the render (0006, 0034, 0035).

## 4. Storage key, versioning, caching

- Key: `recipes/<recipe-id>/<role>/v<version>.<webp|avif|jpg|png>` (`buildRecipeMediaStorageKey`);
  recipe id shape `^[a-z0-9]+(-[a-z0-9]+)*$` (≤64), version `1..1_000_000` strict integer.
- The route trusts a key only if it equals the derivation for that row (`isTrustedRecipeMediaStorageKey`).
- New bytes ⇒ new version (`stageRecipeMediaVersion` → `promoteRecipeMediaVersion(db, images, …)`, which
  verifies the object itself — §3a). Never overwrite `…/vN.<ext>`.
- Versioned URL `/api/v1/recipe-media/<id>/<role>/<n>`: `Cache-Control: public, max-age=31536000, immutable`,
  `ETag: "<content_hash>"`, `304` on `If-None-Match`, `HEAD` supported with the same rules.
  Error responses are `no-store`. Legacy/unversioned URLs are never marked immutable by this layer.

## 5. Serving route security

Order of checks: raw-path encoded traversal (`%2e`, `%2f`, `%5c`, `%25`, `..`, `\`) → recipe id shape →
role → strict version → D1 row exists → `status='ready'` → metadata audit (key/mime/dimensions/hash/length)
→ trusted-key equality → `IMAGES.get(row.storage_key)` → object MIME equals row MIME (415 otherwise) →
object size equals `content_length` (409 otherwise). The route does not re-hash bytes per request
(that is the promotion boundary's job, §3a); it is a cheap defence-in-depth guard over trusted metadata. Status classes: 404 (invalid/unknown/
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

Focused: `tests/integration/recipe-media-schema.test.ts` (13), `recipe-media-catalog.test.ts` (24),
`recipe-media-route.test.ts` (27), `tests/unit/recipe-media-presentation.test.ts` (8). Gates:
`recipe:seed:check` (3 ok), `check:migrations` (`migration-smoke=ok` incl. 0034→0035 + idempotent re-read),
typecheck, lint, build, full Vitest, `git diff --check`.

Independent-review remediation tests (all against the realistic in-memory R2 double
`tests/helpers/recipe-media-r2.ts` — `put/get/size/httpMetadata.contentType/body/arrayBuffer`, real
SHA-256 over real fixture bytes; verification is never mocked to true):

```text
promote_without_object          = PASS (OBJECT_MISSING; pending kept)
promote_wrong_mime              = PASS (OBJECT_MIME_MISMATCH; absent MIME also refused)
promote_wrong_size              = PASS (OBJECT_SIZE_MISMATCH)
promote_wrong_hash_same_size    = PASS (OBJECT_HASH_MISMATCH; equal length, equal MIME)
verified_object_promotion       = PASS (target ready, old superseded, exactly one ready)
failed_new_version_keeps_old_ready = PASS (v1 ready / v2 pending for all 5 failure classes)
object_too_large                = PASS (refused before any R2 read)
re-staged_between_verify_and_batch = PASS (READY_CONFLICT; no half transition)
concurrent_promotions           = PASS (exactly one ready row)
noncanonical_SQL_storage_suffix = PASS (13 keys rejected by SQL and by isTrustedRecipeMediaStorageKey)
SQL/app exact-key parity        = PASS (webp/avif/jpg/png; no alternate .jpeg)
ready_missing_content_length    = PASS (SQL CHECK; pending NULL allowed)
SQL/app ready-invariant parity  = PASS (15 states agree)
```

## 11. Deferred / follow-ups

- Media population (all 71 hero assets) — separate task; the 12 global recipes also need prompts.
- `thumbnail` role is modelled but unseeded.
- `KNOWN_OPS_P2_STAGING_SHA_PROPAGATION_RACE` (Deploy run 35104161981) — OPS, not T14C.
- Wrangler 4 upgrade — dependency/OPS scope. `CONFIG_PLUS_GRANT_SECRET_MISSING` — pre-existing.
