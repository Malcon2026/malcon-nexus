#!/usr/bin/env node
/**
 * Admin siren test — pings all employees who have Malcon Nexus open on screen.
 * Run: node scripts/trigger-siren-test.mjs
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env and the app_settings Realtime migration applied.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const at = String(Date.now());
const { error } = await sb.from('app_settings').upsert({
  key: 'siren_test_at',
  value: at,
  updated_by: 'trigger-siren-test.mjs',
  updated_at: new Date().toISOString(),
});

if (error) {
  console.error('Failed:', error.message);
  process.exit(1);
}

console.log(`Siren test ping sent (${at}).`);
console.log('Employees hear it only if Malcon Nexus is open on their screen with the latest app version.');
