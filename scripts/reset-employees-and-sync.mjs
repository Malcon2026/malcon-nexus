#!/usr/bin/env node
/**
 * Delete all employees + auth users, then import fresh from CSV.
 * Keeps cases, hospitals, doctors, kits (clears case assignments).
 *
 * Usage:
 *   node scripts/reset-employees-and-sync.mjs
 *   node scripts/reset-employees-and-sync.mjs path/to/employees.csv
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { parseCsvObjects } from './lib/csv.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const VALID_DEPARTMENTS = new Set([
  'Stores', 'Delivery', 'Scrub Person', 'Cleaning Department',
  'Stores Audit', 'Accounts', 'Bill Submission', 'Admin',
]);

const DEPARTMENT_ALIASES = {
  scrub: 'Scrub Person',
  'scrub person': 'Scrub Person',
  cleaning: 'Cleaning Department',
  audit: 'Stores Audit',
  accounts: 'Accounts',
  collection: 'Bill Submission',
  'bill submission': 'Bill Submission',
  admin: 'Admin',
  stores: 'Stores',
  delivery: 'Delivery',
  delevery: 'Delivery',
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

function normalizeRole(value) {
  const role = value.trim().toLowerCase();
  if (role === 'admin' || role === 'employee') return role;
  throw new Error(`Invalid role "${value}". Use admin or employee.`);
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
  email: row.email.trim().toLowerCase(),
  department: normalizeDepartment(row.department),
  role: normalizeRole(row.role),
}));

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('Step 1: Clearing attendance, notifications, case assignments…');

await supabase.from('attendance_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
await supabase.from('attendance_approval_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
await supabase.from('cases').update({
  assigned_employee_id: null,
  assigned_employee_snapshot: null,
}).neq('id', '00000000-0000-0000-0000-000000000000');

console.log('Step 2: Deleting all employees…');
const { error: delEmpErr } = await supabase.from('employees').delete().neq('id', '00000000-0000-0000-0000-000000000000');
if (delEmpErr) {
  console.error('Failed to delete employees:', delEmpErr.message);
  process.exit(1);
}

console.log('Step 3: Deleting all auth users…');
let page = 1;
let deletedAuth = 0;
while (true) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error('Failed to list auth users:', error.message);
    process.exit(1);
  }
  const users = data.users ?? [];
  if (users.length === 0) break;
  for (const user of users) {
    const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error(`✗ delete auth ${user.email}: ${delErr.message}`);
    } else {
      console.log(`- auth removed ${user.email}`);
      deletedAuth += 1;
    }
  }
  if (users.length < 200) break;
  page += 1;
}

console.log(`Step 4: Importing ${rows.length} employees from CSV…`);
let created = 0;
let failed = 0;

for (const row of rows) {
  if (!row.email || !row.password || !row.name) {
    console.error(`✗ row ${row._line}: missing name, email, or password`);
    failed += 1;
    continue;
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: row.email,
    password: row.password,
    email_confirm: true,
    user_metadata: { name: row.name },
  });

  if (authError || !authData.user) {
    console.error(`✗ auth ${row.email}: ${authError?.message ?? 'unknown error'}`);
    failed += 1;
    continue;
  }

  const { error: empError } = await supabase.from('employees').insert({
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
    auth_user_id: authData.user.id,
  });

  if (empError) {
    console.error(`✗ employee ${row.email}: ${empError.message}`);
    await supabase.auth.admin.deleteUser(authData.user.id);
    failed += 1;
    continue;
  }

  console.log(`+ ${row.name} <${row.email}> (${row.role}, ${row.department})`);
  created += 1;
}

console.log('\nDone.');
console.log(`Auth users removed: ${deletedAuth}`);
console.log(`Employees created: ${created}, failed: ${failed}`);
console.log('Log in with any CSV email + password. Re-assign cases to employees in the app.');
