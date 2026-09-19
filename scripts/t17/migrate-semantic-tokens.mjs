#!/usr/bin/env node
// T17 semantic-token codemod: rewrites legacy Tailwind neutral/status palette
// classes in src/web to the Takosan semantic utilities. Only class-token
// strings are touched (word-bounded); domain identifiers, storage keys and
// headers never match these patterns. Idempotent; re-run is a no-op.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const dry = process.argv.includes('--dry');

// Light-context neutrals → semantic tokens. Dark-context (camera/hero)
// slate-800/900/950 usages are left for the allowlist.
const MAP = new Map(Object.entries({
  // text
  'text-slate-900': 'text-semantic-text-primary',
  'text-slate-800': 'text-semantic-text-primary',
  'text-slate-700': 'text-semantic-text-secondary',
  'text-slate-600': 'text-semantic-text-secondary',
  'text-slate-500': 'text-semantic-text-muted',
  'text-slate-400': 'text-semantic-text-muted',
  'text-slate-300': 'text-semantic-border-strong',
  'placeholder:text-slate-400': 'placeholder:text-semantic-text-muted',
  'placeholder-slate-400': 'placeholder:text-semantic-text-muted',
  // fills
  'bg-slate-50': 'bg-semantic-background-subtle',
  'bg-slate-50/70': 'bg-semantic-background-subtle/70',
  'bg-slate-50/60': 'bg-semantic-background-subtle/60',
  'bg-slate-50/50': 'bg-semantic-background-subtle/50',
  'bg-slate-100': 'bg-semantic-border/60',
  'bg-slate-100/80': 'bg-semantic-border/50',
  'bg-slate-200': 'bg-semantic-border',
  'bg-slate-200/80': 'bg-semantic-border/80',
  'bg-slate-200/70': 'bg-semantic-border/70',
  'bg-slate-400': 'bg-semantic-border-strong',
  // borders / dividers / rings
  'border-slate-100': 'border-semantic-border/70',
  'border-slate-200': 'border-semantic-border',
  'border-slate-200/80': 'border-semantic-border',
  'border-slate-200/70': 'border-semantic-border/70',
  'border-slate-200/60': 'border-semantic-border/60',
  'border-slate-300': 'border-semantic-border-strong',
  'divide-slate-100': 'divide-semantic-border/70',
  'ring-slate-500': 'ring-semantic-border-strong',
  // scrims
  'bg-slate-950/40': 'bg-semantic-overlay/40',
  'bg-slate-950/50': 'bg-semantic-overlay/50',
  'bg-black/50': 'bg-semantic-overlay/50',
  'backdrop:bg-slate-950/50': 'backdrop:bg-semantic-overlay/50',
  // status: danger (rose/red)
  'bg-rose-50': 'bg-semantic-danger-soft',
  'bg-rose-50/60': 'bg-semantic-danger-soft/60',
  'bg-rose-50/40': 'bg-semantic-danger-soft/40',
  'hover:bg-rose-50': 'hover:bg-semantic-danger-soft',
  'hover:bg-rose-100': 'hover:bg-semantic-danger-soft',
  'hover:bg-rose-100/70': 'hover:bg-semantic-danger-soft/70',
  'border-rose-200': 'border-semantic-danger/30',
  'border-rose-200/80': 'border-semantic-danger/30',
  'border-rose-200/70': 'border-semantic-danger/30',
  'border-rose-500': 'border-semantic-danger',
  'text-rose-900': 'text-semantic-danger-strong',
  'text-rose-800': 'text-semantic-danger-strong',
  'text-rose-700': 'text-semantic-danger-strong',
  'text-rose-600': 'text-semantic-danger',
  'text-rose-500': 'text-semantic-danger',
  'hover:text-rose-600': 'hover:text-semantic-danger',
  'text-red-700': 'text-semantic-danger-strong',
  'bg-rose-500': 'bg-semantic-danger',
  'bg-rose-600': 'bg-semantic-danger',
  'hover:bg-rose-700': 'hover:bg-semantic-danger-strong',
  'active:bg-rose-800': 'active:bg-semantic-danger-strong',
  // status: warning (amber/orange)
  'bg-amber-50': 'bg-semantic-warning-soft',
  'bg-amber-50/50': 'bg-semantic-warning-soft/50',
  'bg-amber-100': 'bg-semantic-warning-soft',
  'bg-amber-200/70': 'bg-semantic-warning/20',
  'border-amber-100': 'border-semantic-warning/20',
  'border-amber-200': 'border-semantic-warning/30',
  'border-amber-200/90': 'border-semantic-warning/30',
  'border-amber-200/80': 'border-semantic-warning/30',
  'border-amber-200/60': 'border-semantic-warning/30',
  'border-amber-300': 'border-semantic-warning/50',
  'hover:border-amber-300': 'hover:border-semantic-warning/50',
  'text-amber-950': 'text-semantic-warning-strong',
  'text-amber-900': 'text-semantic-warning-strong',
  'text-amber-800': 'text-semantic-warning-strong',
  'text-amber-800/90': 'text-semantic-warning-strong/90',
  'text-amber-700': 'text-semantic-warning-strong',
  'text-amber-600': 'text-semantic-warning',
  'text-amber-500': 'text-semantic-warning',
  'bg-amber-500': 'bg-semantic-warning',
  'focus-visible:ring-amber-600': 'focus-visible:ring-semantic-warning',
  'bg-orange-50': 'bg-semantic-warning-soft',
  'border-orange-200/80': 'border-semantic-warning/30',
  'text-orange-900': 'text-semantic-warning-strong',
  'bg-orange-500': 'bg-semantic-warning',
  'text-orange-500': 'text-semantic-accent',
  // status: info (sky)
  'bg-sky-50': 'bg-semantic-info-soft',
  'border-sky-200': 'border-semantic-info/30',
  'border-sky-200/80': 'border-semantic-info/30',
  'text-sky-950': 'text-semantic-info',
  'text-sky-900': 'text-semantic-info',
  'bg-sky-500': 'bg-semantic-info',
  'bg-sky-400': 'bg-semantic-info',
}));

// Files the codemod never touches: the payment UI is a protected boundary
// (AGENT_RULES rule 7 — even presentation stays as-is in this pass) and the
// legacy asset manifest holds content paths only.
const SKIP = new Set([
  'src/web/lib/frigo-assets.ts',
  'src/web/components/payment/VietQRModal.tsx',
]);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(tsx?|css)$/.test(name) ? [full] : [];
  });
}

// Longest keys first so `bg-slate-50/70` wins over `bg-slate-50`.
const keys = [...MAP.keys()].sort((a, b) => b.length - a.length);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const pattern = new RegExp(`(?<![\\w-])(${keys.map(escape).join('|')})(?![\\w/-])`, 'g');

let files = 0; let replacements = 0;
for (const file of walk(join(root, 'src/web'))) {
  const rel = relative(root, file);
  if (SKIP.has(rel)) continue;
  const before = readFileSync(file, 'utf8');
  let count = 0;
  const after = before.replace(pattern, (m) => { count++; return MAP.get(m); });
  if (count > 0) {
    files++; replacements += count;
    if (!dry) writeFileSync(file, after);
    console.log(`${rel}: ${count}`);
  }
}
console.log(`${dry ? '[dry] ' : ''}files=${files} replacements=${replacements}`);
