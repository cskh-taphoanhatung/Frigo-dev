// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IngredientDetailPage } from '../../src/web/pages/IngredientDetailPage';
import { ApiError } from '../../src/web/services/http';
import type { InventoryLotDetail } from '../../src/web/services/inventory-truth';

// T13R-A P1-3 (review P1-3): an edit draft is bound to the lot it was opened
// for. A same-component route change (chicken → tofu) must never let the
// chicken draft be submitted against tofu, whatever the timing of the
// underlying reads.

const mocks = vi.hoisted(() => ({
  getLot: vi.fn(), getInventory: vi.fn(), update: vi.fn(), invalidate: vi.fn(),
}));
vi.mock('../../src/web/services/api', async () => ({
  ApiError: (await import('../../src/web/services/http')).ApiError,
  api: { getInventoryLot: mocks.getLot, getInventory: mocks.getInventory, updateInventoryItem: mocks.update },
}));
vi.mock('../../src/web/lib/query-invalidation', () => ({ invalidateInventoryDependents: mocks.invalidate }));
vi.mock('../../src/web/components/common/TopBar', () => ({ TopBar: ({ title }: { title?: string }) => <h1>{title}</h1> }));

const lot = (id: 'chicken' | 'tofu', changes: Partial<InventoryLotDetail> = {}): InventoryLotDetail => ({
  id: `projection-${id}`, lotId: `lot-${id}`, legacyItemId: `projection-${id}`,
  name: id === 'chicken' ? 'Ức gà' : 'Đậu phụ', ingredientId: id === 'chicken' ? 'CHICKEN_BREAST' : 'TOFU',
  category: id === 'chicken' ? 'meat' : 'other', quantity: id === 'chicken' ? 300 : 2, unit: id === 'chicken' ? 'g' : 'piece',
  quantityMilli: id === 'chicken' ? 300000 : 2000, canonicalUnit: id === 'chicken' ? 'g' : 'piece',
  storage: 'fridge', storageLocationId: 'location-1', state: 'ACTIVE', freshness: 'fresh',
  expiryKind: 'UNKNOWN', expiryAt: null, estimatedExpiryAt: null, openedAt: null, purchasedAt: null,
  sourceType: 'MANUAL', dataSource: 'manual', sourceId: null, lotVersion: id === 'chicken' ? 7 : 3, version: id === 'chicken' ? 7 : 3,
  inventoryVersion: 5, createdAt: '2026-09-11T00:00:00Z', updatedAt: '2026-09-11T00:00:00Z', ...changes,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function Navigation() {
  const navigate = useNavigate();
  return (
    <nav>
      <button onClick={() => navigate('/ingredients/projection-chicken')}>Mở gà</button>
      <button onClick={() => navigate('/ingredients/projection-tofu')}>Mở đậu</button>
      <button onClick={() => navigate(-1)}>Lùi</button>
      <button onClick={() => navigate(1)}>Tiến</button>
    </nav>
  );
}

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;

async function flush() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
}
async function until(assertion: () => void) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await flush();
    try { assertion(); return; } catch (error) { if (attempt === 99) throw error; }
  }
}
function find<T = HTMLElement>(selector: string): T {
  const element = container.querySelector(selector);
  expect(element, selector).not.toBeNull();
  return element as T;
}
function button(label: string) {
  const element = [...container.querySelectorAll('button')].find((entry) => entry.textContent?.trim() === label);
  expect(element, label).toBeDefined();
  return element!;
}
async function click(label: string) {
  await act(async () => button(label).click());
  await flush();
}
async function fillInput(selector: string, value: string) {
  const input = find<HTMLInputElement>(selector);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function mount(route = '/ingredients/projection-chicken') {
  root = createRoot(container);
  await act(async () => root.render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Navigation />
        <Routes>
          <Route path="/ingredients/:id" element={<IngredientDetailPage />} />
          <Route path="/fridge" element={<p>FRIDGE_ROUTE</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  ));
}
const heading = () => find('h3').textContent;
const editing = () => container.querySelector('#lot-name-input') !== null;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.getLot.mockReset().mockImplementation(async (id: string) => lot(id.endsWith('tofu') ? 'tofu' : 'chicken'));
  mocks.getInventory.mockReset().mockResolvedValue([]);
  mocks.update.mockReset().mockResolvedValue({ success: true });
  mocks.invalidate.mockReset().mockResolvedValue(undefined);
  localStorage.clear();
  localStorage.setItem('frigo_user_id', 'draft-user');
  localStorage.setItem('frigo_household_id', 'draft-household');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('T13R-A P1-3 lot-bound edit drafts', () => {
  it('chicken draft → route to tofu → save never PATCHes tofu (A→B)', async () => {
    await mount();
    await until(() => expect(heading()).toBe('Ức gà'));
    await click('Sửa thông tin nguyên liệu');
    await fillInput('#lot-name-input', 'Ức gà nhà mua');
    await click('Mở đậu');
    await until(() => expect(heading()).toBe('Đậu phụ'));
    // The chicken draft is gone: tofu shows its own read-only detail.
    expect(editing()).toBe(false);
    expect(container.textContent).not.toContain('Ức gà nhà mua');
    await click('Sửa thông tin nguyên liệu');
    expect(find<HTMLInputElement>('#lot-name-input').value).toBe('Đậu phụ');
    await fillInput('#lot-name-input', 'Đậu phụ non');
    await click('Lưu thay đổi');
    await until(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith('projection-tofu', { name: 'Đậu phụ non' }, 3);
  });

  it('B→A and back/forward reinitialise the draft, baseline and error state for the current lot', async () => {
    await mount('/ingredients/projection-tofu');
    await until(() => expect(heading()).toBe('Đậu phụ'));
    await click('Sửa thông tin nguyên liệu');
    mocks.update.mockRejectedValueOnce(new ApiError('http', 'HTTP 422: {"code":"UNIT_MISMATCH"}', 422));
    await fillInput('#lot-name-input', 'Đậu phụ chiên');
    await click('Lưu thay đổi');
    await until(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
    await click('Mở gà');
    await until(() => expect(heading()).toBe('Ức gà'));
    expect(editing()).toBe(false);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await click('Sửa thông tin nguyên liệu');
    expect(find<HTMLInputElement>('#lot-name-input').value).toBe('Ức gà');
    await fillInput('#lot-name-input', 'Ức gà đã kiểm tra');
    await click('Lùi');
    await until(() => expect(heading()).toBe('Đậu phụ'));
    expect(editing()).toBe(false);
    expect(container.textContent).not.toContain('Ức gà đã kiểm tra');
    await click('Tiến');
    await until(() => expect(heading()).toBe('Ức gà'));
    expect(editing()).toBe(false);
    await click('Sửa thông tin nguyên liệu');
    expect(find<HTMLInputElement>('#lot-name-input').value).toBe('Ức gà');
    await click('Lưu thay đổi');
    // Only the earlier tofu attempt ever reached the API.
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith('projection-tofu', { name: 'Đậu phụ chiên' }, 3);
  });

  it('a slow chicken response arriving after the route moved to tofu cannot resurrect the chicken draft or target', async () => {
    const slowChicken = deferred<InventoryLotDetail>();
    mocks.getLot.mockImplementation((id: string) => id.endsWith('tofu') ? Promise.resolve(lot('tofu')) : slowChicken.promise);
    await mount();
    await flush();
    expect(container.textContent).toContain('Đang tải nguyên liệu');
    await click('Mở đậu');
    await until(() => expect(heading()).toBe('Đậu phụ'));
    await click('Sửa thông tin nguyên liệu');
    await fillInput('#lot-name-input', 'Đậu phụ non');
    await act(async () => { slowChicken.resolve(lot('chicken')); });
    await flush();
    // Still tofu, still the tofu draft.
    expect(heading()).toBe('Đậu phụ');
    expect(find<HTMLInputElement>('#lot-name-input').value).toBe('Đậu phụ non');
    await click('Lưu thay đổi');
    await until(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith('projection-tofu', { name: 'Đậu phụ non' }, 3);
  });

  it('a route change during a refetch drops the in-flight draft instead of saving it elsewhere', async () => {
    await mount();
    await until(() => expect(heading()).toBe('Ức gà'));
    await click('Sửa thông tin nguyên liệu');
    await fillInput('#lot-name-input', 'Ức gà nhà mua');
    const slowChicken = deferred<InventoryLotDetail>();
    mocks.getLot.mockImplementation((id: string) => id.endsWith('tofu') ? Promise.resolve(lot('tofu')) : slowChicken.promise);
    void client.refetchQueries({ queryKey: ['inventory'] });
    await flush();
    await click('Mở đậu');
    await until(() => expect(heading()).toBe('Đậu phụ'));
    expect(editing()).toBe(false);
    await act(async () => { slowChicken.resolve(lot('chicken', { version: 8, lotVersion: 8 })); });
    await flush();
    expect(heading()).toBe('Đậu phụ');
    expect(editing()).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('a save in flight when the route moves to tofu completes only against chicken and leaks nothing into tofu', async () => {
    await mount();
    await until(() => expect(heading()).toBe('Ức gà'));
    await click('Sửa thông tin nguyên liệu');
    await fillInput('#lot-name-input', 'Ức gà nhà mua');
    const slowSave = deferred<{ success: boolean }>();
    mocks.update.mockImplementationOnce(() => slowSave.promise);
    await click('Lưu thay đổi');
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith('projection-chicken', { name: 'Ức gà nhà mua' }, 7);
    await click('Mở đậu');
    await until(() => expect(heading()).toBe('Đậu phụ'));
    expect(editing()).toBe(false);
    await act(async () => { slowSave.resolve({ success: true }); });
    await flush();
    // The completed chicken save neither re-targets tofu nor reopens a draft here.
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(heading()).toBe('Đậu phụ');
    expect(editing()).toBe(false);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('the form advertises the lot that owns its draft', async () => {
    await mount();
    await until(() => expect(heading()).toBe('Ức gà'));
    await click('Sửa thông tin nguyên liệu');
    expect(find('form').getAttribute('data-draft-owner')).toBe('projection-chicken');
    await click('Hủy');
    expect(editing()).toBe(false);
    await click('Mở đậu');
    await until(() => expect(heading()).toBe('Đậu phụ'));
    await click('Sửa thông tin nguyên liệu');
    expect(find('form').getAttribute('data-draft-owner')).toBe('projection-tofu');
  });

  it('a normal edit on the same lot still saves against that lot and its current version', async () => {
    await mount();
    await until(() => expect(heading()).toBe('Ức gà'));
    await click('Sửa thông tin nguyên liệu');
    await fillInput('#lot-name-input', 'Ức gà nhà mua');
    mocks.getLot.mockResolvedValue(lot('chicken', { name: 'Ức gà nhà mua', version: 8, lotVersion: 8 }));
    await click('Lưu thay đổi');
    await until(() => expect(heading()).toBe('Ức gà nhà mua'));
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith('projection-chicken', { name: 'Ức gà nhà mua' }, 7);
    expect(editing()).toBe(false);
  });
});
