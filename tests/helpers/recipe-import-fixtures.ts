import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CANONICAL_INGREDIENTS } from '../../packages/domain/src';
import type { ImportRecipeRecord } from '../../packages/recipes/src/import/schema';

/**
 * Synthetic import fixtures for T14E tests. Nothing here is a real recipe; nothing is ever written
 * into the repository (tests compile in memory or into mkdtemp directories).
 */

export const FIXTURE_DIR = path.resolve(process.cwd(), 'tests/fixtures/recipe-import');
export const readFixture = (name: string): Uint8Array => new Uint8Array(readFileSync(path.join(FIXTURE_DIR, name)));
export const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

export function validBatch(): { schemaVersion: 1; batchId: string; source: Record<string, string>; recipes: Record<string, unknown>[] } {
  return JSON.parse(readFileSync(path.join(FIXTURE_DIR, 'valid-batch.json'), 'utf8'));
}

const UNITS = ['g', 'kg', 'ml', 'l', 'piece', 'pack', 'bunch', 'slice'] as const;
const CUISINES = ['vietnamese', 'korean', 'japanese', 'chinese', 'thai', 'italian'] as const;
const DIFFICULTY = ['easy', 'medium', 'hard'] as const;
const INGREDIENT_IDS = CANONICAL_INGREDIENTS.map((ingredient) => ingredient.id);

const COMBINATIONS_4 = 148_995; // C(45, 4)
const combos: string[][] = [];
function combination4(rank: number): string[] {
  if (combos.length === 0) {
    const n = INGREDIENT_IDS.length;
    for (let a = 0; a < n; a += 1) for (let b = a + 1; b < n; b += 1) for (let c = b + 1; c < n; c += 1) for (let d = c + 1; d < n; d += 1) combos.push([INGREDIENT_IDS[a], INGREDIENT_IDS[b], INGREDIENT_IDS[c], INGREDIENT_IDS[d]]);
  }
  return combos[rank % combos.length];
}

/** Deterministic LCG so scale fixtures are identical across runs and machines. */
export function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x1_0000_0000; };
}

/**
 * Generates `count` distinct synthetic reviewed records. Ingredient sets are built so that no two
 * recipes share the exact ingredient signature and no title repeats (so the batch is duplicate-free),
 * with 2..6 ingredient lines and 2..5 steps each.
 */
export function syntheticRecords(count: number, namespaceTag = 'scale', seed = 7): ImportRecipeRecord[] {
  const random = lcg(seed);
  const records: ImportRecipeRecord[] = [];
  for (let index = 0; index < count; index += 1) {
    const cuisine = CUISINES[index % CUISINES.length];
    // Unique ingredient signature per record: the k-th 4-combination of the 45 canonical IDs
    // (C(45,4) = 148,995 > any test batch); seeds occupy disjoint rank ranges so batches never collide.
    const combo = combination4((index + seed * 1000) % COMBINATIONS_4);
    const lineCount = combo.length;
    const ingredients: ImportRecipeRecord['ingredients'] = combo.map((id, line) => ({
      text: id, ingredientId: id, quantity: Math.round((1 + random() * 400) * 100) / 100, unit: UNITS[(index + line) % UNITS.length],
      ...(line === lineCount - 1 && index % 4 === 0 ? { isOptional: true } : {}),
    }));
    const stepCount = 2 + (index % 4);
    records.push({
      sourceRecordId: `${namespaceTag}-${String(index).padStart(5, '0')}`,
      batchOrder: index,
      verificationState: 'reviewed',
      title: `Synthetic ${namespaceTag} dish #${index} (${cuisine})`,
      description: `Synthetic description for ${namespaceTag} recipe ${index}. Contains an apostrophe ' and unicode: phở, 東京, 🍜.`,
      slug: `synthetic-${namespaceTag}-${index}`,
      cuisine,
      ...(cuisine === 'vietnamese' ? { region: (['bac', 'trung', 'nam', 'toan_quoc'] as const)[index % 4], category: 'mon_synthetic' } : {}),
      cookTimeMinutes: 5 + (index % 90),
      servings: 1 + (index % 6),
      difficulty: DIFFICULTY[index % 3],
      ingredients,
      steps: Array.from({ length: stepCount }, (_, step) => ({ stepNumber: step + 1, instruction: `Step ${step + 1} for synthetic recipe ${index}.`, ...(step === 0 ? { timerMinutes: 3 + (index % 20) } : {}) })),
      tags: [`synthetic`, `bucket-${index % 10}`],
      classifications: [{ kind: 'meal_type', tag: index % 2 ? 'dinner' : 'lunch' }],
    });
  }
  return records;
}

export function syntheticBatch(count: number, batchId = 'synthetic-batch', namespaceTag = 'scale', seed = 7) {
  return {
    schemaVersion: 1 as const,
    batchId,
    source: { sourceType: 'imported' as const, sourceNamespace: `fixture.${namespaceTag}`, sourceReference: `synthetic ${namespaceTag} dataset (test-only)` },
    recipes: syntheticRecords(count, namespaceTag, seed),
  };
}

export function toJsonl(batch: { recipes: unknown[] } & Record<string, unknown>): Uint8Array {
  const { recipes, ...header } = batch;
  return new TextEncoder().encode([JSON.stringify(header), ...recipes.map((record) => JSON.stringify(record))].join('\n') + '\n');
}
