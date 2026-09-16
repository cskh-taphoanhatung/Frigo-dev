import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '../../src/worker/config/validation';
import {
  parseRecipeAuthorityMode,
  RECIPE_CATALOG_MODES,
  RecipeAuthorityConfigError,
  resolveRecipeAuthorityConfig,
} from '../../src/worker/services/recipe-authority';
import {
  DEFAULT_RECIPE_CATALOG_SHADOW_INTERVAL_MS,
  MAX_RECIPE_CATALOG_SHADOW_INTERVAL_MS,
  MIN_RECIPE_CATALOG_SHADOW_INTERVAL_MS,
  RecipeCatalogModeError,
  resetRecipeCatalogShadowThrottle,
  resolveRecipeCatalogMode,
  resolveRecipeCatalogShadowIntervalMs,
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
const rel = (file: string) => path.relative(root, file).split(path.sep).join('/');

/**
 * Runtime files allowed to import the static recipe collections directly (T14D reader audit).
 * Everything else under src/ and packages/domain must read recipes through a RecipeAuthoritySnapshot.
 */
const APPROVED_DIRECT_STATIC_READERS = new Set([
  // static definitions / providers / seed & migration renderers / parity oracle
  'packages/recipes/src/data.ts',
  'packages/recipes/src/vietnamese-bank.ts',
  'packages/recipes/src/recipe-authority.ts',
  'packages/recipes/src/runtime-catalog.ts',
  'packages/recipes/src/seed-render.ts',
  'packages/recipes/src/recipe-media.ts',
  'src/worker/services/recipe-catalog-shadow.ts',
  // offline browser fallbacks: the client bundle has no D1; when the API is unreachable it degrades to the static bank.
  'src/web/services/recipes.ts',
  'src/web/services/week.ts',
  'src/web/pages/IngredientDetailPage.tsx',
]);
const STATIC_COLLECTION_IMPORT = /import\s+(?:type\s+)?\{[^}]*\b(ALL_RECIPES|SEED_RECIPES|VIETNAMESE_RECIPES|GLOBAL_RECIPES)\b[^}]*\}\s+from\s+'(?:@frigo\/recipes|[./]+\/(?:packages\/recipes\/src\/)?data|\.\/data|\.\/vietnamese-bank)'/;

/**
 * T14D authority guard (ADR-026). USER-VISIBLE AUTHORITY is chosen by the router from deployment
 * config; production default stays static. These static checks make a new direct runtime reader
 * of ALL_RECIPES, or a stray D1 mode without the cutover fence, fail CI before review.
 */
describe('recipe catalog authority routing (T14D)', () => {
  it('unknown runtime readers = 0: no src/ or packages/domain file imports the static collections outside the allowlist', () => {
    const offenders = [...walk(path.resolve(root, 'src')), ...walk(path.resolve(root, 'packages'))]
      .filter((file) => STATIC_COLLECTION_IMPORT.test(readFileSync(file, 'utf8')))
      .map(rel)
      .filter((file) => !APPROVED_DIRECT_STATIC_READERS.has(file));
    expect(offenders).toEqual([]);
    // Migrated runtime readers no longer import the static list at all.
    for (const file of ['src/worker/routes/recipes.ts', 'src/worker/routes/week.ts', 'src/worker/routes/shopping.ts', 'packages/domain/src/week/planner.ts']) {
      expect(read(file), file).not.toMatch(/\bALL_RECIPES\b/);
      expect(read(file), file).not.toMatch(/\.find\(\(r\) => r\.id === [a-zA-Z]+ \|\| r\.slug === [a-zA-Z]+\)/);
    }
    // The planner has no hidden static default: callers must pass the operation's recipe list.
    expect(read('packages/domain/src/week/planner.ts')).not.toMatch(/availableRecipes: Recipe\[\] = /);
    // Only the authority provider/router may touch the hydrator/content reader on a response path.
    const d1Readers = walk(path.resolve(root, 'src')).map(rel).filter((file) =>
      /runtime-hydration|D1RuntimeRecipeCatalog|hydrateRuntimeRecipes|readRecipeContent|D1RecipeAuthority/.test(read(file)));
    expect(d1Readers.sort()).toEqual(['src/worker/services/recipe-authority.ts', 'src/worker/services/recipe-catalog-shadow.ts']);
    // No user-controlled authority selection anywhere in the worker.
    for (const file of walk(path.resolve(root, 'src/worker')).map(rel)) {
      expect(read(file), file).not.toMatch(/recipeCatalogMode|x-recipe-mode|X-Recipe-Mode|query\(['"]mode['"]\)/);
    }
  });

  it('parses RECIPE_CATALOG_MODE strictly: static default, four closed values, typos rejected (never coerced to static)', () => {
    expect(RECIPE_CATALOG_MODES).toEqual(['static', 'shadow', 'canary', 'd1']);
    expect(parseRecipeAuthorityMode(undefined)).toBe('static');
    expect(parseRecipeAuthorityMode('')).toBe('static');
    for (const mode of RECIPE_CATALOG_MODES) expect(parseRecipeAuthorityMode(mode)).toBe(mode);
    for (const bad of ['D1', 'dI', 'dl', 'd1-prod', 'static ', 'Shadow', 'canary ', 'true', '1', 0, {}]) {
      expect(() => parseRecipeAuthorityMode(bad), String(bad)).toThrow(RecipeAuthorityConfigError);
      expect(() => resolveRecipeCatalogMode(bad), String(bad)).toThrow(RecipeCatalogModeError);
    }
    expect(resolveRecipeCatalogMode('d1')).toBe('d1');
  });

  it('resolves the full authority config: canary percent 0..100 integers only; canary/d1 need the cutover fence', () => {
    expect(resolveRecipeAuthorityConfig({})).toEqual({ mode: 'static', canaryPercent: 0, cutoverEnabled: false });
    expect(resolveRecipeAuthorityConfig({ RECIPE_CATALOG_MODE: 'shadow' })).toMatchObject({ mode: 'shadow' });
    expect(resolveRecipeAuthorityConfig({ RECIPE_CATALOG_MODE: 'canary', RECIPE_CATALOG_D1_CANARY_PERCENT: '5', RECIPE_CATALOG_CUTOVER_ENABLED: 'true' }))
      .toEqual({ mode: 'canary', canaryPercent: 5, cutoverEnabled: true });
    expect(resolveRecipeAuthorityConfig({ RECIPE_CATALOG_MODE: 'd1', RECIPE_CATALOG_CUTOVER_ENABLED: 'true' })).toMatchObject({ mode: 'd1', canaryPercent: 0 });
    for (const percent of ['0', '1', '50', '99', '100']) expect(resolveRecipeAuthorityConfig({ RECIPE_CATALOG_D1_CANARY_PERCENT: percent }).canaryPercent).toBe(Number(percent));
    for (const bad of ['-1', '101', '5.5', '1e1', '05', 'ten', ' 5 %', 'NaN']) {
      expect(() => resolveRecipeAuthorityConfig({ RECIPE_CATALOG_D1_CANARY_PERCENT: bad }), bad).toThrow(expect.objectContaining({ code: 'INVALID_CANARY_PERCENT' }));
    }
    for (const mode of ['canary', 'd1']) {
      expect(() => resolveRecipeAuthorityConfig({ RECIPE_CATALOG_MODE: mode }), mode).toThrow(expect.objectContaining({ code: 'CUTOVER_NOT_ENABLED' }));
      expect(() => resolveRecipeAuthorityConfig({ RECIPE_CATALOG_MODE: mode, RECIPE_CATALOG_CUTOVER_ENABLED: 'TRUE' }), mode).toThrow(expect.objectContaining({ code: 'CUTOVER_NOT_ENABLED' }));
      expect(() => resolveRecipeAuthorityConfig({ RECIPE_CATALOG_MODE: mode, RECIPE_CATALOG_CUTOVER_ENABLED: '1' }), mode).toThrow(expect.objectContaining({ code: 'CUTOVER_NOT_ENABLED' }));
    }
    // shadow never needs the dangerous-mode fence.
    expect(resolveRecipeAuthorityConfig({ RECIPE_CATALOG_MODE: 'shadow', RECIPE_CATALOG_CUTOVER_ENABLED: 'false' }).mode).toBe('shadow');
  });

  it('production configuration: static default passes; shadow passes; canary/d1 without the fence are fatal; fenced d1 is a loud warning; wrangler.jsonc stays static', () => {
    const production: Env = {
      ENVIRONMENT: 'production', APP_URL: 'https://frigo.example.com', AI_ENABLED: 'true', AI_QWEN_ONLY: 'true',
      WEEK_SCHEMA_MODE: 'dual', SCAN_QUEUE_MODE: 'async', DB: {} as Env['DB'], JWT_SECRET: 'x'.repeat(64), OTP_HASH_SECRET: 'y'.repeat(64),
      QWEN_API_KEY: 'k', QWEN_BASE_URL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', QWEN_MODEL: 'qwen3.7-flash',
    } as unknown as Env;
    const codes = (env: Env) => validateEnvironment(env).fatal.map((issue) => issue.code);
    const warningCodes = (env: Env) => validateEnvironment(env).warnings.map((issue) => issue.code);
    expect(codes(production)).not.toContain('CONFIG_RECIPE_CATALOG_MODE');
    expect(codes({ ...production, RECIPE_CATALOG_MODE: 'static' })).not.toContain('CONFIG_RECIPE_CATALOG_MODE');
    expect(codes({ ...production, RECIPE_CATALOG_MODE: 'shadow' })).not.toContain('CONFIG_RECIPE_CATALOG_MODE');
    expect(codes({ ...production, RECIPE_CATALOG_MODE: 'canary' })).toContain('CONFIG_RECIPE_CATALOG_MODE');
    expect(codes({ ...production, RECIPE_CATALOG_MODE: 'd1' })).toContain('CONFIG_RECIPE_CATALOG_MODE');
    expect(codes({ ...production, RECIPE_CATALOG_MODE: 'd1', RECIPE_CATALOG_CUTOVER_ENABLED: 'yes' })).toContain('CONFIG_RECIPE_CATALOG_MODE');
    expect(codes({ ...production, RECIPE_CATALOG_MODE: 'D1', RECIPE_CATALOG_CUTOVER_ENABLED: 'true' })).toContain('CONFIG_RECIPE_CATALOG_MODE');
    expect(codes({ ...production, RECIPE_CATALOG_MODE: 'canary', RECIPE_CATALOG_CUTOVER_ENABLED: 'true', RECIPE_CATALOG_D1_CANARY_PERCENT: '250' })).toContain('CONFIG_RECIPE_CATALOG_MODE');
    const fencedD1 = { ...production, RECIPE_CATALOG_MODE: 'd1', RECIPE_CATALOG_CUTOVER_ENABLED: 'true' };
    expect(codes(fencedD1)).not.toContain('CONFIG_RECIPE_CATALOG_MODE');
    expect(warningCodes(fencedD1)).toContain('CONFIG_RECIPE_CATALOG_D1_AUTHORITY');
    expect(warningCodes({ ...production, RECIPE_CATALOG_MODE: 'canary', RECIPE_CATALOG_CUTOVER_ENABLED: 'true', RECIPE_CATALOG_D1_CANARY_PERCENT: '10' })).toContain('CONFIG_RECIPE_CATALOG_D1_AUTHORITY');
    expect(warningCodes(production)).not.toContain('CONFIG_RECIPE_CATALOG_D1_AUTHORITY');
    // Production config is untouched by T14D: no mode, no percent, no fence in wrangler.jsonc.
    expect(read('wrangler.jsonc')).not.toMatch(/RECIPE_CATALOG_MODE|RECIPE_CATALOG_D1_CANARY_PERCENT|RECIPE_CATALOG_CUTOVER_ENABLED/);
    // Validation messages never echo the configured value.
    const messages = validateEnvironment({ ...production, RECIPE_CATALOG_MODE: 'd1-prod-secret' }).fatal.map((issue) => issue.message).join(' ');
    expect(messages).not.toContain('d1-prod-secret');
  });

  it('bounds shadow cost: one comparison per isolate per interval, default 60s, clamped configuration', async () => {
    expect(resolveRecipeCatalogShadowIntervalMs(undefined)).toBe(DEFAULT_RECIPE_CATALOG_SHADOW_INTERVAL_MS);
    expect(resolveRecipeCatalogShadowIntervalMs('abc')).toBe(DEFAULT_RECIPE_CATALOG_SHADOW_INTERVAL_MS);
    expect(resolveRecipeCatalogShadowIntervalMs('10')).toBe(MIN_RECIPE_CATALOG_SHADOW_INTERVAL_MS);
    expect(resolveRecipeCatalogShadowIntervalMs(String(10 * MAX_RECIPE_CATALOG_SHADOW_INTERVAL_MS))).toBe(MAX_RECIPE_CATALOG_SHADOW_INTERVAL_MS);
    expect(resolveRecipeCatalogShadowIntervalMs('5000')).toBe(5000);
    resetRecipeCatalogShadowThrottle();
    let clock = 1_000;
    const now = () => clock;
    const records: unknown[] = [];
    const log = (record: unknown) => records.push(record);
    const first = scheduleRecipeCatalogShadow({ DB: undefined, RECIPE_CATALOG_MODE: 'shadow', RECIPE_CATALOG_SHADOW_INTERVAL_MS: '5000' }, undefined, log, now);
    expect(await first).toMatchObject({ status: 'shadow_error', mode: 'shadow' });
    clock += 1_000;
    expect(await scheduleRecipeCatalogShadow({ DB: undefined, RECIPE_CATALOG_MODE: 'shadow', RECIPE_CATALOG_SHADOW_INTERVAL_MS: '5000' }, undefined, log, now))
      .toEqual({ status: 'throttled', mode: 'shadow', nextEligibleInMs: 4000 });
    clock += 4_000;
    expect(await scheduleRecipeCatalogShadow({ DB: undefined, RECIPE_CATALOG_MODE: 'shadow', RECIPE_CATALOG_SHADOW_INTERVAL_MS: '5000' }, undefined, log, now))
      .toMatchObject({ status: 'shadow_error' });
    expect(records).toHaveLength(2);
  });

  it('shadow service: static/canary/d1 schedule no comparison; shadow without a D1 binding is a recorded shadow_error; unknown mode is a logged shadow_error', async () => {
    resetRecipeCatalogShadowThrottle();
    expect(scheduleRecipeCatalogShadow({ DB: undefined, RECIPE_CATALOG_MODE: undefined }, undefined, () => { throw new Error('must not log'); })).toBeNull();
    expect(scheduleRecipeCatalogShadow({ DB: undefined, RECIPE_CATALOG_MODE: 'd1' }, undefined, () => { throw new Error('must not log'); })).toBeNull();
    expect(scheduleRecipeCatalogShadow({ DB: undefined, RECIPE_CATALOG_MODE: 'canary' }, undefined, () => { throw new Error('must not log'); })).toBeNull();
    expect(await runRecipeCatalogShadow(undefined, 'static')).toEqual({ status: 'skipped', mode: 'static' });
    expect(await runRecipeCatalogShadow(undefined, 'd1')).toEqual({ status: 'skipped', mode: 'd1' });
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
    resetRecipeCatalogShadowThrottle();
    const unknownMode = await scheduleRecipeCatalogShadow({ DB: undefined, RECIPE_CATALOG_MODE: 'dl' }, undefined, (record) => records.push(record));
    expect(unknownMode).toMatchObject({ status: 'shadow_error', error: 'RecipeCatalogModeError' });
  });
});
