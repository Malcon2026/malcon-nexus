/**
 * Generate Malcon Nexus PWA icons (light + dark + maskable) from src/assets/login-logo.png
 * Run: npm run icons:generate
 */
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const logoPath = resolve(root, 'src/assets/login-logo.png');
const outDir = resolve(root, 'public/icons');

const LIGHT = { bg: '#f5f5f7', mark: '#1d1d1f', border: 'rgba(0,0,0,0.06)' };
const DARK = { bg: '#1d1d1f', mark: '#ffffff', border: 'rgba(255,255,255,0.08)' };
mkdirSync(outDir, { recursive: true });

function roundedRectSvg(size, fill, stroke) {
  const r = Math.round(size * 0.21875); /* ~112 @ 512 — iOS-like */
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
    </svg>`,
  );
}

async function extractMark(logoColor, markSize) {
  const source = await sharp(logoPath).ensureAlpha().resize(markSize, markSize, { fit: 'contain' }).raw().toBuffer({
    resolveWithObject: true,
  });
  const { data, info } = source;
  const pixels = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const lum = (r + g + b) / 3;
    const onLogo = lum > 40;
    const rgb = hexToRgb(logoColor);
    pixels[i * 4] = rgb.r;
    pixels[i * 4 + 1] = rgb.g;
    pixels[i * 4 + 2] = rgb.b;
    pixels[i * 4 + 3] = onLogo ? 255 : 0;
  }
  return sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

async function buildIcon(size, palette, markScale, name) {
  const markSize = Math.round(size * markScale);
  const mark = await extractMark(palette.mark, markSize);
  const pad = Math.round((size - markSize) / 2);
  const bg = await sharp(roundedRectSvg(size, palette.bg, palette.border)).png().toBuffer();
  const composed = await sharp(bg)
    .composite([{ input: mark, top: pad, left: pad }])
    .png()
    .toBuffer();
  const path = resolve(outDir, name);
  await sharp(composed).toFile(path);
  return path;
}

async function buildMaskable(size, name) {
  const markSize = Math.round(size * 0.52);
  const mark = await extractMark(LIGHT.mark, markSize);
  const pad = Math.round((size - markSize) / 2);
  const bg = await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: hexToRgb(LIGHT.bg),
    },
  })
    .png()
    .toBuffer();
  await sharp(bg)
    .composite([{ input: mark, top: pad, left: pad }])
    .png()
    .toFile(resolve(outDir, name));
}

async function main() {
  const version = '20260321';
  await buildIcon(512, LIGHT, 0.58, `icon-light-512.png`);
  await buildIcon(192, LIGHT, 0.58, `icon-light-192.png`);
  await buildIcon(512, DARK, 0.58, `icon-dark-512.png`);
  await buildIcon(192, DARK, 0.58, `icon-dark-192.png`);
  await buildMaskable(512, 'icon-maskable-512.png');
  await sharp(resolve(outDir, 'icon-light-192.png')).resize(32, 32).toFile(resolve(outDir, 'favicon-32-light.png'));
  await sharp(resolve(outDir, 'icon-dark-192.png')).resize(32, 32).toFile(resolve(outDir, 'favicon-32-dark.png'));

  // Legacy paths (Hostinger / bookmarks) — light as default
  await sharp(resolve(outDir, 'icon-light-512.png')).toFile(resolve(root, 'public/malcon-nexus-icon-512.png'));
  await sharp(resolve(outDir, 'icon-light-192.png')).toFile(resolve(root, 'public/malcon-nexus-icon-192.png'));

  console.info(`[icons] Generated public/icons/* (cache bust: ?v=${version})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
