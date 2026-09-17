import { z } from 'zod';
import { fingerprintRecipes } from '../catalog-fingerprint';
import { toRuntimeRecipe, type RuntimeRecipe } from '../runtime-recipe';
import type { Recipe } from '../types';
import { canonicalJson, sha256Hex } from './identity';
import type { ImportBatchHeader } from './schema';
import { CATALOG_RELEASE_SCHEMA_VERSION, type NormalizedImportRecipe } from './types';

/**
 * Catalog Release Manifest (T14E, ADR-027).
 *
 *   ALL_RECIPES (71)         = immutable legacy/static rollback baseline
 *   Catalog Release Manifest = the reviewed, COMPLETE catalog D1 is expected to serve:
 *                              legacy baseline + approved immutable import batches, in order
 *   D1 authority readiness   = hydrated D1 catalog must equal the manifest exactly
 *
 * The manifest is reviewed authority metadata shipped with the application (never loaded from a
 * request, D1 row, KV or URL). Every field is derived by `composeCatalogRelease`, so the checked-in
 * file can be regenerated and compared; nothing is hand-maintained.
 */

/**
 * Compact by design: `batchHash` cryptographically commits to ALL review-relevant metadata (schema
 * version, license, usage note, nutrition evidence, duplicate-review decisions, runtime content …) via
 * `canonicalBatchProjection`, and the batch's `normalized-recipes.json` artifact preserves every field
 * needed to audit/reproduce it. The runtime manifest therefore does not duplicate that metadata.
 */
export const ApprovedImportBatchSchema = z.object({
  batchId: z.string().min(1),
  /** SHA-256 over `canonicalBatchProjection` (see `computeBatchHash`). Immutable once approved. */
  batchHash: z.string().regex(/^[0-9a-f]{64}$/),
  recipeCount: z.number().int().nonnegative(),
  /** Runtime order of the batch's first recipe = number of recipes released before it. */
  releaseBaseCount: z.number().int().nonnegative(),
  sourceNamespace: z.string().min(1),
  sourceReference: z.string().min(1),
}).strict();
export type ApprovedImportBatch = z.infer<typeof ApprovedImportBatchSchema>;

export const CatalogReleaseManifestSchema = z.object({
  schemaVersion: z.literal(CATALOG_RELEASE_SCHEMA_VERSION),
  releaseId: z.string().regex(/^rel-[0-9a-f]{16}$/),
  legacyBaselineCount: z.number().int().nonnegative(),
  legacyBaselineFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  expectedRecipeCount: z.number().int().nonnegative(),
  orderedRecipeIds: z.array(z.string().min(1)),
  expectedRuntimeFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  approvedImportBatches: z.array(ApprovedImportBatchSchema),
}).strict().superRefine((manifest, ctx) => {
  if (manifest.orderedRecipeIds.length !== manifest.expectedRecipeCount) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'expectedRecipeCount must equal orderedRecipeIds.length' });
  if (new Set(manifest.orderedRecipeIds).size !== manifest.orderedRecipeIds.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'orderedRecipeIds must be unique' });
  let base = manifest.legacyBaselineCount;
  for (const batch of manifest.approvedImportBatches) {
    if (batch.releaseBaseCount !== base) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `batch ${batch.batchId} releaseBaseCount must be ${base}` });
    base += batch.recipeCount;
  }
  if (base !== manifest.expectedRecipeCount) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'legacy baseline + approved batches must sum to expectedRecipeCount' });
});
export type CatalogReleaseManifest = z.infer<typeof CatalogReleaseManifestSchema>;

/** Content of one approved batch as the composer needs it. */
export interface ApprovedBatchContent {
  header: ImportBatchHeader;
  recipes: readonly NormalizedImportRecipe[];
}

/**
 * THE canonical projection of an immutable reviewed batch. Everything a reviewer approved is here —
 * schema version, batch identity, full source provenance (incl. license / usage note), and per recipe:
 * batch order, source key, runtime content, provenance, classifications, nutrition evidence and the
 * duplicate-review decision. Nothing about physical row order, JSON whitespace, key order, file paths,
 * timestamps or diagnostics participates. Every hash in the factory (compile, verify, release
 * composition, CLI) goes through `computeBatchHash` → this projection; there is no second implementation.
 */
export function canonicalBatchProjection(header: ImportBatchHeader, recipes: readonly NormalizedImportRecipe[]): string {
  const ordered = [...recipes].sort((a, b) => a.batchOrder - b.batchOrder);
  return canonicalJson({
    schemaVersion: header.schemaVersion,
    batchId: header.batchId,
    source: {
      sourceType: header.source.sourceType,
      sourceNamespace: header.source.sourceNamespace,
      sourceReference: header.source.sourceReference,
      license: header.source.license ?? null,
      usageNote: header.source.usageNote ?? null,
    },
    recipes: ordered.map((recipe) => ({
      batchOrder: recipe.batchOrder,
      sourceKey: recipe.sourceKey,
      runtime: recipe.runtime,
      provenance: recipe.provenance,
      classifications: recipe.classifications,
      nutritionEvidence: recipe.nutritionEvidence,
      duplicateReview: recipe.duplicateReview,
    })),
  });
}

/** SHA-256 of {@link canonicalBatchProjection}. */
export async function computeBatchHash(header: ImportBatchHeader, recipes: readonly NormalizedImportRecipe[]): Promise<string> {
  return sha256Hex(canonicalBatchProjection(header, recipes));
}

export async function deriveReleaseId(legacyBaselineFingerprint: string, batches: readonly Pick<ApprovedImportBatch, 'batchId' | 'batchHash'>[]): Promise<string> {
  const hash = await sha256Hex(canonicalJson({ legacyBaselineFingerprint, batches: batches.map((batch) => ({ batchId: batch.batchId, batchHash: batch.batchHash })) }));
  return `rel-${hash.slice(0, 16)}`;
}

export class CatalogCompositionError extends Error {
  constructor(readonly code: 'BATCH_ORDER_INVALID' | 'ID_COLLISION' | 'SLUG_COLLISION' | 'BATCH_COLLISION', message: string) {
    super(message); this.name = 'CatalogCompositionError';
  }
}

export interface ComposedCatalogRelease {
  manifest: CatalogReleaseManifest;
  /** Full expected runtime catalog in release order (legacy first, then batches). */
  recipes: RuntimeRecipe[];
}

/**
 * legacyStaticCatalog + approvedBatch1 + approvedBatch2 … = Catalog Release. O(total recipes):
 * ID/slug uniqueness via maps; batch order must be exactly 0..N-1; identical batchIds are allowed
 * only when byte-identical (same hash) and then counted once.
 */
export async function composeCatalogRelease(legacy: readonly Recipe[], batches: readonly ApprovedBatchContent[] = []): Promise<ComposedCatalogRelease> {
  const recipes: RuntimeRecipe[] = legacy.map(toRuntimeRecipe);
  const ids = new Map<string, string>();
  const slugs = new Map<string, string>();
  for (const recipe of recipes) {
    if (ids.has(recipe.id)) throw new CatalogCompositionError('ID_COLLISION', `legacy recipe ID ${recipe.id} is duplicated`);
    if (slugs.has(recipe.slug)) throw new CatalogCompositionError('SLUG_COLLISION', `legacy slug ${recipe.slug} is duplicated`);
    ids.set(recipe.id, 'legacy'); slugs.set(recipe.slug, 'legacy');
  }
  const legacyBaselineFingerprint = await fingerprintRecipes(recipes);
  const approved: ApprovedImportBatch[] = [];
  const seenBatches = new Map<string, string>();
  for (const batch of batches) {
    const batchHash = await computeBatchHash(batch.header, batch.recipes);
    const previous = seenBatches.get(batch.header.batchId);
    if (previous !== undefined) {
      if (previous === batchHash) continue;
      throw new CatalogCompositionError('BATCH_COLLISION', `batch ${batch.header.batchId} appears twice with different content`);
    }
    seenBatches.set(batch.header.batchId, batchHash);
    const ordered = [...batch.recipes].sort((a, b) => a.batchOrder - b.batchOrder);
    ordered.forEach((recipe, index) => {
      if (recipe.batchOrder !== index) throw new CatalogCompositionError('BATCH_ORDER_INVALID', `batch ${batch.header.batchId}: batchOrder must be exactly 0..N-1`);
      if (ids.has(recipe.runtime.id)) throw new CatalogCompositionError('ID_COLLISION', `recipe ID ${recipe.runtime.id} collides with ${ids.get(recipe.runtime.id)}`);
      if (slugs.has(recipe.runtime.slug)) throw new CatalogCompositionError('SLUG_COLLISION', `slug ${recipe.runtime.slug} collides with ${slugs.get(recipe.runtime.slug)}`);
      ids.set(recipe.runtime.id, batch.header.batchId); slugs.set(recipe.runtime.slug, batch.header.batchId);
    });
    approved.push({
      batchId: batch.header.batchId, batchHash, recipeCount: ordered.length, releaseBaseCount: recipes.length,
      sourceNamespace: batch.header.source.sourceNamespace, sourceReference: batch.header.source.sourceReference,
    });
    for (const recipe of ordered) recipes.push(recipe.runtime);
  }
  const manifest: CatalogReleaseManifest = {
    schemaVersion: CATALOG_RELEASE_SCHEMA_VERSION,
    releaseId: await deriveReleaseId(legacyBaselineFingerprint, approved),
    legacyBaselineCount: legacy.length,
    legacyBaselineFingerprint,
    expectedRecipeCount: recipes.length,
    orderedRecipeIds: recipes.map((recipe) => recipe.id),
    expectedRuntimeFingerprint: await fingerprintRecipes(recipes),
    approvedImportBatches: approved,
  };
  return { manifest: CatalogReleaseManifestSchema.parse(manifest), recipes };
}

/** Stable serialization of a manifest (2-space JSON, keys in schema order, trailing newline). */
export function serializeCatalogReleaseManifest(manifest: CatalogReleaseManifest): string {
  const ordered: CatalogReleaseManifest = {
    schemaVersion: manifest.schemaVersion, releaseId: manifest.releaseId,
    legacyBaselineCount: manifest.legacyBaselineCount, legacyBaselineFingerprint: manifest.legacyBaselineFingerprint,
    expectedRecipeCount: manifest.expectedRecipeCount, orderedRecipeIds: [...manifest.orderedRecipeIds],
    expectedRuntimeFingerprint: manifest.expectedRuntimeFingerprint,
    approvedImportBatches: manifest.approvedImportBatches.map((batch) => ({
      batchId: batch.batchId, batchHash: batch.batchHash, recipeCount: batch.recipeCount, releaseBaseCount: batch.releaseBaseCount,
      sourceNamespace: batch.sourceNamespace, sourceReference: batch.sourceReference,
    })),
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

export function parseCatalogReleaseManifest(value: unknown): CatalogReleaseManifest {
  return CatalogReleaseManifestSchema.parse(value);
}
