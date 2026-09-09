#!/usr/bin/env node
/**
 * Send a dummy Telegram assignment alert to one employee (for testing).
 * Run: node scripts/test-telegram-employee.mjs 0165
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

const employeeCode = process.argv[2]?.trim();
if (!employeeCode) {
  console.error('Usage: node scripts/test-telegram-employee.mjs <EMPLOYEE_CODE>');
  console.error('Example: node scripts/test-telegram-employee.mjs 0165');
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

const { data: employee, error: empErr } = await sb
  .from('employees')
  .select('id, name, employee_code, telegram_chat_id')
  .eq('employee_code', employeeCode)
  .single();

if (empErr || !employee) {
  console.error(`Employee ${employeeCode} not found.`);
  process.exit(1);
}

if (!employee.telegram_chat_id) {
  console.error(`${employee.name} (${employeeCode}) is not connected to Telegram.`);
  console.error('Ask them to send /start ' + employeeCode + ' to @Malcon_Nexus_bot');
  process.exit(1);
}

const { data: caseRow, error: caseErr } = await sb
  .from('cases')
  .select('id, case_number')
  .order('updated_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (caseErr || !caseRow) {
  console.error('No case found to use for dummy test.');
  process.exit(1);
}

const res = await fetch(`${url}/functions/v1/send-telegram`, {
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
  console.error('Telegram test failed:', body.error ?? body.details ?? res.status);
  process.exit(1);
}

if (body.skipped) {
  console.error('Skipped:', body.reason ?? 'unknown');
  process.exit(1);
}

console.log(`Dummy assignment alert sent to ${employee.name} (${employeeCode}).`);
console.log(`Case used: ${caseRow.case_number}`);
console.log('They should see a Telegram message on their phone now.');
