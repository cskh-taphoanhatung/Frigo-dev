// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScanResultPage } from '../../src/web/pages/ScanResultPage';
import { resetPrivateSession } from '../../src/web/lib/private-session';
import { api } from '../../src/web/services/api';
import { useScanStore, type ScanDraftItem } from '../../src/web/stores/useScanStore';

vi.mock('../../src/web/lib/query-invalidation', () => ({
  invalidateInventoryDependents: vi.fn(),
  invalidateReplayedQueries: vi.fn(),
}));

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLDivElement;

type ScanStatus = 'pending' | 'ready' | 'confirmed' | 'failed';
type ScanResponse = { scan: { id: string; status: ScanStatus; items: ScanDraftItem[] } };

function item(name: string, id = `item-${name}`): ScanDraftItem {
  return {
    id,
    rawName: name,
    estimatedQuantity: 1,
    unit: 'piece',
    storage: 'fridge',
    confidence: 0.9,
  };
}

function scan(id: string, status: ScanStatus, items: ScanDraftItem[] = []): ScanResponse {
  return { scan: { id, status, items } };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function Navigation() {
  const navigate = useNavigate();
  return (
    <nav>
      <button onClick={() => navigate('/scan/A/review')}>Mở A</button>
      <button onClick={() => navigate('/scan/B/review')}>Mở B</button>
      <button onClick={() => navigate('/scan/result')}>Mở kết quả</button>
    </nav>
  );
}

async function mount(route = '/scan/B/review') {
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <MemoryRouter
        initialEntries={[route]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Navigation />
        <Routes>
          <Route path="/scan/:id/review" element={<ScanResultPage />} />
          <Route path="/scan/result" element={<ScanResultPage />} />
          <Route path="/fridge" element={<p>FRIDGE_ROUTE</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(
    (node) => node.textContent?.trim() === label,
  );
  expect(found, label).toBeTruthy();
  return found!;
}

function confirmButton(): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((node) =>
    node.textContent?.trim().startsWith('Xác nhận nguyên liệu'),
  );
  expect(found, 'confirmation button').toBeTruthy();
  return found!;
}

function expectConfirmedReview(acceptedCount = 1) {
  expect(container.querySelector('[role="status"]')?.textContent).toContain(
    `Đã xác nhận ${acceptedCount} nguyên liệu`,
  );
  expect(container.querySelector('header')?.textContent).toContain('Bản quét đã xác nhận · Chỉ xem');
  expect(container.textContent).toContain('Thông tin bản quét đã được lưu.');
  expect(container.textContent).toContain('từ trang tủ lạnh');
  expect(container.textContent).not.toContain('cần kiểm tra');
  expect(container.textContent).not.toContain('Kiểm tra & chỉnh sửa trước khi xác nhận');
  expect(container.textContent).not.toContain('Sửa tên, số lượng');
  expect(container.textContent).not.toContain('từ chối từng dòng trước khi lưu');
  expect(container.textContent).not.toContain('Xác nhận nguyên liệu');
  expect(container.textContent).not.toContain('Thêm nguyên liệu AI còn thiếu');
  for (const control of container.querySelectorAll('article input, article select, article button')) {
    expect(control.matches(':disabled')).toBe(true);
  }
  expect(button('Xem tủ lạnh').disabled).toBe(false);
}

async function click(element: HTMLElement) {
  await act(async () => {
    element.click();
  });
}

function reviewNameInput(): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('article input:not([type])');
  expect(input, 'review name input').toBeTruthy();
  return input!;
}

async function fillInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function requested(path: string, method = 'GET') {
  return fetchMock.mock.calls.filter(
    ([url, init]) => String(url) === path && (init?.method || 'GET') === method,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('frigo_user_id', 'hardening-user');
  localStorage.setItem('frigo_household_id', 'hardening-household');
  useScanStore.getState().reset();
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  if (root)
    await act(async () => {
      root!.unmount();
    });
  root = undefined;
  container.remove();
  useScanStore.getState().reset();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('T13B ScanResultPage route, session, and confirmation hardening', () => {
  it('treats the route as authoritative over a stale Zustand scan, then confirms only the route scan', async () => {
    useScanStore.getState().setScanResults('A', [item('A_PRIVATE')]);
    fetchMock.mockResolvedValueOnce(json(scan('B', 'ready', [item('B_SERVER')])));

    await mount('/scan/B/review');
    expect(container.textContent).not.toContain('A_PRIVATE');
    expect(requested('/api/v1/scans/B')).toHaveLength(0);

    await advance(500);
    expect(requested('/api/v1/scans/B')).toHaveLength(1);
    expect(container.textContent).toContain('B_SERVER');
    expect(container.textContent).not.toContain('A_PRIVATE');

    fetchMock.mockResolvedValueOnce(json({ success: true, items: [] }));
    await click(confirmButton());
    const post = requested('/api/v1/scans/B/confirm', 'POST');
    expect(post).toHaveLength(1);
    expect(JSON.parse(String(post[0][1]?.body))).toMatchObject({
      items: [{ rawName: 'B_SERVER' }],
    });
    expect(JSON.stringify(post[0][1]?.body)).not.toContain('A_PRIVATE');
    expect(container.textContent).toContain('FRIDGE_ROUTE');
  });

  it('uses the changing SPA route for A → B → A, rather than retaining the prior route state', async () => {
    useScanStore.getState().setScanResults('A', [item('A_INITIAL')]);
    fetchMock
      .mockResolvedValueOnce(json(scan('B', 'ready', [item('B_SERVER')])))
      .mockResolvedValueOnce(json(scan('A', 'ready', [item('A_RELOADED')])));

    await mount('/scan/A/review');
    expect(container.textContent).toContain('A_INITIAL');
    await click(button('Mở B'));
    expect(container.textContent).not.toContain('A_INITIAL');
    await advance(500);
    expect(container.textContent).toContain('B_SERVER');

    await click(button('Mở A'));
    expect(container.textContent).not.toContain('B_SERVER');
    await advance(500);
    expect(requested('/api/v1/scans/A')).toHaveLength(1);
    expect(container.textContent).toContain('A_RELOADED');
  });

  it('keeps a confirmed A read-only when B is still hydrating and the SPA returns to A', async () => {
    const pendingB = deferred<Response>();
    fetchMock
      .mockResolvedValueOnce(json(scan('A', 'confirmed', [item('A_CONFIRMED')])))
      .mockImplementationOnce(() => pendingB.promise);

    await mount('/scan/A/review');
    await advance(500);
    expect(container.textContent).toContain('A_CONFIRMED');
    expectConfirmedReview();

    await click(button('Mở B'));
    await advance(500);
    expect(requested('/api/v1/scans/B')).toHaveLength(1);
    expect(container.textContent).not.toContain('A_CONFIRMED');

    await click(button('Mở A'));
    expect(container.textContent).toContain('A_CONFIRMED');
    expectConfirmedReview();
    expect(reviewNameInput().closest('fieldset')?.disabled).toBe(true);

    await act(async () => {
      pendingB.resolve(json(scan('B', 'ready', [item('STALE_B_RESPONSE')])));
    });
    expect(container.textContent).toContain('A_CONFIRMED');
    expect(container.textContent).not.toContain('STALE_B_RESPONSE');
    expect(useScanStore.getState().scanId).toBe('A');
    expect(useScanStore.getState().reviewStatus).toBe('confirmed');
    expect(requested('/api/v1/scans/A/confirm', 'POST')).toHaveLength(0);
  });

  it('shows completed confirmed-review UX and opens the fridge without another mutation', async () => {
    useScanStore.getState().setScanResults('B', [
      { ...item('ACCEPTED'), reviewState: 'CONFIRMED', expiryDate: '2030-12-31', expiryEstimated: false },
      { ...item('ESTIMATED'), reviewState: 'CONFIRMED', expiryDate: '2026-09-20', expiryEstimated: true },
      { ...item('NO_EXPIRY'), reviewState: 'CONFIRMED' },
      { ...item('REJECTED'), rejected: true, reviewState: 'REJECTED' },
    ], 'confirmed');
    await mount();
    expectConfirmedReview(3);
    expect(container.querySelectorAll('article input, article select')).toHaveLength(20);
    // T13R-A P2-B: a confirmed line reports the server-recorded accepted expiry, never a fresh unknown.
    const states = [...container.querySelectorAll('article')].map((article) => ({
      date: article.querySelector<HTMLInputElement>('input[type="date"]')!.value,
      state: article.querySelector('[data-expiry-state]')!.textContent,
    }));
    expect(states).toEqual([
      { date: '2030-12-31', state: 'Ngày do bạn xác nhận' },
      { date: '2026-09-20', state: 'Hạn dùng ước tính đã xác nhận' },
      { date: '', state: 'Đã xác nhận không rõ hạn dùng' },
      { date: '', state: 'Đã bỏ qua: không có hạn dùng' },
    ]);
    expect(container.textContent).not.toContain('Chưa rõ hạn dùng');
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Từ chối dòng này"]')?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Khôi phục dòng này"]')?.disabled).toBe(true);
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(fetchMock).not.toHaveBeenCalled();
    await click(button('Xem tủ lạnh'));
    expect(container.textContent).toContain('FRIDGE_ROUTE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([false, true])('keeps zero-accepted confirmed scans terminal (rejected row: %s)', async (hasRejectedRow) => {
    const items = hasRejectedRow ? [{ ...item('REJECTED'), rejected: true }] : [];
    fetchMock.mockResolvedValueOnce(json(scan('B', 'confirmed', items)));
    await mount();
    await advance(500);
    expectConfirmedReview(0);
    expect(container.textContent).not.toContain('Đang chờ AI');
    expect(requested('/api/v1/scans/B/confirm', 'POST')).toHaveLength(0);
  });

  it('clears stored review status on reset while preserving the default pending producer contract', () => {
    useScanStore.getState().setScanResults('A', [item('A_PENDING')]);
    expect(useScanStore.getState().reviewStatus).toBeNull();
    useScanStore.getState().setScanResults('A', [item('A_CONFIRMED')], 'confirmed');
    expect(useScanStore.getState().reviewStatus).toBe('confirmed');

    useScanStore.getState().reset();
    expect(useScanStore.getState().scanId).toBeNull();
    expect(useScanStore.getState().reviewStatus).toBeNull();
  });

  it('ignores a pending A response after the user switches to B', async () => {
    const slowA = deferred<Response>();
    fetchMock
      .mockImplementationOnce(() => slowA.promise)
      .mockResolvedValueOnce(json(scan('B', 'ready', [item('B_SERVER')])));

    await mount('/scan/A/review');
    await advance(500);
    expect(requested('/api/v1/scans/A')).toHaveLength(1);

    await click(button('Mở B'));
    await advance(500);
    expect(container.textContent).toContain('B_SERVER');
    await act(async () => {
      slowA.resolve(json(scan('A', 'ready', [item('A_PRIVATE')])));
    });

    expect(container.textContent).toContain('B_SERVER');
    expect(container.textContent).not.toContain('A_PRIVATE');
    expect(useScanStore.getState().scanId).toBe('B');
  });

  it('fences a deferred GET after unmount and an identity/scope reset', async () => {
    const oldRequest = deferred<Response>();
    fetchMock.mockImplementationOnce(() => oldRequest.promise);

    await mount('/scan/B/review');
    await advance(500);
    await act(async () => {
      root!.unmount();
    });
    root = undefined;
    localStorage.setItem('frigo_user_id', 'new-hardening-user');
    localStorage.setItem('frigo_household_id', 'new-hardening-household');
    await act(async () => {
      resetPrivateSession();
      useScanStore.getState().setScanResults('NEW_OWNER', [item('NEW_OWNER_ITEM')]);
    });
    await act(async () => {
      oldRequest.resolve(json(scan('B', 'ready', [item('OLD_OWNER_PRIVATE')])));
    });

    expect(localStorage.getItem('frigo_user_id')).toBe('new-hardening-user');
    expect(localStorage.getItem('frigo_household_id')).toBe('new-hardening-household');
    expect(useScanStore.getState().scanId).toBe('NEW_OWNER');
    expect(useScanStore.getState().items.map(({ rawName }) => rawName)).toEqual(['NEW_OWNER_ITEM']);
  });

  it('fences a pending response when the private session generation changes and does not recurse', async () => {
    const slowB = deferred<Response>();
    fetchMock.mockImplementationOnce(() => slowB.promise);

    await mount('/scan/B/review');
    await advance(500);
    await act(async () => {
      resetPrivateSession();
    });
    await act(async () => {
      slowB.resolve(json(scan('B', 'ready', [item('PRIVATE_B')])));
    });
    await advance(10_000);

    expect(container.textContent).not.toContain('PRIVATE_B');
    expect(useScanStore.getState().scanId).toBeNull();
    expect(requested('/api/v1/scans/B')).toHaveLength(1);
  });

  it.each(['ready DTO', 'failed DTO', 'rejected request'])(
    'fences a direct api.getScan %s after a same-identity generation reset',
    async (outcome) => {
      const oldRequest = deferred<ScanResponse['scan']>();
      const getScan = vi.spyOn(api, 'getScan').mockImplementationOnce(() => oldRequest.promise);

      await mount('/scan/B/review');
      await advance(500);
      expect(getScan).toHaveBeenCalledWith('B');
      expect(localStorage.getItem('frigo_user_id')).toBe('hardening-user');
      expect(localStorage.getItem('frigo_household_id')).toBe('hardening-household');

      await act(async () => {
        resetPrivateSession();
      });
      await act(async () => {
        if (outcome === 'ready DTO')
          oldRequest.resolve(scan('B', 'ready', [item('PRIVATE_DIRECT_READY')]).scan);
        else if (outcome === 'failed DTO') oldRequest.resolve(scan('B', 'failed').scan);
        else oldRequest.reject(new Error('PRIVATE_DIRECT_ERROR'));
      });

      expect(useScanStore.getState().scanId).toBeNull();
      expect(useScanStore.getState().reviewStatus).toBeNull();
      expect(useScanStore.getState().items).toEqual([]);
      expect(container.textContent).not.toContain('PRIVATE_DIRECT_READY');
      expect(container.textContent).not.toContain('Không thể đọc bản quét');
      expect(container.textContent).not.toContain('Không thể tải bản quét');
    },
  );

  it.each(['ready response', 'failed response', 'transport error'])(
    'does not apply an old private-session %s',
    async (outcome) => {
      const oldRequest = deferred<Response>();
      fetchMock.mockImplementationOnce(() => oldRequest.promise);

      await mount('/scan/B/review');
      await advance(500);
      await act(async () => {
        resetPrivateSession();
        useScanStore.getState().setScanResults('NEW', [item('NEW_SESSION_ITEM')]);
      });

      await act(async () => {
        if (outcome === 'ready response')
          oldRequest.resolve(json(scan('B', 'ready', [item('PRIVATE_READY')])));
        else if (outcome === 'failed response') oldRequest.resolve(json(scan('B', 'failed')));
        else oldRequest.reject(new TypeError('offline'));
      });

      expect(useScanStore.getState().scanId).toBe('NEW');
      expect(useScanStore.getState().items.map(({ rawName }) => rawName)).toEqual([
        'NEW_SESSION_ITEM',
      ]);
      expect(container.textContent).not.toContain('PRIVATE_READY');
      expect(container.textContent).not.toContain('Không thể đọc bản quét');
      expect(container.textContent).not.toContain('Không thể tải bản quét');
      await advance(10_000);
      expect(requested('/api/v1/scans/B')).toHaveLength(1);
    },
  );

  it('accepts a ready result once, presents confirmed scans read-only, and cancels recursive polling on unmount', async () => {
    fetchMock.mockResolvedValueOnce(json(scan('B', 'ready', [item('B_READY')])));
    await mount('/scan/B/review');
    await advance(500);
    await advance(10_000);
    expect(container.textContent).toContain('B_READY');
    expect(requested('/api/v1/scans/B')).toHaveLength(1);

    await act(async () => {
      root!.unmount();
    });
    root = undefined;
    useScanStore.getState().reset();
    fetchMock
      .mockReset()
      .mockResolvedValueOnce(json(scan('B', 'confirmed', [item('B_CONFIRMED')])));
    await mount('/scan/B/review');
    await advance(500);
    expect(container.textContent).toContain('B_CONFIRMED');
    expectConfirmedReview();

    await act(async () => {
      root!.unmount();
    });
    root = undefined;
    useScanStore.getState().reset();
    fetchMock.mockReset().mockResolvedValueOnce(json(scan('B', 'failed')));
    await mount('/scan/B/review');
    await advance(500);
    expect(container.textContent).toContain('Bản quét không thể xử lý');
    expect(requested('/api/v1/scans/B')).toHaveLength(1);

    await act(async () => {
      root!.unmount();
    });
    root = undefined;
    useScanStore.getState().reset();
    fetchMock.mockReset().mockResolvedValueOnce(json(scan('B', 'pending')));
    await mount('/scan/B/review');
    await advance(500);
    await act(async () => {
      root!.unmount();
    });
    root = undefined;
    await advance(10_000);
    expect(requested('/api/v1/scans/B')).toHaveLength(1);
  });

  it('rejects a backend response whose scan id does not match the route', async () => {
    fetchMock.mockResolvedValueOnce(json(scan('A', 'ready', [item('A_PRIVATE')])));
    await mount('/scan/B/review');
    await advance(500);

    expect(container.textContent).not.toContain('A_PRIVATE');
    expect(useScanStore.getState().scanId).not.toBe('A');
    expect(confirmButton().disabled).toBe(true);
  });

  it('does not let an old route confirmation reset the newer scan or navigate away', async () => {
    const slowConfirmA = deferred<Response>();
    useScanStore.getState().setScanResults('A', [item('A_TO_CONFIRM')]);
    fetchMock
      .mockImplementationOnce(() => slowConfirmA.promise)
      .mockResolvedValueOnce(json(scan('B', 'ready', [item('B_SERVER')])));

    await mount('/scan/A/review');
    await click(confirmButton());
    expect(requested('/api/v1/scans/A/confirm', 'POST')).toHaveLength(1);
    await click(button('Mở B'));
    await advance(500);
    expect(container.textContent).toContain('B_SERVER');

    await act(async () => {
      slowConfirmA.resolve(json({ success: true, items: [] }));
    });
    expect(container.textContent).toContain('B_SERVER');
    expect(container.textContent).not.toContain('FRIDGE_ROUTE');
    expect(useScanStore.getState().scanId).toBe('B');
  });

  it('does not let an old session or unmounted confirmation reset a newer scan', async () => {
    const sessionConfirm = deferred<Response>();
    useScanStore.getState().setScanResults('B', [item('B_TO_CONFIRM')]);
    fetchMock.mockImplementationOnce(() => sessionConfirm.promise);
    await mount('/scan/B/review');
    await click(confirmButton());
    await act(async () => {
      resetPrivateSession();
      useScanStore.getState().setScanResults('NEW', [item('NEW_SESSION_ITEM')]);
    });
    await act(async () => {
      sessionConfirm.resolve(json({ success: true, items: [] }));
    });
    expect(useScanStore.getState().scanId).toBe('NEW');
    expect(container.textContent).not.toContain('FRIDGE_ROUTE');

    await act(async () => {
      root!.unmount();
    });
    root = undefined;
    const unmountedConfirm = deferred<Response>();
    useScanStore.getState().setScanResults('B', [item('B_TO_CONFIRM')]);
    fetchMock.mockReset().mockImplementationOnce(() => unmountedConfirm.promise);
    await mount('/scan/B/review');
    await click(confirmButton());
    await act(async () => {
      root!.unmount();
    });
    root = undefined;
    useScanStore.getState().setScanResults('NEWER', [item('NEWER_ITEM')]);
    await act(async () => {
      unmountedConfirm.resolve(json({ success: true, items: [] }));
    });
    expect(useScanStore.getState().scanId).toBe('NEWER');
  });

  it.each([
    [
      'CONFLICT',
      'Nguyên liệu vừa được cập nhật ở nơi khác. Đã tải lại trạng thái mới nhất, vui lòng thử lại.',
    ],
    [
      'IDEMPOTENCY_CONFLICT',
      'Yêu cầu này đã được dùng cho một thao tác khác. Vui lòng tải lại và thử lại.',
    ],
  ])(
    'reloads the authoritative scan after %s without repeating the POST',
    async (code, expectedMessage) => {
      fetchMock
        .mockResolvedValueOnce(json(scan('B', 'ready', [item('STALE_B')])))
        .mockResolvedValueOnce(json({ code, private: 'PRIVATE_BACKEND_DETAIL' }, 409))
        .mockResolvedValueOnce(json(scan('B', 'confirmed', [item('AUTHORITATIVE_B')])));
      await mount('/scan/B/review');
      await advance(500);
      await click(confirmButton());

      expect(requested('/api/v1/scans/B/confirm', 'POST')).toHaveLength(1);
      expect(requested('/api/v1/scans/B')).toHaveLength(2);
      expect(container.textContent).toContain('AUTHORITATIVE_B');
      expect(container.textContent).not.toContain('PRIVATE_BACKEND_DETAIL');
      expect(container.textContent).toContain(expectedMessage);
      expectConfirmedReview();
    },
  );

  it('preserves an edited input and blocks stale confirmation while conflict refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce(json(scan('B', 'ready', [item('STALE_B')])))
      .mockResolvedValueOnce(json({ code: 'CONFLICT', private: 'PRIVATE_CONFLICT' }, 409))
      .mockResolvedValueOnce(json({ internal: 'PRIVATE_REFRESH_FAILURE' }, 500));
    await mount('/scan/B/review');
    await advance(500);
    await click(confirmButton());
    expect(confirmButton().disabled).toBe(true);
    await click(confirmButton());
    expect(requested('/api/v1/scans/B/confirm', 'POST')).toHaveLength(1);
    expect(container.textContent).not.toContain('PRIVATE_CONFLICT');
    expect(container.textContent).not.toContain('PRIVATE_REFRESH_FAILURE');
  });

  it('recovers a failed conflict refresh through explicit retry load without repeating confirmation', async () => {
    fetchMock
      .mockResolvedValueOnce(json(scan('B', 'ready', [item('STALE_B')])))
      .mockResolvedValueOnce(json({ code: 'CONFLICT', private: 'PRIVATE_CONFLICT' }, 409))
      .mockResolvedValueOnce(json({ internal: 'PRIVATE_REFRESH_FAILURE' }, 500))
      .mockResolvedValueOnce(json(scan('B', 'ready', [item('RECOVERED_B')])));
    await mount('/scan/B/review');
    await advance(500);
    await click(confirmButton());
    expect(container.textContent).toContain(
      'Thông tin đã thay đổi nhưng chưa tải lại được. Vui lòng tải lại trước khi thử xác nhận.',
    );
    expect(confirmButton().disabled).toBe(true);

    await click(button('Thử tải lại'));
    await advance(500);
    expect(requested('/api/v1/scans/B')).toHaveLength(3);
    expect(requested('/api/v1/scans/B/confirm', 'POST')).toHaveLength(1);
    expect(container.textContent).toContain('RECOVERED_B');
    expect(confirmButton().disabled).toBe(false);
  });

  it('preserves edits for UNIT_MISMATCH without fetching an authoritative replacement', async () => {
    fetchMock
      .mockResolvedValueOnce(json(scan('B', 'ready', [item('ORIGINAL_B')])))
      .mockResolvedValueOnce(json({ code: 'UNIT_MISMATCH', private: 'PRIVATE_UNIT_DETAIL' }, 409));
    await mount('/scan/B/review');
    await advance(500);
    await fillInput(reviewNameInput(), 'EDITED_B');
    await click(confirmButton());

    expect(container.textContent).toContain(
      'Không thể quy đổi đơn vị này sang đơn vị đang lưu trong tủ.',
    );
    expect(container.textContent).not.toContain('PRIVATE_UNIT_DETAIL');
    expect(reviewNameInput().value).toBe('EDITED_B');
    expect(requested('/api/v1/scans/B')).toHaveLength(1);
    expect(requested('/api/v1/scans/B/confirm', 'POST')).toHaveLength(1);
  });

  it('keeps an edited input after a safe generic 500 without automatic GET or POST retry', async () => {
    fetchMock
      .mockResolvedValueOnce(json(scan('B', 'ready', [item('B_RETRY')])))
      .mockResolvedValueOnce(json({ private: 'PRIVATE_500' }, 500))
      .mockResolvedValueOnce(json({ success: true, items: [] }));
    await mount('/scan/B/review');
    await advance(500);
    await fillInput(reviewNameInput(), 'EDITED_RETRY');
    await click(confirmButton());
    expect(container.textContent).not.toContain('PRIVATE_500');
    expect(container.textContent).toContain('Chưa lưu được nguyên liệu. Vui lòng thử lại.');
    expect(reviewNameInput().value).toBe('EDITED_RETRY');
    await advance(10_000);
    expect(requested('/api/v1/scans/B')).toHaveLength(1);
    expect(requested('/api/v1/scans/B/confirm', 'POST')).toHaveLength(1);
    await click(confirmButton());
    expect(requested('/api/v1/scans/B/confirm', 'POST')).toHaveLength(2);
    expect(
      JSON.parse(String(requested('/api/v1/scans/B/confirm', 'POST')[1][1]?.body)),
    ).toMatchObject({
      items: [{ rawName: 'EDITED_RETRY' }],
    });
  });
});
