import { defineConfig } from '@playwright/test';

/**
 * T17 Takosan UI V2 visual coverage — isolated from the T13 Inventory suite
 * (visual-regression-plan.md). Same isolated preview server, separate
 * testDir/output; the T13 config and its tests remain untouched.
 */
function port(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new Error(`${name} must be an unprivileged local port`);
  }
  return value;
}

const frontend = port('PORT', 3000);
const api = port('PREVIEW_API_PORT', 8787);
if (frontend === api) throw new Error('Preview frontend and API ports must differ');
const baseURL = `http://127.0.0.1:${frontend}`;

export default defineConfig({
  testDir: './tests/e2e/t17-ui',
  testMatch: '*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: '.hoplite/artifacts/t17-playwright/results',
  reporter: [['./scripts/playwright-private-reporter.mjs'], ['list']],
  use: {
    baseURL,
    browserName: 'chromium',
    locale: 'vi-VN',
    timezoneId: 'UTC',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: { mode: 'retain-on-failure', snapshots: false, sources: false, screenshots: true },
  },
  projects: [
    { name: 'mobile-360', use: { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'mobile-430', use: { viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true } },
    { name: 'tablet-768', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'desktop-1024', use: { viewport: { width: 1024, height: 768 } } },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'node scripts/security-preview.mjs',
    url: `${baseURL}/__preview`,
    env: { PORT: String(frontend), PREVIEW_API_PORT: String(api), PREVIEW_APP_URL: baseURL },
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
  },
});
