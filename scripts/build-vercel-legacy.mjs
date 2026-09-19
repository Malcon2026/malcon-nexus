/**
 * Vercel-only output: single page with looping GIF (legacy URL / old bookmarks).
 * Production app: https://app.malconnexus.com (Hostinger).
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

const GIF_URL =
  'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExcWVuemdrem1nNzRoOXE3ajB5MjZyOXBmbTBsZDAyejdzaDczNXF3eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/lxxOGaDRk4f7R5TkBd/giphy.gif';

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#000000" />
    <title>Malcon Nexus</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; }
      html, body {
        height: 100%;
        background: #000;
        overflow: hidden;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
      }
      img {
        display: block;
        max-width: min(100%, 720px);
        max-height: 100dvh;
        width: auto;
        height: auto;
        object-fit: contain;
      }
    </style>
  </head>
  <body>
    <img src="${GIF_URL}" width="480" height="270" alt="" decoding="async" fetchpriority="high" />
  </body>
</html>
`;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
writeFileSync(resolve(dist, 'index.html'), html, 'utf8');

console.info('[vercel-legacy] Wrote dist/index.html (GIF-only legacy page)');
