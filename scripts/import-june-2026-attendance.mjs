#!/usr/bin/env node
/**
 * One-time import: matched rows from EMP ATTENDANCE JUNE-2026.xlsx → Supabase.
 *
 * Usage:
 *   node scripts/import-june-2026-attendance.mjs
 *   node scripts/import-june-2026-attendance.mjs --dry-run
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

const OFFICE = {
  address: 'CCWW+RJ, Hyderabad, Telangana',
  latitude: 17.4470625,
  longitude: 78.4465625,
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

function istIso(dateKey, hour, minute) {
  return `${dateKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+05:30`;
}

function parseSheet() {
  const out = execFileSync('python3', [resolve(__dirname, 'lib/parse-june-2026-xlsx.py')], {
    encoding: 'utf8',
  });
  return JSON.parse(out);
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);
const data = parseSheet();

const { error: leaveProbeErr } = await supabase.from('leave_requests').select('id').limit(1);
const leaveTableAvailable = !leaveProbeErr?.message?.includes('Could not find the table');
if (!leaveTableAvailable) {
  console.warn('leave_requests table not found — importing Present days only. Run add-leave-management.sql for Leave days.');
}

console.log(`Salary month: ${data.salaryMonth}`);
console.log(`Date columns: ${data.columns.length} (${data.columns[0]?.dateKey} → ${data.columns.at(-1)?.dateKey})`);
console.log(`Matched employees to import: ${data.entries.length}`);
console.log(`Skipped (unmapped) excel rows: ${data.skippedNames.length}`);

const emails = data.entries.map((e) => e.email);
const { data: employees, error: empErr } = await supabase
  .from('employees')
  .select('id, name, email')
  .in('email', emails);

if (empErr) {
  console.error('Failed to load employees:', empErr.message);
  process.exit(1);
}

const byEmail = new Map((employees ?? []).map((e) => [e.email.toLowerCase(), e]));
const missing = emails.filter((e) => !byEmail.has(e));
if (missing.length) {
  console.warn('Not in Supabase (skipped):', missing.join(', '));
}

const importEntries = data.entries.filter((e) => byEmail.has(e.email.toLowerCase()));
if (!importEntries.length) {
  console.error('No matched employees found in Supabase.');
  process.exit(1);
}

let punchIns = 0;
let punchOuts = 0;
let leaves = 0;
let skippedExisting = 0;

for (const entry of importEntries) {
  const employee = byEmail.get(entry.email.toLowerCase());
  const dateKeys = entry.days.map((d) => d.dateKey);

  const { data: existingPunches } = await supabase
    .from('attendance_records')
    .select('id, punched_at, punch_type')
    .eq('employee_id', employee.id)
    .gte('punched_at', `${dateKeys[0]}T00:00:00+05:30`)
    .lte('punched_at', `${dateKeys.at(-1)}T23:59:59+05:30`);

  const punchedDays = new Set(
    (existingPunches ?? []).map((r) => r.punched_at.slice(0, 10)),
  );

  const { data: existingLeave } = await supabase
    .from('leave_requests')
    .select('id, from_date, to_date, status')
    .eq('employee_id', employee.id)
    .neq('status', 'cancelled')
    .lte('from_date', dateKeys.at(-1))
    .gte('to_date', dateKeys[0]);

  const leaveDays = new Set();
  for (const lr of existingLeave ?? []) {
    let d = lr.from_date;
    while (d <= lr.to_date) {
      leaveDays.add(d);
      const next = new Date(`${d}T12:00:00+05:30`);
      next.setDate(next.getDate() + 1);
      d = next.toISOString().slice(0, 10);
    }
  }

  for (const day of entry.days) {
    if (day.status === 'P') {
      if (punchedDays.has(day.dateKey)) {
        skippedExisting++;
        continue;
      }
      const base = {
        employee_id: employee.id,
        employee_name: employee.name,
        latitude: OFFICE.latitude,
        longitude: OFFICE.longitude,
        accuracy_m: 0,
        distance_m: 0,
        within_office: true,
        office_address: OFFICE.address,
      };
      const rows = [
        { ...base, id: randomUUID(), punch_type: 'in', punched_at: istIso(day.dateKey, 9, 0) },
        { ...base, id: randomUUID(), punch_type: 'out', punched_at: istIso(day.dateKey, 18, 0) },
      ];
      if (dryRun) {
        punchIns++;
        punchOuts++;
        continue;
      }
      const { error } = await supabase.from('attendance_records').insert(rows);
      if (error) {
        console.error(`Punch import failed for ${entry.excelName} ${day.dateKey}:`, error.message);
        process.exit(1);
      }
      punchIns++;
      punchOuts++;
      punchedDays.add(day.dateKey);
    }

    if (day.status === 'L') {
      if (!leaveTableAvailable) continue;
      if (leaveDays.has(day.dateKey) || punchedDays.has(day.dateKey)) {
        skippedExisting++;
        continue;
      }
      const row = {
        id: randomUUID(),
        employee_id: employee.id,
        employee_name: employee.name,
        leave_type: 'Casual',
        from_date: day.dateKey,
        to_date: day.dateKey,
        reason: 'Imported from June 2026 attendance sheet',
        status: 'approved',
        reviewed_by: 'System Import',
        reviewed_by_id: null,
        reviewed_at: new Date().toISOString(),
        admin_notes: 'Historical backfill from EMP ATTENDANCE JUNE-2026.xlsx',
      };
      if (dryRun) {
        leaves++;
        continue;
      }
      const { error } = await supabase.from('leave_requests').insert(row);
      if (error) {
        console.error(`Leave import failed for ${entry.excelName} ${day.dateKey}:`, error.message);
        process.exit(1);
      }
      leaves++;
      leaveDays.add(day.dateKey);
    }
  }

  console.log(`  ✓ ${entry.excelName} → ${employee.name} (${entry.days.length} P/L days)`);
}

console.log('\nDone.');
console.log(`  Punch in records:  ${punchIns}`);
console.log(`  Punch out records: ${punchOuts}`);
console.log(`  Leave days:        ${leaves}`);
console.log(`  Skipped existing:  ${skippedExisting}`);
if (dryRun) console.log('(dry run — nothing written)');
