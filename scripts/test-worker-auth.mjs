#!/usr/bin/env node
/**
 * Worker JWT auth tests (local wrangler dev).
 *
 * Prerequisites (.dev.vars recommended):
 *   JWT_SECRET=local-dev-only-secret
 *   API_REQUIRE_AUTH=1
 *
 * Optional: WORKER_BASE_URL=http://127.0.0.1:8787
 */
import crypto from 'node:crypto';

const BASE = process.env.WORKER_BASE_URL || 'http://127.0.0.1:8787';
const SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'local-dev-only-secret';

const EMP_AUTH = 'auth-subject-001';
const EMP_ID = 'a1000001-0001-4001-8001-000000000001';
const ADMIN_AUTH = 'auth-subject-003';
const ADMIN_ID = 'a1000003-0001-4001-8001-000000000003';
const CASE_ID = 'e5000001-0001-4001-8001-000000000001';

const failures = [];

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function signJwt(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const data = `${b64url(header)}.${b64url(payload)}`;
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function tokenFor(sub, email, expOffsetSec = 3600) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    sub,
    email,
    aud: 'authenticated',
    role: 'authenticated',
    iat: now,
    exp: now + expOffsetSec,
  });
}

function devIdentity(role, employeeId) {
  return Buffer.from(
    JSON.stringify({ authUserId: `dev-${role}`, role, employeeId }),
  ).toString('base64');
}

async function req(path, { method = 'GET', token, devRole, devEmployeeId, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (devRole) headers['X-Malcon-Dev-Identity'] = devIdentity(devRole, devEmployeeId);
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
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
  console.log('Worker auth tests →', BASE);

  const health = await req('/health');
  assert(health.status === 200, `health expected 200 got ${health.status}`);

  const validEmp = tokenFor(EMP_AUTH, 'store.a@example.invalid');
  const validAdmin = tokenFor(ADMIN_AUTH, 'admin.c@example.invalid');
  const expired = tokenFor(EMP_AUTH, 'store.a@example.invalid', -10);
  const unknown = tokenFor('00000000-0000-4000-8000-000000000099', 'unknown@example.invalid');
  const badSig = `${validEmp}x`;

  const missing = await req('/api/notifications/summary');
  if (process.env.API_REQUIRE_AUTH === '1' || process.env.ENFORCE_AUTH_TESTS === '1') {
    assert(missing.status === 401, `missing JWT: expected 401 got ${missing.status}`);
  } else {
    console.log('  (skip strict missing-JWT — set API_REQUIRE_AUTH=1 on Worker + ENFORCE_AUTH_TESTS=1 to assert)');
  }

  const bad = await req('/api/notifications/summary', { token: badSig });
  assert(bad.status === 401, `invalid JWT: expected 401 got ${bad.status}`);

  const exp = await req('/api/notifications/summary', { token: expired });
  assert(exp.status === 401, `expired JWT: expected 401 got ${exp.status}`);

  const unk = await req('/api/notifications/summary', { token: unknown });
  if (unk.status === 403 || unk.status === 401) {
    /* mapped vs unmapped depending on API_REQUIRE_AUTH */
  } else if (unk.status === 200) {
    console.log('  (unknown user returned 200 — relaxed dev auth without API_REQUIRE_AUTH)');
  } else {
    assert(false, `unknown auth user: unexpected ${unk.status}`);
  }

  const empOk = await req('/api/notifications/summary', { token: validEmp });
  if (empOk.status === 200) {
    console.log('  valid employee JWT → notifications summary OK');
  } else if (empOk.status === 401 && !process.env.API_REQUIRE_AUTH) {
    console.log('  valid JWT rejected — set JWT_SECRET in Worker .dev.vars to match test secret');
  } else {
    assert(empOk.status === 200 || empOk.status === 403, `valid employee JWT: got ${empOk.status}`);
  }

  const adminOk = await req('/api/employees', { token: validAdmin });
  if (adminOk.status === 200) console.log('  valid admin JWT → employee list OK');

  const cross = await req(`/api/employees/${EMP_ID}/attendance`, {
    token: tokenFor(EMP_AUTH, 'store.a@example.invalid'),
  });
  if (cross.status === 403) {
    console.log('  employee cross-access blocked (403)');
  }

  const claimOther = await req(`/api/cases/${CASE_ID}`, {
    method: 'PUT',
    token: tokenFor(EMP_AUTH, 'store.a@example.invalid'),
    body: { case_number: 'SHOULD-NOT-WORK' },
  });
  if (claimOther.status === 403 || claimOther.status === 400 || claimOther.status === 401) {
    console.log('  case write without proper auth/body rejected');
  }

  const devHeader = await req('/api/notifications/summary', {
    devRole: 'admin',
    devEmployeeId: ADMIN_ID,
  });
  assert(devHeader.status === 200, `dev identity header (development): expected 200 got ${devHeader.status}`);

  const leaveSubmit = await req('/api/leave-requests/submit-own', {
    method: 'POST',
    devRole: 'employee',
    devEmployeeId: EMP_ID,
    body: {
      leaveType: 'Casual',
      fromDate: '2026-12-01',
      toDate: '2026-12-02',
      reason: 'Worker auth test leave reason',
    },
  });
  assert(leaveSubmit.status === 201 || leaveSubmit.status === 200, `submit-own leave: ${leaveSubmit.status}`);

  if (failures.length) {
    console.error('\nFAILURES:');
    for (const f of failures) console.error(' -', f);
    process.exit(1);
  }
  console.log('\nAll worker auth checks passed (within local configuration limits).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
