import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = {
  displayName: 'Khách ghé thăm',
  email: '',
  isGuest: true,
  isPlus: false,
  avatarUrl: undefined,
  syncPlusFromServer: vi.fn(async () => {}),
};

vi.mock('../../src/web/stores/useAuthStore', () => ({
  useAuthStore: (selector?: (state: typeof authState) => unknown) => selector ? selector(authState) : authState,
}));

vi.mock('../../src/web/components/payment/VietQRModal', () => ({
  VietQRModal: () => <div data-testid="payment-modal" />,
}));

import { PlusPaywallPage } from '../../src/web/pages/PlusPaywallPage';
import { ProfilePage } from '../../src/web/pages/ProfilePage';

const render = (ui: React.ReactElement, path: string) =>
  renderToStaticMarkup(<StaticRouter location={path}>{ui}</StaticRouter>);

describe('guest account gates', () => {
  beforeEach(() => {
    authState.isGuest = true;
    authState.isPlus = false;
  });

  it('replaces Plus pricing and payment UI with an explicit sign-in link for guests', () => {
    const html = render(<PlusPaywallPage />, '/plus');
    expect(html).toContain('Đăng nhập trước khi chọn gói Plus');
    expect(html).toContain('href="/auth?mode=login&amp;returnTo=%2Fplus"');
    expect(html).not.toContain('Gói 1 Năm');
    expect(html).not.toContain('599.000đ');
    expect(html).not.toContain('data-testid="payment-modal"');
  });

  it('points the guest profile upgrade CTA directly to authentication', () => {
    const html = render(<ProfilePage />, '/profile');
    expect(html).toContain('Đăng nhập để nâng cấp');
    expect(html).toContain('href="/auth?mode=login&amp;returnTo=%2Fplus"');
  });

  it('keeps the existing pricing flow visible to authenticated accounts', () => {
    authState.isGuest = false;
    const html = render(<PlusPaywallPage />, '/plus');
    expect(html).toContain('Gói 1 Năm');
    expect(html).toContain('599.000đ');
    expect(html).not.toContain('Đăng nhập trước khi chọn gói Plus');
  });
});
