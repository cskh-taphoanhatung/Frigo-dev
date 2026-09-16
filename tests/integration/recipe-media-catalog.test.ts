import { afterEach, describe, expect, it } from 'vitest';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import {
  auditReadyRecipeMediaRecord, buildRecipeMediaStorageKey, buildRecipeMediaUrl, classifyLegacyImageUrl, isTrustedRecipeMediaStorageKey,
  parseRecipeMediaVersion, presentRecipeMedia, resolveRecipeMedia, type RecipeMediaRecord,
} from '../../packages/recipes/src/recipe-media';
import {
  chunkRecipeIds, D1RecipeMediaCatalog, promoteRecipeMediaVersion, RECIPE_MEDIA_LOOKUP_CHUNK_SIZE, rejectRecipeMediaVersion,
  RecipeMediaWriteError, stageRecipeMediaVersion,
} from '../../packages/db/src/recipe-media';
import { SqliteD1, type SqliteStatementEvent } from '../helpers/sqlite-d1';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

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
    await stage(db, 'gl-01', 2); await promoteRecipeMediaVersion(db, 'gl-01', 'hero', 2);
    await stage(db, 'vn-canh-01', 2); await promoteRecipeMediaVersion(db, 'vn-canh-01', 'hero', 2);
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

  it('stage → promote is atomic and never leaves two current-ready versions; old version becomes superseded', async () => {
    const db = database();
    const catalog = new D1RecipeMediaCatalog(db);
    // Completing the seeded pending v1 slot (no INSERT: the row exists with storage_key NULL).
    const v1 = await stage(db, 'gl-01', 1, { contentHash: HASH_B });
    expect(v1).toMatchObject({ version: 1, status: 'pending', storageKey: 'recipes/gl-01/hero/v1.webp', contentHash: HASH_B });
    expect(await promoteRecipeMediaVersion(db, 'gl-01', 'hero', 1)).toMatchObject({ status: 'ready' });
    await stage(db, 'gl-01', 2);
    await promoteRecipeMediaVersion(db, 'gl-01', 'hero', 2);
    const rows = await catalog.readRecipe('gl-01');
    expect(rows.map((row) => [row.version, row.status])).toEqual([[2, 'ready'], [1, 'superseded']]);
    expect(db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM recipe_media WHERE recipe_id = 'gl-01' AND status = 'ready'`)[0].n).toBe(1);
    expect(await catalog.readCurrentReady(['gl-01'], 'hero')).toMatchObject([{ version: 2 }]);
  });

  it('write helpers fail closed: bad input, duplicate version, promoting non-pending, rejecting', async () => {
    const db = database();
    await expect(stage(db, 'gl-01', 2, { mimeType: 'image/svg+xml' })).rejects.toMatchObject({ code: 'UNSUPPORTED_MIME' });
    await expect(stage(db, 'gl-01', 2, { width: 0 })).rejects.toMatchObject({ code: 'INVALID_DIMENSIONS' });
    await expect(stage(db, 'gl-01', 2, { contentHash: 'nope' })).rejects.toMatchObject({ code: 'INVALID_CONTENT_HASH' });
    await expect(stage(db, 'gl-01', 2, { contentLength: -1 })).rejects.toMatchObject({ code: 'INVALID_CONTENT_LENGTH' });
    await expect(stage(db, 'gl-01', 0)).rejects.toMatchObject({ code: 'INVALID_VERSION' });
    await expect(stage(db, '../x', 2)).rejects.toMatchObject({ code: 'INVALID_RECIPE_ID' });
    await expect(stage(db, 'gl-01', 2, { sourceType: 'scraped' })).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
    await expect(stage(db, 'unknown-recipe', 2)).rejects.toThrow(/FOREIGN KEY/);
    await stage(db, 'gl-01', 2);
    await expect(stage(db, 'gl-01', 2)).rejects.toMatchObject({ code: 'VERSION_EXISTS' });
    await promoteRecipeMediaVersion(db, 'gl-01', 'hero', 2);
    await expect(promoteRecipeMediaVersion(db, 'gl-01', 'hero', 2)).rejects.toMatchObject({ code: 'NOT_PENDING' });
    await expect(promoteRecipeMediaVersion(db, 'gl-01', 'hero', 9)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    // The seeded slot has no metadata: promotion is refused rather than fabricating readiness.
    await expect(promoteRecipeMediaVersion(db, 'gl-02', 'hero', 1)).rejects.toMatchObject({ code: 'READY_CONFLICT' });
    await stage(db, 'gl-01', 3);
    await rejectRecipeMediaVersion(db, 'gl-01', 'hero', 3);
    expect((await new D1RecipeMediaCatalog(db).readVersion('gl-01', 'hero', 3))?.status).toBe('rejected');
    await expect(rejectRecipeMediaVersion(db, 'gl-01', 'hero', 3)).rejects.toBeInstanceOf(RecipeMediaWriteError);
    expect(await new D1RecipeMediaCatalog(db).readCurrentReady(['gl-01'], 'hero')).toMatchObject([{ version: 2 }]);
  });
});
