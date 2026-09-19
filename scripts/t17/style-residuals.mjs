#!/usr/bin/env node
// T17 residual style audit. Reports every raw Tailwind palette class, raw hex
// colour and legacy animation utility in src/web, and fails unless each
// occurrence is covered by an explicit, justified allowlist entry below.
// Run: node scripts/t17/style-residuals.mjs   (exit 1 on unjustified residue)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();

/** Justified residue. `pattern` matches a class token; `files` scopes it. */
export const ALLOWLIST = [
  {
    id: 'payment-boundary',
    files: ['src/web/components/payment/VietQRModal.tsx'],
    pattern: /^(hover:|backdrop:)?(bg|text|border)-(slate|rose|amber)-\d+(\/\d+)?$/,
    reason: 'PayOS/payment UI is a protected boundary (AGENT_RULES rule 7); T17 leaves its neutral palette untouched so the payment diff stays zero.',
  },
];

// Raw palette families that are not part of the Takosan system.
const PALETTE = /(?<![\w-])((?:[a-z-]+:)*(?:bg|text|border|ring|from|via|to|divide|fill|stroke|placeholder|outline|shadow|accent|caret|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d{1,3})?)(?![\w/-])/g;
// Arbitrary colour values in class strings (bg-[#123456], text-[rgb(...)]).
const ARBITRARY = /(?<![\w-])((?:[a-z-]+:)*(?:bg|text|border|ring|from|via|to|fill|stroke)-\[(?:#|rgb|hsl)[^\]]*\])/g;
// Legacy / no-op animation utilities retired in T17.
const LEGACY_MOTION = /(?<![\w-])(transition-all|animate-in|zoom-in-95|slide-in-from-[a-z]+(?:-\d+)?)(?![\w-])/g;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(tsx?|css)$/.test(name) ? [full] : [];
  });
}

export function audit(base = root) {
  const findings = [];
  for (const file of walk(join(base, 'src/web'))) {
    const rel = relative(base, file);
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      for (const re of [PALETTE, ARBITRARY, LEGACY_MOTION]) {
        for (const match of line.matchAll(re)) {
          const token = match[1];
          const entry = ALLOWLIST.find((a) => a.files.includes(rel) && a.pattern.test(token));
          findings.push({ file: rel, line: index + 1, token, allow: entry?.id ?? null });
        }
      }
    });
  }
  return findings;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = audit();
  const unjustified = findings.filter((f) => !f.allow);
  const byAllow = new Map();
  for (const f of findings.filter((f) => f.allow)) byAllow.set(f.allow, (byAllow.get(f.allow) ?? 0) + 1);
  console.log(`t17-style-residuals: total=${findings.length} allowlisted=${findings.length - unjustified.length} unjustified=${unjustified.length}`);
  for (const [id, count] of byAllow) {
    const entry = ALLOWLIST.find((a) => a.id === id);
    console.log(`  [${id}] ${count} occurrence(s) in ${entry.files.join(', ')} — ${entry.reason}`);
  }
  for (const f of unjustified) console.log(`  UNJUSTIFIED ${f.file}:${f.line} ${f.token}`);
  process.exit(unjustified.length === 0 ? 0 : 1);
}
