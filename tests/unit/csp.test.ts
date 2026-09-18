import { describe, expect, it } from 'vitest';
import { apiCsp, spaCsp } from '../../src/worker/config/csp';

describe('CSP policies', () => {
  it('API policy allows nothing beyond the API surface', () => {
    const policy = apiCsp();
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it('SPA script-src no longer needs unsafe-inline', () => {
    const scriptDirective = spaCsp().match(/script-src [^;]+/)?.[0] ?? '';
    expect(scriptDirective).not.toContain("'unsafe-inline'");
    expect(scriptDirective).toContain('https://accounts.google.com');
    expect(scriptDirective).toContain('https://challenges.cloudflare.com');
    expect(scriptDirective).toContain('https://static.cloudflareinsights.com');
  });

  it('allows only the external style and font origins used by the production shell', () => {
    const styleDirective = spaCsp().match(/style-src [^;]+/)?.[0] ?? '';
    expect(styleDirective).toContain("'unsafe-inline'");
    expect(styleDirective).toContain('https://accounts.google.com');
    expect(styleDirective).toContain('https://fonts.googleapis.com');
    expect(spaCsp()).toContain("font-src 'self' data: https://fonts.gstatic.com");
    expect(spaCsp()).toContain('https://cloudflareinsights.com');
  });
});
