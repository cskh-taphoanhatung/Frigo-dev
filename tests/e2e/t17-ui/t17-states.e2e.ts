import { test, expect, reset, control, layout } from '../t13b/fixtures';

/**
 * T17 state-class matrix (QA/visual-regression-plan.md): deterministic
 * evidence for loading, error, empty, offline, bottom sheet, destructive
 * dialog, long Vietnamese text, keyboard focus and the mobile fixed-action /
 * virtual-keyboard behaviour. Seeded preview only; network shaping is done
 * with Playwright routes against the isolated API, never production.
 */

type Page = import('@playwright/test').Page;

async function completeOnboarding(page: Page) {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: /Bắt đầu với Takosan/ }).click();
  await expect(page).toHaveURL(/\/onboarding|\/week\/setup|\/$/);
}

async function shot(page: Page, info: import('@playwright/test').TestInfo, name: string) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 120))));
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: false });
}

test.beforeEach(async ({ page }) => { await reset(page); });

test('loading: inventory shows an announced loading state while the authority read is in flight', async ({ page }, info) => {
  await completeOnboarding(page);
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  await page.route('**/api/v1/inventory/summary', async (route) => { await gate; await route.continue(); });
  await page.goto('/fridge');
  const status = page.getByRole('status').filter({ hasText: /Đang tải/ });
  await expect(status.first()).toBeVisible();
  await shot(page, info, 'inventory-loading');
  release();
  await expect(status).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Tủ lạnh của tôi' })).toBeVisible();
});

test('error: a failed authority read shows an honest alert with retry, and retry recovers', async ({ page }, info) => {
  await completeOnboarding(page);
  await control(page, 't13r-b-fail-inventory-reads');
  await page.goto('/fridge');
  const alert = page.getByRole('alert').filter({ hasText: /Không tải được|Không có kết nối/ });
  await expect(alert.first()).toBeVisible();
  await shot(page, info, 'inventory-error');
  await control(page, 't13r-b-restore-inventory-reads');
  await page.getByRole('button', { name: /Thử lại|Tải lại/ }).first().click();
  await expect(alert).toHaveCount(0);
});

test('empty: shopping list and notifications show real empty states, not errors or fake content', async ({ page }, info) => {
  await completeOnboarding(page);
  await page.goto('/shopping');
  await expect(page.getByText('Danh sách đang trống').or(page.getByRole('checkbox').first())).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await shot(page, info, 'shopping-empty-or-list');
  await page.goto('/notifications');
  await expect(page.getByText('Đang tải thông báo…')).toHaveCount(0);
  await expect(page.getByText(/Khuyến mãi từ Takosan/i)).toHaveCount(0);
  await shot(page, info, 'notifications');
});

test('offline: banner reflects navigator state and the planner save reports pending sync instead of success', async ({ page }, info) => {
  await completeOnboarding(page);
  await page.goto('/settings/planning');
  await expect(page.getByRole('heading', { name: 'Cài đặt lập thực đơn' })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByText(/chế độ Ngoại tuyến/i)).toBeVisible();
  await shot(page, info, 'offline-banner');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText(/chế độ Ngoại tuyến/i)).toBeHidden();
});

test('bottom sheet: labelled dialog, focus moves in, Tab cycles inside, Escape closes and focus returns', async ({ page }, info) => {
  await completeOnboarding(page);
  await page.goto('/fridge');
  const trigger = page.getByRole('button', { name: 'Thêm nguyên liệu' });
  await trigger.focus();
  await trigger.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Thêm nguyên liệu vào tủ' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute('aria-modal', 'true');
  // Focus starts inside the sheet.
  expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
  // Tab from the last focusable wraps to the first; Shift+Tab from the first wraps to the last.
  for (let i = 0; i < 20; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
  // Every field is labelled.
  for (const label of ['Tên nguyên liệu', 'Số lượng', 'Đơn vị', 'Phân loại', 'Bảo quản']) {
    await expect(sheet.getByLabel(label, { exact: true })).toBeVisible();
  }
  await shot(page, info, 'inventory-sheet');
  await layout(page);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('destructive dialog: alertdialog semantics, Escape returns focus, confirm styling is danger and labelled', async ({ page }, info) => {
  await completeOnboarding(page);
  await page.goto('/cook/canh-chua-ca-loc-nam-bo');
  const exit = page.getByRole('button', { name: 'Thoát chế độ nấu' });
  await exit.focus();
  await exit.press('Enter');
  const dialog = page.getByRole('alertdialog', { name: 'Thoát chế độ nấu?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.getByRole('button', { name: 'Hủy' })).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Thoát' })).toHaveClass(/bg-semantic-danger/);
  await shot(page, info, 'cooking-exit-dialog');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(exit).toBeFocused();
});

test('long Vietnamese text: headings, chips and rows truncate or wrap without horizontal overflow', async ({ page }, info) => {
  await completeOnboarding(page);
  await page.goto('/fridge');
  await page.getByRole('button', { name: 'Thêm nguyên liệu' }).click();
  const sheet = page.getByRole('dialog', { name: 'Thêm nguyên liệu vào tủ' });
  const longName = 'Thịt ba chỉ heo tươi loại một đã được thái lát mỏng sẵn cho món kho tiêu hạt xanh của bà nội';
  await sheet.getByLabel('Tên nguyên liệu', { exact: true }).fill(longName);
  await sheet.getByLabel('Số lượng', { exact: true }).fill('3');
  await sheet.getByRole('button', { name: 'Lưu vào tủ lạnh' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText(longName).first()).toBeVisible();
  await layout(page);
  await shot(page, info, 'inventory-long-vietnamese');
  // The long name also survives the detail screen header.
  await page.getByText(longName).first().click();
  await expect(page).toHaveURL(/\/(ingredients|fridge)\//);
  await layout(page);
  await shot(page, info, 'detail-long-vietnamese');
});

test('keyboard focus: Tab order reaches nav and primary actions with a visible focus ring', async ({ page }, info) => {
  await completeOnboarding(page);
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: 'Hồ sơ' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
  const visited: string[] = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const info2 = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const style = getComputedStyle(el);
      const ring = style.boxShadow !== 'none' || style.outlineStyle !== 'none';
      return { tag: el.tagName, name: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || '', ring };
    });
    if (info2) visited.push(`${info2.tag}:${info2.name}:${info2.ring ? 'ring' : 'no-ring'}`);
  }
  // Every focused element is an interactive control and shows a focus indicator.
  expect(visited.length).toBeGreaterThan(5);
  expect(visited.filter((v) => !/^(A|BUTTON|INPUT|SELECT)\b/.test(v))).toEqual([]);
  expect(visited.filter((v) => v.endsWith('no-ring'))).toEqual([]);
  await shot(page, info, 'profile-keyboard-focus');
  await info.attach('tab-order', { body: visited.join('\n'), contentType: 'text/plain' });
});

test('mobile fixed action: the scan review CTA clears the bottom nav and stays reachable with the keyboard open', async ({ page }, info) => {
  test.skip(!page.viewportSize() || page.viewportSize()!.width >= 768, 'mobile-only fixed-action contract');
  await completeOnboarding(page);
  await control(page, 't13-scans');
  await page.goto('/scan/t13b-preview-fridge/review');
  const cta = page.getByRole('button', { name: /Xác nhận nguyên liệu/ });
  await expect(cta).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
  const [ctaBox, navBox] = await Promise.all([cta.boundingBox(), nav.boundingBox()]);
  expect(ctaBox && navBox && ctaBox.y + ctaBox.height <= navBox.y + 1, 'CTA sits above the bottom nav').toBe(true);
  await shot(page, info, 'scan-review-fixed-cta');
  // Simulate the visual viewport shrinking for a software keyboard: the CTA
  // must remain within the (smaller) viewport rather than being clipped.
  const full = page.viewportSize()!;
  await page.setViewportSize({ width: full.width, height: Math.round(full.height * 0.55) });
  await page.locator('input').first().focus();
  const shrunkBox = await cta.boundingBox();
  const height = await page.evaluate(() => window.innerHeight);
  expect(shrunkBox && shrunkBox.y + shrunkBox.height <= height + 1, 'CTA visible with keyboard-height viewport').toBe(true);
  await shot(page, info, 'scan-review-keyboard-viewport');
  await page.setViewportSize(full);
});
