#!/usr/bin/env node
/**
 * Sync Supabase Auth login emails to match employees.email in the database.
 * Run after bulk email changes when auth was not updated.
 *
 * Usage: node scripts/repair-auth-emails.mjs
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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const sb = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: employees, error } = await sb
  .from('employees')
  .select('id, name, email, auth_user_id')
  .order('name');

if (error) {
  console.error('Failed to load employees:', error.message);
  process.exit(1);
}

let updated = 0;
let skipped = 0;
let failed = 0;

for (const emp of employees ?? []) {
  const dbEmail = emp.email?.trim().toLowerCase();
  if (!dbEmail) {
    console.log(`✗ ${emp.name}: missing email in database`);
    failed += 1;
    continue;
  }

  if (!emp.auth_user_id) {
    console.log(`– ${emp.name}: no auth account linked (${dbEmail})`);
    skipped += 1;
    continue;
  }

  const { data: userData, error: userError } = await sb.auth.admin.getUserById(emp.auth_user_id);
  if (userError || !userData.user) {
    console.log(`✗ ${emp.name}: auth user not found (${emp.auth_user_id})`);
    failed += 1;
    continue;
  }

  const authEmail = userData.user.email?.trim().toLowerCase();
  if (authEmail === dbEmail) {
    console.log(`✓ ${emp.name}: already in sync (${dbEmail})`);
    skipped += 1;
    continue;
  }

  const { error: updateError } = await sb.auth.admin.updateUserById(emp.auth_user_id, {
    email: dbEmail,
    email_confirm: true,
  });

  if (updateError) {
    console.log(`✗ ${emp.name}: ${authEmail} → ${dbEmail} failed — ${updateError.message}`);
    failed += 1;
    continue;
  }

  console.log(`+ ${emp.name}: ${authEmail} → ${dbEmail}`);
  updated += 1;
}

console.log(`\nDone. updated=${updated}, skipped=${skipped}, failed=${failed}`);
