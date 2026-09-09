#!/usr/bin/env node
/**
 * One-time TV board kiosk setup helper.
 * Run: node scripts/setup-tv.mjs
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
const token = env.TV_BOARD_TOKEN || env.GALLERY_TOKEN || 'malcon2026gallery';
const appUrl = env.APP_URL || 'https://malcon-nexus-gamma.vercel.app';
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? 'YOUR_PROJECT';

console.log('\n=== Malcon TV Board Kiosk Setup ===\n');
console.log('1. Supabase Dashboard → Project Settings → Edge Functions → Secrets');
console.log(`   TV_BOARD_TOKEN=${token}`);
console.log('\n2. Deploy edge function (if not already):');
console.log('   supabase functions deploy tv-board-feed');
console.log('\n3. Office TV / kiosk bookmark (Chrome --kiosk recommended):');
console.log(`   ${appUrl}/tv?token=${token}&kiosk=1`);
console.log('\n4. Test feed:');
console.log(`   curl "${supabaseUrl || `https://${projectRef}.supabase.co`}/functions/v1/tv-board-feed?token=${token}" | head -c 200`);
console.log('');
