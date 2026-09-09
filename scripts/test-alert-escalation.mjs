#!/usr/bin/env node
/**
 * Test 3-step case alerts for an employee (by name fragment or employee code).
 *
 *   node scripts/test-alert-escalation.mjs Jeevan           → Alert 1 only (starts ladder)
 *   node scripts/test-alert-escalation.mjs Jeevan --all     → All 3 templates immediately
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

const query = process.argv[2]?.trim();
const allLevels = process.argv.includes('--all');

if (!query) {
  console.error('Usage: node scripts/test-alert-escalation.mjs <NAME_OR_CODE> [--all]');
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

let employee = null;
const byCode = await sb.from('employees').select('id,name,employee_code,telegram_chat_id').eq('employee_code', query).maybeSingle();
if (byCode.data) employee = byCode.data;
else {
  const { data: list } = await sb.from('employees').select('id,name,employee_code,telegram_chat_id').ilike('name', `%${query}%`);
  if (!list?.length) {
    console.error(`No employee matching "${query}"`);
    process.exit(1);
  }
  if (list.length > 1) {
    console.log('Multiple matches:');
    for (const e of list) console.log(`  ${e.employee_code} — ${e.name}`);
    console.error('Use employee code for a unique match.');
    process.exit(1);
  }
  employee = list[0];
}

const { data: caseRow } = await sb.from('cases').select('id,case_number').order('updated_at', { ascending: false }).limit(1).maybeSingle();
if (!caseRow) {
  console.error('No case found.');
  process.exit(1);
}

const fn = allLevels ? 'test-case-alerts' : 'start-case-alerts';
const res = await fetch(`${url}/functions/v1/${fn}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${anonKey}`,
  },
  body: JSON.stringify({
    event: 'assignment',
    caseId: caseRow.id,
    employeeId: employee.id,
  }),
});

const body = await res.json().catch(() => ({}));
if (!res.ok || body.error) {
  console.error('Test failed:', body.error ?? body.details ?? res.status);
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log(`Employee: ${employee.name} (${employee.employee_code ?? 'no code'})`);
console.log(`Case: ${caseRow.case_number}`);
if (allLevels) {
  console.log('Sent all 3 alert templates immediately.');
  console.log(JSON.stringify(body.results, null, 2));
} else {
  console.log('Alert 1 sent. Alert 2 in 15 min, Alert 3 in 30 min (if not acknowledged).');
  console.log(JSON.stringify(body, null, 2));
}
