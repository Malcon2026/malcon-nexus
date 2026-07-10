#!/usr/bin/env node
/**
 * Database health check — run: node scripts/db-health-check.mjs
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

const checks = [];

async function count(table) {
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
  return { table, count: error ? null : count, error: error?.message };
}

async function columnExists(table, column) {
  const { error } = await sb.from(table).select(column).limit(1);
  return !error;
}

console.log('=== Supabase Database Health Check ===\n');

for (const table of ['employees', 'hospitals', 'doctors', 'cases', 'approvals', 'notifications', 'activity_log', 'departments', 'surgical_kits']) {
  const r = await count(table);
  const status = r.error ? `ERROR: ${r.error}` : `${r.count} rows`;
  console.log(`${table.padEnd(16)} ${status}`);
  if (r.error) checks.push(`${table}: ${r.error}`);
}

const branchOk = await columnExists('hospitals', 'branch');
console.log(`\nhospitals.branch column: ${branchOk ? 'OK' : 'MISSING — run supabase/migrations/001-database-fixes.sql'}`);
if (!branchOk) checks.push('Missing hospitals.branch column');

const { data: unlinked } = await sb.from('employees').select('name,email').is('auth_user_id', null);
if (unlinked?.length) {
  console.log(`\nEmployees without auth link (${unlinked.length}):`);
  for (const e of unlinked) console.log(`  - ${e.name} <${e.email}>`);
  checks.push(`${unlinked.length} employees missing auth_user_id`);
}

const { data: pending } = await sb.from('cases').select('case_number,status').eq('status', 'Waiting For Approval');
console.log(`\nCases waiting for approval: ${pending?.length ?? 0}`);

console.log('\n=== Summary ===');
if (checks.length === 0) {
  console.log('No critical schema errors detected.');
} else {
  console.log('Issues found:');
  for (const c of checks) console.log(`  • ${c}`);
  console.log('\nFix: open Supabase → SQL Editor → run supabase/migrations/001-database-fixes.sql');
}

const hospitals = (await count('hospitals')).count ?? 0;
const cases = (await count('cases')).count ?? 0;
if (hospitals === 0) {
  console.log('\n⚠ No hospitals in database. Add hospitals in the app before creating cases.');
}
if (cases === 0 && hospitals > 0) {
  console.log('\n⚠ Hospitals exist but no cases yet. Create a case as admin, assign employee, then submit.');
}
