import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/web/stores/useAuthStore', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = { setGuestSession: vi.fn(), avatarUrl: null, displayName: 'Test' };
    return selector ? selector(state) : state;
  },
}));

import { TAKOSAN_BRAND } from '../../src/web/lib/takosan-brand';
import { LandingPage } from '../../src/web/pages/LandingPage';
import { TopBar } from '../../src/web/components/common/TopBar';
import { BottomNav } from '../../src/web/components/layout/BottomNav';
import { EmptyState } from '../../src/web/components/common/EmptyState';

const root = resolve(__dirname, '../..');
const publicFile = (webPath: string) => resolve(root, 'public', webPath.replace(/^\//, ''));

function collectPaths(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    if (value.startsWith('/takosan/')) out.push(value);
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectPaths(v, out));
  }
  return out;
}

describe('Takosan brand contract', () => {
  it('names the product Takosan and uses the kit palette', () => {
    expect(TAKOSAN_BRAND.name).toBe('Takosan');
    expect(TAKOSAN_BRAND.colors).toEqual({
      coral: '#FF7B6B',
      green: '#2E7D5B',
      navy: '#1F2937',
      cream: '#FFF8F3',
      mint: '#DFF4E6',
      yellow: '#FFC857',
    });
  });

  it('every referenced runtime brand asset exists under public/takosan', () => {
    const paths = collectPaths(TAKOSAN_BRAND);
    expect(paths.length).toBeGreaterThan(20);
    const missing = paths.filter((p) => !existsSync(publicFile(p)));
    expect(missing).toEqual([]);
  });

  it('uses the supplied SVG lockups rather than typed wordmarks', () => {
    for (const logo of Object.values(TAKOSAN_BRAND.logos)) {
      const svg = readFileSync(publicFile(logo), 'utf8');
      expect(svg).toContain('<svg');
      expect(svg).toContain('takosan-canonical-symbol');
      expect(svg).not.toMatch(/<text/i);
    }
  });
});

describe('PWA metadata', () => {
  it('manifest is branded Takosan with kit theme colours and generated icons', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'public/manifest.json'), 'utf8'));
    expect(manifest.short_name).toBe('Takosan');
    expect(manifest.name).toMatch(/^Takosan/);
    expect(manifest.theme_color).toBe('#2E7D5B');
    expect(manifest.background_color).toBe('#FFF8F3');
    const sizes = manifest.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}${i.purpose ? `:${i.purpose}` : ''}`);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512', '512x512:maskable']));
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('/takosan/')).toBe(true);
      expect(existsSync(publicFile(icon.src))).toBe(true);
    }
  });

  it('index.html title, favicon, theme colour and OpenGraph are Takosan while the domain is unchanged', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    expect(html).toMatch(/<title>Takosan/);
    expect(html).toContain('href="/takosan/app-icons/favicon.svg"');
    expect(html).toContain('<meta name="theme-color" content="#2E7D5B" />');
    expect(html).toContain('property="og:title" content="Takosan');
    expect(html).toContain('property="og:image" content="/takosan/brand/takosan-og.png"');
    expect(html).toContain('https://frigo.tungjpstore.net');
    expect(html).not.toMatch(/\/frigo\/(brand|app-icons)\//);
    expect(html).toContain('family=Nunito');
  });

  it('service worker cache version moved off frigo-pwa-v1 and precaches Takosan assets', () => {
    const sw = readFileSync(resolve(root, 'public/sw.js'), 'utf8');
    expect(sw).not.toContain("'frigo-pwa-v1'");
    expect(sw).toMatch(/CACHE_NAME = 'takosan-pwa-v\d+'/);
    expect(sw).toContain('/takosan/app-icons/icon-192.png');
    expect(sw).toContain("url.pathname.startsWith('/takosan/')");
    const precached = [...sw.matchAll(/'(\/takosan\/[^']+)'/g)].map((m) => m[1]);
    expect(precached.filter((p) => !existsSync(publicFile(p)))).toEqual([]);
  });
});

describe('Primary shell renders Takosan, not Frigo', () => {
  const render = (ui: React.ReactElement, path = '/') =>
    renderToStaticMarkup(<StaticRouter location={path}>{ui}</StaticRouter>);

  it('LandingPage shows the Takosan lockup and mascot with no Frigo copy or legacy logo', () => {
    const html = render(<LandingPage />, '/landing');
    expect(html).toContain(`src="${TAKOSAN_BRAND.logos.horizontal}"`);
    expect(html).toContain(`src="${TAKOSAN_BRAND.mascot.fridge}"`);
    expect(html).toContain('Takosan sẽ phân loại');
    expect(html).not.toContain('Frigo');
    expect(html).not.toContain('/frigo/brand/');
  });

  it('TopBar and BottomNav use the Takosan logo and icon grammar', () => {
    const top = render(<TopBar />);
    expect(top).toContain(`src="${TAKOSAN_BRAND.logos.horizontal}"`);
    expect(top).toContain('alt="Takosan"');
    expect(top).not.toContain('/frigo/brand/');

    const nav = render(<BottomNav />);
    for (const name of ['home', 'fridge', 'scan', 'mealPlan', 'profile']) {
      expect(nav).toContain(`data-takosan-icon="${name}"`);
    }
    expect(nav).toContain('aria-label="Quét AI"');
    expect(nav).toContain('aria-current="page"');
  });

  it('EmptyState maps legacy illustration types onto mascot poses', () => {
    expect(render(<EmptyState type="empty-fridge" title="Trống" description="x" />)).toContain(TAKOSAN_BRAND.mascot.fridge);
    expect(render(<EmptyState type="no-recipes" title="Trống" description="x" />)).toContain(TAKOSAN_BRAND.mascot.recipe);
    expect(render(<EmptyState type="shopping-ready" title="Trống" description="x" />)).toContain(TAKOSAN_BRAND.mascot.shopping);
    expect(render(<EmptyState type="error" title="Lỗi" description="x" />)).toContain(TAKOSAN_BRAND.mascot.thinking);
  });
});
