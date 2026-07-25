#!/usr/bin/env node
/**
 * Sync payroll / attendance-sheet employee IDs into employees.employee_code.
 *
 * Reads EMOLYEE ID'S + names from csv.att.csv (or a path you pass), maps names
 * via scripts/lib/attendance_excel_mapping.py, and updates Supabase.
 *
 * Prerequisites:
 *   1. Run supabase/migrations/add-employee-code.sql in the SQL Editor
 *   2. VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 *
 * Usage:
 *   node scripts/sync-employee-codes.mjs
 *   node scripts/sync-employee-codes.mjs path/to/csv.att.csv
 *   node scripts/sync-employee-codes.mjs --dry-run
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnv();

const dryRun = process.argv.includes('--dry-run');
const csvArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const csvPath = resolve(root, csvArg || 'csv.att.csv');

if (!existsSync(csvPath)) {
  console.error(`CSV not found: ${csvPath}`);
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Load EXCEL_TO_EMAIL from the Python mapping module. */
function loadNameToEmail() {
  const py = `
import json, importlib.util, pathlib
p = pathlib.Path(${JSON.stringify(resolve(root, 'scripts/lib/attendance_excel_mapping.py'))})
spec = importlib.util.spec_from_file_location('m', p)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
print(json.dumps(m.EXCEL_TO_EMAIL))
`;
  const out = execFileSync('python3', ['-c', py], { encoding: 'utf8' });
  return JSON.parse(out);
}

function collapseWs(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function parseAttendanceCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    if (parts.length < 3) continue;
    const sno = parts[0].trim();
    const code = parts[1].trim();
    const name = parts[2].trim();
    if (!/^\d+$/.test(sno)) continue;
    if (!/^\d{3,5}$/.test(code)) continue;
    if (!name) continue;
    rows.push({ code, name });
  }
  return rows;
}

const nameToEmail = loadNameToEmail();
const emailByCollapsed = {};
for (const [name, email] of Object.entries(nameToEmail)) {
  emailByCollapsed[collapseWs(name)] = email;
}

const sheetRows = parseAttendanceCsv(readFileSync(csvPath, 'utf8'));
console.log(`Sheet rows with employee IDs: ${sheetRows.length}`);

const { data: employees, error: empErr } = await supabase
  .from('employees')
  .select('id, name, email, employee_code');
if (empErr) {
  console.error('Failed to load employees:', empErr.message);
  console.error('Did you run supabase/migrations/add-employee-code.sql?');
  process.exit(1);
}

const byEmail = new Map((employees ?? []).map((e) => [e.email.toLowerCase(), e]));

let updated = 0;
let skipped = 0;
let missing = 0;
const unmapped = [];

for (const row of sheetRows) {
  const email = emailByCollapsed[collapseWs(row.name)];
  if (!email) {
    unmapped.push(row);
    continue;
  }
  const emp = byEmail.get(email.toLowerCase());
  if (!emp) {
    console.warn(`No DB employee for ${row.code} ${row.name} → ${email}`);
    missing += 1;
    continue;
  }
  if ((emp.employee_code || '') === row.code) {
    skipped += 1;
    continue;
  }
  console.log(`${dryRun ? '[dry-run] ' : ''}${emp.name} (${email}): ${emp.employee_code || '(none)'} → ${row.code}`);
  if (!dryRun) {
    const { error } = await supabase
      .from('employees')
      .update({ employee_code: row.code })
      .eq('id', emp.id);
    if (error) {
      console.error(`  failed: ${error.message}`);
      continue;
    }
  }
  updated += 1;
  emp.employee_code = row.code;
}

console.log(`\nUpdated: ${updated}, already set: ${skipped}, missing in DB: ${missing}, unmapped names: ${unmapped.length}`);
if (unmapped.length) {
  console.log('Unmapped sheet rows (add to attendance_excel_mapping.py):');
  for (const u of unmapped) console.log(`  ${u.code}\t${u.name}`);
}
