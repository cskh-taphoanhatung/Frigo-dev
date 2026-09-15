import { test as base, expect, type Page, type Locator } from '@playwright/test';
import { spawn } from 'node:child_process';

export { expect };

export const test = base.extend<{ isolation: void }>({
  isolation: [async ({ context, baseURL }, use, testInfo) => {
    const unexpected: string[] = [];
    const blockedImages: string[] = [];
    const errors: string[] = [];
    const requests: string[] = [];
    const redact = (value: string) => value.replace(/[a-f0-9]{64}/gi, '[redacted]');
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== baseURL) {
        if (request.resourceType() === 'image' && url.origin === 'https://images.unsplash.com') {
          blockedImages.push(url.pathname);
          await route.abort('blockedbyclient');
          return;
        }
        unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
        await route.abort('blockedbyclient');
        throw new Error(`External application network blocked: ${url.origin}`);
      }
      await route.continue();
    });
    await context.routeWebSocket('**/*', (socket) => {
      const url = new URL(socket.url());
      if (url.origin.replace(/^ws/, 'http') !== baseURL) {
        unexpected.push(`WebSocket ${url.origin}`);
        socket.close();
        throw new Error('External WebSocket blocked');
      }
      socket.connectToServer();
    });
    context.on('page', (page) => {
      page.on('pageerror', (error) => errors.push(redact(error.message)));
      page.on('console', (message) => {
        if (message.type() === 'error') requests.push(`console: ${redact(message.text())}`);
      });
      page.on('requestfailed', (request) => {
        requests.push(`${request.method()} ${new URL(request.url()).pathname}: failed`);
      });
      page.on('response', (response) => {
        if (response.url().includes('/api/')) {
          requests.push(`${response.request().method()} ${new URL(response.url()).pathname}: ${response.status()}`);
        }
      });
    });
    await use();
    await testInfo.attach('sanitized-browser-diagnostics', {
      body: JSON.stringify({ unexpected, blockedImages, errors, requests }, null, 2), contentType: 'application/json',
    });
    expect(unexpected, 'No external application requests').toEqual([]);
    expect(errors, 'No uncaught browser errors').toEqual([]);
  }, { auto: true }],
});

export async function control<T = Record<string, unknown>>(page: Page, path: string): Promise<T> {
  return page.evaluate(async (path) => {
    const response = await fetch(`/__preview/${path}`, { method: 'POST' });
    if (!response.ok) throw new Error(`Preview control failed: ${response.status}`);
    return response.json();
  }, path);
}

export async function getJson<T = Record<string, unknown>>(page: Page, path: string): Promise<T> {
  return page.evaluate(async (path) => {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`API read failed: ${response.status}`);
    return response.json();
  }, path);
}

export async function reset(page: Page) {
  await page.goto('/__preview');
  await page.getByRole('button', { name: 'Đặt lại dữ liệu thử nghiệm và đăng nhập' }).click();
  await expect(page).toHaveURL(/\/planner$/);
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('frigo_user_id')))
    .toBe('planner-preview-user');
}

export async function navigate(page: Page, path: string) {
  // React Router observes popstate; the document and real stores remain mounted.
  await page.evaluate((path) => {
    history.pushState({}, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[?]/g, '\\?')}$`));
}

export async function layout(page: Page, controls?: Locator) {
  const width = page.viewportSize()!.width;
  expect(await page.evaluate(() => innerWidth)).toBe(width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  if (controls) {
    for (const element of await controls.all()) {
      await element.scrollIntoViewIfNeeded();
      const bounds = await element.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      if (await element.isEnabled()) await element.click({ trial: true });
    }
  }
}

export async function adopt(page: Page, extra: string[] = ['--apply'], household = 'planner-preview-household') {
  const token = (await page.context().cookies()).find((cookie) => cookie.name === '__Host-frigo_session')?.value;
  if (!token) throw new Error('Isolated browser session required');
  const origin = new URL(page.url()).origin;
  return new Promise<{ code: number | null; output: string; error: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/inventory-adopt.mjs', '--base-url', `${origin}/api/v1`,
      '--origin', origin, '--household', household, '--session-stdin', ...extra],
    { stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: process.env.PATH } });
    let output = '';
    let error = '';
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { error += data; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (output.includes(token) || error.includes(token)) {
        reject(new Error('Operator leaked a credential (output suppressed)'));
      } else resolve({ code, output, error });
    });
    child.stdin.end(token);
  });
}
