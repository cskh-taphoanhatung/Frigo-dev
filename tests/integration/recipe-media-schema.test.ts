import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import {
  RECIPE_MEDIA_MIGRATION_FILENAME, auditReadyRecipeMediaRecord, buildRecipeMediaSeedRows, buildRecipeMediaStorageKey, isTrustedRecipeMediaStorageKey,
  renderRecipeMediaLayerSql,
} from '../../packages/recipes/src/recipe-media';
import migrationManifest from '../fixtures/migration-sha256.json';
import { LEGACY_CATALOG_MIGRATION_TIP, MIGRATION_LEDGER, SqliteD1 } from '../helpers/sqlite-d1';

const HASH = 'a'.repeat(64);
const migrationFiles = () => readdirSync('migrations').filter((name) => /^\d+.*\.sql$/.test(name)).sort();
const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

describe('T14C — 0035 recipe media layer: migration, schema invariants, seed', () => {
  const databases: SqliteD1[] = [];
  // 0035 tests certify the 71-recipe media baseline; the ledger is replayed through 0035 (T14F growth migrations follow it).
  const database = (options?: { migrate?: boolean }) => { const db = new SqliteD1({ ...options, through: LEGACY_CATALOG_MIGRATION_TIP }); databases.push(db); return db; };
  afterEach(() => { for (const db of databases.splice(0)) db.close(); });

  it('is exactly the 35th migration, renders byte-for-byte from ALL_RECIPES, and 0001–0034 are pinned (no drift)', () => {
    const files = migrationFiles();
    expect(files).toHaveLength(MIGRATION_LEDGER.count);
    expect(files[34]).toBe(RECIPE_MEDIA_MIGRATION_FILENAME);
    // T14F: catalog growth migrations follow 0035; they are data-only and certified in recipe-catalog-growth tests.
    expect(files.slice(35)).toEqual(MIGRATION_LEDGER.catalogGrowth);
    expect(readFileSync(path.join('migrations', RECIPE_MEDIA_MIGRATION_FILENAME), 'utf8')).toBe(renderRecipeMediaLayerSql(ALL_RECIPES));
    const pinned = migrationManifest.migrations as Record<string, string>;
    expect(Object.keys(pinned)).toHaveLength(34);
    expect(pinned['0034_global_recipe_catalog_parity.sql']).toBe('23f356458a294b240e683fec14012bc932a8b7e57ad0c932e4fc184329bada4d');
    for (const [name, expected] of Object.entries(pinned)) expect(sha256(path.join('migrations', name)), name).toBe(expected);
  });

  it('renders deterministically, in catalog order, with 71 unique canonical pending hero slots and zero fake-ready rows', () => {
    const rows = buildRecipeMediaSeedRows(ALL_RECIPES);
    expect(rows).toHaveLength(71);
    expect(rows.map((row) => row.recipeId)).toEqual(ALL_RECIPES.map((recipe) => recipe.id));
    expect(new Set(rows.map((row) => `${row.recipeId}/${row.role}/${row.version}`)).size).toBe(71);
    expect(rows.every((row) => row.role === 'hero' && row.version === 1 && row.status === 'pending')).toBe(true);
    expect(renderRecipeMediaLayerSql(ALL_RECIPES)).toBe(renderRecipeMediaLayerSql([...ALL_RECIPES]));
    expect(renderRecipeMediaLayerSql(ALL_RECIPES)).not.toContain("'ready'),");
    expect(() => buildRecipeMediaSeedRows([...ALL_RECIPES, ALL_RECIPES[0]])).toThrow(/Duplicate recipe ID/);
    expect(() => buildRecipeMediaSeedRows([{ id: '../evil' }])).toThrow(/canonical media identity/);
    expect(() => buildRecipeMediaSeedRows([{ id: 'Upper Case' }])).toThrow(/canonical media identity/);
  });

  it('fresh replay 0001→0035: table, indexes, trigger, 71 pending slots, FK and integrity clean', () => {
    const db = database();
    expect(db.migrations).toHaveLength(35);
    expect(db.migrations.at(-1)).toBe(RECIPE_MEDIA_MIGRATION_FILENAME);
    expect(migrationFiles()[34]).toBe(RECIPE_MEDIA_MIGRATION_FILENAME);
    expect(db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM recipe_media`)[0].n).toBe(71);
    expect(db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM recipe_media WHERE status = 'pending' AND role = 'hero' AND version = 1 AND storage_key IS NULL AND source_type IS NULL`)[0].n).toBe(71);
    expect(db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM recipe_media WHERE status = 'ready'`)[0].n).toBe(0);
    expect(db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM recipes r WHERE NOT EXISTS (SELECT 1 FROM recipe_media m WHERE m.recipe_id = r.id AND m.role = 'hero')`)[0].n).toBe(0);
    const objects = db.query<{ type: string; name: string }>(`SELECT type, name FROM sqlite_master WHERE name LIKE '%recipe_media%' ORDER BY name`);
    expect(objects).toEqual(expect.arrayContaining([
      { type: 'table', name: 'recipe_media' },
      { type: 'index', name: 'idx_recipe_media_current_ready' },
      { type: 'index', name: 'idx_recipe_media_recipe_role_status' },
      { type: 'index', name: 'idx_recipe_media_content_hash' },
      { type: 'trigger', name: 'trg_recipe_media_ready_immutable_update' },
    ]));
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
    expect(db.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
  });

  it('production-like 0034→0035 upgrade: 71/385/341/71/385 catalog and non-recipe data untouched, 0035 idempotent', () => {
    const db = database({ migrate: false });
    const files = migrationFiles();
    for (const file of files.slice(0, 34)) db.seed(readFileSync(path.join('migrations', file), 'utf8'));
    expect(files[33]).toBe('0034_global_recipe_catalog_parity.sql');
    db.seed(`INSERT INTO users (id, email) VALUES ('t14c_user', 't14c@example.test');
      INSERT INTO households (id, name, created_by) VALUES ('t14c_hh', 'T14C', 't14c_user');`);
    const before = db.query(`SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM households) AS households,
      (SELECT COUNT(*) FROM inventory_items) AS inventory_items, (SELECT COUNT(*) FROM inventory_lots) AS lots,
      (SELECT COUNT(*) FROM inventory_events) AS events, (SELECT COUNT(*) FROM meal_plans) AS meal_plans, (SELECT COUNT(*) FROM scans) AS scans,
      (SELECT COUNT(*) FROM cooked_meals) AS cooked_meals, (SELECT COUNT(*) FROM recipes) AS recipes, (SELECT COUNT(*) FROM recipe_ingredients) AS lines,
      (SELECT COUNT(*) FROM recipe_steps) AS steps, (SELECT COUNT(*) FROM recipe_runtime_fields) AS fields,
      (SELECT COUNT(*) FROM recipe_runtime_ingredient_order) AS positions`)[0];
    expect(before).toMatchObject({ recipes: 71, lines: 385, steps: 341, fields: 71, positions: 385, users: expect.any(Number) });
    const recipesBefore = db.query(`SELECT * FROM recipes ORDER BY id`);
    expect(db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'recipe_media'`)[0].n).toBe(0);

    const sql = readFileSync(path.join('migrations', RECIPE_MEDIA_MIGRATION_FILENAME), 'utf8');
    db.seed(sql);
    db.seed(sql); // operator re-run after an interrupted apply
    expect(db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM recipe_media`)[0].n).toBe(71);
    expect(db.query(`SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM households) AS households,
      (SELECT COUNT(*) FROM inventory_items) AS inventory_items, (SELECT COUNT(*) FROM inventory_lots) AS lots,
      (SELECT COUNT(*) FROM inventory_events) AS events, (SELECT COUNT(*) FROM meal_plans) AS meal_plans, (SELECT COUNT(*) FROM scans) AS scans,
      (SELECT COUNT(*) FROM cooked_meals) AS cooked_meals, (SELECT COUNT(*) FROM recipes) AS recipes, (SELECT COUNT(*) FROM recipe_ingredients) AS lines,
      (SELECT COUNT(*) FROM recipe_steps) AS steps, (SELECT COUNT(*) FROM recipe_runtime_fields) AS fields,
      (SELECT COUNT(*) FROM recipe_runtime_ingredient_order) AS positions`)[0]).toEqual(before);
    expect(db.query(`SELECT * FROM recipes ORDER BY id`)).toEqual(recipesBefore);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
    expect(db.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
  });

  describe('fail-closed constraints', () => {
    const insert = (db: SqliteD1, columns: Record<string, unknown>) => {
      const keys = Object.keys(columns);
      return db.seed(`INSERT INTO recipe_media (${keys.join(', ')}) VALUES (${keys.map((key) => {
        const value = columns[key];
        return value === null ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replace(/'/g, "''")}'`;
      }).join(', ')})`);
    };
    const ready = (overrides: Record<string, unknown> = {}) => ({
      id: 'gl-01_media_hero_v2', recipe_id: 'gl-01', role: 'hero', version: 2, status: 'ready', source_type: 'uploaded',
      storage_key: 'recipes/gl-01/hero/v2.webp', mime_type: 'image/webp', width: 1200, height: 800, content_length: 12345, content_hash: HASH,
      ...overrides,
    });

    it('accepts a complete ready row and enforces FK, role, status, source, version >= 1 and UNIQUE(recipe, role, version)', () => {
      const db = database();
      insert(db, ready());
      expect(db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM recipe_media WHERE status = 'ready'`)[0].n).toBe(1);
      expect(() => insert(db, ready({ id: 'x1', recipe_id: 'unknown-recipe', version: 3, storage_key: 'recipes/unknown-recipe/hero/v3.webp' }))).toThrow(/FOREIGN KEY/);
      expect(() => insert(db, ready({ id: 'x2', role: 'banner', version: 3, storage_key: 'recipes/gl-01/banner/v3.webp' }))).toThrow(/CHECK/);
      expect(() => insert(db, ready({ id: 'x3', status: 'published', version: 3, storage_key: 'recipes/gl-01/hero/v3.webp' }))).toThrow(/CHECK/);
      expect(() => insert(db, ready({ id: 'x4', source_type: 'scraped', version: 3, storage_key: 'recipes/gl-01/hero/v3.webp' }))).toThrow(/CHECK/);
      expect(() => insert(db, ready({ id: 'x5', version: 0, storage_key: 'recipes/gl-01/hero/v0.webp' }))).toThrow(/CHECK/);
      expect(() => insert(db, ready({ id: 'x6', version: -1, storage_key: 'recipes/gl-01/hero/v-1.webp' }))).toThrow(/CHECK/);
      expect(() => insert(db, ready({ id: 'x7', version: 1, status: 'pending', storage_key: null, mime_type: null, width: null, height: null, content_hash: null }))).toThrow(/UNIQUE/);
    });

    it('ready invariant: no ready row without storage_key, mime, dimensions, content_length and a 64-hex SHA-256; dimensions/length validated', () => {
      const db = database();
      for (const missing of ['storage_key', 'mime_type', 'width', 'height', 'content_length', 'content_hash']) {
        expect(() => insert(db, ready({ [missing]: null })), missing).toThrow(/CHECK/);
      }
      expect(() => insert(db, ready({ width: 0 }))).toThrow(/CHECK/);
      expect(() => insert(db, ready({ height: -5 }))).toThrow(/CHECK/);
      expect(() => insert(db, ready({ content_length: -1 }))).toThrow(/CHECK/);
      expect(() => insert(db, ready({ content_hash: 'abc' }))).toThrow(/CHECK/);
      expect(() => insert(db, ready({ content_hash: 'Z'.repeat(64) }))).toThrow(/CHECK/);
      expect(() => insert(db, ready({ mime_type: 'image/svg+xml', storage_key: 'recipes/gl-01/hero/v2.svg' }))).toThrow(/CHECK/);
      expect(() => insert(db, ready({ mime_type: 'text/html', storage_key: 'recipes/gl-01/hero/v2.html' }))).toThrow(/CHECK/);
      // ready_missing_content_length: a verified canonical asset always has a known size.
      expect(() => insert(db, ready({ content_length: null }))).toThrow(/CHECK/);
      // Pending rows keep truthful nullability: metadata may be absent or partially staged.
      insert(db, ready({ status: 'pending', content_length: null }));
      insert(db, ready({ id: 'gl-01_media_hero_v3', version: 3, status: 'pending', storage_key: null, mime_type: null, width: null, height: null, content_length: null, content_hash: null }));
      expect(db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM recipe_media WHERE status = 'ready'`)[0].n).toBe(0);
    });

    it('storage_key contract: traversal, backslash, absolute, query, wrong prefix and MIME/extension mismatch are rejected', () => {
      const db = database();
      const bad = [
        'recipes/gl-01/hero/../v2.webp', 'recipes/gl-01/hero/v2.webp?x=1', 'recipes/gl-01/hero/v2.webp#f', '/recipes/gl-01/hero/v2.webp',
        'recipes\\gl-01\\hero\\v2.webp', 'recipes/gl-02/hero/v2.webp', 'recipes/gl-01/thumbnail/v2.webp', 'recipes/gl-01/hero/v3.webp',
        'users/x/scans/y/original.webp', 'recipes/gl-01/hero/v2.js',
      ];
      for (const key of bad) expect(() => insert(db, ready({ storage_key: key })), key).toThrow(/CHECK/);
      expect(() => insert(db, ready({ mime_type: 'image/png' }))).toThrow(/CHECK/); // .webp key with png mime
    });

    it('noncanonical_SQL_storage_suffix: SQL requires the EXACT deterministic key, not merely prefix + extension (P2 remediation)', () => {
      const db = database();
      const nonCanonical = [
        'recipes/gl-01/hero/v2.foo.webp', 'recipes/gl-01/hero/v2..webp', 'recipes/gl-01/hero/v2.extra.webp', 'recipes/gl-01/hero/v2.jpeg',
        'recipes/gl-01/hero/v2.webp/', 'recipes/gl-01/hero/v2.webp.webp', 'recipes/gl-01/hero/v2.WEBP', 'recipes/gl-01/hero/v02.webp',
        'recipes/gl-01/hero/v2.webp ', ' recipes/gl-01/hero/v2.webp', 'Recipes/gl-01/hero/v2.webp', 'recipes/gl-01/hero/2.webp', 'recipes/gl-01/hero/v2',
      ];
      for (const key of nonCanonical) {
        expect(() => insert(db, ready({ storage_key: key })), key).toThrow(/CHECK/);
        expect(isTrustedRecipeMediaStorageKey(key, 'gl-01', 'hero', 2, 'image/webp'), key).toBe(false);
      }
      // A key without a MIME type has no derivable extension and is refused, even on a pending row.
      expect(() => insert(db, ready({ status: 'pending', mime_type: null }))).toThrow(/CHECK/);
      expect(() => insert(db, ready({ mime_type: 'image/jpeg', storage_key: 'recipes/gl-01/hero/v2.jpeg' }))).toThrow(/CHECK/); // no alternate .jpeg
    });

    it('SQL and buildRecipeMediaStorageKey agree exactly for every allow-listed MIME (webp/avif/jpg/png) — contract parity', () => {
      const db = database();
      const expected: Record<string, string> = { 'image/webp': 'recipes/gl-01/hero/v2.webp', 'image/avif': 'recipes/gl-01/hero/v2.avif', 'image/jpeg': 'recipes/gl-01/hero/v2.jpg', 'image/png': 'recipes/gl-01/hero/v2.png' };
      for (const [mime, key] of Object.entries(expected)) {
        expect(buildRecipeMediaStorageKey('gl-01', 'hero', 2, mime as never)).toBe(key);
        db.seed(`DELETE FROM recipe_media WHERE id = 'gl-01_media_hero_v2'`);
        insert(db, ready({ mime_type: mime, storage_key: key }));
        const row = db.query<{ storage_key: string; mime_type: string }>(`SELECT storage_key, mime_type FROM recipe_media WHERE id = 'gl-01_media_hero_v2'`)[0];
        expect(row).toEqual({ storage_key: key, mime_type: mime });
        // Every other MIME's extension is rejected for this mime_type.
        for (const otherKey of Object.values(expected).filter((candidate) => candidate !== key)) {
          expect(() => insert(db, ready({ id: 'gl-01_media_hero_v9', version: 9, status: 'pending', mime_type: mime, storage_key: otherKey.replace('/v2.', '/v9.') })), `${mime} ${otherKey}`).toThrow(/CHECK/);
        }
      }
      // Thumbnail role and a Vietnamese id derive and validate identically.
      insert(db, ready({ id: 'vn-canh-01_media_thumbnail_v5', recipe_id: 'vn-canh-01', role: 'thumbnail', version: 5, storage_key: buildRecipeMediaStorageKey('vn-canh-01', 'thumbnail', 5, 'image/webp') }));
    });

    it('SQL ready invariant and auditReadyRecipeMediaRecord accept/reject the same core metadata states (app/SQL parity)', () => {
      const db = database();
      const cases: Array<[string, Record<string, unknown>]> = [
        ['complete', {}],
        ['missing content_length', { content_length: null }],
        ['missing content_hash', { content_hash: null }],
        ['missing width', { width: null }],
        ['missing height', { height: null }],
        ['zero width', { width: 0 }],
        ['negative content_length', { content_length: -1 }],
        ['short hash', { content_hash: 'abc' }],
        ['extra suffix key', { storage_key: 'recipes/gl-01/hero/v2.foo.webp' }],
        ['wrong extension key', { storage_key: 'recipes/gl-01/hero/v2.png' }],
        ['other recipe key', { storage_key: 'recipes/gl-02/hero/v2.webp' }],
        ['other role key', { storage_key: 'recipes/gl-01/thumbnail/v2.webp' }],
        ['other version key', { storage_key: 'recipes/gl-01/hero/v3.webp' }],
        ['avif', { mime_type: 'image/avif', storage_key: 'recipes/gl-01/hero/v2.avif' }],
        ['jpeg', { mime_type: 'image/jpeg', storage_key: 'recipes/gl-01/hero/v2.jpg' }],
      ];
      for (const [label, overrides] of cases) {
        const columns = ready(overrides);
        let sqlAccepts = true;
        try { insert(db, columns); db.seed(`DELETE FROM recipe_media WHERE id = 'gl-01_media_hero_v2'`); } catch { sqlAccepts = false; }
        const issues = auditReadyRecipeMediaRecord({
          id: String(columns.id), recipeId: String(columns.recipe_id), role: columns.role as 'hero', version: Number(columns.version), status: 'ready', sourceType: 'uploaded',
          storageKey: columns.storage_key as string | null, mimeType: columns.mime_type as string | null, width: columns.width as number | null, height: columns.height as number | null,
          contentLength: columns.content_length as number | null, contentHash: columns.content_hash as string | null,
          sourceReference: null, generatorProvider: null, generatorModel: null, promptHash: null, createdAt: 't', updatedAt: 't',
        });
        expect(issues.length === 0, `${label}: sql=${sqlAccepts} app_issues=${issues.join(',')}`).toBe(sqlAccepts);
      }
    });

    it('at most one current-ready version per recipe/role; superseded/rejected/pending versions may coexist', () => {
      const db = database();
      insert(db, ready());
      expect(() => insert(db, ready({ id: 'gl-01_media_hero_v3', version: 3, storage_key: 'recipes/gl-01/hero/v3.webp' }))).toThrow(/UNIQUE/);
      insert(db, ready({ id: 'gl-01_media_hero_v3', version: 3, status: 'superseded', storage_key: 'recipes/gl-01/hero/v3.webp' }));
      insert(db, ready({ id: 'gl-01_media_hero_v4', version: 4, status: 'rejected', storage_key: 'recipes/gl-01/hero/v4.webp' }));
      insert(db, ready({ id: 'gl-01_media_thumbnail_v1', role: 'thumbnail', version: 1, storage_key: 'recipes/gl-01/thumbnail/v1.webp' }));
      expect(db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM recipe_media WHERE recipe_id = 'gl-01'`)[0].n).toBe(5);
      expect(db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM recipe_media WHERE recipe_id = 'gl-01' AND status = 'ready'`)[0].n).toBe(2);
    });

    it('ready versions are immutable: bytes-identity columns cannot change, status transitions still allowed', () => {
      const db = database();
      insert(db, ready());
      expect(() => db.seed(`UPDATE recipe_media SET content_hash = '${'b'.repeat(64)}' WHERE id = 'gl-01_media_hero_v2'`)).toThrow(/immutable/);
      expect(() => db.seed(`UPDATE recipe_media SET storage_key = 'recipes/gl-01/hero/v2.png', mime_type = 'image/png' WHERE id = 'gl-01_media_hero_v2'`)).toThrow(/immutable/);
      db.seed(`UPDATE recipe_media SET status = 'superseded' WHERE id = 'gl-01_media_hero_v2'`);
      expect(db.query<{ status: string }>(`SELECT status FROM recipe_media WHERE id = 'gl-01_media_hero_v2'`)[0].status).toBe('superseded');
    });

    it('deleting a recipe cascades its media; content_hash lookups are indexed for future dedupe', () => {
      const db = database();
      insert(db, ready());
      const plan = db.query<{ detail: string }>(`EXPLAIN QUERY PLAN SELECT id FROM recipe_media WHERE content_hash = '${HASH}'`);
      expect(plan.some((row) => /idx_recipe_media_content_hash/.test(row.detail))).toBe(true);
      db.seed(`DELETE FROM recipe_media WHERE recipe_id = 'gl-01'`);
      expect(db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM recipe_media WHERE recipe_id = 'gl-01'`)[0].n).toBe(0);
    });
  });
});
