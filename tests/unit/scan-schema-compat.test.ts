import { describe, expect, it } from 'vitest';
import {
  detectScanReviewStateCapability,
  isScanSchemaTransitionError,
  runScanSchemaCompatibleBatch,
  scanConfirmationSetClause,
} from '../../src/worker/utils/scan-schema-compat';
import { SqliteD1 } from '../helpers/sqlite-d1';

describe('scan schema compatibility bridge', () => {
  it('detects the additive review_state column without caching a negative result', async () => {
    const calls: string[] = [];
    const db = {
      prepare(sql: string) {
        calls.push(sql);
        return {
          first: async <T>() => (calls.length === 1 ? null : { present: 1 } as T),
        };
      },
    };

    await expect(detectScanReviewStateCapability(db)).resolves.toBe('legacy');
    await expect(detectScanReviewStateCapability(db)).resolves.toBe('review-state');
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("pragma_table_info('scan_items')");
  });

  it('only retries known transition failures', () => {
    expect(isScanSchemaTransitionError(new Error('no such column: review_state'))).toBe(true);
    expect(isScanSchemaTransitionError(new Error('scan_items.review_state must agree with is_confirmed'))).toBe(true);
    expect(isScanSchemaTransitionError(new Error('database is locked'))).toBe(false);
    expect(isScanSchemaTransitionError(new Error('foreign key constraint failed'))).toBe(false);
  });

  it('writes both coupled fields only when the column exists', () => {
    expect(scanConfirmationSetClause('legacy')).toContain('is_confirmed = 1');
    expect(scanConfirmationSetClause('legacy')).not.toContain('review_state');
    expect(scanConfirmationSetClause('review-state')).toContain("review_state = 'CONFIRMED'");
  });

  it('commits against both the legacy and post-0032 schema shapes', async () => {
    const legacy = new SqliteD1({ migrate: false });
    legacy.seed('CREATE TABLE scan_items (id TEXT PRIMARY KEY, is_confirmed INTEGER NOT NULL DEFAULT 0); INSERT INTO scan_items (id) VALUES (\'legacy\');');
    const legacyRun = await runScanSchemaCompatibleBatch(legacy, (capability) => [
      legacy.prepare(`UPDATE scan_items SET is_confirmed = 1 WHERE id = 'legacy'${capability === 'legacy' ? '' : ", review_state = 'CONFIRMED'"}`),
    ]);
    expect(legacyRun.capability).toBe('legacy');
    expect(legacy.query('SELECT is_confirmed FROM scan_items')).toEqual([{ is_confirmed: 1 }]);

    const upgraded = new SqliteD1({ migrate: false });
    upgraded.seed(`CREATE TABLE scan_items (id TEXT PRIMARY KEY, is_confirmed INTEGER NOT NULL DEFAULT 0,
      review_state TEXT NOT NULL DEFAULT 'PENDING');
      CREATE TRIGGER review_state_guard BEFORE UPDATE OF review_state, is_confirmed ON scan_items
      WHEN (NEW.review_state = 'CONFIRMED') <> (NEW.is_confirmed = 1)
      BEGIN SELECT RAISE(ABORT, 'scan_items.review_state must agree with is_confirmed'); END;
      INSERT INTO scan_items (id) VALUES ('upgraded');`);
    const upgradedRun = await runScanSchemaCompatibleBatch(upgraded, (capability) => [
      upgraded.prepare(`UPDATE scan_items SET is_confirmed = 1${capability === 'legacy' ? '' : ", review_state = 'CONFIRMED'"} WHERE id = 'upgraded'`),
    ]);
    expect(upgradedRun.capability).toBe('review-state');
    expect(upgraded.query('SELECT is_confirmed, review_state FROM scan_items')).toEqual([
      { is_confirmed: 1, review_state: 'CONFIRMED' },
    ]);
  });

  it('retries once when migration commits between probe and batch, without duplicate mutation', async () => {
    const db = new SqliteD1({ migrate: false });
    db.seed("CREATE TABLE scan_items (id TEXT PRIMARY KEY, is_confirmed INTEGER NOT NULL DEFAULT 0); INSERT INTO scan_items (id) VALUES ('race');");
    let migrated = false;
    db.hooks.beforeBatch = async () => {
      if (migrated) return;
      migrated = true;
      db.seed(`ALTER TABLE scan_items ADD COLUMN review_state TEXT NOT NULL DEFAULT 'PENDING';
        CREATE TRIGGER review_state_guard BEFORE UPDATE OF review_state, is_confirmed ON scan_items
        WHEN (NEW.review_state = 'CONFIRMED') <> (NEW.is_confirmed = 1)
        BEGIN SELECT RAISE(ABORT, 'scan_items.review_state must agree with is_confirmed'); END;`);
    };

    const result = await runScanSchemaCompatibleBatch(db, (capability) => [
      db.prepare(`UPDATE scan_items SET is_confirmed = 1${capability === 'legacy' ? '' : ", review_state = 'CONFIRMED'"} WHERE id = 'race'`),
    ]);
    expect(result.capability).toBe('review-state');
    expect(db.query('SELECT is_confirmed, review_state FROM scan_items')).toEqual([
      { is_confirmed: 1, review_state: 'CONFIRMED' },
    ]);
  });
});
