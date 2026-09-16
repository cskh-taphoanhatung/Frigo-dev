import { afterEach, describe, expect, it } from 'vitest';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import {
  auditReadyRecipeMediaRecord, buildRecipeMediaStorageKey, buildRecipeMediaUrl, classifyLegacyImageUrl, isTrustedRecipeMediaStorageKey,
  parseRecipeMediaVersion, presentRecipeMedia, resolveRecipeMedia, type RecipeMediaRecord,
} from '../../packages/recipes/src/recipe-media';
import {
  chunkRecipeIds, D1RecipeMediaCatalog, promoteRecipeMediaVersion, RECIPE_MEDIA_LOOKUP_CHUNK_SIZE, RECIPE_MEDIA_MAX_VERIFY_BYTES,
  rejectRecipeMediaVersion, RecipeMediaWriteError, stageRecipeMediaVersion,
} from '../../packages/db/src/recipe-media';
import { FakeR2, sha256Hex } from '../helpers/recipe-media-r2';
import { SqliteD1, type SqliteStatementEvent } from '../helpers/sqlite-d1';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
/** Two distinct fixtures with IDENTICAL length so hash tests cannot pass on size alone. */
const BYTES_A = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x01, 0x02, 0x03, 0x04]);
const BYTES_B = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x04, 0x03, 0x02, 0x01]);
const SHA_A = sha256Hex(BYTES_A);
const SHA_B = sha256Hex(BYTES_B);

const record = (overrides: Partial<RecipeMediaRecord> = {}): RecipeMediaRecord => ({
  id: 'gl-01_media_hero_v2', recipeId: 'gl-01', role: 'hero', version: 2, status: 'ready', sourceType: 'uploaded',
  storageKey: 'recipes/gl-01/hero/v2.webp', mimeType: 'image/webp', width: 1200, height: 800, contentLength: 100, contentHash: HASH_A,
  sourceReference: null, generatorProvider: null, generatorModel: null, promptHash: null, createdAt: 't', updatedAt: 't', ...overrides,
});

function stage(db: SqliteD1, recipeId: string, version: number, overrides: Record<string, unknown> = {}) {
  return stageRecipeMediaVersion(db, {
    recipeId, role: 'hero', version, mimeType: 'image/webp', width: 1200, height: 800, contentLength: 100, contentHash: HASH_A, sourceType: 'uploaded', ...overrides,
  } as Parameters<typeof stageRecipeMediaVersion>[1]);
}

/** Stages real fixture metadata (true length + true SHA-256) and uploads the matching object to the R2 double. */
async function stageWithObject(db: SqliteD1, r2: FakeR2, recipeId: string, version: number, bytes: Uint8Array, options: { upload?: boolean; objectBytes?: Uint8Array; objectMime?: string | null; overrides?: Record<string, unknown> } = {}) {
  const staged = await stage(db, recipeId, version, { contentLength: bytes.byteLength, contentHash: sha256Hex(bytes), ...options.overrides });
  if (options.upload !== false) r2.put(`recipes/${recipeId}/hero/v${version}.webp`, options.objectBytes ?? bytes, options.objectMime === null ? undefined : options.objectMime ?? 'image/webp');
  return staged;
}

const statuses = (db: SqliteD1, recipeId: string) => db.query<{ version: number; status: string }>(`SELECT version, status FROM recipe_media WHERE recipe_id = ? ORDER BY version`, recipeId).map((row) => [row.version, row.status]);

describe('T14C — storage key, version and URL contracts', () => {
  it('builds deterministic versioned keys and rejects every unsafe component', () => {
    expect(buildRecipeMediaStorageKey('vn-canh-01', 'hero', 1, 'image/webp')).toBe('recipes/vn-canh-01/hero/v1.webp');
    expect(buildRecipeMediaStorageKey('gl-12', 'thumbnail', 7, 'image/jpeg')).toBe('recipes/gl-12/thumbnail/v7.jpg');
    for (const id of ['../x', 'a/b', 'a\\b', 'A-1', 'x?y', '', ' gl-01', 'gl-01/', '%2e%2e']) expect(() => buildRecipeMediaStorageKey(id, 'hero', 1, 'image/webp'), id).toThrow();
    expect(() => buildRecipeMediaStorageKey('gl-01', 'banner' as never, 1, 'image/webp')).toThrow();
    for (const version of [0, -1, 1.5, Number.NaN, 10_000_000]) expect(() => buildRecipeMediaStorageKey('gl-01', 'hero', version, 'image/webp'), String(version)).toThrow();
    for (const mime of ['image/svg+xml', 'text/html', 'application/octet-stream', 'application/javascript']) expect(() => buildRecipeMediaStorageKey('gl-01', 'hero', 1, mime as never), mime).toThrow();
  });

  it('trusts only the exact derived key for a row', () => {
    expect(isTrustedRecipeMediaStorageKey('recipes/gl-01/hero/v2.webp', 'gl-01', 'hero', 2, 'image/webp')).toBe(true);
    expect(isTrustedRecipeMediaStorageKey('recipes/gl-01/hero/v2.png', 'gl-01', 'hero', 2, 'image/webp')).toBe(false);
    expect(isTrustedRecipeMediaStorageKey('recipes/gl-02/hero/v2.webp', 'gl-01', 'hero', 2, 'image/webp')).toBe(false);
    expect(isTrustedRecipeMediaStorageKey('users/u/scans/s/original.webp', 'gl-01', 'hero', 2, 'image/webp')).toBe(false);
    expect(isTrustedRecipeMediaStorageKey('recipes/gl-01/hero/v2.webp', 'gl-01', 'hero', 2, 'image/svg+xml')).toBe(false);
  });

  it('parses versions strictly', () => {
    expect(['1', '42', '1000000'].map(parseRecipeMediaVersion)).toEqual([1, 42, 1_000_000]);
    for (const bad of ['0', '-1', '01', '1.0', '1e3', ' 1', '1 ', '', 'abc', '1000001', '99999999999', '0x10']) expect(parseRecipeMediaVersion(bad), bad).toBeNull();
    expect(parseRecipeMediaVersion(3)).toBe(3);
    expect(parseRecipeMediaVersion(0)).toBeNull();
  });

  it('builds same-origin versioned URLs only from valid components', () => {
    expect(buildRecipeMediaUrl('gl-01', 'hero', 2)).toBe('/api/v1/recipe-media/gl-01/hero/2');
    expect(() => buildRecipeMediaUrl('../x', 'hero', 2)).toThrow();
  });

  it('classifies legacy image URLs: same-origin static, https external, otherwise missing', () => {
    expect(classifyLegacyImageUrl('/frigo/recipes/global/mapo-tofu.webp')).toEqual({ kind: 'legacy_static', url: '/frigo/recipes/global/mapo-tofu.webp' });
    expect(classifyLegacyImageUrl('https://images.unsplash.com/photo-1?auto=format').kind).toBe('legacy_external');
    for (const bad of ['', '   ', '//evil.example/x.png', 'http://insecure.example/x.png', 'javascript:alert(1)', '/a/../b.png', 'data:image/png;base64,AAAA', undefined, null]) {
      expect(classifyLegacyImageUrl(bad as string).kind, String(bad)).toBe('missing');
    }
  });
});

describe('T14C — RecipeMediaResolver precedence (pure)', () => {
  const staticRecipe = { id: 'gl-01', imageUrl: '/frigo/recipes/global/pasta-pomodoro.webp' };
  const externalRecipe = { id: 'vn-canh-01', imageUrl: 'https://images.unsplash.com/photo-1541832676?auto=format' };

  it('ready canonical R2 wins and exposes only url/source/version/dimensions', () => {
    const presentation = resolveRecipeMedia(staticRecipe, 'hero', [record()]);
    expect(presentation).toEqual({ url: '/api/v1/recipe-media/gl-01/hero/2', source: 'canonical_r2', version: 2, width: 1200, height: 800 });
    expect(JSON.stringify(presentation)).not.toMatch(/storage|recipes\/gl-01|prompt|content_hash/);
  });

  it('newest valid ready version wins; pending/rejected/superseded/incomplete rows never resolve as canonical', () => {
    expect(resolveRecipeMedia(staticRecipe, 'hero', [record({ version: 2 }), record({ id: 'v3', version: 3, storageKey: 'recipes/gl-01/hero/v3.webp' })]).version).toBe(3);
    for (const status of ['pending', 'rejected', 'superseded'] as const) {
      expect(resolveRecipeMedia(staticRecipe, 'hero', [record({ status })]).source, status).toBe('legacy_static');
    }
    expect(resolveRecipeMedia(staticRecipe, 'hero', [record({ contentHash: null })]).source).toBe('legacy_static');
    expect(resolveRecipeMedia(staticRecipe, 'hero', [record({ storageKey: 'recipes/gl-02/hero/v2.webp' })]).source).toBe('legacy_static');
    expect(resolveRecipeMedia(staticRecipe, 'hero', [record({ mimeType: 'image/svg+xml' })]).source).toBe('legacy_static');
  });

  it('falls back to legacy static, then legacy external, then missing; roles and recipes do not cross', () => {
    expect(resolveRecipeMedia(staticRecipe, 'hero', [])).toEqual({ url: staticRecipe.imageUrl, source: 'legacy_static', version: null, width: null, height: null });
    expect(resolveRecipeMedia(externalRecipe, 'hero', [])).toEqual({ url: externalRecipe.imageUrl, source: 'legacy_external', version: null, width: null, height: null });
    expect(resolveRecipeMedia({ id: 'gl-01', imageUrl: '' }, 'hero', [])).toEqual({ url: null, source: 'missing', version: null, width: null, height: null });
    expect(resolveRecipeMedia(staticRecipe, 'thumbnail', [record()]).source).toBe('legacy_static');
    expect(resolveRecipeMedia({ id: 'gl-02', imageUrl: '/x.webp' }, 'hero', [record()]).source).toBe('legacy_static');
    expect(presentRecipeMedia(staticRecipe, [record()]).hero.source).toBe('canonical_r2');
  });

  it('resolution is deterministic regardless of input order', () => {
    const rows = [record({ id: 'a', version: 2 }), record({ id: 'b', version: 5, storageKey: 'recipes/gl-01/hero/v5.webp' }), record({ id: 'c', version: 3, storageKey: 'recipes/gl-01/hero/v3.webp' })];
    expect(resolveRecipeMedia(staticRecipe, 'hero', rows)).toEqual(resolveRecipeMedia(staticRecipe, 'hero', [...rows].reverse()));
  });

  it('audits ready metadata completeness exactly', () => {
    expect(auditReadyRecipeMediaRecord(record())).toEqual([]);
    expect(auditReadyRecipeMediaRecord(record({ width: 0, height: null }))).toEqual(['missing_dimensions']);
    expect(auditReadyRecipeMediaRecord(record({ width: 0 }))).toEqual(['invalid_dimensions']);
    expect(auditReadyRecipeMediaRecord(record({ contentLength: -1 }))).toEqual(['invalid_content_length']);
    expect(auditReadyRecipeMediaRecord(record({ contentLength: null }))).toEqual(['missing_content_length']);
    expect(auditReadyRecipeMediaRecord(record({ storageKey: 'recipes/gl-01/hero/v2.foo.webp' }))).toEqual(['untrusted_storage_key']);
    expect(auditReadyRecipeMediaRecord(record({ storageKey: null, mimeType: 'text/html', contentHash: 'zz' }))).toEqual(['missing_storage_key', 'unsupported_mime_type', 'invalid_content_hash']);
  });
});

describe('T14C — D1RecipeMediaCatalog (bounded bulk reads, no N+1) and write helpers', () => {
  const databases: SqliteD1[] = [];
  const database = (hooks?: { beforeStatement?: (event: SqliteStatementEvent) => void }) => { const db = new SqliteD1({ hooks }); databases.push(db); return db; };
  afterEach(() => { for (const db of databases.splice(0)) db.close(); });

  it('chunks unique canonical IDs at the bind limit', () => {
    expect(chunkRecipeIds([])).toEqual([]);
    expect(chunkRecipeIds(['gl-01', 'gl-01', '../x', 'gl-02'])).toEqual([['gl-01', 'gl-02']]);
    const many = Array.from({ length: 5000 }, (_, index) => `r-${index}`);
    const chunks = chunkRecipeIds(many);
    expect(chunks).toHaveLength(Math.ceil(5000 / RECIPE_MEDIA_LOOKUP_CHUNK_SIZE));
    expect(chunks.every((chunk) => chunk.length <= RECIPE_MEDIA_LOOKUP_CHUNK_SIZE)).toBe(true);
    expect(chunks.flat()).toEqual(many);
  });

  it('reads current-ready hero rows for all 71 recipes with ONE statement (would fail if per-recipe queries were issued)', async () => {
    const statements: string[] = [];
    const db = database({ beforeStatement: (event) => { if (/recipe_media/.test(event.sql)) statements.push(event.sql); } });
    const r2 = new FakeR2();
    await stageWithObject(db, r2, 'gl-01', 2, BYTES_A); await promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 2);
    await stageWithObject(db, r2, 'vn-canh-01', 2, BYTES_A); await promoteRecipeMediaVersion(db, r2, 'vn-canh-01', 'hero', 2);
    statements.length = 0;
    const catalog = new D1RecipeMediaCatalog(db);
    const rows = await catalog.readCurrentReady(ALL_RECIPES.map((recipe) => recipe.id), 'hero');
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/recipe_id IN \((\?, ){70}\?\)/);
    expect(rows.map((row) => `${row.recipeId}@${row.version}`).sort()).toEqual(['gl-01@2', 'vn-canh-01@2']);
    expect(rows.every((row) => row.status === 'ready')).toBe(true);
  });

  it('bulk read stays bounded for 5,000 IDs (ceil(n/90) statements in one batch) and returns stable ordering', async () => {
    const perStatement: string[] = [];
    const batched: string[][] = [];
    const db = new SqliteD1({ hooks: {
      beforeStatement: (event) => { if (/FROM recipe_media/.test(event.sql)) perStatement.push(event.sql); },
      beforeBatch: (statements) => { batched.push(statements.map((statement) => statement.sql)); },
    } });
    databases.push(db);
    const ids = [...ALL_RECIPES.map((recipe) => recipe.id), ...Array.from({ length: 4929 }, (_, index) => `future-${index}`)];
    await new D1RecipeMediaCatalog(db).readCurrentReady(ids, 'hero');
    expect(perStatement).toHaveLength(0); // no individual round-trips
    expect(batched).toHaveLength(1); // one D1 batch
    expect(batched[0]).toHaveLength(Math.ceil(5000 / RECIPE_MEDIA_LOOKUP_CHUNK_SIZE)); // 56 bounded chunks, not 5,000 queries
    expect(batched[0].every((sql) => /recipe_id IN \(/.test(sql))).toBe(true);
  });

  it('single recipe, version and explicit-absence lookups', async () => {
    const db = database();
    const catalog = new D1RecipeMediaCatalog(db);
    expect(await catalog.readRecipe('gl-01')).toMatchObject([{ recipeId: 'gl-01', role: 'hero', version: 1, status: 'pending', storageKey: null }]);
    expect(await catalog.readVersion('gl-01', 'hero', 1)).toMatchObject({ status: 'pending' });
    expect(await catalog.readVersion('gl-01', 'hero', 9)).toBeNull();
    expect(await catalog.readVersion('gl-01', 'thumbnail', 1)).toBeNull();
    expect(await catalog.readVersion('nope', 'hero', 1)).toBeNull();
    expect(await catalog.readVersion('gl-01', 'hero', 0)).toBeNull();
    expect(await catalog.readRecipe('../x')).toEqual([]);
    expect(await catalog.readCurrentReady(['gl-01'], 'banner' as never)).toEqual([]);
  });

  it('verified_object_promotion: stage → verified promote is atomic, never leaves two current-ready versions; old version becomes superseded', async () => {
    const db = database();
    const r2 = new FakeR2();
    const catalog = new D1RecipeMediaCatalog(db);
    // Completing the seeded pending v1 slot (no INSERT: the row exists with storage_key NULL).
    const v1 = await stageWithObject(db, r2, 'gl-01', 1, BYTES_B);
    expect(v1).toMatchObject({ version: 1, status: 'pending', storageKey: 'recipes/gl-01/hero/v1.webp', contentLength: BYTES_B.byteLength, contentHash: SHA_B });
    expect(await promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 1)).toMatchObject({ status: 'ready', contentHash: SHA_B });
    expect(r2.requestedKeys).toEqual(['recipes/gl-01/hero/v1.webp']); // only the D1-derived key, read once
    await stageWithObject(db, r2, 'gl-01', 2, BYTES_A);
    expect(await promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 2)).toMatchObject({ status: 'ready', version: 2, contentHash: SHA_A });
    const rows = await catalog.readRecipe('gl-01');
    expect(rows.map((row) => [row.version, row.status])).toEqual([[2, 'ready'], [1, 'superseded']]);
    expect(db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM recipe_media WHERE recipe_id = 'gl-01' AND status = 'ready'`)[0].n).toBe(1);
    expect(await catalog.readCurrentReady(['gl-01'], 'hero')).toMatchObject([{ version: 2 }]);
  });

  describe('ready integrity: promotion verifies the ACTUAL R2 object (P1 remediation)', () => {
    it('promote_without_object: valid metadata but no R2 object → OBJECT_MISSING, row stays pending, no ready row appears', async () => {
      const db = database(); const r2 = new FakeR2();
      await stageWithObject(db, r2, 'gl-01', 2, BYTES_A, { upload: false });
      await expect(promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 2)).rejects.toMatchObject({ code: 'OBJECT_MISSING' });
      expect(statuses(db, 'gl-01')).toEqual([[1, 'pending'], [2, 'pending']]);
      expect(await new D1RecipeMediaCatalog(db).readCurrentReady(['gl-01'], 'hero')).toEqual([]);
      expect(r2.requestedKeys).toEqual(['recipes/gl-01/hero/v2.webp']);
    });

    it('promote_wrong_mime: object contentType image/png (or absent) vs metadata image/webp → OBJECT_MIME_MISMATCH, no mutation', async () => {
      const db = database(); const r2 = new FakeR2();
      await stageWithObject(db, r2, 'gl-01', 2, BYTES_A, { objectMime: 'image/png' });
      await expect(promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 2)).rejects.toMatchObject({ code: 'OBJECT_MIME_MISMATCH' });
      r2.put('recipes/gl-01/hero/v2.webp', BYTES_A, undefined); // missing MIME is not silently accepted
      await expect(promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 2)).rejects.toMatchObject({ code: 'OBJECT_MIME_MISMATCH' });
      expect(statuses(db, 'gl-01')).toEqual([[1, 'pending'], [2, 'pending']]);
    });

    it('promote_wrong_size: metadata content_length=16 but object has 17 bytes → OBJECT_SIZE_MISMATCH, no mutation', async () => {
      const db = database(); const r2 = new FakeR2();
      const longer = new Uint8Array([...BYTES_A, 0xff]);
      await stageWithObject(db, r2, 'gl-01', 2, BYTES_A, { objectBytes: longer });
      await expect(promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 2)).rejects.toMatchObject({ code: 'OBJECT_SIZE_MISMATCH' });
      expect(statuses(db, 'gl-01')).toEqual([[1, 'pending'], [2, 'pending']]);
    });

    it('promote_wrong_hash_same_size: same MIME, same length, different bytes → OBJECT_HASH_MISMATCH (MIME+length are not identity)', async () => {
      const db = database(); const r2 = new FakeR2();
      expect(BYTES_A.byteLength).toBe(BYTES_B.byteLength);
      expect(SHA_A).not.toBe(SHA_B);
      await stageWithObject(db, r2, 'gl-01', 2, BYTES_A, { objectBytes: BYTES_B });
      await expect(promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 2)).rejects.toMatchObject({ code: 'OBJECT_HASH_MISMATCH' });
      expect(statuses(db, 'gl-01')).toEqual([[1, 'pending'], [2, 'pending']]);
      // A staged hash that is well-formed but simply wrong is caught the same way.
      await stage(db, 'gl-01', 3, { contentLength: BYTES_A.byteLength, contentHash: HASH_A });
      r2.put('recipes/gl-01/hero/v3.webp', BYTES_A, 'image/webp');
      await expect(promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 3)).rejects.toMatchObject({ code: 'OBJECT_HASH_MISMATCH' });
    });

    it('failed_new_version_keeps_old_ready: v1 ready, v2 fails verification for every reason → v1 still ready, v2 still pending', async () => {
      const db = database(); const r2 = new FakeR2();
      await stageWithObject(db, r2, 'gl-01', 1, BYTES_A);
      await promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 1);
      await stageWithObject(db, r2, 'gl-01', 2, BYTES_B, { upload: false });
      const attempts: Array<[string, () => void]> = [
        ['OBJECT_MISSING', () => r2.objects.delete('recipes/gl-01/hero/v2.webp')],
        ['OBJECT_MIME_MISMATCH', () => r2.put('recipes/gl-01/hero/v2.webp', BYTES_B, 'image/jpeg')],
        ['OBJECT_SIZE_MISMATCH', () => r2.put('recipes/gl-01/hero/v2.webp', BYTES_B.slice(0, 8), 'image/webp')],
        ['OBJECT_HASH_MISMATCH', () => r2.put('recipes/gl-01/hero/v2.webp', BYTES_A, 'image/webp')],
        ['OBJECT_READ_FAILED', () => { r2.put('recipes/gl-01/hero/v2.webp', BYTES_B, 'image/webp'); r2.failNextGet = new Error('r2 unavailable'); }],
      ];
      for (const [code, arrange] of attempts) {
        arrange();
        await expect(promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 2), code).rejects.toMatchObject({ code });
        expect(statuses(db, 'gl-01'), code).toEqual([[1, 'ready'], [2, 'pending']]);
        expect(await new D1RecipeMediaCatalog(db).readCurrentReady(['gl-01'], 'hero'), code).toMatchObject([{ version: 1 }]);
      }
      // Once the object is actually correct, the same pending row promotes and v1 is superseded in the same batch.
      r2.put('recipes/gl-01/hero/v2.webp', BYTES_B, 'image/webp');
      await promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 2);
      expect(statuses(db, 'gl-01')).toEqual([[1, 'superseded'], [2, 'ready']]);
    });

    it('objects above the verification bound are refused before any bytes are hashed', async () => {
      const db = database(); const r2 = new FakeR2();
      await stage(db, 'gl-01', 2, { contentLength: RECIPE_MEDIA_MAX_VERIFY_BYTES + 1, contentHash: HASH_A });
      await expect(promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 2)).rejects.toMatchObject({ code: 'OBJECT_TOO_LARGE' });
      expect(r2.requestedKeys).toEqual([]);
      expect(statuses(db, 'gl-01')).toEqual([[1, 'pending'], [2, 'pending']]);
    });

    it('a row re-staged between verification and the D1 batch cannot ride an older verification; the current ready row is untouched', async () => {
      const db = database(); const r2 = new FakeR2();
      await stageWithObject(db, r2, 'gl-01', 1, BYTES_A);
      await promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 1);
      await stageWithObject(db, r2, 'gl-01', 2, BYTES_B);
      // Simulate a concurrent writer replacing the pending row's byte identity after R2 verification, before the batch.
      db.hooks = { beforeBatch: async () => { db.seed(`UPDATE recipe_media SET content_hash = '${HASH_B}' WHERE id = 'gl-01_media_hero_v2'`); } };
      await expect(promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 2)).rejects.toMatchObject({ code: 'READY_CONFLICT' });
      expect(statuses(db, 'gl-01')).toEqual([[1, 'ready'], [2, 'pending']]);
    });

    it('two concurrent promotions of different pending versions for one recipe/role leave exactly one ready row', async () => {
      const db = database(); const r2 = new FakeR2();
      await stageWithObject(db, r2, 'gl-01', 2, BYTES_A);
      await stageWithObject(db, r2, 'gl-01', 3, BYTES_B);
      const outcomes = await Promise.allSettled([
        promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 2),
        promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 3),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
      expect(db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM recipe_media WHERE recipe_id = 'gl-01' AND status = 'ready'`)[0].n).toBe(1);
    });
  });

  it('write helpers fail closed: bad input, duplicate version, promoting non-pending, rejecting', async () => {
    const db = database();
    await expect(stage(db, 'gl-01', 2, { mimeType: 'image/svg+xml' })).rejects.toMatchObject({ code: 'UNSUPPORTED_MIME' });
    await expect(stage(db, 'gl-01', 2, { width: 0 })).rejects.toMatchObject({ code: 'INVALID_DIMENSIONS' });
    await expect(stage(db, 'gl-01', 2, { contentHash: 'nope' })).rejects.toMatchObject({ code: 'INVALID_CONTENT_HASH' });
    await expect(stage(db, 'gl-01', 2, { contentLength: -1 })).rejects.toMatchObject({ code: 'INVALID_CONTENT_LENGTH' });
    await expect(stage(db, 'gl-01', 2, { contentLength: null })).rejects.toMatchObject({ code: 'INVALID_CONTENT_LENGTH' });
    await expect(stage(db, 'gl-01', 0)).rejects.toMatchObject({ code: 'INVALID_VERSION' });
    await expect(stage(db, '../x', 2)).rejects.toMatchObject({ code: 'INVALID_RECIPE_ID' });
    await expect(stage(db, 'gl-01', 2, { sourceType: 'scraped' })).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
    await expect(stage(db, 'unknown-recipe', 2)).rejects.toThrow(/FOREIGN KEY/);
    const r2 = new FakeR2();
    await stageWithObject(db, r2, 'gl-01', 2, BYTES_A);
    await expect(stage(db, 'gl-01', 2)).rejects.toMatchObject({ code: 'VERSION_EXISTS' });
    await promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 2);
    await expect(promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 2)).rejects.toMatchObject({ code: 'NOT_PENDING' });
    await expect(promoteRecipeMediaVersion(db, r2, 'gl-01', 'hero', 9)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    // The seeded slot has no metadata: promotion is refused before R2 is even consulted.
    await expect(promoteRecipeMediaVersion(db, r2, 'gl-02', 'hero', 1)).rejects.toMatchObject({ code: 'METADATA_INCOMPLETE' });
    expect(r2.requestedKeys).toEqual(['recipes/gl-01/hero/v2.webp']);
    await stage(db, 'gl-01', 3);
    await rejectRecipeMediaVersion(db, 'gl-01', 'hero', 3);
    expect((await new D1RecipeMediaCatalog(db).readVersion('gl-01', 'hero', 3))?.status).toBe('rejected');
    await expect(rejectRecipeMediaVersion(db, 'gl-01', 'hero', 3)).rejects.toBeInstanceOf(RecipeMediaWriteError);
    expect(await new D1RecipeMediaCatalog(db).readCurrentReady(['gl-01'], 'hero')).toMatchObject([{ version: 2 }]);
  });
});
