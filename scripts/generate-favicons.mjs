/**
 * Generates PNG favicons from client/assets/icons/favicon.svg.
 * Run once: node scripts/generate-favicons.mjs
 *
 * Chromium icon sizes:
 *   16x16   — tab favicon (standard)
 *   32x32   — tab favicon (HiDPI / taskbar)
 *   48x48   — extensions page
 *   192x192 — Android / PWA home screen
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp not found. Run: npm install --save-dev sharp');
  process.exit(1);
}

const svgPath = join(root, 'client', 'src', 'assets', 'icons', 'favicon.svg');
const svgBuffer = readFileSync(svgPath);

const sizes = [16, 32, 48, 192];

for (const size of sizes) {
  const outPath = join(root, 'client', 'src', 'assets', 'icons', `favicon-${size}x${size}.png`);
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`favicon-${size}x${size}.png`);
}

// build/icon.png + build/icon.ico — used by electron-builder and Inno Setup.
const buildDir = join(root, 'build');
mkdirSync(buildDir, { recursive: true });
await sharp(svgBuffer).resize(256, 256).png().toFile(join(buildDir, 'icon.png'));
console.log('build/icon.png');

// Generate a multi-resolution ICO (16, 32, 48, 64, 128, 256) with embedded PNGs.
const icoSizes = [16, 32, 48, 64, 128, 256];
const pngBuffers = await Promise.all(
  icoSizes.map((s) => sharp(svgBuffer).resize(s, s).png().toBuffer())
);

// ICO binary layout: 6-byte header + 16-byte dir entry per image + image data.
const headerSize = 6 + icoSizes.length * 16;
const offsets = [];
let offset = headerSize;
for (const buf of pngBuffers) { offsets.push(offset); offset += buf.length; }

const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0);                  // reserved
header.writeUInt16LE(1, 2);                  // type: ICO
header.writeUInt16LE(icoSizes.length, 4);    // image count
for (let i = 0; i < icoSizes.length; i++) {
  const s = icoSizes[i];
  const base = 6 + i * 16;
  header.writeUInt8(s === 256 ? 0 : s, base);      // width (0 = 256)
  header.writeUInt8(s === 256 ? 0 : s, base + 1);  // height
  header.writeUInt8(0, base + 2);                   // color count
  header.writeUInt8(0, base + 3);                   // reserved
  header.writeUInt16LE(1, base + 4);                // planes
  header.writeUInt16LE(32, base + 6);               // bit count
  header.writeUInt32LE(pngBuffers[i].length, base + 8);  // data size
  header.writeUInt32LE(offsets[i], base + 12);            // data offset
}

writeFileSync(join(buildDir, 'icon.ico'), Buffer.concat([header, ...pngBuffers]));
console.log('build/icon.ico');

console.log('Done.');
