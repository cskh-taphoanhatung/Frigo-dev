/**
 * T14C — Recipe Media Layer domain contracts (ADR-025).
 *
 * Media metadata lives in D1 (`recipe_media`), bytes live in the existing R2 `IMAGES` bucket, and
 * the browser only ever sees a same-origin versioned URL. Media never influences recipe content
 * authority (`ALL_RECIPES`), ranking, planning, swaps or cooking; it is resolved after those decisions.
 */
import type { Recipe } from './types';

export const RECIPE_MEDIA_MIGRATION_FILENAME = '0035_recipe_media_layer.sql';
export const RECIPE_MEDIA_TABLE = 'recipe_media';

export const RECIPE_MEDIA_ROLES = ['hero', 'thumbnail'] as const;
export type RecipeMediaRole = (typeof RECIPE_MEDIA_ROLES)[number];

/** `ready` means the canonical R2 object is serveable — never "a prompt/filename/URL exists". */
export const RECIPE_MEDIA_STATUSES = ['pending', 'ready', 'rejected', 'superseded'] as const;
export type RecipeMediaStatus = (typeof RECIPE_MEDIA_STATUSES)[number];

export const RECIPE_MEDIA_SOURCE_TYPES = ['legacy_static', 'legacy_external', 'generated', 'uploaded', 'derived'] as const;
export type RecipeMediaSourceType = (typeof RECIPE_MEDIA_SOURCE_TYPES)[number];

/** Only raster formats the app intentionally serves. SVG/HTML/JS/octet-stream are never accepted. */
export const RECIPE_MEDIA_ALLOWED_MIME_TYPES = ['image/webp', 'image/avif', 'image/jpeg', 'image/png'] as const;
export type RecipeMediaMimeType = (typeof RECIPE_MEDIA_ALLOWED_MIME_TYPES)[number];

const MIME_EXTENSION: Record<RecipeMediaMimeType, string> = {
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export const RECIPE_MEDIA_STORAGE_PREFIX = 'recipes/';
export const RECIPE_MEDIA_MAX_VERSION = 1_000_000;
/** Canonical recipe IDs are short slug-like tokens (`vn-canh-01`, `gl-12`). */
const RECIPE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

/** Typed projection of one `recipe_media` row. Never exposed directly to the public API. */
export interface RecipeMediaRecord {
  id: string;
  recipeId: string;
  role: RecipeMediaRole;
  version: number;
  status: RecipeMediaStatus;
  sourceType: RecipeMediaSourceType | null;
  storageKey: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  contentLength: number | null;
  contentHash: string | null;
  sourceReference: string | null;
  generatorProvider: string | null;
  generatorModel: string | null;
  promptHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RecipeMediaResolutionSource = 'canonical_r2' | 'legacy_static' | 'legacy_external' | 'missing';

/** Public, additive presentation of one media role. No storage keys, prompts or internals. */
export interface RecipeMediaPresentation {
  url: string | null;
  source: RecipeMediaResolutionSource;
  version: number | null;
  width: number | null;
  height: number | null;
}

export interface RecipeMediaPresentationSet {
  hero: RecipeMediaPresentation;
}

export function isRecipeMediaRole(value: unknown): value is RecipeMediaRole {
  return typeof value === 'string' && (RECIPE_MEDIA_ROLES as readonly string[]).includes(value);
}

export function isRecipeMediaMimeType(value: unknown): value is RecipeMediaMimeType {
  return typeof value === 'string' && (RECIPE_MEDIA_ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

export function isCanonicalRecipeIdShape(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64 && RECIPE_ID_PATTERN.test(value);
}

/** Strict positive integer parse: rejects "0", "-1", "1e3", "01", "1.0", whitespace and huge values. */
export function parseRecipeMediaVersion(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 1 && value <= RECIPE_MEDIA_MAX_VERSION ? value : null;
  }
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,6}$/.test(value)) return null;
  const parsed = Number(value);
  return parsed <= RECIPE_MEDIA_MAX_VERSION ? parsed : null;
}

export function extensionForMimeType(mimeType: RecipeMediaMimeType): string {
  return MIME_EXTENSION[mimeType];
}

/**
 * Deterministic, versioned R2 key: `recipes/<recipe-id>/<role>/v<version>.<ext>`.
 * Every component is validated, so no caller-supplied string can reach `IMAGES.get` unchanged.
 */
export function buildRecipeMediaStorageKey(recipeId: string, role: RecipeMediaRole, version: number, mimeType: RecipeMediaMimeType): string {
  if (!isCanonicalRecipeIdShape(recipeId)) throw new Error('Invalid recipe ID for storage key');
  if (!isRecipeMediaRole(role)) throw new Error('Invalid media role for storage key');
  if (parseRecipeMediaVersion(version) === null) throw new Error('Invalid media version for storage key');
  if (!isRecipeMediaMimeType(mimeType)) throw new Error('Unsupported MIME type for storage key');
  return `${RECIPE_MEDIA_STORAGE_PREFIX}${recipeId}/${role}/v${version}.${extensionForMimeType(mimeType)}`;
}

/** True only when the key is exactly what {@link buildRecipeMediaStorageKey} would derive for this row. */
export function isTrustedRecipeMediaStorageKey(
  storageKey: string,
  recipeId: string,
  role: RecipeMediaRole,
  version: number,
  mimeType: string,
): boolean {
  if (!isRecipeMediaMimeType(mimeType)) return false;
  try {
    return buildRecipeMediaStorageKey(recipeId, role, version, mimeType) === storageKey;
  } catch {
    return false;
  }
}

export function isSha256Hex(value: unknown): value is string {
  return typeof value === 'string' && SHA256_HEX_PATTERN.test(value);
}

/** Same-origin versioned URL. Immutable: bytes behind it never change; new bytes → new version. */
export function buildRecipeMediaUrl(recipeId: string, role: RecipeMediaRole, version: number): string {
  if (!isCanonicalRecipeIdShape(recipeId) || !isRecipeMediaRole(role) || parseRecipeMediaVersion(version) === null) {
    throw new Error('Cannot build media URL from invalid components');
  }
  return `/api/v1/recipe-media/${recipeId}/${role}/${version}`;
}

export type RecipeMediaReadinessIssue =
  | 'missing_storage_key'
  | 'untrusted_storage_key'
  | 'missing_mime_type'
  | 'unsupported_mime_type'
  | 'missing_dimensions'
  | 'invalid_dimensions'
  | 'missing_content_hash'
  | 'invalid_content_hash'
  | 'missing_content_length'
  | 'invalid_content_length';

/**
 * Application-side mirror of the SQL ready invariant (0035): storage_key equal to the exact
 * deterministic derivation, allow-listed MIME, width/height > 0, 64-hex SHA-256 and a known
 * content_length. Used by the resolver, the serving guard and the promotion boundary.
 */
export function auditReadyRecipeMediaRecord(record: RecipeMediaRecord): RecipeMediaReadinessIssue[] {
  const issues: RecipeMediaReadinessIssue[] = [];
  if (!record.storageKey) issues.push('missing_storage_key');
  if (!record.mimeType) issues.push('missing_mime_type');
  else if (!isRecipeMediaMimeType(record.mimeType)) issues.push('unsupported_mime_type');
  if (record.storageKey && record.mimeType && isRecipeMediaMimeType(record.mimeType)
    && !isTrustedRecipeMediaStorageKey(record.storageKey, record.recipeId, record.role, record.version, record.mimeType)) {
    issues.push('untrusted_storage_key');
  }
  if (record.width === null || record.height === null) issues.push('missing_dimensions');
  else if (!Number.isInteger(record.width) || !Number.isInteger(record.height) || record.width <= 0 || record.height <= 0) {
    issues.push('invalid_dimensions');
  }
  if (record.contentHash === null) issues.push('missing_content_hash');
  else if (!isSha256Hex(record.contentHash)) issues.push('invalid_content_hash');
  if (record.contentLength === null) issues.push('missing_content_length');
  else if (!Number.isInteger(record.contentLength) || record.contentLength < 0) issues.push('invalid_content_length');
  return issues;
}

export interface LegacyImageClassification {
  kind: 'legacy_static' | 'legacy_external' | 'missing';
  url: string | null;
}

/**
 * Classifies the compatibility `Recipe.imageUrl`. Same-origin means an absolute path under `/`
 * (no scheme, no protocol-relative `//host`). Anything else with an http(s) scheme is external.
 */
export function classifyLegacyImageUrl(imageUrl: string | null | undefined): LegacyImageClassification {
  if (typeof imageUrl !== 'string') return { kind: 'missing', url: null };
  const trimmed = imageUrl.trim();
  if (trimmed.length === 0) return { kind: 'missing', url: null };
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('..')) return { kind: 'legacy_static', url: trimmed };
  if (/^https:\/\/[^\s/]+\/.+/i.test(trimmed)) return { kind: 'legacy_external', url: trimmed };
  return { kind: 'missing', url: null };
}

/**
 * Pure resolver. Precedence: current ready canonical R2 media → audited same-origin legacy static →
 * legacy external imageUrl → missing. Never mutates ranking inputs and never touches R2.
 */
export function resolveRecipeMedia(
  recipe: Pick<Recipe, 'id' | 'imageUrl'>,
  role: RecipeMediaRole,
  records: readonly RecipeMediaRecord[],
): RecipeMediaPresentation {
  const ready = records
    .filter((record) => record.recipeId === recipe.id && record.role === role && record.status === 'ready')
    .sort((a, b) => b.version - a.version)
    .find((record) => auditReadyRecipeMediaRecord(record).length === 0);
  if (ready) {
    return {
      url: buildRecipeMediaUrl(ready.recipeId, ready.role, ready.version),
      source: 'canonical_r2',
      version: ready.version,
      width: ready.width,
      height: ready.height,
    };
  }
  const legacy = classifyLegacyImageUrl(recipe.imageUrl);
  return { url: legacy.url, source: legacy.kind, version: null, width: null, height: null };
}

export function presentRecipeMedia(
  recipe: Pick<Recipe, 'id' | 'imageUrl'>,
  records: readonly RecipeMediaRecord[],
): RecipeMediaPresentationSet {
  return { hero: resolveRecipeMedia(recipe, 'hero', records) };
}

/** One deterministic seed slot: every canonical recipe gets a truthful `pending` hero row. */
export interface RecipeMediaSeedRow {
  id: string;
  recipeId: string;
  role: RecipeMediaRole;
  version: 1;
  status: 'pending';
}

export function buildRecipeMediaSeedRows(recipes: readonly Pick<Recipe, 'id'>[]): RecipeMediaSeedRow[] {
  const seen = new Set<string>();
  const rows: RecipeMediaSeedRow[] = [];
  for (const recipe of recipes) {
    if (!isCanonicalRecipeIdShape(recipe.id)) throw new Error(`Recipe ID "${recipe.id}" is not a canonical media identity`);
    if (seen.has(recipe.id)) throw new Error(`Duplicate recipe ID ${recipe.id} in media seed`);
    seen.add(recipe.id);
    rows.push({ id: `${recipe.id}_media_hero_v1`, recipeId: recipe.id, role: 'hero', version: 1, status: 'pending' });
  }
  return rows;
}

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Renders the exact text of migration 0035. Pure, offline and deterministic: the committed file must
 * equal this render byte-for-byte (tested), so the 71 slots are never hand-maintained twice.
 */
export function renderRecipeMediaLayerSql(recipes: readonly Pick<Recipe, 'id'>[]): string {
  const rows = buildRecipeMediaSeedRows(recipes);
  const lines: string[] = [
    '-- Migration 0035: Recipe Media Layer (T14C, ADR-025).',
    '-- Rendered from @frigo/recipes ALL_RECIPES by renderRecipeMediaLayerSql; immutable once applied.',
    '--',
    '-- recipe_media holds versioned media METADATA per canonical recipe/role; bytes live in the R2',
    '-- IMAGES bucket under the deterministic key recipes/<recipe-id>/<role>/v<version>.<ext> and are',
    '-- served only through the same-origin /api/v1/recipe-media route after a trusted D1 lookup.',
    '--',
    '-- Invariants (fail-closed, enforced in SQL):',
    '--   * version >= 1, role/status/source_type closed vocabularies, UNIQUE(recipe_id, role, version);',
    '--   * at most ONE current ready version per (recipe_id, role) — partial unique index;',
    '--   * a ready row must carry storage_key, mime_type (allow-listed raster only), width/height > 0,',
    '--     content_length >= 0 and a 64-hex SHA-256 content_hash — the application only sets ready after',
    '--     verifying the R2 object (existence, MIME, size and SHA-256 of the actual bytes);',
    '--   * storage_key, when present, is EXACTLY the deterministic key the application derives:',
    '--     recipes/<recipe_id>/<role>/v<version>.<webp|avif|jpg|png> selected by its own mime_type',
    '--     (no "..", "\\", leading "/", "?" or "#", no extra suffix, no alternate extension);',
    '--   * ready storage keys are immutable and must never be overwritten with different bytes.',
    '--',
    `-- Seed: ${rows.length} truthful PENDING hero slots (no source, no bytes). Legacy imageUrl values`,
    '-- remain compatibility fallbacks in application code; they are NOT canonical R2-ready media.',
    '-- No historical migration, recipe row, inventory table or user data is modified.',
    '',
    'CREATE TABLE IF NOT EXISTS recipe_media (',
    '  id TEXT PRIMARY KEY NOT NULL,',
    '  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,',
    "  role TEXT NOT NULL CHECK (role IN ('hero', 'thumbnail')),",
    "  version INTEGER NOT NULL CHECK (typeof(version) = 'integer' AND version >= 1),",
    "  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'rejected', 'superseded')),",
    "  source_type TEXT CHECK (source_type IS NULL OR source_type IN ('legacy_static', 'legacy_external', 'generated', 'uploaded', 'derived')),",
    '  storage_key TEXT CHECK (',
    '    storage_key IS NULL OR (',
    "      length(storage_key) > 0 AND instr(storage_key, '..') = 0 AND instr(storage_key, '\\') = 0",
    "      AND instr(storage_key, '?') = 0 AND instr(storage_key, '#') = 0 AND substr(storage_key, 1, 1) <> '/'",
    '    )',
    '  ),',
    "  mime_type TEXT CHECK (mime_type IS NULL OR mime_type IN ('image/webp', 'image/avif', 'image/jpeg', 'image/png')),",
    "  width INTEGER CHECK (width IS NULL OR (typeof(width) = 'integer' AND width > 0)),",
    "  height INTEGER CHECK (height IS NULL OR (typeof(height) = 'integer' AND height > 0)),",
    "  content_length INTEGER CHECK (content_length IS NULL OR (typeof(content_length) = 'integer' AND content_length >= 0)),",
    "  content_hash TEXT CHECK (content_hash IS NULL OR (length(content_hash) = 64 AND content_hash NOT GLOB '*[^0-9a-f]*')),",
    '  source_reference TEXT CHECK (source_reference IS NULL OR length(source_reference) > 0),',
    '  generator_provider TEXT CHECK (generator_provider IS NULL OR length(generator_provider) > 0),',
    '  generator_model TEXT CHECK (generator_model IS NULL OR length(generator_model) > 0),',
    "  prompt_hash TEXT CHECK (prompt_hash IS NULL OR (length(prompt_hash) = 64 AND prompt_hash NOT GLOB '*[^0-9a-f]*')),",
    "  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),",
    "  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),",
    '  UNIQUE (recipe_id, role, version),',
    '  CHECK (',
    "    status <> 'ready' OR (",
    '      storage_key IS NOT NULL AND mime_type IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL',
    '      AND content_length IS NOT NULL AND content_hash IS NOT NULL',
    '    )',
    '  ),',
    '  CHECK (',
    '    storage_key IS NULL OR (',
    "      mime_type IS NOT NULL AND storage_key = 'recipes/' || recipe_id || '/' || role || '/v' || version || CASE mime_type",
    "        WHEN 'image/webp' THEN '.webp' WHEN 'image/avif' THEN '.avif' WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png'",
    '      END',
    '    )',
    '  )',
    ');',
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_media_current_ready ON recipe_media(recipe_id, role) WHERE status = 'ready';",
    'CREATE INDEX IF NOT EXISTS idx_recipe_media_recipe_role_status ON recipe_media(recipe_id, role, status);',
    'CREATE INDEX IF NOT EXISTS idx_recipe_media_content_hash ON recipe_media(content_hash) WHERE content_hash IS NOT NULL;',
    '',
    '-- Versions are immutable once ready: bytes behind v<N> never change; a replacement is a new row.',
    'CREATE TRIGGER IF NOT EXISTS trg_recipe_media_ready_immutable_update',
    'BEFORE UPDATE OF recipe_id, role, version, storage_key, mime_type, width, height, content_length, content_hash ON recipe_media',
    "WHEN OLD.status = 'ready'",
    'BEGIN',
    "  SELECT RAISE(ABORT, 'recipe_media ready versions are immutable');",
    'END;',
    '',
    'INSERT INTO recipe_media (id, recipe_id, role, version, status) VALUES',
    ...rows.map((row, index) => `('${esc(row.id)}', '${esc(row.recipeId)}', '${row.role}', ${row.version}, '${row.status}')${index === rows.length - 1 ? '' : ','}`),
    'ON CONFLICT(id) DO NOTHING;',
    '',
  ];
  return lines.join('\n');
}
