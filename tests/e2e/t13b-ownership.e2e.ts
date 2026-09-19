import type { Page } from '@playwright/test';
import { test, expect, reset, control, getJson, layout, navigate } from './t13b/fixtures';

type ScenarioIds = {
  receiptPurchase: string;
  receiptMissingHeader: string;
  confirmedEmpty: string;
};

type ScanItem = {
  id: string;
  rawName: string;
  reviewState: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  isConfirmed: boolean;
};

type ScanResponse = {
  scan: {
    id: string;
    status: 'ready' | 'confirmed';
    items: ScanItem[];
  };
};

async function resetWithScenarios(page: Page): Promise<ScenarioIds> {
  await reset(page);
  return control<ScenarioIds>(page, 't13-scenarios');
}

function reviewPath(scanId: string) {
  return `/scan/${scanId}/review`;
}

async function markDocument(page: Page) {
  return page.evaluate(() => {
    const marker = crypto.randomUUID();
    document.documentElement.dataset.t13bDocumentMarker = marker;
    return marker;
  });
}

async function expectSameDocument(page: Page, marker: string) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.t13bDocumentMarker))
    .toBe(marker);
}

async function scanStoreState(page: Page) {
  return page.evaluate(async () => {
    const modulePath = '/src/web/stores/useScanStore.ts';
    const { useScanStore } = await import(/* @vite-ignore */ modulePath);
    const state = useScanStore.getState();
    return {
      scanId: state.scanId,
      itemCount: state.items.length,
      reviewStatus: state.reviewStatus,
    };
  });
}

async function expectTerminalReview(page: Page, acceptedCount: number) {
  await expect(page.getByRole('status')).toContainText(`Đã xác nhận ${acceptedCount} nguyên liệu`);
  await expect(page.getByText('Bản quét đã xác nhận · Chỉ xem')).toBeVisible();
  await expect(
    page.getByText(
      'Thông tin bản quét đã được lưu. Bạn có thể xem hoặc chỉnh sửa lô từ trang tủ lạnh.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thêm nguyên liệu AI còn thiếu' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Xác nhận nguyên liệu/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xem tủ lạnh' })).toBeEnabled();
  await expect(page.locator('main')).not.toContainText('cần kiểm tra');
  await expect(page.locator('main')).not.toContainText('Sửa tên, số lượng, đơn vị');

  const controls = page.locator('article input, article select, article button');
  for (let index = 0; index < (await controls.count()); index++) {
    await expect(controls.nth(index)).toBeDisabled();
  }
  await layout(page, controls);
}

test('D preserves route-owned A → B → A evidence without a document reload', async ({ page }) => {
  const ids = await resetWithScenarios(page);
  const [a, b] = await Promise.all([
    getJson<ScanResponse>(page, `/api/v1/scans/${ids.receiptPurchase}`),
    getJson<ScanResponse>(page, `/api/v1/scans/${ids.receiptMissingHeader}`),
  ]);
  expect(a.scan).toMatchObject({ id: ids.receiptPurchase, status: 'ready' });
  expect(a.scan.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ rawName: 'Cà chua OCR A', reviewState: 'PENDING' }),
    ]),
  );
  expect(b.scan).toMatchObject({ id: ids.receiptMissingHeader, status: 'ready' });
  expect(b.scan.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ rawName: 'Thực phẩm bí ẩn B', reviewState: 'PENDING' }),
    ]),
  );

  await page.goto(reviewPath(ids.receiptPurchase));
  await expect(page.getByRole('heading', { name: 'Cà chua OCR A' })).toBeVisible();
  const marker = await markDocument(page);
  await layout(page, page.locator('article input, article select'));

  let releaseB!: () => void;
  const held = new Promise<void>((resolve) => { releaseB = resolve; });
  let capturedB!: () => void;
  const captured = new Promise<void>((resolve) => { capturedB = resolve; });
  await page.route(`**/api/v1/scans/${ids.receiptMissingHeader}`, async (route) => {
    const response = await route.fetch();
    capturedB();
    await held;
    await route.fulfill({ response });
  });
  await navigate(page, reviewPath(ids.receiptMissingHeader));
  await captured;
  try {
    await expect(page.locator('article')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Cà chua OCR A' })).toHaveCount(0);
  } finally { releaseB(); }
  await expect(page.getByRole('heading', { name: 'Thực phẩm bí ẩn B' })).toBeVisible();
  await page.unroute(`**/api/v1/scans/${ids.receiptMissingHeader}`);
  await expect(page.getByText('Cà chua OCR A', { exact: true })).toHaveCount(0);
  await expectSameDocument(page, marker);

  await navigate(page, reviewPath(ids.receiptPurchase));
  await expect(page.getByRole('heading', { name: 'Cà chua OCR A' })).toBeVisible();
  await expect(page.getByText('Thực phẩm bí ẩn B', { exact: true })).toHaveCount(0);
  await expectSameDocument(page, marker);
  const posts: Array<{ path: string; body: string | null }> = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/confirm')) {
      posts.push({ path: new URL(request.url()).pathname, body: request.postData() });
    }
  });
  await navigate(page, reviewPath(ids.receiptMissingHeader));
  await page.getByRole('button', { name: 'Xác nhận nguyên liệu (1 món)', exact: true }).click();
  await expect(page).toHaveURL(/\/fridge$/);
  expect(posts).toHaveLength(1);
  expect(posts[0].path).toBe(`/api/v1/scans/${ids.receiptMissingHeader}/confirm`);
  expect(posts[0].body).toContain('Thực phẩm bí ẩn B');
  expect(posts[0].body).not.toContain('Cà chua OCR A');
  expect((await getJson<ScanResponse>(page, `/api/v1/scans/${ids.receiptPurchase}`)).scan.status).toBe('ready');
});

test('E fences a delayed real GET when profile logout resets the private session', async ({
  page,
}) => {
  const ids = await resetWithScenarios(page);
  let releaseResponse!: () => void;
  const responseReleased = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  let captureRequest!: () => void;
  const requestCaptured = new Promise<void>((resolve) => {
    captureRequest = resolve;
  });
  let finishResponse!: () => void;
  const responseFinished = new Promise<void>((resolve) => { finishResponse = resolve; });
  const lateMutations: string[] = [];

  await page.route(`**/api/v1/scans/${ids.receiptPurchase}`, async (route) => {
    const response = await route.fetch();
    captureRequest();
    await responseReleased;
    await route.fulfill({ response });
    finishResponse();
  });

  try {
    await page.goto(reviewPath(ids.receiptPurchase));
    await requestCaptured;

    await navigate(page, '/me');
    await page.getByRole('button', { name: 'Đăng xuất khỏi tài khoản' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Đăng xuất tài khoản?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await expect(page).toHaveURL(/\/auth$/);
    await expect
      .poll(() => scanStoreState(page))
      .toEqual({
        scanId: null,
        itemCount: 0,
        reviewStatus: null,
      });

    releaseResponse();
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/scans/')) lateMutations.push(request.url());
    });
    await responseFinished;
    await expect(page).toHaveURL(/\/auth$/);
    await expect(scanStoreState(page)).resolves.toEqual({
      scanId: null,
      itemCount: 0,
      reviewStatus: null,
    });
    await expect(page.locator('body')).not.toContainText('Cà chua OCR A');
    expect(lateMutations).toEqual([]);
  } finally {
    releaseResponse?.();
    await page.unroute(`**/api/v1/scans/${ids.receiptPurchase}`);
  }
});

test('H confirms accepted and rejected reviews, preserves terminal A → B → A, and leaves fridge navigation mutation-free', async ({
  page,
}) => {
  const ids = await resetWithScenarios(page);
  const mutationPosts: Array<{ path: string; names: string[] }> = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.method() !== 'POST' || !url.pathname.startsWith('/api/')) return;
    const body = request.postDataJSON() as { items?: Array<{ rawName?: string }> };
    mutationPosts.push({
      path: url.pathname,
      names: body.items?.map((item) => item.rawName ?? '') ?? [],
    });
  });

  await page.goto(reviewPath(ids.receiptPurchase));
  await expect(page.getByRole('heading', { name: 'Cà chua OCR A' })).toBeVisible();
  await page.getByRole('button', { name: 'Xác nhận nguyên liệu (1 món)' }).click();
  await expect(page).toHaveURL(/\/fridge$/);
  await expect(page.getByRole('heading', { name: 'Tủ lạnh của tôi' })).toBeVisible();
  await expect
    .poll(async () => getJson<ScanResponse>(page, `/api/v1/scans/${ids.receiptPurchase}`))
    .toMatchObject({
      scan: {
        id: ids.receiptPurchase,
        status: 'confirmed',
        items: [
          expect.objectContaining({
            rawName: 'Cà chua OCR A',
            reviewState: 'CONFIRMED',
            isConfirmed: true,
          }),
        ],
      },
    });
  expect(mutationPosts).toEqual([
    {
      path: `/api/v1/scans/${ids.receiptPurchase}/confirm`,
      names: ['Cà chua OCR A'],
    },
  ]);

  await navigate(page, reviewPath(ids.receiptPurchase));
  await expectTerminalReview(page, 1);
  const marker = await markDocument(page);

  await navigate(page, reviewPath(ids.receiptMissingHeader));
  await expect(page.getByRole('heading', { name: 'Thực phẩm bí ẩn B' })).toBeVisible();
  await page.getByRole('button', { name: 'Từ chối dòng này' }).click();
  await expect(page.getByRole('button', { name: 'Khôi phục dòng này' })).toBeVisible();
  await page.getByRole('button', { name: 'Xác nhận nguyên liệu (0 món)' }).click();
  await expect(page).toHaveURL(/\/fridge$/);
  await expect(page.getByRole('heading', { name: 'Tủ lạnh của tôi' })).toBeVisible();
  await expect
    .poll(async () => getJson<ScanResponse>(page, `/api/v1/scans/${ids.receiptMissingHeader}`))
    .toMatchObject({
      scan: {
        id: ids.receiptMissingHeader,
        status: 'confirmed',
        items: [
          expect.objectContaining({
            rawName: 'Thực phẩm bí ẩn B',
            reviewState: 'REJECTED',
            isConfirmed: false,
          }),
        ],
      },
    });
  expect(mutationPosts).toEqual([
    {
      path: `/api/v1/scans/${ids.receiptPurchase}/confirm`,
      names: ['Cà chua OCR A'],
    },
    {
      path: `/api/v1/scans/${ids.receiptMissingHeader}/confirm`,
      names: ['Thực phẩm bí ẩn B'],
    },
  ]);

  await navigate(page, reviewPath(ids.receiptMissingHeader));
  await expectTerminalReview(page, 0);
  await navigate(page, reviewPath(ids.receiptPurchase));
  await expectTerminalReview(page, 1);
  await expectSameDocument(page, marker);

  await navigate(page, reviewPath(ids.confirmedEmpty));
  await expectTerminalReview(page, 0);
  await expect(page.locator('article')).toHaveCount(0);

  const postsBeforeFridgeNavigation = mutationPosts.length;
  await page.getByRole('button', { name: 'Xem tủ lạnh' }).click();
  await expect(page).toHaveURL(/\/fridge$/);
  expect(mutationPosts).toHaveLength(postsBeforeFridgeNavigation);
});
