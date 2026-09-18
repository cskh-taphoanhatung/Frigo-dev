import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

async function loadClient() {
  const { api } = await import('../../src/web/services/api');
  const { useAuthStore } = await import('../../src/web/stores/useAuthStore');
  const { useWeekStore } = await import('../../src/web/stores/useWeekStore');
  const { useScanStore } = await import('../../src/web/stores/useScanStore');
  const { useCookingStore } = await import('../../src/web/stores/useCookingStore');
  const { queryClient } = await import('../../src/web/lib/query-client');
  const session = await import('../../src/web/lib/private-session');
  const sync = await import('../../src/web/lib/sync');
  return { api, auth: useAuthStore, week: useWeekStore, scan: useScanStore,
    cooking: useCookingStore, queryClient, session, sync };
}

type Client = Awaited<ReturnType<typeof loadClient>>;
const user = (id = 'user-a', householdId = 'house-a') => ({
  id, householdId, email: `${id}@example.test`, displayName: id,
});
const plan = (householdId = 'house-a') => ({ id: `plan-${householdId}`, householdId, days: [], shoppingItems: [] });

function signIn(client: Client, id = 'user-a', householdId = 'house-a') {
  client.auth.getState().setAuthSession(user(id, householdId));
}

function seedPrivateState(client: Client) {
  client.auth.setState({ isPlus: true, isOnboarded: true, householdSize: 7,
    dietaryRestrictions: ['private'], primaryGoal: 'private' });
  client.week.setState({ currentPlan: plan() as any, setupDraft: { householdSize: 7 } });
  client.scan.setState({ imageBase64: 'private photo', scanId: 'scan-a', isProcessing: true });
  client.cooking.setState({ activeRecipe: { id: 'private' } as any, isTimerRunning: true,
    deductions: [{ ingredientId: 'private' } as any] });
  client.queryClient.setQueryData(['inventory'], [{ name: 'private food' }]);
  client.queryClient.setQueryData(['shopping'], [{ name: 'private shopping' }]);
  localStorage.setItem(client.session.privateCacheKey('active_meal_plan'), JSON.stringify(plan()));
  localStorage.setItem(client.session.privateCacheKey('inventory'), '[{"name":"private food"}]');
  localStorage.setItem(client.session.privateCacheKey('shopping_list'), '[{"name":"private shopping"}]');
  client.sync.pushOp({ path: '/inventory', method: 'POST', label: 'private', ...client.session.currentPrivateScope() });
}

function expectPrivateReset(client: Client) {
  expect(client.auth.getState()).toMatchObject({ userId: '', householdId: '', email: '',
    avatarUrl: undefined, isPlus: false, isOnboarded: false, householdSize: 2,
    dietaryRestrictions: [], primaryGoal: undefined });
  expect(client.week.getState()).toMatchObject({ currentPlan: null, isLoading: false,
    isGenerating: false, swapAlternatives: [], setupDraft: { householdSize: 3 } });
  expect(client.scan.getState()).toMatchObject({ imageBase64: null, scanId: null, items: [], isProcessing: false });
  expect(client.cooking.getState()).toMatchObject({ activeRecipe: null, deductions: [], isTimerRunning: false });
  expect(client.queryClient.getQueryCache().getAll()).toHaveLength(0);
  expect(client.sync.getPendingOps()).toEqual([]);
  expect([...Array(localStorage.length)].map((_, index) => localStorage.key(index)))
    .not.toEqual(expect.arrayContaining([expect.stringContaining('frigo_cache_v2:')]));
}

describe('server-confirmed logout and private session isolation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.stubGlobal('sessionStorage', new MemoryStorage());
    vi.stubGlobal('window', new EventTarget());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('awaits the cookie-authenticated backend logout and immediately clears every private projection', async () => {
    const client = await loadClient();
    signIn(client);
    seedPrivateState(client);
    const response = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(response.promise));

    const logout = client.auth.getState().logout();
    expect(client.auth.getState().logout()).toBe(logout);
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/v1/auth/logout', expect.objectContaining({
      method: 'POST', credentials: 'include',
    }));
    expect(client.auth.getState().logoutStatus).toBe('pending');
    expect(client.session.privateSessionBlocked()).toBe(true);
    expectPrivateReset(client);
    await expect(client.api.retryPendingWrites()).resolves.toEqual({ attempted: 0, remaining: 0 });

    response.resolve(json({ success: true }));
    await expect(logout).resolves.toBe(true);
    expect(client.auth.getState().logoutStatus).toBe('idle');
    expect(client.session.privateSessionBlocked()).toBe(false);
    expectPrivateReset(client);
  });

  it.each(['offline', 'http', 'unconfirmed'] as const)('keeps logout blocked across reload after %s failure and offers a real retry', async (failure) => {
    let client = await loadClient();
    signIn(client);
    seedPrivateState(client);
    const fetchMock = vi.fn();
    if (failure === 'offline') fetchMock.mockRejectedValue(new TypeError('offline'));
    else fetchMock.mockResolvedValue(json({ success: false }, failure === 'http' ? 503 : 200));
    vi.stubGlobal('fetch', fetchMock);

    await expect(client.auth.getState().logout()).resolves.toBe(false);
    expectPrivateReset(client);
    expect(client.auth.getState()).toMatchObject({ logoutStatus: 'error', logoutError: client.session.LOGOUT_WARNING });
    expect(localStorage.getItem(client.session.LOGOUT_PENDING_KEY)).toBe('true');

    vi.resetModules();
    client = await loadClient();
    expect(client.auth.getState()).toMatchObject({ userId: '', householdId: '', logoutStatus: 'error' });
    await expect(client.api.getInventory()).rejects.toMatchObject({ kind: 'auth' });
    await expect(client.api.retryPendingWrites()).resolves.toMatchObject({ attempted: 0 });
    expect(() => signIn(client, 'user-b', 'house-b')).toThrow(client.session.LOGOUT_WARNING);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValue(json({ success: true }));
    await expect(client.auth.getState().logout()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(client.session.privateSessionBlocked()).toBe(false);
  });

  it('does not expose user A Week, inventory or shopping caches to user B after logout', async () => {
    const client = await loadClient();
    signIn(client);
    seedPrivateState(client);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ success: true })));
    await client.auth.getState().logout();
    signIn(client, 'user-b', 'house-b');
    vi.mocked(fetch).mockRejectedValue(new TypeError('offline'));
    await expect(client.api.getCurrentWeekPlan()).resolves.toBeNull();
    await expect(client.api.getInventory()).resolves.toEqual([]);
    await expect(client.api.getShoppingList()).resolves.toEqual([]);
    expect(client.week.getState().currentPlan).toBeNull();
    expect(localStorage.getItem('frigo_token')).toBeNull();
  });

  it('resets memory and scopes persistence when the same user changes households', async () => {
    const client = await loadClient();
    signIn(client);
    seedPrivateState(client);
    signIn(client, 'user-a', 'house-b');
    expect(client.week.getState().currentPlan).toBeNull();
    expect(client.auth.getState()).toMatchObject({ householdId: 'house-b', isPlus: false, householdSize: 2 });
    expect(client.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(client.session.privateCacheKey('inventory')).toBe('frigo_cache_v2:user-a:house-b:inventory');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(client.api.getCurrentWeekPlan()).resolves.toBeNull();
    await expect(client.api.getInventory()).resolves.toEqual([]);
    await expect(client.api.getShoppingList()).resolves.toEqual([]);
    await expect(client.api.retryPendingWrites()).resolves.toEqual({ attempted: 0, remaining: 1 });
  });

  it('deletes unowned legacy cache and outbox entries instead of adopting them', async () => {
    localStorage.setItem('frigo_token', 'old-reusable-token');
    localStorage.setItem('frigo_active_meal_plan', JSON.stringify(plan()));
    localStorage.setItem('frigo_inventory_house-a', '[{"name":"unknown owner"}]');
    localStorage.setItem('frigo_shopping_list_house-a', '[{"name":"unknown owner"}]');
    localStorage.setItem('frigo_sync_outbox_v1', JSON.stringify([
      { id: 'old-1', path: '/inventory', method: 'POST' },
      { id: 'old-2', userId: 'user-a', householdId: 'house-a', path: '/inventory', method: 'POST' },
    ]));
    const client = await loadClient();
    expect(localStorage.getItem('frigo_token')).toBeNull();
    expect(localStorage.getItem('frigo_active_meal_plan')).toBeNull();
    expect(localStorage.getItem('frigo_inventory_house-a')).toBeNull();
    expect(localStorage.getItem('frigo_shopping_list_house-a')).toBeNull();
    expect(client.sync.getPendingOps()).toEqual([]);
  });

  it('discards a late private HTTP response and an old 401 without clearing the new identity', async () => {
    const client = await loadClient();
    signIn(client);
    const inventory = deferred<Response>();
    const shopping = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(inventory.promise).mockReturnValueOnce(shopping.promise));
    const inventoryResult = client.api.getInventory();
    const shoppingResult = client.api.getShoppingList();
    signIn(client, 'user-b', 'house-b');
    inventory.resolve(json({ items: [{ name: 'A private food' }] }));
    shopping.resolve(json({ error: 'expired old session' }, 401));
    await expect(inventoryResult).rejects.toMatchObject({ kind: 'auth' });
    await expect(shoppingResult).rejects.toMatchObject({ kind: 'auth' });
    expect(client.auth.getState().userId).toBe('user-b');
    expect(localStorage.getItem(client.session.privateCacheKey('inventory'))).toBeNull();
  });

  it('does not repopulate Week memory from an in-flight store action after household switch', async () => {
    const client = await loadClient();
    signIn(client);
    const response = deferred<any>();
    vi.spyOn(client.api, 'getCurrentWeekPlan').mockReturnValue(response.promise);
    const loading = client.week.getState().loadCurrentPlan();
    signIn(client, 'user-a', 'house-b');
    response.resolve(plan());
    await expect(loading).resolves.toBeNull();
    expect(client.week.getState()).toMatchObject({ currentPlan: null, isLoading: false });
  });

  it('cancels private queries so late data cannot re-enter the shared query cache', async () => {
    const client = await loadClient();
    signIn(client);
    const response = deferred<string>();
    const result = client.queryClient.fetchQuery({ queryKey: ['inventory'], queryFn: () => response.promise }).catch(() => null);
    signIn(client, 'user-b', 'house-b');
    response.resolve('private A inventory');
    await result;
    expect(client.queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('does not enqueue an offline result after its identity was reset', async () => {
    const client = await loadClient();
    signIn(client);
    let reject!: (error: Error) => void;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise((_, fail) => { reject = fail; })));
    const adding = client.api.addInventoryItem({ name: 'A food' });
    signIn(client, 'user-b', 'house-b');
    reject(new TypeError('offline'));
    await expect(adding).rejects.toMatchObject({ kind: 'auth' });
    expect(client.sync.getPendingOps()).toEqual([]);
  });

  it('fences cache writes even when the identity changes between HTTP parsing and the API continuation', async () => {
    const client = await loadClient();
    signIn(client);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [{ name: 'A confirmed scan' }] }).then((body) => {
        queueMicrotask(() => queueMicrotask(() => signIn(client, 'user-b', 'house-b')));
        return body;
      }),
    }));
    await expect(client.api.confirmScan('scan-a', [])).rejects.toMatchObject({ kind: 'auth' });
    expect(localStorage.getItem('frigo_cache_v2:user-b:house-a:inventory')).toBeNull();
    expect(client.sync.getPendingOps()).toEqual([]);
  });

  it('does not reassign an offline Week mutation if scope changes between network failure and fallback', async () => {
    const client = await loadClient();
    signIn(client);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve().then(() => {
      queueMicrotask(() => queueMicrotask(() => signIn(client, 'user-b', 'house-b')));
      throw new TypeError('offline');
    })));
    await expect(client.api.toggleWeekShoppingItem('plan-a', 'food-a', true)).rejects.toMatchObject({ kind: 'auth' });
    expect(client.sync.getPendingOps()).toEqual([]);
  });

  it.each([
    ['user-b', 'house-a'], ['user-a', 'house-b'],
  ])('checks server owner %s/%s before replay instead of trusting local storage', async (id, householdId) => {
    const client = await loadClient();
    signIn(client);
    seedPrivateState(client);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ user: { id, household: { id: householdId } } })));
    await expect(client.api.retryPendingWrites()).resolves.toMatchObject({ attempted: 0 });
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/v1/me', expect.objectContaining({ credentials: 'include' }));
    expectPrivateReset(client);
    expect(client.session.privateSessionBlocked()).toBe(true);
  });

  it('does not replay if logout begins while authoritative /me validation is in flight', async () => {
    const client = await loadClient();
    signIn(client);
    seedPrivateState(client);
    const me = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((path: string) => path.endsWith('/me')
      ? me.promise : Promise.resolve(json({ success: true }))));
    const replay = client.api.retryPendingWrites();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await client.auth.getState().logout();
    me.resolve(json({ user: { id: 'user-a', household: { id: 'house-a' } } }));
    await expect(replay).resolves.toMatchObject({ attempted: 0 });
    expect(vi.mocked(fetch).mock.calls.map(([path]) => path)).toEqual(['/api/v1/me', '/api/v1/auth/logout']);
  });

  it('binds private reads to the captured user and household, including personalized query-string requests', async () => {
    const client = await loadClient();
    signIn(client);
    const fetchMock = vi.fn().mockImplementation(async () => json({ items: [], recommendations: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await client.api.getInventory();
    await client.api.getRecommendations({ noBuy: true });
    signIn(client, 'user-a', 'house-b');
    await client.api.getInventory();
    signIn(client, 'user-b', 'house-b');
    await client.api.getInventory();
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      '/api/v1/inventory', '/api/v1/recommendations?noBuy=true', '/api/v1/inventory', '/api/v1/inventory',
    ]);
    const owners = fetchMock.mock.calls.map(([, init]) => {
      const headers = new Headers(init.headers);
      expect(init.credentials).toBe('include');
      return [headers.get('X-Frigo-Expected-User-Id'), headers.get('X-Frigo-Expected-Household-Id')];
    });
    expect(owners).toEqual([['user-a', 'house-a'], ['user-a', 'house-a'], ['user-a', 'house-b'], ['user-b', 'house-b']]);
  });

  it('preserves command headers but prevents owner overrides and retains an auth-rejected replay', async () => {
    const client = await loadClient();
    signIn(client);
    client.sync.pushOp({ path: '/inventory/item-a', method: 'PATCH', body: '{"version":1}', label: 'A command',
      userId: 'user-a', householdId: 'house-a', operationId: 'command-a', headers: {
        'Idempotency-Key': 'command-a', 'If-Match': '1',
        'X-Frigo-Expected-User-Id': 'user-b', 'x-frigo-expected-user-id': 'user-c',
        'X-FRIGO-EXPECTED-HOUSEHOLD-ID': 'house-b',
      } });
    const pending = client.sync.getPendingOps();
    const fetchMock = vi.fn(async (path: string) => path.endsWith('/me')
      ? json({ user: { id: 'user-a', household: { id: 'house-a' } } })
      : json({ code: 'SESSION_OWNER_MISMATCH' }, 403));
    vi.stubGlobal('fetch', fetchMock);
    await expect(client.api.retryPendingWrites()).resolves.toEqual({ attempted: 0, remaining: 1 });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/inventory/item-a', expect.objectContaining({
      method: 'PATCH', body: '{"version":1}', credentials: 'include', headers: {
        'Content-Type': 'application/json', 'Idempotency-Key': 'command-a', 'If-Match': '1',
        'X-Frigo-Expected-User-Id': 'user-a', 'X-Frigo-Expected-Household-Id': 'house-a',
      },
    }));
    expect(client.sync.getPendingOps()).toEqual(pending);
    expect(client.session.currentPrivateScope()).toEqual({ userId: 'user-a', householdId: 'house-a' });
  });

  it.each(['record', 'tuples', 'Headers'] as const)('normalizes %s request headers without losing command headers or permitting duplicate owner overrides', async (format) => {
    const client = await loadClient();
    signIn(client);
    client.sync.pushOp({ path: '/inventory/item-a', method: 'DELETE', label: 'A command', userId: 'user-a', householdId: 'house-a' });
    const entries: [string, string][] = [
      ['Idempotency-Key', 'command-a'], ['If-Match', '2'], ['content-type', 'application/json; charset=utf-8'],
      ['x-frigo-expected-user-id', 'user-b'], ['X-Frigo-Expected-Household-Id', 'house-b'],
    ];
    const headers = format === 'record' ? Object.fromEntries(entries) : format === 'tuples' ? entries : new Headers(entries);
    // Exercise the request adapter's HeadersInit forms without persisting a Headers instance.
    vi.spyOn(client.sync, 'flush').mockImplementation(async (replay) => {
      await replay({ ...client.sync.getPendingOps()[0], headers: headers as unknown as Record<string, string> });
      return { attempted: 0, remaining: 1 };
    });
    const fetchMock = vi.fn(async (_path: string, _init?: RequestInit) => json({ user: { id: 'user-a', household: { id: 'house-a' } } }));
    vi.stubGlobal('fetch', fetchMock);
    await client.api.retryPendingWrites();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const forwarded = new Headers(fetchMock.mock.calls[1][1]?.headers);
    expect(Object.fromEntries(forwarded)).toEqual({
      'content-type': 'application/json; charset=utf-8', 'idempotency-key': 'command-a', 'if-match': '2',
      'x-frigo-expected-user-id': 'user-a', 'x-frigo-expected-household-id': 'house-a',
    });
  });

  it('leaves public config and authentication requests unbound, even with a previous local identity', async () => {
    const client = await loadClient();
    const fetchMock = vi.fn(async (_path: string, _init?: RequestInit) => json({ success: true, turnstileSiteKey: null }));
    vi.stubGlobal('fetch', fetchMock);
    await client.api.getPublicConfig();
    signIn(client);
    await client.api.login('b@example.test', 'a-strong-password');
    for (const [, init] of fetchMock.mock.calls) {
      const headers = new Headers(init?.headers);
      expect(headers.has('X-Frigo-Expected-User-Id')).toBe(false);
      expect(headers.has('X-Frigo-Expected-Household-Id')).toBe(false);
      expect(init?.credentials).toBe('include');
    }
  });

  it.each(['frigo_user_id', 'frigo_household_id'])('fails closed before private reads or replay when local scope is missing %s', async (key) => {
    const client = await loadClient();
    signIn(client);
    client.sync.pushOp({ path: '/inventory', method: 'POST', label: 'A command', userId: 'user-a', householdId: 'house-a' });
    localStorage.removeItem(key);
    vi.stubGlobal('fetch', vi.fn());
    await expect(client.api.getInventory()).rejects.toMatchObject({ kind: 'auth' });
    await expect(client.api.retryPendingWrites()).resolves.toEqual({ attempted: 0, remaining: 1 });
    expect(fetch).not.toHaveBeenCalled();
    expect(client.sync.getPendingOps()[0]).toMatchObject({ userId: 'user-a', householdId: 'house-a' });
  });

  it('keeps the signed-in cookie identity when onboarding asks for a guest session', async () => {
    const client = await loadClient();
    signIn(client);
    vi.stubGlobal('fetch', vi.fn());
    await client.auth.getState().setGuestSession();
    expect(fetch).not.toHaveBeenCalled();
    expect(client.auth.getState()).toMatchObject({ userId: 'user-a', householdId: 'house-a', isGuest: false });
  });

  it('accepts the current guest cookie contract and reuses it on repeated onboarding calls', async () => {
    const client = await loadClient();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ success: true, user: user('guest-a', 'house-guest') }))
      .mockResolvedValueOnce(json({ items: [] })));
    await client.auth.getState().setGuestSession();
    await client.api.getInventory();
    await client.auth.getState().setGuestSession();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/v1/auth/guest', { method: 'POST', credentials: 'include' });
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/v1/inventory', expect.objectContaining({ credentials: 'include',
      headers: expect.objectContaining({ 'X-Frigo-Expected-User-Id': 'guest-a', 'X-Frigo-Expected-Household-Id': 'house-guest' }) }));
    expect(sessionStorage.getItem('frigo_guest_token')).toBeNull();
    expect(client.auth.getState()).toMatchObject({ userId: 'guest-a', householdId: 'house-guest', isGuest: true });
  });

  it('serializes overlapping guest starts so a late cookie cannot replace the adopted guest', async () => {
    const client = await loadClient();
    const response = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(response.promise));
    const first = client.auth.getState().setGuestSession();
    const second = client.auth.getState().setGuestSession();
    expect(second).toBe(first);
    response.resolve(json({ success: true, user: user('guest-a', 'house-guest') }));
    await Promise.all([first, second]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(client.auth.getState().userId).toBe('guest-a');
  });

  it('surfaces a server guest rejection instead of manufacturing an authenticated identity', async () => {
    const client = await loadClient();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'unavailable' }, 503)));
    await expect(client.auth.getState().setGuestSession()).rejects.toThrow('Không thể khởi tạo phiên khách');
    expect(client.auth.getState()).toMatchObject({ userId: '', householdId: '' });
    expect(localStorage.getItem(client.session.OFFLINE_GUEST_KEY)).toBeNull();
  });

  it('keeps a local-only offline guest from attaching an unrelated HttpOnly session', async () => {
    const client = await loadClient();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await client.auth.getState().setGuestSession();
    client.auth.getState().setOnboardingData({
      householdSize: 2,
      spicyLevel: 'medium',
      favoriteCuisines: ['vietnamese'],
      dietaryRestrictions: [],
    });
    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockImplementation(async () => json({ user: { id: 'unrelated-user', household: { id: 'unrelated-household' } } }));
    await expect(client.api.getInventory()).resolves.toEqual([]);
    await expect(client.api.getMe()).resolves.toMatchObject({
      user: { id: client.auth.getState().userId, onboardingCompleted: true },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not rebind unproven guest operations merely because registration succeeded', async () => {
    const client = await loadClient();
    localStorage.setItem('frigo_user_id', 'guest-a');
    localStorage.setItem('frigo_household_id', 'hh_guest_a');
    client.sync.pushOp({ path: '/inventory', method: 'POST', label: 'guest',
      userId: 'guest-a', householdId: 'hh_guest_a' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ success: true, user: user() })));
    await client.api.verifyOtp('a@example.test', '123456', 'register', 'hh_guest_a');
    expect(client.sync.getPendingOps()[0]).toMatchObject({ userId: 'guest-a', householdId: 'hh_guest_a' });
  });

  it('ignores legacy guest tokens and uses the server cookie with owner fencing', async () => {
    const client = await loadClient();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ success: true, token: 'guest-only-token', user: user('guest-a', 'house-guest') }))
      .mockResolvedValueOnce(json({ items: [] })));
    await client.auth.getState().setGuestSession();
    await client.api.getInventory();
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/v1/auth/guest', { method: 'POST', credentials: 'include' });
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/v1/inventory', expect.objectContaining({ credentials: 'include',
      headers: expect.objectContaining({
        'X-Frigo-Expected-User-Id': 'guest-a', 'X-Frigo-Expected-Household-Id': 'house-guest' }) }));
    expect(new Headers(vi.mocked(fetch).mock.calls[1][1]?.headers).has('Authorization')).toBe(false);
    expect(localStorage.getItem('frigo_token')).toBeNull();
    expect(sessionStorage.getItem('frigo_guest_token')).toBeNull();
  });

  it.each(['account', 'household'] as const)('invalidates projections and in-flight guards when another tab changes the %s', async (change) => {
    const client = await loadClient();
    signIn(client);
    seedPrivateState(client);
    const isCurrent = client.session.capturePrivateSession();
    const userId = change === 'account' ? 'user-b' : 'user-a';
    localStorage.setItem('frigo_user_id', userId);
    localStorage.setItem('frigo_household_id', 'house-b');
    localStorage.setItem('frigo_email', 'b@example.test');
    window.dispatchEvent(Object.assign(new Event('storage'), {
      key: change === 'account' ? 'frigo_user_id' : 'frigo_household_id',
    }));
    expect(isCurrent()).toBe(false);
    expect(client.auth.getState()).toMatchObject({ userId, householdId: 'house-b', email: 'b@example.test' });
    expect(client.week.getState().currentPlan).toBeNull();
    expect(client.scan.getState().imageBase64).toBeNull();
    expect(client.cooking.getState().activeRecipe).toBeNull();
    expect(client.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(() => client.session.privateCacheKey('inventory', 'house-a')).toThrow('active owner');
    vi.stubGlobal('fetch', vi.fn());
    await expect(client.api.retryPendingWrites()).resolves.toEqual({ attempted: 0, remaining: 1 });
    expect(client.sync.getPendingOps()).toEqual([expect.objectContaining({ userId: 'user-a', householdId: 'house-a' })]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
