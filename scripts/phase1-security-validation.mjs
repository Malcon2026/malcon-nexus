#!/usr/bin/env node
/**
 * Phase 1 security validation — extended attack + legitimate access probes.
 * Requires wrangler dev on WORKER_BASE_URL (default 8787) with .dev.vars auth.
 */
import crypto from 'node:crypto';

const BASE = process.env.WORKER_BASE_URL || 'http://127.0.0.1:8787';
const SECRET = process.env.JWT_SECRET || 'local-dev-only-secret';
const failures = [];

const EMP_A = 'auth-subject-001';
const EMP_A_ID = 'a1000001-0001-4001-8001-000000000001';
const EMP_B_ID = 'a1000002-0001-4001-8001-000000000002';
const ADMIN = 'auth-subject-003';
const SM = 'auth-subject-004';
const SM_ID = 'a1000004-0001-4001-8001-000000000004';
const PETROL = 'auth-subject-005';

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function jwt(sub, email, expOffset = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const data = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
    sub,
    email,
    aud: 'authenticated',
    role: 'authenticated',
    iat: now,
    exp: now + expOffset,
  })}`;
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function devId(role, employeeId) {
  return Buffer.from(JSON.stringify({ authUserId: `dev-${role}`, role, employeeId }), 'utf8').toString('base64');
}

async function req(path, opts = {}) {
  const { method = 'GET', token, devRole, devEmployeeId, headers = {}, body, rawBody } = opts;
  const h = { Accept: 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (devRole) h['X-Malcon-Dev-Identity'] = devId(devRole, devEmployeeId);
  if (body !== undefined && rawBody === undefined) h['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers };
}

function assertAuthz(status, label, allowed = [401, 403]) {
  if (!allowed.includes(status)) failures.push(`${label}: expected ${allowed.join('/')} got ${status}`);
}

function assertOk(status, label) {
  if (status !== 200 && status !== 201) failures.push(`${label}: expected 2xx got ${status}`);
}

async function main() {
  console.log('Phase 1 extended validation →', BASE);

  const empA = jwt(EMP_A, 'store.a@example.invalid');
  const empB = jwt('auth-subject-002', 'driver.b@example.invalid');
  const admin = jwt(ADMIN, 'admin.c@example.invalid');
  const sm = jwt(SM, 'manager.d@example.invalid');
  const petrol = jwt(PETROL, 'petrol.e@example.invalid');
  const expired = jwt(EMP_A, 'store.a@example.invalid', -60);
  const badSig = `${empA}x`;

  assertAuthz((await req('/api/leave-requests?employeeId=' + EMP_B_ID, { token: empA })).status, 'cross leave');
  assertAuthz((await req('/api/petrol-requests?employeeId=' + EMP_B_ID, { token: empA })).status, 'cross petrol');
  assertAuthz((await req('/api/location-trips?employeeId=' + EMP_B_ID, { token: empA })).status, 'cross trips');
  assertAuthz((await req('/api/food-selections?employeeId=' + EMP_B_ID, { token: empA })).status, 'cross food');
  assertAuthz((await req('/api/case-task-requests?employeeId=' + EMP_B_ID, { token: empA })).status, 'cross case tasks');
  assertAuthz(
    (
      await req('/api/case-alerts/acknowledge', {
        method: 'POST',
        token: empA,
        body: { caseId: 'e5000001-0001-4001-8001-000000000001', employeeId: EMP_B_ID },
      })
    ).status,
    'ack other alert',
  );

  const roster = await req('/api/employees', { token: empA });
  if (roster.status === 200 && Array.isArray(roster.json?.data)) {
    const withEmail = roster.json.data.find((e) => e.email && String(e.email).includes('@'));
    if (withEmail) failures.push('employee roster leaked email');
  }

  const adminBroadcast = await req('/api/telegram/broadcast', {
    method: 'POST',
    token: empA,
    body: { target: 'all', message: 'probe' },
  });
  assertAuthz(adminBroadcast.status, 'employee telegram broadcast');

  const delStorage = await req('/api/storage/stage-photos/objects', {
    method: 'DELETE',
    token: empA,
    body: { keys: ['cases/foo.jpg'] },
  });
  assertAuthz(delStorage.status, 'employee storage delete');

  const noAuthDel = await req('/api/storage/stage-photos/objects', {
    method: 'DELETE',
    body: { keys: ['x'] },
  });
  assertAuthz(noAuthDel.status, 'unauthenticated storage delete', [401]);

  assertAuthz((await req('/api/notifications/summary', { token: badSig })).status, 'invalid JWT', [401]);
  assertAuthz((await req('/api/notifications/summary', { token: expired })).status, 'expired JWT', [401]);

  const malformedLogin = await req('/api/auth/login', {
    method: 'POST',
    rawBody: '{not-json',
    headers: { 'Content-Type': 'application/json' },
  });
  assertAuthz(malformedLogin.status, 'malformed login JSON', [400, 401]);

  const webhook = await req('/api/telegram/webhook', { method: 'POST', body: { update_id: 1 } });
  if (process.env.ENFORCE_PROD_WEBHOOK === '1') {
    assertAuthz(webhook.status, 'telegram webhook no secret', [401]);
  } else {
    console.log('  telegram webhook (dev):', webhook.status);
  }

  const health = await req('/health');
  assertOk(health.status, 'health');
  const secHeaders = health.headers;
  for (const name of ['x-content-type-options', 'x-frame-options', 'referrer-policy']) {
    if (!secHeaders.get(name)) failures.push(`missing security header: ${name}`);
  }

  assertOk((await req('/api/employees', { token: admin })).status, 'admin employees');
  assertOk((await req('/api/leave-requests', { token: sm })).status, 'store_manager leave list');
  assertOk((await req('/api/petrol-requests', { token: petrol })).status, 'petrol petrol-requests');
  assertOk((await req('/api/notifications/summary', { token: empA })).status, 'employee notifications');

  const devOk = await req('/api/leave-requests?employeeId=' + EMP_A_ID, {
    devRole: 'employee',
    devEmployeeId: EMP_A_ID,
  });
  assertOk(devOk.status, 'dev identity in development');

  const ownLeave = await req('/api/leave-requests?employeeId=' + EMP_A_ID, { token: empA });
  assertOk(ownLeave.status, 'employee own leave');

  if (failures.length) {
    console.error('\nFAILURES:');
    failures.forEach((f) => console.error(' -', f));
    process.exit(1);
  }
  console.log('\nPhase 1 extended validation passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
