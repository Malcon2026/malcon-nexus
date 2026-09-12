#!/usr/bin/env node
/**
 * Close all open cases stuck at Billing or Bill Submission (bulk admin action).
 * Usage: node scripts/close-billing-cases.mjs [--dry-run]
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

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

const SKIP_NOTES = {
  Billing: 'Skipped — Billing disabled.',
  'Bill Submission': 'Skipped — Bill Submission disabled.',
};
const CLOSE_NOTE = 'Bulk closed — Billing stage disabled; case ends at Restock.';

function normalizeStage(stage) {
  if (stage === 'Collection') return 'Bill Submission';
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
    if (name === 'Completed' && s.status !== 'Approved') {
      return { ...s, status: 'Approved', approvedAt: s.approvedAt ?? now };
    }
    return s;
  });
}

async function adjustEmployeeStats(employeeId, deltaActive, deltaCompleted) {
  if (!employeeId) return;
  const { data: emp, error } = await sb.from('employees').select('cases_active,cases_completed').eq('id', employeeId).single();
  if (error || !emp) return;
  await sb.from('employees').update({
    cases_active: Math.max(0, (emp.cases_active ?? 0) + deltaActive),
    cases_completed: Math.max(0, (emp.cases_completed ?? 0) + deltaCompleted),
  }).eq('id', employeeId);
}

const { data: cases, error } = await sb
  .from('cases')
  .select('id, case_number, status, current_stage, assigned_employee_id, stages, activity_logs')
  .in('current_stage', ['Billing', 'Bill Submission', 'Collection'])
  .neq('status', 'Completed')
  .neq('status', 'Cancelled');

if (error) {
  console.error('Query failed:', error.message);
  process.exit(1);
}

if (!cases?.length) {
  console.log('No open cases at Billing / Bill Submission.');
  process.exit(0);
}

console.log(`${dryRun ? '[DRY RUN] Would close' : 'Closing'} ${cases.length} case(s):\n`);
for (const c of cases) {
  console.log(`  ${c.case_number} (${c.status}, ${c.current_stage})`);
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

  const { error: updateError } = await sb.from('cases').update({
    status: 'Completed',
    current_stage: 'Completed',
    current_department: null,
    assigned_employee_id: null,
    assigned_employee_snapshot: null,
    stages: closeStages(c.stages),
    activity_logs: [...(c.activity_logs ?? []), log],
  }).eq('id', c.id);

  if (updateError) {
    console.error(`Failed ${c.case_number}:`, updateError.message);
    continue;
  }

  await adjustEmployeeStats(c.assigned_employee_id, -1, 1);
  closed += 1;
}

console.log(`\nDone — closed ${closed}/${cases.length} case(s).`);
