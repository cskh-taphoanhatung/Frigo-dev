import { test, expect, reset, control, adopt, getJson, layout } from './t13b/fixtures';
import type { InventoryLotDetail } from '../../src/web/services/inventory-truth';

test('R11/U14 reconciliation accepts a real T10 proposal and dismisses evidence through the UI', async ({ page }) => {
  await reset(page);
  expect((await adopt(page)).code).toBe(0);
  await control(page, 't13-reconciliation');
  await page.goto('/inventory-reconciliation');
  const egg = page.getByTestId('reconciliation-item').filter({ hasText: 'Trứng kiểm kê thử nghiệm' });
  await expect(egg).toContainText('Đề xuất sửa số lượng');
  await expect(egg.getByRole('button', { name: 'Áp dụng', exact: true })).toBeEnabled();
  await layout(page, page.getByTestId('reconciliation-item').getByRole('button'));
  const applied = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/decision'));
  await egg.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  expect((await applied).status()).toBe(201);
  await expect(egg).toHaveCount(0);
  const { lot } = await getJson<{ lot: InventoryLotDetail }>(page, '/api/v1/inventory/lots/preview-stock-egg');
  expect(lot.quantity).toBe(5);
  const tofu = page.getByTestId('reconciliation-item').filter({ hasText: 'Đậu phụ kiểm kê thử nghiệm' });
  await tofu.getByRole('button', { name: 'Bỏ qua', exact: true }).click();
  await expect(page.getByText('Không có mục nào cần đối chiếu', { exact: true })).toBeVisible();
  const untouched = await getJson<{ lot: InventoryLotDetail }>(page, '/api/v1/inventory/lots/preview-stock-tofu');
  expect(untouched.lot.quantity).toBe(200);
});
