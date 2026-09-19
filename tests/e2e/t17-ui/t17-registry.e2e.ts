import { test, expect, reset, control, layout } from '../t13b/fixtures';
import { SCREEN_REGISTRY } from './screen-registry';

/**
 * Mechanical certification of every registered screen (SCREEN_REGISTRY):
 * the route resolves in the real router, renders its visible proof, respects
 * the navigation rule for its class, and shows no horizontal overflow. Real
 * server truth only: onboarding is completed through the UI, a plan is
 * generated through the planner, and scan review uses seeded T13 evidence.
 */

async function completeOnboarding(page: import('@playwright/test').Page) {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: /Bắt đầu với Takosan/ }).click();
  await expect(page).toHaveURL(/\/onboarding|\/week\/setup|\/$/);
}

async function generatePlan(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/planner/new');
  const created = page.waitForResponse((r) => r.url().endsWith('/plans') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Tạo thực đơn' }).click();
  const plan = await (await created).json() as { id: string };
  await expect(page.getByTestId('plan-revision')).toBeVisible();
  return plan.id;
}

async function settle(page: import('@playwright/test').Page) {
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 150)))));
}

function nav(page: import('@playwright/test').Page) {
  return page.getByRole('navigation', { name: 'Điều hướng chính' });
}

test.describe('screen registry certification', () => {
  test('all 27 registered screens resolve, render their proof and follow the nav rule', async ({ page }, info) => {
    test.setTimeout(240_000);
    const results: Array<{ id: string; name: string; path: string; ok: boolean; note?: string }> = [];

    // Public surfaces without any session.
    await page.goto('/landing');
    await page.context().clearCookies();
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    for (const screen of SCREEN_REGISTRY.filter((s) => s.auth === 'public')) {
      await page.goto(screen.path);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(screen.proof.heading!);
      await expect(nav(page)).toHaveCount(0);
      await layout(page);
      results.push({ id: screen.id, name: screen.name, path: screen.path, ok: true });
    }
    // Screen 03 without context is the honest empty state, never an OTP form.
    await page.goto('/auth/verify');
    await expect(page.getByTestId('verify-context-missing')).toBeVisible();
    await expect(page.locator('input[inputmode="numeric"]')).toHaveCount(0);

    // Session surfaces on real seeded truth.
    await reset(page);
    for (const screen of SCREEN_REGISTRY.filter((s) => s.id >= '04' && s.id <= '06')) {
      await page.goto(screen.path);
      await expect(page.getByLabel(screen.proof.text!)).toBeVisible();
      await expect(nav(page)).toHaveCount(0);
      await layout(page);
      results.push({ id: screen.id, name: screen.name, path: screen.path, ok: true });
    }
    await completeOnboarding(page);
    // Seeded T13 review evidence gives screen 09 a real pending scan.
    await control(page, 't13-scans');
    const planId = await generatePlan(page);
    // Seeded inventory lot (planner-preview-fixtures) for screen 11.
    const lot = 'preview-stock-egg';

    const params: Record<string, string> = {
      ':id': 't13b-preview-fridge',
      // Real catalog slug (recipe authority snapshot); the preview DB rows are not
      // part of the catalog, so `preview-chicken` would render the 404 state.
      ':slug': 'canh-chua-ca-loc-nam-bo',
      ':planId': planId,
      ':slotId': '',
    };
    for (const screen of SCREEN_REGISTRY.filter((s) => s.auth === 'session' && !(s.id >= '04' && s.id <= '06'))) {
      let path = screen.path;
      if (screen.id === '11') path = `/fridge/${lot}`;
      else if (screen.id === '17') {
        // Slot ids come from the generated plan: follow the real link.
        await page.goto(`/planner/${planId}`);
        const meal = page.locator('a[href*="/meal/"]').first();
        await expect(meal).toBeVisible();
        path = (await meal.getAttribute('href'))!;
      } else {
        for (const [key, value] of Object.entries(params)) path = path.replace(key, value);
      }
      await page.goto(path);
      const proof = screen.proof;
      if (proof.heading) {
        await expect(page.getByRole('heading', { name: proof.heading }).first()).toBeVisible();
      } else if (proof.text) {
        await expect(page.getByText(proof.text).first()).toBeVisible();
      } else if (proof.testId) {
        await expect(page.getByTestId(proof.testId)).toBeVisible();
      }
      if (screen.nav === 'visible') {
        await expect(nav(page)).toHaveCount(1);
        await expect(nav(page)).toBeVisible();
      } else {
        await expect(nav(page)).toHaveCount(0);
      }
      await settle(page);
      await layout(page);
      results.push({ id: screen.id, name: screen.name, path, ok: true });
    }

    expect(results).toHaveLength(27);
    expect(new Set(results.map((r) => r.id)).size).toBe(27);
    await info.attach('screen-registry-results', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  });

  test('legacy and redirect routes land on registered screens', async ({ page }) => {
    await reset(page);
    for (const [from, to] of [
      ['/profile', /\/me$/], ['/family', /\/me\/household$/], ['/settings', /\/settings\/app$/],
      ['/inventory', /\/fridge$/], ['/week', /\/planner$/], ['/week/setup', /\/planner\/new$/],
    ] as const) {
      await page.goto(from);
      await expect(page).toHaveURL(to);
    }
    await page.goto('/ingredients/preview-stock-egg');
    await expect(page.getByTestId('lot-expiry')).toBeVisible();
  });
});
