import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { D1DatabaseBinding, D1PreparedStatement, D1Result } from '../../packages/db/src';

export interface SqliteStatementEvent {
  method: 'first' | 'all' | 'run';
  sql: string;
  bindings: readonly unknown[];
}

export interface SqliteD1Hooks {
  beforeStatement?: (event: SqliteStatementEvent) => void | Promise<void>;
  afterStatement?: (event: SqliteStatementEvent, result: unknown) => void | Promise<void>;
  beforeBatch?: (statements: readonly SqliteStatementEvent[]) => void | Promise<void>;
  afterBatch?: (results: readonly D1Result[]) => void | Promise<void>;
}

/** A one-shot rendezvous; pauses matching reads/writes until every racer arrives. */
export function createBarrier(parties: number) {
  if (!Number.isInteger(parties) || parties < 1) throw new Error('Barrier needs at least one party');
  let arrivals = 0;
  let release!: () => void;
  const ready = new Promise<void>((resolve) => { release = resolve; });
  return {
    get arrivals() { return arrivals; },
    async wait() {
      arrivals += 1;
      if (arrivals === parties) release();
      await ready;
    },
  };
}

/**
 * Replays the migration ledger in canonical order. `through` stops after the named migration
 * (inclusive) so a test can certify an earlier ledger state — e.g. the 71-recipe legacy baseline at
 * `0035_recipe_media_layer.sql` — while the default replays the complete current ledger.
 */
export function applyMigrations(db: SqliteD1, directory = path.resolve(process.cwd(), 'migrations'), through?: string): string[] {
  const all = readdirSync(directory).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
  if (through !== undefined && !all.includes(through)) throw new Error(`Unknown migration ${through}`);
  const files = through === undefined ? all : all.slice(0, all.indexOf(through) + 1);
  for (const file of files) db.seed(readFileSync(path.join(directory, file), 'utf8'));
  return files;
}

/** Last migration of the 71-recipe legacy baseline; T14F catalog growth migrations follow it. */
export const LEGACY_CATALOG_MIGRATION_TIP = '0035_recipe_media_layer.sql';

/**
 * Expected migration ledger shape. `catalogGrowth` lists the T14F data-only catalog migrations in order
 * (each one = one immutable reviewed import batch); the count/tip follow from it so the ledger tests
 * change in exactly one place when a batch is promoted.
 */
export const MIGRATION_LEDGER = Object.freeze({
  legacyTip: LEGACY_CATALOG_MIGRATION_TIP,
  catalogGrowth: Object.freeze(['0036_recipe_catalog_pilot.sql', '0037_recipe_catalog_scale.sql']),
  get count() { return 35 + this.catalogGrowth.length; },
  get tip(): string { return this.catalogGrowth.at(-1) ?? this.legacyTip; },
});

/** Real SQLite constraints and transactions, with async barriers only outside atomic batches. */
export class SqliteD1 implements D1DatabaseBinding {
  private readonly sqlite = new DatabaseSync(':memory:');
  readonly migrations: string[];
  hooks: SqliteD1Hooks;

  constructor(options: { migrate?: boolean; through?: string; hooks?: SqliteD1Hooks } = {}) {
    this.sqlite.exec('PRAGMA foreign_keys = ON');
    this.hooks = options.hooks ?? {};
    this.migrations = options.migrate === false ? [] : applyMigrations(this, undefined, options.through);
  }

  prepare(sql: string): SqliteStatement {
    return new SqliteStatement(this, sql);
  }

  async exec(sql: string): Promise<{ count: number; duration: number }> {
    this.sqlite.exec(sql);
    return { count: 0, duration: 0 };
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const prepared = statements.map((statement) => {
      if (!(statement instanceof SqliteStatement) || statement.db !== this) {
        throw new Error('Batch statements must belong to this database');
      }
      return statement;
    });
    await this.hooks.beforeBatch?.(prepared.map((statement) => statement.event('run')));
    this.sqlite.exec('BEGIN IMMEDIATE');
    let results: D1Result<T>[];
    try {
      // No await or per-statement hook inside the transaction: D1 batches cannot interleave.
      results = prepared.map((statement) => this.execute<T>(statement.sql, statement.bindings));
      this.sqlite.exec('COMMIT');
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
    await this.hooks.afterBatch?.(results);
    return results;
  }

  async perform<T>(event: SqliteStatementEvent, operation: () => T): Promise<T> {
    await this.hooks.beforeStatement?.(event);
    const result = operation();
    await this.hooks.afterStatement?.(event, result);
    return result;
  }

  execute<T = unknown>(sql: string, bindings: readonly unknown[] = []): D1Result<T> {
    const statement = this.sqlite.prepare(sql);
    const values = bindings as SQLInputValue[];
    if (statement.columns().length > 0) {
      const before = this.query<{ total: number }>('SELECT total_changes() AS total')[0].total;
      const results = statement.all(...values) as T[];
      const meta = this.query<{ changes: number; last_row_id: number; total: number }>(
        'SELECT changes() AS changes, last_insert_rowid() AS last_row_id, total_changes() AS total'
      )[0];
      return {
        results,
        success: true,
        // SELECT must not inherit changes() from the preceding write; RETURNING still reports writes.
        meta: { changes: meta.total === before ? 0 : meta.changes, last_row_id: meta.last_row_id },
      };
    }
    const result = statement.run(...values);
    return {
      results: [],
      success: true,
      meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) },
    };
  }

  seed(sql: string): void {
    this.sqlite.exec(sql);
  }

  query<T = Record<string, unknown>>(sql: string, ...values: unknown[]): T[] {
    return this.sqlite.prepare(sql).all(...values as SQLInputValue[]) as T[];
  }

  close(): void {
    this.sqlite.close();
  }
}

export class SqliteStatement implements D1PreparedStatement {
  constructor(
    readonly db: SqliteD1,
    readonly sql: string,
    readonly bindings: readonly unknown[] = []
  ) {}

  bind(...values: unknown[]): SqliteStatement {
    return new SqliteStatement(this.db, this.sql, values);
  }

  event(method: SqliteStatementEvent['method']): SqliteStatementEvent {
    return { method, sql: this.sql, bindings: this.bindings };
  }

  async first<T = unknown>(column?: string): Promise<T | null> {
    return this.db.perform(this.event('first'), () => {
      const row = this.db.query<Record<string, unknown>>(this.sql, ...this.bindings)[0];
      if (!row) return null;
      return (column === undefined ? row : row[column]) as T;
    });
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    return this.db.perform(this.event('all'), () => this.db.execute<T>(this.sql, this.bindings));
  }

  async run(): Promise<D1Result> {
    return this.db.perform(this.event('run'), () => this.db.execute(this.sql, this.bindings));
  }
}
