// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthPage } from '../../src/web/pages/AuthPage';

function setInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('OTP resend Turnstile lifecycle', () => {
  let root: Root;
  let host: HTMLDivElement;
  const requestBodies: Array<Record<string, unknown>> = [];

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    sessionStorage.clear();
    host = document.createElement('div');
    document.body.appendChild(host);
    let generation = 0;
    Object.defineProperty(window, 'turnstile', {
      configurable: true,
      value: {
        render: (_element: HTMLElement, options: Record<string, unknown>) => {
          generation += 1;
          queueMicrotask(() => (options.callback as (token: string) => void)(`turnstile-token-${generation}`));
          return `widget-${generation}`;
        },
        remove: vi.fn(),
        reset: vi.fn(),
      },
    });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), 'https://frigo.example.com').pathname;
      if (path.endsWith('/config')) {
        return Response.json({ turnstileSiteKey: 'test-site-key', googleClientId: null });
      }
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      requestBodies.push(body);
      if (path.endsWith('/register')) {
        return Response.json({
          error: 'Email OTP chưa gửi được.',
          code: 'OTP_DELIVERY_UNAVAILABLE',
          accountCreated: true,
        }, { status: 503 });
      }
      if (path.endsWith('/resend-otp')) {
        return Response.json({ success: true, message: 'Đã gửi lại mã OTP mới.' });
      }
      return Response.json({ error: 'unexpected request' }, { status: 500 });
    }));
  });

  afterEach(() => {
    act(() => root?.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    requestBodies.length = 0;
  });

  it('uses a new single-use token for resend after registration consumed the first token', async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(<MemoryRouter initialEntries={['/auth?mode=register']}><AuthPage /></MemoryRouter>);
      await Promise.resolve();
      await Promise.resolve();
    });

    const fields = host.querySelectorAll('input');
    await act(async () => {
      setInput(fields[0] as HTMLInputElement, 'OTP Test');
      setInput(fields[1] as HTMLInputElement, 'otp@example.com');
      setInput(fields[2] as HTMLInputElement, 'strong-password');
      (host.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Tài khoản đã được lưu nhưng email OTP chưa gửi được');
    const resend = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Gửi lại mã OTP'));
    expect(resend).toBeDefined();
    expect(resend?.disabled).toBe(false);

    await act(async () => {
      resend?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[0].turnstileToken).toMatch(/^turnstile-token-/);
    expect(requestBodies[1].turnstileToken).toMatch(/^turnstile-token-/);
    expect(requestBodies[1].turnstileToken).not.toBe(requestBodies[0].turnstileToken);
    expect(host.textContent).toContain('Đã gửi lại mã OTP mới.');
  });
});
