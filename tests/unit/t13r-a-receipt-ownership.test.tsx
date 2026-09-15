// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceiptReviewPage } from '../../src/web/pages/ReceiptReviewPage';
import { ApiError } from '../../src/web/services/http';

// T13R-A P1-4 (review P1-4): the receipt route's scanId is the only identity.
// A scan DTO whose id differs from the route must never render, hydrate a
// draft, or be confirmed — whatever the transport delivered and whenever.

const mocks = vi.hoisted(() => ({ getScan: vi.fn(), confirmScan: vi.fn(), invalidate: vi.fn() }));
vi.mock('../../src/web/services/api', () => ({ api: { getScan: mocks.getScan, confirmScan: mocks.confirmScan } }));
vi.mock('../../src/web/components/common/TopBar', () => ({ TopBar: () => <h1>Chi tiết Hóa đơn</h1> }));
vi.mock('../../src/web/stores/useWeekStore', () => ({
  useWeekStore: (selector: (state: { currentPlan: null }) => unknown) => selector({ currentPlan: null }),
}));
vi.mock('../../src/web/lib/query-invalidation', () => ({ invalidateInventoryDependents: mocks.invalidate }));

type Status = 'pending' | 'ready' | 'confirmed' | 'failed';
function dto(id: 'A' | 'B', status: Status = 'ready') {
  return {
    id, status, purchaseDate: '2026-09-12',
    items: [{ id: `${id}-line`, rawName: `${id}_OCR_LINE`, estimatedQuantity: 1, unit: 'piece',
      storage: 'fridge', canonicalId: null, rawEvidence: { rawName: `${id}_OCR_LINE`, estimatedQuantity: 1, unit: 'piece' } }],
  };
}
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
      <button onClick={() => navigate('/scan/receipt-review?scanId=A')}>Mở A</button>
      <button onClick={() => navigate('/scan/receipt-review?scanId=B')}>Mở B</button>
    </nav>
  );
}

let root: Root;
let container: HTMLDivElement;

async function advance(milliseconds: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
}
function button(label: string | RegExp) {
  const element = [...container.querySelectorAll('button')].find((item) =>
    typeof label === 'string' ? item.textContent?.trim() === label : label.test(item.textContent?.trim() ?? ''));
  expect(element, String(label)).toBeDefined();
  return element!;
}
async function click(element: HTMLElement) {
  await act(async () => element.click());
}
async function mount(route = '/scan/receipt-review?scanId=A') {
  root = createRoot(container);
  await act(async () => root.render(
    <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Navigation />
      <Routes>
        <Route path="/scan/receipt-review" element={<ReceiptReviewPage />} />
        <Route path="/fridge" element={<p>FRIDGE_ROUTE</p>} />
      </Routes>
    </MemoryRouter>,
  ));
  await advance(500);
}
const lines = () => [...container.querySelectorAll('[data-testid="receipt-line"]')];
const alertText = () => container.querySelector('[role="alert"]')?.textContent ?? '';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.getScan.mockReset();
  mocks.confirmScan.mockReset().mockResolvedValue({ success: true });
  mocks.invalidate.mockReset();
  localStorage.clear();
  localStorage.setItem('frigo_user_id', 'receipt-owner-user');
  localStorage.setItem('frigo_household_id', 'receipt-owner-household');
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('T13R-A P1-4 receipt review ownership', () => {
  it('request A / response B: never renders B and never confirms anything', async () => {
    mocks.getScan.mockResolvedValue(dto('B'));
    await mount();
    expect(container.textContent).not.toContain('B_OCR_LINE');
    expect(lines()).toHaveLength(0);
    expect(alertText()).toContain('không khớp');
    // Recovery is offered (reload), but nothing reviewable exists.
    expect(button('Thử tải lại').disabled).toBe(false);
    const confirm = [...container.querySelectorAll('button')].find((item) => /vào Tủ lạnh/.test(item.textContent ?? ''));
    if (confirm) {
      expect(confirm.disabled).toBe(true);
      await click(confirm);
    }
    expect(mocks.confirmScan).not.toHaveBeenCalled();
    // The mismatch is terminal for this read; no polling storm against the same lie.
    const calls = mocks.getScan.mock.calls.length;
    await advance(5000);
    expect(mocks.getScan.mock.calls.length).toBe(calls);
  });

  it('late A response after moving to B is discarded; B renders B and confirms B only', async () => {
    const slowA = deferred<ReturnType<typeof dto>>();
    mocks.getScan.mockImplementation((id: string) => id === 'A' ? slowA.promise : Promise.resolve(dto('B')));
    await mount();
    expect(lines()).toHaveLength(0);
    await click(button('Mở B'));
    await advance(500);
    expect(container.textContent).toContain('B_OCR_LINE');
    await act(async () => { slowA.resolve(dto('A')); });
    await advance(10);
    expect(container.textContent).toContain('B_OCR_LINE');
    expect(container.textContent).not.toContain('A_OCR_LINE');
    await click(button(/Nhập 1 món vào Tủ lạnh/));
    expect(mocks.confirmScan).toHaveBeenCalledExactlyOnceWith('B', [expect.objectContaining({ id: 'B-line' })]);
  });

  it('A→B→A keys each view to its route and confirms with the authoritative route id', async () => {
    mocks.getScan.mockImplementation((id: string) => Promise.resolve(dto(id as 'A' | 'B')));
    await mount();
    expect(container.textContent).toContain('A_OCR_LINE');
    await click(button('Mở B'));
    await advance(500);
    expect(container.textContent).toContain('B_OCR_LINE');
    expect(container.textContent).not.toContain('A_OCR_LINE');
    await click(button('Mở A'));
    await advance(500);
    expect(container.textContent).toContain('A_OCR_LINE');
    expect(container.textContent).not.toContain('B_OCR_LINE');
    await click(button(/Nhập 1 món vào Tủ lạnh/));
    expect(mocks.confirmScan).toHaveBeenCalledExactlyOnceWith('A', [expect.objectContaining({ id: 'A-line' })]);
  });

  it('conflict refetch that returns a mismatched id is refused and leaves the draft unconfirmed', async () => {
    mocks.getScan.mockResolvedValueOnce(dto('A'));
    mocks.confirmScan.mockRejectedValueOnce(new ApiError('http', 'HTTP 409: {"code":"CONFLICT"}', 409));
    await mount();
    mocks.getScan.mockResolvedValueOnce(dto('B'));
    await click(button(/Nhập 1 món vào Tủ lạnh/));
    expect(mocks.getScan).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain('B_OCR_LINE');
    expect(alertText()).toContain('không khớp');
    expect(mocks.confirmScan).toHaveBeenCalledTimes(1);
    expect(mocks.confirmScan.mock.calls[0][0]).toBe('A');
  });

  it('a confirm completing after the route switched to B does not navigate or toast on B', async () => {
    const slowConfirm = deferred<{ success: boolean }>();
    mocks.getScan.mockImplementation((id: string) => Promise.resolve(dto(id as 'A' | 'B')));
    mocks.confirmScan.mockImplementationOnce(() => slowConfirm.promise);
    await mount();
    await click(button(/Nhập 1 món vào Tủ lạnh/));
    expect(mocks.confirmScan).toHaveBeenCalledExactlyOnceWith('A', expect.anything());
    await click(button('Mở B'));
    await advance(500);
    expect(container.textContent).toContain('B_OCR_LINE');
    await act(async () => { slowConfirm.resolve({ success: true }); });
    await advance(1500);
    expect(container.textContent).not.toContain('FRIDGE_ROUTE');
    expect(container.textContent).not.toContain('thành công');
    expect(container.textContent).toContain('B_OCR_LINE');
    expect(button(/Nhập 1 món vào Tủ lạnh/).disabled).toBe(false);
  });

  it('private-session reset still fences a delayed authoritative read', async () => {
    const slowA = deferred<ReturnType<typeof dto>>();
    mocks.getScan.mockImplementationOnce(() => slowA.promise);
    await mount();
    localStorage.setItem('frigo_household_id', 'someone-else');
    await act(async () => { slowA.resolve(dto('A')); });
    await advance(10);
    expect(container.textContent).not.toContain('A_OCR_LINE');
    expect(mocks.confirmScan).not.toHaveBeenCalled();
  });
});
