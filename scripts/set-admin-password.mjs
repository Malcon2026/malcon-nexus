#!/usr/bin/env node
/**
 * Set (or rotate) the permanent password for the Malcon Nexus admin accounts.
 *
 *   node scripts/set-admin-password.mjs --password='NewPass@123'
 *   node scripts/set-admin-password.mjs --password='NewPass@123' --email=someone@malconnexus.com
 *
 * Defaults to all four admin logins. Uses the Supabase Admin API, so it needs
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (see .secrets/nexus-supabase.env).
 *
 * The passwords are permanent: Supabase Auth never expires them, and the app has
 * no "must change password" flag.
 */
import { readFileSync } from 'node:fs';

function argValue(flag, fallback) {
  const eq = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  return fallback;
}

function loadSecrets() {
  const env = {};
  try {
    for (const line of readFileSync('.secrets/nexus-supabase.env', 'utf8').split('\n')) {
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const i = line.indexOf('=');
      env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  } catch {
    /* fall back to process.env */
  }
  return env;
}

const secrets = loadSecrets();
const BASE = process.env.SUPABASE_URL || secrets.SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || secrets.SUPABASE_SERVICE_ROLE_KEY;
const password = argValue('--password', process.env.ADMIN_PASSWORD);
const only = argValue('--email');

const DEFAULT_ADMINS = [
  'jeevan.anishetti@malconnexus.com',
  'sushma.tadisetty@malconnexus.com',
  'preetam.tailam@malconnexus.com',
  'shireesha.tailam@malconnexus.com',
];

if (!BASE || !SRK) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (env or .secrets/nexus-supabase.env).');
  process.exit(1);
}
if (!password || password.length < 6) {
  console.error("Pass --password='...' (minimum 6 characters).");
  process.exit(1);
}

const targets = only ? [only] : DEFAULT_ADMINS;

async function api(path, method = 'GET', body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const { body: list } = await api('/auth/v1/admin/users?per_page=200');
const byEmail = new Map((list?.users ?? []).filter((u) => u.email).map((u) => [u.email.toLowerCase(), u.id]));

let failed = 0;
for (const email of targets) {
  const id = byEmail.get(email.toLowerCase());
  if (!id) {
    console.log(`  ${email.padEnd(40)} NOT FOUND`);
    failed += 1;
    continue;
  }
  // Password change also clears any "needs reauthentication" state for the account.
  const { status, body } = await api(`/auth/v1/admin/users/${id}`, 'PUT', { password });
  const ok = status === 200;
  if (!ok) failed += 1;
  console.log(`  ${email.padEnd(40)} ${ok ? 'updated' : `FAILED HTTP ${status} ${JSON.stringify(body).slice(0, 160)}`}`);
}

console.log(failed ? `\n${failed} account(s) failed.` : '\nAll admin passwords updated.');
process.exit(failed ? 1 : 0);
