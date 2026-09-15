import { classifyCatalogEntry, type CatalogEntryClassification } from './catalog-entry';
import { RUNTIME_RECIPE_FIELDS, type RuntimeRecipe } from './runtime-recipe';
import type { Recipe } from './types';

/**
 * Static ↔ D1 shadow drift audit over the FULL runtime recipe contract. It complements the
 * foundation-level `auditRecipeCatalogs` (identity/requirements/units) with core-fact,
 * content, classification and completeness comparison. Pure and deterministic: no I/O, no
 * telemetry, JSON-serializable output with sorted arrays. Nothing in production request
 * paths consumes it (T14B-A); it exists so T14B-B can prove 71/71 parity before any switch.
 */

export interface D1RecipeContentRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cuisine: string;
  servings: number;
  cookTimeMinutes: number;
  difficulty: string;
  imageUrl: string | null;
  /** Parsed `recipes.tags` JSON array, or null when absent/unparseable. */
  tags: string[] | null;
  prepTimeMinutes: number | null;
  familyId: string | null;
  provenance: { sourceType: string; sourceReference: string | null; verificationState: string; version: number };
}
export interface D1RecipeRequirementRow {
  recipeId: string; ingredientId: string; name: string; requiredQuantity: number; unit: string; isOptional: boolean;
}
export interface D1RecipeStepRow {
  recipeId: string; stepNumber: number; instruction: string; tip: string | null; timerMinutes: number | null;
}
/** Read-only projection of the D1 recipe tables needed for a full-contract drift audit. */
export interface D1RecipeContentSnapshot {
  recipes: D1RecipeContentRow[];
  requirements: D1RecipeRequirementRow[];
  steps: D1RecipeStepRow[];
  /** Recipe IDs that have at least one `recipe_nutrition` link. */
  nutritionRecipeIds: string[];
}

export type ClassificationRepresentation = 'equal' | 'missing_in_d1' | 'represented_through_legacy_tags' | 'unsupported_by_catalog_model';

export interface RecipeCoreDrift { id: string; fields: string[] }
export interface RecipeSlugDrift { id: string; staticSlug: string; d1Slug: string }
export interface RecipeRequirementLine { ingredientId: string; name: string; requiredQuantity: number; unit: string; isOptional: boolean }
export interface RecipeContentRequirementDrift { id: string; staticOnly: RecipeRequirementLine[]; d1Only: RecipeRequirementLine[] }
export interface RecipeContentUnitDrift { id: string; ingredientId: string; staticUnits: string[]; d1Units: string[] }
export interface RecipeClassificationDrift { id: string; field: 'category' | 'region'; representation: ClassificationRepresentation; staticValue: string | null; d1Value: string | null }

export interface CatalogDriftReport {
  staticCount: number;
  d1RowCount: number;
  d1CompleteCount: number;
  identity: { staticOnly: string[]; d1Only: string[]; slugMismatch: RecipeSlugDrift[] };
  core: { changed: RecipeCoreDrift[] };
  requirements: { changed: RecipeContentRequirementDrift[] };
  units: { changed: RecipeContentUnitDrift[] };
  content: {
    /** Rows without steps are `incomplete`, so only complete rows can show step drift. */
    steps: { changed: string[] };
    nutrition: { representation: 'unsupported_by_catalog_model'; missingInD1: string[] };
    tags: { changed: string[] };
    classification: RecipeClassificationDrift[];
    media: { missingInD1: string[]; changed: string[] };
  };
  incompleteRows: CatalogEntryClassification[];
  rejectedRows: CatalogEntryClassification[];
}

const CORE_FIELDS = ['slug', 'title', 'description', 'cuisine', 'servings', 'cookTimeMinutes', 'difficulty'] as const;
const compare = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);
const byId = <T extends { id: string }>(items: T[]) => items.sort((a, b) => compare(a.id, b.id));
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).filter((key) => row[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${stable(row[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

function requirementLines(lines: readonly RecipeRequirementLine[]): RecipeRequirementLine[] {
  return [...lines].sort((a, b) => compare(a.ingredientId, b.ingredientId) || compare(a.unit, b.unit)
    || a.requiredQuantity - b.requiredQuantity || Number(a.isOptional) - Number(b.isOptional) || compare(a.name, b.name));
}
function multisetDifference(left: readonly RecipeRequirementLine[], right: readonly RecipeRequirementLine[]): RecipeRequirementLine[] {
  const counts = new Map<string, number>();
  for (const line of right) { const key = stable(line); counts.set(key, (counts.get(key) ?? 0) + 1); }
  return left.filter((line) => {
    const key = stable(line); const remaining = counts.get(key) ?? 0;
    if (remaining === 0) return true;
    counts.set(key, remaining - 1); return false;
  });
}
function tagMarker(tags: readonly string[] | null, prefix: 'cat:' | 'region:'): string | null {
  const marker = (tags ?? []).find((tag) => tag.startsWith(prefix));
  return marker ? marker.slice(prefix.length) : null;
}
function classificationDrift(id: string, field: 'category' | 'region', staticValue: string | null, d1Tags: string[] | null): RecipeClassificationDrift | null {
  const d1Value = tagMarker(d1Tags, field === 'category' ? 'cat:' : 'region:');
  if (staticValue === null && d1Value === null) return null;
  if (d1Value === null) return { id, field, representation: 'missing_in_d1', staticValue, d1Value };
  if (staticValue === d1Value) return { id, field, representation: 'represented_through_legacy_tags', staticValue, d1Value };
  return { id, field, representation: 'unsupported_by_catalog_model', staticValue, d1Value };
}
function foundationShape(row: D1RecipeContentRow, lines: readonly D1RecipeRequirementRow[]): Record<string, unknown> {
  return {
    id: row.id, slug: row.slug, title: row.title, description: row.description ?? undefined, cuisine: row.cuisine,
    servings: row.servings, prepTimeMinutes: row.prepTimeMinutes ?? undefined, cookTimeMinutes: row.cookTimeMinutes,
    difficulty: row.difficulty, familyId: row.familyId ?? undefined,
    provenance: { sourceType: row.provenance.sourceType, sourceReference: row.provenance.sourceReference ?? undefined,
      verificationState: row.provenance.verificationState, version: row.provenance.version },
    ingredients: lines.map((line) => ({ ingredientId: line.ingredientId, name: line.name,
      requiredQuantity: line.requiredQuantity, unit: line.unit, isOptional: line.isOptional })),
  };
}

/** Audits the static runtime catalog against a read-only D1 content snapshot. */
export function auditCatalogDrift(staticRecipes: readonly Recipe[], d1: D1RecipeContentSnapshot): CatalogDriftReport {
  const staticById = new Map(staticRecipes.map((recipe) => [recipe.id, recipe as RuntimeRecipe]));
  const linesByRecipe = new Map<string, D1RecipeRequirementRow[]>();
  for (const line of d1.requirements) linesByRecipe.set(line.recipeId, [...(linesByRecipe.get(line.recipeId) ?? []), line]);
  const stepsByRecipe = new Map<string, D1RecipeStepRow[]>();
  for (const step of d1.steps) stepsByRecipe.set(step.recipeId, [...(stepsByRecipe.get(step.recipeId) ?? []), step]);
  const nutritionIds = new Set(d1.nutritionRecipeIds);

  const incompleteRows: CatalogEntryClassification[] = [];
  const rejectedRows: CatalogEntryClassification[] = [];
  const completeById = new Map<string, D1RecipeContentRow>();
  for (const row of d1.recipes) {
    const classification = classifyCatalogEntry({
      recipe: foundationShape(row, linesByRecipe.get(row.id) ?? []), stepCount: (stepsByRecipe.get(row.id) ?? []).length,
    });
    if (classification.state === 'complete') completeById.set(row.id, row);
    else if (classification.state === 'rejected') rejectedRows.push(classification);
    else incompleteRows.push(classification);
  }

  const report: CatalogDriftReport = {
    staticCount: staticRecipes.length, d1RowCount: d1.recipes.length, d1CompleteCount: completeById.size,
    identity: { staticOnly: [], d1Only: [], slugMismatch: [] },
    core: { changed: [] }, requirements: { changed: [] }, units: { changed: [] },
    content: { steps: { changed: [] }, nutrition: { representation: 'unsupported_by_catalog_model', missingInD1: [] },
      tags: { changed: [] }, classification: [], media: { missingInD1: [], changed: [] } },
    incompleteRows: byId(incompleteRows.filter((row): row is CatalogEntryClassification & { id: string } => row.id !== undefined)),
    rejectedRows: rejectedRows.sort((a, b) => compare(a.id ?? '', b.id ?? '')),
  };
  report.identity.staticOnly = [...staticById.keys()].filter((id) => !completeById.has(id)).sort(compare);
  report.identity.d1Only = [...completeById.keys()].filter((id) => !staticById.has(id)).sort(compare);

  for (const id of [...staticById.keys()].filter((key) => completeById.has(key)).sort(compare)) {
    const s = staticById.get(id)!; const d = completeById.get(id)!;
    if (s.slug !== d.slug) report.identity.slugMismatch.push({ id, staticSlug: s.slug, d1Slug: d.slug });
    const fields = CORE_FIELDS.filter((field) => stable(s[field]) !== stable(field === 'description' ? (d.description ?? '') : d[field]));
    if (fields.length) report.core.changed.push({ id, fields: [...fields] });

    const staticLines = requirementLines(s.ingredients.map((line) => ({ ingredientId: line.ingredientId, name: line.name,
      requiredQuantity: line.requiredQuantity, unit: line.unit, isOptional: line.isOptional ?? false })));
    const d1Lines = requirementLines((linesByRecipe.get(id) ?? []).map(({ recipeId: _r, ...line }) => line));
    if (stable(staticLines) !== stable(d1Lines)) {
      report.requirements.changed.push({ id, staticOnly: multisetDifference(staticLines, d1Lines), d1Only: multisetDifference(d1Lines, staticLines) });
    }
    for (const ingredientId of [...new Set([...staticLines, ...d1Lines].map((line) => line.ingredientId))].sort(compare)) {
      const staticUnits = staticLines.filter((l) => l.ingredientId === ingredientId).map((l) => l.unit).sort(compare);
      const d1Units = d1Lines.filter((l) => l.ingredientId === ingredientId).map((l) => l.unit).sort(compare);
      if (stable(staticUnits) !== stable(d1Units)) report.units.changed.push({ id, ingredientId, staticUnits, d1Units });
    }

    const d1Steps = (stepsByRecipe.get(id) ?? []).sort((a, b) => a.stepNumber - b.stepNumber)
      .map((step) => ({ stepNumber: step.stepNumber, instruction: step.instruction, tip: step.tip ?? undefined, timerMinutes: step.timerMinutes ?? undefined }));
    const staticSteps = [...s.steps].sort((a, b) => a.stepNumber - b.stepNumber)
      .map((step) => ({ stepNumber: step.stepNumber, instruction: step.instruction, tip: step.tip, timerMinutes: step.timerMinutes }));
    if (stable(staticSteps) !== stable(d1Steps)) report.content.steps.changed.push(id);

    if (s.nutrition && !nutritionIds.has(id)) report.content.nutrition.missingInD1.push(id);

    const d1Tags = (d.tags ?? []).filter((tag) => !tag.startsWith('cat:') && !tag.startsWith('region:'));
    if (stable([...s.tags].sort(compare)) !== stable([...d1Tags].sort(compare))) report.content.tags.changed.push(id);
    for (const field of ['category', 'region'] as const) {
      const drift = classificationDrift(id, field, s[field] ?? null, d.tags);
      if (drift) report.content.classification.push(drift);
    }
    if (d.imageUrl === null) report.content.media.missingInD1.push(id);
    else if (d.imageUrl !== s.imageUrl) report.content.media.changed.push(id);
  }
  report.content.classification.sort((a, b) => compare(a.id, b.id) || compare(a.field, b.field));
  return report;
}

/** Guards against accidental widening of the runtime contract without updating the drift audit. */
export const DRIFT_AUDITED_RUNTIME_FIELDS: ReadonlySet<string> = new Set<string>([
  'id', ...CORE_FIELDS, 'ingredients', 'steps', 'nutrition', 'tags', 'category', 'region', 'imageUrl',
]);
export const UNAUDITED_RUNTIME_FIELDS = RUNTIME_RECIPE_FIELDS.filter((field) => !DRIFT_AUDITED_RUNTIME_FIELDS.has(field));
