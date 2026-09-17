import type { RuntimeRecipe } from '../runtime-recipe';

/**
 * T14E — Bulk recipe import factory (ADR-027). Shared types.
 *
 * The factory turns an AUTHORIZED raw batch into a reviewed, deterministic set of artifacts
 * (normalized recipes, reports, future-migration SQL, catalog release manifest). It never
 * touches `migrations/`, `ALL_RECIPES`, D1 or R2: promotion is a separate reviewed step (T14F).
 */

export const IMPORT_BATCH_SCHEMA_VERSION = 1 as const;
export const CATALOG_RELEASE_SCHEMA_VERSION = 1 as const;
export const ARTIFACT_MANIFEST_SCHEMA_VERSION = 1 as const;

/** Machine-readable issue codes. Sorted deterministically in every report. */
export const IMPORT_ISSUE_CODES = [
  'INVALID_INPUT',
  'INVALID_SCHEMA',
  'INVALID_IDENTITY',
  'ID_COLLISION',
  'LEGACY_ID_COLLISION',
  'SLUG_COLLISION',
  'LEGACY_SLUG_COLLISION',
  'INVALID_SLUG',
  'INVALID_PROVENANCE',
  'UNSUPPORTED_CUISINE',
  'INVALID_REGION',
  'INVALID_CATEGORY',
  'INVALID_TAGS',
  'INVALID_CLASSIFICATION',
  'UNRESOLVED_INGREDIENT',
  'AMBIGUOUS_INGREDIENT',
  'UNSUPPORTED_UNIT',
  'INVALID_QUANTITY',
  'INVALID_STEP_ORDER',
  'INVALID_NUTRITION',
  'INVALID_IMAGE_URL',
  'INVALID_BATCH_ORDER',
  'DUPLICATE_SOURCE',
  'DUPLICATE_RECIPE',
  'POSSIBLE_DUPLICATE',
  'UNREVIEWED_RECIPE',
  'RUNTIME_CONTRACT_VIOLATION',
  'BATCH_COLLISION',
  'BATCH_HASH_MISMATCH',
  'NUTRITION_EVIDENCE_LOST',
] as const;
export type ImportIssueCode = (typeof IMPORT_ISSUE_CODES)[number];

export type ImportIssueSeverity = 'error' | 'warning';

export interface ImportIssue {
  code: ImportIssueCode;
  severity: ImportIssueSeverity;
  /** `batch` for batch-level issues, otherwise `<sourceNamespace>:<sourceRecordId>` (or the row index when identity is unreadable). */
  subject: string;
  /** Deterministic, human-readable detail; never echoes large payloads. */
  detail: string;
  /** JSON-path-like location inside the record when known. */
  path?: string;
}

/** Stable identity of one raw source record. Never derived from title/position/slug. */
export interface ImportSourceIdentity {
  sourceNamespace: string;
  sourceRecordId: string;
}

/**
 * A normalized, publishable recipe: the runtime contract plus the import metadata the SQL
 * renderer and release manifest need. `runtime` is exactly what `hydrateRuntimeRecipes` must
 * rebuild from D1 for the release fingerprint to match.
 */
export interface NormalizedImportRecipe {
  runtime: RuntimeRecipe;
  source: ImportSourceIdentity;
  sourceKey: string;
  /** 0-based deterministic position inside its batch (explicit `batchOrder`). */
  batchOrder: number;
  provenance: { sourceType: 'curated' | 'imported' | 'ai_generated'; sourceReference: string; verificationState: 'reviewed'; version: 1 };
  classifications: Array<{ kind: ClassificationKind; tag: string }>;
  /**
   * Evidence-backed nutrition (ADR-004): present iff `runtime.nutrition` is present. The macros are runtime
   * semantics (they mirror `runtime.nutrition` and the legacy compatibility columns); `evidence` is
   * provenance and is persisted as a per-serving `nutrition_profiles` row linked via `recipe_nutrition`.
   */
  nutritionEvidence: NutritionEvidence | null;
  /** Human duplicate-review decision carried with the reviewed record (part of the immutable batch identity). */
  duplicateReview: DuplicateReviewRecord | null;
  /** SHA-256 over the canonical runtime projection of this single recipe. */
  contentFingerprint: string;
}

export interface NutritionEvidence {
  calories: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  /** Source/evidence reference → `nutrition_profiles.source_reference`. */
  evidence: string;
  /** `nutrition_profiles.source_type`; imports default to `imported`. */
  sourceType: 'authoritative' | 'imported' | 'calculated' | 'estimated';
}

export const CLASSIFICATION_KINDS = ['meal_type', 'dietary', 'allergen', 'method', 'equipment', 'suitability'] as const;
export type ClassificationKind = (typeof CLASSIFICATION_KINDS)[number];

export interface DuplicateReviewRecord {
  decision: 'distinct';
  reason: string;
}

export interface ImportSummary {
  inputRecords: number;
  valid: number;
  invalid: number;
  publishable: number;
  duplicates: number;
  possibleDuplicates: number;
  unresolvedIngredients: number;
  unsupportedCuisine: number;
  warnings: number;
  errors: number;
}
