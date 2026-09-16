-- Migration 0035: Recipe Media Layer (T14C, ADR-025).
-- Rendered from @frigo/recipes ALL_RECIPES by renderRecipeMediaLayerSql; immutable once applied.
--
-- recipe_media holds versioned media METADATA per canonical recipe/role; bytes live in the R2
-- IMAGES bucket under the deterministic key recipes/<recipe-id>/<role>/v<version>.<ext> and are
-- served only through the same-origin /api/v1/recipe-media route after a trusted D1 lookup.
--
-- Invariants (fail-closed, enforced in SQL):
--   * version >= 1, role/status/source_type closed vocabularies, UNIQUE(recipe_id, role, version);
--   * at most ONE current ready version per (recipe_id, role) — partial unique index;
--   * a ready row must carry storage_key, mime_type (allow-listed raster only), width/height > 0,
--     content_length >= 0 and a 64-hex SHA-256 content_hash — the application only sets ready after
--     verifying the R2 object (existence, MIME, size and SHA-256 of the actual bytes);
--   * storage_key, when present, is EXACTLY the deterministic key the application derives:
--     recipes/<recipe_id>/<role>/v<version>.<webp|avif|jpg|png> selected by its own mime_type
--     (no "..", "\", leading "/", "?" or "#", no extra suffix, no alternate extension);
--   * ready storage keys are immutable and must never be overwritten with different bytes.
--
-- Seed: 71 truthful PENDING hero slots (no source, no bytes). Legacy imageUrl values
-- remain compatibility fallbacks in application code; they are NOT canonical R2-ready media.
-- No historical migration, recipe row, inventory table or user data is modified.

CREATE TABLE IF NOT EXISTS recipe_media (
  id TEXT PRIMARY KEY NOT NULL,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('hero', 'thumbnail')),
  version INTEGER NOT NULL CHECK (typeof(version) = 'integer' AND version >= 1),
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'rejected', 'superseded')),
  source_type TEXT CHECK (source_type IS NULL OR source_type IN ('legacy_static', 'legacy_external', 'generated', 'uploaded', 'derived')),
  storage_key TEXT CHECK (
    storage_key IS NULL OR (
      length(storage_key) > 0 AND instr(storage_key, '..') = 0 AND instr(storage_key, '\') = 0
      AND instr(storage_key, '?') = 0 AND instr(storage_key, '#') = 0 AND substr(storage_key, 1, 1) <> '/'
    )
  ),
  mime_type TEXT CHECK (mime_type IS NULL OR mime_type IN ('image/webp', 'image/avif', 'image/jpeg', 'image/png')),
  width INTEGER CHECK (width IS NULL OR (typeof(width) = 'integer' AND width > 0)),
  height INTEGER CHECK (height IS NULL OR (typeof(height) = 'integer' AND height > 0)),
  content_length INTEGER CHECK (content_length IS NULL OR (typeof(content_length) = 'integer' AND content_length >= 0)),
  content_hash TEXT CHECK (content_hash IS NULL OR (length(content_hash) = 64 AND content_hash NOT GLOB '*[^0-9a-f]*')),
  source_reference TEXT CHECK (source_reference IS NULL OR length(source_reference) > 0),
  generator_provider TEXT CHECK (generator_provider IS NULL OR length(generator_provider) > 0),
  generator_model TEXT CHECK (generator_model IS NULL OR length(generator_model) > 0),
  prompt_hash TEXT CHECK (prompt_hash IS NULL OR (length(prompt_hash) = 64 AND prompt_hash NOT GLOB '*[^0-9a-f]*')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (recipe_id, role, version),
  CHECK (
    status <> 'ready' OR (
      storage_key IS NOT NULL AND mime_type IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL
      AND content_length IS NOT NULL AND content_hash IS NOT NULL
    )
  ),
  CHECK (
    storage_key IS NULL OR (
      mime_type IS NOT NULL AND storage_key = 'recipes/' || recipe_id || '/' || role || '/v' || version || CASE mime_type
        WHEN 'image/webp' THEN '.webp' WHEN 'image/avif' THEN '.avif' WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png'
      END
    )
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_media_current_ready ON recipe_media(recipe_id, role) WHERE status = 'ready';
CREATE INDEX IF NOT EXISTS idx_recipe_media_recipe_role_status ON recipe_media(recipe_id, role, status);
CREATE INDEX IF NOT EXISTS idx_recipe_media_content_hash ON recipe_media(content_hash) WHERE content_hash IS NOT NULL;

-- Versions are immutable once ready: bytes behind v<N> never change; a replacement is a new row.
CREATE TRIGGER IF NOT EXISTS trg_recipe_media_ready_immutable_update
BEFORE UPDATE OF recipe_id, role, version, storage_key, mime_type, width, height, content_length, content_hash ON recipe_media
WHEN OLD.status = 'ready'
BEGIN
  SELECT RAISE(ABORT, 'recipe_media ready versions are immutable');
END;

INSERT INTO recipe_media (id, recipe_id, role, version, status) VALUES
('vn-canh-01_media_hero_v1', 'vn-canh-01', 'hero', 1, 'pending'),
('vn-canh-02_media_hero_v1', 'vn-canh-02', 'hero', 1, 'pending'),
('vn-canh-03_media_hero_v1', 'vn-canh-03', 'hero', 1, 'pending'),
('vn-canh-04_media_hero_v1', 'vn-canh-04', 'hero', 1, 'pending'),
('vn-canh-05_media_hero_v1', 'vn-canh-05', 'hero', 1, 'pending'),
('vn-canh-06_media_hero_v1', 'vn-canh-06', 'hero', 1, 'pending'),
('vn-kho-01_media_hero_v1', 'vn-kho-01', 'hero', 1, 'pending'),
('vn-kho-02_media_hero_v1', 'vn-kho-02', 'hero', 1, 'pending'),
('vn-kho-03_media_hero_v1', 'vn-kho-03', 'hero', 1, 'pending'),
('vn-kho-04_media_hero_v1', 'vn-kho-04', 'hero', 1, 'pending'),
('vn-kho-05_media_hero_v1', 'vn-kho-05', 'hero', 1, 'pending'),
('vn-kho-06_media_hero_v1', 'vn-kho-06', 'hero', 1, 'pending'),
('vn-xao-01_media_hero_v1', 'vn-xao-01', 'hero', 1, 'pending'),
('vn-xao-02_media_hero_v1', 'vn-xao-02', 'hero', 1, 'pending'),
('vn-xao-03_media_hero_v1', 'vn-xao-03', 'hero', 1, 'pending'),
('vn-xao-04_media_hero_v1', 'vn-xao-04', 'hero', 1, 'pending'),
('vn-xao-05_media_hero_v1', 'vn-xao-05', 'hero', 1, 'pending'),
('vn-xao-06_media_hero_v1', 'vn-xao-06', 'hero', 1, 'pending'),
('vn-chien-01_media_hero_v1', 'vn-chien-01', 'hero', 1, 'pending'),
('vn-chien-02_media_hero_v1', 'vn-chien-02', 'hero', 1, 'pending'),
('vn-chien-03_media_hero_v1', 'vn-chien-03', 'hero', 1, 'pending'),
('vn-chien-04_media_hero_v1', 'vn-chien-04', 'hero', 1, 'pending'),
('vn-chien-05_media_hero_v1', 'vn-chien-05', 'hero', 1, 'pending'),
('vn-chien-06_media_hero_v1', 'vn-chien-06', 'hero', 1, 'pending'),
('vn-hap-01_media_hero_v1', 'vn-hap-01', 'hero', 1, 'pending'),
('vn-hap-02_media_hero_v1', 'vn-hap-02', 'hero', 1, 'pending'),
('vn-hap-03_media_hero_v1', 'vn-hap-03', 'hero', 1, 'pending'),
('vn-hap-04_media_hero_v1', 'vn-hap-04', 'hero', 1, 'pending'),
('vn-hap-05_media_hero_v1', 'vn-hap-05', 'hero', 1, 'pending'),
('vn-hap-06_media_hero_v1', 'vn-hap-06', 'hero', 1, 'pending'),
('vn-cuon-01_media_hero_v1', 'vn-cuon-01', 'hero', 1, 'pending'),
('vn-cuon-02_media_hero_v1', 'vn-cuon-02', 'hero', 1, 'pending'),
('vn-cuon-03_media_hero_v1', 'vn-cuon-03', 'hero', 1, 'pending'),
('vn-cuon-04_media_hero_v1', 'vn-cuon-04', 'hero', 1, 'pending'),
('vn-cuon-05_media_hero_v1', 'vn-cuon-05', 'hero', 1, 'pending'),
('vn-cuon-06_media_hero_v1', 'vn-cuon-06', 'hero', 1, 'pending'),
('vn-bun-01_media_hero_v1', 'vn-bun-01', 'hero', 1, 'pending'),
('vn-bun-02_media_hero_v1', 'vn-bun-02', 'hero', 1, 'pending'),
('vn-bun-03_media_hero_v1', 'vn-bun-03', 'hero', 1, 'pending'),
('vn-bun-04_media_hero_v1', 'vn-bun-04', 'hero', 1, 'pending'),
('vn-bun-05_media_hero_v1', 'vn-bun-05', 'hero', 1, 'pending'),
('vn-bun-06_media_hero_v1', 'vn-bun-06', 'hero', 1, 'pending'),
('vn-chay-01_media_hero_v1', 'vn-chay-01', 'hero', 1, 'pending'),
('vn-chay-02_media_hero_v1', 'vn-chay-02', 'hero', 1, 'pending'),
('vn-chay-03_media_hero_v1', 'vn-chay-03', 'hero', 1, 'pending'),
('vn-chay-04_media_hero_v1', 'vn-chay-04', 'hero', 1, 'pending'),
('vn-chay-05_media_hero_v1', 'vn-chay-05', 'hero', 1, 'pending'),
('vn-chay-06_media_hero_v1', 'vn-chay-06', 'hero', 1, 'pending'),
('vn-sang-01_media_hero_v1', 'vn-sang-01', 'hero', 1, 'pending'),
('vn-sang-02_media_hero_v1', 'vn-sang-02', 'hero', 1, 'pending'),
('vn-sang-03_media_hero_v1', 'vn-sang-03', 'hero', 1, 'pending'),
('vn-sang-04_media_hero_v1', 'vn-sang-04', 'hero', 1, 'pending'),
('vn-sang-05_media_hero_v1', 'vn-sang-05', 'hero', 1, 'pending'),
('vn-sang-06_media_hero_v1', 'vn-sang-06', 'hero', 1, 'pending'),
('vn-lau-01_media_hero_v1', 'vn-lau-01', 'hero', 1, 'pending'),
('vn-lau-02_media_hero_v1', 'vn-lau-02', 'hero', 1, 'pending'),
('vn-lau-03_media_hero_v1', 'vn-lau-03', 'hero', 1, 'pending'),
('vn-lau-04_media_hero_v1', 'vn-lau-04', 'hero', 1, 'pending'),
('vn-lau-05_media_hero_v1', 'vn-lau-05', 'hero', 1, 'pending'),
('gl-01_media_hero_v1', 'gl-01', 'hero', 1, 'pending'),
('gl-02_media_hero_v1', 'gl-02', 'hero', 1, 'pending'),
('gl-03_media_hero_v1', 'gl-03', 'hero', 1, 'pending'),
('gl-04_media_hero_v1', 'gl-04', 'hero', 1, 'pending'),
('gl-05_media_hero_v1', 'gl-05', 'hero', 1, 'pending'),
('gl-06_media_hero_v1', 'gl-06', 'hero', 1, 'pending'),
('gl-07_media_hero_v1', 'gl-07', 'hero', 1, 'pending'),
('gl-08_media_hero_v1', 'gl-08', 'hero', 1, 'pending'),
('gl-09_media_hero_v1', 'gl-09', 'hero', 1, 'pending'),
('gl-10_media_hero_v1', 'gl-10', 'hero', 1, 'pending'),
('gl-11_media_hero_v1', 'gl-11', 'hero', 1, 'pending'),
('gl-12_media_hero_v1', 'gl-12', 'hero', 1, 'pending')
ON CONFLICT(id) DO NOTHING;
