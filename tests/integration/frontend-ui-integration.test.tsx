import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import type { MealPlan, MealSlotItem } from '@frigo/domain';
import { ALL_RECIPES, evaluateRecipeMatch } from '@frigo/recipes';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const route = vi.hoisted(() => ({ params: { slug: 'test-recipe' } as Record<string, string> }));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/recipes/test-recipe' }),
  useParams: () => route.params,
}));

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const TODAY = '2026-09-08';
const recipe = { ...ALL_RECIPES[0], id: 'test-recipe', slug: 'test-recipe', title: 'REAL_RECIPE_FROM_QUERY' };
const slot = (slotType: MealSlotItem['slotType'], status: MealSlotItem['status'] = 'PLANNED'): MealSlotItem => ({
  id: slotType, dayId: 'day-1', planId: 'plan-1', slotType, status, date: TODAY, dayOfWeek: 2,
  recipe: { ...recipe, title: `REAL_${slotType}_FROM_WEEK` }, servings: 2, source: 'AUTO',
  availabilityPercent: 100, incrementalCostVnd: 0, rescuedExpiringIngredients: [], badges: [], ingredients: [],
});
const plan = (slots = [slot('breakfast'), slot('lunch'), slot('dinner')]): MealPlan => ({
  id: 'plan-1', householdId: 'house-a', startDate: TODAY, endDate: TODAY, status: 'ACTIVE',
  days: [{ id: 'day-1', planId: 'plan-1', date: TODAY, dayOfWeek: 2, dayNameVi: 'Thứ 3', dayType: 'cooking', slots }],
  budget: { targetVnd: 900000, estimatedMinVnd: 310000, estimatedMaxVnd: 321000, status: 'UNDER', displayText: '' },
  utilization: { utilizationPercent: 0, plannedItemsCount: 0, totalUsableItemsCount: 0, highPriorityUsedCount: 0 },
  wasteRisk: { level: 'LOW', expiringItemsCount: 0, rescuedItemsCount: 0, displayText: '' },
  shoppingItems: [], priorities: [], shoppingFrequency: 'once', createdAt: TODAY, updatedAt: TODAY,
});

async function loadUi() {
  const { QueryClientProvider } = await import('@tanstack/react-query');
  const { queryClient } = await import('../../src/web/lib/query-client');
  const { queryKeys } = await import('../../src/web/lib/queryKeys');
  const { ApiError } = await import('../../src/web/services/http');
  queryClient.setDefaultOptions({ queries: { retry: false, retryOnMount: false, staleTime: Infinity, gcTime: Infinity } });
  return {
    queryClient, queryKeys, ApiError,
    render: (page: ReactElement) => renderToStaticMarkup(<QueryClientProvider client={queryClient}>{page}</QueryClientProvider>),
    failQuery: async (queryKey: readonly unknown[], error: Error) => {
      await expect(queryClient.fetchQuery({ queryKey, queryFn: () => Promise.reject(error) })).rejects.toBe(error);
    },
  };
}

beforeEach(() => {
  route.params = { slug: 'test-recipe' };
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 8, 8));
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.stubGlobal('sessionStorage', new MemoryStorage());
  localStorage.setItem('frigo_user_id', 'user-a');
  localStorage.setItem('frigo_household_id', 'house-a');
  localStorage.setItem('frigo_display_name', 'Integration User');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('time-aware Home meal selection', () => {
  it.each([
    [8, 0, 'breakfast'], [10, 59, 'breakfast'], [11, 0, 'lunch'],
    [15, 59, 'lunch'], [16, 0, 'dinner'], [23, 59, 'dinner'],
  ])('chooses the current meal at %i:%i rather than always preferring dinner', async (hour, minute, expected) => {
    const { findTodayMeal } = await import('../../src/web/lib/home-meal');
    expect(findTodayMeal(plan(), new Date(2026, 8, 8, hour, minute))?.slotType).toBe(expected);
  });

  it.each(['COOKED', 'SKIPPED', 'EATING_OUT', 'FLEXIBLE'] as const)('skips a %s current slot and selects the next cookable meal', async (status) => {
    const { findTodayMeal } = await import('../../src/web/lib/home-meal');
    expect(findTodayMeal(plan([slot('dinner'), slot('breakfast', status), slot('lunch')]))?.slotType).toBe('lunch');
  });

  it('accepts leftovers, skips missing recipes, and never falls back to an elapsed meal', async () => {
    const { findTodayMeal } = await import('../../src/web/lib/home-meal');
    expect(findTodayMeal(plan([slot('breakfast', 'LEFTOVER')]))?.status).toBe('LEFTOVER');
    expect(findTodayMeal(plan([{ ...slot('breakfast'), recipe: undefined }, slot('lunch')]))?.slotType).toBe('lunch');
    expect(findTodayMeal(plan([slot('breakfast')]), new Date(2026, 8, 8, 17))).toBeNull();
  });

  it('returns no meal for an absent plan, different local date, or completed day', async () => {
    const { findTodayMeal } = await import('../../src/web/lib/home-meal');
    expect(findTodayMeal(null)).toBeNull();
    expect(findTodayMeal(plan(), new Date(2026, 8, 9, 8))).toBeNull();
    expect(findTodayMeal(plan([slot('breakfast', 'COOKED'), slot('lunch', 'COOKED'), slot('dinner', 'COOKED')]))).toBeNull();
  });
});

describe('real Home data rendered through the shared QueryClient', () => {
  it('renders honest empty states without fake meal, budget, expiry items, progress, or notification badges', async () => {
    const ui = await loadUi();
    const { HomePage } = await import('../../src/web/pages/HomePage');
    ui.queryClient.setQueryData(ui.queryKeys.inventory(), []);
    ui.queryClient.setQueryData(ui.queryKeys.currentWeekPlan(), null);
    ui.queryClient.setQueryData(ui.queryKeys.recommendations({ noBuy: false, cuisine: null }), []);
    const html = ui.render(<HomePage />);
    expect(html).toContain('Tủ lạnh đang trống');
    expect(html).toContain('Chưa tìm thấy món phù hợp');
    for (const fake of ['Thịt kho trứng', '560k', '800k', '5/7', '71%', 'Cà chua']) expect(html).not.toContain(fake);
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain('ngân sách');
    const bell = html.match(/<button[^>]*aria-label="Thông báo"[^>]*>([\s\S]*?)<\/button>/)?.[1];
    expect(bell).toBeTruthy();
    expect(bell).not.toMatch(/<span|bg-rose|bg-red/);
  });

  it('derives the current meal, week progress, budget, and use-soon inventory from query data', async () => {
    const ui = await loadUi();
    const { HomePage } = await import('../../src/web/pages/HomePage');
    ui.queryClient.setQueryData(ui.queryKeys.currentWeekPlan(), plan());
    ui.queryClient.setQueryData(ui.queryKeys.inventory(), [
      { id: 'expiring-a', name: 'REAL_EXPIRING_FROM_INVENTORY', freshness: 'use_soon', expiryDate: '2026-09-09T00:00:00' },
      { id: 'fresh-a', name: 'FRESH_ITEM_NOT_IN_USE_SOON', freshness: 'fresh' },
    ]);
    ui.queryClient.setQueryData(ui.queryKeys.recommendations({ noBuy: false, cuisine: null }), []);
    const html = ui.render(<HomePage />);
    expect(html).toContain('REAL_breakfast_FROM_WEEK');
    expect(html).not.toContain('REAL_dinner_FROM_WEEK');
    expect(html).toContain('3/3 bữa đã lên thực đơn');
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain('321k / 900k ngân sách');
    expect(html).toContain('REAL_EXPIRING_FROM_INVENTORY');
    expect(html).not.toContain('FRESH_ITEM_NOT_IN_USE_SOON');
  });

  // T13R-B P2-5: the Home use-soon card must never show an ESTIMATED date as an
  // unqualified countdown, and never show an UNKNOWN date as a countdown at all.
  it('qualifies estimated expiry on Home and keeps KNOWN/ESTIMATED/UNKNOWN visually distinct', async () => {
    const ui = await loadUi();
    const { HomePage } = await import('../../src/web/pages/HomePage');
    ui.queryClient.setQueryData(ui.queryKeys.currentWeekPlan(), null);
    ui.queryClient.setQueryData(ui.queryKeys.inventory(), [
      { id: 'est', name: 'ESTIMATED_ITEM', freshness: 'use_soon', expiryKind: 'ESTIMATED',
        expiryDate: '2026-09-10', estimatedExpiryDate: '2026-09-10' },
      { id: 'known', name: 'KNOWN_ITEM', freshness: 'use_soon', expiryKind: 'KNOWN', expiryDate: '2026-09-10' },
      { id: 'unknown', name: 'UNKNOWN_ITEM', freshness: 'expiring', expiryKind: 'UNKNOWN', expiryDate: null },
    ]);
    ui.queryClient.setQueryData(ui.queryKeys.recommendations({ noBuy: false, cuisine: null }), []);
    const html = ui.render(<HomePage />);
    const chips = [...html.matchAll(/data-testid="home-use-soon-expiry" data-expiry-kind="([A-Z]+)"[^>]*>([^<]*)</g)]
      .map((match) => [match[1], match[2].trim()]);
    expect(chips).toEqual(expect.arrayContaining([
      ['ESTIMATED', 'Ước tính còn 2 ngày'],
      ['KNOWN', '⏳ 2 ngày'],
      ['UNKNOWN', 'Chưa rõ hạn dùng'],
    ]));
    expect(chips).toHaveLength(3);
    const estimated = chips.find(([kind]) => kind === 'ESTIMATED')![1];
    const known = chips.find(([kind]) => kind === 'KNOWN')![1];
    expect(estimated).not.toBe(known);
    expect(known.toLowerCase()).not.toContain('ước tính');
  });

  it('keeps successful widgets visible while a failed Home query offers retry', async () => {
    const ui = await loadUi();
    const { HomePage } = await import('../../src/web/pages/HomePage');
    ui.queryClient.setQueryData(ui.queryKeys.inventory(), [{ id: 'i', name: 'REAL_SURVIVING_WIDGET', freshness: 'expiring' }]);
    ui.queryClient.setQueryData(ui.queryKeys.recommendations({ noBuy: false, cuisine: null }), []);
    await ui.failQuery(ui.queryKeys.currentWeekPlan(), new ui.ApiError('http', 'internal failure', 500));
    const html = ui.render(<HomePage />);
    expect(html).toContain('REAL_SURVIVING_WIDGET');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Thử lại');
    expect(html).not.toContain('internal failure');
  });

  it('renders recommendations from server-state data rather than a hardcoded featured recipe', async () => {
    const ui = await loadUi();
    const { HomePage } = await import('../../src/web/pages/HomePage');
    ui.queryClient.setQueryData(ui.queryKeys.inventory(), []);
    ui.queryClient.setQueryData(ui.queryKeys.currentWeekPlan(), null);
    ui.queryClient.setQueryData(ui.queryKeys.recommendations({ noBuy: false, cuisine: null }), [
      evaluateRecipeMatch(recipe, { inventory: [] }),
    ]);
    const html = ui.render(<HomePage />);
    expect(html).toContain(recipe.title);
    expect(html).not.toContain('Chưa tìm thấy món phù hợp');
  });
});

describe('RecipeDetail loading, not-found, error, and success remain distinct', () => {
  it('renders a real pending state before recipe data arrives', async () => {
    const ui = await loadUi();
    const { RecipeDetailPage } = await import('../../src/web/pages/RecipeDetailPage');
    expect(ui.render(<RecipeDetailPage />)).toContain('Đang tải công thức');
  });

  it('does not spin forever when a successful response has no recipe', async () => {
    const ui = await loadUi();
    const { RecipeDetailPage } = await import('../../src/web/pages/RecipeDetailPage');
    ui.queryClient.setQueryData(ui.queryKeys.recipe('test-recipe'), { recipe: null });
    const html = ui.render(<RecipeDetailPage />);
    expect(html).toContain('Không tìm thấy công thức này');
    expect(html).not.toContain('Đang tải công thức');
  });

  it.each([404, 500])('renders a distinct %i response instead of an infinite spinner', async (status) => {
    const ui = await loadUi();
    const { RecipeDetailPage } = await import('../../src/web/pages/RecipeDetailPage');
    await ui.failQuery(ui.queryKeys.recipe('test-recipe'), new ui.ApiError('http', 'private server details', status));
    const html = ui.render(<RecipeDetailPage />);
    expect(html).not.toContain('Đang tải công thức');
    if (status === 404) expect(html).toContain('Không tìm thấy công thức này');
    else {
      expect(html).toContain('role="alert"');
      expect(html).toContain('Thử lại');
      expect(html).not.toContain('Không tìm thấy công thức này');
    }
    expect(html).not.toContain('private server details');
  });

  it('renders the offline error honestly with retry', async () => {
    const ui = await loadUi();
    const { RecipeDetailPage } = await import('../../src/web/pages/RecipeDetailPage');
    await ui.failQuery(ui.queryKeys.recipe('test-recipe'), new ui.ApiError('offline', 'offline'));
    const html = ui.render(<RecipeDetailPage />);
    expect(html).toContain('Không có kết nối mạng');
    expect(html).toContain('Thử lại');
  });

  it('renders a successfully loaded recipe from the secure query cache', async () => {
    const ui = await loadUi();
    const { RecipeDetailPage } = await import('../../src/web/pages/RecipeDetailPage');
    ui.queryClient.setQueryData(ui.queryKeys.recipe('test-recipe'), { recipe });
    ui.queryClient.setQueryData(ui.queryKeys.inventory(), []);
    const html = ui.render(<RecipeDetailPage />);
    expect(html).toContain(recipe.title);
    expect(html).toContain('Bắt đầu nấu');
    expect(html).not.toContain('Đang tải công thức');
    expect(html).not.toContain('Không tìm thấy công thức này');
  });
});

describe('notification honesty', () => {
  it('renders no fabricated alerts or global unread dot when the server list is empty', async () => {
    const ui = await loadUi();
    const { NotificationsPage } = await import('../../src/web/pages/NotificationsPage');
    const { MemoryRouter } = await import('react-router-dom');
    ui.queryClient.setQueryData(ui.queryKeys.notifications(), []);
    const html = ui.render(<MemoryRouter><NotificationsPage /></MemoryRouter>);
    expect(html).toContain('Chưa có thông báo mới');
    const bell = html.match(/<button[^>]*aria-label="Thông báo"[^>]*>([\s\S]*?)<\/button>/)?.[1];
    expect(bell).toBeTruthy();
    expect(bell).not.toMatch(/<span|bg-rose|bg-red/);
  });

  it('renders notification content only when returned by the real query contract', async () => {
    const ui = await loadUi();
    const { NotificationsPage } = await import('../../src/web/pages/NotificationsPage');
    const { MemoryRouter } = await import('react-router-dom');
    ui.queryClient.setQueryData(ui.queryKeys.notifications(), [{
      id: 'notification-a', type: 'expiring_soon', title: 'REAL_NOTIFICATION', message: 'REAL_MESSAGE', createdAt: `${TODAY}T07:00:00`,
    }]);
    const html = ui.render(<MemoryRouter><NotificationsPage /></MemoryRouter>);
    expect(html).toContain('REAL_NOTIFICATION');
    expect(html).toContain('REAL_MESSAGE');
    expect(html).not.toContain('Chưa có thông báo mới');
  });

  it('surfaces notification errors rather than pretending the list is empty', async () => {
    const ui = await loadUi();
    const { NotificationsPage } = await import('../../src/web/pages/NotificationsPage');
    const { MemoryRouter } = await import('react-router-dom');
    await ui.failQuery(ui.queryKeys.notifications(), new ui.ApiError('http', 'failure', 500));
    const html = ui.render(<MemoryRouter><NotificationsPage /></MemoryRouter>);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Thử lại');
    expect(html).not.toContain('Chưa có thông báo mới');
  });
});

describe('Week shopping data honesty', () => {
  it('uses the loaded plan estimate in both summaries instead of a demo budget', async () => {
    const ui = await loadUi();
    const { WeekShoppingPage } = await import('../../src/web/pages/WeekShoppingPage');
    route.params = { planId: 'plan-1' };
    const current = plan();
    current.budget.displayText = 'SERVER_ESTIMATE';
    ui.queryClient.setQueryData(ui.queryKeys.weekPlan(current.id), current);
    const html = ui.render(<WeekShoppingPage />);
    expect(html.match(/SERVER_ESTIMATE/g)).toHaveLength(2);
    expect(html).not.toContain('650k');
    expect(html).not.toContain('720k');
  });
});

describe('scan data honesty', () => {
  it('offers real capture/upload without a production mock-scan entry point', async () => {
    const { ScanPage } = await import('../../src/web/pages/ScanPage');
    const html = renderToStaticMarkup(<ScanPage />);
    expect(html).toContain('type="file"');
    expect(html).toContain('accept="image/*"');
    expect(html).not.toContain('Thử quét ảnh mẫu');
    expect(readFileSync('src/web/pages/ScanPage.tsx', 'utf8')).not.toContain('mock-fridge-base64');
    expect(readFileSync('src/web/components/scan/CameraViewfinder.tsx', 'utf8')).not.toContain('ảnh mẫu');
  });
});

describe('secure application-shell architecture', () => {
  const source = ts.createSourceFile('App.tsx', readFileSync('src/web/App.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function descendants(node: ts.Node): ts.Node[] {
    const result: ts.Node[] = [];
    node.forEachChild((child) => { result.push(child, ...descendants(child)); });
    return result;
  }
  const nodes = descendants(source);
  const element = (name: string) => nodes.filter(ts.isJsxElement).find((node) => node.openingElement.tagName.getText(source) === name)!;
  function ancestors(node: ts.Node): string[] {
    const names: string[] = [];
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isJsxElement(parent)) names.unshift(parent.openingElement.tagName.getText(source));
    }
    return names;
  }

  it('keeps SessionBoundary inside the shared QueryClient provider/router and outside Suspense/routes', () => {
    // T17 adds a presentation-only MotionProvider (reduced-motion contract);
    // the security containment ordering itself is unchanged.
    expect(ancestors(element('SessionBoundary'))).toEqual(['QueryClientProvider', 'BrowserRouter', 'MotionProvider', 'AppErrorBoundary']);
    expect(ancestors(element('Routes'))).toEqual(['QueryClientProvider', 'BrowserRouter', 'MotionProvider', 'AppErrorBoundary', 'SessionBoundary', 'Suspense']);
    expect(element('QueryClientProvider').openingElement.attributes.getText(source)).toContain('client={queryClient}');
    expect(source.text).toMatch(/import\s*\{\s*queryClient\s*\}\s*from\s*['"]\.\/lib\/query-client['"]/);
    expect(element('Suspense').openingElement.attributes.getText(source)).toContain('RouteFallback');
  });

  it('resets routes and the error boundary for both account and household changes', () => {
    for (const name of ['Routes', 'AppErrorBoundary']) {
      const key = element(name).openingElement.attributes.properties.filter(ts.isJsxAttribute).find((attribute) => attribute.name.getText(source) === 'key');
      expect(key).toBeDefined();
      expect(key!.getText(source)).toContain('${userId}');
      expect(key!.getText(source)).toContain('${householdId}');
    }
    expect(source.text).toContain('getDerivedStateFromError');
    expect(source.text).toContain('role="alert"');
  });

  it('lazy-loads every route page instead of eagerly importing the page tree', () => {
    const lazyPages = nodes.filter(ts.isVariableDeclaration).filter((node) =>
      node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(source) === 'lazy'
    ).map((node) => node.name.getText(source));
    const routedPages = nodes.filter(ts.isJsxSelfClosingElement).map((node) => node.tagName.getText(source)).filter((name) => name.endsWith('Page'));
    expect(routedPages.length).toBeGreaterThan(15);
    expect(lazyPages).toEqual(expect.arrayContaining(routedPages));
    const eagerPageImports = source.statements.filter(ts.isImportDeclaration).filter((node) =>
      ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.startsWith('./pages/')
    );
    expect(eagerPageImports).toHaveLength(0);
  });

  it.each([
    ['user-a', 'house-a'], ['user-b', 'house-a'], ['user-a', 'house-b'],
  ])('withholds private child markup while %s/%s awaits server verification', async (userId, householdId) => {
    localStorage.setItem('frigo_user_id', userId);
    localStorage.setItem('frigo_household_id', householdId);
    const { SessionBoundary } = await import('../../src/web/components/common/SessionBoundary');
    const html = renderToStaticMarkup(<SessionBoundary><div>PRIVATE_CHILD_MUST_WAIT</div></SessionBoundary>);
    expect(html).toContain('Đang kiểm tra phiên');
    expect(html).not.toContain('PRIVATE_CHILD_MUST_WAIT');
  });
});
