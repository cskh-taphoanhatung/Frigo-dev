import { AIRouter } from '@frigo/ai';
import { findCanonicalIngredient, StandardUnit } from '@frigo/domain';
import { Env } from '../types';

// scan_items.confidence is NOT NULL with a historical 0.9 default and cannot
// express "the provider reported none". Like the synchronous route, the queue
// keeps that filler for legacy readers and records the provider's actual
// confidence (or NULL) in ocr_confidence, the T13 truth column.
const LEGACY_CONFIDENCE_FILLER = 0.9;

export type ScanQueueMessage = {
  type: 'scan.process.v1';
  jobId?: string;
  scanId: string;
  userId: string;
  householdId: string;
  scanType?: 'fridge' | 'food' | 'receipt';
  imageBase64?: string;
  imageKey?: string;
  mimeType?: string;
  idempotencyKey?: string;
};

export type QueueDecision = 'ack' | 'retry';

export class ScanQueueError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ScanQueueError';
  }
}

function parseMessage(body: unknown): ScanQueueMessage {
  if (!body || typeof body !== 'object') {
    throw new ScanQueueError('Queue message must be an object', 'INVALID_MESSAGE', false);
  }
  const value = body as Partial<ScanQueueMessage>;
  if (value.type !== 'scan.process.v1') {
    throw new ScanQueueError('Unsupported queue message type', 'UNSUPPORTED_MESSAGE', false);
  }
  if (!value.scanId || !value.userId || !value.householdId) {
    throw new ScanQueueError('Queue message is missing scan tenancy fields', 'INVALID_MESSAGE', false);
  }
  if (value.scanType && value.scanType !== 'fridge' && value.scanType !== 'food' && value.scanType !== 'receipt') {
    throw new ScanQueueError('Unsupported scan type', 'INVALID_MESSAGE', false);
  }
  return value as ScanQueueMessage;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function getRouter(env: Env): AIRouter {
  return new AIRouter({
    aiMockMode: env.AI_MOCK_MODE === 'true',
    aiBinding: env.AI,
    qwenApiKey: env.QWEN_API_KEY,
    qwenBaseUrl: env.QWEN_BASE_URL,
    groqApiKey: env.GROQ_API_KEY,
    groqBaseUrl: env.GROQ_BASE_URL,
    groqVisionModel: env.GROQ_VISION_MODEL,
    zaiApiKey: env.ZAI_API_KEY,
    zaiBaseUrl: env.ZAI_BASE_URL,
    deepseekApiKey: env.DEEPSEEK_API_KEY,
    deepseekBaseUrl: env.DEEPSEEK_BASE_URL,
    silentFallback: true,
  });
}

async function loadImage(env: Env, message: ScanQueueMessage): Promise<{ data: string; mimeType: string }> {
  if (message.imageBase64) {
    const embeddedMime = message.imageBase64.match(/^data:(image\/[A-Za-z0-9.+-]+);base64,/)?.[1];
    return { data: message.imageBase64, mimeType: message.mimeType || embeddedMime || 'image/jpeg' };
  }
  if (!message.imageKey || !env.IMAGES) {
    throw new ScanQueueError('Scan image is unavailable', 'IMAGE_UNAVAILABLE', false);
  }
  const object = await env.IMAGES.get(message.imageKey);
  if (!object) throw new ScanQueueError('Scan image was not found', 'IMAGE_NOT_FOUND', false);
  return {
    data: toBase64(new Uint8Array(await object.arrayBuffer())),
    mimeType: message.mimeType || object.httpMetadata?.contentType || 'image/jpeg',
  };
}

type ScanClaim = { status: 'claimed'; jobId: string; claimToken: string } | { status: 'done' | 'missing' };

function newClaimToken(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `claim_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/** Claim a job with a fenced lease. Busy deliveries remain retryable. */
async function claimScanJobWithLease(env: Env, message: ScanQueueMessage): Promise<ScanClaim> {
  const scan = await env.DB.prepare(
    `SELECT id, status, scan_type FROM scans WHERE id = ? AND user_id = ? AND household_id = ?`,
  ).bind(message.scanId, message.userId, message.householdId).first<{ id: string; status: string; scan_type: string }>();
  if (!scan) return { status: 'missing' };

  const scanType = message.scanType || 'fridge';
  if (scan.scan_type !== scanType) {
    throw new ScanQueueError('Queue scan type does not match persisted scan', 'SCAN_TYPE_MISMATCH', false);
  }
  if (['ready', 'confirmed', 'failed'].includes(scan.status)) return { status: 'done' };

  const jobId = message.jobId || `scan_job_${message.scanId}`;
  const idempotencyKey = message.idempotencyKey || jobId;
  const existingByKey = await env.DB.prepare(
    `SELECT id, status, locked_at, attempts, max_attempts, scan_id, user_id, household_id, claim_token
       FROM scan_queue_jobs WHERE idempotency_key = ? LIMIT 1`,
  ).bind(idempotencyKey).first<{ id: string; status: string; locked_at: string | null; attempts: number; max_attempts: number; scan_id: string; user_id: string; household_id: string; claim_token: string | null }>();
  if (existingByKey && (existingByKey.id !== jobId || existingByKey.scan_id !== message.scanId || existingByKey.user_id !== message.userId || existingByKey.household_id !== message.householdId)) {
    throw new ScanQueueError('Queue idempotency key is bound to another scan tenant', 'IDEMPOTENCY_CONFLICT', false);
  }
  if (!existingByKey) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO scan_queue_jobs
        (id, scan_id, household_id, user_id, idempotency_key)
       SELECT ?, ?, ?, ?, ? WHERE EXISTS (
         SELECT 1 FROM scans WHERE id = ? AND user_id = ? AND household_id = ?
           AND status IN ('pending', 'processing'))`,
    ).bind(jobId, message.scanId, message.householdId, message.userId, idempotencyKey,
      message.scanId, message.userId, message.householdId).run();
  }

  const existing = await env.DB.prepare(
    `SELECT id, status, scan_id, user_id, household_id, idempotency_key
       FROM scan_queue_jobs WHERE id = ? OR idempotency_key = ?`,
  ).bind(jobId, idempotencyKey).first<{ id: string; status: string; scan_id: string; user_id: string; household_id: string; idempotency_key: string }>();
  if (existing && (existing.id !== jobId || existing.scan_id !== message.scanId || existing.user_id !== message.userId || existing.household_id !== message.householdId || existing.idempotency_key !== idempotencyKey)) {
    throw new ScanQueueError('Queue idempotency key is bound to another scan tenant', 'IDEMPOTENCY_CONFLICT', false);
  }
  if (existing?.status === 'ready' || existing?.status === 'failed') return { status: 'done' };

  const claimToken = newClaimToken();
  const exhaustedToken = newClaimToken();
  const eligible = `(status = 'pending' OR (status = 'processing'
    AND (locked_at IS NULL OR datetime(locked_at) <= datetime('now', '-10 minutes'))))`;
  const results = await env.DB.batch([
    env.DB.prepare(`UPDATE scan_queue_jobs SET status = 'failed', error_code = 'MAX_ATTEMPTS_EXCEEDED',
      error_message = 'Processing lease expired after maximum attempts', completed_at = datetime('now'), updated_at = datetime('now'), claim_token = ?
      WHERE id = ? AND attempts >= max_attempts AND ${eligible}
        AND EXISTS (SELECT 1 FROM scans WHERE id = ? AND user_id = ? AND household_id = ? AND status IN ('pending', 'processing'))`)
      .bind(exhaustedToken, jobId, message.scanId, message.userId, message.householdId),
    env.DB.prepare(`UPDATE scans SET status = 'failed', updated_at = datetime('now')
      WHERE id = ? AND user_id = ? AND household_id = ? AND status IN ('pending', 'processing')
        AND EXISTS (SELECT 1 FROM scan_queue_jobs WHERE id = ? AND status = 'failed' AND claim_token = ?)`)
      .bind(message.scanId, message.userId, message.householdId, jobId, exhaustedToken),
    env.DB.prepare(`UPDATE scan_queue_jobs
       SET status = 'processing', attempts = attempts + 1,
           locked_at = datetime('now'), updated_at = datetime('now'),
           error_code = NULL, error_message = NULL,
           claim_token = ?, claim_attempt = attempts + 1
     WHERE id = ? AND attempts < max_attempts AND ${eligible}
       AND EXISTS (SELECT 1 FROM scans WHERE id = ? AND user_id = ? AND household_id = ?
         AND status IN ('pending', 'processing'))`)
      .bind(claimToken, jobId, message.scanId, message.userId, message.householdId),
    env.DB.prepare(`UPDATE scans SET status = 'processing', updated_at = datetime('now')
      WHERE id = ? AND status IN ('pending', 'processing')
        AND EXISTS (SELECT 1 FROM scan_queue_jobs WHERE id = ? AND status = 'processing' AND claim_token = ?)`)
      .bind(message.scanId, jobId, claimToken),
  ]);
  if (results.some((result) => !result.success)) throw new ScanQueueError('Scan claim failed', 'CLAIM_FAILED', true);
  if (results[2].meta?.changes === 1) return { status: 'claimed', jobId, claimToken };
  const current = await env.DB.prepare(`SELECT scans.status AS scan_status, scan_queue_jobs.status AS job_status
    FROM scans LEFT JOIN scan_queue_jobs ON scan_queue_jobs.id = ? WHERE scans.id = ?`)
    .bind(jobId, message.scanId).first<{ scan_status: string; job_status: string | null }>();
  if (!current) return { status: 'missing' };
  if (['ready', 'confirmed', 'failed'].includes(current.scan_status) || ['ready', 'failed'].includes(current.job_status || '')) {
    return { status: 'done' };
  }
  throw new ScanQueueError('Scan job is already being processed', 'JOB_IN_PROGRESS', true);
}

function commitFence(env: Env, message: ScanQueueMessage, jobId: string, claimToken: string) {
  const token = newClaimToken();
  // Rotate to a transaction-only token before any side effects. A lost/expired
  // claim cannot produce this token, so every later statement becomes a no-op.
  const acquire = env.DB.prepare(`UPDATE scan_queue_jobs SET claim_token = ?
    WHERE id = ? AND scan_id = ? AND user_id = ? AND household_id = ?
      AND status = 'processing' AND claim_token = ?
      AND datetime(locked_at) > datetime('now', '-10 minutes')
      AND EXISTS (SELECT 1 FROM scans WHERE id = ? AND status = 'processing')`)
    .bind(token, jobId, message.scanId, message.userId, message.householdId, claimToken, message.scanId);
  const guard = `EXISTS (SELECT 1 FROM scan_queue_jobs WHERE id = ? AND status = 'processing' AND claim_token = ?)`;
  const bindings = [jobId, token] as const;
  return { acquire, guard, bindings };
}

function assertFencedCommit(results: { success: boolean; meta: Record<string, unknown> }[]): void {
  if (results.some((result) => !result.success)) throw new ScanQueueError('Scan persistence failed', 'DATABASE_ERROR', true);
  if (results[0].meta?.changes !== 1 || results[results.length - 1].meta?.changes !== 1) {
    throw new ScanQueueError('Scan result claim was lost before commit', 'CLAIM_LOST', true);
  }
}

/** Backward-compatible status helper for tests and operational tooling. */
export async function claimScanJob(env: Env, message: ScanQueueMessage): Promise<'claimed' | 'done' | 'missing'> {
  const claim = await claimScanJobWithLease(env, message);
  return claim.status;
}

export async function processScanJob(env: Env, messageBody: unknown): Promise<void> {
  const message = parseMessage(messageBody);
  const claim = await claimScanJobWithLease(env, message);
  if (claim.status === 'missing') {
    throw new ScanQueueError('Scan record was not found for queue job', 'SCAN_NOT_FOUND', false);
  }
  if (claim.status !== 'claimed') return;

  const { jobId, claimToken } = claim;
  try {
    const image = await loadImage(env, message);
    const router = getRouter(env);
    const scanType = message.scanType || 'fridge';
    const fence = commitFence(env, message, jobId, claimToken);
    if (scanType === 'receipt') {
      const receipt = await router.receiptScan({ imageBase64OrUrl: image.data, mimeType: image.mimeType });
      const statements = receipt.items.map((item, index) => {
        const canonical = findCanonicalIngredient(item.raw_name);
        const providerCanonical = item.canonical_id ? findCanonicalIngredient(item.canonical_id) : null;
        return env.DB.prepare(
          `INSERT INTO scan_items
            (id, scan_id, raw_name, canonical_id, estimated_quantity, unit, confidence, category, storage,
             unit_price_vnd, total_price_vnd, ocr_raw_name, ocr_quantity, ocr_unit, ocr_confidence)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${fence.guard}`,
        ).bind(
          `scan_item_${message.scanId}_${index}`,
          message.scanId,
          item.raw_name,
          canonical?.id || providerCanonical?.id || null,
          item.estimated_quantity,
          item.unit as StandardUnit,
          item.confidence ?? LEGACY_CONFIDENCE_FILLER,
          canonical?.category || item.category || 'other',
          item.storage || 'fridge',
          item.unit_price_vnd ?? null,
          item.total_price_vnd ?? null,
          // T13 raw evidence: exactly what the provider reported, kept apart
          // from the reviewable working columns above.
          item.raw_name,
          item.estimated_quantity,
          item.unit,
          item.confidence ?? null,
          ...fence.bindings,
        );
      });
      const commitStatements = [
        fence.acquire,
        env.DB.prepare(`DELETE FROM scan_items WHERE scan_id = ? AND ${fence.guard}`).bind(message.scanId, ...fence.bindings),
        ...statements,
        env.DB.prepare(
          `UPDATE scans SET status = 'ready', merchant_name = ?, invoice_number = ?, purchase_date = ?,
             total_amount_vnd = ?, updated_at = datetime('now')
           WHERE id = ? AND status = 'processing' AND ${fence.guard}`,
        ).bind(receipt.merchant_name ?? null, receipt.invoice_number ?? null, receipt.purchase_date ?? null, receipt.total_amount_vnd ?? null, message.scanId, ...fence.bindings),
        env.DB.prepare(
          `UPDATE scan_queue_jobs SET status = 'ready', completed_at = datetime('now'), updated_at = datetime('now')
           WHERE id = ? AND status = 'processing' AND claim_token = ?`,
        ).bind(...fence.bindings),
      ];
      const commitResults = await env.DB.batch(commitStatements);
      assertFencedCommit(commitResults);
    } else {
      const result = await router.vision({
        imageBase64OrUrl: image.data,
        mimeType: image.mimeType,
      });
      const statements = result.items.map((item, index) => {
      const canonical = findCanonicalIngredient(item.raw_name);
      return env.DB.prepare(
        `INSERT INTO scan_items
          (id, scan_id, raw_name, canonical_id, estimated_quantity, unit, confidence, category, storage,
           ocr_raw_name, ocr_quantity, ocr_unit, ocr_confidence)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${fence.guard}`,
      ).bind(
        `scan_item_${message.scanId}_${index}`,
        message.scanId,
        item.raw_name,
        canonical?.id || item.canonical_id || null,
        item.estimated_quantity,
        item.unit as StandardUnit,
        item.confidence ?? LEGACY_CONFIDENCE_FILLER,
        canonical?.category || item.category || 'other',
        item.storage || 'fridge',
        item.raw_name,
        item.estimated_quantity,
        item.unit,
        item.confidence ?? null,
        ...fence.bindings,
      );
      });
      const commitStatements = [
        fence.acquire,
        env.DB.prepare(`DELETE FROM scan_items WHERE scan_id = ? AND ${fence.guard}`).bind(message.scanId, ...fence.bindings),
        ...statements,
        env.DB.prepare(`UPDATE scans SET status = 'ready', updated_at = datetime('now') WHERE id = ? AND status = 'processing' AND ${fence.guard}`)
          .bind(message.scanId, ...fence.bindings),
        env.DB.prepare(
          `UPDATE scan_queue_jobs SET status = 'ready', completed_at = datetime('now'), updated_at = datetime('now')
           WHERE id = ? AND status = 'processing' AND claim_token = ?`,
        ).bind(...fence.bindings),
      ];
      const commitResults = await env.DB.batch(commitStatements);
      assertFencedCommit(commitResults);
    }
  } catch (error) {
    const code = error instanceof ScanQueueError ? error.code : 'AI_SCAN_FAILED';
    const requestedRetry = error instanceof ScanQueueError ? error.retryable : true;
    const attemptsRow = await env.DB.prepare(
      `SELECT attempts, max_attempts FROM scan_queue_jobs WHERE id = ? AND status = 'processing' AND claim_token = ?`,
    ).bind(jobId, claimToken).first<{ attempts: number; max_attempts: number }>();
    if (!attemptsRow) throw new ScanQueueError('Scan job claim is no longer owned', 'CLAIM_LOST', true);
    const retryable = requestedRetry && attemptsRow.attempts < attemptsRow.max_attempts;
    const fence = commitFence(env, message, jobId, claimToken);
    const failureResults = await env.DB.batch([
      fence.acquire,
      env.DB.prepare(`UPDATE scans SET status = ?, updated_at = datetime('now')
        WHERE id = ? AND status = 'processing' AND ${fence.guard}`)
        .bind(retryable ? 'pending' : 'failed', message.scanId, ...fence.bindings),
      env.DB.prepare(`UPDATE scan_queue_jobs SET status = ?, error_code = ?, error_message = ?,
        completed_at = CASE WHEN ? = 'failed' THEN datetime('now') ELSE NULL END, updated_at = datetime('now')
        WHERE id = ? AND status = 'processing' AND claim_token = ?`)
        .bind(retryable ? 'pending' : 'failed', code, error instanceof Error ? error.message.slice(0, 500) : String(error),
          retryable ? 'pending' : 'failed', ...fence.bindings),
    ]);
    assertFencedCommit(failureResults);
    throw new ScanQueueError(error instanceof Error ? error.message : String(error), code, retryable);
  }
}

export { parseMessage };
