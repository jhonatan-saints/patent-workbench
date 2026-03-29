/**
 * Generates PNG favicons from client/public/favicon.svg.
 * Run once: node scripts/generate-favicons.mjs
 *
 * Chromium icon sizes:
 *   16x16   — tab favicon (standard)
 *   32x32   — tab favicon (HiDPI / taskbar)
 *   48x48   — extensions page
 *   192x192 — Android / PWA home screen
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp not found. Run: npm install --save-dev sharp');
  process.exit(1);
}

const svgPath = join(root, 'client', 'public', 'favicon.svg');
const svgBuffer = readFileSync(svgPath);

const sizes = [16, 32, 48, 192];

for (const size of sizes) {
  const outPath = join(root, 'client', 'public', `favicon-${size}x${size}.png`);
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`favicon-${size}x${size}.png`);
}

console.log('Done.');
