#!/usr/bin/env node
/**
 * Authorization regression tests (local wrangler dev or WORKER_BASE_URL).
 * Requires seeded local D1 + API_REQUIRE_AUTH=1 + JWT_SECRET matching test signer.
 */
import crypto from 'node:crypto';

const BASE = process.env.WORKER_BASE_URL || 'http://127.0.0.1:8787';
const SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'local-dev-only-secret';

const EMP_A_AUTH = 'auth-subject-001';
const EMP_A_ID = 'a1000001-0001-4001-8001-000000000001';
const EMP_B_AUTH = 'auth-subject-002';
const EMP_B_ID = 'a1000002-0001-4001-8001-000000000002';
const ADMIN_AUTH = 'auth-subject-003';

const failures = [];

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function signJwt(sub, email, expOffsetSec = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const data = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
    sub,
    email,
    aud: 'authenticated',
    role: 'authenticated',
    iat: now,
    exp: now + expOffsetSec,
  })}`;
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function devIdentity(role, employeeId) {
  return Buffer.from(JSON.stringify({ authUserId: `dev-${role}`, role, employeeId }), 'utf8').toString('base64');
}

async function req(path, { method = 'GET', token, devRole, devEmployeeId, headers = {}, body } = {}) {
  const h = { Accept: 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (devRole) h['X-Malcon-Dev-Identity'] = devIdentity(devRole, devEmployeeId);
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

async function main() {
  console.log('Security authz tests →', BASE);

  const empA = signJwt(EMP_A_AUTH, 'store.a@example.invalid');
  const empB = signJwt(EMP_B_AUTH, 'store.b@example.invalid');
  const admin = signJwt(ADMIN_AUTH, 'admin.c@example.invalid');

  const crossLeave = await req(`/api/leave-requests?employeeId=${EMP_B_ID}`, { token: empA });
  assert(crossLeave.status === 403, `employee A → B leave: expected 403 got ${crossLeave.status}`);

  const crossPetrol = await req(`/api/petrol-requests?employeeId=${EMP_B_ID}`, { token: empA });
  assert(crossPetrol.status === 403, `employee A → B petrol: expected 403 got ${crossPetrol.status}`);

  const crossTrips = await req(`/api/location-trips?employeeId=${EMP_B_ID}`, { token: empA });
  assert(crossTrips.status === 403, `employee A → B trips: expected 403 got ${crossTrips.status}`);

  const crossFood = await req(`/api/food-selections?employeeId=${EMP_B_ID}`, { token: empA });
  assert(crossFood.status === 403, `employee A → B food: expected 403 got ${crossFood.status}`);

  const empExpenses = await req('/api/daily-expenses', { token: empA });
  assert(empExpenses.status === 403, `employee daily expenses: expected 403 got ${empExpenses.status}`);

  const empField = await req('/api/field-team-attendance', { token: empA });
  assert(empField.status === 403, `employee field team: expected 403 got ${empField.status}`);

  const crossTasks = await req(`/api/case-task-requests?employeeId=${EMP_B_ID}`, { token: empA });
  assert(crossTasks.status === 403, `employee A → B case tasks: expected 403 got ${crossTasks.status}`);

  const ackOther = await req('/api/case-alerts/acknowledge', {
    method: 'POST',
    token: empA,
    body: { caseId: 'e5000001-0001-4001-8001-000000000001', employeeId: EMP_B_ID },
  });
  assert(ackOther.status === 403, `ack other employee alert: expected 403 got ${ackOther.status}`);

  const webhookNoSecret = await req('/api/telegram/webhook', {
    method: 'POST',
    body: { update_id: 1 },
  });
  if (process.env.ENFORCE_PROD_WEBHOOK === '1') {
    assert(webhookNoSecret.status === 401, `telegram webhook without secret: expected 401 got ${webhookNoSecret.status}`);
  } else {
    console.log('  (skip strict webhook test — set ENFORCE_PROD_WEBHOOK=1 with ENVIRONMENT=production on Worker)');
  }

  const devInProd = await req('/api/notifications/summary', {
    headers: { 'X-Malcon-Dev-Identity': devIdentity('admin', EMP_A_ID), 'X-Test-Env': 'production' },
  });
  console.log(`  dev identity header probe: ${devInProd.status} (401 expected when Worker ENVIRONMENT!=development)`);

  const adminEmployees = await req('/api/employees', { token: admin });
  if (adminEmployees.status === 200) console.log('  admin employee list OK');

  const empEmployees = await req('/api/employees', { token: empA });
  if (empEmployees.status === 200 && Array.isArray(empEmployees.json?.data)) {
    const sample = empEmployees.json.data[0];
    if (sample && sample.email && sample.email !== '') {
      assert(false, 'employee roster should not include email addresses');
    }
  }

  if (failures.length) {
    console.error('\nFAILURES:');
    for (const f of failures) console.error(' -', f);
    process.exit(1);
  }
  console.log('\nSecurity authz checks passed (within local configuration limits).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
