// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MealPlanDto } from '../../packages/domain/src/meal-planning-api';
import { usePlanner } from '../../src/web/features/planner/usePlanner';
import { PlannerPage } from '../../src/web/pages/PlannerPage';
import { PlannerShopping } from '../../src/web/features/planner/PlannerShopping';
import { PlannerError } from '../../src/web/features/planner/PlannerShell';
import { mealPlanningApi } from '../../src/web/services/meal-planning';
import { queryClient } from '../../src/web/lib/query-client';
import { queryKeys } from '../../src/web/lib/queryKeys';
import { resetPrivateSession } from '../../src/web/lib/private-session';
import { hookInstant, hookPlan, hookPlanId, hookShopping, hookSlotId } from '../helpers/planner-hook-fixtures';

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLDivElement;
let model: ReturnType<typeof usePlanner>;
let storedPlan: MealPlanDto;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

function setOwner(userId = 'user-a', householdId = 'house-a') {
  localStorage.setItem('frigo_user_id', userId);
  localStorage.setItem('frigo_household_id', householdId);
}

function Probe({ shopping = false }: { shopping?: boolean }) {
  model = usePlanner(hookPlanId);
  return <>
    <output data-testid="revision">{model.plan?.revision ?? 'loading'}</output>
    <output data-testid="busy">{model.busy ?? 'idle'}</output>
    {!!model.error && <PlannerError error={model.error} locale="en" />}
    {model.refreshed && <p role="status">Latest revision loaded</p>}
    {shopping && model.plan && <PlannerShopping key={model.plan.revision} plan={model.plan} model={model} locale="en" />}
  </>;
}

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

async function flush() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
}

async function until(assertion: () => void) {
  const deadline = Date.now() + 1500;
  for (;;) {
    await flush();
    try { assertion(); return; }
    catch (failure) { if (Date.now() >= deadline) throw failure; }
  }
}

async function mount(node: ReactNode = <Probe />, path = `/planner/${hookPlanId}`) {
  root ??= createRoot(container);
  await act(async () => {
    root!.render(<QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {node}
      </MemoryRouter>
    </QueryClientProvider>);
  });
  await flush();
}

async function mountPage(path = '/planner') {
  await mount(<><LocationProbe /><Routes>
    <Route path="/planner" element={<PlannerPage />} />
    <Route path="/planner/new" element={<PlannerPage />} />
    <Route path="/planner/:planId" element={<PlannerPage />} />
    <Route path="/planner/:planId/meal/:slotId" element={<PlannerPage />} />
    <Route path="/planner/:planId/shopping" element={<PlannerPage />} />
  </Routes></>, path);
}

function button(text: string) {
  const found = [...container.querySelectorAll('button')].find((item) =>
    item.textContent?.trim() === text || item.getAttribute('aria-label') === text);
  expect(found, `button ${text}`).toBeTruthy();
  return found!;
}

async function click(text: string) {
  await act(async () => { button(text).click(); });
  await flush();
}

function mutation(action: 'swap' | 'regenerate') {
  const plan = model.plan!;
  return model.perform(action, () => action === 'swap'
    ? mealPlanningApi.swap(plan.id, { revision: plan.revision, slotId: hookSlotId,
      replacement: { kind: 'recipe', id: 'recipe-2' } })
    : mealPlanningApi.regenerate(plan.id, { revision: plan.revision }), model.replacePlan);
}

function shoppingKey(revision = 1) {
  return [...queryKeys.mealPlanningShopping(hookPlanId), revision, 'JPY', '', 'hard'];
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear(); sessionStorage.clear(); setOwner();
  localStorage.setItem('frigo_planner_locale', 'en');
  queryClient.clear(); storedPlan = hookPlan();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/current')) return response({ plan: storedPlan });
    if (url.endsWith('/shopping')) return response(hookShopping(storedPlan.revision));
    return response(storedPlan);
  });
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = undefined; queryClient.clear(); container.remove();
  vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe('mounted planner restoration', () => {
  it('shows loading then the generation entry when no current private plan exists', async () => {
    const pending = deferred<Response>(); fetchMock.mockReturnValueOnce(pending.promise);
    await mountPage();
    expect(container.textContent).toContain('Loading your plan');
    await act(async () => { pending.resolve(response({ plan: null })); });
    await until(() => expect(container.textContent).toContain('No plan for this account yet'));
    expect(container.querySelector('a[href="/planner/new"]')).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('restores the server current plan and restores again after a cache-free reload', async () => {
    await mountPage();
    await until(() => expect(container.textContent).toContain('Dinner revision 1'));
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(`/planner/${hookPlanId}`);
    await act(async () => { root!.unmount(); }); root = undefined;
    queryClient.clear(); storedPlan = hookPlan(2);
    await mountPage();
    await until(() => expect(container.textContent).toContain('Dinner revision 2'));
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/current'))).toHaveLength(2);
  });

  it('ignores stale local plan references and does not infer a current plan from them', async () => {
    localStorage.setItem('frigo_active_meal_plan', 'foreign-private-plan');
    fetchMock.mockResolvedValue(response({ plan: null }));
    await mountPage();
    expect(container.textContent).toContain('No plan for this account yet');
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(['/api/v1/meal-planning/plans/current']);
  });

  it.each([403, 404])('does not restore a private plan after HTTP %s', async (status) => {
    fetchMock.mockResolvedValue(response({ code: 'PLAN_NOT_FOUND', error: 'Private' }, status));
    await mountPage(`/planner/${hookPlanId}`);
    await until(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
    expect(container.textContent).not.toContain('Dinner revision 1');
    expect(queryClient.getQueryData(queryKeys.mealPlanningPlan(hookPlanId))).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not interpret a forbidden current-plan lookup as an empty plan', async () => {
    fetchMock.mockResolvedValueOnce(response({ code: 'ACCESS_DENIED', error: 'Private server detail' }, 403));
    await mountPage();
    await until(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
    expect(container.textContent).not.toContain('No plan for this account yet');
    expect(container.textContent).not.toContain('Private server detail');
    expect(queryClient.getQueryData(queryKeys.currentMealPlanningPlan())).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('an expired current-plan session clears private identity and cached plans instead of restoring data', async () => {
    const detailKey = queryKeys.mealPlanningPlan(hookPlanId);
    queryClient.setQueryData(detailKey, hookPlan());
    fetchMock.mockResolvedValueOnce(response({ error: 'Private server detail' }, 401));
    await mountPage();
    await until(() => expect(localStorage.getItem('frigo_user_id')).toBeNull());
    expect(localStorage.getItem('frigo_household_id')).toBeNull();
    expect(queryClient.getQueryData(detailKey)).toBeUndefined();
    expect(container.textContent).not.toContain('Dinner revision 1');
    expect(container.textContent).not.toContain('No plan for this account yet');
    expect(container.textContent).not.toContain('Private server detail');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid route IDs before making a request', async () => {
    await mountPage('/planner/not-a-uuid');
    await until(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed current-plan response rather than restoring it', async () => {
    fetchMock.mockResolvedValueOnce(response({ plan: { ...hookPlan(), revision: 0 } }));
    await mountPage();
    await until(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/planner');
    expect(container.textContent).not.toContain('Dinner revision 1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not restore the previous account current plan when the next account has none', async () => {
    await mountPage();
    await until(() => expect(container.textContent).toContain('Dinner revision 1'));
    await act(async () => { root!.unmount(); }); root = undefined;
    await act(async () => { setOwner('user-b', 'house-b'); resetPrivateSession(); });
    fetchMock.mockResolvedValueOnce(response({ plan: null }));
    await mountPage();
    await until(() => expect(container.textContent).toContain('No plan for this account yet'));
    expect(container.textContent).not.toContain('Dinner revision 1');
    expect(queryClient.getQueryData(queryKeys.currentMealPlanningPlan())).toBeNull();
  });
});

describe('mounted planner revision races', () => {
  it.each(['swap', 'regenerate'] as const)('%s cancels old in-flight detail and current reads before accepting the full revision', async (action) => {
    const oldGet = deferred<Response>(); const oldCurrent = deferred<Response>();
    queryClient.setQueryData(queryKeys.mealPlanningPlan(hookPlanId), hookPlan());
    queryClient.setQueryData(queryKeys.currentMealPlanningPlan(), hookPlan());
    queryClient.setQueryData(shoppingKey(), hookShopping());
    queryClient.setQueryData([...queryKeys.mealPlanningAlternatives(hookPlanId, hookSlotId), 1], { old: true });
    fetchMock.mockReturnValueOnce(oldGet.promise);
    await mount();
    fetchMock.mockReturnValueOnce(oldCurrent.promise);
    const currentRead = queryClient.fetchQuery({ queryKey: queryKeys.currentMealPlanningPlan(),
      queryFn: async () => (await mealPlanningApi.current()).plan }).catch(() => undefined);
    fetchMock.mockResolvedValueOnce(response(hookPlan(2)));
    await act(async () => { await mutation(action); });
    await until(() => expect(model.plan?.revision).toBe(2));
    expect(queryClient.getQueryData(shoppingKey())).toBeUndefined();
    expect(queryClient.getQueriesData({ queryKey: queryKeys.mealPlanningAlternativesForPlan(hookPlanId) })).toEqual([]);
    await act(async () => {
      oldGet.resolve(response(hookPlan())); oldCurrent.resolve(response({ plan: hookPlan() }));
      await currentRead;
    });
    await flush();
    expect(model.plan).toEqual(hookPlan(2));
    expect(queryClient.getQueryData(queryKeys.currentMealPlanningPlan())).toEqual(hookPlan(2));
    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect(JSON.parse(String(init?.body))).toMatchObject({ revision: 1 });
  });

  it.each(['swap', 'regenerate'] as const)('%s removes an in-flight shopping query so its late result cannot return', async (action) => {
    await mount();
    const pending = deferred<ReturnType<typeof hookShopping>>();
    const oldShopping = queryClient.fetchQuery({ queryKey: shoppingKey(), queryFn: () => pending.promise }).catch(() => undefined);
    fetchMock.mockResolvedValueOnce(response(hookPlan(2)));
    await act(async () => { await mutation(action); });
    await act(async () => { pending.resolve(hookShopping()); await oldShopping; });
    expect(queryClient.getQueryData(shoppingKey())).toBeUndefined();
    expect(queryClient.getQueryData(shoppingKey(2))).toBeUndefined();
    expect(model.plan?.revision).toBe(2);
  });

  it.each(['swap', 'regenerate'] as const)('%s clears rendered shopping and the next explicit request uses the new revision', async (action) => {
    await mount(<Probe shopping />);
    const currency = container.querySelector('select')!;
    await act(async () => { currency.value = 'JPY'; currency.dispatchEvent(new Event('change', { bubbles: true })); });
    await click('Prepare shopping list');
    await until(() => expect(container.querySelector('[data-testid="shopping-result"]')).not.toBeNull());
    expect(queryClient.getQueryData(shoppingKey())).toEqual(hookShopping());
    fetchMock.mockResolvedValueOnce(response(hookPlan(2)));
    await act(async () => { await mutation(action); });
    await until(() => expect(model.plan?.revision).toBe(2));
    expect(container.querySelector('[data-testid="shopping-result"]')).toBeNull();
    expect(queryClient.getQueryData(shoppingKey())).toBeUndefined();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/shopping'))).toHaveLength(1);
    fetchMock.mockResolvedValueOnce(response(hookShopping(2)));
    await click('Prepare shopping list');
    await until(() => expect(container.querySelector('[data-testid="shopping-result"]')).not.toBeNull());
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toMatchObject({ revision: 2 });
  });

  it('does not show late shopping results after a background plan revision changes', async () => {
    await mount(<Probe shopping />);
    const pending = deferred<Response>(); fetchMock.mockReturnValueOnce(pending.promise);
    await click('Prepare shopping list');
    expect(model.busy).toBe('shopping');
    await act(async () => { queryClient.setQueryData(queryKeys.mealPlanningPlan(hookPlanId), hookPlan(2)); });
    await flush();
    await act(async () => { pending.resolve(response(hookShopping())); });
    await until(() => expect(model.busy).toBeNull());
    expect(model.plan?.revision).toBe(2);
    expect(container.querySelector('[data-testid="shopping-result"]')).toBeNull();
    fetchMock.mockResolvedValueOnce(response(hookShopping(2)));
    await click('Prepare shopping list');
    await until(() => expect(container.querySelector('[data-testid="shopping-result"]')).not.toBeNull());
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toMatchObject({ revision: 2 });
  });

  it.each([
    ['infeasible', 422, 'SWAP_NOT_FEASIBLE'],
    ['API error', 503, 'UNAVAILABLE'],
    ['rate limited', 429, 'RATE_LIMITED'],
  ] as const)('a %s swap preserves the old authoritative plan without retrying', async (_label, status, code) => {
    await mount(); queryClient.setQueryData(shoppingKey(), hookShopping());
    fetchMock.mockResolvedValueOnce(response({ code, error: 'Rejected' }, status));
    await act(async () => { expect(await mutation('swap')).toBeUndefined(); });
    expect(model.plan).toEqual(hookPlan());
    expect(queryClient.getQueryData(shoppingKey())).toEqual(hookShopping());
    expect(model.busy).toBeNull(); expect(model.error).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toMatch(/HTTP \d{3}|SWAP_NOT_FEASIBLE|RATE_LIMITED/);
  });

  it('a network failure preserves the old plan and unlocks an explicit retry', async () => {
    await mount(); fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await act(async () => { await mutation('swap'); });
    expect(model.plan).toEqual(hookPlan()); expect(model.busy).toBeNull();
    fetchMock.mockResolvedValueOnce(response(hookPlan(2)));
    await act(async () => { await mutation('swap'); });
    expect(model.error).toBeNull(); expect(model.plan?.revision).toBe(2);
  });

  it.each(['PLAN_REVISION_CONFLICT', 'PLAN_REVALIDATION_REQUIRED'])('%s recovers the latest plan and discards all old derived caches', async (code) => {
    await mount();
    queryClient.setQueryData(queryKeys.currentMealPlanningPlan(), hookPlan());
    queryClient.setQueryData(shoppingKey(), hookShopping());
    const alternatives = [...queryKeys.mealPlanningAlternatives(hookPlanId, hookSlotId), 1];
    queryClient.setQueryData(alternatives, { old: true });
    const latest = hookPlan(2);
    latest.freshness.status = 'requires_revalidation'; latest.freshness.reasons = ['stale_inventory'];
    fetchMock.mockResolvedValueOnce(response({ code, error: '409 Conflict' }, 409))
      .mockResolvedValueOnce(response(latest));
    await act(async () => { await mutation('swap'); });
    await until(() => expect(model.refreshed).toBe(true));
    expect(model.plan).toEqual(latest);
    expect(queryClient.getQueryData(queryKeys.currentMealPlanningPlan())).toEqual(latest);
    expect(queryClient.getQueryData(shoppingKey())).toBeUndefined();
    expect(queryClient.getQueryData(alternatives)).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(container.textContent).not.toContain('409 Conflict');
  });

  it('does not claim a refresh succeeded when conflict recovery fails with cached data', async () => {
    await mount();
    const alternatives = [...queryKeys.mealPlanningAlternatives(hookPlanId, hookSlotId), 1];
    queryClient.setQueryData(shoppingKey(), hookShopping());
    queryClient.setQueryData(alternatives, { old: true });
    fetchMock.mockResolvedValueOnce(response({ code: 'PLAN_REVISION_CONFLICT' }, 409))
      .mockResolvedValueOnce(response({ error: 'Unavailable' }, 503));
    await act(async () => { await mutation('regenerate'); });
    expect(model.plan).toEqual(hookPlan());
    expect(model.refreshed).toBe(false);
    expect(model.busy).toBeNull();
    expect(model.error).toBeTruthy();
    expect(queryClient.getQueryData(shoppingKey())).toBeUndefined();
    expect(queryClient.getQueryData(alternatives)).toBeUndefined();
    expect(container.textContent).not.toContain('Latest revision loaded');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('conflict recovery cancels a pending current lookup and alternatives before installing its revision', async () => {
    await mount();
    const oldCurrent = deferred<MealPlanDto>();
    const oldAlternatives = deferred<{ old: boolean }>();
    const alternatives = [...queryKeys.mealPlanningAlternatives(hookPlanId, hookSlotId), 1];
    const currentRead = queryClient.fetchQuery({ queryKey: queryKeys.currentMealPlanningPlan(),
      queryFn: () => oldCurrent.promise }).catch(() => undefined);
    const alternativesRead = queryClient.fetchQuery({ queryKey: alternatives,
      queryFn: () => oldAlternatives.promise }).catch(() => undefined);
    fetchMock.mockResolvedValueOnce(response({ code: 'PLAN_REVISION_CONFLICT' }, 409))
      .mockResolvedValueOnce(response(hookPlan(2)));
    await act(async () => { await mutation('swap'); });
    await act(async () => {
      oldCurrent.resolve(hookPlan()); oldAlternatives.resolve({ old: true });
      await Promise.all([currentRead, alternativesRead]);
    });
    expect(model.plan).toEqual(hookPlan(2));
    expect(queryClient.getQueryData(queryKeys.currentMealPlanningPlan())).toEqual(hookPlan(2));
    expect(queryClient.getQueryData(alternatives)).toBeUndefined();
    expect(model.refreshed).toBe(true);
  });
});

describe('mounted planner session fencing', () => {
  it('clears mutation retry identity and local error state on private-session reset', async () => {
    await mount();
    const intent = { revision: 1, slotId: hookSlotId, type: 'liked' };
    const key = model.requestKey(intent);
    expect(model.requestKey(intent)).toBe(key);
    fetchMock.mockResolvedValueOnce(response({ error: 'Unavailable' }, 503));
    await act(async () => { await mutation('swap'); });
    expect(model.error).toBeTruthy();
    await act(async () => { resetPrivateSession(); });
    await flush();
    expect(model.error).toBeNull();
    expect(model.requestKey(intent)).not.toBe(key);
  });

  it('isolates cached and in-flight plans when the user and household change', async () => {
    const oldGet = deferred<Response>(); fetchMock.mockReturnValueOnce(oldGet.promise);
    queryClient.setQueryData(queryKeys.mealPlanningPlan(hookPlanId), hookPlan());
    await mount();
    const nextGet = deferred<Response>(); fetchMock.mockReturnValueOnce(nextGet.promise);
    await act(async () => { setOwner('user-b', 'house-b'); resetPrivateSession(); });
    await mount();
    expect(model.plan).toBeUndefined();
    await act(async () => { oldGet.resolve(response(hookPlan())); });
    await flush(); expect(model.plan).toBeUndefined();
    await act(async () => { nextGet.resolve(response(hookPlan(3, 'house-b'))); });
    await until(() => expect(model.plan?.householdId).toBe('house-b'));
    expect(queryClient.getQueryData(['mealPlanningPlan', 'user-a', 'house-a', hookPlanId])).toBeUndefined();
  });

  it.each(['swap', 'regenerate'] as const)('a pending old-session %s neither leaks its revision nor blocks the next session', async (action) => {
    await mount();
    const pending = deferred<Response>(); fetchMock.mockReturnValueOnce(pending.promise);
    let oldMutation!: Promise<MealPlanDto | undefined>;
    await act(async () => { oldMutation = mutation(action); });
    expect(model.busy).toBe(action);
    storedPlan = hookPlan(3, 'house-b');
    await act(async () => { setOwner('user-b', 'house-b'); resetPrivateSession(); });
    await mount();
    await until(() => expect(model.plan?.householdId).toBe('house-b'));
    expect(model.busy).toBeNull();
    const newPending = deferred<Response>(); fetchMock.mockReturnValueOnce(newPending.promise);
    let newMutation!: Promise<MealPlanDto | undefined>;
    await act(async () => { newMutation = mutation('regenerate'); });
    expect(model.busy).toBe('regenerate');
    await act(async () => { pending.resolve(response(hookPlan(2))); await oldMutation; });
    expect(model.busy).toBe('regenerate');
    const duplicate = vi.fn(async () => storedPlan);
    await act(async () => { await model.perform('duplicate', duplicate); });
    expect(duplicate).not.toHaveBeenCalled();
    await act(async () => { newPending.resolve(response(hookPlan(4, 'house-b'))); await newMutation; });
    expect(model.busy).toBeNull(); expect(model.plan).toEqual(hookPlan(4, 'house-b'));
    expect(queryClient.getQueryData(queryKeys.currentMealPlanningPlan())).toEqual(hookPlan(4, 'house-b'));
  });

  it('does not leak errors or a recovery result after the session changes during 409 recovery', async () => {
    await mount();
    const recovery = deferred<Response>();
    fetchMock.mockResolvedValueOnce(response({ code: 'PLAN_REVISION_CONFLICT' }, 409))
      .mockReturnValueOnce(recovery.promise);
    let pending!: Promise<MealPlanDto | undefined>;
    await act(async () => { pending = mutation('swap'); });
    await until(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    storedPlan = hookPlan(3, 'house-b');
    await act(async () => { setOwner('user-b', 'house-b'); resetPrivateSession(); });
    await mount();
    await until(() => expect(model.plan?.householdId).toBe('house-b'));
    expect(model.error).toBeNull(); expect(model.busy).toBeNull();
    await act(async () => { recovery.resolve(response(hookPlan(2))); await pending; });
    expect(model.refreshed).toBe(false); expect(model.plan?.revision).toBe(3);
    expect(queryClient.getQueryData(queryKeys.currentMealPlanningPlan())).toBeUndefined();
  });

  it.each([
    ['different member in the same household', 'user-b', 'house-a'],
    ['same member in a different household', 'user-a', 'house-b'],
  ])('discards pending shopping for a %s', async (_label, userId, householdId) => {
    await mount(<Probe shopping />);
    const oldKey = [...queryKeys.mealPlanningShopping(hookPlanId), 1, 'VND', '', 'hard'];
    const pending = deferred<Response>(); fetchMock.mockReturnValueOnce(pending.promise);
    await click('Prepare shopping list');
    expect(model.busy).toBe('shopping');
    storedPlan = hookPlan(3, householdId);
    await act(async () => { setOwner(userId, householdId); resetPrivateSession(); });
    await mount(<Probe shopping />);
    await until(() => expect(model.plan?.revision).toBe(3));
    await act(async () => { pending.resolve(response(hookShopping())); });
    await flush();
    expect(model.error).toBeNull();
    expect(model.busy).toBeNull();
    expect(container.querySelector('[data-testid="shopping-result"]')).toBeNull();
    expect(queryClient.getQueryData(oldKey)).toBeUndefined();
    expect(queryClient.getQueriesData({ queryKey: queryKeys.mealPlanningShopping(hookPlanId) })
      .every(([, data]) => data === undefined)).toBe(true);
  });

  it('a response from an unmounted planner cannot overwrite the newly mounted revision', async () => {
    await mount();
    const pending = deferred<Response>(); fetchMock.mockReturnValueOnce(pending.promise);
    let oldMutation!: Promise<MealPlanDto | undefined>;
    await act(async () => { oldMutation = mutation('swap'); });
    await act(async () => { root!.unmount(); }); root = undefined;
    storedPlan = hookPlan(3);
    queryClient.setQueryData(queryKeys.mealPlanningPlan(hookPlanId), storedPlan);
    await mount();
    await act(async () => { pending.resolve(response(hookPlan(2))); await oldMutation; });
    expect(model.plan).toEqual(storedPlan);
    expect(model.busy).toBeNull();
    expect(queryClient.getQueryData(queryKeys.currentMealPlanningPlan())).toBeUndefined();
  });
});

describe('mounted planner generation interactions', () => {
  it('successful creation retires its retry key before a new creation with identical intent', async () => {
    await mountPage('/planner/new');
    expect(fetchMock).not.toHaveBeenCalled();
    await click('Generate plan');
    await until(() => expect(container.textContent).toContain('Dinner revision 1'));
    expect(queryClient.getQueryData(queryKeys.currentMealPlanningPlan())).toEqual(storedPlan);
    const newPlanLink = container.querySelector<HTMLAnchorElement>('a[href="/planner/new"]');
    expect(newPlanLink).not.toBeNull();
    await act(async () => { newPlanLink!.click(); });
    await until(() => expect(container.querySelector('form')).not.toBeNull());
    storedPlan = { ...hookPlan(), id: '8195b083-ddb7-462d-90c3-1e3c83cbb59c' };
    await click('Generate plan');
    await until(() => expect(container.querySelector('[data-testid="location"]')?.textContent)
      .toBe(`/planner/${storedPlan.id}`));
    const creations = fetchMock.mock.calls.filter(([url]) => String(url) === '/api/v1/meal-planning/plans');
    expect(creations).toHaveLength(2);
    expect(creations[0][1]?.body).toBe(creations[1][1]?.body);
    const firstKey = new Headers(creations[0][1]?.headers).get('Idempotency-Key');
    const secondKey = new Headers(creations[1][1]?.headers).get('Idempotency-Key');
    expect(firstKey).toBeTruthy(); expect(secondKey).toBeTruthy();
    expect(secondKey).not.toBe(firstKey);
    expect(queryClient.getQueryData(queryKeys.currentMealPlanningPlan())).toEqual(storedPlan);
  });

  it('a failed creation retains its retry key and a pending retry suppresses duplicate submissions', async () => {
    await mountPage('/planner/new');
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await click('Generate plan');
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(button('Generate plan').disabled).toBe(false);
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/planner/new');
    const pending = deferred<Response>(); fetchMock.mockReturnValueOnce(pending.promise);
    const form = container.querySelector('form')!;
    const submit = button('Generate plan');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(submit.disabled).toBe(true);
    expect(container.textContent).toContain('Takosan is planning from your data');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstKey = new Headers(fetchMock.mock.calls[0][1]?.headers).get('Idempotency-Key');
    expect(firstKey).toBeTruthy();
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('Idempotency-Key')).toBe(firstKey);
    expect(fetchMock.mock.calls[1][1]?.body).toBe(fetchMock.mock.calls[0][1]?.body);
    await act(async () => { pending.resolve(response(storedPlan)); });
    await until(() => expect(container.textContent).toContain('Dinner revision 1'));
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('rate-limited creation remains on setup with a safe message and no automatic retries', async () => {
    await mountPage('/planner/new');
    fetchMock.mockResolvedValueOnce(response({ code: 'RATE_LIMITED', error: 'Internal quota details' }, 429));
    await click('Generate plan');
    expect(container.textContent).toContain('Too many requests');
    expect(container.textContent).not.toContain('Internal quota details');
    expect(button('Generate plan').disabled).toBe(false);
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/planner/new');
    expect(queryClient.getQueryData(queryKeys.currentMealPlanningPlan())).toBeUndefined();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('an old-session creation cannot navigate to its private plan or unlock the next creation', async () => {
    await mountPage('/planner/new');
    const oldCreation = deferred<Response>(); fetchMock.mockReturnValueOnce(oldCreation.promise);
    await click('Generate plan');
    storedPlan = { ...hookPlan(1, 'house-b'), id: '8195b083-ddb7-462d-90c3-1e3c83cbb59c' };
    await act(async () => { setOwner('user-b', 'house-b'); resetPrivateSession(); });
    await mountPage('/planner/new');
    expect(button('Generate plan').disabled).toBe(false);
    const newCreation = deferred<Response>(); fetchMock.mockReturnValueOnce(newCreation.promise);
    const submit = button('Generate plan');
    await click('Generate plan');
    await act(async () => { oldCreation.resolve(response(hookPlan())); });
    await flush();
    expect(submit.disabled).toBe(true);
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/planner/new');
    expect(queryClient.getQueryData(queryKeys.currentMealPlanningPlan())).toBeUndefined();
    await act(async () => { newCreation.resolve(response(storedPlan)); });
    await until(() => expect(container.querySelector('[data-testid="location"]')?.textContent)
      .toBe(`/planner/${storedPlan.id}`));
    expect(queryClient.getQueryData(queryKeys.currentMealPlanningPlan())).toEqual(storedPlan);
    expect(queryClient.getQueryData(['mealPlanningPlan', 'user-a', 'house-a', hookPlanId])).toBeUndefined();
    const creations = fetchMock.mock.calls.filter(([url]) => String(url) === '/api/v1/meal-planning/plans');
    expect(creations).toHaveLength(2);
    expect(new Headers(creations[1][1]?.headers).get('Idempotency-Key'))
      .not.toBe(new Headers(creations[0][1]?.headers).get('Idempotency-Key'));
  });
});

describe('mounted planner mutation interactions', () => {
  it('a new generation after success and week-to-new navigation uses a fresh key for the same defaults', async () => {
    const secondId = '39519570-9d5a-49ea-b652-4b406a2b4a70';
    const generated = new Map<string, MealPlanDto>();
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input) === '/api/v1/meal-planning/plans' && init?.method === 'POST') {
        const key = new Headers(init.headers).get('Idempotency-Key')!;
        if (!generated.has(key)) generated.set(key, { ...hookPlan(), id: generated.size ? secondId : hookPlanId });
        storedPlan = generated.get(key)!;
      }
      return response(String(input).endsWith('/current') ? { plan: storedPlan } : storedPlan);
    });
    await mountPage('/planner/new');
    await click('Generate plan');
    await until(() => expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(`/planner/${hookPlanId}`));
    await act(async () => { container.querySelector<HTMLAnchorElement>('a[href="/planner/new"]')!.click(); });
    await until(() => expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/planner/new'));
    await click('Generate plan');
    const calls = fetchMock.mock.calls.filter(([url, init]) => String(url) === '/api/v1/meal-planning/plans' && init?.method === 'POST');
    expect(calls).toHaveLength(2);
    expect(calls[1][1]?.body).toBe(calls[0][1]?.body);
    const firstKey = new Headers(calls[0][1]?.headers).get('Idempotency-Key');
    const secondKey = new Headers(calls[1][1]?.headers).get('Idempotency-Key');
    expect(firstKey).toBeTruthy(); expect(secondKey).toBeTruthy();
    expect(secondKey).not.toBe(firstKey);
    await until(() => expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(`/planner/${secondId}`));
    expect(generated.size).toBe(2);
  });

  it.each(['network failure', 'lost response after server creation'] as const)(
    'an explicit generation retry after %s retains its key and exact intent', async (failure) => {
      const generated = new Map<string, MealPlanDto>();
      let attempts = 0;
      fetchMock.mockImplementation(async (input, init) => {
        if (String(input) === '/api/v1/meal-planning/plans' && init?.method === 'POST') {
          attempts++;
          const key = new Headers(init.headers).get('Idempotency-Key')!;
          if (attempts === 1 && failure === 'network failure') throw new TypeError('offline');
          if (!generated.has(key)) generated.set(key, hookPlan());
          storedPlan = generated.get(key)!;
          if (attempts === 1) throw new TypeError('response connection lost');
        }
        return response(String(input).endsWith('/current') ? { plan: storedPlan } : storedPlan);
      });
      await mountPage('/planner/new');
      await click('Generate plan');
      await until(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
      expect(button('Generate plan').disabled).toBe(false);
      expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/planner/new');
      await flush(); expect(attempts).toBe(1);
      await click('Generate plan');
      await until(() => expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(`/planner/${hookPlanId}`));
      const calls = fetchMock.mock.calls.filter(([url, init]) => String(url) === '/api/v1/meal-planning/plans' && init?.method === 'POST');
      expect(calls).toHaveLength(2);
      const firstKey = new Headers(calls[0][1]?.headers).get('Idempotency-Key');
      expect(firstKey).toBeTruthy();
      expect(new Headers(calls[1][1]?.headers).get('Idempotency-Key')).toBe(firstKey);
      expect(calls[1][1]?.body).toBe(calls[0][1]?.body);
      expect(generated.size).toBe(1);
      expect(container.querySelector('[role="alert"]')).toBeNull();
    },
  );

  it('regenerate confirms once, rejects duplicate clicks, then replaces the full revision and shopping', async () => {
    await mountPage(`/planner/${hookPlanId}`);
    await until(() => expect(container.textContent).toContain('Dinner revision 1'));
    queryClient.setQueryData(shoppingKey(), hookShopping());
    await click('Regenerate plan');
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();
    const pending = deferred<Response>(); fetchMock.mockReturnValueOnce(pending.promise);
    const confirm = button('Regenerate');
    await act(async () => { confirm.click(); confirm.click(); });
    await until(() => expect(container.textContent).toContain('Takosan is planning from your data'));
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/regenerate'))).toHaveLength(1);
    expect(button('Regenerate plan').disabled).toBe(true);
    await act(async () => { pending.resolve(response(hookPlan(2))); });
    await until(() => expect(container.textContent).toContain('Dinner revision 2'));
    expect(container.textContent).not.toContain('Dinner revision 1');
    expect(queryClient.getQueryData(shoppingKey())).toBeUndefined();
  });

  it('canceling regenerate keeps the usable plan without submitting', async () => {
    await mountPage(`/planner/${hookPlanId}`);
    await click('Regenerate plan'); await click('Cancel');
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(container.textContent).toContain('Dinner revision 1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a rate-limited regeneration shows a safe message without retrying or replacing the usable plan', async () => {
    await mountPage(`/planner/${hookPlanId}`);
    await click('Regenerate plan');
    fetchMock.mockResolvedValueOnce(response({ code: 'RATE_LIMITED', error: 'Internal limiter details' }, 429));
    await click('Regenerate');
    await until(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
    expect(container.textContent).toContain('Too many requests');
    expect(container.textContent).toContain('Dinner revision 1');
    expect(container.textContent).not.toContain('Internal limiter details');
    expect(button('Regenerate plan').disabled).toBe(false);
    await flush();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/regenerate'))).toHaveLength(1);
  });

  it.each(['liked', 'disliked', 'cooked', 'skipped'] as const)('records %s through a revision-fenced receipt without claiming inventory mutation', async (type) => {
    await mountPage(`/planner/${hookPlanId}/meal/${encodeURIComponent(hookSlotId)}`);
    const labels = { liked: 'Like', disliked: 'Dislike', cooked: 'Mark cooked', skipped: 'Skip' };
    fetchMock.mockResolvedValueOnce(response({ schemaVersion: 1, id: 'receipt', planId: hookPlanId,
      planRevision: 1, slotId: hookSlotId, type, occurredAt: hookInstant, inventoryMutated: false }));
    await click(labels[type]);
    await until(() => expect(button(`Recorded: ${labels[type]}`).disabled).toBe(true));
    const feedback = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/feedback'))!;
    expect(JSON.parse(String(feedback[1]?.body))).toEqual({ revision: 1, slotId: hookSlotId, type });
    expect(container.textContent).toContain('An annotation only. No ingredients are deducted');
    expect(container.textContent).not.toMatch(/Inventory updated|Inventory deducted|Stock updated/);
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith('/api/v1/meal-planning/plans/'))).toBe(true);
  });

  it('failed feedback stays unrecorded and an explicit exact retry reuses its idempotency key', async () => {
    await mountPage(`/planner/${hookPlanId}/meal/${encodeURIComponent(hookSlotId)}`);
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await click('Like');
    expect(button('Like').disabled).toBe(false);
    expect(container.textContent).not.toContain('Recorded: Like');
    fetchMock.mockResolvedValueOnce(response({ schemaVersion: 1, id: 'receipt', planId: hookPlanId,
      planRevision: 1, slotId: hookSlotId, type: 'liked', occurredAt: hookInstant, inventoryMutated: false }));
    await click('Like');
    await until(() => expect(button('Recorded: Like').disabled).toBe(true));
    const calls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/feedback'));
    expect(calls).toHaveLength(2);
    const firstKey = new Headers(calls[0][1]?.headers).get('Idempotency-Key');
    expect(firstKey).toBeTruthy();
    expect(new Headers(calls[1][1]?.headers).get('Idempotency-Key')).toBe(firstKey);
    expect(calls[1][1]?.body).toBe(calls[0][1]?.body);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
