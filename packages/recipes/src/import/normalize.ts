import { LEGACY_CATEGORY_TAG_PREFIX, LEGACY_REGION_TAG_PREFIX } from '../seed-render';
import { RuntimeRecipeSchema, type RuntimeRecipe } from '../runtime-recipe';
import { canonicalJson, deriveImportRecipeId, isValidImportSlug, sha256Hex, sourceKeyOf } from './identity';
import type { IngredientResolver } from './ingredients';
import { isSupportedUnit } from './ingredients';
import { ImportRecipeRecordSchema, SUPPORTED_IMPORT_CUISINES, SUPPORTED_IMPORT_REGIONS, type ImportBatchHeader, type ImportRecipeRecord } from './schema';
import type { ImportIssue, ImportIssueCode, NormalizedImportRecipe } from './types';

/**
 * Per-record normalization + quality gates (T14E). Pure. Every failure is an issue with a
 * machine-readable code; a record with any error is NOT publishable. Nothing is defaulted: an
 * unresolved ingredient, unknown unit, unsupported cuisine or unreviewed state each fail closed.
 */

/**
 * imageUrl compatibility policy for imports: the runtime contract still carries `imageUrl`
 * (LEGACY_MEDIA_COMPATIBILITY_ONLY). Imported recipes may reference only an audited same-origin
 * path; when none is supplied, this shared placeholder is used so `classifyLegacyImageUrl` yields
 * `legacy_static` (never `missing`, never external). Real media arrives through T14C promotion.
 */
export const IMPORT_IMAGE_PLACEHOLDER = '/frigo/illustrations/delicious-meal.png';
const SAME_ORIGIN_IMAGE = /^\/[A-Za-z0-9][A-Za-z0-9/_.-]*\.(webp|avif|jpg|jpeg|png)$/;

export interface NormalizeOutcome {
  recipe: NormalizedImportRecipe | null;
  /** Present whenever the record passed the batch schema, even if later gates failed (for batch-order validation). */
  batchOrder: number | null;
  issues: ImportIssue[];
  /** Unresolved/ambiguous ingredient texts for the bounded report. */
  unresolvedIngredients: Array<{ text: string; status: 'unresolved' | 'ambiguous'; candidates: string[] }>;
}

const err = (code: ImportIssueCode, subject: string, detail: string, path?: string): ImportIssue =>
  ({ code, severity: 'error', subject, detail, ...(path ? { path } : {}) });

export function normalizeTags(tags: readonly string[]): { tags: string[]; problems: string[] } {
  const problems: string[] = [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (!tag) { problems.push('empty_tag'); continue; }
    if (tag.startsWith(LEGACY_CATEGORY_TAG_PREFIX) || tag.startsWith(LEGACY_REGION_TAG_PREFIX)) { problems.push(`legacy_marker:${tag}`); continue; }
    if (seen.has(tag)) continue; // dedupe, first occurrence wins (input order preserved)
    seen.add(tag);
    out.push(tag);
  }
  return { tags: out, problems: [...new Set(problems)].sort() };
}

export async function normalizeImportRecord(
  raw: unknown,
  header: ImportBatchHeader,
  resolver: IngredientResolver,
  rowIndex: number,
): Promise<NormalizeOutcome> {
  const issues: ImportIssue[] = [];
  const unresolvedIngredients: NormalizeOutcome['unresolvedIngredients'] = [];
  const parsed = ImportRecipeRecordSchema.safeParse(raw);
  const provisionalSubject = (raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).sourceRecordId === 'string')
    ? `${header.source.sourceNamespace}:${(raw as Record<string, unknown>).sourceRecordId as string}` : `row:${rowIndex}`;
  if (!parsed.success) {
    for (const problem of parsed.error.issues) issues.push(err('INVALID_SCHEMA', provisionalSubject, problem.message, problem.path.join('.') || 'record'));
    return { recipe: null, batchOrder: null, issues, unresolvedIngredients };
  }
  const record: ImportRecipeRecord = parsed.data;
  const source = { sourceNamespace: header.source.sourceNamespace, sourceRecordId: record.sourceRecordId };
  const subject = sourceKeyOf(source);
  const id = await deriveImportRecipeId(source);

  if (record.verificationState !== 'reviewed') issues.push(err('UNREVIEWED_RECIPE', subject, `verification_state=${record.verificationState}; publishable output requires reviewed`, 'verificationState'));
  if (!isValidImportSlug(record.slug)) issues.push(err('INVALID_SLUG', subject, 'slug must match ^[a-z0-9]+(?:-[a-z0-9]+)*$ (≤100 chars); supply a reviewed romanized slug', 'slug'));
  if (!SUPPORTED_IMPORT_CUISINES.includes(record.cuisine)) issues.push(err('UNSUPPORTED_CUISINE', subject, `cuisine "${record.cuisine}" is outside the closed runtime vocabulary (${SUPPORTED_IMPORT_CUISINES.join('|')})`, 'cuisine'));
  if (record.region !== undefined && !SUPPORTED_IMPORT_REGIONS.includes(record.region)) issues.push(err('INVALID_REGION', subject, `region "${record.region}" is not in ${SUPPORTED_IMPORT_REGIONS.join('|')}`, 'region'));
  if (record.region !== undefined && record.cuisine !== 'vietnamese') issues.push(err('INVALID_REGION', subject, 'region is a Vietnamese culinary vocabulary; omit it for other cuisines', 'region'));
  let category: string | undefined;
  if (record.category !== undefined) {
    category = record.category.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (!category) issues.push(err('INVALID_CATEGORY', subject, 'category must be non-empty when present', 'category'));
  }
  const { tags, problems: tagProblems } = normalizeTags(record.tags);
  if (tagProblems.length) issues.push(err('INVALID_TAGS', subject, tagProblems.join(', '), 'tags'));

  const classificationKeys = new Set<string>();
  const classifications: NormalizedImportRecipe['classifications'] = [];
  for (const [index, entry] of record.classifications.entries()) {
    const tag = entry.tag.normalize('NFKC').trim().replace(/\s+/g, ' ');
    const key = `${entry.kind}:${tag}`;
    if (classificationKeys.has(key)) { issues.push(err('INVALID_CLASSIFICATION', subject, `duplicate classification ${key}`, `classifications.${index}`)); continue; }
    classificationKeys.add(key);
    classifications.push({ kind: entry.kind, tag });
  }
  classifications.sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));

  // Ingredients: exact canonical resolution, closed units, positive finite quantities.
  const ingredients: RuntimeRecipe['ingredients'] = [];
  for (const [index, line] of record.ingredients.entries()) {
    const path = `ingredients.${index}`;
    const resolution = resolver.resolve(line.text, line.ingredientId);
    if (resolution.status === 'resolved') {
      ingredients.push({ ingredientId: resolution.ingredientId, name: line.text.normalize('NFKC').trim().replace(/\s+/g, ' '), requiredQuantity: line.quantity, unit: line.unit as RuntimeRecipe['ingredients'][number]['unit'], ...(line.isOptional ? { isOptional: true } : {}) });
    } else {
      const code: ImportIssueCode = resolution.status === 'ambiguous' ? 'AMBIGUOUS_INGREDIENT' : 'UNRESOLVED_INGREDIENT';
      issues.push(err(code, subject, `"${line.text}"${line.ingredientId ? ` (ingredientId=${line.ingredientId})` : ''}${resolution.candidates.length ? ` candidates: ${resolution.candidates.join(', ')}` : ''}`, path));
      unresolvedIngredients.push({ text: line.text, status: resolution.status, candidates: resolution.candidates });
    }
    if (!isSupportedUnit(line.unit)) issues.push(err('UNSUPPORTED_UNIT', subject, `unit "${line.unit}" is not a supported runtime unit`, `${path}.unit`));
    if (!(Number.isFinite(line.quantity) && line.quantity > 0 && line.quantity < 1e308)) issues.push(err('INVALID_QUANTITY', subject, 'quantity must be finite and > 0', `${path}.quantity`));
  }

  // Steps: integers, start at 1, contiguous, unique.
  const stepNumbers = record.steps.map((step) => step.stepNumber);
  const sortedSteps = [...record.steps].sort((a, b) => a.stepNumber - b.stepNumber);
  const contiguous = sortedSteps.every((step, index) => step.stepNumber === index + 1);
  if (!contiguous || new Set(stepNumbers).size !== stepNumbers.length) issues.push(err('INVALID_STEP_ORDER', subject, `step numbers must be exactly 1..${record.steps.length} without gaps or duplicates`, 'steps'));

  // imageUrl: audited same-origin only; absent ⇒ shared placeholder.
  let imageUrl = IMPORT_IMAGE_PLACEHOLDER;
  if (record.imageUrl !== undefined) {
    if (SAME_ORIGIN_IMAGE.test(record.imageUrl) && !record.imageUrl.includes('..') && !record.imageUrl.startsWith('//')) imageUrl = record.imageUrl;
    else issues.push(err('INVALID_IMAGE_URL', subject, 'imageUrl must be a same-origin raster path (/…​.webp|avif|jpg|jpeg|png); external URLs are not accepted', 'imageUrl'));
  }

  if (issues.length) return { recipe: null, batchOrder: record.batchOrder, issues, unresolvedIngredients };

  const runtimeCandidate: Record<string, unknown> = {
    id, slug: record.slug, title: record.title.normalize('NFKC').trim().replace(/\s+/g, ' '), description: record.description.normalize('NFKC').trim(),
    cuisine: record.cuisine, cookTimeMinutes: record.cookTimeMinutes, servings: record.servings, difficulty: record.difficulty, imageUrl,
    ingredients, steps: sortedSteps.map((step) => ({ stepNumber: step.stepNumber, instruction: step.instruction.normalize('NFKC').trim(), ...(step.tip !== undefined ? { tip: step.tip.normalize('NFKC').trim() } : {}), ...(step.timerMinutes !== undefined ? { timerMinutes: step.timerMinutes } : {}) })),
    tags,
  };
  if (category !== undefined) runtimeCandidate.category = category;
  if (record.region !== undefined) runtimeCandidate.region = record.region;
  if (record.nutrition !== undefined) runtimeCandidate.nutrition = { calories: record.nutrition.calories, proteinG: record.nutrition.proteinG, fatG: record.nutrition.fatG, carbG: record.nutrition.carbG };

  const runtime = RuntimeRecipeSchema.safeParse(runtimeCandidate);
  if (!runtime.success) {
    issues.push(err('RUNTIME_CONTRACT_VIOLATION', subject, runtime.error.issues.map((problem) => `${problem.path.join('.')}: ${problem.message}`).sort().join('; ')));
    return { recipe: null, batchOrder: record.batchOrder, issues, unresolvedIngredients };
  }
  return {
    recipe: {
      runtime: runtime.data,
      source,
      sourceKey: subject,
      batchOrder: record.batchOrder,
      provenance: { sourceType: header.source.sourceType, sourceReference: header.source.sourceReference, verificationState: 'reviewed', version: 1 },
      classifications,
      contentFingerprint: await sha256Hex(canonicalJson(runtime.data)),
    },
    batchOrder: record.batchOrder,
    issues,
    unresolvedIngredients,
  };
}
