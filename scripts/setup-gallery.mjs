#!/usr/bin/env node
/**
 * One-time gallery setup helper.
 * Run: node scripts/setup-gallery.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, '.env'), 'utf8');
    const env = {};
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
    return env;
  } catch {
    return {};
  }
}

const env = loadEnv();
const token = env.GALLERY_TOKEN || 'malcon2026gallery';
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? 'urupxpfydfrvjlkpqlvi';

console.log('\n=== Malcon Gallery Setup ===\n');
console.log('Git → Vercel is NOT connected (no GitHub webhook). Use ONE of these:\n');
console.log('OPTION A — GitHub Actions (recommended):');
console.log('  1. Create token: https://vercel.com/account/tokens');
console.log('  2. Vercel → malcon-nexus → Settings → General → copy Project ID');
console.log('  3. Vercel → Team Settings → General → copy Team/Org ID');
console.log('  4. GitHub → Malcon2026/malcon-nexus → Settings → Secrets → Actions:');
console.log('       VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID');
console.log('  5. Push to main — workflow deploy-vercel.yml runs automatically\n');
console.log('OPTION B — Connect Vercel Git:');
console.log('  Vercel → malcon-nexus → Settings → Git → Connect Malcon2026/malcon-nexus\n');
console.log('OPTION C — Manual CLI:');
console.log(`  cd ${root} && npx vercel login && npm run build && npx vercel deploy --prod\n`);
console.log('Supabase (already done if edge test passes below):');
console.log(`  GALLERY_TOKEN=${token}`);
console.log('\nBoss gallery link (opens in any browser):');
console.log(`  https://malcon2026.github.io/malcon-nexus/?token=${token}`);
console.log('\nShort redirect link (same gallery):');
console.log(`  https://${projectRef}.supabase.co/functions/v1/gallery?token=${token}`);
console.log('\nIf GitHub Pages is blank, enable once: GitHub repo → Settings → Pages → branch gh-pages → /root\n');

const testUrl = `${supabaseUrl}/functions/v1/gallery-feed?token=${token}`;

async function testFeed() {
  if (!supabaseUrl) return;
  try {
    const res = await fetch(testUrl, {
      headers: env.VITE_SUPABASE_ANON_KEY ? { apikey: env.VITE_SUPABASE_ANON_KEY } : {},
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      console.log('✓ Edge function OK — albums:', body.albums?.length ?? 0);
    } else {
      console.log('✗ Edge function:', body.error || res.status);
      if (body.error === 'Gallery not configured') {
        console.log('  → Run step 1 above to set GALLERY_TOKEN secret.');
      }
    }
  } catch (err) {
    console.log('✗ Could not reach edge function:', err.message);
  }
  console.log('');
}

await testFeed();
