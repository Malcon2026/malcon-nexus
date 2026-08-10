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
console.log('1. Set Supabase secret (run in terminal):');
console.log(`   npx supabase login`);
console.log(`   npx supabase secrets set GALLERY_TOKEN=${token} --project-ref ${projectRef}`);
console.log(`   npx supabase functions deploy gallery-feed --project-ref ${projectRef}`);
console.log('\n2. Deploy to Vercel (if git auto-deploy is stuck):');
console.log(`   cd ${root}`);
console.log(`   npm run build`);
console.log(`   npx vercel deploy --prod`);
console.log('\n3. Boss gallery link:');
console.log(`   https://malcon-nexus.vercel.app/gallery?token=${token}`);
console.log('\n4. Test edge function:');
const testUrl = `${supabaseUrl}/functions/v1/gallery-feed?token=${token}`;
console.log(`   curl "${testUrl}"`);
console.log('');

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
