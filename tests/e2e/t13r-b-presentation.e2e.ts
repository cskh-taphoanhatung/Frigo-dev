import { test, expect, reset, adopt, control, getJson } from './t13b/fixtures';
import type { InventoryLotDetail } from '../../src/web/services/inventory-truth';

// T13R-B browser coverage (independent review P2-4 / P2-5 / P2-6), on the
// repository-owned isolated Worker/SQLite harness with the real UI.

async function mutationCounter(page: import('@playwright/test').Page) {
  const mutations: string[] = [];
  const reads: string[] = [];
  page.on('request', (request) => {
    if (!request.url().includes('/api/v1/inventory')) return;
    if (['PATCH', 'POST', 'DELETE'].includes(request.method())) mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
    if (request.method() === 'GET') reads.push(new URL(request.url()).pathname);
  });
  return { mutations, reads };
}

test('A stale inventory-list conflict: one PATCH, conflict copy, authoritative refetch replaces stale stock', async ({ page }) => {
  await reset(page);
  expect((await adopt(page)).code).toBe(0);
  const id = 'preview-stock-egg';
  await page.goto('/fridge');
  const row = page.locator(`[data-testid="inventory-row"][data-item-id="${id}"]`);
  await expect(row).toBeVisible();
  await expect(row).toContainText('2 piece');
  // A competing device writes first (real PATCH against the real authority).
  const { lot } = await getJson<{ lot: InventoryLotDetail }>(page, `/api/v1/inventory/lots/${id}`);
  const competing = await page.evaluate(async ({ id, version }) => {
    const response = await fetch(`/api/v1/inventory/${id}`, { method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 't13r-b-list-competing-edit' },
      body: JSON.stringify({ quantity: 7, version }) });
    return response.status;
  }, { id, version: lot.version });
  expect(competing).toBe(200);
  const { mutations, reads } = await mutationCounter(page);
  const conflict = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/inventory/${id}`));
  await row.getByRole('button', { name: 'Tăng số lượng' }).click();
  const response = await conflict;
  expect(response.status()).toBe(409);
  expect((await response.json()).code).toBe('CONFLICT');
  await expect(page.getByRole('alert')).toContainText('Nguyên liệu vừa được cập nhật ở nơi khác');
  await expect(page.getByRole('alert')).toContainText('Đã tải lại trạng thái mới nhất');
  await expect(page.getByRole('alert')).toHaveAttribute('data-refetch-state', 'ok');
  await expect(page.getByRole('alert')).not.toContainText(/SQL|fingerprint|household|\{/);
  await expect(row).toContainText('7 piece');
  await expect(row).not.toContainText('2 piece');
  await expect.poll(() => reads.filter((path) => path === '/api/v1/inventory').length).toBeGreaterThan(0);
  expect(mutations).toEqual([`PATCH /api/v1/inventory/${id}`]);
  const fresh = await getJson<{ lot: InventoryLotDetail }>(page, `/api/v1/inventory/lots/${id}`);
  expect(fresh.lot.quantity).toBe(7);
});

test('B conflict with a failed authoritative refetch never claims the latest state was loaded and recovers by explicit reload', async ({ page }) => {
  await reset(page);
  expect((await adopt(page)).code).toBe(0);
  const id = 'preview-stock-egg';
  await page.goto(`/ingredients/${id}`);
  await page.getByRole('button', { name: 'Sửa thông tin nguyên liệu' }).click();
  await page.locator('#lot-expiry-input').fill('2030-12-31');
  const { lot } = await getJson<{ lot: InventoryLotDetail }>(page, `/api/v1/inventory/lots/${id}`);
  const competing = await page.evaluate(async ({ id, version }) => {
    const response = await fetch(`/api/v1/inventory/${id}`, { method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 't13r-b-detail-competing-edit' },
      body: JSON.stringify({ quantity: 7, version }) });
    return response.status;
  }, { id, version: lot.version });
  expect(competing).toBe(200);
  // Arm authoritative read failures; mutations stay real. Restored below.
  await control(page, 't13r-b-fail-inventory-reads');
  const { mutations, reads } = await mutationCounter(page);
  const conflict = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/inventory/${id}`));
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  expect((await conflict).status()).toBe(409);
  await expect(page.getByRole('alert')).toHaveAttribute('data-refetch-state', 'failed');
  await expect(page.getByRole('alert')).toContainText('Nguyên liệu vừa được cập nhật ở nơi khác');
  await expect(page.getByRole('alert')).toContainText('Chưa tải lại được');
  await expect(page.getByRole('alert')).not.toContainText('Đã tải lại trạng thái mới nhất');
  await expect(page.getByRole('alert')).not.toContainText(/PREVIEW_READ_FAILURE|synthetic|\{/);
  // The stale quantity is still on screen and honestly flagged; no second mutation.
  await expect(page.getByText('2 piece', { exact: false })).toBeVisible();
  expect(reads.filter((path) => path.endsWith(`/lots/${id}`)).length).toBeGreaterThan(0);
  expect(mutations).toEqual([`PATCH /api/v1/inventory/${id}`]);
  // Reads recover; the explicit read-only reload replaces the stale stock.
  await control(page, 't13r-b-restore-inventory-reads');
  await page.getByRole('button', { name: 'Tải lại trạng thái mới nhất' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('7 piece', { exact: false })).toBeVisible();
  expect(mutations).toEqual([`PATCH /api/v1/inventory/${id}`]);
});

test('C Home shows an explicit estimate qualifier for an ESTIMATED expiry and no unqualified countdown', async ({ page }) => {
  await reset(page);
  expect((await adopt(page)).code).toBe(0);
  const inventory = await getJson<{ items: Array<{ id: string; name: string; expiryKind: string; freshness: string }> }>(page, '/api/v1/inventory');
  const spinach = inventory.items.find((item) => item.id === 'preview-stock-spinach');
  expect(spinach).toMatchObject({ expiryKind: 'ESTIMATED' });
  expect(['use_soon', 'expiring']).toContain(spinach!.freshness);
  // Home is gated on server-authoritative onboarding (migration 0038): a
  // client-side `frigo_onboarded` shim is overwritten on hydrate, so complete
  // the real onboarding flow instead of faking state.
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: /Bắt đầu với Takosan/ }).click();
  await expect(page).toHaveURL(/\/onboarding|\/week\/setup|\/$/);
  await page.goto('/');
  const chip = page.getByTestId('home-use-soon-expiry').filter({ hasText: /Ước tính/ });
  await expect(chip.first()).toBeVisible();
  await expect(chip.first()).toHaveAttribute('data-expiry-kind', 'ESTIMATED');
  await expect(chip.first()).toHaveText(/Ước tính còn \d+ ngày|Ước tính hết hạn hôm nay/);
  // No ESTIMATED chip anywhere renders the bare KNOWN countdown form.
  for (const element of await page.getByTestId('home-use-soon-expiry').all()) {
    const kind = await element.getAttribute('data-expiry-kind');
    const text = (await element.textContent()) ?? '';
    if (kind === 'ESTIMATED') expect(text).toContain('Ước tính');
    if (kind === 'KNOWN') expect(text).not.toContain('Ước tính');
    if (kind === 'UNKNOWN') expect(text).toBe('Chưa rõ hạn dùng');
  }
  await expect(page.getByText('Rau muống', { exact: true }).first()).toBeVisible();
});

test('D/E ingredient detail renders NULL openedAt as no information and a recorded openedAt as its date', async ({ page }) => {
  await reset(page);
  expect((await adopt(page)).code).toBe(0);
  const { lot: egg } = await getJson<{ lot: InventoryLotDetail }>(page, '/api/v1/inventory/lots/preview-stock-egg');
  expect(egg.openedAt).toBeNull();
  await page.goto('/ingredients/preview-stock-egg');
  await expect(page.getByTestId('lot-opened')).toHaveText('Chưa có thông tin');
  await expect(page.getByText('Chưa mở', { exact: true })).toHaveCount(0);

  const { lot: cheese } = await getJson<{ lot: InventoryLotDetail }>(page, '/api/v1/inventory/lots/preview-stock-cheese');
  expect(cheese.openedAt).toBe('2026-09-11T08:30:00Z');
  await page.goto('/ingredients/preview-stock-cheese');
  await expect(page.getByTestId('lot-opened')).toHaveText('Đã mở 2026-09-11');
});
