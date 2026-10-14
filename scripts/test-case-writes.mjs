#!/usr/bin/env node
/** Phase 10.3 — high-risk case write tests (local D1). */
const BASE = process.env.WORKER_BASE_URL || 'http://127.0.0.1:8787';
const ADMIN_ID = 'a1000003-0001-4001-8001-000000000003';
const EMP_A = 'a1000001-0001-4001-8001-000000000001';
const EMP_B = 'a1000002-0001-4001-8001-000000000002';
const HOSP_ID = 'b2000001-0001-4001-8001-000000000001';

const failures = [];

function devIdentity(role, employeeId) {
  return Buffer.from(JSON.stringify({ authUserId: `dev-${role}`, role, employeeId })).toString('base64');
}

function uuid() {
  const tail = `${Date.now().toString(16)}`.padStart(12, '0').slice(-12);
  return `d9100001-0001-4001-8001-${tail}`;
}

async function req(method, path, { body, role, employeeId } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (role) headers['X-Malcon-Dev-Identity'] = devIdentity(role, employeeId);
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { res, body: parsed };
}

function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

function fcfsCasePayload(id, caseNumber) {
  return {
    id,
    case_number: caseNumber,
    hospital_id: HOSP_ID,
    doctor_id: null,
    hospital_snapshot: { id: HOSP_ID, name: 'Dev Hospital Alpha' },
    doctor_snapshot: {},
    surgery_date: '2026-05-01',
    implant_required: '',
    implant_type: '',
    implant_company: '',
    priority: 'Medium',
    status: 'Active',
    current_stage: 'Set Preparation',
    current_department: 'Stores',
    assigned_employee_id: null,
    assigned_employee_snapshot: null,
    created_by: 'Dev Admin C',
    remarks: '',
    stages: [
      {
        stage: 'Set Preparation',
        status: 'Pending',
        assignedEmployee: null,
      },
    ],
    activity_logs: [],
    comments: [],
    post_surgery_duties: {},
  };
}

async function main() {
  console.log(`=== Phase 10.3 case write tests (${BASE}) ===\n`);

  const caseId = uuid();
  const caseNum = `IMP-TEST-${Date.now().toString().slice(-6)}`;
  const create = await req('POST', '/api/cases', {
    role: 'admin',
    employeeId: ADMIN_ID,
    body: fcfsCasePayload(caseId, caseNum),
  });
  assert(create.res.status === 201, 'case create 201');

  const patch = await req('PUT', `/api/cases/${caseId}`, {
    role: 'admin',
    employeeId: ADMIN_ID,
    body: { ...fcfsCasePayload(caseId, caseNum), remarks: 'updated' },
  });
  assert(patch.res.status === 200, 'case save-session update');

  const sync = await req('POST', `/api/cases/${caseId}/sync-header`, {
    role: 'employee',
    employeeId: EMP_A,
  });
  assert(sync.res.status === 200 || sync.res.status === 403, 'sync-header auth path');

  const claimA = req('POST', `/api/cases/${caseId}/claim`, {
    role: 'employee',
    employeeId: EMP_A,
    body: { employee: { id: EMP_A, name: 'Dev Store A', department: 'Stores' } },
  });
  const claimB = req('POST', `/api/cases/${caseId}/claim`, {
    role: 'employee',
    employeeId: EMP_B,
    body: { employee: { id: EMP_B, name: 'Dev Driver B', department: 'Delivery' } },
  });
  const [a, b] = await Promise.all([claimA, claimB]);
  const statuses = [a.res.status, b.res.status].sort();
  assert(statuses.includes(200) && statuses.includes(409), 'atomic claim: one success one conflict');

  const delFail = await req('DELETE', `/api/cases/${caseId}`, {
    role: 'employee',
    employeeId: EMP_A,
  });
  assert(delFail.res.status === 403, 'delete forbidden for employee');

  const del = await req('DELETE', `/api/cases/${caseId}`, {
    role: 'admin',
    employeeId: ADMIN_ID,
  });
  assert(del.res.status === 200, 'case delete admin');

  console.log(failures.length ? failures.map((f) => `  ✗ ${f}`).join('\n') : '  All case write checks passed.');
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
