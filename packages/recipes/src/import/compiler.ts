import type { Recipe } from '../types';
import { canonicalEntryOf, catalogEntryFromRuntime, detectDuplicates, DuplicateIndex, serializeDuplicateReport, type DuplicateReport } from './duplicates';
import { canonicalJson, sha256Hex } from './identity';
import { createIngredientResolver, type IngredientResolver } from './ingredients';
import { normalizeImportRecord } from './normalize';
import { parseImportInput, type RawImportBatch } from './parse';
import { composeCatalogRelease, computeBatchHash, serializeCatalogReleaseManifest, type ApprovedBatchContent, type CatalogReleaseManifest } from './release-manifest';
import { ImportBatchHeaderSchema, type ImportBatchHeader } from './schema';
import { renderImportBatchSql } from './sql-render';
import { ARTIFACT_MANIFEST_SCHEMA_VERSION, type ImportIssue, type ImportSummary, type NormalizedImportRecipe } from './types';

/**
 * Import compiler (T14E). Pure orchestration over bytes → artifacts; the CLI owns the filesystem.
 *
 *   parse → schema → normalize → ingredient resolution → duplicates → quality gates
 *        → reviewed batch → SQL render → release manifest (legacy + approved + this batch)
 *        → artifact manifest with hashes
 *
 * Fail-closed: any error ⇒ `publishable=false`, `migration.sql` is NOT produced (diagnostic
 * artifacts still are, deterministically). Same bytes + same previous release ⇒ byte-identical output.
 */

export const IMPORT_ARTIFACT_FILES = Object.freeze({
  normalized: 'normalized-recipes.json',
  validation: 'validation-report.json',
  duplicates: 'duplicate-report.json',
  unresolved: 'unresolved-ingredients.json',
  migration: 'migration.sql',
  release: 'catalog-release-manifest.json',
  artifact: 'artifact-manifest.json',
});

export interface CompileOptions {
  /** Legacy static rollback baseline (ALL_RECIPES). */
  legacy: readonly Recipe[];
  /** Previously approved batches (content), in release order. Empty today. */
  approvedBatches?: readonly ApprovedBatchContent[];
  resolver?: IngredientResolver;
}

export interface CompileResult {
  ok: boolean;
  header: ImportBatchHeader | null;
  batchHash: string | null;
  recipes: NormalizedImportRecipe[];
  issues: ImportIssue[];
  summary: ImportSummary;
  duplicateReport: DuplicateReport;
  unresolvedIngredients: Array<{ subject: string; text: string; status: 'unresolved' | 'ambiguous'; candidates: string[] }>;
  releaseManifest: CatalogReleaseManifest | null;
  /** File name → exact bytes. `migration.sql` only when `ok`. */
  artifacts: Map<string, string>;
  inputSha256: string;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export function sortIssues(issues: ImportIssue[]): ImportIssue[] {
  return [...issues].sort((a, b) => cmp(a.subject, b.subject) || cmp(a.code, b.code) || cmp(a.path ?? '', b.path ?? '') || cmp(a.detail, b.detail));
}

export async function compileImportBatch(bytes: Uint8Array, format: 'json' | 'jsonl', options: CompileOptions): Promise<CompileResult> {
  const inputSha256 = await sha256Hex(bytes);
  const resolver = options.resolver ?? createIngredientResolver();
  const approvedBatches = options.approvedBatches ?? [];
  const parsed = parseImportInput(bytes, format);
  const summary: ImportSummary = { inputRecords: 0, valid: 0, invalid: 0, publishable: 0, duplicates: 0, possibleDuplicates: 0, unresolvedIngredients: 0, unsupportedCuisine: 0, warnings: 0, errors: 0 };
  const empty: DuplicateReport = { hard: [], possible: [] };
  if (!parsed.ok) {
    summary.errors = parsed.issues.length;
    return finish({ ok: false, header: null, batchHash: null, recipes: [], issues: sortIssues(parsed.issues), summary, duplicateReport: empty, unresolvedIngredients: [], releaseManifest: null, artifacts: new Map(), inputSha256 });
  }
  return compileParsedBatch(parsed.batch, { ...options, resolver, approvedBatches }, inputSha256, summary);
}

async function compileParsedBatch(batch: RawImportBatch, options: Required<Pick<CompileOptions, 'resolver' | 'approvedBatches'>> & CompileOptions, inputSha256: string, summary: ImportSummary): Promise<CompileResult> {
  const header = ImportBatchHeaderSchema.parse(batch.header);
  const issues: ImportIssue[] = [];
  const recipes: NormalizedImportRecipe[] = [];
  const unresolved: CompileResult['unresolvedIngredients'] = [];
  const waivers = new Map<string, { decision: 'distinct'; reason: string }>();
  summary.inputRecords = batch.records.length;

  const batchOrders: number[] = [];
  for (const [rowIndex, raw] of batch.records.entries()) {
    const outcome = await normalizeImportRecord(raw, header, options.resolver, rowIndex);
    issues.push(...outcome.issues);
    const rawOrder = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).batchOrder : undefined;
    if (outcome.batchOrder !== null) batchOrders.push(outcome.batchOrder);
    else if (Number.isInteger(rawOrder)) batchOrders.push(rawOrder as number);
    for (const item of outcome.unresolvedIngredients) unresolved.push({ subject: outcome.issues[0]?.subject ?? `row:${rowIndex}`, ...item });
    if (outcome.recipe) {
      recipes.push(outcome.recipe);
      if (outcome.recipe.duplicateReview) waivers.set(outcome.recipe.sourceKey, outcome.recipe.duplicateReview);
      summary.valid += 1;
    } else summary.invalid += 1;
  }

  // Explicit batch order must be exactly 0..N-1 over every schema-valid record; physical order is irrelevant.
  const orders = [...batchOrders].sort((a, b) => a - b);
  const schemaBroken = issues.some((issue) => issue.code === 'INVALID_SCHEMA');
  if (!schemaBroken && orders.some((order, index) => order !== index)) {
    issues.push({ code: 'INVALID_BATCH_ORDER', severity: 'error', subject: 'batch', detail: `batchOrder values must be exactly 0..${orders.length - 1} with no gaps or duplicates` });
  }
  const sameSource = new Map<string, number>();
  for (const recipe of recipes) sameSource.set(recipe.sourceKey, (sameSource.get(recipe.sourceKey) ?? 0) + 1);
  for (const [key, count] of [...sameSource].sort(([a], [b]) => cmp(a, b))) {
    if (count > 1) issues.push({ code: 'DUPLICATE_SOURCE', severity: 'error', subject: key, detail: `source record appears ${count} times in the batch` });
  }

  // Duplicate detection against legacy + approved batches + within batch (indexed).
  const existing = new DuplicateIndex();
  for (const entry of await canonicalEntryOf(options.legacy)) existing.add(entry);
  for (const approved of options.approvedBatches) {
    for (const recipe of approved.recipes) existing.add(catalogEntryFromRuntime(recipe.runtime, recipe.contentFingerprint, 'approved_batch', recipe.sourceKey));
  }
  const uniqueRecipes = recipes.filter((recipe) => sameSource.get(recipe.sourceKey) === 1);
  const duplicates = detectDuplicates(uniqueRecipes, existing, waivers);
  issues.push(...duplicates.issues);

  // Evidence-only nutrition contract: a publishable recipe with macros MUST carry its evidence into the
  // canonical model. This can only trip on an internal regression, and it must fail closed if it does.
  for (const recipe of recipes) {
    const hasMacros = recipe.runtime.nutrition !== undefined;
    const evidenceOk = recipe.nutritionEvidence !== null && recipe.nutritionEvidence.evidence.length > 0;
    if (hasMacros !== evidenceOk) issues.push({ code: 'NUTRITION_EVIDENCE_LOST', severity: 'error', subject: recipe.sourceKey, detail: 'nutrition macros without attached evidence (or evidence without macros) in the canonical model', path: 'nutrition' });
  }

  const sorted = sortIssues(issues);
  summary.errors = sorted.filter((issue) => issue.severity === 'error').length;
  summary.warnings = sorted.filter((issue) => issue.severity === 'warning').length;
  summary.duplicates = duplicates.report.hard.length;
  summary.possibleDuplicates = duplicates.report.possible.length;
  summary.unresolvedIngredients = unresolved.length;
  summary.unsupportedCuisine = sorted.filter((issue) => issue.code === 'UNSUPPORTED_CUISINE').length;
  const ok = summary.errors === 0;
  summary.publishable = ok ? recipes.length : 0;

  const batchHash = await computeBatchHash(header, recipes);
  let releaseManifest: CatalogReleaseManifest | null = null;
  if (ok) {
    releaseManifest = (await composeCatalogRelease(options.legacy, [...options.approvedBatches, { header, recipes }])).manifest;
  }
  return finish({ ok, header, batchHash, recipes: [...recipes].sort((a, b) => a.batchOrder - b.batchOrder), issues: sorted, summary, duplicateReport: duplicates.report, unresolvedIngredients: unresolved.sort((a, b) => cmp(a.subject, b.subject) || cmp(a.text, b.text)), releaseManifest, artifacts: new Map(), inputSha256 });
}

async function finish(result: CompileResult): Promise<CompileResult> {
  const artifacts = result.artifacts;
  const json = (value: unknown) => `${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`;
  // The normalized artifact is the auditable reviewed batch: it carries every field the immutable batch
  // hash commits to (batch metadata incl. license/usageNote, per-recipe evidence and review decisions).
  const normalizedText = json({
    schemaVersion: result.header?.schemaVersion ?? null,
    batchId: result.header?.batchId ?? null,
    batchHash: result.batchHash,
    source: result.header ? { sourceType: result.header.source.sourceType, sourceNamespace: result.header.source.sourceNamespace, sourceReference: result.header.source.sourceReference, license: result.header.source.license ?? null, usageNote: result.header.source.usageNote ?? null } : null,
    recipes: result.recipes.map((recipe) => ({ id: recipe.runtime.id, sourceKey: recipe.sourceKey, batchOrder: recipe.batchOrder, contentFingerprint: recipe.contentFingerprint, provenance: recipe.provenance, classifications: recipe.classifications, nutritionEvidence: recipe.nutritionEvidence, duplicateReview: recipe.duplicateReview, runtime: recipe.runtime })),
  });
  artifacts.set(IMPORT_ARTIFACT_FILES.normalized, normalizedText);
  artifacts.set(IMPORT_ARTIFACT_FILES.validation, json({ ok: result.ok, summary: result.summary, issues: result.issues }));
  artifacts.set(IMPORT_ARTIFACT_FILES.duplicates, `${JSON.stringify(JSON.parse(serializeDuplicateReport(result.duplicateReport)), null, 2)}\n`);
  artifacts.set(IMPORT_ARTIFACT_FILES.unresolved, json(result.unresolvedIngredients));
  let migrationText: string | null = null;
  let releaseText: string | null = null;
  if (result.ok && result.header && result.batchHash && result.releaseManifest) {
    const releaseBaseCount = result.releaseManifest.approvedImportBatches.at(-1)?.releaseBaseCount ?? result.releaseManifest.legacyBaselineCount;
    migrationText = renderImportBatchSql({ batchId: result.header.batchId, batchHash: result.batchHash, releaseBaseCount, recipes: result.recipes });
    releaseText = serializeCatalogReleaseManifest(result.releaseManifest);
    artifacts.set(IMPORT_ARTIFACT_FILES.migration, migrationText);
    artifacts.set(IMPORT_ARTIFACT_FILES.release, releaseText);
  }
  const ingredientLineCount = result.recipes.reduce((total, recipe) => total + recipe.runtime.ingredients.length, 0);
  const stepCount = result.recipes.reduce((total, recipe) => total + recipe.runtime.steps.length, 0);
  artifacts.set(IMPORT_ARTIFACT_FILES.artifact, json({
    schemaVersion: ARTIFACT_MANIFEST_SCHEMA_VERSION,
    batchId: result.header?.batchId ?? null,
    batchHash: result.batchHash,
    publishable: result.ok,
    inputSha256: result.inputSha256,
    normalizedSha256: await sha256Hex(normalizedText),
    migrationSha256: migrationText === null ? null : await sha256Hex(migrationText),
    releaseManifestSha256: releaseText === null ? null : await sha256Hex(releaseText),
    releaseId: result.releaseManifest?.releaseId ?? null,
    recipeCount: result.recipes.length,
    ingredientLineCount,
    stepCount,
    warningCount: result.summary.warnings,
    errorCount: result.summary.errors,
  }));
  return result;
}
