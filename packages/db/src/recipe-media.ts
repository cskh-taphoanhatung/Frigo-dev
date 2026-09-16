/**
 * T14C — D1 access for `recipe_media` (ADR-025).
 *
 * Reads are bulk and bounded: one `IN (...)` statement per chunk of recipe IDs, never one query
 * per recipe. Writes are internal helpers for future import/generation workflows; there is no
 * public write route. Nothing here touches inventory tables or recipe content rows.
 */
import {
  auditReadyRecipeMediaRecord,
  buildRecipeMediaStorageKey,
  isCanonicalRecipeIdShape,
  isRecipeMediaMimeType,
  isRecipeMediaRole,
  isSha256Hex,
  parseRecipeMediaVersion,
  RECIPE_MEDIA_SOURCE_TYPES,
  RECIPE_MEDIA_STATUSES,
  type RecipeMediaMimeType,
  type RecipeMediaRecord,
  type RecipeMediaRole,
  type RecipeMediaSourceType,
  type RecipeMediaStatus,
} from '../../recipes/src/recipe-media';
import type { D1DatabaseBinding } from './index';

/** D1 binds at most 100 parameters per statement; keep a safe margin for future extra binds. */
export const RECIPE_MEDIA_LOOKUP_CHUNK_SIZE = 90;

const COLUMNS = `id, recipe_id, role, version, status, source_type, storage_key, mime_type, width, height,
  content_length, content_hash, source_reference, generator_provider, generator_model, prompt_hash, created_at, updated_at`;

interface RecipeMediaRow {
  id: unknown; recipe_id: unknown; role: unknown; version: unknown; status: unknown; source_type: unknown;
  storage_key: unknown; mime_type: unknown; width: unknown; height: unknown; content_length: unknown;
  content_hash: unknown; source_reference: unknown; generator_provider: unknown; generator_model: unknown;
  prompt_hash: unknown; created_at: unknown; updated_at: unknown;
}

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const integer = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) ? value : null);

/** Drops rows whose closed-vocabulary columns are not recognised instead of guessing. */
export function mapRecipeMediaRow(row: RecipeMediaRow): RecipeMediaRecord | null {
  const id = text(row.id), recipeId = text(row.recipe_id), createdAt = text(row.created_at), updatedAt = text(row.updated_at);
  const version = integer(row.version);
  const sourceType = text(row.source_type);
  if (!id || !recipeId || !createdAt || !updatedAt || version === null || parseRecipeMediaVersion(version) === null) return null;
  if (!isRecipeMediaRole(row.role) || !(RECIPE_MEDIA_STATUSES as readonly unknown[]).includes(row.status)) return null;
  if (sourceType !== null && !(RECIPE_MEDIA_SOURCE_TYPES as readonly string[]).includes(sourceType)) return null;
  return {
    id, recipeId, role: row.role, version, status: row.status as RecipeMediaStatus,
    sourceType: sourceType as RecipeMediaSourceType | null,
    storageKey: text(row.storage_key), mimeType: text(row.mime_type),
    width: integer(row.width), height: integer(row.height), contentLength: integer(row.content_length),
    contentHash: text(row.content_hash), sourceReference: text(row.source_reference),
    generatorProvider: text(row.generator_provider), generatorModel: text(row.generator_model), promptHash: text(row.prompt_hash),
    createdAt, updatedAt,
  };
}

export interface RecipeMediaCatalog {
  /** Current ready row per (recipe, role) for the given recipe IDs. Bounded: ceil(n / chunk) queries. */
  readCurrentReady(recipeIds: readonly string[], role: RecipeMediaRole): Promise<RecipeMediaRecord[]>;
  /** Every row for one recipe (all roles/versions/statuses), newest version first. */
  readRecipe(recipeId: string): Promise<RecipeMediaRecord[]>;
  /** One exact version, whatever its status; `null` when absent. */
  readVersion(recipeId: string, role: RecipeMediaRole, version: number): Promise<RecipeMediaRecord | null>;
}

export function chunkRecipeIds(recipeIds: readonly string[], size = RECIPE_MEDIA_LOOKUP_CHUNK_SIZE): string[][] {
  const unique = Array.from(new Set(recipeIds.filter(isCanonicalRecipeIdShape)));
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += size) chunks.push(unique.slice(index, index + size));
  return chunks;
}

export class D1RecipeMediaCatalog implements RecipeMediaCatalog {
  constructor(private readonly db: D1DatabaseBinding) {}

  async readCurrentReady(recipeIds: readonly string[], role: RecipeMediaRole): Promise<RecipeMediaRecord[]> {
    if (!isRecipeMediaRole(role)) return [];
    const chunks = chunkRecipeIds(recipeIds);
    if (chunks.length === 0) return [];
    const statements = chunks.map((chunk) => this.db.prepare(
      `SELECT ${COLUMNS} FROM recipe_media
       WHERE status = 'ready' AND role = ? AND recipe_id IN (${chunk.map(() => '?').join(', ')})
       ORDER BY recipe_id ASC, version DESC`,
    ).bind(role, ...chunk));
    const results = statements.length === 1 ? [await statements[0].all<RecipeMediaRow>()] : await this.db.batch<RecipeMediaRow>(statements);
    const records: RecipeMediaRecord[] = [];
    for (const result of results) for (const row of result.results) { const record = mapRecipeMediaRow(row); if (record) records.push(record); }
    return records;
  }

  async readRecipe(recipeId: string): Promise<RecipeMediaRecord[]> {
    if (!isCanonicalRecipeIdShape(recipeId)) return [];
    const result = await this.db.prepare(
      `SELECT ${COLUMNS} FROM recipe_media WHERE recipe_id = ? ORDER BY role ASC, version DESC`,
    ).bind(recipeId).all<RecipeMediaRow>();
    return result.results.map(mapRecipeMediaRow).filter((record): record is RecipeMediaRecord => record !== null);
  }

  async readVersion(recipeId: string, role: RecipeMediaRole, version: number): Promise<RecipeMediaRecord | null> {
    if (!isCanonicalRecipeIdShape(recipeId) || !isRecipeMediaRole(role) || parseRecipeMediaVersion(version) === null) return null;
    const row = await this.db.prepare(
      `SELECT ${COLUMNS} FROM recipe_media WHERE recipe_id = ? AND role = ? AND version = ?`,
    ).bind(recipeId, role, version).first<RecipeMediaRow>();
    return row ? mapRecipeMediaRow(row) : null;
  }
}

// ---------------------------------------------------------------------------------------------
// Internal write helpers (future import/generation workflows; never reachable from a public route)
// ---------------------------------------------------------------------------------------------

export class RecipeMediaWriteError extends Error {
  constructor(readonly code:
    | 'INVALID_RECIPE_ID' | 'INVALID_ROLE' | 'INVALID_VERSION' | 'UNSUPPORTED_MIME' | 'INVALID_DIMENSIONS'
    | 'INVALID_CONTENT_HASH' | 'INVALID_CONTENT_LENGTH' | 'INVALID_SOURCE' | 'VERSION_EXISTS' | 'NOT_PENDING' | 'READY_CONFLICT' | 'NOT_FOUND',
  message: string) { super(message); this.name = 'RecipeMediaWriteError'; }
}

export interface RecipeMediaVersionInput {
  recipeId: string;
  role: RecipeMediaRole;
  version: number;
  mimeType: RecipeMediaMimeType;
  width: number;
  height: number;
  contentLength: number | null;
  contentHash: string;
  sourceType: RecipeMediaSourceType;
  sourceReference?: string | null;
  generatorProvider?: string | null;
  generatorModel?: string | null;
  promptHash?: string | null;
}

export function validateRecipeMediaVersionInput(input: RecipeMediaVersionInput): { storageKey: string; id: string } {
  if (!isCanonicalRecipeIdShape(input.recipeId)) throw new RecipeMediaWriteError('INVALID_RECIPE_ID', 'recipe ID is not a canonical identity');
  if (!isRecipeMediaRole(input.role)) throw new RecipeMediaWriteError('INVALID_ROLE', 'unsupported media role');
  if (parseRecipeMediaVersion(input.version) === null) throw new RecipeMediaWriteError('INVALID_VERSION', 'version must be an integer >= 1');
  if (!isRecipeMediaMimeType(input.mimeType)) throw new RecipeMediaWriteError('UNSUPPORTED_MIME', 'MIME type is not allow-listed');
  if (![input.width, input.height].every((value) => Number.isInteger(value) && value > 0)) throw new RecipeMediaWriteError('INVALID_DIMENSIONS', 'width/height must be positive integers');
  if (!isSha256Hex(input.contentHash)) throw new RecipeMediaWriteError('INVALID_CONTENT_HASH', 'content hash must be 64 lowercase hex characters');
  if (input.contentLength !== null && (!Number.isInteger(input.contentLength) || input.contentLength < 0)) throw new RecipeMediaWriteError('INVALID_CONTENT_LENGTH', 'content length must be >= 0');
  if (!(RECIPE_MEDIA_SOURCE_TYPES as readonly string[]).includes(input.sourceType)) throw new RecipeMediaWriteError('INVALID_SOURCE', 'unsupported source type');
  if (input.promptHash != null && !isSha256Hex(input.promptHash)) throw new RecipeMediaWriteError('INVALID_CONTENT_HASH', 'prompt hash must be 64 lowercase hex characters');
  return {
    storageKey: buildRecipeMediaStorageKey(input.recipeId, input.role, input.version, input.mimeType),
    id: `${input.recipeId}_media_${input.role}_v${input.version}`,
  };
}

/**
 * Inserts (or completes the seeded slot for) version N as `pending` with full canonical metadata.
 * The row only becomes `ready` through {@link promoteRecipeMediaVersion} after the object is verified.
 */
export async function stageRecipeMediaVersion(db: D1DatabaseBinding, input: RecipeMediaVersionInput): Promise<RecipeMediaRecord> {
  const { storageKey, id } = validateRecipeMediaVersionInput(input);
  const existing = await new D1RecipeMediaCatalog(db).readVersion(input.recipeId, input.role, input.version);
  if (existing && !(existing.status === 'pending' && existing.storageKey === null)) {
    throw new RecipeMediaWriteError('VERSION_EXISTS', `version ${input.version} already exists for ${input.recipeId}/${input.role}`);
  }
  const binds = [
    input.sourceType, storageKey, input.mimeType, input.width, input.height, input.contentLength, input.contentHash,
    input.sourceReference ?? null, input.generatorProvider ?? null, input.generatorModel ?? null, input.promptHash ?? null,
  ];
  if (existing) {
    await db.prepare(
      `UPDATE recipe_media SET source_type = ?, storage_key = ?, mime_type = ?, width = ?, height = ?, content_length = ?, content_hash = ?,
         source_reference = ?, generator_provider = ?, generator_model = ?, prompt_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND status = 'pending' AND storage_key IS NULL`,
    ).bind(...binds, existing.id).run();
  } else {
    await db.prepare(
      `INSERT INTO recipe_media (id, recipe_id, role, version, status, source_type, storage_key, mime_type, width, height, content_length, content_hash,
         source_reference, generator_provider, generator_model, prompt_hash)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, input.recipeId, input.role, input.version, ...binds).run();
  }
  const staged = await new D1RecipeMediaCatalog(db).readVersion(input.recipeId, input.role, input.version);
  if (!staged) throw new RecipeMediaWriteError('NOT_FOUND', 'staged row could not be read back');
  return staged;
}

/**
 * Atomically supersedes the current ready version (if any) and marks version N ready.
 * The partial unique index guarantees the batch cannot leave two current-ready rows.
 */
export async function promoteRecipeMediaVersion(db: D1DatabaseBinding, recipeId: string, role: RecipeMediaRole, version: number): Promise<RecipeMediaRecord> {
  const catalog = new D1RecipeMediaCatalog(db);
  const target = await catalog.readVersion(recipeId, role, version);
  if (!target) throw new RecipeMediaWriteError('NOT_FOUND', 'media version not found');
  if (target.status !== 'pending') throw new RecipeMediaWriteError('NOT_PENDING', `version ${version} is ${target.status}, not pending`);
  const issues = auditReadyRecipeMediaRecord(target);
  if (issues.length > 0) throw new RecipeMediaWriteError('READY_CONFLICT', `version ${version} cannot become ready: ${issues.join(', ')}`);
  const now = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;
  await db.batch([
    db.prepare(`UPDATE recipe_media SET status = 'superseded', updated_at = ${now} WHERE recipe_id = ? AND role = ? AND status = 'ready' AND version <> ?`).bind(recipeId, role, version),
    db.prepare(`UPDATE recipe_media SET status = 'ready', updated_at = ${now} WHERE id = ? AND status = 'pending'`).bind(target.id),
  ]);
  const promoted = await catalog.readVersion(recipeId, role, version);
  if (!promoted || promoted.status !== 'ready') throw new RecipeMediaWriteError('READY_CONFLICT', 'promotion did not yield a ready row');
  return promoted;
}

export async function rejectRecipeMediaVersion(db: D1DatabaseBinding, recipeId: string, role: RecipeMediaRole, version: number): Promise<void> {
  const target = await new D1RecipeMediaCatalog(db).readVersion(recipeId, role, version);
  if (!target) throw new RecipeMediaWriteError('NOT_FOUND', 'media version not found');
  if (target.status !== 'pending') throw new RecipeMediaWriteError('NOT_PENDING', `version ${version} is ${target.status}, not pending`);
  await db.prepare(`UPDATE recipe_media SET status = 'rejected', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'pending'`).bind(target.id).run();
}
