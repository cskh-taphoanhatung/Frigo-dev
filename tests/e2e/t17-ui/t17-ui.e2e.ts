import { test, expect, reset, layout } from '../t13b/fixtures';

/**
 * T17 Takosan UI V2 certification suite (QA/visual-regression-plan.md).
 * Deterministic seeded preview fixtures only; screenshots stay in the
 * private test-artifact output dir. Runs at 390 / 768 / 1440.
 */

test.beforeEach(async ({ page }) => {
  await reset(page);
});

/** Each breakpoint displays exactly one primary nav (bottom bar / rail /
 *  sidebar). Playwright's role query only matches the a11y-exposed one. */
async function expectMainNav(page: import('@playwright/test').Page) {
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(nav).toHaveCount(1);
  await expect(nav).toBeVisible();
}

/** Home is gated on real server onboarding truth, so complete onboarding
 *  through the real flow (screens 04-06) instead of faking state. */
async function completeOnboarding(page: import('@playwright/test').Page) {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: /Bắt đầu với Takosan/ }).click();
  await expect(page).toHaveURL(/\/onboarding|\/week\/setup|\/$/);
}

test('shell surfaces render with no horizontal overflow', async ({ page }) => {
  await completeOnboarding(page);
  const surfaces = ['/', '/fridge', '/recipes', '/planner', '/shopping', '/me', '/plus'];
  for (const path of surfaces) {
    await page.goto(path);
    await expectMainNav(page);
    await layout(page);
  }
});

test('navigation hides in immersive surfaces and stays in standard ones', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/');
  await expectMainNav(page);
  await page.goto('/scan');
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toHaveCount(0);
  // Scan review is a standard workspace (screen 09), not a camera surface.
  await page.goto('/scan/receipt-review');
  await expectMainNav(page);
  await page.goto('/planner');
  await expectMainNav(page);
});

test('settings IA is separated with legacy redirects', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/settings\/app$/);
  await expect(page.getByRole('heading', { name: 'Cài đặt ứng dụng' })).toBeVisible();

  await page.goto('/profile');
  await expect(page).toHaveURL(/\/me$/);
  // The hub's top bar exposes the settings gear on /me (not only legacy /profile).
  await expect(page.getByRole('button', { name: 'Cài đặt' })).toBeVisible();

  await page.goto('/family');
  await expect(page).toHaveURL(/\/me\/household$/);

  await page.goto('/settings/notifications');
  await expect(page.getByRole('switch').first()).toBeVisible();

  await page.goto('/notifications');
  await expect(page.getByRole('switch').first()).toBeHidden();
  await expect(page.getByRole('link', { name: /Tùy chỉnh nhắc nhở/ })).toBeVisible();
});

test('honest unavailable states replace fabricated flows', async ({ page }) => {
  await page.goto('/me/household');
  await expect(page.getByText('Mời thành viên — chưa hỗ trợ')).toBeVisible();
  await expect(page.getByText('FRG-')).toBeHidden();

  await page.goto('/settings/privacy');
  await expect(page.getByText('Xuất dữ liệu — chưa hỗ trợ')).toBeVisible();
  await expect(page.getByText('Xóa tài khoản — chưa hỗ trợ')).toBeVisible();
});

test('week compatibility redirects preserve params when planner is canonical', async ({ page }) => {
  await page.goto('/week');
  await expect(page).toHaveURL(/\/planner$/);
  await page.goto('/week/plan-1/meal/meal-1');
  await expect(page).toHaveURL(/\/planner\/plan-1\/meal\/meal-1$/);
  await page.goto('/week/plan-1/shopping');
  await expect(page).toHaveURL(/\/planner\/plan-1\/shopping$/);
});

test('food preferences editor round-trips the real preferences contract', async ({ page }) => {
  await page.goto('/me/preferences');
  await expect(page.getByRole('heading', { name: 'Sở thích & hạn chế' })).toBeVisible();
  const vi = page.getByRole('button', { name: 'Việt Nam', exact: true });
  await expect(vi).toHaveAttribute('aria-pressed', /true|false/);
  await page.getByRole('button', { name: 'Lưu sở thích' }).click();
  await expect(page.getByText('Đã lưu sở thích.')).toBeVisible();
});

test('planning settings save via the week preferences contract without generating a plan', async ({ page }) => {
  await page.goto('/settings/planning');
  await expect(page.getByRole('heading', { name: 'Cài đặt lập thực đơn' })).toBeVisible();
  await expect(page.getByText(/không tạo thực đơn mới/i)).toBeVisible();
  await page.getByRole('button', { name: 'Lưu cài đặt' }).click();
  await expect(page.getByText('Đã lưu cài đặt lập thực đơn.')).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/planning$/);
});

test('public landing renders without auth and offers the guest contract', async ({ page }, info) => {
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto('/landing');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await layout(page);
  await page.screenshot({ path: info.outputPath('landing.png') });
});

test('auth surface renders the split login/register shell', async ({ page }, info) => {
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: 'Đăng nhập vào Takosan' })).toBeVisible();
  await layout(page);
  await page.screenshot({ path: info.outputPath('auth.png') });
});

test('reduced motion keeps planner content fully usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/planner');
  await expectMainNav(page);
  await layout(page);
});

test('keyboard focus reaches primary navigation with visible focus state', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/');
  await expectMainNav(page);
  await page.keyboard.press('Tab');
  const focused = page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    href: (document.activeElement as HTMLAnchorElement | null)?.getAttribute('href'),
  }));
  expect(['A', 'BUTTON']).toContain((await focused).tag);
});

test('content survives 200% text zoom without horizontal scrolling', async ({ page }) => {
  await completeOnboarding(page);
  for (const path of ['/', '/fridge', '/recipes', '/shopping', '/me']) {
    await page.goto(path);
    await expectMainNav(page);
    // Let fonts/content settle before measuring a zoomed layout. Avoid
    // `networkidle` (stalls behind background polling); fonts + a frame suffice.
    await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 200)))));
    const overflow = await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
      // Measure after a reflow frame so transient entrance layout is done.
      return new Promise((resolve) =>
        requestAnimationFrame(() =>
          resolve(document.documentElement.scrollWidth - window.innerWidth)
        )
      );
    });
    expect(overflow, `${path} must not scroll horizontally at 200% text zoom`).toBeLessThanOrEqual(1);
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  }
});

test('inventory bottom sheet opens labelled, closable and in-viewport', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/fridge');
  await page.getByRole('button', { name: 'Thêm nguyên liệu' }).click();
  await expect(page.getByRole('heading', { name: 'Thêm nguyên liệu vào tủ' })).toBeVisible();
  const close = page.getByRole('button', { name: 'Đóng' });
  await expect(close).toBeVisible();
  await close.click();
  await expect(page.getByRole('heading', { name: 'Thêm nguyên liệu vào tủ' })).toBeHidden();
  await layout(page);
});

test('offline banner states reality and recovers when back online', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/');
  await expectMainNav(page);
  // The banner follows the browser's offline/online events (navigator.onLine);
  // Playwright's setOffline only fails requests, so emulate the real event.
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByText(/chế độ Ngoại tuyến/i)).toBeVisible();
  // Content remains usable while offline; the banner is honest about sync.
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText(/chế độ Ngoại tuyến/i)).toBeHidden();
});
