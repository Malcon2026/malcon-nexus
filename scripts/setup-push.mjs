#!/usr/bin/env node
/**
 * Web Push setup for Malcon Nexus PWA.
 *
 * 1. Generates VAPID keys (or use existing from env)
 * 2. Sets Supabase secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
 * 3. Prints VITE_VAPID_PUBLIC_KEY for Vercel / .env
 *
 * Run: node scripts/setup-push.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
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

function parseVapidOutput(text) {
  const pub = text.match(/Public Key:\s*(\S+)/)?.[1];
  const priv = text.match(/Private Key:\s*(\S+)/)?.[1];
  return { pub, priv };
}

const env = loadEnv();
let publicKey = env.VAPID_PUBLIC_KEY || env.VITE_VAPID_PUBLIC_KEY;
let privateKey = env.VAPID_PRIVATE_KEY;

if (!publicKey || !privateKey) {
  const out = execFileSync('npx', ['--yes', 'web-push', 'generate-vapid-keys'], {
    encoding: 'utf8',
    cwd: root,
  });
  const parsed = parseVapidOutput(out);
  publicKey = parsed.pub;
  privateKey = parsed.priv;
}

if (!publicKey || !privateKey) {
  console.error('Could not generate VAPID keys');
  process.exit(1);
}

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

console.log('\n=== Malcon Nexus Web Push Setup ===\n');
console.log('Add to Vercel + local .env:');
console.log(`VITE_VAPID_PUBLIC_KEY=${publicKey}`);
console.log('');

if (projectRef && env.SUPABASE_ACCESS_TOKEN) {
  console.log('Setting Supabase secrets...');
} else if (projectRef) {
  console.log('Supabase secrets (Dashboard → Edge Functions → Secrets):');
  console.log(`  VAPID_PUBLIC_KEY=${publicKey}`);
  console.log(`  VAPID_PRIVATE_KEY=${privateKey}`);
  console.log('\nOr run with SUPABASE_ACCESS_TOKEN in .env for auto-set.');
} else {
  console.log('Supabase secrets:');
  console.log(`  VAPID_PUBLIC_KEY=${publicKey}`);
  console.log(`  VAPID_PRIVATE_KEY=${privateKey}`);
}

console.log('\nDeploy functions:');
console.log('  npx supabase functions deploy push-subscribe');
console.log('  npx supabase functions deploy send-push');
console.log('\nRun migration: supabase/migrations/add-push-subscriptions.sql');
console.log('\nEmployees: Settings → Notifications → Enable phone notifications');
console.log('(Install PWA to home screen on iPhone for push to work.)\n');

if (projectRef) {
  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/secrets`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secrets: [
            { name: 'VAPID_PUBLIC_KEY', value: publicKey },
            { name: 'VAPID_PRIVATE_KEY', value: privateKey },
          ],
        }),
      },
    );
    if (res.ok) console.log('✓ Supabase secrets updated via API\n');
  } catch {
    /* manual */
  }
}
