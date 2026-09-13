// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StandardUnit } from '@frigo/domain';
import { ReceiptReviewPage } from '../../src/web/pages/ReceiptReviewPage';
import { ApiError } from '../../src/web/services/http';

const mocks = vi.hoisted(() => ({
  getScan: vi.fn(), confirmScan: vi.fn(), navigate: vi.fn(), invalidate: vi.fn(),
  search: '?scanId=receipt-1', currentPlan: null as { id: string } | null,
}));
vi.mock('../../src/web/services/api', () => ({ api: { getScan: mocks.getScan, confirmScan: mocks.confirmScan } }));
vi.mock('../../src/web/components/common/TopBar', () => ({ TopBar: () => <h1>Chi tiết Hóa đơn</h1> }));
vi.mock('../../src/web/stores/useWeekStore', () => ({
  useWeekStore: (selector: (state: { currentPlan: { id: string } | null }) => unknown) => selector({ currentPlan: mocks.currentPlan }),
}));
vi.mock('../../src/web/lib/query-invalidation', () => ({ invalidateInventoryDependents: mocks.invalidate }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [new URLSearchParams(mocks.search)],
}));

interface Line {
  id: string;
  rawName: string;
  canonicalId?: string | null;
  estimatedQuantity: number;
  unit: StandardUnit;
  storage: 'fridge' | 'freezer' | 'pantry';
  confidence?: number | null;
  totalPriceVnd?: number;
  unitPriceVnd?: number;
  expiryDate?: string;
  expiryEstimated?: boolean;
  reviewState?: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  rawEvidence?: { rawName?: string | null; estimatedQuantity?: number | null; unit?: StandardUnit | null };
}
interface Receipt {
  id: string;
  status: 'pending' | 'processing' | 'ready' | 'confirmed' | 'failed';
  items: Line[];
  totalAmountVnd?: number;
  purchaseDate?: string;
}

const line = (changes: Partial<Line> = {}): Line => ({
  id: 'line-1', rawName: 'Cà chua', estimatedQuantity: 2, unit: 'piece', storage: 'fridge',
  canonicalId: 'TOMATO', confidence: 0.9, unitPriceVnd: 10000, totalPriceVnd: 20000,
  rawEvidence: { rawName: 'Cà chua', estimatedQuantity: 2, unit: 'piece' }, ...changes,
});
const receipt = (changes: Partial<Receipt> = {}): Receipt => ({
  id: 'receipt-1', status: 'ready', items: [line()], purchaseDate: '2026-09-11', totalAmountVnd: 20000, ...changes,
});

let root: Root;
let container: HTMLDivElement;

async function mount(dto = receipt()) {
  mocks.getScan.mockResolvedValueOnce(dto);
  await act(async () => root.render(<ReceiptReviewPage />));
  await advance(500);
}
async function advance(milliseconds: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
}
function find<T = HTMLElement>(selector: string): T {
  const element = container.querySelector(selector);
  expect(element, selector).not.toBeNull();
  return element as T;
}
function button(label: string) {
  const element = [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
  expect(element, label).toBeDefined();
  return element!;
}
async function click(element: HTMLElement) {
  await act(async () => element.click());
}
async function fill(id: string, value: string) {
  const input = find<HTMLInputElement>(`#${id}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function select(id: string, value: string) {
  const input = find<HTMLSelectElement>(`#${id}`);
  await act(async () => {
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
function confirmation(): Array<Record<string, unknown>> {
  expect(mocks.confirmScan).toHaveBeenCalledOnce();
  expect(mocks.confirmScan.mock.calls[0][0]).toBe('receipt-1');
  return mocks.confirmScan.mock.calls[0][1] as Array<Record<string, unknown>>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  mocks.getScan.mockReset();
  mocks.confirmScan.mockReset().mockResolvedValue({ success: true });
  mocks.search = '?scanId=receipt-1';
  mocks.currentPlan = null;
  localStorage.clear();
  localStorage.setItem('frigo_user_id', 'receipt-review-user');
  localStorage.setItem('frigo_household_id', 'receipt-review-household');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('T13B receipt review edits', () => {
  it('submits name, fractional quantity, unit, storage and an explicit dated fact without changing OCR purchase facts', async () => {
    const dto = receipt();
    await mount(dto);
    await fill('receipt-name-line-1', '  Cà chua bi  ');
    await fill('receipt-quantity-line-1', '0.25');
    await select('receipt-unit-line-1', 'kg');
    await select('receipt-storage-line-1', 'freezer');
    await fill('receipt-expiry-line-1', '2026-10-01');
    await click(find('summary'));
    expect(find<HTMLDetailsElement>('details').open).toBe(true);
    expect(find('[data-testid="receipt-raw-evidence"]').textContent).toBe('OCR gốc: Cà chua · 2 · piece');
    expect(find('[data-testid="receipt-confirmed-evidence"]').textContent).toContain('Cà chua bi');
    expect(find('[data-testid="receipt-confirmed-evidence"]').textContent).toContain('0.25 · kg');
    expect(find('summary').textContent).toContain('Đã chỉnh sửa');
    expect(find('[data-testid="receipt-price"]').textContent).toContain('20.000đ');
    expect(find('[data-testid="receipt-total"]').textContent).toBe('20.000đ');
    expect(find('[data-testid="receipt-expiry-status"]').textContent).toBe('Hạn dùng do bạn cung cấp');
    await click(button('Nhập 1 món vào Tủ lạnh'));
    expect(confirmation()[0]).toMatchObject({ id: 'line-1', rawName: 'Cà chua bi', estimatedQuantity: 0.25,
      unit: 'kg', storage: 'freezer', expiryDate: '2026-10-01', expiryEstimated: false, rejected: false });
    expect(confirmation()[0]).not.toHaveProperty('rawEvidence');
    expect(confirmation()[0]).not.toHaveProperty('totalPriceVnd');
    expect(confirmation()[0]).not.toHaveProperty('unitPriceVnd');
    expect(dto.items[0]).toEqual(line());
    expect(mocks.invalidate).toHaveBeenCalledOnce();
    await advance(1200);
    expect(mocks.navigate).toHaveBeenCalledWith('/fridge');
  });

  it.each<StandardUnit>(['g', 'kg', 'ml', 'l', 'piece', 'pack', 'bunch', 'slice'])('offers and submits StandardUnit %s without inventing a conversion', async (unit) => {
    await mount();
    const options = [...find<HTMLSelectElement>('#receipt-unit-line-1').options].map((option) => option.value);
    expect(options).toEqual(['g', 'kg', 'ml', 'l', 'piece', 'pack', 'bunch', 'slice']);
    await select('receipt-unit-line-1', unit);
    expect(find<HTMLInputElement>('#receipt-quantity-line-1').value).toBe('2');
    await click(button('Nhập 1 món vào Tủ lạnh'));
    expect(confirmation()[0]).toMatchObject({ unit, estimatedQuantity: 2 });
  });

  it('edits storage independently per line and explicitly rejects/restores a line', async () => {
    await mount(receipt({ items: [line(), line({ id: 'line-2', rawName: 'Sữa' })] }));
    await select('receipt-storage-line-1', 'pantry');
    await click(find('button[aria-label="Bỏ qua Sữa"]'));
    expect(find<HTMLInputElement>('#receipt-name-line-2').disabled).toBe(true);
    expect(find<HTMLInputElement>('#receipt-quantity-line-2').disabled).toBe(true);
    expect(find<HTMLSelectElement>('#receipt-unit-line-2').disabled).toBe(true);
    expect(find<HTMLSelectElement>('#receipt-storage-line-2').disabled).toBe(true);
    expect(find<HTMLInputElement>('#receipt-expiry-line-2').disabled).toBe(true);
    await click(find('button[aria-label="Khôi phục Sữa"]'));
    expect(find<HTMLInputElement>('#receipt-name-line-2').disabled).toBe(false);
    await click(find('button[aria-label="Bỏ qua Sữa"]'));
    await click(button('Nhập 1 món vào Tủ lạnh'));
    expect(confirmation()).toHaveLength(2);
    expect(confirmation()[0]).toMatchObject({ id: 'line-1', storage: 'pantry', rejected: false });
    expect(confirmation()[1]).toEqual({ id: 'line-2', rejected: true });
  });

  it('allows rejecting every line, sending IDs for authoritative hydration even after an invalid draft edit', async () => {
    await mount();
    await fill('receipt-quantity-line-1', '');
    await click(find('button[aria-label="Bỏ qua Cà chua"]'));
    await click(button('Lưu 1 dòng bỏ qua'));
    expect(confirmation()).toEqual([{ id: 'line-1', rejected: true }]);
    expect(container.textContent).toContain('Đã lưu các dòng bỏ qua.');
  });

  it.each(['', '0', '-1', '10001'])('blocks invalid quantity %j without submitting or replacing it with a default', async (value) => {
    await mount();
    await fill('receipt-quantity-line-1', value);
    expect(find<HTMLInputElement>('#receipt-quantity-line-1').value).toBe(value);
    expect(find('#receipt-quantity-line-1').getAttribute('aria-invalid')).toBe('true');
    expect(button('Nhập 1 món vào Tủ lạnh').disabled).toBe(true);
    await click(button('Nhập 1 món vào Tủ lạnh'));
    expect(mocks.confirmScan).not.toHaveBeenCalled();
    await fill('receipt-quantity-line-1', '0.125');
    expect(button('Nhập 1 món vào Tủ lạnh').disabled).toBe(false);
  });

  it('blocks blank names and allows repair', async () => {
    await mount();
    await fill('receipt-name-line-1', '  ');
    expect(button('Nhập 1 món vào Tủ lạnh').disabled).toBe(true);
    expect(find('#receipt-name-line-1').getAttribute('aria-invalid')).toBe('true');
    await fill('receipt-name-line-1', 'Cà chua mới');
    expect(button('Nhập 1 món vào Tủ lạnh').disabled).toBe(false);
  });

  it('does not invent an expiry date when none was supplied', async () => {
    await mount();
    expect(find<HTMLInputElement>('#receipt-expiry-line-1').value).toBe('');
    expect(find('[data-testid="receipt-expiry-status"]').textContent).toContain('Chưa cung cấp hạn dùng');
    await click(button('Nhập 1 món vào Tủ lạnh'));
    expect(confirmation()[0]).toMatchObject({ expiryDate: undefined, expiryEstimated: false });
  });

  it.each(['clear', 'date', 'unchanged'] as const)('keeps an estimate separate from supplied expiry: %s', async (action) => {
    await mount(receipt({ items: [line({ expiryDate: '2026-09-20', expiryEstimated: true })] }));
    expect(find('[data-testid="receipt-expiry-status"]').textContent).toBe('Hạn dùng ước tính');
    if (action === 'clear') await click(button('Không rõ hạn dùng'));
    if (action === 'date') await fill('receipt-expiry-line-1', '2026-09-21');
    await click(button('Nhập 1 món vào Tủ lạnh'));
    expect(confirmation()[0]).toMatchObject({
      expiryDate: action === 'clear' ? undefined : action === 'date' ? '2026-09-21' : '2026-09-20',
      expiryEstimated: action === 'unchanged',
    });
  });
});

describe('T13B receipt evidence truth', () => {
  it.each([
    [undefined, 'Độ tin cậy: chưa rõ'], [null, 'Độ tin cậy: chưa rõ'],
    [0, 'Độ tin cậy thấp 0%'], [0.11, 'Độ tin cậy thấp 11%'], [0.9, 'Độ tin cậy 90%'],
  ] as const)('renders confidence %s without a fabricated default', async (confidence, expected) => {
    await mount(receipt({ items: [line({ confidence })] }));
    expect(find('[data-testid="receipt-confidence"]').textContent).toBe(expected);
  });

  it('shows absent price/date as unknown even when some other line has a price', async () => {
    await mount(receipt({ purchaseDate: undefined, totalAmountVnd: undefined,
      items: [line({ unitPriceVnd: undefined, totalPriceVnd: undefined, canonicalId: null }), line({ id: 'line-2' })] }));
    expect(find('[data-testid="receipt-price"]').textContent).toBe('Thành tiền OCR: Không có giá');
    expect(find('[data-testid="receipt-total"]').textContent).toBe('Không có giá');
    expect(container.textContent).toContain('Không rõ ngày mua');
    expect(container.textContent).toContain('Chưa nhận diện nguyên liệu chuẩn');
    await fill('receipt-quantity-line-1', '3');
    expect(find('[data-testid="receipt-price"]').textContent).toBe('Thành tiền OCR: Không có giá');
  });

  it('preserves genuine zero money and receipt total even after edits and rejection', async () => {
    await mount(receipt({ totalAmountVnd: 0, items: [line({ totalPriceVnd: 0, unitPriceVnd: 0 })] }));
    await fill('receipt-quantity-line-1', '10');
    await click(find('button[aria-label="Bỏ qua Cà chua"]'));
    expect(find('[data-testid="receipt-price"]').textContent).toBe('Thành tiền OCR: 0đ');
    expect(find('[data-testid="receipt-total"]').textContent).toBe('0đ');
    expect(container.textContent).toContain('Đơn giá OCR: 0đ');
  });

  it.each([
    { rawName: 'OCR tên khác', estimatedQuantity: 2, unit: 'piece' as const },
    { rawName: 'Cà chua', estimatedQuantity: 2, unit: 'pack' as const },
  ])('detects name-only or unit-only correction using retained server evidence', async (rawEvidence) => {
    await mount(receipt({ items: [line({ rawEvidence })] }));
    await click(find('summary'));
    expect(find('summary').textContent).toContain('Đã chỉnh sửa');
    expect(find('[data-testid="receipt-raw-evidence"]').textContent).toContain(rawEvidence.rawName);
    expect(find('[data-testid="receipt-raw-evidence"]').textContent).toContain(rawEvidence.unit);
  });

  it('never substitutes reviewed name, quantity or unit for missing raw evidence', async () => {
    await mount(receipt({ items: [line({ rawEvidence: { rawName: null, estimatedQuantity: null, unit: null } })] }));
    await click(find('summary'));
    const raw = find('[data-testid="receipt-raw-evidence"]').textContent;
    expect(raw).toBe('OCR gốc: Chưa rõ tên · Chưa rõ số lượng · Chưa rõ đơn vị');
    expect(find('summary').textContent).not.toContain('Đã chỉnh sửa');
    await fill('receipt-name-line-1', 'Tên được sửa');
    expect(find('[data-testid="receipt-raw-evidence"]').textContent).toBe(raw);
  });

  it('loads confirmed edits and rejection from the server on a fresh visit, keeps OCR retrievable, and prevents ignored replay edits', async () => {
    await mount(receipt({ status: 'confirmed', items: [
      line({ rawName: 'Cà chua bi', estimatedQuantity: 0.5, unit: 'kg', storage: 'freezer', reviewState: 'CONFIRMED' }),
      line({ id: 'line-2', reviewState: 'REJECTED' }),
    ] }));
    expect(mocks.getScan).toHaveBeenCalledExactlyOnceWith('receipt-1');
    await click(find('summary'));
    expect(find('[data-testid="receipt-raw-evidence"]').textContent).toBe('OCR gốc: Cà chua · 2 · piece');
    expect(find('[data-testid="receipt-confirmed-evidence"]').textContent).toBe('Đã xác nhận: Cà chua bi · 0.5 · kg');
    expect(find<HTMLInputElement>('#receipt-name-line-1').disabled).toBe(true);
    expect(find<HTMLSelectElement>('#receipt-storage-line-1').value).toBe('freezer');
    expect(find('button[aria-label="Khôi phục Cà chua"]').getAttribute('aria-pressed')).toBe('true');
    expect(find<HTMLButtonElement>('button[aria-label="Khôi phục Cà chua"]').disabled).toBe(true);
    expect(container.querySelector('#receipt-expiry-line-1')).toBeNull();
    await click(button('Xem tủ lạnh'));
    expect(mocks.navigate).toHaveBeenCalledWith('/fridge');
    expect(mocks.confirmScan).not.toHaveBeenCalled();
  });
});

describe('T13B receipt async states', () => {
  it('keeps loading disabled and polls pending data until ready', async () => {
    await mount(receipt({ status: 'processing', items: [] }));
    expect(container.textContent).toContain('AI xử lý nền');
    expect(button('Nhập 0 món vào Tủ lạnh').disabled).toBe(true);
    mocks.getScan.mockResolvedValueOnce(receipt());
    await advance(1000);
    expect(button('Nhập 1 món vào Tủ lạnh').disabled).toBe(false);
    expect(mocks.getScan).toHaveBeenCalledTimes(2);
  });

  it('offers retry after a failed authorized read and recovers without stale errors', async () => {
    mocks.getScan.mockRejectedValueOnce(new Error('network'));
    await mount();
    expect(find('[role="alert"]').textContent).toContain('Không thể cập nhật');
    await click(button('Thử tải lại'));
    await advance(500);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(button('Nhập 1 món vào Tủ lạnh').disabled).toBe(false);
  });

  it('has an honest empty state and no confirm action for missing scan IDs', async () => {
    mocks.search = '';
    await mount();
    expect(container.textContent).toContain('Không tìm thấy bản quét hóa đơn');
    expect(button('Nhập 0 món vào Tủ lạnh').disabled).toBe(true);
    expect(mocks.getScan).not.toHaveBeenCalled();
  });

  it('renders a ready empty result without inventing lines', async () => {
    await mount(receipt({ items: [] }));
    expect(container.textContent).toContain('Không còn món nào trong hóa đơn');
    expect(button('Nhập 0 món vào Tủ lạnh').disabled).toBe(true);
  });

  it('renders a domain failure without raw JSON, retains edits and permits retry', async () => {
    mocks.confirmScan.mockRejectedValueOnce(new ApiError('http', 'HTTP 409: {"code":"UNIT_MISMATCH","private":"secret"}', 409));
    await mount();
    await fill('receipt-name-line-1', 'Cà chua bi');
    await click(button('Nhập 1 món vào Tủ lạnh'));
    expect(find('[role="alert"]').textContent).toContain('Không thể quy đổi đơn vị');
    expect(container.textContent).not.toContain('secret');
    expect(find<HTMLInputElement>('#receipt-name-line-1').value).toBe('Cà chua bi');
    await click(button('Nhập 1 món vào Tủ lạnh'));
    expect(mocks.confirmScan).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('actually reloads the server state before presenting conflict recovery', async () => {
    mocks.confirmScan.mockRejectedValueOnce(new ApiError('http', 'HTTP 409: {"code":"CONFLICT"}', 409));
    await mount();
    mocks.getScan.mockResolvedValueOnce(receipt({ status: 'confirmed', items: [line({ rawName: 'Tên đã lưu' })] }));
    await click(button('Nhập 1 món vào Tủ lạnh'));
    expect(mocks.getScan).toHaveBeenCalledTimes(2);
    expect(find<HTMLInputElement>('#receipt-name-line-1').value).toBe('Tên đã lưu');
    expect(find('[role="alert"]').textContent).toContain('Đã tải lại');
    expect(button('Xem tủ lạnh').disabled).toBe(false);
  });

  it('does not claim a queued offline confirmation already changed inventory', async () => {
    mocks.confirmScan.mockResolvedValueOnce({ pendingSync: true });
    await mount();
    await click(button('Nhập 1 món vào Tủ lạnh'));
    expect(container.textContent).toContain('đang chờ đồng bộ');
    expect(container.textContent).not.toContain('thành công');
  });

  it('labels the Week shortcut as navigation rather than claiming shopping reconciliation', async () => {
    mocks.currentPlan = { id: 'week-1' };
    await mount();
    expect(container.textContent).not.toContain('Đánh dấu đi chợ');
    await click(button('Lưu hóa đơn & mở danh sách tuần'));
    expect(confirmation()[0]).toMatchObject({ id: 'line-1' });
    expect(mocks.invalidate).toHaveBeenCalledOnce();
    await advance(1200);
    expect(mocks.navigate).toHaveBeenCalledWith('/week/week-1/shopping');
  });

  it('ignores a delayed receipt read after the household changes', async () => {
    let resolve!: (value: Receipt) => void;
    mocks.getScan.mockImplementationOnce(() => new Promise<Receipt>((done) => { resolve = done; }));
    await mount();
    localStorage.setItem('frigo_household_id', 'other-household');
    await act(async () => resolve(receipt({ items: [line({ rawName: 'PRIVATE_OCR' })] })));
    expect(container.textContent).not.toContain('PRIVATE_OCR');
    expect(button('Nhập 0 món vào Tủ lạnh').disabled).toBe(true);
  });
});
