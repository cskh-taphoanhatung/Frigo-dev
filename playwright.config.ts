import { defineConfig } from '@playwright/test';

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
  testDir: './tests/e2e',
  testMatch: ['t13b-*.e2e.ts', 't13r-a-*.e2e.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: '.hoplite/artifacts/t13b-playwright/results',
  reporter: [['./scripts/playwright-private-reporter.mjs'], ['list']],
  use: {
    baseURL,
    browserName: 'chromium',
    locale: 'vi-VN',
    timezoneId: 'UTC',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    // Network snapshots include cookies; retain action/screenshot traces instead.
    trace: { mode: 'retain-on-failure', snapshots: false, sources: false, screenshots: true },
  },
  projects: [360, 390, 430].map((width) => ({
    name: `chromium-${width}`,
    use: { viewport: { width, height: 844 }, isMobile: true, hasTouch: true },
  })),
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
