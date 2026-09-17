import { toRuntimeRecipe, type RuntimeRecipe } from '../runtime-recipe';
import type { Recipe } from '../types';
import { canonicalJson, sha256Hex } from './identity';
import type { ImportIssue, NormalizedImportRecipe } from './types';

/**
 * Duplicate detection (T14E). Indexed/bucketed: every level is a hash-map lookup, so a batch of N
 * recipes against a catalog of M costs O(N + M) — never N×M.
 *
 * Hard duplicates (errors, never auto-merged): same source key, same canonical ID, same slug,
 * identical canonical content fingerprint. Semantic candidates (review, not rejection): same
 * normalized title within a cuisine, or identical ingredient signature (sorted canonical IDs).
 * A candidate may be accepted only through an explicit `duplicateReview: { decision: 'distinct' }`.
 */

/** Anything already in the catalog: legacy static recipes and previously approved batches. */
export interface CatalogIndexEntry {
  id: string;
  slug: string;
  title: string;
  cuisine: string;
  ingredientIds: readonly string[];
  contentFingerprint: string;
  sourceKey: string | null;
  origin: 'legacy' | 'approved_batch' | 'batch';
}

export function normalizeTitleKey(title: string): string {
  return title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function ingredientSignature(ingredientIds: readonly string[]): string {
  return [...new Set(ingredientIds)].sort().join('|');
}

export function catalogEntryFromRuntime(recipe: RuntimeRecipe, fingerprint: string, origin: CatalogIndexEntry['origin'], sourceKey: string | null = null): CatalogIndexEntry {
  return { id: recipe.id, slug: recipe.slug, title: recipe.title, cuisine: recipe.cuisine, ingredientIds: recipe.ingredients.map((line) => line.ingredientId), contentFingerprint: fingerprint, sourceKey, origin };
}

/** Per-recipe content fingerprint: SHA-256 of the canonical runtime projection of that ONE recipe. */
export async function recipeContentFingerprint(recipe: Recipe | RuntimeRecipe): Promise<string> {
  return sha256Hex(canonicalJson(toRuntimeRecipe(recipe)));
}

/** Legacy catalog as index entries (O(N), one hash per recipe). */
export async function canonicalEntryOf(legacy: readonly Recipe[]): Promise<CatalogIndexEntry[]> {
  const entries: CatalogIndexEntry[] = [];
  for (const recipe of legacy) {
    const runtime = toRuntimeRecipe(recipe);
    entries.push(catalogEntryFromRuntime(runtime, await recipeContentFingerprint(runtime), 'legacy'));
  }
  return entries;
}

export class DuplicateIndex {
  private readonly byId = new Map<string, CatalogIndexEntry>();
  private readonly bySlug = new Map<string, CatalogIndexEntry>();
  private readonly bySource = new Map<string, CatalogIndexEntry>();
  private readonly byFingerprint = new Map<string, CatalogIndexEntry>();
  private readonly byTitle = new Map<string, CatalogIndexEntry[]>();
  private readonly bySignature = new Map<string, CatalogIndexEntry[]>();
  size = 0;

  add(entry: CatalogIndexEntry): void {
    this.byId.set(entry.id, entry);
    this.bySlug.set(entry.slug, entry);
    if (entry.sourceKey) this.bySource.set(entry.sourceKey, entry);
    this.byFingerprint.set(entry.contentFingerprint, entry);
    const titleKey = `${entry.cuisine}:${normalizeTitleKey(entry.title)}`;
    const titles = this.byTitle.get(titleKey); if (titles) titles.push(entry); else this.byTitle.set(titleKey, [entry]);
    const signature = ingredientSignature(entry.ingredientIds);
    const signatures = this.bySignature.get(signature); if (signatures) signatures.push(entry); else this.bySignature.set(signature, [entry]);
    this.size += 1;
  }

  hasId(id: string): CatalogIndexEntry | undefined { return this.byId.get(id); }
  hasSlug(slug: string): CatalogIndexEntry | undefined { return this.bySlug.get(slug); }
  hasSource(sourceKey: string): CatalogIndexEntry | undefined { return this.bySource.get(sourceKey); }
  hasFingerprint(fingerprint: string): CatalogIndexEntry | undefined { return this.byFingerprint.get(fingerprint); }
  semanticCandidates(entry: CatalogIndexEntry): CatalogIndexEntry[] {
    const found = new Map<string, CatalogIndexEntry>();
    for (const other of this.byTitle.get(`${entry.cuisine}:${normalizeTitleKey(entry.title)}`) ?? []) if (other.id !== entry.id) found.set(other.id, other);
    for (const other of this.bySignature.get(ingredientSignature(entry.ingredientIds)) ?? []) if (other.id !== entry.id) found.set(other.id, other);
    return [...found.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
}

export interface DuplicateReport {
  hard: Array<{ subject: string; code: 'DUPLICATE_SOURCE' | 'DUPLICATE_RECIPE' | 'ID_COLLISION' | 'LEGACY_ID_COLLISION' | 'SLUG_COLLISION' | 'LEGACY_SLUG_COLLISION'; against: string; origin: CatalogIndexEntry['origin']; detail: string }>;
  possible: Array<{ subject: string; against: string; origin: CatalogIndexEntry['origin']; signals: string[]; waived: boolean; reason: string | null }>;
}

/**
 * Checks `recipes` (one batch, already normalized) against `existing` (legacy + approved batches)
 * and against each other. Returns issues (errors for hard duplicates and un-waived candidates)
 * plus the deterministic report. Input order does not affect the result: pairs are reported once,
 * keyed by sorted subject.
 */
export function detectDuplicates(
  recipes: readonly NormalizedImportRecipe[],
  existing: DuplicateIndex,
  waivers: ReadonlyMap<string, { decision: 'distinct'; reason: string }>,
): { issues: ImportIssue[]; report: DuplicateReport } {
  const issues: ImportIssue[] = [];
  const report: DuplicateReport = { hard: [], possible: [] };
  const batch = new DuplicateIndex();
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

  const hard = (subject: string, code: DuplicateReport['hard'][number]['code'], against: CatalogIndexEntry, detail: string) => {
    report.hard.push({ subject, code, against: against.id, origin: against.origin, detail });
    issues.push({ code, severity: 'error', subject, detail: `${detail} (existing ${against.origin} ${against.id})` });
  };

  for (const recipe of [...recipes].sort((a, b) => cmp(a.sourceKey, b.sourceKey))) {
    const entry = catalogEntryFromRuntime(recipe.runtime, recipe.contentFingerprint, 'batch', recipe.sourceKey);
    const subject = recipe.sourceKey;
    for (const [index, catalog] of [existing, batch].entries()) {
      const legacyPrefix = index === 0 ? 'LEGACY_' : '';
      const bySource = catalog.hasSource(subject);
      if (bySource) hard(subject, 'DUPLICATE_SOURCE', bySource, 'same source key');
      const byId = catalog.hasId(entry.id);
      if (byId && byId !== bySource) hard(subject, `${legacyPrefix}ID_COLLISION` as DuplicateReport['hard'][number]['code'], byId, `canonical ID ${entry.id} already exists`);
      const bySlug = catalog.hasSlug(entry.slug);
      if (bySlug && bySlug !== bySource && bySlug !== byId) hard(subject, `${legacyPrefix}SLUG_COLLISION` as DuplicateReport['hard'][number]['code'], bySlug, `slug ${entry.slug} already exists`);
      const byFingerprint = catalog.hasFingerprint(entry.contentFingerprint);
      if (byFingerprint && byFingerprint !== bySource && byFingerprint !== byId && byFingerprint !== bySlug) hard(subject, 'DUPLICATE_RECIPE', byFingerprint, 'identical canonical content');
      const hardIds = new Set([bySource?.id, byId?.id, bySlug?.id, byFingerprint?.id]);
      for (const candidate of catalog.semanticCandidates(entry)) {
        if (hardIds.has(candidate.id)) continue;
        const signals: string[] = [];
        if (normalizeTitleKey(candidate.title) === normalizeTitleKey(entry.title) && candidate.cuisine === entry.cuisine) signals.push('normalized_title');
        if (ingredientSignature(candidate.ingredientIds) === ingredientSignature(entry.ingredientIds)) signals.push('ingredient_signature');
        const waiver = waivers.get(subject);
        report.possible.push({ subject, against: candidate.id, origin: candidate.origin, signals, waived: !!waiver, reason: waiver?.reason ?? null });
        if (!waiver) issues.push({ code: 'POSSIBLE_DUPLICATE', severity: 'error', subject, detail: `possible duplicate of ${candidate.origin} ${candidate.id} (${signals.join('+')}); add duplicateReview { decision: "distinct", reason } after review` });
      }
    }
    batch.add(entry);
  }
  report.hard.sort((a, b) => cmp(a.subject, b.subject) || cmp(a.code, b.code) || cmp(a.against, b.against));
  report.possible.sort((a, b) => cmp(a.subject, b.subject) || cmp(a.against, b.against));
  return { issues, report };
}

/** Stable JSON for the duplicate report artifact. */
export function serializeDuplicateReport(report: DuplicateReport): string {
  return canonicalJson(report);
}
