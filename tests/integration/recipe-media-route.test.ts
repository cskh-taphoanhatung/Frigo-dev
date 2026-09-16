import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { rankRecipes } from '../../packages/recipes/src/engine';
import { promoteRecipeMediaVersion, stageRecipeMediaVersion } from '../../packages/db/src/recipe-media';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { recipeRoutes } from '../../src/worker/routes/recipes';
import { RECIPE_MEDIA_IMMUTABLE_CACHE_CONTROL, recipeMediaRoutes } from '../../src/worker/routes/recipe-media';
import { attachRecipeMedia, resetRecipeMediaDiagnosticsForTests } from '../../src/worker/services/recipe-media';
import type { AuthContext, Env } from '../../src/worker/types';
import { signJwt } from '../../src/worker/utils/jwt';
import { fetchWorker } from '../helpers/worker-fetch.mjs';
import { SqliteD1 } from '../helpers/sqlite-d1';

// The Workers-only cloudflare:email module cannot load in Node; no network mail is sent.
vi.mock('../../src/worker/services/email', () => ({
  sendEmail: vi.fn(async () => ({ sent: true, provider: 'test' })),
  buildOtpEmail: (code: string) => ({ subject: 'Test OTP', html: `<p>${code}</p>`, text: code }),
}));

const secret = 'media-secret-that-is-definitely-long-enough';
const USER = 'media-user';
const HOUSEHOLD = 'media-house';
const HASH = 'c'.repeat(64);
const WEBP_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

/** Deterministic in-memory R2 double: records every key requested so tests can prove no arbitrary reads. */
class FakeR2 {
  readonly objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  readonly requestedKeys: string[] = [];
  put(key: string, bytes: Uint8Array, contentType?: string) { this.objects.set(key, { bytes, contentType }); }
  async get(key: string) {
    this.requestedKeys.push(key);
    const object = this.objects.get(key);
    if (!object) return null;
    return { body: new Blob([object.bytes as BlobPart]).stream(), size: object.bytes.byteLength, httpMetadata: object.contentType ? { contentType: object.contentType } : undefined };
  }
}

async function stageReady(db: SqliteD1, recipeId: string, version: number, extra: Record<string, unknown> = {}) {
  await stageRecipeMediaVersion(db, { recipeId, role: 'hero', version, mimeType: 'image/webp', width: 1200, height: 800, contentLength: WEBP_BYTES.byteLength, contentHash: HASH, sourceType: 'uploaded', ...extra } as never);
  return promoteRecipeMediaVersion(db, recipeId, 'hero', version);
}

describe('T14C — GET /api/v1/recipe-media/:recipeId/:role/:version (secure same-origin serving)', () => {
  let db: SqliteD1;
  let r2: FakeR2;
  const logs: string[] = [];
  const originalWarn = console.warn;
  const env = () => ({ DB: db, IMAGES: r2, ENVIRONMENT: 'test', JWT_SECRET: secret }) as unknown as Env;
  const get = (path: string, init: RequestInit = {}, overrides: Partial<Env> = {}) =>
    fetchWorker(new Request(`https://media.local${path}`, init), { ...env(), ...overrides });

  beforeEach(async () => {
    db = new SqliteD1();
    r2 = new FakeR2();
    await stageReady(db, 'gl-01', 2);
    r2.put('recipes/gl-01/hero/v2.webp', WEBP_BYTES, 'image/webp');
    logs.length = 0;
    resetRecipeMediaDiagnosticsForTests();
    console.warn = (line?: unknown) => { logs.push(String(line)); };
  });
  afterEach(() => { console.warn = originalWarn; db.close(); });

  it('serves a ready canonical asset without auth, with immutable cache, ETag from content hash, nosniff and exact MIME', async () => {
    const response = await get('/api/v1/recipe-media/gl-01/hero/2');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cache-control')).toBe(RECIPE_MEDIA_IMMUTABLE_CACHE_CONTROL);
    expect(response.headers.get('etag')).toBe(`"${HASH}"`);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(WEBP_BYTES);
    expect(r2.requestedKeys).toEqual(['recipes/gl-01/hero/v2.webp']);
    const notModified = await get('/api/v1/recipe-media/gl-01/hero/2', { headers: { 'if-none-match': `"${HASH}"` } });
    expect(notModified.status).toBe(304);
    const head = await get('/api/v1/recipe-media/gl-01/hero/2', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(head.headers.get('cache-control')).toBe(RECIPE_MEDIA_IMMUTABLE_CACHE_CONTROL);
    expect(await head.text()).toBe('');
  });

  it.each([
    ['unknown recipe', '/api/v1/recipe-media/no-such-recipe/hero/1', 404, 'RECIPE_MEDIA_NOT_FOUND'],
    ['invalid role', '/api/v1/recipe-media/gl-01/banner/2', 404, 'RECIPE_MEDIA_INVALID_ROLE'],
    ['version zero', '/api/v1/recipe-media/gl-01/hero/0', 404, 'RECIPE_MEDIA_INVALID_VERSION'],
    ['negative version', '/api/v1/recipe-media/gl-01/hero/-1', 404, 'RECIPE_MEDIA_INVALID_VERSION'],
    ['huge version', '/api/v1/recipe-media/gl-01/hero/99999999999', 404, 'RECIPE_MEDIA_INVALID_VERSION'],
    ['non-numeric version', '/api/v1/recipe-media/gl-01/hero/v2.webp', 404, 'RECIPE_MEDIA_INVALID_VERSION'],
    ['float version', '/api/v1/recipe-media/gl-01/hero/2.0', 404, 'RECIPE_MEDIA_INVALID_VERSION'],
    ['uppercase recipe id', '/api/v1/recipe-media/GL-01/hero/2', 404, 'RECIPE_MEDIA_INVALID_RECIPE'],
    ['encoded slash', '/api/v1/recipe-media/gl-01%2f..%2fusers/hero/2', 404, 'RECIPE_MEDIA_INVALID_PATH'],
    ['double encoding', '/api/v1/recipe-media/gl-01%252f/hero/2', 404, 'RECIPE_MEDIA_INVALID_PATH'],
    ['encoded backslash', '/api/v1/recipe-media/gl-01%5c..%5cx/hero/2', 404, 'RECIPE_MEDIA_INVALID_PATH'],
    ['pending version (seeded v1)', '/api/v1/recipe-media/gl-02/hero/1', 409, 'RECIPE_MEDIA_PENDING'],
    ['unknown version', '/api/v1/recipe-media/gl-01/hero/9', 404, 'RECIPE_MEDIA_NOT_FOUND'],
  ])('%s (%s) → %i %s with no-store and no R2 access', async (_label, path, status, code) => {
    const response = await get(path);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: 'Recipe media unavailable', code });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(r2.requestedKeys).toEqual([]);
  });

  it('traversal in raw or encoded path segments can only ever reach the trusted derived key, never an arbitrary object', async () => {
    r2.put('users/x/scans/y/original.webp', WEBP_BYTES, 'image/webp');
    const paths = [
      '/api/v1/recipe-media/../../users/x/hero/2', '/api/v1/recipe-media/%2e%2e/hero/2', '/api/v1/recipe-media/gl-01/hero/2%00',
      '/api/v1/recipe-media/gl-01/hero/2/../../../gl-01/hero/2', '/api/v1/recipe-media/..%2f..%2fusers%2fx%2fscans%2fy%2foriginal.webp/hero/2',
      '/api/v1/recipe-media/gl-01/hero/2?key=users/x/scans/y/original.webp', '/api/v1/recipe-media/gl-01/hero/2#users',
    ];
    for (const path of paths) {
      const response = await get(path);
      expect([200, 401, 404]).toContain(response.status);
      // A 200 is either the SPA shell (path normalised away from the media route) or the trusted gl-01 asset.
      if (response.status === 200 && response.headers.get('content-type')?.startsWith('image/')) expect(response.headers.get('etag')).toBe(`"${HASH}"`);
    }
    // URL normalisation may collapse `..` into the valid gl-01 path; that is the ONLY key R2 ever saw.
    expect(new Set(r2.requestedKeys)).toEqual(new Set(['recipes/gl-01/hero/v2.webp']));
  });

  it('rejected and superseded versions are 409; a superseded version does not serve stale bytes', async () => {
    await stageReady(db, 'gl-01', 3);
    r2.put('recipes/gl-01/hero/v3.webp', WEBP_BYTES, 'image/webp');
    const superseded = await get('/api/v1/recipe-media/gl-01/hero/2');
    expect(superseded.status).toBe(409);
    expect(await superseded.json()).toMatchObject({ code: 'RECIPE_MEDIA_SUPERSEDED' });
    db.seed(`UPDATE recipe_media SET status = 'rejected' WHERE id = 'gl-03_media_hero_v1'`);
    const rejected = await get('/api/v1/recipe-media/gl-03/hero/1');
    expect(rejected.status).toBe(409);
    expect(await rejected.json()).toMatchObject({ code: 'RECIPE_MEDIA_REJECTED' });
    expect(r2.requestedKeys).toEqual([]);
    expect((await get('/api/v1/recipe-media/gl-01/hero/3')).status).toBe(200);
  });

  it('missing R2 object → 404 + diagnostic; object MIME mismatch → 415; size mismatch → 409; never unrelated bytes', async () => {
    r2.objects.clear();
    const missing = await get('/api/v1/recipe-media/gl-01/hero/2');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ code: 'RECIPE_MEDIA_OBJECT_MISSING' });
    r2.put('recipes/gl-01/hero/v2.webp', WEBP_BYTES, 'text/html');
    const mime = await get('/api/v1/recipe-media/gl-01/hero/2');
    expect(mime.status).toBe(415);
    expect(await mime.text()).not.toContain('RIFF');
    r2.put('recipes/gl-01/hero/v2.webp', new Uint8Array(3), 'image/webp');
    expect((await get('/api/v1/recipe-media/gl-01/hero/2')).status).toBe(409);
    const events = logs.map((line) => JSON.parse(line).event);
    expect(events).toEqual(expect.arrayContaining(['recipe_media_object_missing', 'recipe_media_mime_rejected', 'recipe_media_invalid']));
    expect(logs.join('\n')).not.toMatch(/recipes\/gl-01\/hero|RIFF|secret/);
  });

  it('metadata tampered after readiness (trigger bypassed by direct status flip) is refused: untrusted key never reaches R2', async () => {
    db.seed(`UPDATE recipe_media SET status = 'superseded' WHERE id = 'gl-01_media_hero_v2'`);
    // Passes the SQL prefix/extension CHECKs but is not the exact derived key; the app-level trust check must still refuse it.
    db.seed(`UPDATE recipe_media SET storage_key = 'recipes/gl-01/hero/v2.x.webp' WHERE id = 'gl-01_media_hero_v2'`);
    r2.put('recipes/gl-01/hero/v2.x.webp', WEBP_BYTES, 'image/webp');
    expect(() => db.seed(`UPDATE recipe_media SET status = 'ready' WHERE id = 'gl-01_media_hero_v2'`)).not.toThrow();
    const response = await get('/api/v1/recipe-media/gl-01/hero/2');
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'RECIPE_MEDIA_METADATA_INVALID' });
    expect(r2.requestedKeys).toEqual([]);
  });

  it('no DB or no IMAGES binding → 503, never 500; D1 read failure → 503 with diagnostic', async () => {
    expect((await get('/api/v1/recipe-media/gl-01/hero/2', {}, { IMAGES: undefined })).status).toBe(503);
    const broken = { prepare: () => { throw new Error('boom'); }, batch: () => { throw new Error('boom'); } } as unknown as Env['DB'];
    const failing = await get('/api/v1/recipe-media/gl-01/hero/2', {}, { DB: broken });
    expect(failing.status).toBe(503);
    expect(logs.some((line) => line.includes('recipe_media_read_failed'))).toBe(true);
  });

  it('diagnostics are bounded per window and never include bytes/keys', async () => {
    r2.objects.clear();
    for (let index = 0; index < 30; index += 1) await get('/api/v1/recipe-media/gl-01/hero/2');
    expect(logs.length).toBeLessThanOrEqual(20);
    expect(logs.every((line) => !/recipes\/gl-01\/hero\/v2\.webp/.test(line))).toBe(true);
  });

  it('is not a public write surface: POST/PUT/DELETE on the media path are not routed to media', async () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const response = await get('/api/v1/recipe-media/gl-01/hero/2', { method });
      expect([401, 403, 404, 405]).toContain(response.status);
    }
    expect(r2.requestedKeys).toEqual([]);
  });
});

describe('T14C — recipe API presentation, ranking/planner/cooking parity, degraded media path', () => {
  const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
  app.use('*', authMiddleware);
  app.route('/', recipeRoutes);
  app.route('/', recipeMediaRoutes);
  let db: SqliteD1;
  let token: string;
  const logs: string[] = [];
  const originalWarn = console.warn;

  beforeEach(async () => {
    db = new SqliteD1();
    db.seed(`INSERT INTO users(id) VALUES ('${USER}');
      INSERT INTO households(id, name, created_by) VALUES ('${HOUSEHOLD}', 'Media', '${USER}');
      INSERT INTO household_members(id, household_id, user_id, role) VALUES ('mm', '${HOUSEHOLD}', '${USER}', 'owner');
      INSERT INTO inventory_items (id, household_id, ingredient_id, name, quantity, unit, category, storage, freshness, data_source) VALUES
        ('m-eggs', '${HOUSEHOLD}', 'CHICKEN_EGG', 'Trứng gà', 12, 'piece', 'egg', 'fridge', 'fresh', 'manual'),
        ('m-tomato', '${HOUSEHOLD}', 'TOMATO', 'Cà chua', 10, 'piece', 'vegetable', 'fridge', 'fresh', 'manual'),
        ('m-oil', '${HOUSEHOLD}', 'COOKING_OIL', 'Dầu ăn', 300, 'ml', 'spice', 'pantry', 'fresh', 'manual');`);
    token = await signJwt({ sub: USER, hid: HOUSEHOLD, typ: 'access', exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
    logs.length = 0;
    resetRecipeMediaDiagnosticsForTests();
    console.warn = (line?: unknown) => { logs.push(String(line)); };
  });
  afterEach(() => { console.warn = originalWarn; db.close(); });

  async function request(path: string, env: Partial<Env> = {}) {
    const response = await app.fetch(new Request(`https://media.local${path}`, { headers: { Authorization: `Bearer ${token}` } }),
      { DB: db, ENVIRONMENT: 'test', JWT_SECRET: secret, WEEK_SCHEMA_MODE: 'legacy', ...env } as unknown as Env);
    return { status: response.status, json: await response.json() as Record<string, any> };
  }

  it('GET /recipes: ALL_RECIPES content and order unchanged, imageUrl preserved, additive media with truthful fallback sources', async () => {
    await stageReady(db, 'gl-01', 2);
    const { status, json } = await request('/recipes');
    expect(status).toBe(200);
    expect(json.recipes.map((recipe: any) => recipe.id)).toEqual(ALL_RECIPES.map((recipe) => recipe.id));
    const stripped = json.recipes.map(({ media: _media, ...rest }: any) => rest);
    expect(stripped).toEqual(JSON.parse(JSON.stringify(ALL_RECIPES)));
    const byId = new Map<string, any>(json.recipes.map((recipe: any) => [recipe.id, recipe]));
    expect(byId.get('gl-01').media).toEqual({ hero: { url: '/api/v1/recipe-media/gl-01/hero/2', source: 'canonical_r2', version: 2, width: 1200, height: 800 } });
    expect(byId.get('gl-02').media.hero).toEqual({ url: '/frigo/recipes/global/mapo-tofu.webp', source: 'legacy_static', version: null, width: null, height: null });
    expect(byId.get('vn-canh-01').media.hero.source).toBe('legacy_external');
    expect(JSON.stringify(json)).not.toMatch(/storage_key|storageKey|recipes\/gl-01\/hero|prompt/);
    const sources = json.recipes.map((recipe: any) => recipe.media.hero.source);
    expect(sources.filter((source: string) => source === 'canonical_r2')).toHaveLength(1);
    expect(sources.filter((source: string) => source === 'legacy_static')).toHaveLength(11);
    expect(sources.filter((source: string) => source === 'legacy_external')).toHaveLength(59);
  });

  it('GET /recipes/:id carries media; filters still apply before media', async () => {
    const detail = await request('/recipes/gl-01');
    expect(detail.status).toBe(200);
    expect(detail.json.recipe.media.hero.source).toBe('legacy_static');
    expect(detail.json.match).toBeDefined();
    const korean = await request('/recipes?cuisine=korean');
    expect(korean.json.recipes.map((recipe: any) => recipe.id)).toEqual(ALL_RECIPES.filter((recipe) => recipe.cuisine === 'korean').map((recipe) => recipe.id));
  });

  it('GET /recommendations: ranking identical before/after media enrichment (ids, order, scores)', async () => {
    await stageReady(db, 'gl-03', 2); // a highly matching recipe gets canonical media; ranking must not move
    const { json } = await request('/recommendations');
    const withMedia = json.recommendations;
    const inventory = [
      { ingredientId: 'CHICKEN_EGG', quantity: 12, unit: 'piece' }, { ingredientId: 'TOMATO', quantity: 10, unit: 'piece' }, { ingredientId: 'COOKING_OIL', quantity: 300, unit: 'ml' },
    ];
    const expected = rankRecipes(ALL_RECIPES, { inventory: inventory as never });
    expect(withMedia.map((entry: any) => [entry.recipe.id, entry.matchPercentage])).toEqual(expected.map((entry) => [entry.recipe.id, entry.matchPercentage]));
    expect(withMedia.map(({ recipe, ...rest }: any) => ({ ...rest, recipe: (({ media: _m, ...recipeRest }) => recipeRest)(recipe) }))).toEqual(JSON.parse(JSON.stringify(expected)));
    expect(withMedia.find((entry: any) => entry.recipe.id === 'gl-03').recipe.media.hero.source).toBe('canonical_r2');
  });

  it('D1 media failure degrades to legacy presentation with one diagnostic; GET /recipes stays 200 with identical content/order', async () => {
    const healthy = await request('/recipes');
    const broken = { prepare: () => { throw new Error('boom'); }, batch: () => { throw new Error('boom'); } } as unknown as Env['DB'];
    const response = await app.fetch(new Request('https://media.local/recipes', { headers: { Authorization: `Bearer ${token}` } }),
      { DB: broken, ENVIRONMENT: 'test', JWT_SECRET: secret } as unknown as Env);
    expect(response.status).toBe(200);
    const json = await response.json() as any;
    expect(json.recipes.map((recipe: any) => recipe.id)).toEqual(healthy.json.recipes.map((recipe: any) => recipe.id));
    expect(json.recipes.every((recipe: any) => recipe.media.hero.source !== 'canonical_r2')).toBe(true);
    expect(logs.filter((line) => line.includes('recipe_media_read_failed'))).toHaveLength(1);
  });

  it('attachRecipeMedia is order-preserving and pure', () => {
    const recipes = ALL_RECIPES.slice(0, 5);
    const frozen = JSON.stringify(recipes);
    const attached = attachRecipeMedia(recipes, []);
    expect(attached.map((recipe) => recipe.id)).toEqual(recipes.map((recipe) => recipe.id));
    expect(JSON.stringify(recipes)).toBe(frozen);
    expect(attached.every((recipe) => 'imageUrl' in recipe && 'media' in recipe)).toBe(true);
  });

  it('media tables add zero inventory writers/readers: cooking still writes only through the legacy inventory batch, unchanged', async () => {
    await stageReady(db, 'gl-03', 2);
    const before = db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM inventory_events`)[0].n;
    const response = await app.fetch(new Request('https://media.local/recipes/gl-03/cook/complete', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 't14c-cook-1' },
      body: JSON.stringify({ servings: 2, deductions: [{ ingredientId: 'TOMATO', quantityDeducted: 2, unit: 'piece' }] }),
    }), { DB: db, ENVIRONMENT: 'test', JWT_SECRET: secret, WEEK_SCHEMA_MODE: 'legacy' } as unknown as Env);
    expect([200, 201]).toContain(response.status);
    expect(db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM inventory_events`)[0].n).toBeGreaterThan(before);
    expect(db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM recipe_media WHERE updated_at <> created_at AND recipe_id <> 'gl-03'`)[0].n).toBe(0);
    expect(db.query<{ sql: string }>(`SELECT sql FROM sqlite_master WHERE type = 'trigger' AND sql LIKE '%recipe_media%' AND sql LIKE '%inventory%'`)).toEqual([]);
  });
});
