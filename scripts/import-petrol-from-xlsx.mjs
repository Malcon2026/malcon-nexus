#!/usr/bin/env node
/**
 * Import petrol slips from PETROL FORMAT JUNE DELIVARY BOYS.xlsx into
 * employee_daily_expenses (kms + petrol only; no new fields).
 *
 * Same-day slips for one employee are summed. Existing food/other on that
 * day are preserved; kms + petrol are set from the Excel totals.
 *
 * Usage:
 *   node scripts/import-petrol-from-xlsx.mjs
 *   node scripts/import-petrol-from-xlsx.mjs --dry-run
 *   node scripts/import-petrol-from-xlsx.mjs path/to/file.xlsx
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const xlsxArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const xlsxPath = resolve(root, xlsxArg || 'PETROL FORMAT JUNE DELIVARY BOYS.xlsx');

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const envPath = resolve(root, f);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    }
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
if (!existsSync(xlsxPath)) {
  console.error(`Excel not found: ${xlsxPath}`);
  process.exit(1);
}

const parsed = JSON.parse(
  execFileSync('python3', [resolve(__dirname, 'lib/parse-petrol-xlsx.py'), xlsxPath], {
    encoding: 'utf8',
  }),
);

if (parsed.error) {
  console.error(parsed.error);
  process.exit(1);
}

console.log(`Source: ${parsed.source}`);
console.log(`Raw slip rows: ${parsed.rawRows}`);
console.log(`Aggregated employee-days: ${parsed.entries.length}`);
console.log(`Skipped rows: ${parsed.skipped.length}`);
if (parsed.unmappedEmployees?.length) {
  console.warn('Unmapped employees (skipped):', parsed.unmappedEmployees.join(', '));
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const emails = [...new Set(parsed.entries.map((e) => e.email))];
const { data: employees, error: empErr } = await supabase
  .from('employees')
  .select('id, name, email')
  .in('email', emails);

if (empErr) {
  console.error('Failed to load employees:', empErr.message);
  process.exit(1);
}

const byEmail = new Map((employees ?? []).map((e) => [e.email.toLowerCase(), e]));
const missing = emails.filter((e) => !byEmail.has(e.toLowerCase()));
if (missing.length) {
  console.warn('Emails not in Supabase (skipped):', missing.join(', '));
}

const toImport = parsed.entries.filter((e) => byEmail.has(e.email.toLowerCase()));
console.log(`Will upsert: ${toImport.length} day rows${dryRun ? ' (dry-run)' : ''}`);

if (dryRun) {
  const sample = toImport.slice(0, 8);
  for (const row of sample) {
    const emp = byEmail.get(row.email.toLowerCase());
    console.log(
      `  ${row.expenseDate}  ${emp.name.padEnd(28)} kms=${row.kmsDriven} petrol=₹${row.petrolAmount} (${row.slips} slips)`,
    );
  }
  if (toImport.length > sample.length) console.log(`  … ${toImport.length - sample.length} more`);
  process.exit(0);
}

const now = new Date().toISOString();
let inserted = 0;
let updated = 0;
let failed = 0;

for (const row of toImport) {
  const emp = byEmail.get(row.email.toLowerCase());
  const { data: existing, error: findErr } = await supabase
    .from('employee_daily_expenses')
    .select('*')
    .eq('employee_id', emp.id)
    .eq('expense_date', row.expenseDate)
    .maybeSingle();

  if (findErr) {
    console.error(`Lookup failed ${emp.name} ${row.expenseDate}:`, findErr.message);
    failed++;
    continue;
  }

  const payload = {
    id: existing?.id ?? randomUUID(),
    employee_id: emp.id,
    employee_name: emp.name,
    expense_date: row.expenseDate,
    kms_driven: row.kmsDriven,
    petrol_amount: row.petrolAmount,
    food_amount: existing?.food_amount ?? 0,
    other_amount: existing?.other_amount ?? 0,
    other_description: existing?.other_description ?? '',
    notes: existing?.notes ?? '',
    entered_by: existing?.entered_by || 'Petrol Excel import',
    entered_by_id: existing?.entered_by_id ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  const { error: upErr } = await supabase.from('employee_daily_expenses').upsert(payload);
  if (upErr) {
    console.error(`Upsert failed ${emp.name} ${row.expenseDate}:`, upErr.message);
    failed++;
    continue;
  }
  if (existing) updated++;
  else inserted++;
}

console.log(`Done. inserted=${inserted} updated=${updated} failed=${failed}`);
if (failed) process.exit(1);
