// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthPage } from '../../src/web/pages/AuthPage';

describe('Google authentication entry point', () => {
  let root: Root;
  let host: HTMLDivElement;
  const initialize = vi.fn();
  const renderButton = vi.fn();
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      turnstileSiteKey: null,
      googleClientId: 'runtime-client.apps.googleusercontent.com',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(window, 'google', {
      configurable: true,
      value: { accounts: { id: { initialize, renderButton } } },
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    initialize.mockReset();
    renderButton.mockReset();
  });

  it('renders only the real GIS entry point and never offers a credential-less fallback', async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(<MemoryRouter initialEntries={['/auth']}><AuthPage /></MemoryRouter>);
      await Promise.resolve();
    });

    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({
      client_id: 'runtime-client.apps.googleusercontent.com',
      callback: expect.any(Function),
    }));
    expect(renderButton).toHaveBeenCalledTimes(1);
    expect(host.textContent).not.toContain('Đăng nhập nhanh với Google');
    expect(fetchMock.mock.calls.some(([, init]) => String(init?.body || '').includes('"userInfo"'))).toBe(false);
  });
});
