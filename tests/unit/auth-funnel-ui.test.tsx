// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthPage } from '../../src/web/pages/AuthPage';
import { OnboardingPage } from '../../src/web/pages/OnboardingPage';

describe('auth funnel UI', () => {
  let root: Root | undefined;
  let host: HTMLDivElement;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    sessionStorage.clear();
    host = document.createElement('div');
    document.body.appendChild(host);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      turnstileSiteKey: null,
      googleClientId: null,
    })));
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    host.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('honors the registration query parameter on first render', async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(<MemoryRouter initialEntries={['/auth?mode=register']}><AuthPage /></MemoryRouter>);
      await Promise.resolve();
    });
    expect(host.textContent).toContain('Tạo tài khoản Takosan');
    expect(host.textContent).toContain('Tạo tài khoản & Nhận mã OTP');
  });

  it('keeps onboarding focused on preferences without another auth chooser', async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(<MemoryRouter initialEntries={['/onboarding']}><OnboardingPage /></MemoryRouter>);
    });
    expect(host.textContent).toContain('1 / 3');
    expect(host.textContent).toContain('Takosan nên nấu cho nhà mình thế nào?');
    expect(host.textContent).not.toMatch(/Đăng nhập|Đăng ký bằng Google|Đăng ký bằng Apple|Tạo tài khoản/);
  });
});
