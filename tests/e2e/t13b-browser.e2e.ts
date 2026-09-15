import { test, expect, reset, control, layout, adopt, getJson } from './t13b/fixtures';
import type { InventoryLotDetail } from '../../src/web/services/inventory-truth';

interface ScanItem {
  id: string; rawName: string; estimatedQuantity: number; unit: string; storage: string;
  reviewState: string; confidence?: number | null;
  rawEvidence: { rawName: string; estimatedQuantity: number; unit: string };
}
interface ScanResponse {
  scan: { id: string; status: string; items: ScanItem[]; merchantName?: string;
    purchaseDate?: string; invoiceNumber?: string; totalAmountVnd?: number };
}
interface Summary { items: InventoryLotDetail[]; inventoryVersion: number }

test.beforeEach(async ({ page }) => { await reset(page); });

test('A receipt corrections retain raw evidence, rejection, confidence and RECEIPT provenance', async ({ page }, info) => {
  await control(page, 't13-scans');
  expect((await adopt(page)).code).toBe(0);
  const scanId = 't13b-preview-receipt';
  await page.goto(`/scan/receipt-review?scanId=${scanId}`);
  await expect(page.getByRole('heading', { name: 'Cửa hàng thử nghiệm' })).toBeVisible();
  await expect(page.getByText('2026-09-12', { exact: true })).toBeVisible();
  await expect(page.getByTestId('receipt-total')).toHaveText('Không có giá');
  await expect(page.getByTestId('receipt-confidence')).toHaveText([
    'Độ tin cậy: chưa rõ', 'Độ tin cậy thấp 0%', 'Độ tin cậy thấp 11%', 'Độ tin cậy 90%',
  ]);
  const before = await getJson<ScanResponse>(page, `/api/v1/scans/${scanId}`);
  expect(before.scan).not.toHaveProperty('invoiceNumber');
  expect(before.scan.items[0]).not.toHaveProperty('confidence');
  const row = page.getByTestId('receipt-line').filter({ has: page.locator(`#receipt-name-${scanId}-0`) });
  await row.getByLabel('Tên sản phẩm').fill('Cà chua đã sửa');
  await row.getByLabel('Số lượng').fill('2');
  await row.getByRole('combobox', { name: 'Đơn vị', exact: true }).selectOption('kg');
  await row.getByRole('combobox', { name: 'Nơi bảo quản', exact: true }).selectOption('freezer');
  await row.getByLabel('Hạn dùng trên nhãn').fill('2030-12-31');
  await row.locator('summary').click();
  await expect(row.getByTestId('receipt-raw-evidence')).toHaveText('OCR gốc: Cà chua · 4 · piece');
  await expect(row.getByTestId('receipt-confirmed-evidence')).toContainText('Cà chua đã sửa · 2 · kg');
  await page.getByRole('button', { name: 'Bỏ qua Nhãn hàng chưa nhận diện', exact: true }).click();
  await layout(page, page.locator('input, select'));
  const confirm = page.getByRole('button', { name: 'Nhập 3 món vào Tủ lạnh', exact: true });
  await confirm.click({ trial: true });
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('receipt-review.png') });
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/confirm')) posts.push(request.url());
  });
  const response = page.waitForResponse((r) => r.url().endsWith(`/scans/${scanId}/confirm`));
  await confirm.click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/fridge$/);
  expect(posts).toHaveLength(1);
  const after = (await getJson<ScanResponse>(page, `/api/v1/scans/${scanId}`)).scan;
  expect(after.status).toBe('confirmed');
  expect(after.items[0]).toMatchObject({ rawName: 'Cà chua đã sửa', estimatedQuantity: 2,
    unit: 'kg', storage: 'freezer', reviewState: 'CONFIRMED', rawEvidence: before.scan.items[0].rawEvidence });
  expect(after.items[2]).toMatchObject({ reviewState: 'REJECTED', rawEvidence: before.scan.items[2].rawEvidence });
  const purchased = (await getJson<Summary>(page, '/api/v1/inventory/summary')).items.filter((lot) => lot.sourceId === scanId);
  expect(purchased).toHaveLength(3);
  expect(purchased.some((lot) => lot.name === 'Nhãn hàng chưa nhận diện')).toBe(false);
  const edited = purchased.find((lot) => lot.name === 'Cà chua đã sửa')!;
  expect(edited).toMatchObject({ quantity: 2000, unit: 'g', storage: 'freezer', sourceType: 'RECEIPT',
    dataSource: 'receipt', purchasedAt: '2026-09-12', expiryKind: 'KNOWN', expiryAt: '2030-12-31', estimatedExpiryAt: null });
  await page.goto(`/ingredients/${edited.id}`);
  await expect(page.getByTestId('lot-provenance')).toHaveText('Từ hóa đơn');
  await expect(page.getByTestId('lot-expiry')).toContainText('2030-12-31');
  await layout(page);
});

test('A missing receipt facts stay unknown, including nullable confidence compatibility', async ({ page }) => {
  await control(page, 't13-scans');
  await page.route('**/api/v1/scans/t13b-preview-undated', async (route) => {
    const response = await route.fetch();
    const body: ScanResponse = await response.json();
    // Only the legacy DTO representation changes; the missing value remains unknown.
    body.scan.items[0].confidence = null;
    await route.fulfill({ response, json: body });
  });
  await page.goto('/scan/receipt-review?scanId=t13b-preview-undated');
  await expect(page.getByRole('heading', { name: 'Không rõ cửa hàng' })).toBeVisible();
  await expect(page.getByText('Không rõ ngày mua', { exact: true })).toBeVisible();
  await expect(page.getByTestId('receipt-total')).toHaveText('Không có giá');
  await expect(page.getByTestId('receipt-confidence').first()).toHaveText('Độ tin cậy: chưa rõ');
  await expect(page.getByTestId('receipt-price')).toHaveText(Array(4).fill('Thành tiền OCR: Không có giá'));
  await layout(page, page.locator('input, select'));
});

test('C fridge corrections commit only accepted rows without invented purchase facts', async ({ page }, info) => {
  await control(page, 't13-scans');
  expect((await adopt(page)).code).toBe(0);
  const id = 't13b-preview-fridge';
  await page.goto(`/scan/${id}/review`);
  const row = page.locator(`[data-scan-item-id="${id}-0"]`);
  await expect(row).toBeVisible();
  await expect(page.getByText('Độ tin cậy: chưa rõ', { exact: true })).toBeVisible();
  await expect(page.getByText('Độ tin cậy thấp 0%', { exact: true })).toBeVisible();
  await expect(page.getByText('Độ tin cậy thấp 11%', { exact: true })).toBeVisible();
  await expect(page.getByText('Độ tin cậy 90%', { exact: true })).toBeVisible();
  const before = (await getJson<ScanResponse>(page, `/api/v1/scans/${id}`)).scan;
  await row.getByLabel('Tên nguyên liệu').fill('Rau đã kiểm tra');
  await row.getByLabel('Số lượng').fill('2');
  await row.getByRole('combobox', { name: 'Đơn vị', exact: true }).selectOption('kg');
  await row.getByRole('combobox', { name: 'Bảo quản', exact: true }).selectOption('freezer');
  await row.locator('input[type="date"]').fill('2030-12-31');
  await page.locator(`[data-scan-item-id="${id}-2"]`).getByRole('button', { name: 'Từ chối dòng này' }).click();
  await layout(page, page.locator('input, select'));
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('fridge-review.png') });
  const response = page.waitForResponse((r) => r.url().endsWith(`/scans/${id}/confirm`));
  await page.getByRole('button', { name: 'Xác nhận nguyên liệu (3 món)', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/fridge$/);
  const after = (await getJson<ScanResponse>(page, `/api/v1/scans/${id}`)).scan;
  expect(after.items[0]).toMatchObject({ rawName: 'Rau đã kiểm tra', estimatedQuantity: 2,
    unit: 'kg', storage: 'freezer', reviewState: 'CONFIRMED', rawEvidence: before.items[0].rawEvidence });
  expect(after.items[2].reviewState).toBe('REJECTED');
  const lots = (await getJson<Summary>(page, '/api/v1/inventory/summary')).items.filter((lot) => lot.sourceId === id);
  expect(lots).toHaveLength(3);
  expect(lots.every((lot) => lot.sourceType === 'SCAN' && lot.purchasedAt === null)).toBe(true);
  expect(lots.find((lot) => lot.name === 'Rau đã kiểm tra')).toMatchObject({
    quantity: 2000, unit: 'g', expiryKind: 'KNOWN', expiryAt: '2030-12-31', estimatedExpiryAt: null,
  });
  expect(lots.some((lot) => lot.name === 'Nhãn hàng chưa nhận diện')).toBe(false);
});

test('F UNKNOWN expiry is distinct; explicit date and storage edit become canonical KNOWN/MOVE', async ({ page }, info) => {
  expect((await adopt(page)).code).toBe(0);
  const id = 'preview-stock-egg';
  await page.goto(`/ingredients/${id}`);
  await expect(page.getByTestId('lot-expiry')).toHaveText('Chưa rõ hạn dùng');
  await expect(page.getByTestId('lot-expiry')).toHaveClass(/bg-slate-100/);
  await expect(page.getByTestId('lot-expiry')).not.toHaveClass(/bg-emerald/);
  await page.getByRole('button', { name: 'Sửa thông tin nguyên liệu' }).click();
  await layout(page, page.locator('form input, form select, form button'));
  await page.screenshot({ path: info.outputPath('unknown-expiry.png') });
  await page.locator('#lot-expiry-input').fill('2030-12-31');
  await page.getByLabel('Chuyển vị trí bảo quản').selectOption('freezer');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sửa thông tin nguyên liệu' })).toBeVisible();
  await expect(page.getByTestId('lot-expiry')).toHaveText('Hạn dùng 2030-12-31');
  const { lot } = await getJson<{ lot: InventoryLotDetail }>(page, `/api/v1/inventory/lots/${id}`);
  expect(lot).toMatchObject({ expiryKind: 'KNOWN', expiryAt: '2030-12-31', estimatedExpiryAt: null, storage: 'freezer' });
});

test('G real stale write shows safe CONFLICT, refetches authority and never retries the mutation', async ({ page }) => {
  expect((await adopt(page)).code).toBe(0);
  const id = 'preview-stock-egg';
  await page.goto(`/ingredients/${id}`);
  await page.getByRole('button', { name: 'Sửa thông tin nguyên liệu' }).click();
  await page.locator('#lot-expiry-input').fill('2030-12-31');
  const { lot } = await getJson<{ lot: InventoryLotDetail }>(page, `/api/v1/inventory/lots/${id}`);
  const competing = await page.evaluate(async ({ id, version }) => {
    const response = await fetch(`/api/v1/inventory/${id}`, { method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 't13b-browser-competing-edit' },
      body: JSON.stringify({ quantity: 7, version }) });
    return response.status;
  }, { id, version: lot.version });
  expect(competing).toBe(200);
  const mutations: string[] = [];
  const reads: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/inventory')) {
      if (['PATCH', 'POST'].includes(request.method())) mutations.push(request.method());
      if (request.method() === 'GET') reads.push(new URL(request.url()).pathname);
    }
  });
  const conflict = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/inventory/${id}`));
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  const response = await conflict;
  expect(response.status()).toBe(409);
  expect((await response.json()).code).toBe('CONFLICT');
  await expect(page.getByRole('alert')).toHaveText('Nguyên liệu vừa được cập nhật ở nơi khác nên thay đổi của bạn chưa được lưu. Đã tải lại trạng thái mới nhất, vui lòng kiểm tra rồi thử lại.');
  await expect(page.getByRole('alert')).toHaveAttribute('data-refetch-state', 'ok');
  await expect.poll(() => reads.filter((path) => path.endsWith(`/lots/${id}`)).length).toBeGreaterThan(0);
  await expect(page.getByText('7 piece', { exact: false })).toBeVisible();
  await expect(page.getByRole('alert')).not.toContainText(/SQL|version|fingerprint|household|\{/);
  expect(mutations).toEqual(['PATCH']);
  const fresh = await getJson<{ lot: InventoryLotDetail }>(page, `/api/v1/inventory/lots/${id}`);
  expect(fresh.lot).toMatchObject({ quantity: 7, expiryKind: 'UNKNOWN', expiryAt: null });
  expect(mutations).toEqual(['PATCH']);
});
