#!/usr/bin/env node
/**
 * Close cases where Restock is approved but status is still Approved (not Completed).
 * Run: node scripts/repair-stuck-case-closes.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  for (const f of ['.env', '.env.local']) {
    const p = resolve(root, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

function restockApproved(stages) {
  return (stages ?? []).some((s) => s.stage === 'Restock' && s.status === 'Approved');
}

const { data: rows, error } = await sb
  .from('cases')
  .select('id,case_number,status,current_stage,activity_logs,stages')
  .in('status', ['Approved', 'Active', 'Waiting For Approval'])
  .eq('current_stage', 'Completed');

if (error) {
  console.error(error);
  process.exit(1);
}

let fixed = 0;
for (const row of rows ?? []) {
  if (!restockApproved(row.stages)) continue;
  if (row.status === 'Completed') continue;

  const log = {
    id: `log-${Date.now()}-${fixed}`,
    caseId: row.id,
    action: 'Case Closed',
    performedBy: 'System repair',
    performedByRole: 'admin',
    timestamp: new Date().toISOString(),
    details: 'Restock was already approved; closed stuck case (header/RPC mismatch).',
  };

  const { error: upErr } = await sb
    .from('cases')
    .update({
      status: 'Completed',
      current_stage: 'Completed',
      current_department: null,
      assigned_employee_id: null,
      assigned_employee_snapshot: null,
      activity_logs: [...(row.activity_logs ?? []), log],
    })
    .eq('id', row.id);

  if (upErr) {
    console.error(row.case_number, upErr.message);
  } else {
    console.log('Closed', row.case_number);
    fixed += 1;
  }
}

console.log(`Done. Closed ${fixed} case(s).`);
