// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IngredientDetailPage } from '../../src/web/pages/IngredientDetailPage';
import { ApiError } from '../../src/web/services/http';
import type { InventoryLotDetail } from '../../src/web/services/inventory-truth';

const mocks = vi.hoisted(() => ({
  getLot: vi.fn(), getInventory: vi.fn(), update: vi.fn(), invalidate: vi.fn(), navigate: vi.fn(),
}));
vi.mock('../../src/web/services/api', async () => ({
  ApiError: (await import('../../src/web/services/http')).ApiError,
  api: { getInventoryLot: mocks.getLot, getInventory: mocks.getInventory, updateInventoryItem: mocks.update },
}));
vi.mock('../../src/web/lib/query-invalidation', () => ({ invalidateInventoryDependents: mocks.invalidate }));
vi.mock('../../src/web/components/common/TopBar', () => ({ TopBar: () => <h1>Chi tiết nguyên liệu</h1> }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'lot-1' }), useNavigate: () => mocks.navigate }));

const NOW = Date.parse('2026-09-13T00:00:00Z');
const lot = (changes: Partial<InventoryLotDetail> = {}): InventoryLotDetail => ({
  id: 'projection-1', lotId: 'lot-1', legacyItemId: 'projection-1', name: 'Cà chua', ingredientId: 'TOMATO',
  category: 'vegetable', quantity: 2, unit: 'piece', quantityMilli: 2000, canonicalUnit: 'piece',
  storage: 'fridge', storageLocationId: 'location-1', state: 'ACTIVE', freshness: 'fresh',
  expiryKind: 'UNKNOWN', expiryAt: null, estimatedExpiryAt: null, openedAt: null, purchasedAt: null,
  sourceType: 'RECEIPT', dataSource: 'receipt', sourceId: 'receipt-1', lotVersion: 7, version: 7,
  inventoryVersion: 3, createdAt: '2026-09-11T00:00:00Z', updatedAt: '2026-09-11T00:00:00Z', ...changes,
});

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
function headerText() {
  return find('h3').parentElement!.textContent;
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
async function fillExpiry(value: string) {
  await fillInput('#lot-expiry-input', value);
}
async function select(selector: string, value: string) {
  const input = find<HTMLSelectElement>(selector);
  await act(async () => {
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
async function mount(value = lot()) {
  mocks.getLot.mockResolvedValue(value);
  await act(async () => root.render(<QueryClientProvider client={client}><IngredientDetailPage /></QueryClientProvider>));
  await until(() => expect(container.querySelector('[data-testid="lot-expiry"]')).not.toBeNull());
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  mocks.getLot.mockReset();
  mocks.getInventory.mockReset().mockResolvedValue([]);
  mocks.update.mockReset().mockResolvedValue({ success: true });
  mocks.invalidate.mockReset().mockResolvedValue(undefined);
  localStorage.clear();
  localStorage.setItem('frigo_user_id', 'detail-user');
  localStorage.setItem('frigo_household_id', 'detail-household');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('T13B ingredient detail expiry truth', () => {
  it('UNKNOWN never shows Tươi ngon despite the compatibility freshness field saying fresh', async () => {
    await mount();
    expect(headerText()).toContain('Chưa rõ hạn');
    expect(container.textContent).not.toContain('Tươi ngon');
    expect(find('[data-testid="lot-expiry"]').textContent).toBe('Chưa rõ hạn dùng');
    expect(mocks.getLot).toHaveBeenCalledExactlyOnceWith('lot-1');
    expect(mocks.getInventory).not.toHaveBeenCalled();
  });

  it('keeps a missing date unknown even when the kind claims KNOWN', async () => {
    await mount(lot({ expiryKind: 'KNOWN' }));
    expect(headerText()).toContain('Chưa rõ hạn');
    expect(container.textContent).not.toContain('Tươi ngon');
  });

  it('shows the estimated marker instead of an unqualified fresh claim', async () => {
    await mount(lot({ expiryKind: 'ESTIMATED', estimatedExpiryAt: '2026-10-01' }));
    expect(headerText()).toContain('Hạn ước tính');
    expect(container.textContent).not.toContain('Tươi ngon');
    expect(find('[data-testid="lot-expiry"]').textContent).toBe('Hạn ước tính 2026-10-01');
  });

  it('retains the fresh chip for a genuinely KNOWN future expiry', async () => {
    await mount(lot({ expiryKind: 'KNOWN', expiryAt: '2026-10-01' }));
    expect(headerText()).toContain('Tươi ngon');
    expect(find('[data-testid="lot-expiry"]').textContent).toBe('Hạn dùng 2026-10-01');
  });

  it.each(['UNKNOWN', 'ESTIMATED'] as const)('preserves out-of-stock precedence for %s expiry', async (expiryKind) => {
    await mount(lot({ expiryKind, estimatedExpiryAt: expiryKind === 'ESTIMATED' ? '2026-10-01' : null,
      quantity: 0, state: 'CONSUMED', freshness: 'out_of_stock' }));
    expect(headerText()).toContain('Đã hết');
    expect(headerText()).not.toContain('Tươi ngon');
  });

  it('preserves the urgent chip and dated estimate warning for an expiring estimate', async () => {
    await mount(lot({ expiryKind: 'ESTIMATED', estimatedExpiryAt: '2026-09-14', freshness: 'expiring' }));
    expect(headerText()).toContain('Sắp hết hạn');
    expect(find('[data-testid="lot-expiry"]').textContent).toBe('Ước tính sắp hết hạn (2026-09-14)');
  });

  it('corrects UNKNOWN expiry to an explicit known date and renders the refetched lot', async () => {
    await mount();
    await click('Sửa thông tin nguyên liệu');
    expect(find<HTMLInputElement>('#lot-expiry-input').value).toBe('');
    await fillExpiry('2026-10-01');
    mocks.getLot.mockResolvedValue(lot({ expiryKind: 'KNOWN', expiryAt: '2026-10-01', version: 8, lotVersion: 8 }));
    await click('Lưu thay đổi');
    await until(() => expect(headerText()).toContain('Tươi ngon'));
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith('projection-1', { expiryDate: '2026-10-01', expiryEstimated: false }, 7);
    expect(mocks.getLot).toHaveBeenCalledTimes(2);
    expect(mocks.invalidate).toHaveBeenCalledOnce();
    expect(container.querySelector('#lot-expiry-input')).toBeNull();
  });

  it('clears a known expiry explicitly and displays unknown after the refetch', async () => {
    await mount(lot({ expiryKind: 'KNOWN', expiryAt: '2026-10-01' }));
    await click('Sửa thông tin nguyên liệu');
    await fillExpiry('');
    mocks.getLot.mockResolvedValue(lot({ version: 8, lotVersion: 8 }));
    await click('Lưu thay đổi');
    await until(() => expect(headerText()).toContain('Chưa rõ hạn'));
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith('projection-1', { expiryDate: null, expiryEstimated: false }, 7);
    expect(container.textContent).not.toContain('Tươi ngon');
  });

  it('shows a readable conflict, refetches real query state and retries against the refreshed version', async () => {
    await mount();
    await click('Sửa thông tin nguyên liệu');
    await fillExpiry('2026-10-01');
    mocks.update.mockRejectedValueOnce(new ApiError('http', 'HTTP 409: {"code":"CONFLICT","private":"secret"}', 409));
    mocks.getLot.mockResolvedValue(lot({ version: 8, lotVersion: 8, quantity: 5,
      name: 'Cà chua mới', unit: 'g', category: 'other', storage: 'freezer' }));
    await click('Lưu thay đổi');
    await until(() => {
      expect(container.textContent).toContain('v8');
      expect(button('Lưu thay đổi').disabled).toBe(false);
    });
    expect(find('[role="alert"]').textContent).toContain('Đã tải lại trạng thái mới nhất');
    expect(container.textContent).not.toContain('secret');
    expect(mocks.getLot).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenNthCalledWith(1, 'projection-1', { expiryDate: '2026-10-01', expiryEstimated: false }, 7);
    mocks.getLot.mockResolvedValue(lot({ version: 9, lotVersion: 9, expiryKind: 'KNOWN', expiryAt: '2026-10-01' }));
    await click('Lưu thay đổi');
    await until(() => expect(container.querySelector('[role="alert"]')).toBeNull());
    expect(mocks.update).toHaveBeenNthCalledWith(2, 'projection-1', { expiryDate: '2026-10-01', expiryEstimated: false }, 8);
    expect(mocks.getLot).toHaveBeenCalledTimes(3);
    expect(mocks.invalidate).toHaveBeenCalledTimes(2);
  });
});

describe('T13B U7 existing-lot metadata editing', () => {
  it('submits name, compatible unit, category, storage and explicit expiry without overwriting quantity', async () => {
    await mount(lot({ unit: 'g', quantity: 500, canonicalUnit: 'g', quantityMilli: 500000 }));
    await click('Sửa thông tin nguyên liệu');
    expect(find<HTMLInputElement>('#lot-name-input').value).toBe('Cà chua');
    expect(find<HTMLSelectElement>('#lot-unit-input').value).toBe('g');
    expect(find<HTMLSelectElement>('#lot-category-input').value).toBe('vegetable');
    await fillInput('#lot-name-input', '  Cà chua đã kiểm tra  ');
    await select('#lot-unit-input', 'kg');
    await select('#lot-category-input', 'other');
    await select('#lot-storage-input', 'freezer');
    await fillExpiry('2026-10-01');
    mocks.getLot.mockResolvedValue(lot({ name: 'Cà chua đã kiểm tra', unit: 'kg', quantity: 0.5,
      category: 'other', storage: 'freezer', expiryKind: 'KNOWN', expiryAt: '2026-10-01',
      version: 9, lotVersion: 9 }));
    await click('Lưu thay đổi');
    await until(() => expect(container.querySelector('#lot-name-input')).toBeNull());
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith('projection-1', {
      name: 'Cà chua đã kiểm tra', unit: 'kg', category: 'other', storage: 'freezer',
      expiryDate: '2026-10-01', expiryEstimated: false,
    }, 7);
    expect(find('h3').textContent).toBe('Cà chua đã kiểm tra');
    expect(container.textContent).toContain('0.5 kg');
    expect(find('[data-testid="lot-expiry"]').textContent).toBe('Hạn dùng 2026-10-01');
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });

  it.each([
    ['name', 'Cà chua mới'], ['unit', 'kg'], ['category', 'other'], ['storage', 'freezer'],
  ])('submits only dirty %s and leaves an unchanged estimate as estimated', async (field, value) => {
    await mount(lot({ unit: 'g', expiryKind: 'ESTIMATED', estimatedExpiryAt: '2026-10-01' }));
    await click('Sửa thông tin nguyên liệu');
    if (field === 'name') await fillInput('#lot-name-input', value);
    else await select(`#lot-${field}-input`, value);
    await click('Lưu thay đổi');
    await until(() => expect(container.querySelector('#lot-name-input')).toBeNull());
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith('projection-1', { [field]: value }, 7);
    expect(find('[data-testid="lot-expiry"]').textContent).toBe('Hạn ước tính 2026-10-01');
  });

  it('does not mutate an unchanged or reverted draft, including an estimated date and custom category', async () => {
    await mount(lot({ category: 'fruit', expiryKind: 'ESTIMATED', estimatedExpiryAt: '2026-10-01' }));
    await click('Sửa thông tin nguyên liệu');
    expect(find<HTMLSelectElement>('#lot-category-input').value).toBe('fruit');
    await click('Lưu thay đổi');
    expect(mocks.update).not.toHaveBeenCalled();
    await click('Sửa thông tin nguyên liệu');
    await fillInput('#lot-name-input', 'Tên mới');
    await fillInput('#lot-name-input', 'Cà chua');
    await select('#lot-unit-input', 'kg');
    await select('#lot-unit-input', 'piece');
    await select('#lot-category-input', 'other');
    await select('#lot-category-input', 'fruit');
    await fillExpiry('2026-10-02');
    await fillExpiry('2026-10-01');
    await click('Lưu thay đổi');
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.getLot).toHaveBeenCalledOnce();
  });

  it('rejects a blank name and discards canceled metadata drafts', async () => {
    await mount();
    await click('Sửa thông tin nguyên liệu');
    await fillInput('#lot-name-input', '   ');
    expect(button('Lưu thay đổi').disabled).toBe(true);
    await click('Lưu thay đổi');
    expect(mocks.update).not.toHaveBeenCalled();
    await click('Hủy');
    await click('Sửa thông tin nguyên liệu');
    expect(find<HTMLInputElement>('#lot-name-input').value).toBe('Cà chua');
    expect(button('Lưu thay đổi').disabled).toBe(false);
  });

  it.each(['CONFLICT', 'IDEMPOTENCY_CONFLICT'])('retains only dirty metadata after %s refetch without clobbering newer fields', async (code) => {
    await mount(lot({ expiryKind: 'ESTIMATED', estimatedExpiryAt: '2026-10-01' }));
    await click('Sửa thông tin nguyên liệu');
    await fillInput('#lot-name-input', 'Cà chua đã kiểm tra');
    mocks.update.mockRejectedValueOnce(new ApiError('http', `HTTP 409: {"code":"${code}"}`, 409));
    const refreshed = lot({ version: 8, lotVersion: 8, name: 'Cà chua từ thiết bị khác',
      unit: 'g', quantity: 500, category: 'other', storage: 'freezer',
      expiryKind: 'KNOWN', expiryAt: '2026-10-02' });
    mocks.getLot.mockResolvedValue(refreshed);
    await click('Lưu thay đổi');
    await until(() => {
      expect(container.textContent).toContain('v8');
      expect(button('Lưu thay đổi').disabled).toBe(false);
    });
    expect(find('[role="alert"]').textContent).toContain(code === 'CONFLICT'
      ? 'Đã tải lại trạng thái mới nhất' : 'Yêu cầu này đã được dùng cho một thao tác khác');
    expect(find<HTMLInputElement>('#lot-name-input').value).toBe('Cà chua đã kiểm tra');
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith('projection-1', { name: 'Cà chua đã kiểm tra' }, 7);
    mocks.getLot.mockResolvedValue({ ...refreshed, name: 'Cà chua đã kiểm tra', version: 9, lotVersion: 9 });
    await click('Lưu thay đổi');
    await until(() => expect(container.querySelector('#lot-name-input')).toBeNull());
    expect(mocks.update).toHaveBeenNthCalledWith(2, 'projection-1', { name: 'Cà chua đã kiểm tra' }, 8);
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('500 g');
    expect(find('[data-testid="lot-expiry"]').textContent).toBe('Hạn dùng 2026-10-02');
  });

  it('preserves the safe draft on UNIT_MISMATCH with no automatic retry or refetch', async () => {
    client.setDefaultOptions({ mutations: { retry: 2, retryDelay: 0 } });
    await mount(lot({ unit: 'g', quantity: 500 }));
    await click('Sửa thông tin nguyên liệu');
    await fillInput('#lot-name-input', 'Cà chua đã kiểm tra');
    await select('#lot-unit-input', 'piece');
    await select('#lot-category-input', 'other');
    await select('#lot-storage-input', 'freezer');
    await fillExpiry('2026-10-01');
    mocks.update.mockRejectedValueOnce(new ApiError('http', 'HTTP 422: {"code":"UNIT_MISMATCH","private":"secret"}', 422));
    await click('Lưu thay đổi');
    await until(() => expect(button('Lưu thay đổi').disabled).toBe(false));
    expect(find('[role="alert"]').textContent).toContain('Không thể quy đổi đơn vị này');
    expect(container.textContent).not.toContain('secret');
    expect(find<HTMLInputElement>('#lot-name-input').value).toBe('Cà chua đã kiểm tra');
    expect(find<HTMLSelectElement>('#lot-unit-input').value).toBe('piece');
    expect(find<HTMLSelectElement>('#lot-category-input').value).toBe('other');
    expect(find<HTMLSelectElement>('#lot-storage-input').value).toBe('freezer');
    expect(find<HTMLInputElement>('#lot-expiry-input').value).toBe('2026-10-01');
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.getLot).toHaveBeenCalledOnce();
    expect(mocks.invalidate).not.toHaveBeenCalled();
    await select('#lot-unit-input', 'kg');
    await click('Lưu thay đổi');
    await until(() => expect(container.querySelector('#lot-name-input')).toBeNull());
    expect(mocks.update).toHaveBeenNthCalledWith(2, 'projection-1', {
      name: 'Cà chua đã kiểm tra', unit: 'kg', category: 'other', storage: 'freezer',
      expiryDate: '2026-10-01', expiryEstimated: false,
    }, 7);
  });
});
