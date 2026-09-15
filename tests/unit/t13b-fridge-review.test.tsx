// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScanResultPage } from '../../src/web/pages/ScanResultPage';
import { useScanStore, type ScanDraftItem } from '../../src/web/stores/useScanStore';
import { ScanConfirmSchema } from '../../src/worker/validation/schemas';

vi.mock('../../src/web/components/common/TopBar', () => ({ TopBar: () => null }));
vi.mock('../../src/web/lib/query-invalidation', () => ({
  invalidateInventoryDependents: vi.fn(),
  invalidateReplayedQueries: vi.fn(),
}));

const SCAN_ID = 'scan-fridge-review';
const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLDivElement;
let submitted: Array<{ items: ScanDraftItem[] }>;
let fetchedItems: ScanDraftItem[];

function prediction(overrides: Partial<ScanDraftItem> = {}): ScanDraftItem {
  return {
    id: 'server-tomato', rawName: 'Cà chua', estimatedQuantity: 2, unit: 'piece',
    storage: 'fridge', confidence: 0.9,
    rawEvidence: { rawName: 'CA CHUA OCR', estimatedQuantity: 2, unit: 'piece' },
    ...overrides,
  };
}

async function mount(items: ScanDraftItem[] = [prediction()]) {
  useScanStore.getState().setScanResults(SCAN_ID, items);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <MemoryRouter initialEntries={[`/scan/${SCAN_ID}/review`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/scan/:id/review" element={<ScanResultPage />} />
          <Route path="/fridge" element={<p>Đã về tủ lạnh</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

function row(index = 0): HTMLElement {
  const found = container.querySelectorAll<HTMLElement>('article')[index];
  expect(found, `review row ${index}`).toBeTruthy();
  return found;
}

function field(label: string, scope: HTMLElement = row()): HTMLInputElement | HTMLSelectElement {
  const found = [...scope.querySelectorAll('label')].find((node) => node.textContent?.trim().startsWith(label));
  const control = found?.querySelector('input,select')
    ?? (found?.htmlFor ? document.getElementById(found.htmlFor) : null);
  expect(control, `field ${label}`).toBeTruthy();
  return control as HTMLInputElement | HTMLSelectElement;
}

async function fill(control: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(control, value);
    control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

function button(label: string, scope: HTMLElement = container): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find((node) =>
    node.textContent?.trim() === label || node.getAttribute('aria-label') === label);
  expect(found, `button ${label}`).toBeTruthy();
  return found!;
}

async function click(label: string, scope: HTMLElement = container) {
  await act(async () => { button(label, scope).click(); });
}

async function confirm(count = 1) {
  await click(`Xác nhận nguyên liệu (${count} món)`);
  expect(submitted).toHaveLength(1);
  expect(ScanConfirmSchema.safeParse(submitted[0]).success).toBe(true);
  expect(container.textContent).toContain('Đã về tủ lạnh');
  return submitted[0].items;
}

async function addManual(name: string) {
  await click('Thêm nguyên liệu AI còn thiếu');
  await fill(container.querySelector<HTMLInputElement>('#scan-add-name')!, name);
  await fill(container.querySelector<HTMLInputElement>('#scan-add-quantity')!, '0.5');
  const unit = container.querySelector('#scan-add-unit');
  if (!(unit instanceof HTMLSelectElement)) throw new Error('Manual unit control is missing');
  await fill(unit, 'l');
  await click('Thêm vào danh sách');
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('frigo_user_id', 'review-user');
  localStorage.setItem('frigo_household_id', 'review-household');
  useScanStore.getState().reset();
  container = document.createElement('div');
  document.body.appendChild(container);
  submitted = [];
  fetchedItems = [];
  fetchMock.mockReset().mockImplementation(async (url, init) => {
    if (String(url) === `/api/v1/scans/${SCAN_ID}/confirm` && init?.method === 'POST') {
      const body: unknown = JSON.parse(String(init.body));
      expect(ScanConfirmSchema.safeParse(body).success).toBe(true);
      submitted.push(body as { items: ScanDraftItem[] });
      return new Response(JSON.stringify({ success: true, items: [] }), { status: 200 });
    }
    if (String(url) === `/api/v1/scans/${SCAN_ID}`) {
      return new Response(JSON.stringify({ scan: { id: SCAN_ID, status: 'ready', items: fetchedItems } }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${String(url)}`);
  });
});

afterEach(async () => {
  if (root) await act(async () => { root!.unmount(); });
  root = undefined;
  container.remove();
  useScanStore.getState().reset();
  localStorage.clear();
  sessionStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('T13B fridge review DOM and wire contract', () => {
  it('edits every persisted line field, retaining only the server raw read as evidence', async () => {
    await mount();
    const originalRaw = row().querySelector('[data-raw-evidence]')!.textContent;
    await fill(field('Tên nguyên liệu'), 'Cà chua đã sửa');
    await fill(field('Số lượng'), '0.75');
    await fill(field('Đơn vị'), 'kg');
    await fill(field('Bảo quản'), 'freezer');
    await fill(field('Hạn dùng'), '2026-10-01');
    expect(row().querySelector('[data-raw-evidence]')!.textContent).toBe(originalRaw);
    expect(row().textContent).toContain('Đã chỉnh sửa so với dữ liệu gốc');
    expect(row().querySelector('[data-expiry-state]')!.textContent).toBe('Ngày do bạn xác nhận');
    expect(container.textContent).toContain('không đổi nơi bảo quản hay hạn dùng của lô cũ');
    const [sent] = await confirm();
    expect(sent).toMatchObject({
      id: 'server-tomato', sourceItemId: 'server-tomato', rawName: 'Cà chua đã sửa',
      estimatedQuantity: 0.75, unit: 'kg', storage: 'freezer', expiryDate: '2026-10-01',
      expiryEstimated: false, rejected: false, rawEvidence: prediction().rawEvidence,
    });
  });

  it.each(['server-tomato', 'draft_server-owned'])('rejects persisted %s without local removal and submits all-rejected review', async (id) => {
    const remove = vi.spyOn(useScanStore.getState(), 'removeItem');
    await mount([prediction({ id })]);
    await click('Từ chối dòng này', row());
    expect(remove).not.toHaveBeenCalled();
    expect(container.querySelectorAll('article')).toHaveLength(1);
    expect(useScanStore.getState().items).toHaveLength(1);
    expect(row().textContent).toContain('Đã từ chối · Không thêm vào tủ lạnh');
    expect(button('Khôi phục dòng này', row()).getAttribute('aria-pressed')).toBe('true');
    expect(button('Xác nhận nguyên liệu (0 món)').disabled).toBe(false);
    expect(await confirm(0)).toMatchObject([{ id, rejected: true }]);
  });

  it('sends an accepted line and a rejected line together instead of filtering rejection out', async () => {
    await mount([prediction(), prediction({ id: 'server-other', rawName: 'Bắp cải' })]);
    await click('Từ chối dòng này', row(1));
    expect(await confirm()).toMatchObject([
      { id: 'server-tomato', rejected: false }, { id: 'server-other', rejected: true },
    ]);
  });

  it('restores a rejected server row and carries the restored choice to confirmation', async () => {
    await mount([prediction({ reviewState: 'REJECTED' })]);
    expect(row().textContent).toContain('Đã từ chối');
    await click('Khôi phục dòng này', row());
    expect(row().textContent).not.toContain('Đã từ chối');
    expect(await confirm()).toMatchObject([{ rejected: false }]);
  });

  it('adds, fully edits, and locally removes only manual drafts while retaining server rows', async () => {
    await mount();
    await addManual('Sữa bỏ đi');
    expect(row(1).textContent).toContain('Nhập thủ công');
    expect(row(1).querySelector('[data-raw-evidence]')).toBeNull();
    const removedId = useScanStore.getState().items[1].id;
    expect(useScanStore.getState().items[1].sourceItemId).toBeUndefined();
    await click('Xóa dòng thủ công', row(1));
    expect(container.querySelectorAll('article')).toHaveLength(1);
    await addManual('Sữa giữ lại');
    await fill(field('Tên nguyên liệu', row(1)), 'Sữa đã sửa');
    await fill(field('Số lượng', row(1)), '250');
    await fill(field('Đơn vị', row(1)), 'ml');
    await fill(field('Bảo quản', row(1)), 'pantry');
    await fill(field('Hạn dùng', row(1)), '2026-10-02');
    const sent = await confirm(2);
    expect(sent.map((item) => item.id)).not.toContain(removedId);
    expect(sent[1]).toMatchObject({ rawName: 'Sữa đã sửa', estimatedQuantity: 250, unit: 'ml',
      storage: 'pantry', expiryDate: '2026-10-02', expiryEstimated: false });
    expect(sent[1].id).toMatch(/^draft_/);
    expect(sent[1].sourceItemId).toBeUndefined();
    expect(sent[1].rawEvidence).toBeUndefined();
    expect(sent[1].confidence).toBeUndefined();
  });

  it('protects persisted rows against local removal through the shared store', async () => {
    await mount([prediction({ id: 'draft_server-owned' })]);
    await act(async () => { useScanStore.getState().removeItem('draft_server-owned'); });
    expect(container.querySelectorAll('article')).toHaveLength(1);
    await click('Từ chối dòng này', row());
    expect(await confirm(0)).toMatchObject([{ id: 'draft_server-owned', rejected: true }]);
  });

  it('retains all reviewed fields, raw evidence, and rejection after a failed confirmation for retry', async () => {
    await mount([prediction(), prediction({ id: 'server-rejected' })]);
    await fill(field('Tên nguyên liệu'), 'Cà chua sửa lại');
    await fill(field('Số lượng'), '0.5');
    await fill(field('Đơn vị'), 'kg');
    await fill(field('Bảo quản'), 'freezer');
    await fill(field('Hạn dùng'), '2026-10-04');
    await click('Từ chối dòng này', row(1));
    let failedBody: string | undefined;
    fetchMock.mockImplementationOnce(async (_url, init) => {
      failedBody = String(init?.body);
      return new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'private server detail' } }), { status: 500 });
    });
    await click('Xác nhận nguyên liệu (1 món)');
    expect(container.querySelector('[role="alert"]')!.textContent).toBe('Chưa lưu được nguyên liệu. Vui lòng thử lại.');
    expect(container.textContent).not.toContain('private server detail');
    expect(container.querySelectorAll('article')).toHaveLength(2);
    expect(field('Tên nguyên liệu').value).toBe('Cà chua sửa lại');
    expect(field('Số lượng').value).toBe('0.5');
    expect(field('Đơn vị').value).toBe('kg');
    expect(field('Bảo quản').value).toBe('freezer');
    expect(field('Hạn dùng').value).toBe('2026-10-04');
    expect(row().querySelector('[data-raw-evidence]')!.textContent).toContain('CA CHUA OCR · 2 piece');
    expect(row(1).textContent).toContain('Đã từ chối');
    expect(button('Xác nhận nguyên liệu (1 món)').disabled).toBe(false);
    await confirm();
    expect(JSON.stringify(submitted[0])).toBe(failedBody);
  });

  it('locks review edits, reject, manual addition, and duplicate confirmation while saving', async () => {
    await mount();
    let finish: (response: Response) => void = () => { throw new Error('No confirmation in flight'); };
    fetchMock.mockImplementationOnce((_url, init) => {
      submitted.push(JSON.parse(String(init?.body)) as { items: ScanDraftItem[] });
      return new Promise<Response>((resolve) => { finish = resolve; });
    });
    await click('Xác nhận nguyên liệu (1 món)');
    expect(button('Đang xử lý...').disabled).toBe(true);
    expect(row().querySelector('fieldset')!.disabled).toBe(true);
    expect(button('Từ chối dòng này', row()).disabled).toBe(true);
    expect(button('Thêm nguyên liệu AI còn thiếu').disabled).toBe(true);
    await click('Đang xử lý...');
    await click('Từ chối dòng này', row());
    await click('Thêm nguyên liệu AI còn thiếu');
    expect(submitted).toHaveLength(1);
    expect(submitted[0].items[0].rejected).toBe(false);
    expect(ScanConfirmSchema.safeParse(submitted[0]).success).toBe(true);
    expect(container.querySelector('#scan-add-name')).toBeNull();
    await act(async () => { finish(new Response(JSON.stringify({ success: true, items: [] }), { status: 200 })); });
    expect(container.textContent).toContain('Đã về tủ lạnh');
  });

  it.each([
    [undefined, 'Độ tin cậy: chưa rõ'], [null, 'Độ tin cậy: chưa rõ'],
    [0, 'Độ tin cậy thấp 0%'], [0.11, 'Độ tin cậy thấp 11%'], [0.9, 'Độ tin cậy 90%'],
  ] as const)('shows actual confidence %s and never replaces it with a default', async (confidence, label) => {
    await mount([prediction({ confidence })]);
    expect(row().querySelector('span')!.textContent).toBe(label);
    const [sent] = await confirm();
    expect(sent.confidence).toBe(confidence);
  });

  it.each([undefined, {}])('does not fabricate a raw read when raw evidence is %j', async (rawEvidence) => {
    await mount([prediction({ rawEvidence })]);
    const rawText = row().querySelector('[data-raw-evidence]')!.textContent;
    expect(rawText).not.toContain('Cà chua');
    expect(rawText).not.toContain('2 piece');
    await fill(field('Tên nguyên liệu'), 'Tên mới');
    await fill(field('Số lượng'), '11');
    await fill(field('Đơn vị'), 'slice');
    expect(row().querySelector('[data-raw-evidence]')!.textContent).toBe(rawText);
    expect(row().textContent).not.toContain('Đã chỉnh sửa so với dữ liệu gốc');
    const [sent] = await confirm();
    expect(sent.rawEvidence).toEqual(rawEvidence);
  });

  it('shows a zero raw quantity and unknown raw unit rather than substituting reviewed values', async () => {
    await mount([prediction({ rawEvidence: { rawName: 'OCR', estimatedQuantity: 0 } })]);
    expect(row().querySelector('[data-raw-evidence]')!.textContent).toBe('AI đọc: OCR · 0 Không rõ đơn vị');
    const [sent] = await confirm();
    expect(sent.rawEvidence).toEqual({ rawName: 'OCR', estimatedQuantity: 0 });
  });

  it.each([3, 7])('marks the %s-day expiry chip as an estimate in the actual request', async (days) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-13T12:00:00'));
    await mount();
    await click(`Ước tính ${days} ngày`, row());
    expect(row().querySelector('[data-expiry-state]')!.textContent).toBe('Hạn dùng ước tính');
    expect(await confirm()).toMatchObject([{ expiryDate: `2026-09-${13 + days}`, expiryEstimated: true }]);
  });

  it('overrides an estimate with an explicit date using expiryEstimated false', async () => {
    await mount([prediction({ expiryDate: '2026-09-20', expiryEstimated: true })]);
    await fill(field('Hạn dùng'), '2026-10-03');
    expect(await confirm()).toMatchObject([{ expiryDate: '2026-10-03', expiryEstimated: false }]);
  });

  it.each(['button', 'input'])('clears expiry via %s to unknown instead of retaining a dated estimate', async (method) => {
    await mount([prediction({ expiryDate: '2026-09-20', expiryEstimated: true })]);
    if (method === 'button') await click('Không rõ hạn dùng', row());
    else await fill(field('Hạn dùng'), '');
    expect(field('Hạn dùng').value).toBe('');
    expect(row().querySelector('[data-expiry-state]')!.textContent).toBe('Chưa rõ hạn dùng');
    const [sent] = await confirm();
    expect(sent.expiryDate).toBeUndefined();
    expect(sent.expiryEstimated).toBe(false);
  });

  it('provides every StandardUnit and preserves the selected value without conversion', async () => {
    await mount();
    const unit = field('Đơn vị') as HTMLSelectElement;
    const units = ['g', 'kg', 'ml', 'l', 'piece', 'pack', 'bunch', 'slice'];
    expect([...unit.options].map((option) => option.value).sort()).toEqual([...units].sort());
    for (const value of units) {
      await fill(unit, value);
      expect(useScanStore.getState().items[0].unit).toBe(value);
      expect(field('Số lượng').value).toBe('2');
    }
    expect(await confirm()).toMatchObject([{ estimatedQuantity: 2, unit: 'slice' }]);
  });

  it('hydrates polled predictions as persisted, including raw evidence and unknown confidence', async () => {
    vi.useFakeTimers();
    fetchedItems = [prediction({ id: 'draft_from-server', confidence: undefined })];
    await mount([]);
    expect(button('Thêm nguyên liệu AI còn thiếu').disabled).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(row().querySelector('span')!.textContent).toBe('Độ tin cậy: chưa rõ');
    expect(row().querySelector('[data-raw-evidence]')!.textContent).toContain('CA CHUA OCR');
    await click('Từ chối dòng này', row());
    expect(await confirm(0)).toMatchObject([{ id: 'draft_from-server', rejected: true }]);
  });

  it('allows manual addition/removal after an empty ready scan without restarting extraction', async () => {
    vi.useFakeTimers();
    await mount([]);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(container.textContent).toContain('Chưa có nguyên liệu trong danh sách');
    await addManual('Sữa');
    expect(row().textContent).toContain('Nhập thủ công');
    await click('Xóa dòng thủ công', row());
    expect(container.querySelectorAll('article')).toHaveLength(0);
    expect(button('Xác nhận nguyên liệu (0 món)').disabled).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(submitted).toHaveLength(0);
  });

  it.each(['', '0', '-1', '10001'])('blocks invalid quantity %j before sending confirmation', async (value) => {
    await mount();
    await fill(field('Số lượng'), value);
    await click('Xác nhận nguyên liệu (1 món)');
    expect(submitted).toHaveLength(0);
    expect((field('Số lượng') as HTMLInputElement).checkValidity()).toBe(false);
  });
});
