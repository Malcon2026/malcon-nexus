#!/usr/bin/env node
/**
 * Create Supabase Auth users from employees CSV.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env (Dashboard → Settings → API → service_role).
 *
 * Usage:
 *   node scripts/create-auth-users.mjs
 *   node scripts/create-auth-users.mjs path/to/employees.csv
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

  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || url === 'https://your-project-id.supabase.co') {
  console.error('Set VITE_SUPABASE_URL in .env');
  process.exit(1);
}

if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env');
  console.error('Get it from: Supabase Dashboard → Settings → API → service_role key');
  console.error('\nWithout it, add users manually in Dashboard → Authentication → Users');
  console.error('using the same emails/passwords from your CSV, then run bootstrap-generated.sql.');
  process.exit(1);
}

const inputPath = resolve(root, process.argv[2] ?? 'supabase/employees-test-team.csv');
const rows = parseCsv(readFileSync(inputPath, 'utf8'));

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listError) {
  console.error('Failed to list users:', listError.message);
  process.exit(1);
}

const existingEmails = new Set(
  (listData?.users ?? [])
    .map((u) => u.email?.toLowerCase())
    .filter(Boolean)
);

let created = 0;
let skipped = 0;
let failed = 0;

for (const row of rows) {
  if (!row.email || !row.password) {
    console.warn(`Skipping row with missing email/password: ${row.name ?? '(no name)'}`);
    failed += 1;
    continue;
  }

  if (existingEmails.has(row.email.toLowerCase())) {
    console.log(`✓ exists  ${row.email}`);
    skipped += 1;
    continue;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: row.email,
    password: row.password,
    email_confirm: true,
    user_metadata: { name: row.name },
  });

  if (error) {
    console.error(`✗ failed  ${row.email}: ${error.message}`);
    failed += 1;
    continue;
  }

  console.log(`+ created ${row.email} (${data.user.id})`);
  created += 1;
}

console.log(`\nDone. created=${created}, skipped=${skipped}, failed=${failed}`);
console.log('Next: node scripts/generate-employee-bootstrap.mjs');
console.log('Then run supabase/bootstrap-generated.sql in SQL Editor.');
