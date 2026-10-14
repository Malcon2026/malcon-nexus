#!/usr/bin/env node
/**
 * Phase 10.1 — local Worker low-risk write tests (wrangler dev on BASE_URL).
 */
const BASE = process.env.WORKER_BASE_URL || 'http://127.0.0.1:8787';

const ADMIN_ID = 'a1000003-0001-4001-8001-000000000003';
const EMP1 = 'a1000001-0001-4001-8001-000000000001';
const KIT_ID = 'k4000001-0001-4001-8001-000000000001';
const CASE_ID = 'e5000001-0001-4001-8001-000000000001';

const failures = [];

function devIdentity(role, employeeId) {
  return Buffer.from(
    JSON.stringify({ authUserId: `dev-${role}`, role, employeeId }),
  ).toString('base64');
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

function uuid(n) {
  const tail = `${Date.now().toString(16)}${String(n).padStart(4, '0')}`.slice(-12).padStart(12, '0');
  return `b8100001-0001-4001-8001-${tail}`;
}

async function main() {
  console.log(`=== Phase 10.1 low-risk write tests (${BASE}) ===\n`);

  const health = await req('GET', '/health');
  assert(health.res.status === 200, 'worker health');

  const actId = uuid(101);
  const act = await req('POST', '/api/activity-log', {
    role: 'employee',
    employeeId: EMP1,
    body: {
      id: actId,
      action: 'test_write',
      entityType: 'case',
      entityId: CASE_ID,
      entityLabel: 'Test',
      performedBy: 'Dev Store A',
      performedByRole: 'employee',
      details: 'phase10.1',
    },
  });
  assert(act.res.status === 201, 'activity insert 201');

  const notifId = uuid(102);
  const notif = await req('POST', '/api/notifications', {
    role: 'admin',
    employeeId: ADMIN_ID,
    body: {
      id: notifId,
      title: 'Write test',
      message: 'hello',
      type: 'info',
      read: false,
      recipientId: EMP1,
      caseId: CASE_ID,
    },
  });
  assert(notif.res.status === 201, 'notification create 201');

  const mark = await req('PATCH', `/api/notifications/${notifId}/read`, {
    role: 'employee',
    employeeId: EMP1,
  });
  assert(mark.res.status === 200, 'notification mark read');

  const markAll = await req('POST', '/api/notifications/mark-all-read', {
    role: 'employee',
    employeeId: EMP1,
    body: { recipientId: EMP1 },
  });
  assert(markAll.res.status === 200, 'notification mark all read');

  const settings = await req('PATCH', '/api/settings/phase10_test_key', {
    role: 'admin',
    employeeId: ADMIN_ID,
    body: { value: 'ok', updatedBy: 'Dev Admin C' },
  });
  assert(settings.res.status === 200, 'settings patch');

  const kit = await req('PATCH', `/api/surgical-kits/${KIT_ID}`, {
    role: 'admin',
    employeeId: ADMIN_ID,
    body: { status: 'In Use', lastUsedDate: '2026-04-01' },
  });
  assert(kit.res.status === 200, 'kit patch');

  const expenseId = uuid(103);
  const expense = await req('PUT', `/api/daily-expenses/${expenseId}`, {
    role: 'admin',
    employeeId: ADMIN_ID,
    body: {
      id: expenseId,
      employeeId: EMP1,
      employeeName: 'Dev Store A',
      expenseDate: '2026-04-02',
      kmsDriven: 10,
      petrolAmount: 100,
      foodAmount: 50,
      otherAmount: 0,
      otherDescription: '',
      notes: 'test',
      enteredBy: 'Dev Admin C',
      enteredById: ADMIN_ID,
    },
  });
  assert(expense.res.status === 200, 'expense upsert');

  const approvalId = uuid(104);
  const approval = await req('PUT', `/api/approvals/${approvalId}`, {
    role: 'admin',
    employeeId: ADMIN_ID,
    body: {
      id: approvalId,
      caseId: CASE_ID,
      caseNumber: 'IMP-DEV-001',
      stage: 'Set Preparation',
      submittedBy: 'Dev Store A',
      submittedAt: new Date().toISOString(),
      status: 'Pending',
      notes: null,
      adminNotes: null,
    },
  });
  assert(approval.res.status === 200, 'approval upsert');

  const bad = await req('PATCH', '/api/settings/phase10_forbidden', {
    role: 'employee',
    employeeId: EMP1,
    body: { value: 'nope', updatedBy: 'Dev Store A' },
  });
  assert(bad.res.status === 403, 'settings forbidden for employee');

  const del = await req('DELETE', `/api/daily-expenses/${expenseId}`, {
    role: 'admin',
    employeeId: ADMIN_ID,
  });
  assert(del.res.status === 200, 'expense delete');

  const dupAct = await req('POST', '/api/activity-log', {
    body: {
      id: actId,
      action: 'dup',
      entityType: 'case',
      entityId: CASE_ID,
      performedBy: 'x',
      performedByRole: 'employee',
    },
  });
  assert(dupAct.res.status >= 400, 'duplicate activity id rejected');

  console.log(failures.length ? failures.map((f) => `  ✗ ${f}`).join('\n') : '  All low-risk write checks passed.');
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
