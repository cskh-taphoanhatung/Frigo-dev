import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '../../src/worker/config/validation';
import {
  RecipeCatalogModeError,
  resolveRecipeCatalogMode,
  runRecipeCatalogShadow,
  scheduleRecipeCatalogShadow,
  toRecipeCatalogShadowLogRecord,
} from '../../src/worker/services/recipe-catalog-shadow';
import type { Env } from '../../src/worker/types';

const root = process.cwd();
const read = (file: string) => readFileSync(path.resolve(root, file), 'utf8');
const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
};

/**
 * T14B-B authority guard. USER-VISIBLE AUTHORITY = ALL_RECIPES; D1 = shadow/parity capable.
 * These checks are static so a future change that quietly reads recipes from D1 on a response
 * path fails CI before review.
 */
describe('recipe catalog authority stays static (T14B-B)', () => {
  it('every production recipe flow still imports ALL_RECIPES from the static package', () => {
    for (const file of ['src/worker/routes/recipes.ts', 'src/worker/routes/week.ts', 'src/worker/routes/shopping.ts',
      'src/web/services/recipes.ts', 'src/web/services/week.ts', 'packages/domain/src/week/planner.ts']) {
      expect(read(file), file).toMatch(/import \{[^}]*\bALL_RECIPES\b[^}]*\} from '@frigo\/recipes'/);
    }
    // Response authority never comes from the hydrator/D1 catalog: only the shadow service may import them.
    const offenders = walk(path.resolve(root, 'src')).filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /runtime-hydration|D1RuntimeRecipeCatalog|hydrateRuntimeRecipes|readRecipeContent/.test(source)
        && !file.endsWith(path.join('services', 'recipe-catalog-shadow.ts'));
    });
    expect(offenders).toEqual([]);
    const shadow = read('src/worker/services/recipe-catalog-shadow.ts');
    expect(shadow).not.toMatch(/'d1'\s*\)?\s*(?:=>|return)|mode === 'd1'|RecipeCatalogMode = 'static' \| 'shadow' \| 'd1'/);
  });

  it('resolves RECIPE_CATALOG_MODE with a static default and no d1 value', () => {
    expect(resolveRecipeCatalogMode(undefined)).toBe('static');
    expect(resolveRecipeCatalogMode('')).toBe('static');
    expect(resolveRecipeCatalogMode('static')).toBe('static');
    expect(resolveRecipeCatalogMode('shadow')).toBe('shadow');
    expect(() => resolveRecipeCatalogMode('d1')).toThrow(RecipeCatalogModeError);
    expect(() => resolveRecipeCatalogMode('D1')).toThrow(RecipeCatalogModeError);
  });

  it('production configuration fails closed for any non-static RECIPE_CATALOG_MODE and passes without the var', () => {
    const production: Env = {
      ENVIRONMENT: 'production', APP_URL: 'https://frigo.example.com', AI_ENABLED: 'true', AI_QWEN_ONLY: 'true',
      WEEK_SCHEMA_MODE: 'dual', SCAN_QUEUE_MODE: 'async', DB: {} as Env['DB'], JWT_SECRET: 'x'.repeat(64), OTP_HASH_SECRET: 'y'.repeat(64),
      QWEN_API_KEY: 'k', QWEN_BASE_URL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', QWEN_MODEL: 'qwen3.7-flash',
    } as unknown as Env;
    const codes = (env: Env) => validateEnvironment(env).fatal.map((issue) => issue.code);
    expect(codes(production)).not.toContain('CONFIG_RECIPE_CATALOG_MODE');
    expect(codes({ ...production, RECIPE_CATALOG_MODE: 'static' })).not.toContain('CONFIG_RECIPE_CATALOG_MODE');
    expect(codes({ ...production, RECIPE_CATALOG_MODE: 'shadow' })).toContain('CONFIG_RECIPE_CATALOG_MODE');
    expect(codes({ ...production, RECIPE_CATALOG_MODE: 'd1' })).toContain('CONFIG_RECIPE_CATALOG_MODE');
    // wrangler.jsonc does not opt production into shadow mode.
    expect(read('wrangler.jsonc')).not.toMatch(/RECIPE_CATALOG_MODE/);
  });

  it('static mode schedules nothing; shadow without a D1 binding is a recorded shadow_error, never a static success', async () => {
    expect(scheduleRecipeCatalogShadow({ DB: undefined, RECIPE_CATALOG_MODE: undefined }, undefined, () => { throw new Error('must not log'); })).toBeNull();
    expect(await runRecipeCatalogShadow(undefined, 'static')).toEqual({ status: 'skipped', mode: 'static' });
    const outcome = await runRecipeCatalogShadow(undefined, 'shadow', () => 5);
    expect(outcome).toEqual({ status: 'shadow_error', mode: 'shadow', error: 'D1 binding unavailable', lookupMs: 0 });
    expect(toRecipeCatalogShadowLogRecord(outcome)).toMatchObject({
      level: 'warn', status: 'shadow_error', catalog_static_count: 71, catalog_d1_count: null, catalog_drift_count: null, error: 'D1 binding unavailable',
    });
    const records: unknown[] = [];
    const scheduled: Promise<unknown>[] = [];
    const task = scheduleRecipeCatalogShadow({ DB: undefined, RECIPE_CATALOG_MODE: 'shadow' }, (promise) => scheduled.push(promise), (record) => records.push(record));
    await task;
    expect(scheduled).toHaveLength(1);
    expect(records).toHaveLength(1);
    const unknownMode = await scheduleRecipeCatalogShadow({ DB: undefined, RECIPE_CATALOG_MODE: 'd1' }, undefined, (record) => records.push(record));
    expect(unknownMode).toMatchObject({ status: 'shadow_error', error: 'RecipeCatalogModeError' });
  });
});
