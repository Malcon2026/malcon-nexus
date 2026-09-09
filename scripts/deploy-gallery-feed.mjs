#!/usr/bin/env node
/**
 * Deploy gallery-feed (includes TV board mode) using Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN in .env or environment.
 *
 * Run: node scripts/deploy-gallery-feed.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(resolve(root, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {
    /* no .env */
  }
  return env;
}

const env = loadEnv();
const accessToken = env.SUPABASE_ACCESS_TOKEN;
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!accessToken) {
  console.error('\nMissing SUPABASE_ACCESS_TOKEN in .env');
  console.error('Get one from: https://supabase.com/dashboard/account/tokens');
  console.error('Then add: SUPABASE_ACCESS_TOKEN=sbp_...\n');
  process.exit(1);
}

if (!projectRef) {
  console.error('Missing VITE_SUPABASE_URL in .env');
  process.exit(1);
}

const functionBody = readFileSync(
  resolve(root, 'supabase/functions/gallery-feed/index.ts'),
  'utf8',
);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/functions/gallery-feed/body`,
  {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: functionBody }),
  },
);

if (!res.ok) {
  const text = await res.text();
  console.error('Deploy failed:', res.status, text);
  process.exit(1);
}

console.log('\n✓ gallery-feed deployed (TV mode: ?mode=tv&token=...)');
console.log(`  Project: ${projectRef}`);
console.log('\nTV board URL:');
const tvToken = env.TV_BOARD_TOKEN || env.GALLERY_TOKEN || 'YOUR_TOKEN';
console.log(`  https://malcon-nexus-gamma.vercel.app/tv?token=${tvToken}&kiosk=1\n`);
