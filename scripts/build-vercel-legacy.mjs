/**
 * Vercel-only output: beta sunset notice (legacy URL / old bookmarks).
 * Production app: https://app.malconnexus.com (Hostinger).
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#f5f5f7" />
    <title>Malcon Nexus — Beta closed</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html {
        height: 100%;
        -webkit-text-size-adjust: 100%;
      }
      body {
        margin: 0;
        min-height: 100%;
        min-height: 100dvh;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 16px;
        line-height: 1.5;
        color: #1d1d1f;
        background: #f5f5f7;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: max(24px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right))
          max(24px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
      }
      .shell {
        width: 100%;
        max-width: 440px;
      }
      .card {
        background: #ffffff;
        border-radius: 20px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.04);
        padding: 2rem 1.75rem 1.75rem;
        text-align: center;
      }
      .emoji {
        font-size: 2.75rem;
        line-height: 1;
        margin-bottom: 0.75rem;
        display: block;
      }
      h1 {
        margin: 0 0 1.25rem;
        font-size: 1.375rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        line-height: 1.25;
        color: #1d1d1f;
      }
      .body {
        text-align: left;
        font-size: 0.9375rem;
        line-height: 1.55;
        color: #424245;
      }
      .body p {
        margin: 0 0 1rem;
      }
      .body p:last-child {
        margin-bottom: 0;
      }
      .callout {
        margin-top: 1.25rem;
        padding: 0.875rem 1rem;
        background: rgba(0, 113, 227, 0.08);
        border-radius: 12px;
        border: 1px solid rgba(0, 113, 227, 0.15);
        font-size: 0.8125rem;
        color: #1d1d1f;
        text-align: center;
        line-height: 1.45;
      }
      .footer {
        margin-top: 1.5rem;
        padding-top: 1.25rem;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        font-size: 0.75rem;
        font-weight: 500;
        color: #86868b;
        letter-spacing: 0.01em;
      }
      .brand {
        margin-top: 1.25rem;
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #0071e3;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <article class="card" role="status" aria-live="polite">
        <span class="emoji" aria-hidden="true">🙏</span>
        <h1>Thank you — beta team</h1>
        <div class="body">
          <p>We appreciate everyone who used Malcon Nexus during the beta stage. You helped us test attendance, cases, and day-to-day workflows before go-live.</p>
          <p>The previous (beta) app and old bookmarks are now closed and will not open.</p>
          <p>New login instructions and the official app link will be announced shortly.</p>
          <p>Remove old shortcuts from your phone; we&rsquo;ll share the correct steps in the next update.</p>
        </div>
        <p class="callout">Please wait for the official message from Malcon.<br />Do not use old app links.</p>
        <p class="footer">Malcon Life Sciences / Malcon Nexus</p>
      </article>
      <p class="brand">Beta program closed</p>
    </div>
    <script>
      (function () {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(function (rs) {
            rs.forEach(function (r) { r.unregister(); });
          });
        }
        if (window.caches && caches.keys) {
          caches.keys().then(function (keys) {
            keys.forEach(function (k) { caches.delete(k); });
          });
        }
      })();
    </script>
  </body>
</html>
`;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
writeFileSync(resolve(dist, 'index.html'), html, 'utf8');

console.info('[vercel-legacy] Wrote dist/index.html (beta thank-you legacy page)');
