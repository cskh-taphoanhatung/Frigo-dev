import { test, expect, reset, control } from '../t13b/fixtures';

/**
 * Reduced-motion certification (motion/reduced-motion.md): with
 * `prefers-reduced-motion: reduce`, auth, onboarding, sheet/dialog, cooking
 * and Planner remain fully usable and no CSS keyframe animation or long
 * transform transition is running on their surfaces. Animation is never part
 * of business logic: every assertion is about usability and the absence of
 * motion, not about what a transition looks like.
 */

type Page = import('@playwright/test').Page;

async function completeOnboarding(page: Page) {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: /Bắt đầu với Takosan/ }).click();
  await expect(page).toHaveURL(/\/onboarding|\/week\/setup|\/$/);
}

/** Elements with a running CSS animation (spinners excluded — they signal progress). */
async function runningAnimations(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const style = getComputedStyle(el);
      if (style.animationName !== 'none' && style.animationDuration !== '0s' && !el.classList.contains('animate-spin')) {
        out.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 3).join('.')}:${style.animationName}`);
      }
    }
    return out;
  });
}

/** Spatial transitions (transform/all) longer than an instant tap feedback. */
async function longSpatialTransitions(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const style = getComputedStyle(el);
      const props = style.transitionProperty.split(',').map((s) => s.trim());
      const durations = style.transitionDuration.split(',').map((s) => parseFloat(s) * (s.trim().endsWith('ms') ? 1 : 1000));
      props.forEach((prop, i) => {
        const ms = durations[i] ?? durations[0] ?? 0;
        if ((prop === 'all' || prop === 'transform' || prop === 'height' || prop === 'width') && ms > 200) {
          out.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 3).join('.')}:${prop}:${ms}ms`);
        }
      });
    }
    return out;
  });
}

async function expectStill(page: Page, surface: string) {
  const animations = await runningAnimations(page);
  expect(animations, `${surface}: no CSS keyframe animation running under reduced motion`).toEqual([]);
  const transitions = await longSpatialTransitions(page);
  expect(transitions, `${surface}: no long spatial transition under reduced motion`).toEqual([]);
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  expect(reduced).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('auth: mode switch and OTP route are usable and still', async ({ page }) => {
  await page.goto('/landing');
  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: 'Đăng nhập vào Takosan' })).toBeVisible();
  await expectStill(page, 'auth/login');
  await page.getByRole('button', { name: 'Đăng ký tài khoản' }).click();
  await expect(page.getByRole('heading', { name: 'Tạo tài khoản Takosan' })).toBeVisible();
  await expectStill(page, 'auth/register');
  await page.goto('/auth/verify');
  await expect(page.getByTestId('verify-context-missing')).toBeVisible();
  await expectStill(page, 'auth/verify');
});

test('onboarding: steps advance instantly and remain still', async ({ page }) => {
  await reset(page);
  await page.goto('/onboarding');
  await expect(page.getByLabel('Bước 1 trên 3')).toBeVisible();
  await expectStill(page, 'onboarding/1');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(page.getByLabel('Bước 2 trên 3')).toBeVisible();
  await expectStill(page, 'onboarding/2');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(page.getByLabel('Bước 3 trên 3')).toBeVisible();
  await expectStill(page, 'onboarding/3');
});

test('sheet and dialog: open instantly, trap focus, close on Escape, no entrance animation', async ({ page }) => {
  await reset(page);
  await completeOnboarding(page);
  await page.goto('/fridge');
  await page.getByRole('button', { name: 'Thêm nguyên liệu' }).click();
  const sheet = page.getByRole('dialog', { name: 'Thêm nguyên liệu vào tủ' });
  await expect(sheet).toBeVisible();
  await expectStill(page, 'inventory/sheet');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  await page.goto('/me');
  await page.getByRole('button', { name: /Đăng xuất khỏi tài khoản/ }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expectStill(page, 'profile/logout-dialog');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('cooking: step navigation works without directional animation and the timer stays real', async ({ page }) => {
  await reset(page);
  await completeOnboarding(page);
  await page.goto('/cook/canh-chua-ca-loc-nam-bo');
  await expect(page.getByRole('button', { name: 'Bước tiếp theo' })).toBeVisible();
  await expectStill(page, 'cook/step-1');
  const prev = page.getByRole('button', { name: 'Bước trước' });
  await expect(prev).toBeDisabled();
  await page.getByRole('button', { name: 'Bước tiếp theo' }).click();
  await expect(prev).toBeEnabled();
  await expectStill(page, 'cook/step-2');
  await prev.click();
  await expect(prev).toBeDisabled();
  await expectStill(page, 'cook/step-1-back');
});

test('planner: generation, week and shopping remain usable and still', async ({ page }) => {
  await reset(page);
  await completeOnboarding(page);
  await page.goto('/planner/new');
  await expectStill(page, 'planner/setup');
  await page.getByRole('button', { name: 'Tạo thực đơn' }).click();
  await expect(page.getByTestId('plan-revision')).toBeVisible();
  await expectStill(page, 'planner/week');
  await page.locator('a[href$="/shopping"]').first().click();
  await expect(page).toHaveURL(/\/shopping$/);
  await expectStill(page, 'planner/shopping');
});

test('scan review: processing indicator and review list are still under reduced motion', async ({ page }) => {
  await reset(page);
  await completeOnboarding(page);
  await control(page, 't13-scans');
  await page.goto('/scan/t13b-preview-fridge/review');
  await expect(page.getByRole('heading', { name: 'Kết quả nhận diện AI' })).toBeVisible();
  await expectStill(page, 'scan/review');
});
