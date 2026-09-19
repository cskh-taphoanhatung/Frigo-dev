#!/usr/bin/env node
// T17 WCAG-AA contrast audit for the semantic token combinations the migrated
// UI relies on. Reads hex values from tailwind.config.js (the single naming
// authority) and prints the ratio per pair. Exit 1 if a text pair is under
// 4.5:1 (normal text) or a UI/large-text pair is under 3:1. `decorative`
// pairs are reported but never gate.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const config = (await import(new URL('../../tailwind.config.js', import.meta.url))).default;

const semantic = config.theme.extend.colors.semantic;
const takosan = config.theme.extend.colors.takosan;
const rgb = (spec) => {
  const m = /rgb\((\d+) (\d+) (\d+)/.exec(spec);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  const h = spec.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lum = ([r, g, b]) => {
  const c = [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const S = (k) => semantic[k];
const T = (k, s = 'DEFAULT') => (typeof takosan[k] === 'string' ? takosan[k] : takosan[k][s]);
const WHITE = '#FFFFFF';

// [label, foreground, background, kind] — kind: text (4.5) | ui (3.0)
export const PAIRS = [
  ['text-primary on background', S('text-primary'), S('background'), 'text'],
  ['text-primary on surface', S('text-primary'), S('surface'), 'text'],
  ['text-secondary on background', S('text-secondary'), S('background'), 'text'],
  ['text-secondary on surface', S('text-secondary'), S('surface'), 'text'],
  ['text-secondary on background-subtle', S('text-secondary'), S('background-subtle'), 'text'],
  ['text-muted on background', S('text-muted'), S('background'), 'text'],
  ['text-muted on surface', S('text-muted'), S('surface'), 'text'],
  ['text-muted on background-subtle', S('text-muted'), S('background-subtle'), 'text'],
  ['text-muted on warning-soft', S('text-muted'), S('warning-soft'), 'text'],
  ['action-primary text on surface', S('action-primary'), S('surface'), 'text'],
  ['action-primary text on background', S('action-primary'), S('background'), 'text'],
  ['on-action-primary on action-primary', S('on-action-primary'), S('action-primary'), 'text'],
  ['on-action-primary on action-primary-hover', S('on-action-primary'), S('action-primary-hover'), 'text'],
  ['text-inverse on text-primary (dark chip)', S('text-inverse'), S('text-primary'), 'text'],
  ['success on success-soft', S('success'), S('success-soft'), 'ui'],
  ['warning-strong on warning-soft', S('warning-strong'), S('warning-soft'), 'text'],
  ['warning on warning-soft (icon)', S('warning'), S('warning-soft'), 'ui'],
  ['white on warning (badge)', WHITE, S('warning'), 'ui'],
  ['danger-strong on danger-soft', S('danger-strong'), S('danger-soft'), 'text'],
  ['danger text on surface', S('danger'), S('surface'), 'text'],
  ['white on danger (button)', WHITE, S('danger'), 'text'],
  ['white on danger-strong (button hover)', WHITE, S('danger-strong'), 'text'],
  ['info on info-soft', S('info'), S('info-soft'), 'text'],
  ['info on surface', S('info'), S('surface'), 'text'],
  ['green-deep on mint (chip)', T('green', 'deep'), T('mint'), 'text'],
  ['takosan-green on mint (icon)', T('green'), T('mint'), 'ui'],
  ['navy on cream', T('navy'), T('cream'), 'text'],
  ['navy on yellow (upgrade pill)', T('navy'), T('yellow'), 'text'],
  ['white on takosan-green', WHITE, T('green'), 'text'],
  ['white on navy', WHITE, T('navy'), 'text'],
  // Borders are decorative here: every input also has a fill change and a
  // 3px focus ring, so WCAG 1.4.11 does not apply to the resting border.
  ['border-strong on surface (decorative, informational only)', S('border-strong'), S('surface'), 'decorative'],
  ['focus ring on surface', S('focus'), S('surface'), 'ui'],
  ['focus ring on background', S('focus'), S('background'), 'ui'],
];

const rows = PAIRS.map(([label, fg, bg, kind]) => {
  const r = ratio(fg, bg);
  const min = kind === 'text' ? 4.5 : kind === 'ui' ? 3 : 0;
  return { label, fg: fg.replace(/ \/ <alpha-value>\)/, ')'), bg: bg.replace(/ \/ <alpha-value>\)/, ')'), kind, ratio: Number(r.toFixed(2)), min, pass: r >= min };
});
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const row of rows) console.log(`${row.kind === 'decorative' ? 'INFO' : row.pass ? 'PASS' : 'FAIL'} ${row.ratio.toFixed(2).padStart(6)} (min ${row.min}) ${row.label}`);
  const failed = rows.filter((r) => !r.pass);
  console.log(`t17-contrast: pairs=${rows.length} pass=${rows.length - failed.length} fail=${failed.length}`);
  process.exit(failed.length ? 1 : 0);
}
export { rows };
