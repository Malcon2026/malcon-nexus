#!/usr/bin/env node
/**
 * Phase 7 — local Worker API tests (wrangler dev must be running on BASE_URL).
 */
const BASE = process.env.WORKER_BASE_URL || 'http://127.0.0.1:8787';

const failures = [];

async function get(path, init) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { res, body };
}

function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

async function main() {
  console.log(`=== Worker API tests (${BASE}) ===\n`);

  const health = await get('/health');
  assert(health.res.status === 200, 'health status');
  assert(health.body.ok === true && health.body.service === 'malcon-nexus-worker', 'health body');

  const hdb = await get('/health/db');
  assert(hdb.res.status === 200, 'health/db status');
  assert(hdb.body.ok === true && hdb.body.database === true, 'health/db body');
  assert(typeof hdb.body.employees === 'number', 'health/db employees count');

  const emps = await get('/api/employees');
  assert(emps.res.status === 200, 'employees list status');
  assert(Array.isArray(emps.body.data), 'employees list data array');
  assert(emps.body.data.length > 0, 'employees list non-empty');
  assert(!('auth_user_id' in (emps.body.data[0] || {})), 'employees list no auth_user_id');

  const empId = emps.body.data[0].id;
  const emp = await get(`/api/employees/${empId}`);
  assert(emp.res.status === 200, 'employee detail status');
  assert(emp.body.data?.id === empId, 'employee detail id');

  const att = await get(`/api/employees/${empId}/attendance?page=1&pageSize=10`);
  assert(att.res.status === 200, 'attendance status');
  assert(Array.isArray(att.body.data?.items), 'attendance items');
  assert(att.body.data?.pagination?.page === 1, 'attendance pagination');

  const attSince = await get(
    `/api/employees/${empId}/attendance?page=1&pageSize=10&since=2020-01-01T00:00:00.000Z`,
  );
  assert(attSince.res.status === 200, 'attendance since filter');

  const attGlobal = await get('/api/attendance-records?page=1&pageSize=10');
  assert(attGlobal.res.status === 200, 'attendance-records list');
  assert(Array.isArray(attGlobal.body.data?.items), 'attendance-records items');

  const badEmp = await get('/api/employees/not-a-uuid');
  assert(badEmp.res.status === 400, 'bad employee id 400');

  const missingEmp = await get('/api/employees/00000000-0000-4000-8000-000000000099');
  assert(missingEmp.res.status === 404, 'missing employee 404');

  const cases = await get('/api/cases?page=1&pageSize=5');
  assert(cases.res.status === 200, 'cases list status');
  assert(Array.isArray(cases.body.data?.items), 'cases items');
  assert(cases.body.data.items[0] && !('stages' in cases.body.data.items[0]), 'cases list no stages blob');

  const caseId = cases.body.data.items[0]?.id;
  if (caseId) {
    const cDetail = await get(`/api/cases/${caseId}`);
    assert(cDetail.res.status === 200, 'case detail status');
    assert(Array.isArray(cDetail.body.data?.stages), 'case detail stages array');
  }

  const notifs = await get('/api/notifications?page=1&pageSize=5');
  assert(notifs.res.status === 200, 'notifications list status');
  assert(Array.isArray(notifs.body.data?.items), 'notifications items array');
  assert(notifs.body.data?.pagination?.total >= 0, 'notifications total');
  if (notifs.body.data.items[0]) {
    assert(!('payload' in notifs.body.data.items[0]), 'notifications no extra blob fields');
  }

  const notifSummary = await get('/api/notifications/summary');
  assert(notifSummary.res.status === 200, 'notifications summary status');
  assert(typeof notifSummary.body.data?.unread === 'number', 'notifications unread count');

  const empIdForNotif = emps.body.data[0]?.id;
  if (empIdForNotif) {
    const scoped = await get(`/api/notifications?recipientId=${empIdForNotif}&page=1&pageSize=10`);
    assert(scoped.res.status === 200, 'notifications recipient filter');
    assert(
      scoped.body.data.items.every((n) => n.recipient_id === empIdForNotif),
      'recipient scope',
    );
  }

  const badNotifPage = await get('/api/notifications?page=0');
  assert(badNotifPage.res.status === 400, 'notifications invalid page 400');

  const hospitals = await get('/api/hospitals?page=1&pageSize=10');
  assert(hospitals.res.status === 200, 'hospitals list');
  assert(Array.isArray(hospitals.body.data?.items), 'hospitals items');

  const doctors = await get('/api/doctors?page=1&pageSize=10');
  assert(doctors.res.status === 200, 'doctors list');
  assert(Array.isArray(doctors.body.data?.items), 'doctors items');

  const depts = await get('/api/departments');
  assert(depts.res.status === 200, 'departments list');
  assert(Array.isArray(depts.body.data), 'departments array');

  const kits = await get('/api/surgical-kits');
  assert(kits.res.status === 200, 'kits list');
  assert(Array.isArray(kits.body.data), 'kits array');

  const settings = await get('/api/settings');
  assert(settings.res.status === 200, 'settings map');
  assert(typeof settings.body.data === 'object', 'settings object');

  const attAppr = await get('/api/attendance-approval-requests?page=1&pageSize=10');
  assert(attAppr.res.status === 200, 'attendance approvals');
  assert(Array.isArray(attAppr.body.data?.items), 'attendance approvals items');

  const fieldTeam = await get('/api/field-team-attendance?page=1&pageSize=10');
  assert(fieldTeam.res.status === 200, 'field team attendance');
  assert(Array.isArray(fieldTeam.body.data?.items), 'field team items');

  const fieldDate = await get('/api/field-team-attendance?dateKey=2026-04-15');
  assert(fieldDate.res.status === 200, 'field team date filter');

  const leave = await get('/api/leave-requests?page=1&pageSize=10');
  assert(leave.res.status === 200, 'leave requests');
  assert(Array.isArray(leave.body.data?.items), 'leave items');

  const petrol = await get('/api/petrol-requests?page=1&pageSize=10');
  assert(petrol.res.status === 200, 'petrol requests');
  assert(petrol.body.data?.items?.[0]?.amount != null, 'petrol amount mapped');

  const trips = await get('/api/location-trips?page=1&pageSize=10');
  assert(trips.res.status === 200, 'location trips');

  const food = await get('/api/food-selections?page=1&pageSize=10&fromDate=2026-04-01&toDate=2026-04-30');
  assert(food.res.status === 200, 'food selections date range');

  const expenses = await get('/api/daily-expenses?page=1&pageSize=10');
  assert(expenses.res.status === 200, 'daily expenses');

  const appr = await get('/api/approvals?page=1&pageSize=10');
  assert(appr.res.status === 200, 'approvals list');
  assert(Array.isArray(appr.body.data?.items), 'approvals items');

  const tasks = await get('/api/case-task-requests?page=1&pageSize=10');
  assert(tasks.res.status === 200, 'case task requests');
  assert(Array.isArray(tasks.body.data?.items), 'case task items');

  const activity = await get('/api/activity-log?page=1&pageSize=10');
  assert(activity.res.status === 200, 'activity log');
  assert(Array.isArray(activity.body.data?.items), 'activity items');

  const empCases = await get(`/api/cases/for-employee/${empId}`);
  assert(empCases.res.status === 200, 'employee case ids');
  assert(Array.isArray(empCases.body.data?.ids), 'employee case id list');

  const fcfs = await get('/api/cases/fcfs-pool?stages=Set Preparation,Delivery');
  assert(fcfs.res.status === 200, 'fcfs pool');
  assert(Array.isArray(fcfs.body.data?.items), 'fcfs items');

  const badPage = await get('/api/cases?page=0');
  assert(badPage.res.status === 400, 'invalid pagination 400');

  const hugePage = await get('/api/cases?pageSize=500');
  assert(hugePage.res.status === 400, 'pageSize cap 400');

  const authRequired = await get('/api/employees', {
    headers: { 'X-Test-Require-Auth': '1' },
  });
  // Optional: only when wrangler started with API_REQUIRE_AUTH=1
  if (process.env.API_REQUIRE_AUTH === '1') {
    assert(authRequired.res.status === 401, 'auth required 401');
  }

  console.log(failures.length ? failures.map((f) => `  ✗ ${f}`).join('\n') : '  All API checks passed.');
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
