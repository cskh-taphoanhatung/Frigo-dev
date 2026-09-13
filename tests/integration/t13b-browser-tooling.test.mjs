import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { isolatedPreviewHtml } from '../../scripts/isolated-preview-html.mjs';
import { redactTraceText } from '../../scripts/playwright-private-reporter.mjs';

const require = createRequire(import.meta.url);
const execute = promisify(execFile);

describe('isolated browser bootstrap', () => {
  it('removes only known external font and identity resources from isolated HTML', () => {
    const original = readFileSync('index.html', 'utf8');
    const isolated = isolatedPreviewHtml(original);
    expect(original).toContain('https://accounts.google.com/gsi/client');
    expect(isolated).not.toContain('https://accounts.google.com/gsi/client');
    expect(isolated).not.toContain('https://fonts.googleapis.com');
    expect(isolated).not.toContain('https://fonts.gstatic.com');
    expect(isolated).toContain('src="/src/web/main.tsx"');
    expect(isolated).toContain('href="/manifest.json"');
    expect(isolatedPreviewHtml('<script src="https://unexpected.example/app.js"></script>'))
      .toContain('https://unexpected.example/app.js');
  });

  it('redacts trace cookies, authorization, opaque tokens and storage without dropping useful evidence', () => {
    const token = 'a'.repeat(64);
    const trace = JSON.stringify({ result: { cookies: [{ name: '__Host-frigo_session', value: token }] },
      headers: [{ name: 'Cookie', value: 'private-cookie' }, { name: 'Authorization', value: 'Bearer private' }],
      storageState: { origins: ['private'] }, token, rawName: 'Cà chua OCR', quantity: 2 });
    const redacted = redactTraceText(trace);
    expect(redacted).not.toContain(token);
    expect(redacted).not.toContain('private');
    expect(JSON.parse(redacted)).toMatchObject({ rawName: 'Cà chua OCR', quantity: 2, result: { cookies: '[redacted]' } });
    expect(redactTraceText(`Cookie: __Host-frigo_session=${token}; Path=/`)).not.toContain(token);
  });

  it('runs the real Playwright reporter lifecycle without HTML, retaining sanitized failure evidence', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'frigo-artifact-lifecycle-'));
    const root = path.join(directory, '.hoplite/artifacts/t13b-playwright');
    const token = 'a'.repeat(64);
    const screenshot = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jzS8AAAAASUVORK5CYII=', 'base64');
    const trace = zipSync({
      'test.trace': strToU8(JSON.stringify({ result: { cookies: [{ name: '__Host-frigo_session', value: token }] } })),
      'test.network': strToU8(JSON.stringify({ headers: [{ name: 'Authorization', value: `Bearer ${token}` }] })),
      'resources/screenshot.png': screenshot,
    });
    try {
      await mkdir(path.join(root, 'report'), { recursive: true });
      await writeFile(path.join(root, 'report/index.html'), `<template>data:application/zip;base64,${Buffer.from(trace).toString('base64')}</template>`);
      await writeFile(path.join(directory, 'fixture.zip'), trace);
      await writeFile(path.join(directory, 'fixture.png'), screenshot);
      await writeFile(path.join(directory, 'playwright.config.ts'), `
        import config from ${JSON.stringify(path.resolve('playwright.config.ts'))};
        import path from 'node:path';
        if (config.reporter.some(([name]) => name === 'html')) throw new Error('HTML reports must stay disabled');
        if (config.use.screenshot !== 'only-on-failure' || config.use.trace.mode !== 'retain-on-failure') {
          throw new Error('Failure screenshots and traces must remain enabled');
        }
        export default { ...config, webServer: undefined, testDir: '.', testMatch: 'artifact.e2e.ts',
          projects: [{ name: 'privacy' }],
          reporter: [...config.reporter.map(([name, ...options]) => [name.startsWith('.')
            ? path.resolve(${JSON.stringify(process.cwd())}, name) : name, ...options]), ['./late-reporter.mjs']],
        };
      `);
      await writeFile(path.join(directory, 'artifact.e2e.ts'), `
        import { test } from ${JSON.stringify(require.resolve('@playwright/test'))};
        import { copyFile, writeFile } from 'node:fs/promises';
        test('synthetic evidence failure', async ({}, info) => {
          await copyFile('fixture.zip', info.outputPath('synthetic-trace.zip'));
          await copyFile('fixture.png', info.outputPath('failure.png'));
          const diagnostic = info.outputPath('sanitized-browser-diagnostics.json');
          await writeFile(diagnostic, JSON.stringify({ sessionToken: 'a'.repeat(64), requests: ['GET /api/v1/me: 200'] }));
          await info.attach('sanitized-browser-diagnostics', { path: diagnostic, contentType: 'application/json' });
          throw new Error('Expected synthetic failure: retained evidence must be sanitized');
        });
      `);
      // A later reporter verifies onEnd, then leaves synthetic work for onExit.
      await writeFile(path.join(directory, 'late-reporter.mjs'), `
        import { readFileSync, writeFileSync } from 'node:fs';
        export default class {
          onTestEnd(test, result) { this.result = result; }
          onEnd() {
            const diagnostic = this.result.attachments.find((entry) => entry.name === 'sanitized-browser-diagnostics');
            const root = '.hoplite/artifacts/t13b-playwright';
            writeFileSync(root + '/on-end.json', JSON.stringify({ sanitized: !readFileSync(diagnostic.path, 'utf8').includes('a'.repeat(64)) }));
            writeFileSync(root + '/after-end.json', JSON.stringify({ sessionToken: 'a'.repeat(64), useful: 'late diagnostic' }));
          }
        }
      `);
      const result = await execute(process.execPath, [require.resolve('@playwright/test/cli'),
        'test', '--config', path.join(directory, 'playwright.config.ts')], {
        cwd: directory, timeout: 30_000,
      }).then(() => ({ code: 0 }), (error) => error);
      expect(result.code, result.stdout || result.stderr).toBe(1);
      expect(result.stdout).toContain('1 failed');
      await expect(readFile(path.join(root, 'report/index.html'))).rejects.toMatchObject({ code: 'ENOENT' });
      expect(JSON.parse(await readFile(path.join(root, 'on-end.json'), 'utf8'))).toEqual({ sanitized: true });
      expect(JSON.parse(await readFile(path.join(root, 'after-end.json'), 'utf8')))
        .toEqual({ sessionToken: '[redacted]', useful: 'late diagnostic' });
      const files = await readdir(path.join(root, 'results'), { recursive: true });
      const retained = (name) => path.join(root, 'results', files.find((file) => path.basename(file) === name));
      const actualTrace = unzipSync(await readFile(retained('trace.zip')));
      expect(Object.keys(actualTrace).some((name) => name.endsWith('.trace'))).toBe(true);
      for (const [name, bytes] of Object.entries(actualTrace)) {
        if (/\.(trace|network)$/.test(name)) expect(strFromU8(bytes)).not.toContain(token);
      }
      const archive = unzipSync(await readFile(retained('synthetic-trace.zip')));
      expect(strFromU8(archive['test.trace'])).not.toContain(token);
      expect(strFromU8(archive['test.network'])).not.toContain(token);
      expect(Buffer.from(archive['resources/screenshot.png'])).toEqual(screenshot);
      expect(await readFile(retained('failure.png'))).toEqual(screenshot);
      expect(JSON.parse(await readFile(retained('sanitized-browser-diagnostics.json'), 'utf8')))
        .toEqual({ sessionToken: '[redacted]', requests: ['GET /api/v1/me: 200'] });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 45_000);
});
