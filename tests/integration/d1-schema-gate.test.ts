import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listMigrations, migrationTip, renderSchemaGateCommand, renderSchemaGateSql } from '../../scripts/d1-schema-gate.mjs';
import { MIGRATION_LEDGER, SqliteD1 } from '../helpers/sqlite-d1';

// T15A: the production schema gate derives its required migrations from the repository, so it
// can never silently accept a database that is behind (or ahead of) the release it guards.
describe('D1 schema gate — migration ledger equality derived from migrations/', () => {
  const databases: SqliteD1[] = [];
  const gate = renderSchemaGateSql();
  const withLedger = (names: readonly string[], through?: string) => {
    const db = new SqliteD1(through ? { through } : {});
    databases.push(db);
    db.seed('CREATE TABLE d1_migrations (name TEXT PRIMARY KEY NOT NULL)');
    for (const name of names) db.execute('INSERT INTO d1_migrations VALUES (?)', [name]);
    return db;
  };
  afterEach(() => { for (const db of databases.splice(0)) db.close(); });

  it('requires exactly the repository migration list, whose tip is the current catalog migration', () => {
    const names = listMigrations();
    expect(names).toHaveLength(MIGRATION_LEDGER.count);
    expect(names.at(-1)).toBe(MIGRATION_LEDGER.tip);
    expect(migrationTip()).toBe('0037_recipe_catalog_scale.sql');
    for (const name of names) expect(gate).toContain(`('${name}')`);
    expect(gate).not.toContain('@required_migrations');
    // D1 caps compound SELECTs at five terms; the CTE keeps the top-level query at five branches.
    expect(gate.split('\n').filter((line) => /^UNION ALL$/.test(line.trim()))).toHaveLength(4 + 1);
    expect(renderSchemaGateCommand()).not.toMatch(/\n|--/);
  });

  it('passes only when the ledger equals the repository list (tip 0037 with 500 recipes)', () => {
    const db = withLedger(listMigrations());
    expect(db.query(gate)).toEqual([]);
    expect(db.query<{ n: number }>('SELECT COUNT(*) AS n FROM recipes')[0].n).toBe(500);
  });

  it('fails closed when the ledger stops at 0036 (behind the required 0037 tip)', () => {
    const db = withLedger(listMigrations().slice(0, -1), '0036_recipe_catalog_pilot.sql');
    expect(db.query(gate)).toEqual([{ issue: 'missing_migration', detail: '0037_recipe_catalog_scale.sql' }]);
  });

  it('fails closed when the ledger stops at 0034 or 0035 (legacy production tips)', () => {
    for (const tip of ['0034_global_recipe_catalog_parity.sql', '0035_recipe_media_layer.sql']) {
      const names = listMigrations();
      const applied = names.slice(0, names.indexOf(tip) + 1);
      const db = withLedger(applied, tip);
      const issues = db.query<{ issue: string; detail: string }>(gate);
      // Ledger gap plus, for 0034, the recipe_media schema that 0035 introduces.
      expect(issues.filter((row) => row.issue === 'missing_migration').map((row) => row.detail)).toEqual(names.slice(applied.length));
      expect(issues.some((row) => row.issue === 'unexpected_migration')).toBe(false);
    }
  });

  it('fails closed when a ledger entry is missing from the middle of the chain', () => {
    const db = withLedger(listMigrations().filter((name) => !name.startsWith('0036_')));
    expect(db.query(gate)).toEqual([{ issue: 'missing_migration', detail: '0036_recipe_catalog_pilot.sql' }]);
  });

  it('fails closed when the database is ahead of the repository (unknown future migration)', () => {
    const db = withLedger([...listMigrations(), '0038_unknown_future.sql']);
    expect(db.query(gate)).toEqual([{ issue: 'unexpected_migration', detail: '0038_unknown_future.sql' }]);
  });

  it('fails closed when the ledger names a migration the repository never had', () => {
    const db = withLedger([...listMigrations().slice(0, -1), '0037_recipe_catalog_scale_v2.sql']);
    expect(db.query(gate)).toEqual([
      { issue: 'missing_migration', detail: '0037_recipe_catalog_scale.sql' },
      { issue: 'unexpected_migration', detail: '0037_recipe_catalog_scale_v2.sql' },
    ]);
  });

  it('refuses to render when the migration directory has a gap, a duplicate number, or no marker', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'frigo-gate-'));
    try {
      writeFileSync(path.join(dir, '0001_a.sql'), 'SELECT 1;');
      writeFileSync(path.join(dir, '0003_c.sql'), 'SELECT 1;');
      expect(() => listMigrations(dir)).toThrow('gap');
      writeFileSync(path.join(dir, '0002_b.sql'), 'SELECT 1;');
      writeFileSync(path.join(dir, '0002_dup.sql'), 'SELECT 1;');
      expect(() => listMigrations(dir)).toThrow('gap');
      const template = path.join(dir, 'gate.sql');
      writeFileSync(template, 'SELECT 1;');
      expect(() => renderSchemaGateSql({ template })).toThrow('exactly one');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
