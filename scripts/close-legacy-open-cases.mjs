#!/usr/bin/env node
/**
 * Bulk-close all open implant cases (legacy backlog after DB migration).
 *
 * Usage:
 *   node scripts/close-legacy-open-cases.mjs [--dry-run]
 *   node scripts/close-legacy-open-cases.mjs --before=2026-09-22 [--dry-run]
 *
 * Requires VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const beforeArg = process.argv.find((a) => a.startsWith('--before='));
const surgeryBefore = beforeArg ? beforeArg.slice('--before='.length) : null;

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const envPath = resolve(root, name);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0 && !process.env[t.slice(0, i).trim()]) {
        process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
      }
    }
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env / .env.local');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const CLOSE_NOTE =
  'Bulk closed — legacy open cases cleared after Supabase migration (admin script).';

const SKIP_NOTES = {
  Billing: 'Skipped — Billing disabled.',
  'Bill Submission': 'Skipped — Bill Submission disabled.',
  Collection: 'Skipped — Bill Submission disabled.',
};

function normalizeStage(stage) {
  if (stage === 'Collection') return 'Bill Submission';
  if (stage === 'Kit Preparation') return 'Set Preparation';
  return stage;
}

function closeStages(stages) {
  const now = new Date().toISOString();
  return (stages ?? []).map((s) => {
    const name = normalizeStage(s.stage);
    const skipNote = SKIP_NOTES[name];
    if (skipNote && s.status !== 'Approved') {
      return {
        ...s,
        stage: name,
        status: 'Approved',
        approvedAt: s.approvedAt ?? now,
        adminNotes: s.adminNotes || skipNote,
      };
    }
    if (s.status !== 'Approved') {
      return {
        ...s,
        stage: name,
        status: 'Approved',
        approvedAt: s.approvedAt ?? now,
        adminNotes: s.adminNotes || (name === 'Completed' ? CLOSE_NOTE : s.adminNotes || CLOSE_NOTE),
      };
    }
    return { ...s, stage: name };
  });
}

async function adjustEmployeeStats(employeeId, deltaActive, deltaCompleted) {
  if (!employeeId) return;
  const { data: emp, error } = await sb
    .from('employees')
    .select('cases_active,cases_completed')
    .eq('id', employeeId)
    .single();
  if (error || !emp) return;
  await sb
    .from('employees')
    .update({
      cases_active: Math.max(0, (emp.cases_active ?? 0) + deltaActive),
      cases_completed: Math.max(0, (emp.cases_completed ?? 0) + deltaCompleted),
    })
    .eq('id', employeeId);
}

let query = sb
  .from('cases')
  .select('id, case_number, status, current_stage, surgery_date, assigned_employee_id, stages, activity_logs')
  .neq('status', 'Completed')
  .neq('status', 'Cancelled');

if (surgeryBefore) {
  query = query.lt('surgery_date', surgeryBefore);
}

const { data: cases, error } = await query;

if (error) {
  console.error('Query failed:', error.message);
  process.exit(1);
}

if (!cases?.length) {
  console.log(
    surgeryBefore
      ? `No open cases with surgery_date before ${surgeryBefore}.`
      : 'No open cases to close.',
  );
  process.exit(0);
}

console.log(
  `${dryRun ? '[DRY RUN] Would close' : 'Closing'} ${cases.length} case(s)${
    surgeryBefore ? ` (surgery before ${surgeryBefore})` : ''
  }:\n`,
);
for (const c of cases) {
  console.log(`  ${c.case_number}  status=${c.status}  stage=${c.current_stage}  surgery=${c.surgery_date ?? '—'}`);
}

if (dryRun) process.exit(0);

const now = new Date().toISOString();
let closed = 0;

for (const c of cases) {
  const log = {
    id: `log-${Date.now()}-${c.id.slice(0, 8)}`,
    caseId: c.id,
    action: 'Case Closed',
    performedBy: 'Admin (bulk script)',
    performedByRole: 'admin',
    timestamp: now,
    details: CLOSE_NOTE,
  };

  const { error: updateError } = await sb
    .from('cases')
    .update({
      status: 'Completed',
      current_stage: 'Completed',
      current_department: null,
      assigned_employee_id: null,
      assigned_employee_snapshot: null,
      stages: closeStages(c.stages),
      activity_logs: [...(c.activity_logs ?? []), log],
      updated_at: now,
    })
    .eq('id', c.id);

  if (updateError) {
    console.error(`Failed ${c.case_number}:`, updateError.message);
    continue;
  }

  await adjustEmployeeStats(c.assigned_employee_id, -1, 1);
  closed += 1;
}

console.log(`\nDone — closed ${closed}/${cases.length} case(s).`);
