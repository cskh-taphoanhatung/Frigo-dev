import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
import { Header } from '../../src/web/components/common/Header';
import { TopBar } from '../../src/web/components/common/TopBar';
import { BottomNavigationBar } from '../../src/web/design-system/navigation';
import { EmptyState } from '../../src/web/components/common/EmptyState';
// @ts-expect-error Tailwind's JavaScript config intentionally has no declaration file.
import tailwindConfig from '../../tailwind.config.js';

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

  it('every semantic-* utility referenced in src/web resolves to a Tailwind color key', () => {
    // Tailwind exposes nested color keys verbatim: a camelCase key would
    // silently compile no CSS for the kebab-case utilities pages use.
    const semantic = tailwindConfig.theme.extend.colors.semantic as Record<string, string>;
    const keys = new Set(Object.keys(semantic));
    const used = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(tsx?|css)$/.test(entry.name)) {
          for (const m of readFileSync(full, 'utf8').matchAll(/[a-z]+-semantic-([a-zA-Z-]+?)(?:\/\d+)?(?=[\s"'`)}\]])/g)) used.add(m[1]);
        }
      }
    };
    walk(resolve(root, 'src/web'));
    expect(used.size).toBeGreaterThan(10);
    expect([...used].filter((k) => !keys.has(k))).toEqual([]);
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
    // og:image must be absolute for scrapers; the temporary domain stays until the maintainer picks one.
    expect(html).toContain('property="og:image" content="https://frigo.tungjpstore.net/takosan/brand/takosan-og.png"');
    expect(html).toContain('property="og:url" content="https://frigo.tungjpstore.net"');
    expect(html).not.toMatch(/og:image" content="\//);
    expect(html).not.toMatch(/\/frigo\/(brand|app-icons)\//);
    expect(html).toContain('family=Nunito');
  });

  it('favicon, apple-touch-icon and icon links in index.html point at existing Takosan files', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    const iconHrefs = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    expect(iconHrefs.length).toBeGreaterThanOrEqual(3);
    for (const href of iconHrefs) {
      expect(href.startsWith('/takosan/app-icons/')).toBe(true);
      expect(existsSync(publicFile(href))).toBe(true);
    }
    expect(existsSync(publicFile(TAKOSAN_BRAND.og))).toBe(true);
  });

  it('service worker cache version moved off frigo-pwa-v1 and precaches Takosan assets', () => {
    const sw = readFileSync(resolve(root, 'public/sw.js'), 'utf8');
    expect(sw).not.toContain("'frigo-pwa-v1'");
    expect(sw).toContain("BUILD_ID = '__TAKOSAN_BUILD_ID__'");
    expect(sw).toContain('CACHE_NAME = `takosan-pwa-${BUILD_ID}`');
    expect(sw).toContain('/takosan/app-icons/icon-192.png');
    expect(sw).toContain("url.pathname.startsWith('/takosan/')");
    const precached = [...sw.matchAll(/'(\/takosan\/[^']+)'/g)].map((m) => m[1]);
    expect(precached.filter((p) => !existsSync(publicFile(p)))).toEqual([]);
  });

  it('forces release-aware service worker updates and correct cache headers', () => {
    const main = readFileSync(resolve(root, 'src/web/main.tsx'), 'utf8');
    const sw = readFileSync(resolve(root, 'public/sw.js'), 'utf8');
    const headers = readFileSync(resolve(root, 'public/_headers'), 'utf8');
    const vite = readFileSync(resolve(root, 'vite.config.ts'), 'utf8');
    expect(main).toContain("/sw.js?v=${encodeURIComponent(buildId)}");
    expect(main).toContain("updateViaCache: 'none'");
    expect(sw).toContain("key.startsWith('takosan-pwa-')");
    expect(sw).toContain('void client.navigate(client.url).catch');
    expect(sw).toContain('await self.clients.claim()');
    expect(sw).not.toContain('Failed to precache some assets');
    expect(vite).toContain("replaceAll('__TAKOSAN_BUILD_ID__', buildCommit)");
    expect(headers).toContain('/sw.js\n  ! Cache-Control\n  Cache-Control: no-cache, no-store, must-revalidate');
    expect(headers).toContain('/assets/*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable');
    expect(headers).not.toContain('/service-worker.js');
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

  it('Header, TopBar and bottom navigation use the Takosan logo and icon grammar', () => {
    const header = render(<Header />);
    expect(header).toContain(`src="${TAKOSAN_BRAND.logos.horizontal}"`);
    expect(header).toContain('alt="Takosan"');
    expect(header).not.toContain('frigo-logo');

    const top = render(<TopBar />);
    expect(top).toContain(`src="${TAKOSAN_BRAND.logos.horizontal}"`);
    expect(top).toContain('alt="Takosan"');
    expect(top).not.toContain('/frigo/brand/');

    const nav = render(<BottomNavigationBar />);
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

describe('Palette hardening (P2-BRAND-1)', () => {
  const protectedPaymentFiles = new Set([
    resolve(root, 'src/web/components/payment/VietQRModal.tsx'),
    resolve(root, 'src/web/pages/PlusPaywallPage.tsx'),
  ]);
  const runtimeFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) return runtimeFiles(full);
      return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
    });
  const LEGACY = /emerald-|#059669|#047857|#0F3D2E|#14532D|#22C55E|#1ea750|#DDF7E3|#FFFDF6|#F8FAF9|#34d399/i;

  it('runtime frontend source and Tailwind config carry no legacy Frigo/emerald palette', () => {
    const offenders: string[] = [];
    for (const file of [...runtimeFiles(resolve(root, 'src/web')), resolve(root, 'tailwind.config.js'), resolve(root, 'index.html')]) {
      if (protectedPaymentFiles.has(file)) continue;
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (LEGACY.test(line)) offenders.push(`${file.replace(root, '')}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('Tailwind config parses and exposes the locked palette plus Takosan-green tinted shadows', () => {
    const theme = (tailwindConfig as { theme: { extend: { colors: Record<string, unknown>; boxShadow: Record<string, string> } } }).theme.extend;
    const takosan = theme.colors.takosan as Record<string, string | Record<string, string>>;
    const value = (c: string | Record<string, string>) => (typeof c === 'string' ? c : c.DEFAULT);
    for (const [name, hex] of Object.entries(TAKOSAN_BRAND.colors)) {
      expect(value(takosan[name])).toBe(hex);
    }
    for (const name of ['float', 'glow']) {
      expect(theme.boxShadow[name]).toContain('rgba(46, 125, 91');
      expect(theme.boxShadow[name]).not.toMatch(/rgba\((5, 150, 105|16, 185, 129)/);
    }
    // Legacy `frigo.*` aliases must resolve to Takosan values, never to the old emerald ramp.
    expect(JSON.stringify(theme.colors.frigo)).not.toMatch(/#059669|#047857|#0F3D2E|#10B981|#34D399/i);
  });

  it('active runtime components do not reference legacy Frigo brand or app-icon assets', () => {
    const offenders: string[] = [];
    for (const file of runtimeFiles(resolve(root, 'src/web'))) {
      const text = readFileSync(file, 'utf8');
      if (file.endsWith('frigo-assets.ts')) continue; // legacy manifest kept for content paths
      if (/\/frigo\/(brand|app-icons|illustrations)\/|\/assets\/frigo-logo/.test(text)) offenders.push(file.replace(root, ''));
    }
    expect(offenders).toEqual([]);
  });

  it('visible runtime copy no longer says Frigo (technical identifiers excluded)', () => {
    const offenders: string[] = [];
    const technical = /X-Frigo-|frigo_[a-z_]+|@frigo\/|\/frigo\/|frigo-assets|frigo-tokens|--frigo-|frigo\.tungjpstore\.net/;
    const files = [
      ...runtimeFiles(resolve(root, 'src/web')),
      resolve(root, 'index.html'),
      resolve(root, 'public/manifest.json'),
      resolve(root, 'public/sw.js'),
    ];
    for (const file of files) {
      if (protectedPaymentFiles.has(file)) continue;
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/\bFrigo\b/.test(line) && !technical.test(line) && !/^\s*(\/\/|\/\*|\*|\{\/\*)/.test(line)) {
          offenders.push(`${file.replace(root, '')}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe('Brand generator (P2-BRAND-2)', () => {
  it('sharp is a direct, exactly pinned devDependency and the generator imports it directly', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    expect(pkg.devDependencies.sharp).toBe('0.33.5');
    expect(pkg.scripts['brand:icons']).toBe('node scripts/generate-takosan-icons.mjs');
    const script = readFileSync(resolve(root, 'scripts/generate-takosan-icons.mjs'), 'utf8');
    expect(script).toContain("import sharp from 'sharp'");
    expect(script).not.toContain('NODE_PATH');
    expect(script).not.toContain('createRequire');
  });

  it('every generated runtime icon the generator promises exists', () => {
    const expected = [16, 32, 48, 64, 128, 180, 192, 256, 512].map((s) => `/takosan/app-icons/icon-${s}.png`).concat([
      '/takosan/app-icons/icon-maskable-512.png',
      '/takosan/app-icons/takosan-app-icon-light-512.png',
      '/takosan/app-icons/takosan-app-icon-mint-512.png',
      '/takosan/brand/takosan-og.png',
    ]);
    expect(expected.filter((p) => !existsSync(publicFile(p)))).toEqual([]);
  });
});
