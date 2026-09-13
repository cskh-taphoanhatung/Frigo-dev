// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryPage } from '../../src/web/pages/InventoryPage';
import { ApiError } from '../../src/web/services/http';

// T13R-B P2-4 (review P2-4): a real stale-version conflict on the inventory
// list must (1) never resubmit the mutation, (2) show conflict-specific safe
// copy, (3) reload authoritative inventory and replace the stale row, and
// (4) claim a successful refresh only when the reload actually succeeded.

const mocks = vi.hoisted(() => ({
  getInventory: vi.fn(), update: vi.fn(), remove: vi.fn(), add: vi.fn(), invalidate: vi.fn(), navigate: vi.fn(),
}));
vi.mock('../../src/web/services/api', async () => ({
  ApiError: (await import('../../src/web/services/http')).ApiError,
  api: { getInventory: mocks.getInventory, updateInventoryItem: mocks.update,
    deleteInventoryItem: mocks.remove, addInventoryItem: mocks.add },
}));
vi.mock('../../src/web/lib/query-invalidation', () => ({ invalidateInventoryDependents: mocks.invalidate }));
vi.mock('../../src/web/components/common/TopBar', () => ({ TopBar: () => <h1>Tủ lạnh</h1> }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));

const egg = (quantity: number, version: number) => ({
  id: 'stock-egg', name: 'Trứng gà', ingredientId: 'CHICKEN_EGG', quantity, unit: 'piece', category: 'egg',
  storage: 'fridge', freshness: 'fresh', expiryKind: 'UNKNOWN', expiryDate: null, estimatedExpiryDate: null, version,
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
async function click(selector: string) {
  await act(async () => find<HTMLButtonElement>(selector).click());
  await flush();
}
async function clickText(label: string) {
  const element = [...container.querySelectorAll('button')].find((entry) => entry.textContent?.trim() === label);
  expect(element, label).toBeDefined();
  await act(async () => element!.click());
  await flush();
}
async function mount() {
  root = createRoot(container);
  await act(async () => root.render(<QueryClientProvider client={client}><InventoryPage /></QueryClientProvider>));
  await until(() => expect(container.textContent).toContain('Trứng gà'));
}
const quantityText = () => find('h4').parentElement!.parentElement!.textContent;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.getInventory.mockReset().mockResolvedValue([egg(2, 1)]);
  mocks.update.mockReset().mockResolvedValue({ success: true });
  mocks.remove.mockReset().mockResolvedValue({ success: true });
  mocks.add.mockReset();
  mocks.invalidate.mockReset().mockResolvedValue(undefined);
  localStorage.clear();
  localStorage.setItem('frigo_user_id', 'conflict-user');
  localStorage.setItem('frigo_household_id', 'conflict-household');
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

describe('T13R-B P2-4 inventory list conflict recovery', () => {
  it('stale increment → 409 CONFLICT: one PATCH, specific copy, authoritative reload replaces 2 with 7', async () => {
    await mount();
    expect(quantityText()).toContain('2 piece');
    mocks.update.mockRejectedValueOnce(new ApiError('http', 'HTTP 409: {"code":"CONFLICT","expectedVersion":3,"private":"secret"}', 409));
    mocks.getInventory.mockResolvedValue([egg(7, 3)]);
    await click('button[aria-label="Tăng số lượng"]');
    await until(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
    await until(() => expect(quantityText()).toContain('7 piece'));
    const alert = find('[role="alert"]');
    expect(alert.textContent).toContain('Nguyên liệu vừa được cập nhật ở nơi khác');
    expect(alert.textContent).toContain('Đã tải lại trạng thái mới nhất');
    expect(alert.getAttribute('data-refetch-state')).toBe('ok');
    expect(alert.textContent).not.toContain('secret');
    expect(alert.textContent).not.toContain('Chưa cập nhật được số lượng');
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith('stock-egg', { quantity: 3 }, 1);
    expect(mocks.getInventory).toHaveBeenCalledTimes(2);
    expect(quantityText()).not.toContain('2 piece');
  });

  it('CONFLICT with a failed authoritative reload keeps the stale row honestly flagged and offers an explicit reload', async () => {
    await mount();
    mocks.update.mockRejectedValueOnce(new ApiError('http', 'HTTP 409: {"code":"CONFLICT"}', 409));
    mocks.getInventory.mockRejectedValueOnce(new ApiError('http', 'HTTP 500: {"internal":"PRIVATE_REFRESH_FAILURE"}', 500));
    await click('button[aria-label="Tăng số lượng"]');
    await until(() => expect(container.querySelector('[role="alert"]')?.getAttribute('data-refetch-state')).toBe('failed'));
    const alert = find('[role="alert"]');
    expect(alert.textContent).not.toContain('Đã tải lại trạng thái mới nhất');
    expect(alert.textContent).toContain('Chưa tải lại được');
    expect(alert.textContent).not.toContain('PRIVATE_REFRESH_FAILURE');
    expect(mocks.update).toHaveBeenCalledTimes(1);
    // The stale quantity is still shown (React Query keeps the last good data) but flagged as possibly old.
    expect(quantityText()).toContain('2 piece');
    mocks.getInventory.mockResolvedValue([egg(7, 3)]);
    await clickText('Tải lại tủ lạnh');
    await until(() => expect(container.querySelector('[role="alert"]')).toBeNull());
    expect(quantityText()).toContain('7 piece');
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it('IDEMPOTENCY_CONFLICT on delete reloads authority without a second DELETE', async () => {
    await mount();
    mocks.remove.mockRejectedValueOnce(new ApiError('http', 'HTTP 409: {"code":"IDEMPOTENCY_CONFLICT"}', 409));
    mocks.getInventory.mockResolvedValue([egg(5, 2)]);
    await click('button[aria-label="Xóa nguyên liệu"]');
    await clickText('Xóa');
    await until(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
    await until(() => expect(quantityText()).toContain('5 piece'));
    expect(find('[role="alert"]').textContent).toContain('thao tác khác');
    expect(find('[role="alert"]').textContent).toContain('Đã tải lại trạng thái mới nhất');
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });

  it('UNIT_MISMATCH and a generic 500 show safe domain copy with no refetch claim and no automatic retry', async () => {
    client.setDefaultOptions({ mutations: { retry: 2, retryDelay: 0 } });
    await mount();
    mocks.update.mockRejectedValueOnce(new ApiError('http', 'HTTP 422: {"code":"UNIT_MISMATCH","private":"secret"}', 422));
    await click('button[aria-label="Tăng số lượng"]');
    await until(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
    expect(find('[role="alert"]').textContent).toBe('Không thể quy đổi đơn vị này sang đơn vị đang lưu trong tủ.');
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.getInventory).toHaveBeenCalledTimes(1);
    mocks.update.mockRejectedValueOnce(new ApiError('http', 'HTTP 500: {"internal":"PRIVATE_SERVER_DETAIL"}', 500));
    await click('button[aria-label="Tăng số lượng"]');
    await until(() => expect(find('[role="alert"]').textContent).toBe('Chưa cập nhật được số lượng. Vui lòng thử lại.'));
    expect(container.textContent).not.toContain('PRIVATE_SERVER_DETAIL');
    expect(container.textContent).not.toContain('Đã tải lại');
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.getInventory).toHaveBeenCalledTimes(1);
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
});
