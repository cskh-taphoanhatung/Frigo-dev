import { z } from 'zod';
import { RUNTIME_RECIPE_CUISINES, RUNTIME_RECIPE_REGIONS } from '../runtime-recipe';
import { CLASSIFICATION_KINDS, IMPORT_BATCH_SCHEMA_VERSION } from './types';

/**
 * Versioned bulk import batch contract (T14E). Deliberately STRICTER than the historical D1
 * schema: every publishable record needs stable source identity, non-empty provenance, an
 * explicit batch-local order and a reviewed verification state. Units, cuisine and region are
 * the closed runtime vocabularies; nothing is coerced or defaulted.
 *
 * Text fields are bounded so a hostile or accidental multi-megabyte record cannot pass. Quantities
 * must be finite and positive (string quantities, NaN and Infinity are rejected by Zod).
 */

export const IMPORT_LIMITS = Object.freeze({
  maxRecordBytes: 64 * 1024,
  maxRecordsPerBatch: 10_000,
  maxTitle: 200,
  maxDescription: 4_000,
  maxInstruction: 2_000,
  maxTip: 1_000,
  maxIngredients: 100,
  maxSteps: 100,
  maxTags: 30,
  maxTagLength: 40,
  maxClassifications: 60,
  maxCookTimeMinutes: 24 * 60,
  maxServings: 100,
  maxTimerMinutes: 24 * 60,
  maxSourceRef: 300,
  maxIdentityPart: 120,
});

/** Namespaces/record IDs: printable, no whitespace, no `:` (the source key separator). */
const IdentityPartSchema = z.string().min(1).max(IMPORT_LIMITS.maxIdentityPart).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const BoundedText = (max: number) => z.string().min(1).max(max).refine((v) => v.trim().length > 0 && !v.includes('\u0000'), 'text must be non-empty and free of NUL');

export const ImportSourceTypeSchema = z.enum(['curated', 'imported', 'ai_generated']);

export const ImportIngredientSchema = z.object({
  /** Free text as written in the source; resolved against the canonical ingredient catalog. */
  text: BoundedText(200),
  /** Optional explicit canonical ID supplied by a reviewer; must match `^[A-Z][A-Z0-9_]*$`. */
  ingredientId: z.string().regex(/^[A-Z][A-Z0-9_]*$/).max(100).optional(),
  quantity: z.number().finite().positive(),
  unit: z.string().min(1).max(20),
  isOptional: z.boolean().optional(),
}).strict();

export const ImportStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  instruction: BoundedText(IMPORT_LIMITS.maxInstruction),
  tip: BoundedText(IMPORT_LIMITS.maxTip).optional(),
  timerMinutes: z.number().int().positive().max(IMPORT_LIMITS.maxTimerMinutes).optional(),
}).strict();

export const ImportNutritionSchema = z.object({
  calories: z.number().finite().nonnegative(),
  proteinG: z.number().finite().nonnegative(),
  fatG: z.number().finite().nonnegative(),
  carbG: z.number().finite().nonnegative(),
  /** Where the numbers come from; required so nutrition is never silently fabricated. Persisted as nutrition_profiles.source_reference. */
  evidence: BoundedText(IMPORT_LIMITS.maxSourceRef),
  /** nutrition_profiles.source_type (ADR-004); defaults to `imported`. `authoritative` is a reviewer claim, not verification. */
  sourceType: z.enum(['authoritative', 'imported', 'calculated', 'estimated']).optional(),
}).strict();

export const ImportClassificationSchema = z.object({
  kind: z.enum(CLASSIFICATION_KINDS),
  tag: BoundedText(60),
}).strict();

export const ImportDuplicateReviewSchema = z.object({
  decision: z.literal('distinct'),
  reason: BoundedText(300),
}).strict();

export const ImportRecipeRecordSchema = z.object({
  sourceRecordId: IdentityPartSchema,
  /** 0-based explicit position within the batch; physical file order is never authority. */
  batchOrder: z.number().int().nonnegative(),
  verificationState: z.enum(['unverified', 'reviewed', 'rejected']),
  title: BoundedText(IMPORT_LIMITS.maxTitle),
  description: BoundedText(IMPORT_LIMITS.maxDescription),
  /** Reviewer-supplied romanized slug; validated, never transliterated automatically. */
  slug: z.string().min(1).max(100),
  cuisine: z.string().min(1).max(40),
  category: z.string().max(60).optional(),
  region: z.string().max(20).optional(),
  cookTimeMinutes: z.number().int().nonnegative().max(IMPORT_LIMITS.maxCookTimeMinutes),
  servings: z.number().int().positive().max(IMPORT_LIMITS.maxServings),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  /** Optional same-origin image path; anything else fails (no new external image debt). */
  imageUrl: z.string().max(300).optional(),
  nutrition: ImportNutritionSchema.optional(),
  ingredients: z.array(ImportIngredientSchema).min(1).max(IMPORT_LIMITS.maxIngredients),
  steps: z.array(ImportStepSchema).min(1).max(IMPORT_LIMITS.maxSteps),
  tags: z.array(z.string().max(IMPORT_LIMITS.maxTagLength)).max(IMPORT_LIMITS.maxTags).default([]),
  classifications: z.array(ImportClassificationSchema).max(IMPORT_LIMITS.maxClassifications).default([]),
  duplicateReview: ImportDuplicateReviewSchema.optional(),
}).strict();
export type ImportRecipeRecord = z.infer<typeof ImportRecipeRecordSchema>;

export const ImportBatchSourceSchema = z.object({
  sourceType: ImportSourceTypeSchema,
  sourceNamespace: IdentityPartSchema,
  /** Dataset / editorial batch / provider / generation reference. Becomes `recipes.source_reference`. */
  sourceReference: BoundedText(IMPORT_LIMITS.maxSourceRef),
  license: BoundedText(300).optional(),
  usageNote: BoundedText(1_000).optional(),
}).strict();

export const ImportBatchHeaderSchema = z.object({
  schemaVersion: z.literal(IMPORT_BATCH_SCHEMA_VERSION),
  batchId: IdentityPartSchema,
  source: ImportBatchSourceSchema,
}).strict();
export type ImportBatchHeader = z.infer<typeof ImportBatchHeaderSchema>;

export const ImportBatchSchema = ImportBatchHeaderSchema.extend({
  recipes: z.array(z.unknown()).max(IMPORT_LIMITS.maxRecordsPerBatch),
}).strict();

/** Fully typed batch after every record passed the record schema. */
export interface ImportBatch extends ImportBatchHeader {
  recipes: ImportRecipeRecord[];
}

export const SUPPORTED_IMPORT_CUISINES: readonly string[] = RUNTIME_RECIPE_CUISINES;
export const SUPPORTED_IMPORT_REGIONS: readonly string[] = RUNTIME_RECIPE_REGIONS;
