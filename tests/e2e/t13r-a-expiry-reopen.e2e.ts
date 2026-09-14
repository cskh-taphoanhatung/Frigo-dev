import { test, expect, reset, adopt, control, getJson, layout } from './t13b/fixtures';

// T13R-A P2-B (independent review P2-3): an explicit expiry accepted at
// confirmation must survive reopening the confirmed review in a NEW document.
// The reopened review reports what the server recorded, never an absence.

interface ScanItem {
  id: string; reviewState: string; expiryKind?: string; expiryDate?: string; expiryEstimated?: boolean;
}
interface ScanResponse { scan: { id: string; status: string; items: ScanItem[] } }

function countPosts(page: import('@playwright/test').Page) {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/')) posts.push(new URL(request.url()).pathname);
  });
  return posts;
}

test.beforeEach(async ({ page }) => {
  await reset(page);
  await control(page, 't13-scans');
  expect((await adopt(page)).code).toBe(0);
});

test('P2-B fridge review reopened in a fresh document shows the accepted explicit expiry read-only', async ({ page }) => {
  const id = 't13b-preview-fridge';
  await page.goto(`/scan/${id}/review`);
  const dated = page.locator(`[data-scan-item-id="${id}-0"]`);
  await expect(dated).toBeVisible();
  await dated.locator('input[type="date"]').fill('2030-12-31');
  const response = page.waitForResponse((r) => r.url().endsWith(`/scans/${id}/confirm`));
  await page.getByRole('button', { name: 'Xác nhận nguyên liệu (4 món)', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/fridge$/);

  const { scan } = await getJson<ScanResponse>(page, `/api/v1/scans/${id}`);
  expect(scan.status).toBe('confirmed');
  expect(scan.items[0]).toMatchObject({ reviewState: 'CONFIRMED', expiryKind: 'KNOWN', expiryDate: '2030-12-31', expiryEstimated: false });
  expect(scan.items[1]).toMatchObject({ reviewState: 'CONFIRMED', expiryKind: 'UNKNOWN' });
  expect(scan.items[1]).not.toHaveProperty('expiryDate');

  // Fresh document: no client store survives; the review hydrates from the route alone.
  const posts = countPosts(page);
  await page.goto(`/scan/${id}/review`);
  await expect(page.getByText('Bản quét đã xác nhận · Chỉ xem')).toBeVisible();
  const reopened = page.locator(`[data-scan-item-id="${id}-0"]`);
  await expect(reopened.locator('input[type="date"]')).toHaveValue('2030-12-31');
  await expect(reopened.locator('input[type="date"]')).toBeDisabled();
  await expect(reopened.locator('[data-expiry-state]')).toHaveText('Ngày do bạn xác nhận');
  await expect(reopened).not.toContainText('Chưa rõ hạn dùng');
  const undated = page.locator(`[data-scan-item-id="${id}-1"]`);
  await expect(undated.locator('input[type="date"]')).toHaveValue('');
  await expect(undated.locator('[data-expiry-state]')).toHaveText('Đã xác nhận không rõ hạn dùng');
  expect(posts).toEqual([]);
  await layout(page);
});

test('P2-B receipt review reopened in a fresh document shows the accepted explicit expiry read-only', async ({ page }) => {
  const id = 't13b-preview-receipt';
  await page.goto(`/scan/receipt-review?scanId=${id}`);
  const dated = page.getByTestId('receipt-line').filter({ has: page.locator(`#receipt-name-${id}-0`) });
  await expect(dated).toBeVisible();
  await dated.getByLabel('Hạn dùng trên nhãn').fill('2030-12-31');
  const response = page.waitForResponse((r) => r.url().endsWith(`/scans/${id}/confirm`));
  await page.getByRole('button', { name: 'Nhập 4 món vào Tủ lạnh', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/fridge$/);

  const { scan } = await getJson<ScanResponse>(page, `/api/v1/scans/${id}`);
  expect(scan.status).toBe('confirmed');
  expect(scan.items[0]).toMatchObject({ reviewState: 'CONFIRMED', expiryKind: 'KNOWN', expiryDate: '2030-12-31', expiryEstimated: false });
  expect(scan.items[1]).toMatchObject({ reviewState: 'CONFIRMED', expiryKind: 'UNKNOWN' });

  const posts = countPosts(page);
  await page.goto(`/scan/receipt-review?scanId=${id}`);
  await expect(page.getByRole('status')).toContainText('Hóa đơn đã được xác nhận');
  const reopened = page.getByTestId('receipt-line').filter({ has: page.locator(`#receipt-name-${id}-0`) });
  await expect(reopened.locator(`#receipt-expiry-${id}-0`)).toHaveValue('2030-12-31');
  await expect(reopened.locator(`#receipt-expiry-${id}-0`)).toBeDisabled();
  await expect(reopened.getByTestId('receipt-expiry-status')).toHaveText('Hạn dùng do bạn cung cấp.');
  const undated = page.getByTestId('receipt-line').filter({ has: page.locator(`#receipt-name-${id}-1`) });
  await expect(undated.locator(`#receipt-expiry-${id}-1`)).toHaveValue('');
  await expect(undated.getByTestId('receipt-expiry-status')).toHaveText('Đã xác nhận không rõ hạn dùng.');
  expect(posts).toEqual([]);
  await layout(page);
});
