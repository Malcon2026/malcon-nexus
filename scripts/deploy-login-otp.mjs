#!/usr/bin/env node
/**
 * Deploy Telegram OTP login edge functions + remind to run SQL migration.
 *
 *   node scripts/deploy-login-otp.mjs
 *
 * Requires SUPABASE_ACCESS_TOKEN and VITE_SUPABASE_URL in .env / .env.local
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const env = { ...process.env };
  for (const f of ['.env', '.env.local']) {
    const p = resolve(root, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0 && !env[t.slice(0, i).trim()]) {
        env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  return env;
}

const env = loadEnv();
const projectRef = env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!env.SUPABASE_ACCESS_TOKEN) {
  console.error('\nMissing SUPABASE_ACCESS_TOKEN — add to .env\n');
  process.exit(1);
}
if (!projectRef) {
  console.error('\nMissing VITE_SUPABASE_URL\n');
  process.exit(1);
}

process.env.SUPABASE_ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN;

const migrationSql = readFileSync(
  resolve(root, 'supabase/migrations/add-login-otps.sql'),
  'utf8',
);

console.log('Applying login_otps migration…');
const migRes = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: migrationSql }),
  },
);

if (!migRes.ok) {
  const text = await migRes.text();
  console.error('Migration failed:', migRes.status, text);
  process.exit(1);
}
console.log('✓ login_otps migration applied');

for (const fn of ['request-login-otp', 'verify-login-otp']) {
  console.log(`Deploying ${fn}…`);
  execSync(
    `npx supabase functions deploy ${fn} --project-ref ${projectRef} --no-verify-jwt`,
    { cwd: root, stdio: 'inherit', env: process.env },
  );
}

console.log('\n✓ OTP functions deployed.');
console.log('Run SQL once if not applied: supabase/migrations/add-login-otps.sql');
console.log('Optional secret: LOGIN_OTP_SECRET (defaults to service role pepper)\n');
