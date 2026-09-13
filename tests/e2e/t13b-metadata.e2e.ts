import { test, expect, reset, adopt, getJson, layout } from './t13b/fixtures';
import type { InventoryLotDetail } from '../../src/web/services/inventory-truth';

test('U7 edits existing lot name, compatible unit, category, storage and expiry through T09', async ({ page }, info) => {
  await reset(page);
  expect((await adopt(page)).code).toBe(0);
  const id = 'preview-stock-chicken';
  const { lot: before } = await getJson<{ lot: InventoryLotDetail }>(page, `/api/v1/inventory/lots/${id}`);
  await page.goto(`/ingredients/${id}`);
  await page.getByRole('button', { name: /Sửa (hạn dùng & vị trí|thông tin nguyên liệu)/ }).click();
  await expect(page.getByLabel('Tên nguyên liệu', { exact: true })).toBeVisible();
  await page.getByLabel('Tên nguyên liệu', { exact: true }).fill('Thịt gà đã kiểm tra');
  await page.getByRole('combobox', { name: 'Đơn vị', exact: true }).selectOption('piece');
  const mutations: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && request.url().endsWith(`/inventory/${id}`)) mutations.push(request.url());
  });
  const mismatch = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/inventory/${id}`));
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  const rejected = await mismatch;
  expect(rejected.status()).toBe(422);
  expect((await rejected.json()).code).toBe('UNIT_MISMATCH');
  await expect(page.getByRole('alert')).toHaveText('Không thể quy đổi đơn vị này sang đơn vị đang lưu trong tủ.');
  await expect(page.getByLabel('Tên nguyên liệu', { exact: true })).toHaveValue('Thịt gà đã kiểm tra');
  expect(mutations).toHaveLength(1);
  expect((await getJson<{ lot: InventoryLotDetail }>(page, `/api/v1/inventory/lots/${id}`)).lot).toEqual(before);
  await page.getByRole('combobox', { name: 'Đơn vị', exact: true }).selectOption('kg');
  await page.getByRole('combobox', { name: 'Danh mục', exact: true }).selectOption('other');
  await page.getByLabel('Chuyển vị trí bảo quản').selectOption('freezer');
  await page.getByLabel('Hạn sử dụng chính xác').fill('2030-12-31');
  await layout(page, page.locator('form input, form select, form button'));
  await page.locator('form').screenshot({ path: info.outputPath('lot-metadata.png') });
  const response = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/inventory/${id}`));
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  const saved = await response;
  expect(saved.status()).toBe(200);
  expect(saved.request().postDataJSON()).toMatchObject({ name: 'Thịt gà đã kiểm tra', unit: 'kg',
    category: 'other', storage: 'freezer', expiryDate: '2030-12-31', expiryEstimated: false });
  expect(mutations).toHaveLength(2);
  await expect(page.getByRole('heading', { name: 'Thịt gà đã kiểm tra', exact: true }).first()).toBeVisible();
  const { lot: after } = await getJson<{ lot: InventoryLotDetail }>(page, `/api/v1/inventory/lots/${id}`);
  expect(after).toMatchObject({ name: 'Thịt gà đã kiểm tra', category: 'other', storage: 'freezer',
    expiryKind: 'KNOWN', expiryAt: '2030-12-31', estimatedExpiryAt: null,
    lotId: before.lotId, sourceType: before.sourceType, sourceId: before.sourceId,
    quantityMilli: before.quantityMilli, canonicalUnit: before.canonicalUnit });
  expect(after.lotVersion).toBeGreaterThan(before.lotVersion);
  await page.getByRole('button', { name: /Sửa (hạn dùng & vị trí|thông tin nguyên liệu)/ }).click();
  await expect(page.getByLabel('Tên nguyên liệu', { exact: true })).toHaveValue(after.name);
  await expect(page.getByRole('combobox', { name: 'Danh mục', exact: true })).toHaveValue('other');
});
