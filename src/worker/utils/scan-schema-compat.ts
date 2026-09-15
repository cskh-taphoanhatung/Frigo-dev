import type { D1DatabaseBinding, D1PreparedStatement, D1Result } from '@frigo/db';

export type ScanReviewStateCapability = 'legacy' | 'review-state';

interface CapabilityProbeDatabase {
  prepare(query: string): {
    first<T = unknown>(): Promise<T | null>;
  };
}

/** Probe only the additive column used by migration 0032. No negative result is cached. */
export async function detectScanReviewStateCapability(
  db: CapabilityProbeDatabase,
): Promise<ScanReviewStateCapability> {
  const row = await db
    .prepare("SELECT 1 AS present FROM pragma_table_info('scan_items') WHERE name = 'review_state'")
    .first<{ present: number }>();
  return row?.present === 1 ? 'review-state' : 'legacy';
}

/** Only transition errors may trigger the single bounded retry. */
export function isScanSchemaTransitionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such column:\s*review_state|scan_items\.review_state must agree with is_confirmed/i.test(message);
}

export function scanConfirmationSetClause(capability: ScanReviewStateCapability): string {
  return capability === 'review-state'
    ? 'category = ?, storage = ?, is_confirmed = 1, review_state = \'CONFIRMED\''
    : 'category = ?, storage = ?, is_confirmed = 1';
}

export async function runScanSchemaCompatibleBatch<T = unknown>(
  db: D1DatabaseBinding,
  buildStatements: (capability: ScanReviewStateCapability) => D1PreparedStatement[],
): Promise<{ capability: ScanReviewStateCapability; results: D1Result<T>[] }> {
  let capability = await detectScanReviewStateCapability(db);
  try {
    return { capability, results: await db.batch<T>(buildStatements(capability)) };
  } catch (error) {
    if (capability !== 'legacy' || !isScanSchemaTransitionError(error)) throw error;
    capability = 'review-state';
    return { capability, results: await db.batch<T>(buildStatements(capability)) };
  }
}
