#!/usr/bin/env node
// Deterministic PWA icon derivation from the supplied Takosan 1024px masters.
// Never redraws: only resizes the kit PNGs (and composites the adaptive layers
// for the maskable icon). Usage: node scripts/generate-takosan-icons.mjs <kit-dir>
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const kit = process.argv[2];
if (!kit) {
  console.error('usage: node scripts/generate-takosan-icons.mjs <takosan-brand-kit-dir>');
  process.exit(1);
}
const out = resolve('public/takosan/app-icons');
mkdirSync(out, { recursive: true });

const master = resolve(kit, 'app-icons/takosan-app-icon-light.png');
const foreground = resolve(kit, 'app-icons/takosan-adaptive-foreground.png');
const background = resolve(kit, 'app-icons/takosan-adaptive-background.png');

const SIZES = [16, 32, 48, 64, 128, 180, 192, 256, 512];
const resize = (size) => ({ width: size, height: size, fit: 'contain', kernel: 'lanczos3' });

for (const size of SIZES) {
  await sharp(master).resize(resize(size)).png({ compressionLevel: 9 }).toFile(`${out}/icon-${size}.png`);
}

// Maskable icon: opaque adaptive background + centered foreground so the mascot
// sits inside the 80% safe area on every launcher mask shape.
await sharp(background)
  .resize(resize(512))
  .composite([{ input: await sharp(foreground).resize(resize(512)).toBuffer() }])
  .flatten({ background: '#FFF8F3' })
  .png({ compressionLevel: 9 })
  .toFile(`${out}/icon-maskable-512.png`);

await sharp(master).resize(resize(512)).png({ compressionLevel: 9 }).toFile(`${out}/takosan-app-icon-light-512.png`);
await sharp(resolve(kit, 'app-icons/takosan-app-icon-mint.png')).resize(resize(512)).png({ compressionLevel: 9 }).toFile(`${out}/takosan-app-icon-mint-512.png`);

// OpenGraph card must be raster for social scrapers; rasterize the kit's own
// horizontal lockup SVG (no redraw) onto a cream 1200x630 card.
const lockup = await sharp(resolve(kit, 'logo/takosan-logo-horizontal-primary.svg'), { density: 300 })
  .resize({ width: 960, fit: 'inside' })
  .png()
  .toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#FFF8F3' } })
  .composite([{ input: lockup, gravity: 'centre' }])
  .flatten({ background: '#FFF8F3' })
  .png({ compressionLevel: 9 })
  .toFile(resolve('public/takosan/brand/takosan-og.png'));

console.log('takosan icons generated:', SIZES.map((s) => `icon-${s}.png`).join(', '), 'icon-maskable-512.png, takosan-og.png');
