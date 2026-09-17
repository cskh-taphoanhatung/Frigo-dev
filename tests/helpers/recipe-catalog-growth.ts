import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { compileImportBatch, type CompileResult } from '../../packages/recipes/src/import/compiler';
import { importFormatForPath } from '../../packages/recipes/src/import/parse';
import type { ApprovedBatchContent } from '../../packages/recipes/src/import/release-manifest';

/**
 * T14F real-catalog test helpers. Everything here consumes the COMMITTED reviewed source batches
 * (`data/recipe-import/approved-batches.json` → `data/recipe-import/t14f/*.jsonl`) through the real
 * T14E compiler — no synthetic fixtures — so the tests certify the catalog that ships.
 */

export const APPROVED_BATCH_REGISTRY_PATH = path.resolve(process.cwd(), 'data/recipe-import/approved-batches.json');
/** Static 71-recipe baseline fingerprint certified by T14D/T14E; must never change in T14F. */
export const LEGACY_BASELINE_FINGERPRINT = '9ae153e64d34b30d72bb985d4070d8e210201219c0e8f8998ce8f99057fc7c3f';

export interface ApprovedBatchRegistryEntry { batchId: string; source: string; migration: string; recipeCount: number }
export interface CompiledApprovedBatch { entry: ApprovedBatchRegistryEntry; result: CompileResult; content: ApprovedBatchContent }

export function readApprovedBatchRegistry(): ApprovedBatchRegistryEntry[] {
  return (JSON.parse(readFileSync(APPROVED_BATCH_REGISTRY_PATH, 'utf8')) as { batches: ApprovedBatchRegistryEntry[] }).batches;
}

export function readBatchBytes(source: string): Uint8Array {
  return new Uint8Array(readFileSync(path.resolve(process.cwd(), source)));
}

/** Compiles every registered batch in release order, each against legacy + the batches before it. */
export async function compileApprovedBatches(limit?: number): Promise<CompiledApprovedBatch[]> {
  const compiled: CompiledApprovedBatch[] = [];
  for (const entry of readApprovedBatchRegistry().slice(0, limit)) {
    const format = importFormatForPath(entry.source);
    if (!format) throw new Error(`unsupported batch source ${entry.source}`);
    const result = await compileImportBatch(readBatchBytes(entry.source), format, { legacy: ALL_RECIPES, approvedBatches: compiled.map((batch) => batch.content) });
    if (!result.ok || !result.header) throw new Error(`approved batch ${entry.batchId} does not compile: ${result.issues.map((issue) => `${issue.code}:${issue.subject}`).join(', ')}`);
    compiled.push({ entry, result, content: { header: result.header, recipes: result.recipes } });
  }
  return compiled;
}

export async function approvedBatchesFromRegistry(limit?: number): Promise<ApprovedBatchContent[]> {
  return (await compileApprovedBatches(limit)).map((batch) => batch.content);
}
