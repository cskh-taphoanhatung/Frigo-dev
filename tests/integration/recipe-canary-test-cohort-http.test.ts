import { Hono } from 'hono';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { isRecipeCanaryTenant } from '../../packages/recipes/src/recipe-authority';
import { recipeTestCohortDigest } from '../../packages/recipes/src/recipe-canary-cohort';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { recipeRoutes } from '../../src/worker/routes/recipes';
import { recipeAuthorityCounters, resetRecipeAuthorityCacheForTests, resetRecipeAuthorityCountersForTests } from '../../src/worker/services/recipe-authority';
import { resetRecipeCatalogShadowThrottle } from '../../src/worker/services/recipe-catalog-shadow';
import type { AuthContext, Env } from '../../src/worker/types';
import { signJwt } from '../../src/worker/utils/jwt';
import { LEGACY_CATALOG_MIGRATION_TIP, SqliteD1 } from '../helpers/sqlite-d1';

vi.mock('../../packages/recipes/src/import/catalog-release.current.json', async () => {
  const { ALL_RECIPES } = await import('../../packages/recipes/src/data');
  const { composeCatalogRelease } = await import('../../packages/recipes/src/import/release-manifest');
  return { default: (await composeCatalogRelease(ALL_RECIPES, [])).manifest };
});
vi.mock('../../src/worker/services/email', () => ({
  sendEmail: vi.fn(async () => ({ sent: true, provider: 'test' })),
  buildOtpEmail: (code: string) => ({ subject: 'Test OTP', html: `<p>${code}</p>`, text: code }),
}));

/**
 * T15C-C — the authorized test cohort through real HTTP. Synthetic households only: one whose FNV
 * bucket is naturally OUTSIDE 1% (the "include" test household) and one naturally INSIDE 1% (the
 * "exclude" control household). No request input of any kind may influence the assignment.
 */
const secret = 'cohort-secret-that-is-definitely-long-enough';
const USER = 'cohort-user';
const pool = Array.from({ length: 2_000 }, (_, i) => `cohort-house-${i}`);
const OUTSIDE = pool.find((id) => !isRecipeCanaryTenant(id, 1))!;
const INSIDE = pool.find((id) => isRecipeCanaryTenant(id, 1))!;
const ORDINARY_OUT = pool.filter((id) => !isRecipeCanaryTenant(id, 1) && id !== OUTSIDE)[0];

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', authMiddleware);
app.route('/', recipeRoutes);

const CANARY_1: Partial<Env> = { RECIPE_CATALOG_MODE: 'canary', RECIPE_CATALOG_CUTOVER_ENABLED: 'true', RECIPE_CATALOG_D1_CANARY_PERCENT: '1' };

describe('T15C-C — authorized test cohort over HTTP; request input has no influence', () => {
  let db: SqliteD1;
  let cohort: Partial<Env>;
  const tokens: Record<string, string> = {};
  const warnings: string[] = [];
  const originalWarn = console.warn;

  beforeEach(async () => {
    db = new SqliteD1({ through: LEGACY_CATALOG_MIGRATION_TIP });
    for (const hh of [OUTSIDE, INSIDE, ORDINARY_OUT]) {
      db.seed(`INSERT OR IGNORE INTO users(id) VALUES ('${USER}');
        INSERT INTO households(id, name, created_by) VALUES ('${hh}', 'Cohort', '${USER}');
        INSERT INTO household_members(id, household_id, user_id, role) VALUES ('hm-${hh}', '${hh}', '${USER}', 'owner');`);
      tokens[hh] = await signJwt({ sub: USER, hid: hh, typ: 'access', exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
    }
    cohort = { RECIPE_CATALOG_TEST_COHORT_ENABLED: 'true', RECIPE_CATALOG_TEST_INCLUDE: await recipeTestCohortDigest(OUTSIDE), RECIPE_CATALOG_TEST_EXCLUDE: await recipeTestCohortDigest(INSIDE) };
    warnings.length = 0;
    console.warn = (line?: unknown) => { warnings.push(String(line)); };
    resetRecipeAuthorityCacheForTests(); resetRecipeAuthorityCountersForTests(); resetRecipeCatalogShadowThrottle();
  });
  afterEach(() => { console.warn = originalWarn; resetRecipeAuthorityCacheForTests(); resetRecipeAuthorityCountersForTests(); db.close(); });
  afterAll(() => { vi.doUnmock('../../packages/recipes/src/import/catalog-release.current.json'); vi.resetModules(); });

  async function get(path: string, env: Partial<Env>, bearer: string | null, headers: Record<string, string> = {}, init: RequestInit = {}) {
    resetRecipeAuthorityCacheForTests(); resetRecipeAuthorityCountersForTests();
    const response = await app.fetch(new Request(`https://cohort.local${path}`, {
      method: 'GET', ...init,
      headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), 'Content-Type': 'application/json', ...headers },
    }), { DB: db, ENVIRONMENT: 'test', JWT_SECRET: secret, WEEK_SCHEMA_MODE: 'legacy', ...env } as unknown as Env);
    return { status: response.status, json: await response.json().catch(() => ({})) as Record<string, any>, counters: recipeAuthorityCounters() };
  }
  const servedD1 = (r: { counters: ReturnType<typeof recipeAuthorityCounters> }) => r.counters.d1 === 1 && r.counters.static === 0;
  const servedStatic = (r: { counters: ReturnType<typeof recipeAuthorityCounters> }) => r.counters.static === 1 && r.counters.d1 === 0;

  it('include household (naturally outside 1%) is served the verified D1 catalog; exclude household (naturally inside) is served static; ordinary household keeps its bucket', async () => {
    const included = await get('/recipes', { ...CANARY_1, ...cohort }, tokens[OUTSIDE]);
    expect(included.status).toBe(200);
    expect(servedD1(included)).toBe(true);
    expect(included.counters).toMatchObject({ authorizedInclude: 1, canaryFallback: 0 });
    expect(included.json.recipes.map((r: any) => r.id)).toEqual(ALL_RECIPES.map((r) => r.id)); // verified parity: same content
    const excluded = await get('/recipes', { ...CANARY_1, ...cohort }, tokens[INSIDE]);
    expect(excluded.status).toBe(200);
    expect(servedStatic(excluded)).toBe(true);
    expect(excluded.counters).toMatchObject({ authorizedExclude: 1 });
    const ordinary = await get('/recipes', { ...CANARY_1, ...cohort }, tokens[ORDINARY_OUT]);
    expect(servedStatic(ordinary)).toBe(true);
    expect(ordinary.counters).toMatchObject({ authorizedInclude: 0, authorizedExclude: 0 });
    // Without the cohort the same tokens follow the bucket alone (byte-identical T15C behaviour).
    expect(servedStatic(await get('/recipes', CANARY_1, tokens[OUTSIDE]))).toBe(true);
    expect(servedD1(await get('/recipes', CANARY_1, tokens[INSIDE]))).toBe(true);
    // Nothing in the response or logs names the household or the digest.
    const text = JSON.stringify([included.json, excluded.json, warnings]);
    for (const needle of [OUTSIDE, INSIDE, cohort.RECIPE_CATALOG_TEST_INCLUDE!, cohort.RECIPE_CATALOG_TEST_EXCLUDE!]) expect(text).not.toContain(needle);
    expect(JSON.stringify(included.json)).not.toMatch(/assignmentReason|canaryTenant|authorized_/);
  });

  it('no request input can force canary: query, headers, cookies, body, route params are ignored for an ordinary household', async () => {
    const attempts: Array<[string, Record<string, string>, RequestInit]> = [
      ['/recipes?forceD1=true&canary=1&recipe_catalog_mode=d1&RECIPE_CATALOG_TEST_COHORT_ENABLED=true', {}, {}],
      ['/recipes', { 'X-Recipe-Catalog-Mode': 'd1', 'X-Canary': 'true', 'X-Recipe-Catalog-Test-Include': cohort.RECIPE_CATALOG_TEST_INCLUDE!, 'X-Frigo-Expected-Household-Id': OUTSIDE }, {}],
      ['/recipes', { Cookie: `recipe_catalog_mode=d1; canary=1; test_cohort=${cohort.RECIPE_CATALOG_TEST_INCLUDE}` }, {}],
      ['/recipes', { 'X-Household-Id': OUTSIDE, 'X-Tenant-Key': OUTSIDE }, {}],
      [`/recipes/${encodeURIComponent(OUTSIDE)}`, {}, {}],
    ];
    for (const [path, headers, init] of attempts) {
      const r = await get(path, { ...CANARY_1, ...cohort }, tokens[ORDINARY_OUT], headers, init);
      expect(r.status, path).not.toBe(500);
      expect(r.counters.d1, `${path} ${JSON.stringify(headers)}`).toBe(0);
      expect(r.counters.authorizedInclude).toBe(0);
    }
    // The exclude household cannot un-exclude itself either.
    const r = await get('/recipes?forceD1=true', { ...CANARY_1, ...cohort }, tokens[INSIDE], { 'X-Recipe-Catalog-Mode': 'd1' });
    expect(servedStatic(r)).toBe(true);
  });

  it('unauthenticated (guest) reads are never forced into D1 by the include list', async () => {
    const r = await get('/recipes', { ...CANARY_1, ...cohort }, null, { 'X-Household-Id': OUTSIDE });
    expect(r.status).toBe(200);
    expect(r.counters.d1).toBe(0);
    expect(r.counters.authorizedInclude).toBe(0);
  });

  it('cohort variables in static and shadow change nothing user-visible: static content, no D1 read, loud config diagnostic', async () => {
    for (const mode of ['static', 'shadow']) {
      const r = await get('/recipes', { RECIPE_CATALOG_MODE: mode, ...cohort }, tokens[OUTSIDE]);
      expect(r.status, mode).toBe(200);
      expect(r.json.recipes.map((x: any) => x.id)).toEqual(ALL_RECIPES.map((x) => x.id));
      expect(r.counters.d1, mode).toBe(0);
      expect(warnings.some((line) => line.includes('recipe_catalog_config_invalid') && line.includes('TEST_COHORT_OUTSIDE_CANARY')), mode).toBe(true);
    }
    expect(warnings.join('\n')).not.toContain(OUTSIDE);
  });
});
