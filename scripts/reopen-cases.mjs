#!/usr/bin/env node
/**
 * Reopen cases mistakenly bulk-closed.
 * Usage: node scripts/reopen-cases.mjs IMP-2026-279 IMP-2026-280 ...
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const caseNumbers = process.argv.slice(2);
const BULK_NOTE = 'Bulk closed — legacy open cases cleared after Supabase migration (admin script).';

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

if (!caseNumbers.length) {
  console.error('Pass case numbers, e.g. node scripts/reopen-cases.mjs IMP-2026-279');
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

function stripBulkApproval(stage) {
  const notes = stage.adminNotes ?? '';
  const bulkClosed = notes.includes(BULK_NOTE);
  const billingSkip =
    stage.stage === 'Billing' && notes === 'Skipped — Billing disabled.';
  const billSubSkip =
    (stage.stage === 'Bill Submission' || stage.stage === 'Collection') &&
    notes === 'Skipped — Bill Submission disabled.';

  if (stage.stage === 'Completed') {
    return {
      ...stage,
      status: 'Pending',
      approvedAt: null,
      adminNotes: '',
    };
  }

  if (bulkClosed || (billingSkip && stage.status === 'Approved') || (billSubSkip && stage.status === 'Approved')) {
    const hasAssignee = Boolean(stage.assignedEmployee?.id);
    const skippedPrep = notes.startsWith('Skipped — case started at');
    if (skippedPrep && stage.status === 'Approved') {
      return stage;
    }
    return {
      ...stage,
      status: hasAssignee ? 'Assigned' : 'Pending',
      approvedAt: null,
      adminNotes: bulkClosed ? '' : stage.adminNotes,
    };
  }
  return stage;
}

/** Known pre-bulk state from 2026-09-22 dry-run + create logs. */
const TARGET = {
  'IMP-2026-279': {
    status: 'Draft',
    current_stage: 'Set Preparation',
    current_department: 'Stores',
    assignee: null,
  },
  'IMP-2026-280': {
    status: 'Active',
    current_stage: 'Delivery',
    current_department: 'Delivery',
    assigneeStage: 'Delivery',
  },
  'IMP-2026-281': {
    status: 'Active',
    current_stage: 'Delivery',
    current_department: 'Delivery',
    assigneeStage: 'Delivery',
  },
};

const { data: cases, error } = await sb
  .from('cases')
  .select('*')
  .in('case_number', caseNumbers);

if (error) {
  console.error(error.message);
  process.exit(1);
}

for (const c of cases ?? []) {
  const plan = TARGET[c.case_number];
  if (!plan) {
    console.warn(`No restore plan for ${c.case_number}, skipping`);
    continue;
  }

  let stages = (c.stages ?? []).map(stripBulkApproval);

  const assignStage = plan.assigneeStage
    ? stages.find((s) => s.stage === plan.assigneeStage)
    : null;
  const assignee = assignStage?.assignedEmployee ?? null;

  const reopenLog = {
    id: `log-reopen-${Date.now()}-${c.id.slice(0, 8)}`,
    caseId: c.id,
    action: 'Case Reopened',
    performedBy: 'Admin (restore script)',
    performedByRole: 'admin',
    timestamp: new Date().toISOString(),
    details: `Restored after mistaken bulk close. Back to ${plan.current_stage} (${plan.status}).`,
  };

  const activity_logs = (c.activity_logs ?? []).filter(
    (l) => !(l.action === 'Case Closed' && String(l.details ?? '').includes('Bulk closed')),
  );
  activity_logs.push(reopenLog);

  const patch = {
    status: plan.status,
    current_stage: plan.current_stage,
    current_department: plan.current_department,
    assigned_employee_id: assignee?.id ?? null,
    assigned_employee_snapshot: assignee ?? null,
    stages,
    activity_logs,
    updated_at: new Date().toISOString(),
  };

  const { error: upErr } = await sb.from('cases').update(patch).eq('id', c.id);
  if (upErr) {
    console.error(`${c.case_number}: ${upErr.message}`);
    continue;
  }
  console.log(`Reopened ${c.case_number} → ${plan.status} @ ${plan.current_stage}`);
}
