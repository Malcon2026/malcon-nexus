#!/usr/bin/env node
/**
 * Sync employees from CSV → Supabase Auth + employees table.
 * Safe to re-run after editing the CSV (creates new users, updates existing profiles).
 *
 * Usage:
 *   node scripts/sync-employees-from-csv.mjs
 *   node scripts/sync-employees-from-csv.mjs path/to/employees.csv
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { parseCsvObjects } from './lib/csv.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const VALID_DEPARTMENTS = new Set([
  'Stores', 'Scrub Person', 'Cleaning Department',
  'Stores Audit', 'Accounts', 'Bill Submission', 'Admin',
]);

const DEPARTMENT_ALIASES = {
  scrub: 'Scrub Person',
  'scrub person': 'Scrub Person',
  cleaning: 'Cleaning Department',
  audit: 'Stores Audit',
  accounts: 'Accounts',
  collection: 'Bill Submission',
  'collection executive': 'Bill Submission',
  'bill submission': 'Bill Submission',
  admin: 'Admin',
  stores: 'Stores',
};

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

function normalizeDepartment(value) {
  const trimmed = value.trim();
  if (VALID_DEPARTMENTS.has(trimmed)) return trimmed;
  const alias = DEPARTMENT_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  throw new Error(`Invalid department "${value}". Use: ${[...VALID_DEPARTMENTS].join(', ')}`);
}

function initials(name) {
  return name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

loadEnv();

const inputPath = resolve(root, process.argv[2] ?? 'supabase/employees.csv');
const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const rows = parseCsvObjects(readFileSync(inputPath, 'utf8'), {
  requiredColumns: ['name', 'email', 'password', 'department', 'role'],
}).map((row) => ({
  ...row,
  department: normalizeDepartment(row.department),
}));
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listError) {
  console.error('Failed to list users:', listError.message);
  process.exit(1);
}

const byEmail = new Map((listData.users ?? []).map((u) => [u.email?.toLowerCase(), u]));

let authCreated = 0;
let authSkipped = 0;
let employeesUpdated = 0;
let failed = 0;

for (const row of rows) {
  if (!row.email || !row.password || !row.name) {
    console.error(`✗ row ${row._line}: missing name, email, or password`);
    failed += 1;
    continue;
  }

  let authUser = byEmail.get(row.email.toLowerCase());
  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: row.email,
      password: row.password,
      email_confirm: true,
      user_metadata: { name: row.name },
    });
    if (error) {
      console.error(`✗ auth ${row.email}: ${error.message}`);
      failed += 1;
      continue;
    }
    authUser = data.user;
    byEmail.set(row.email.toLowerCase(), authUser);
    console.log(`+ auth     ${row.email}`);
    authCreated += 1;
  } else {
    console.log(`✓ auth     ${row.email}`);
    authSkipped += 1;
  }

  const { error: empError } = await supabase.from('employees').upsert({
    name: row.name,
    email: row.email,
    department: row.department,
    role: row.role,
    status: 'Active',
    avatar: initials(row.name),
    phone: row.phone || '',
    cases_completed: 0,
    cases_active: 0,
    join_date: new Date().toISOString().split('T')[0],
    auth_user_id: authUser.id,
  }, { onConflict: 'email' });

  if (empError) {
    console.error(`✗ employee ${row.email}: ${empError.message}`);
    failed += 1;
    continue;
  }

  console.log(`✓ profile  ${row.email} (${row.role}, ${row.department})`);
  employeesUpdated += 1;
}

console.log(`\nDone from ${inputPath}`);
console.log(`auth: created=${authCreated}, skipped=${authSkipped}`);
console.log(`profiles updated=${employeesUpdated}, failed=${failed}`);
console.log('Refresh the app (or re-login) to see changes.');
