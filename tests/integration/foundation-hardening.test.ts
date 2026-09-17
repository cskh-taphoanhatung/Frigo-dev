import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addIngredientAlias, createIngredientDefinition } from '../../packages/db/src/catalog';
import { IngredientDefinitionSchema } from '../../packages/domain/src/foundation';
import { SqliteD1 } from '../helpers/sqlite-d1';
import { renderSchemaGateSql } from '../../scripts/d1-schema-gate.mjs';

const migrationDirectory = path.resolve(process.cwd(), 'migrations');
const hardeningMigration = readFileSync(
  path.join(migrationDirectory, '0020_t01_foundation_hardening.sql'),
  'utf8',
);
const schemaGate = renderSchemaGateSql();

describe('T01 foundation integrity hardening', () => {
  const databases: SqliteD1[] = [];
  const database = (migrate = true) => {
    const db = new SqliteD1({ migrate });
    databases.push(db);
    return db;
  };
  afterEach(() => {
    for (const db of databases.splice(0)) db.close();
  });

  function nutritionFixture(db: SqliteD1) {
    db.seed(`INSERT INTO nutrition_profiles
      (id, basis_quantity, basis_unit, source_type, source_reference, protein_g)
      VALUES ('current_profile', 1, 'serving', 'calculated', 'fixture:v2', 20);
      UPDATE recipes SET version = 2 WHERE id = 'vn-canh-01';
      INSERT INTO recipe_nutrition VALUES ('vn-canh-01', 2, 'current_profile');`);
  }

  function beforeHardening() {
    const db = database(false);
    for (const file of readdirSync(migrationDirectory)
      .filter((name) => /^\d{4}_.*\.sql$/.test(name) && Number(name.slice(0, 4)) <= 19)
      .sort()) {
      db.seed(readFileSync(path.join(migrationDirectory, file), 'utf8'));
    }
    return db;
  }

  function catalogSnapshot(db: SqliteD1) {
    return [
      'ingredients',
      'ingredient_aliases',
      'inventory_items',
      'recipes',
      'recipe_families',
      'recipe_family_slots',
      'recipe_family_options',
      'recipe_nutrition',
      'nutrition_profiles',
    ].map((table) => db.query(`SELECT * FROM ${table} ORDER BY rowid`));
  }

  it('preserves all legitimate seeded ingredient IDs and rejects SQL case variants/invalid IDs', () => {
    const db = database();
    const ingredients = db.query<{ id: string }>('SELECT id FROM ingredients');
    expect(ingredients).toHaveLength(45);
    for (const { id } of ingredients) {
      expect(
        IngredientDefinitionSchema.parse({
          id,
          defaultName: id,
          category: 'other',
          defaultUnit: 'g',
          defaultShelfLifeDays: 1,
        }).id,
      ).toBe(id);
    }
    db.seed(`INSERT INTO ingredients (id, name_vi, name_en, category)
      VALUES ('NEW_CANONICAL', 'New', 'New', 'other')`);
    for (const id of [
      null,
      '',
      'chicken_breast',
      'Chicken_Breast',
      'NEW-CANONICAL',
      '1RICE',
      ' RICE',
      'RICE\n',
      'RICE\u0000tail',
      'RÍCE',
      'A'.repeat(101),
    ]) {
      expect(() =>
        db.execute('INSERT INTO ingredients (id, name_vi, name_en, category) VALUES (?, ?, ?, ?)', [
          id,
          'Invalid',
          'Invalid',
          'other',
        ]),
      ).toThrow('Invalid canonical ingredient ID');
      expect(() =>
        db.execute('UPDATE ingredients SET id = ? WHERE id = ?', [id, 'NEW_CANONICAL']),
      ).toThrow('Invalid canonical ingredient ID');
    }
    expect(db.query("SELECT id FROM ingredients WHERE lower(id) = 'chicken_breast'")).toEqual([
      { id: 'CHICKEN_BREAST' },
    ]);
  });

  it('rejects bad importer IDs and alias targets before issuing any SQL', async () => {
    const db = database();
    const prepare = vi.spyOn(db, 'prepare');
    for (const id of ['chicken_breast', 'Chicken_Breast']) {
      await expect(
        createIngredientDefinition(db, {
          id,
          defaultName: id,
          category: 'meat',
          defaultUnit: 'g',
          defaultShelfLifeDays: 3,
        }),
      ).rejects.toThrow('Invalid canonical ingredient ID');
      await expect(addIngredientAlias(db, id, { alias: 'Imported chicken' })).rejects.toThrow(
        'Invalid canonical ingredient ID',
      );
    }
    expect(prepare).not.toHaveBeenCalled();
  });

  it('accepts only current-version nutrition and rejects every inconsistent key update', () => {
    const db = database();
    nutritionFixture(db);
    for (const version of [0, 1, 999]) {
      expect(() =>
        db.execute('INSERT INTO recipe_nutrition VALUES (?, ?, ?)', [
          'vn-canh-01',
          version,
          'current_profile',
        ]),
      ).toThrow();
      expect(() =>
        db.execute('UPDATE recipe_nutrition SET recipe_version = ?', [version]),
      ).toThrow();
    }
    const other = db.query<{ id: string }>('SELECT id FROM recipes WHERE version = 1 LIMIT 1')[0]
      .id;
    expect(() => db.execute('UPDATE recipe_nutrition SET recipe_id = ?', [other])).toThrow(
      'Recipe nutrition must use the current recipe version',
    );
    expect(() => db.seed("UPDATE recipes SET version = 3 WHERE id = 'vn-canh-01'")).toThrow(
      'Unlink recipe nutrition before changing its version',
    );
    db.seed("UPDATE recipes SET version = 2, title = 'Updated title' WHERE id = 'vn-canh-01'");
    expect(db.query('SELECT recipe_id, recipe_version FROM recipe_nutrition')).toEqual([
      { recipe_id: 'vn-canh-01', recipe_version: 2 },
    ]);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('blocks replacement INSERTs from silently changing a linked recipe version', () => {
    const db = database();
    nutritionFixture(db);
    expect(() =>
      db.seed(`INSERT OR REPLACE INTO recipes
      (id, slug, title, cuisine, servings, cook_time_minutes, difficulty, version)
      SELECT id, slug, title, cuisine, servings, cook_time_minutes, difficulty, 3
      FROM recipes WHERE id = 'vn-canh-01'`),
    ).toThrow('Unlink recipe nutrition before changing its version');
    expect(db.query("SELECT version FROM recipes WHERE id = 'vn-canh-01'")).toEqual([
      { version: 2 },
    ]);
    expect(db.query('SELECT recipe_version FROM recipe_nutrition')).toEqual([
      { recipe_version: 2 },
    ]);
  });

  it('requires explicit transactional nutrition replacement and rolls back failed revisions', async () => {
    const db = database();
    nutritionFixture(db);
    const revision = (linkVersion: number) =>
      db.batch([
        db.prepare("DELETE FROM recipe_nutrition WHERE recipe_id = 'vn-canh-01'"),
        db.prepare("UPDATE recipes SET version = 3 WHERE id = 'vn-canh-01'"),
        db
          .prepare("INSERT INTO recipe_nutrition VALUES ('vn-canh-01', ?, 'current_profile')")
          .bind(linkVersion),
      ]);
    await expect(revision(999)).rejects.toThrow(
      'Recipe nutrition must use the current recipe version',
    );
    expect(db.query("SELECT version FROM recipes WHERE id = 'vn-canh-01'")).toEqual([
      { version: 2 },
    ]);
    expect(db.query('SELECT recipe_version FROM recipe_nutrition')).toEqual([
      { recipe_version: 2 },
    ]);
    await revision(3);
    expect(db.query("SELECT version FROM recipes WHERE id = 'vn-canh-01'")).toEqual([
      { version: 3 },
    ]);
    expect(db.query('SELECT recipe_version FROM recipe_nutrition')).toEqual([
      { recipe_version: 3 },
    ]);
    expect(() => db.seed("DELETE FROM nutrition_profiles WHERE id = 'current_profile'")).toThrow();
    db.seed("DELETE FROM recipes WHERE id = 'vn-canh-01'");
    expect(db.query('SELECT * FROM recipe_nutrition')).toEqual([]);
    expect(db.query("SELECT id FROM nutrition_profiles WHERE id = 'current_profile'")).toEqual([
      { id: 'current_profile' },
    ]);
  });

  it.each(['recipes', 'recipe_families'] as const)(
    'requires traceable import/AI sources on %s INSERT and UPDATE',
    (table) => {
      const db = database();
      const insert =
        table === 'recipes'
          ? `INSERT INTO recipes (id, slug, title, cuisine, servings, cook_time_minutes, difficulty, source_type, source_reference)
           VALUES ('source_fixture', 'source-fixture', 'Fixture', 'vietnamese', 1, 10, 'easy', ?, ?)`
          : `INSERT INTO recipe_families (id, slug, name, base_servings, source_type, source_reference)
           VALUES ('source_fixture', 'source-fixture', 'Fixture', 1, ?, ?)`;
      for (const sourceType of ['imported', 'ai_generated']) {
        for (const reference of [null, '', ' \t\r\n', '\u00a0\u3000', 'job\u0000id']) {
          expect(() => db.execute(insert, [sourceType, reference])).toThrow(
            'Invalid recipe source reference',
          );
        }
        db.execute(insert, [sourceType, 'internal:job-42']);
        expect(
          db.query(
            `SELECT source_type, source_reference, verification_state, version FROM ${table}` +
              " WHERE id = 'source_fixture'",
          ),
        ).toEqual([
          {
            source_type: sourceType,
            source_reference: 'internal:job-42',
            verification_state: 'unverified',
            version: 1,
          },
        ]);
        for (const reference of [null, '', '\t\r\n', '\u00a0\u3000', 'job\u0000id']) {
          expect(() =>
            db.execute(`UPDATE ${table} SET source_reference = ? WHERE id = 'source_fixture'`, [
              reference,
            ]),
          ).toThrow('Invalid recipe source reference');
        }
        db.seed(`DELETE FROM ${table} WHERE id = 'source_fixture'`);
      }
      for (const sourceType of ['curated', 'user_generated']) {
        db.execute(insert, [sourceType, null]);
        expect(() =>
          db.seed(`UPDATE ${table} SET source_type = 'imported' WHERE id = 'source_fixture'`),
        ).toThrow('Invalid recipe source reference');
        expect(() =>
          db.seed(`UPDATE ${table} SET source_reference = ' ' WHERE id = 'source_fixture'`),
        ).toThrow('Invalid recipe source reference');
        db.seed(`DELETE FROM ${table} WHERE id = 'source_fixture'`);
      }
    },
  );

  it('upgrades populated 0019 without changing canonical, household, family or nutrition data', () => {
    const db = beforeHardening();
    nutritionFixture(db);
    db.seed(`INSERT INTO ingredient_aliases (id, ingredient_id, alias)
      VALUES ('retained_alias', 'CHICKEN_BREAST', '旧ラベル');
      UPDATE recipes SET source_type = 'imported', source_reference = 'dataset:row-42'
      WHERE id = 'vn-canh-01';
      INSERT INTO recipe_families (id, slug, name, base_servings, source_type, source_reference)
      VALUES ('retained_family', 'retained-family', 'Family', 2, 'ai_generated', 'generation:42');
      INSERT INTO recipe_family_slots VALUES ('retained_family', 'base', 1, 1);
      INSERT INTO recipe_family_options VALUES ('retained_family', 'base', 'RICE', 100, 'g');`);
    const before = catalogSnapshot(db);
    db.seed(hardeningMigration);
    expect(catalogSnapshot(db)).toEqual(before);
    expect(db.query("SELECT name FROM sqlite_master WHERE name = '_t01_hardening_guard'")).toEqual(
      [],
    );
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
    expect(db.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
    expect(
      db.query("SELECT allergen_review_state FROM ingredients WHERE id = 'CHICKEN_BREAST'"),
    ).toEqual([{ allergen_review_state: 'unknown' }]);
    expect(
      db.query("SELECT * FROM ingredient_tags WHERE ingredient_id = 'CHICKEN_BREAST'"),
    ).toEqual([]);
  });

  it.each([
    {
      constraint: 'canonical_ingredient_id_preflight',
      seed: "INSERT INTO ingredients (id, name_vi, name_en, category) VALUES ('chicken_breast', 'Old import', 'Old import', 'meat')",
    },
    {
      constraint: 'recipe_nutrition_version_preflight',
      seed: 'UPDATE recipe_nutrition SET recipe_version = 999',
    },
    {
      constraint: 'recipe_provenance_preflight',
      seed: "UPDATE recipes SET source_type = 'imported' WHERE id = 'vn-canh-01'",
    },
    {
      constraint: 'family_provenance_preflight',
      seed: "INSERT INTO recipe_families (id, slug, name, base_servings, source_type, source_reference) VALUES ('bad_source', 'bad-source', 'Bad source', 1, 'ai_generated', char(160,12288))",
    },
  ])(
    'aborts $constraint without changing old rows or leaving partial schema',
    ({ constraint, seed }) => {
      const db = beforeHardening();
      nutritionFixture(db);
      db.seed(seed);
      const before = catalogSnapshot(db);
      db.seed('BEGIN');
      try {
        expect(() => db.seed(hardeningMigration)).toThrow(constraint);
      } finally {
        db.seed('ROLLBACK');
      }
      expect(catalogSnapshot(db)).toEqual(before);
      expect(
        db.query(
          "SELECT name FROM sqlite_master WHERE name IN ('_t01_hardening_guard', 'trg_ingredients_canonical_id_insert')",
        ),
      ).toEqual([]);
    },
  );

  it('schema-gates the new ledger entry and every hardening trigger, not just the table shapes', () => {
    const db = database();
    db.seed('CREATE TABLE d1_migrations (name TEXT PRIMARY KEY NOT NULL)');
    for (const name of db.migrations) db.execute('INSERT INTO d1_migrations VALUES (?)', [name]);
    expect(db.query(schemaGate)).toEqual([]);
    db.seed("DELETE FROM d1_migrations WHERE name = '0020_t01_foundation_hardening.sql'");
    expect(db.query(schemaGate)).toEqual([
      { issue: 'missing_migration', detail: '0020_t01_foundation_hardening.sql' },
    ]);
    db.seed("INSERT INTO d1_migrations VALUES ('0020_t01_foundation_hardening.sql')");
    db.seed("DELETE FROM d1_migrations WHERE name = '0021_recipe_personalization.sql'");
    expect(db.query(schemaGate)).toEqual([
      { issue: 'missing_migration', detail: '0021_recipe_personalization.sql' },
    ]);
    db.seed("INSERT INTO d1_migrations VALUES ('0021_recipe_personalization.sql')");
    const triggers = [...hardeningMigration.matchAll(/CREATE TRIGGER (\w+)/g)].map(
      (match) => match[1],
    );
    expect(triggers).toHaveLength(10);
    for (const trigger of triggers) {
      db.seed('BEGIN');
      try {
        db.seed(`DROP TRIGGER ${trigger}`);
        expect(db.query(schemaGate)).toEqual([{ issue: 'missing_trigger', detail: trigger }]);
      } finally {
        db.seed('ROLLBACK');
      }
    }
  });
});
