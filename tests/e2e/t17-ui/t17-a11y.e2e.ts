import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, reset, control } from '../t13b/fixtures';

/**
 * Accessibility certification (QA/accessibility-checklist.md) over every
 * canonical surface: axe-core WCAG 2.x A/AA rules, heading structure, image
 * alternatives, 44×44 targets, and OTP announcement semantics. Findings are
 * attached verbatim; the gate fails on any serious/critical violation.
 */

type Page = import('@playwright/test').Page;

async function completeOnboarding(page: Page) {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: /Bắt đầu với Takosan/ }).click();
  await expect(page).toHaveURL(/\/onboarding|\/week\/setup|\/$/);
}

async function settle(page: Page) {
  await page.locator('main, [role="main"], h1').first().waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 200)))));
}

interface SurfaceReport {
  name: string; path: string;
  violations: Array<{ id: string; impact: string | null | undefined; help: string; nodes: number; targets: string[] }>;
  h1Count: number; headingLevels: number[]; imagesWithoutAlt: number; smallTargets: string[];
}

async function auditSurface(page: Page, name: string, path: string): Promise<SurfaceReport> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    // Google GSI / Turnstile iframes are external and blocked in the harness.
    .exclude('iframe')
    .analyze();
  const structure = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .filter((h) => (h as HTMLElement).offsetParent !== null || h.closest('[aria-modal]'))
      .map((h) => Number(h.tagName[1]));
    const imagesWithoutAlt = Array.from(document.querySelectorAll('img')).filter((img) => !img.hasAttribute('alt')).length;
    const small: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=switch], [role=tab]'))) {
      if (el.closest('[aria-hidden="true"]')) continue;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden') continue;
      // Inline text links inside paragraphs are exempt (WCAG 2.5.8 inline exception).
      if (el.tagName === 'A' && el.closest('p, li')) continue;
      // A positioned ::before with negative insets extends the hit area (Switch).
      const before = getComputedStyle(el, '::before');
      const inset = (v: string) => (before.content !== 'none' && before.position === 'absolute' ? Math.max(0, -parseFloat(v) || 0) : 0);
      const hitW = rect.width + inset(before.left) + inset(before.right);
      const hitH = rect.height + inset(before.top) + inset(before.bottom);
      if (hitW < 44 || hitH < 44) {
        // `tap-target` enforces min 44×44 via CSS; measured boxes below that are real.
        if (el.classList.contains('tap-target') && rect.width >= 44 && rect.height >= 44) continue;
        small.push(`${el.tagName.toLowerCase()}[${el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 24) || el.className.toString().slice(0, 24)}] ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }
    }
    return { h1Count: document.querySelectorAll('h1').length, headingLevels: headings, imagesWithoutAlt, smallTargets: small };
  });
  return {
    name, path,
    violations: results.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} :: ${n.html.slice(0, 160)} :: ${n.any[0]?.message ?? ''}`) })),
    ...structure,
  };
}

function seriousOrCritical(report: SurfaceReport) {
  return report.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

test.describe('accessibility certification', () => {
  test('canonical surfaces pass axe WCAG-AA, expose one h1, alt text and 44px targets', async ({ page }, info) => {
    test.setTimeout(300_000);
    const reports: SurfaceReport[] = [];

    await page.goto('/landing');
    await page.context().clearCookies();
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    for (const [name, path] of [['landing', '/landing'], ['auth', '/auth'], ['otp-empty', '/auth/verify']] as const) {
      await page.goto(path); await settle(page);
      reports.push(await auditSurface(page, name, path));
    }
    await reset(page);
    await page.goto('/onboarding'); await settle(page);
    reports.push(await auditSurface(page, 'onboarding', '/onboarding'));
    await completeOnboarding(page);
    await control(page, 't13-scans');
    await page.goto('/planner/new');
    await page.getByRole('button', { name: 'Tạo thực đơn' }).click();
    await expect(page.getByTestId('plan-revision')).toBeVisible();
    const planPath = new URL(page.url()).pathname;

    const surfaces: [string, string][] = [
      ['home', '/'], ['fridge', '/fridge'], ['fridge-detail', '/fridge/preview-stock-egg'],
      ['scan', '/scan'], ['scan-review', '/scan/t13b-preview-fridge/review'], ['receipt-review', '/scan/receipt-review?scanId=t13b-preview-receipt'],
      ['recipes', '/recipes'], ['recipe-detail', '/recipes/canh-chua-ca-loc-nam-bo'], ['cook', '/cook/canh-chua-ca-loc-nam-bo'],
      ['planner', '/planner'], ['planner-week', planPath], ['planner-shopping', `${planPath}/shopping`],
      ['shopping', '/shopping'], ['notifications', '/notifications'], ['profile', '/me'], ['preferences', '/me/preferences'],
      ['household', '/me/household'], ['planning-settings', '/settings/planning'], ['notification-preferences', '/settings/notifications'],
      ['app-settings', '/settings/app'], ['privacy', '/settings/privacy'], ['plus', '/plus'],
    ];
    for (const [name, path] of surfaces) {
      await page.goto(path); await settle(page);
      // Scan review polls until the seeded scan is ready; audit the settled state.
      if (name === 'scan-review') await expect(page.getByRole('button', { name: /Xác nhận nguyên liệu/ })).toBeEnabled();
      // Receipt review resolves its scan asynchronously; the disabled-CTA
      // frame is transitional, audit the settled state.
      if (name === 'receipt-review') await expect(page.getByRole('button', { name: /Nhập \d+ món vào Tủ lạnh/ })).toBeEnabled();
      reports.push(await auditSurface(page, name, path));
    }

    const summary = reports.map((r) => `${r.name}: axe=${r.violations.length} (serious+=${seriousOrCritical(r).length}) h1=${r.h1Count} noAlt=${r.imagesWithoutAlt} small=${r.smallTargets.length}`);
    // Written to the private output dir so the evidence is readable without
    // opening the trace; also attached for the reporter.
    await writeFile(info.outputPath('a11y-report.json'), JSON.stringify(reports, null, 2));
    await writeFile(info.outputPath('a11y-summary.txt'), summary.join('\n'));
    await info.attach('a11y-report', { path: info.outputPath('a11y-report.json'), contentType: 'application/json' });
    await info.attach('a11y-summary', { path: info.outputPath('a11y-summary.txt'), contentType: 'text/plain' });

    const failures = reports.flatMap((r) => seriousOrCritical(r).map((v) => `${r.name}: ${v.id} (${v.impact}) ×${v.nodes} — ${v.help} @ ${v.targets.join(' | ')}`));
    expect(failures, 'serious/critical axe violations').toEqual([]);
    expect(reports.filter((r) => r.h1Count !== 1).map((r) => `${r.name}: h1=${r.h1Count}`), 'exactly one h1 per surface').toEqual([]);
    expect(reports.filter((r) => r.imagesWithoutAlt > 0).map((r) => r.name), 'every image has an alt attribute').toEqual([]);
    expect(reports.flatMap((r) => r.smallTargets.map((t) => `${r.name}: ${t}`)), 'interactive targets are at least 44×44').toEqual([]);
  });

  test('OTP screen announces state changes: alerts for errors, status for success, group label for digits', async ({ page }) => {
    await page.goto('/landing');
    await page.context().clearCookies();
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto('/auth?mode=register');
    await page.getByLabel('Họ và tên', { exact: false }).fill('Người dùng kiểm thử tiếp cận');
    await page.getByLabel('Email', { exact: true }).fill('a11y-otp@example.test');
    await page.getByLabel('Mật khẩu', { exact: false }).first().fill('mat-khau-manh-1');
    await page.getByRole('button', { name: 'Tạo tài khoản & Nhận mã OTP' }).click();
    await expect(page).toHaveURL(/\/auth\/verify$/);
    // Delivery outcome is announced (status when sent, alert when not) — the
    // isolated preview has no mail provider, so either is legitimate here.
    await expect(page.getByRole('status').or(page.getByRole('alert')).first()).toBeVisible();
    const group = page.getByRole('group', { name: 'Mã OTP 6 chữ số' });
    await expect(group).toBeVisible();
    await expect(group.getByRole('textbox')).toHaveCount(6);
    for (let i = 1; i <= 6; i++) await expect(group.getByRole('textbox', { name: `Chữ số ${i} của 6` })).toBeVisible();
    // Incomplete submit announces an error and keeps focus in the form.
    await group.getByRole('textbox', { name: 'Chữ số 1 của 6' }).fill('4');
    await page.getByRole('button', { name: 'Xác thực & Hoàn tất' }).click();
    await expect(page.getByRole('alert')).toContainText('Vui lòng nhập đủ 6 chữ số mã OTP');
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('iframe').analyze();
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
