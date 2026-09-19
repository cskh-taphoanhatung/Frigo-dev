import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fnv1a32, isRecipeCanaryTenant, RECIPE_CANARY_BUCKETS, recipeCanaryBucket } from '../../packages/recipes/src/recipe-authority';
import {
  MAX_RECIPE_TEST_COHORT_DIGESTS,
  parseRecipeTestCohort,
  RECIPE_TEST_COHORT_DIGEST_NAMESPACE,
  recipeTestCohortDigest,
  resolveRecipeCanaryAssignment,
} from '../../packages/recipes/src/recipe-canary-cohort';
import { validateEnvironment } from '../../src/worker/config/validation';
import {
  recipeAuthorityCounters,
  resetRecipeAuthorityCacheForTests,
  resetRecipeAuthorityCountersForTests,
  resolveRecipeAuthority,
  resolveRecipeAuthorityConfig,
  type RecipeAuthorityDiagnostic,
} from '../../src/worker/services/recipe-authority';
import { resetRecipeCatalogShadowThrottle } from '../../src/worker/services/recipe-catalog-shadow';
import type { Env } from '../../src/worker/types';
import { SqliteD1 } from '../helpers/sqlite-d1';

// Synthetic tenants only. The natural 1% bucket decides which synthetic key plays "outside" / "inside".
const synthetic = Array.from({ length: 2_000 }, (_, index) => `t15c-synthetic-hh-${index}`);
const NATURALLY_OUTSIDE = synthetic.find((id) => !isRecipeCanaryTenant(id, 1))!;
const NATURALLY_INSIDE = synthetic.find((id) => isRecipeCanaryTenant(id, 1))!;
const ORDINARY = synthetic.filter((id) => id !== NATURALLY_OUTSIDE && id !== NATURALLY_INSIDE).slice(0, 50);
const hex64 = (char: string) => char.repeat(64);

describe('T15C-C — test cohort digest + configuration contract', () => {
  it('digests the namespaced tenant key with SHA-256, deterministically, lower-case hex', async () => {
    const digest = await recipeTestCohortDigest('household-x');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(await recipeTestCohortDigest('household-x')).toBe(digest);
    expect(await recipeTestCohortDigest('household-y')).not.toBe(digest);
    expect(RECIPE_TEST_COHORT_DIGEST_NAMESPACE).toBe('recipe-catalog-test-cohort:');
    // Namespaced: the digest of the bare id is a different value (no accidental reuse of other hashes).
    const bare = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('household-x'))), (b) => b.toString(16).padStart(2, '0')).join('');
    expect(digest).not.toBe(bare);
  });

  it('is disabled by default: absent, empty, or false ⇒ null; nothing else is accepted for the switch', () => {
    expect(parseRecipeTestCohort({})).toBeNull();
    expect(parseRecipeTestCohort({ RECIPE_CATALOG_TEST_COHORT_ENABLED: '' })).toBeNull();
    expect(parseRecipeTestCohort({ RECIPE_CATALOG_TEST_COHORT_ENABLED: 'false' })).toBeNull();
    for (const bad of ['TRUE', 'yes', '1', 'on', 'True']) {
      expect(() => parseRecipeTestCohort({ RECIPE_CATALOG_TEST_COHORT_ENABLED: bad }), bad).toThrow(expect.objectContaining({ code: 'TEST_COHORT_ENABLED_INVALID' }));
    }
  });

  it('accepts disjoint lower-case hex digest lists (trimmed, comma-separated) when enabled with BOTH an include and an exclude', async () => {
    const a = await recipeTestCohortDigest('a');
    const b = await recipeTestCohortDigest('b');
    const cohort = parseRecipeTestCohort({ RECIPE_CATALOG_TEST_COHORT_ENABLED: 'true', RECIPE_CATALOG_TEST_INCLUDE: ` ${a} , `, RECIPE_CATALOG_TEST_EXCLUDE: b })!;
    expect([...cohort.include]).toEqual([a]);
    expect([...cohort.exclude]).toEqual([b]);
  });

  it('P2: an enabled cohort must name an INSIDE (include) and an OUTSIDE (exclude) household — include-only and exclude-only are refused', async () => {
    const a = await recipeTestCohortDigest('a');
    const b = await recipeTestCohortDigest('b');
    expect(() => parseRecipeTestCohort({ RECIPE_CATALOG_TEST_COHORT_ENABLED: 'true', RECIPE_CATALOG_TEST_INCLUDE: a })).toThrow(expect.objectContaining({ code: 'TEST_COHORT_PAIR_REQUIRED' }));
    expect(() => parseRecipeTestCohort({ RECIPE_CATALOG_TEST_COHORT_ENABLED: 'true', RECIPE_CATALOG_TEST_EXCLUDE: b })).toThrow(expect.objectContaining({ code: 'TEST_COHORT_PAIR_REQUIRED' }));
    expect(() => parseRecipeTestCohort({ RECIPE_CATALOG_TEST_COHORT_ENABLED: 'true' })).toThrow(expect.objectContaining({ code: 'TEST_COHORT_PAIR_REQUIRED' }));
    expect(parseRecipeTestCohort({ RECIPE_CATALOG_TEST_COHORT_ENABLED: 'true', RECIPE_CATALOG_TEST_INCLUDE: a, RECIPE_CATALOG_TEST_EXCLUDE: b })).not.toBeNull();
  });

  it.each([
    ['raw household id instead of digest', { RECIPE_CATALOG_TEST_INCLUDE: 'household-123' }, 'TEST_COHORT_DIGEST_INVALID'],
    ['upper-case hex', { RECIPE_CATALOG_TEST_INCLUDE: hex64('A') }, 'TEST_COHORT_DIGEST_INVALID'],
    ['63 chars', { RECIPE_CATALOG_TEST_INCLUDE: 'a'.repeat(63) }, 'TEST_COHORT_DIGEST_INVALID'],
    ['65 chars', { RECIPE_CATALOG_TEST_INCLUDE: 'a'.repeat(65) }, 'TEST_COHORT_DIGEST_INVALID'],
    ['0x prefix', { RECIPE_CATALOG_TEST_INCLUDE: `0x${'a'.repeat(62)}` }, 'TEST_COHORT_DIGEST_INVALID'],
    ['non-string', { RECIPE_CATALOG_TEST_INCLUDE: 42 }, 'TEST_COHORT_DIGEST_INVALID'],
    ['duplicate in include', { RECIPE_CATALOG_TEST_INCLUDE: `${hex64('a')},${hex64('a')}` }, 'TEST_COHORT_DIGEST_DUPLICATE'],
    ['duplicate in exclude', { RECIPE_CATALOG_TEST_EXCLUDE: `${hex64('b')},${hex64('b')}` }, 'TEST_COHORT_DIGEST_DUPLICATE'],
    ['include/exclude overlap', { RECIPE_CATALOG_TEST_INCLUDE: hex64('c'), RECIPE_CATALOG_TEST_EXCLUDE: hex64('c') }, 'TEST_COHORT_INCLUDE_EXCLUDE_OVERLAP'],
    ['too many digests', { RECIPE_CATALOG_TEST_INCLUDE: Array.from({ length: MAX_RECIPE_TEST_COHORT_DIGESTS + 1 }, (_, i) => hex64(i.toString(16))).join(',') }, 'TEST_COHORT_TOO_LARGE'],
    ['enabled without members', {}, 'TEST_COHORT_PAIR_REQUIRED'],
  ])('fails closed on malformed configuration: %s', (_label, over, code) => {
    // Every case carries a valid counterpart so the PAIR rule cannot mask the specific defect under test.
    const counterpart = 'RECIPE_CATALOG_TEST_INCLUDE' in over ? { RECIPE_CATALOG_TEST_EXCLUDE: hex64('f') } : 'RECIPE_CATALOG_TEST_EXCLUDE' in over ? { RECIPE_CATALOG_TEST_INCLUDE: hex64('e') } : {};
    expect(() => parseRecipeTestCohort({ RECIPE_CATALOG_TEST_COHORT_ENABLED: 'true', ...counterpart, ...over })).toThrow(expect.objectContaining({ code }));
  });

  it('fails closed when members are configured but the switch is off (half-applied rollout)', () => {
    expect(() => parseRecipeTestCohort({ RECIPE_CATALOG_TEST_INCLUDE: hex64('a') })).toThrow(expect.objectContaining({ code: 'TEST_COHORT_MEMBERS_WITHOUT_ENABLE' }));
    expect(() => parseRecipeTestCohort({ RECIPE_CATALOG_TEST_COHORT_ENABLED: 'false', RECIPE_CATALOG_TEST_EXCLUDE: hex64('b') })).toThrow(expect.objectContaining({ code: 'TEST_COHORT_MEMBERS_WITHOUT_ENABLE' }));
  });
});

describe('T15C-C — pure assignment: exclude > include > deterministic bucket; normal algorithm untouched', () => {
  it('without a cohort the assignment is exactly isRecipeCanaryTenant for every synthetic tenant and percent', async () => {
    for (const percent of [0, 1, 2, 5, 100]) {
      for (const id of synthetic.slice(0, 300)) {
        const assignment = await resolveRecipeCanaryAssignment({ tenantKey: id, percent, cohort: null });
        expect(assignment).toEqual({ canary: isRecipeCanaryTenant(id, percent), reason: 'deterministic_bucket' });
      }
    }
    expect(await resolveRecipeCanaryAssignment({ tenantKey: null, percent: 100, cohort: null })).toEqual({ canary: false, reason: 'missing_tenant' });
    expect(await resolveRecipeCanaryAssignment({ tenantKey: '', percent: 100, cohort: null })).toEqual({ canary: false, reason: 'missing_tenant' });
  });

  it('include forces a naturally-outside tenant IN at 1%; exclude forces a naturally-inside tenant OUT; ordinary tenants unchanged', async () => {
    const cohort = { include: new Set([await recipeTestCohortDigest(NATURALLY_OUTSIDE)]), exclude: new Set([await recipeTestCohortDigest(NATURALLY_INSIDE)]) };
    expect(await resolveRecipeCanaryAssignment({ tenantKey: NATURALLY_OUTSIDE, percent: 1, cohort })).toEqual({ canary: true, reason: 'authorized_include' });
    expect(await resolveRecipeCanaryAssignment({ tenantKey: NATURALLY_INSIDE, percent: 1, cohort })).toEqual({ canary: false, reason: 'authorized_exclude' });
    for (const id of ORDINARY) {
      expect(await resolveRecipeCanaryAssignment({ tenantKey: id, percent: 1, cohort })).toEqual({ canary: isRecipeCanaryTenant(id, 1), reason: 'deterministic_bucket' });
    }
    // Overrides are absolute for their tenants regardless of percent (0% include still IN, 100% exclude still OUT).
    expect((await resolveRecipeCanaryAssignment({ tenantKey: NATURALLY_OUTSIDE, percent: 0, cohort })).canary).toBe(true);
    expect((await resolveRecipeCanaryAssignment({ tenantKey: NATURALLY_INSIDE, percent: 100, cohort })).canary).toBe(false);
    // Missing tenant is never forced in, even with an include list.
    expect(await resolveRecipeCanaryAssignment({ tenantKey: null, percent: 1, cohort })).toEqual({ canary: false, reason: 'missing_tenant' });
  });

  it('keeps the production bucket primitives byte-for-byte: FNV-1a vectors, 10 000 buckets, monotonic 1% ⊂ 2% ⊂ 5%', () => {
    expect(RECIPE_CANARY_BUCKETS).toBe(10_000);
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
    expect(recipeCanaryBucket('hh')).toBe(fnv1a32('recipe-catalog-canary:hh') % 10_000);
    for (const id of synthetic) {
      const bucket = recipeCanaryBucket(id);
      expect(isRecipeCanaryTenant(id, 1)).toBe(bucket < 100);
      expect(isRecipeCanaryTenant(id, 2)).toBe(bucket < 200);
      expect(isRecipeCanaryTenant(id, 5)).toBe(bucket < 500);
      if (isRecipeCanaryTenant(id, 1)) expect(isRecipeCanaryTenant(id, 2) && isRecipeCanaryTenant(id, 5)).toBe(true);
    }
  });
});

describe('T15C-C — authority router fences and diagnostics', () => {
  let db: SqliteD1;
  const diagnostics: RecipeAuthorityDiagnostic[] = [];
  const log = (d: RecipeAuthorityDiagnostic) => diagnostics.push(d);
  const now = () => 1_000_000;
  const env = (over: Partial<Env> = {}): Env => ({ DB: db, ...over }) as unknown as Env;
  let includeDigest: string;
  let excludeDigest: string;
  const cohortVars = () => ({ RECIPE_CATALOG_TEST_COHORT_ENABLED: 'true', RECIPE_CATALOG_TEST_INCLUDE: includeDigest, RECIPE_CATALOG_TEST_EXCLUDE: excludeDigest });
  const canary1 = (over: Partial<Env> = {}) => env({ RECIPE_CATALOG_MODE: 'canary', RECIPE_CATALOG_D1_CANARY_PERCENT: '1', RECIPE_CATALOG_CUTOVER_ENABLED: 'true', ...over });

  beforeEach(async () => {
    db = new SqliteD1(); diagnostics.length = 0;
    resetRecipeAuthorityCacheForTests(); resetRecipeAuthorityCountersForTests(); resetRecipeCatalogShadowThrottle();
    includeDigest = await recipeTestCohortDigest(NATURALLY_OUTSIDE);
    excludeDigest = await recipeTestCohortDigest(NATURALLY_INSIDE);
  });
  afterEach(() => db.close());

  it('default (no cohort vars): canary routing is identical to the pre-T15C-C behaviour and reports deterministic_bucket', async () => {
    const out = await resolveRecipeAuthority(canary1(), { tenantKey: NATURALLY_OUTSIDE, now, log });
    expect(out).toMatchObject({ configuredMode: 'canary', canaryTenant: false, actualSource: 'static', canaryAssignmentReason: 'deterministic_bucket' });
    const inn = await resolveRecipeAuthority(canary1(), { tenantKey: NATURALLY_INSIDE, now, log });
    expect(inn).toMatchObject({ configuredMode: 'canary', canaryTenant: true, actualSource: 'd1', canaryAssignmentReason: 'deterministic_bucket' });
    expect(recipeAuthorityCounters()).toMatchObject({ authorizedInclude: 0, authorizedExclude: 0 });
    expect(resolveRecipeAuthorityConfig({ RECIPE_CATALOG_MODE: 'canary', RECIPE_CATALOG_CUTOVER_ENABLED: 'true' }).testCohort).toBeNull();
  });

  it('canary + cohort: include tenant is served D1 (authorized_include); exclude tenant is served static (authorized_exclude); ordinary tenants use the bucket', async () => {
    const included = await resolveRecipeAuthority(canary1(cohortVars()), { tenantKey: NATURALLY_OUTSIDE, now, log });
    expect(included).toMatchObject({ configuredMode: 'canary', canaryTenant: true, selectedSource: 'd1', actualSource: 'd1', canaryAssignmentReason: 'authorized_include', fallbackReason: null });
    expect(included.snapshot.source).toBe('d1');
    const excluded = await resolveRecipeAuthority(canary1(cohortVars()), { tenantKey: NATURALLY_INSIDE, now, log });
    expect(excluded).toMatchObject({ configuredMode: 'canary', canaryTenant: false, selectedSource: 'static', actualSource: 'static', canaryAssignmentReason: 'authorized_exclude' });
    expect(excluded.snapshot.source).toBe('static');
    for (const id of ORDINARY.slice(0, 10)) {
      const r = await resolveRecipeAuthority(canary1(cohortVars()), { tenantKey: id, now, log });
      expect(r.canaryTenant, id).toBe(isRecipeCanaryTenant(id, 1));
      expect(r.canaryAssignmentReason, id).toBe('deterministic_bucket');
    }
    expect(recipeAuthorityCounters()).toMatchObject({ authorizedInclude: 1, authorizedExclude: 1 });
    // Diagnostics carry the bounded reason only — never the tenant key or any digest.
    const selected = diagnostics.find((d) => d.event === 'recipe_catalog_authority_selected')!;
    expect(selected).toMatchObject({ canary: true, assignmentReason: 'authorized_include' });
    const text = JSON.stringify(diagnostics);
    expect(text).not.toContain(NATURALLY_OUTSIDE);
    expect(text).not.toContain(NATURALLY_INSIDE);
    expect(text).not.toContain(includeDigest);
    expect(text).not.toContain(excludeDigest);
    expect(text).not.toMatch(/t15c-synthetic-hh-/);
  });

  it('unauthenticated context (no tenant key) is never forced into D1 by an include list', async () => {
    const r = await resolveRecipeAuthority(canary1(cohortVars()), { now, log });
    expect(r).toMatchObject({ canaryTenant: false, actualSource: 'static', canaryAssignmentReason: 'missing_tenant' });
  });

  it('P1 rollback: canary → shadow with cohort secrets retained is a single config change — readiness valid, static + shadow compare, cohort not evaluated', async () => {
    const scheduled: Promise<unknown>[] = [];
    const rolledBack = env({ RECIPE_CATALOG_MODE: 'shadow', RECIPE_CATALOG_D1_CANARY_PERCENT: '0', RECIPE_CATALOG_CUTOVER_ENABLED: 'false', ...cohortVars() });
    expect(resolveRecipeAuthorityConfig(rolledBack)).toEqual({ mode: 'shadow', canaryPercent: 0, cutoverEnabled: false, testCohort: null });
    for (const tenant of [NATURALLY_OUTSIDE, NATURALLY_INSIDE, ORDINARY[0]]) {
      const r = await resolveRecipeAuthority(rolledBack, { tenantKey: tenant, now, log, backgroundExecutor: (task) => scheduled.push(task) });
      expect(r, tenant).toMatchObject({ configuredMode: 'shadow', selectedSource: 'static', actualSource: 'static', canaryTenant: false, canaryAssignmentReason: null, fallbackReason: null });
      expect(r.snapshot.source).toBe('static');
    }
    expect(scheduled.length).toBeGreaterThan(0); // shadow compare still scheduled off-response
    await Promise.all(scheduled);
    expect(diagnostics.filter((d) => d.event === 'recipe_catalog_config_invalid')).toEqual([]);
    expect(recipeAuthorityCounters()).toMatchObject({ d1: 0, authorizedInclude: 0, authorizedExclude: 0 });
  });

  it('P1 rollback: canary → static with cohort secrets retained — readiness valid, static authority, zero cohort influence', async () => {
    const rolledBack = env({ RECIPE_CATALOG_MODE: 'static', ...cohortVars() });
    expect(resolveRecipeAuthorityConfig(rolledBack).testCohort).toBeNull();
    for (const tenant of [NATURALLY_OUTSIDE, NATURALLY_INSIDE]) {
      const r = await resolveRecipeAuthority(rolledBack, { tenantKey: tenant, now, log });
      expect(r, tenant).toMatchObject({ configuredMode: 'static', actualSource: 'static', canaryTenant: false, canaryAssignmentReason: null, fallbackReason: null });
    }
    // Even a MALFORMED cohort (raw id, overlap) is inert outside canary: rollback never depends on secret hygiene.
    for (const bad of [{ RECIPE_CATALOG_TEST_COHORT_ENABLED: 'true', RECIPE_CATALOG_TEST_INCLUDE: NATURALLY_OUTSIDE }, { RECIPE_CATALOG_TEST_COHORT_ENABLED: 'yes' }, { RECIPE_CATALOG_TEST_INCLUDE: includeDigest }]) {
      for (const mode of ['static', 'shadow'] as const) {
        expect(resolveRecipeAuthorityConfig({ RECIPE_CATALOG_MODE: mode, ...bad }).testCohort, `${mode} ${JSON.stringify(Object.keys(bad))}`).toBeNull();
        const r = await resolveRecipeAuthority(env({ RECIPE_CATALOG_MODE: mode, ...bad }), { tenantKey: NATURALLY_OUTSIDE, now, log });
        expect(r.fallbackReason).toBeNull();
        expect(r.actualSource).toBe('static');
      }
    }
    expect(diagnostics.filter((d) => d.event === 'recipe_catalog_config_invalid')).toEqual([]);
    expect(JSON.stringify(diagnostics)).not.toContain(NATURALLY_OUTSIDE);
  });

  it('d1 mode: retained cohort secrets are inert — no per-household carve-out, every tenant gets the verified D1 snapshot', async () => {
    const d1 = env({ RECIPE_CATALOG_MODE: 'd1', RECIPE_CATALOG_CUTOVER_ENABLED: 'true', ...cohortVars() });
    expect(resolveRecipeAuthorityConfig(d1)).toMatchObject({ mode: 'd1', testCohort: null });
    for (const tenant of [NATURALLY_OUTSIDE, NATURALLY_INSIDE /* would be "excluded" in canary */, ORDINARY[0]]) {
      const r = await resolveRecipeAuthority(d1, { tenantKey: tenant, now, log });
      expect(r, tenant).toMatchObject({ configuredMode: 'd1', actualSource: 'd1', canaryTenant: false, canaryAssignmentReason: null, fallbackReason: null });
    }
    expect(recipeAuthorityCounters()).toMatchObject({ authorizedInclude: 0, authorizedExclude: 0 });
    // Exclude-only secrets in d1 mode cannot carve anyone out either.
    expect(resolveRecipeAuthorityConfig({ RECIPE_CATALOG_MODE: 'd1', RECIPE_CATALOG_CUTOVER_ENABLED: 'true', RECIPE_CATALOG_TEST_COHORT_ENABLED: 'true', RECIPE_CATALOG_TEST_EXCLUDE: excludeDigest }).testCohort).toBeNull();
  });

  it('canary + valid pair is active; canary + include-only or exclude-only is refused (TEST_COHORT_PAIR_REQUIRED) and serves static', async () => {
    expect(resolveRecipeAuthorityConfig(canary1(cohortVars())).testCohort).not.toBeNull();
    for (const partial of [{ RECIPE_CATALOG_TEST_INCLUDE: includeDigest }, { RECIPE_CATALOG_TEST_EXCLUDE: excludeDigest }]) {
      const e = canary1({ RECIPE_CATALOG_TEST_COHORT_ENABLED: 'true', ...partial });
      expect(() => resolveRecipeAuthorityConfig(e)).toThrow(expect.objectContaining({ code: 'TEST_COHORT_INVALID', detail: 'TEST_COHORT_PAIR_REQUIRED' }));
      const r = await resolveRecipeAuthority(e, { tenantKey: NATURALLY_OUTSIDE, now, log });
      expect(r).toMatchObject({ configuredMode: 'static', actualSource: 'static', fallbackReason: 'TEST_COHORT_INVALID' });
    }
    expect(recipeAuthorityCounters().d1).toBe(0);
  });

  it('cohort without the cutover fence is still refused (fence order: mode/cutover before cohort)', () => {
    expect(() => resolveRecipeAuthorityConfig({ RECIPE_CATALOG_MODE: 'canary', RECIPE_CATALOG_D1_CANARY_PERCENT: '1', ...cohortVars() })).toThrow(expect.objectContaining({ code: 'CUTOVER_NOT_ENABLED' }));
  });

  it('malformed cohort in canary mode serves static, loudly, and never reaches D1 for the would-be include tenant', async () => {
    const r = await resolveRecipeAuthority(canary1({ RECIPE_CATALOG_TEST_COHORT_ENABLED: 'true', RECIPE_CATALOG_TEST_INCLUDE: NATURALLY_OUTSIDE /* raw id, not a digest */ }), { tenantKey: NATURALLY_OUTSIDE, now, log });
    expect(r).toMatchObject({ configuredMode: 'static', actualSource: 'static', canaryTenant: false, fallbackReason: 'TEST_COHORT_INVALID' });
    expect(JSON.stringify(diagnostics)).not.toContain(NATURALLY_OUTSIDE);
    const overlap = await resolveRecipeAuthority(canary1({ RECIPE_CATALOG_TEST_COHORT_ENABLED: 'true', RECIPE_CATALOG_TEST_INCLUDE: includeDigest, RECIPE_CATALOG_TEST_EXCLUDE: includeDigest }), { tenantKey: NATURALLY_OUTSIDE, now, log });
    expect(overlap).toMatchObject({ actualSource: 'static', fallbackReason: 'TEST_COHORT_INVALID' });
    expect(recipeAuthorityCounters().d1).toBe(0);
  });

  it('production readiness: disabled cohort is silent; active pair is a counted warning without digests; malformed/partial canary cohort is fatal; static/shadow/d1 ignore retained secrets', async () => {
    const production = {
      ENVIRONMENT: 'production', APP_URL: 'https://frigo.tungjpstore.net', AI_MOCK_MODE: 'false', SCAN_QUEUE_MODE: 'async', WEEK_SCHEMA_MODE: 'dual',
      DB: {} as Env['DB'], CACHE: {} as Env['CACHE'], AI: {}, QWEN_API_KEY: 'k', SCAN_QUEUE: {} as Env['SCAN_QUEUE'], IMAGES: {} as Env['IMAGES'],
      JWT_SECRET: 's'.repeat(40), OTP_HASH_SECRET: 'otp'.repeat(16), TURNSTILE_SITE_KEY: 'a', TURNSTILE_SECRET_KEY: 'b',
    } as unknown as Env;
    const codes = (e: Env) => { const v = validateEnvironment(e); return { fatal: v.fatal.map((i) => i.code), warn: v.warnings.map((i) => i.code), text: JSON.stringify(v) }; };
    const shadow = codes({ ...production, RECIPE_CATALOG_MODE: 'shadow' });
    expect(shadow.fatal).not.toContain('CONFIG_RECIPE_CATALOG_TEST_COHORT');
    expect(shadow.warn).not.toContain('CONFIG_RECIPE_CATALOG_TEST_COHORT_ACTIVE');
    const active = codes({ ...production, RECIPE_CATALOG_MODE: 'canary', RECIPE_CATALOG_D1_CANARY_PERCENT: '1', RECIPE_CATALOG_CUTOVER_ENABLED: 'true', ...cohortVars() });
    expect(active.fatal).toEqual([]);
    expect(active.warn).toContain('CONFIG_RECIPE_CATALOG_TEST_COHORT_ACTIVE');
    expect(active.text).toContain('1 include / 1 exclude');
    expect(active.text).not.toContain(includeDigest);
    expect(active.text).not.toContain(excludeDigest);
    // P1: rollback to shadow/static with the secrets still set is a clean readiness (no fatal, no cohort warning).
    for (const mode of ['shadow', 'static']) {
      const rolledBack = codes({ ...production, RECIPE_CATALOG_MODE: mode, RECIPE_CATALOG_D1_CANARY_PERCENT: '0', RECIPE_CATALOG_CUTOVER_ENABLED: 'false', ...cohortVars() });
      expect(rolledBack.fatal, mode).toEqual([]);
      expect(rolledBack.warn, mode).not.toContain('CONFIG_RECIPE_CATALOG_TEST_COHORT_ACTIVE');
      expect(codes({ ...production, RECIPE_CATALOG_MODE: mode, RECIPE_CATALOG_TEST_COHORT_ENABLED: 'true', RECIPE_CATALOG_TEST_INCLUDE: 'garbage' }).fatal, `${mode} malformed`).toEqual([]);
    }
    // d1 with retained secrets: inert (only the pre-existing D1-authority warning).
    const d1 = codes({ ...production, RECIPE_CATALOG_MODE: 'd1', RECIPE_CATALOG_CUTOVER_ENABLED: 'true', ...cohortVars() });
    expect(d1.fatal).toEqual([]);
    expect(d1.warn).not.toContain('CONFIG_RECIPE_CATALOG_TEST_COHORT_ACTIVE');
    // P2: canary with include-only / exclude-only / none is fatal.
    const canaryBase = { ...production, RECIPE_CATALOG_MODE: 'canary', RECIPE_CATALOG_D1_CANARY_PERCENT: '1', RECIPE_CATALOG_CUTOVER_ENABLED: 'true', RECIPE_CATALOG_TEST_COHORT_ENABLED: 'true' };
    expect(codes(canaryBase).fatal).toContain('CONFIG_RECIPE_CATALOG_TEST_COHORT');
    expect(codes({ ...canaryBase, RECIPE_CATALOG_TEST_INCLUDE: includeDigest }).fatal).toContain('CONFIG_RECIPE_CATALOG_TEST_COHORT');
    expect(codes({ ...canaryBase, RECIPE_CATALOG_TEST_EXCLUDE: excludeDigest }).fatal).toContain('CONFIG_RECIPE_CATALOG_TEST_COHORT');
    expect(codes({ ...canaryBase, RECIPE_CATALOG_TEST_INCLUDE: includeDigest }).text).toContain('TEST_COHORT_PAIR_REQUIRED');
    expect(codes({ ...production, RECIPE_CATALOG_MODE: 'canary', RECIPE_CATALOG_D1_CANARY_PERCENT: '1', RECIPE_CATALOG_CUTOVER_ENABLED: 'true', RECIPE_CATALOG_TEST_COHORT_ENABLED: 'true', RECIPE_CATALOG_TEST_INCLUDE: includeDigest, RECIPE_CATALOG_TEST_EXCLUDE: includeDigest }).fatal).toContain('CONFIG_RECIPE_CATALOG_TEST_COHORT');
    expect(codes({ ...production, RECIPE_CATALOG_MODE: 'canary', RECIPE_CATALOG_D1_CANARY_PERCENT: '1', RECIPE_CATALOG_CUTOVER_ENABLED: 'true', RECIPE_CATALOG_TEST_INCLUDE: includeDigest }).fatal).toContain('CONFIG_RECIPE_CATALOG_TEST_COHORT');
  });
});
