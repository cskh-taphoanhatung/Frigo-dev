import { test, expect, reset, adopt, getJson, navigate } from './t13b/fixtures';
import type { InventoryLotDetail } from '../../src/web/services/inventory-truth';

type ScanItem = { id: string; rawName: string; reviewState: 'PENDING' | 'CONFIRMED' | 'REJECTED' };
type ScanResponse = { scan: { id: string; status: string; items: ScanItem[] } };
type ScenarioIds = { receiptPurchase: string; receiptMissingHeader: string };

// T13R-A P1-3: a lot edit draft is bound to its lot. The same-document
// history navigation the independent review used (chicken → tofu) must not
// let the chicken draft be saved into tofu.
test('P1-3 chicken draft cannot be saved into tofu after a same-document route change', async ({ page }) => {
  await reset(page);
  expect((await adopt(page)).code).toBe(0);
  const chicken = 'preview-stock-chicken';
  const tofu = 'preview-stock-tofu';
  const { lot: tofuBefore } = await getJson<{ lot: InventoryLotDetail }>(page, `/api/v1/inventory/lots/${tofu}`);
  const { lot: chickenBefore } = await getJson<{ lot: InventoryLotDetail }>(page, `/api/v1/inventory/lots/${chicken}`);
  const patches: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && request.url().includes('/inventory/')) patches.push(new URL(request.url()).pathname);
  });

  await page.goto(`/ingredients/${chicken}`);
  await page.getByRole('button', { name: /Sửa (hạn dùng & vị trí|thông tin nguyên liệu)/ }).click();
  await page.getByLabel('Tên nguyên liệu', { exact: true }).fill('Ức gà chỉ dành cho gà');
  await navigate(page, `/ingredients/${tofu}`);
  await expect(page.getByRole('heading', { name: 'Đậu phụ', exact: true }).first()).toBeVisible();
  // The chicken draft is gone with the route; tofu opens read-only.
  await expect(page.getByLabel('Tên nguyên liệu', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Ức gà chỉ dành cho gà')).toHaveCount(0);

  await page.getByRole('button', { name: /Sửa (hạn dùng & vị trí|thông tin nguyên liệu)/ }).click();
  await expect(page.getByLabel('Tên nguyên liệu', { exact: true })).toHaveValue('Đậu phụ');
  await expect(page.locator('form')).toHaveAttribute('data-draft-owner', tofu);
  await page.getByLabel('Tên nguyên liệu', { exact: true }).fill('Đậu phụ đã kiểm tra');
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/inventory/${tofu}`));
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Đậu phụ đã kiểm tra', exact: true }).first()).toBeVisible();

  expect(patches).toEqual([`/api/v1/inventory/${tofu}`]);
  const { lot: tofuAfter } = await getJson<{ lot: InventoryLotDetail }>(page, `/api/v1/inventory/lots/${tofu}`);
  const { lot: chickenAfter } = await getJson<{ lot: InventoryLotDetail }>(page, `/api/v1/inventory/lots/${chicken}`);
  expect(tofuAfter).toMatchObject({ name: 'Đậu phụ đã kiểm tra', ingredientId: 'TOFU', quantityMilli: tofuBefore.quantityMilli });
  // inventoryVersion is household-wide and legitimately advanced with the tofu save; the chicken lot itself is untouched.
  const { inventoryVersion: _before, ...chickenLotBefore } = chickenBefore;
  const { inventoryVersion: _after, ...chickenLotAfter } = chickenAfter;
  expect(chickenLotAfter).toEqual(chickenLotBefore);

  // Back to chicken: its own detail, no stale draft or error.
  await navigate(page, `/ingredients/${chicken}`);
  await expect(page.getByRole('heading', { name: 'Ức gà', exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('Tên nguyên liệu', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

// T13R-A P1-4: the receipt review trusts only a scan DTO whose id equals the
// route's scanId. A same-household B DTO delivered as the answer to A's GET
// (the review's adversarial probe) must neither render nor be confirmable.
test('P1-4 receipt review refuses a mismatched scan response and never confirms it', async ({ page }) => {
  await reset(page);
  const ids = await page.evaluate(async () => {
    const response = await fetch('/__preview/t13-scenarios', { method: 'POST' });
    if (!response.ok) throw new Error(`Preview control failed: ${response.status}`);
    return response.json() as Promise<ScenarioIds>;
  });
  const a = ids.receiptPurchase;
  const b = ids.receiptMissingHeader;
  const { scan: bScan } = await getJson<ScanResponse>(page, `/api/v1/scans/${b}`);
  const { scan: aScan } = await getJson<ScanResponse>(page, `/api/v1/scans/${a}`);
  expect(bScan.items.length).toBeGreaterThan(0);
  const bName = bScan.items[0].rawName;
  const aName = aScan.items[0].rawName;

  // Adversarial transport: A's GET is answered with B's real DTO.
  let swaps = 0;
  await page.route(`**/api/v1/scans/${a}`, async (route) => {
    if (route.request().method() !== 'GET') { await route.continue(); return; }
    swaps += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ scan: bScan }) });
  });
  const confirms: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/confirm')) confirms.push(new URL(request.url()).pathname);
  });

  await page.goto(`/scan/receipt-review?scanId=${a}`);
  await expect.poll(() => swaps).toBeGreaterThan(0);
  await expect(page.getByRole('alert')).toContainText('không khớp');
  await expect(page.getByText(bName, { exact: false })).toHaveCount(0);
  await expect(page.getByTestId('receipt-line')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Nhập .* vào Tủ lạnh/ })).toBeDisabled();
  await page.getByRole('button', { name: /Nhập .* vào Tủ lạnh/ }).click({ force: true });
  expect(confirms).toEqual([]);

  // Both receipts are untouched on the server.
  await page.unroute(`**/api/v1/scans/${a}`);
  const { scan: aAfter } = await getJson<ScanResponse>(page, `/api/v1/scans/${a}`);
  const { scan: bAfter } = await getJson<ScanResponse>(page, `/api/v1/scans/${b}`);
  expect(aAfter.status).toBe('ready');
  expect(bAfter.status).toBe('ready');
  expect(aAfter.items.every((item) => item.reviewState === 'PENDING')).toBe(true);
  expect(bAfter.items.every((item) => item.reviewState === 'PENDING')).toBe(true);

  // With honest transport, A renders A and can be reviewed normally.
  await page.getByRole('button', { name: 'Thử tải lại' }).click();
  await expect(page.getByTestId('receipt-line').first()).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Tên sản phẩm' }).first()).toHaveValue(aName);
  await expect(page.getByRole('textbox', { name: 'Tên sản phẩm' })).toHaveCount(aScan.items.length);
  await expect(page.getByText(bName, { exact: false })).toHaveCount(0);
});
