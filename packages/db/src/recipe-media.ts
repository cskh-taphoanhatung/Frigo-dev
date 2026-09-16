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

export type RecipeMediaWriteErrorCode =
  | 'INVALID_RECIPE_ID' | 'INVALID_ROLE' | 'INVALID_VERSION' | 'UNSUPPORTED_MIME' | 'INVALID_DIMENSIONS'
  | 'INVALID_CONTENT_HASH' | 'INVALID_CONTENT_LENGTH' | 'INVALID_SOURCE' | 'VERSION_EXISTS' | 'NOT_PENDING' | 'READY_CONFLICT' | 'NOT_FOUND'
  | 'METADATA_INCOMPLETE' | 'OBJECT_MISSING' | 'OBJECT_MIME_MISMATCH' | 'OBJECT_SIZE_MISMATCH' | 'OBJECT_TOO_LARGE' | 'OBJECT_READ_FAILED' | 'OBJECT_HASH_MISMATCH';

export class RecipeMediaWriteError extends Error {
  constructor(readonly code: RecipeMediaWriteErrorCode, message: string) { super(message); this.name = 'RecipeMediaWriteError'; }
}

/**
 * Minimal structural view of the R2 `IMAGES` binding used at the promotion boundary. Matches
 * `R2Bucket.get` from @cloudflare/workers-types without importing Workers globals into @frigo/db.
 */
export interface RecipeMediaObjectStore {
  get(key: string): Promise<RecipeMediaStoredObject | null>;
}

export interface RecipeMediaStoredObject {
  readonly size: number;
  readonly httpMetadata?: { contentType?: string } | undefined;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Upper bound for one canonical recipe image read into memory for hashing at promotion time.
 * Hero/thumbnail rasters are expected in the tens-to-hundreds of KB; 16 MiB leaves ample headroom
 * while keeping a Worker isolate far below its memory limit. Larger objects are refused, not hashed.
 */
export const RECIPE_MEDIA_MAX_VERIFY_BYTES = 16 * 1024 * 1024;

const sha256Hex = async (bytes: ArrayBuffer): Promise<string> =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');

export interface RecipeMediaVersionInput {
  recipeId: string;
  role: RecipeMediaRole;
  version: number;
  mimeType: RecipeMediaMimeType;
  width: number;
  height: number;
  /** Byte length of the canonical object; required because `ready` needs a known size to verify against. */
  contentLength: number;
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
  if (!Number.isInteger(input.contentLength) || input.contentLength < 0) throw new RecipeMediaWriteError('INVALID_CONTENT_LENGTH', 'content length must be an integer >= 0');
  if (!(RECIPE_MEDIA_SOURCE_TYPES as readonly string[]).includes(input.sourceType)) throw new RecipeMediaWriteError('INVALID_SOURCE', 'unsupported source type');
  if (input.promptHash != null && !isSha256Hex(input.promptHash)) throw new RecipeMediaWriteError('INVALID_CONTENT_HASH', 'prompt hash must be 64 lowercase hex characters');
  return {
    storageKey: buildRecipeMediaStorageKey(input.recipeId, input.role, input.version, input.mimeType),
    id: `${input.recipeId}_media_${input.role}_v${input.version}`,
  };
}

/**
 * Inserts (or completes the seeded slot for) version N as `pending` with full canonical metadata.
 * Staging records what the caller CLAIMS about the object; the row only becomes `ready` through
 * {@link promoteRecipeMediaVersion}, which verifies those claims against the actual R2 object.
 * Canonical keys are never reused: new bytes always mean a new version (and therefore a new key).
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
 * Proof that the canonical R2 object behind a staged row was verified. Only produced by
 * {@link verifyRecipeMediaObject}; the class is not exported, so callers cannot forge one.
 */
class VerifiedRecipeMediaObject {
  constructor(readonly record: RecipeMediaRecord, readonly objectSize: number, readonly objectSha256: string) {}
}

/**
 * Fail-closed verification of the staged metadata against the ACTUAL R2 object:
 * complete ready metadata → exact deterministic key → object exists → object MIME equals mime_type
 * (absent MIME is a failure) → object size equals content_length → SHA-256 of the real bytes equals
 * content_hash. Bytes are read once (`arrayBuffer`), bounded by {@link RECIPE_MEDIA_MAX_VERIFY_BYTES},
 * and never logged. This is the only place hashing happens: the serving route trusts ready metadata.
 */
async function verifyRecipeMediaObject(images: RecipeMediaObjectStore, target: RecipeMediaRecord): Promise<VerifiedRecipeMediaObject> {
  const issues = auditReadyRecipeMediaRecord(target);
  if (issues.length > 0) throw new RecipeMediaWriteError('METADATA_INCOMPLETE', `version ${target.version} cannot become ready: ${issues.join(', ')}`);
  const { storageKey, mimeType, contentLength, contentHash } = target;
  // Audit passed, so these are present; the key is re-derived (never taken from any request) and must match.
  if (!storageKey || !isRecipeMediaMimeType(mimeType) || contentLength === null || !isSha256Hex(contentHash)
    || buildRecipeMediaStorageKey(target.recipeId, target.role, target.version, mimeType) !== storageKey) {
    throw new RecipeMediaWriteError('METADATA_INCOMPLETE', 'staged metadata does not derive a trusted storage key');
  }
  if (contentLength > RECIPE_MEDIA_MAX_VERIFY_BYTES) throw new RecipeMediaWriteError('OBJECT_TOO_LARGE', `content_length ${contentLength} exceeds the verification bound`);

  let object: RecipeMediaStoredObject | null;
  try {
    object = await images.get(storageKey);
  } catch {
    throw new RecipeMediaWriteError('OBJECT_READ_FAILED', 'R2 object could not be read');
  }
  if (!object) throw new RecipeMediaWriteError('OBJECT_MISSING', `no R2 object exists for version ${target.version}`);
  const objectMime = object.httpMetadata?.contentType ?? null;
  if (objectMime !== mimeType) throw new RecipeMediaWriteError('OBJECT_MIME_MISMATCH', `R2 object MIME ${objectMime ?? '(none)'} does not match ${mimeType}`);
  if (object.size !== contentLength) throw new RecipeMediaWriteError('OBJECT_SIZE_MISMATCH', `R2 object size ${object.size} does not match content_length ${contentLength}`);
  if (object.size > RECIPE_MEDIA_MAX_VERIFY_BYTES) throw new RecipeMediaWriteError('OBJECT_TOO_LARGE', 'R2 object exceeds the verification bound');

  let bytes: ArrayBuffer;
  try {
    bytes = await object.arrayBuffer();
  } catch {
    throw new RecipeMediaWriteError('OBJECT_READ_FAILED', 'R2 object body could not be read');
  }
  if (bytes.byteLength !== contentLength) throw new RecipeMediaWriteError('OBJECT_SIZE_MISMATCH', `R2 body length ${bytes.byteLength} does not match content_length ${contentLength}`);
  const actualSha256 = await sha256Hex(bytes);
  if (actualSha256 !== contentHash) throw new RecipeMediaWriteError('OBJECT_HASH_MISMATCH', 'SHA-256 of the R2 object bytes does not match content_hash');
  return new VerifiedRecipeMediaObject(target, object.size, actualSha256);
}

/**
 * Promotes pending version N to `ready` ONLY after {@link verifyRecipeMediaObject} proves the
 * canonical R2 object is serveable (exists, exact MIME, exact size, exact SHA-256 of actual bytes).
 * The D1 transition (old ready → superseded, target pending → ready) is one atomic batch; the
 * partial unique index remains the final fence against two current-ready rows. Any verification
 * failure leaves the target pending and the existing ready version untouched.
 */
export async function promoteRecipeMediaVersion(
  db: D1DatabaseBinding,
  images: RecipeMediaObjectStore,
  recipeId: string,
  role: RecipeMediaRole,
  version: number,
): Promise<RecipeMediaRecord> {
  const catalog = new D1RecipeMediaCatalog(db);
  const target = await catalog.readVersion(recipeId, role, version);
  if (!target) throw new RecipeMediaWriteError('NOT_FOUND', 'media version not found');
  if (target.status !== 'pending') throw new RecipeMediaWriteError('NOT_PENDING', `version ${version} is ${target.status}, not pending`);
  const verified = await verifyRecipeMediaObject(images, target);
  return promoteVerifiedRecipeMediaVersion(db, verified);
}

/** DB-only transition; reachable solely with a {@link VerifiedRecipeMediaObject}, which this module alone can mint. */
async function promoteVerifiedRecipeMediaVersion(db: D1DatabaseBinding, verified: VerifiedRecipeMediaObject): Promise<RecipeMediaRecord> {
  const { record } = verified;
  const now = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;
  // Both statements share one predicate: the target must still be the pending row whose byte identity
  // was verified. A row re-staged/rejected between verification and promotion therefore neither becomes
  // ready nor supersedes the current ready version — the batch is a no-op, not a half transition.
  const targetGuard = `id = ? AND status = 'pending' AND storage_key = ? AND mime_type = ? AND content_length = ? AND content_hash = ?`;
  const targetBinds = [record.id, record.storageKey, record.mimeType, verified.objectSize, verified.objectSha256];
  const results = await db.batch([
    db.prepare(`UPDATE recipe_media SET status = 'superseded', updated_at = ${now}
       WHERE recipe_id = ? AND role = ? AND status = 'ready' AND version <> ?
         AND EXISTS (SELECT 1 FROM recipe_media WHERE ${targetGuard})`)
      .bind(record.recipeId, record.role, record.version, ...targetBinds),
    db.prepare(`UPDATE recipe_media SET status = 'ready', updated_at = ${now} WHERE ${targetGuard}`).bind(...targetBinds),
  ]);
  if (results.some((result) => !result.success)) throw new RecipeMediaWriteError('READY_CONFLICT', 'promotion batch failed');
  if (Number(results[1]?.meta.changes) !== 1) throw new RecipeMediaWriteError('READY_CONFLICT', 'target version was no longer the verified pending row');
  const promoted = await new D1RecipeMediaCatalog(db).readVersion(record.recipeId, record.role, record.version);
  if (!promoted || promoted.status !== 'ready') throw new RecipeMediaWriteError('READY_CONFLICT', 'promotion did not yield a ready row');
  return promoted;
}

export async function rejectRecipeMediaVersion(db: D1DatabaseBinding, recipeId: string, role: RecipeMediaRole, version: number): Promise<void> {
  const target = await new D1RecipeMediaCatalog(db).readVersion(recipeId, role, version);
  if (!target) throw new RecipeMediaWriteError('NOT_FOUND', 'media version not found');
  if (target.status !== 'pending') throw new RecipeMediaWriteError('NOT_PENDING', `version ${version} is ${target.status}, not pending`);
  await db.prepare(`UPDATE recipe_media SET status = 'rejected', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'pending'`).bind(target.id).run();
}
