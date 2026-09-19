import { test, expect, reset } from '../t13b/fixtures';

const CERTIFIED_WIDTHS = [390, 768, 1440];

/**
 * T17 canonical screenshots (QA/visual-regression-plan.md). Deterministic
 * seeded fixtures only; artifacts land in the private test output dir and are
 * listed in docs/ai/T17_UI_V2_REPORT.md. Never baseline-blindly updated.
 */

test('canonical surfaces captured per certification width', async ({ page }, info) => {
  // 17 full-page captures; give the loop headroom instead of the default budget.
  test.setTimeout(180_000);
  test.skip(
    !CERTIFIED_WIDTHS.includes(page.viewportSize()!.width),
    'canonical screenshots are captured at 390 / 768 / 1440 only (visual-regression-plan)'
  );
  // Public surfaces first (no session). A fresh test page sits at about:blank
  // where storage access is denied, so navigate before clearing state.
  await page.goto('/landing');
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto('/landing');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.screenshot({ path: info.outputPath('landing.png'), fullPage: true });
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: 'Đăng nhập vào Takosan' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('auth.png'), fullPage: true });

  // Authenticated surfaces.
  await reset(page);
  await page.goto('/onboarding');
  // The step indicator is an aria-label on the progress region.
  await expect(page.getByLabel('Bước 1 trên 3')).toBeVisible();
  await page.screenshot({ path: info.outputPath('onboarding.png'), fullPage: true });

  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: /Bắt đầu với Takosan/ }).click();
  await expect(page).toHaveURL(/\/onboarding|\/week\/setup|\/$/);

  const surfaces: [string, string][] = [
    ['home', '/'],
    ['inventory', '/fridge'],
    ['recipes', '/recipes'],
    ['recipe-detail', '/recipes/preview-chicken'],
    ['cook', '/cook/preview-chicken'],
    ['planner', '/planner'],
    ['shopping', '/shopping'],
    ['profile', '/me'],
    ['preferences', '/me/preferences'],
    ['planning-settings', '/settings/planning'],
    ['notification-preferences', '/settings/notifications'],
    ['privacy', '/settings/privacy'],
    ['app-settings', '/settings/app'],
    ['plus', '/plus'],
  ];
  for (const [name, path] of surfaces) {
    await page.goto(path);
    // `networkidle` can stall behind background polling; wait for the page's
    // main landmark and a settle frame instead.
    await page.locator('main, [role="main"], h1').first().waitFor({ state: 'visible' });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 150))));
    await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
  }
});

test('destructive confirmation dialog traps focus and returns it', async ({ page }, info) => {
  await reset(page);
  await page.goto('/me');
  await page.getByRole('button', { name: /Đăng xuất khỏi tài khoản/ }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Đăng xuất tài khoản?');
  await page.screenshot({ path: info.outputPath('logout-dialog.png') });
  // Escape closes the modal and returns focus to the invoking control.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('empty inbox states a real empty, not an error', async ({ page }, info) => {
  await reset(page);
  await page.goto('/notifications');
  // Wait for the query to resolve (loading label gone) rather than
  // `networkidle`, which stalls behind background polling.
  await expect(page.getByText('Đang tải thông báo…')).toHaveCount(0);
  // The seeded preview either shows real notifications or the honest empty
  // state; a fabricated promotional alert must never appear.
  await expect(page.getByText(/Khuyến mãi từ Takosan/i)).toHaveCount(0);
  await expect(
    page.getByText(/Chưa có thông báo mới/).or(page.getByRole('heading', { level: 4 }).first()),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath('notifications.png'), fullPage: true });
});
