#!/usr/bin/env node
/** Phase 10.2 — medium-risk Worker write smoke tests (local D1). */
const BASE = process.env.WORKER_BASE_URL || 'http://127.0.0.1:8787';
const ADMIN_ID = 'a1000003-0001-4001-8001-000000000003';
const EMP1 = 'a1000001-0001-4001-8001-000000000001';
const CASE_ID = 'e5000001-0001-4001-8001-000000000001';
const HOSP_ID = 'b2000001-0001-4001-8001-000000000001';

const failures = [];

function devIdentity(role, employeeId) {
  return Buffer.from(JSON.stringify({ authUserId: `dev-${role}`, role, employeeId })).toString('base64');
}

function uuid() {
  const tail = `${Date.now().toString(16)}`.padStart(12, '0').slice(-12);
  return `c9100001-0001-4001-8001-${tail}`;
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

async function main() {
  console.log(`=== Phase 10.2 medium-risk write tests (${BASE}) ===\n`);

  const health = await req('GET', '/health');
  assert(health.res.status === 200, 'worker health');

  const empId = uuid();
  const createEmp = await req('POST', '/api/employees', {
    role: 'admin',
    employeeId: ADMIN_ID,
    body: {
      id: empId,
      name: 'Write Test Emp',
      email: `write.test.${Date.now()}@example.invalid`,
      department: 'Stores',
      departments: ['Stores'],
      role: 'employee',
      status: 'Active',
      joinDate: '2026-01-01',
    },
  });
  assert(createEmp.res.status === 201, 'employee create');

  const patchEmp = await req('PUT', `/api/employees/${empId}`, {
    role: 'admin',
    employeeId: ADMIN_ID,
    body: { phone: '9999999999' },
  });
  assert(patchEmp.res.status === 200, 'employee update');

  const hospId = uuid();
  const createHosp = await req('POST', '/api/hospitals', {
    role: 'admin',
    employeeId: ADMIN_ID,
    body: {
      id: hospId,
      name: 'Test Hosp',
      branch: 'Test',
      city: 'Dev City',
      status: 'Active',
    },
  });
  assert(createHosp.res.status === 201, 'hospital create');

  const docId = uuid();
  const createDoc = await req('POST', '/api/doctors', {
    role: 'admin',
    employeeId: ADMIN_ID,
    body: {
      id: docId,
      name: 'Dr Test',
      specialization: 'Test',
      hospitalId: HOSP_ID,
      phone: '',
      doctorCode: 'DOC-TEST-99',
    },
  });
  assert(createDoc.res.status === 201, 'doctor create + master list');

  const attId = uuid();
  const att = await req('POST', '/api/attendance-records', {
    role: 'employee',
    employeeId: EMP1,
    body: {
      id: attId,
      employeeId: EMP1,
      employeeName: 'Dev Store A',
      punchType: 'in',
      punchedAt: new Date().toISOString(),
      latitude: 1,
      longitude: 2,
      accuracyM: 5,
      distanceM: 10,
      withinOffice: true,
      officeAddress: 'office',
    },
  });
  assert(att.res.status === 201, 'attendance insert');

  const foodId = uuid();
  const food = await req('PUT', `/api/food-selections/${foodId}`, {
    role: 'admin',
    employeeId: ADMIN_ID,
    body: {
      id: foodId,
      employeeId: EMP1,
      employeeName: 'Dev Store A',
      mealDate: '2026-04-20',
      breakfast: true,
      lunch: false,
      dinner: false,
      submittedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
  assert(food.res.status === 200, 'food upsert (non-RPC)');

  const petrolId = uuid();
  const petrol = await req('POST', '/api/petrol-requests', {
    role: 'employee',
    employeeId: EMP1,
    body: {
      id: petrolId,
      employeeId: EMP1,
      employeeName: 'Dev Store A',
      vehicleNo: 'TEST-1',
      amount: 500,
      requestedAt: new Date().toISOString(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
  assert(petrol.res.status === 201, 'petrol insert');

  const tripId = uuid();
  const trip = await req('POST', '/api/location-trips', {
    role: 'employee',
    employeeId: EMP1,
    body: {
      id: tripId,
      employeeId: EMP1,
      employeeName: 'Dev Store A',
      tripNo: 1,
      status: 'started',
      startAt: new Date().toISOString(),
      startLat: 1,
      startLng: 2,
      startAccuracyM: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
  assert(trip.res.status === 201, 'location trip insert');

  const ctId = uuid();
  const ct = await req('POST', '/api/case-task-requests', {
    role: 'employee',
    employeeId: EMP1,
    body: {
      id: ctId,
      caseId: 'e5000008-0001-4001-8001-000000000008',
      caseNumber: 'IMP-DEV-008',
      stage: 'Delivery',
      employeeId: EMP1,
      employeeName: 'Dev Store A',
      employeeDepartment: 'Stores',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    },
  });
  assert(ct.res.status === 201, 'case task create');

  const forbidden = await req('POST', '/api/hospitals', {
    role: 'employee',
    employeeId: EMP1,
    body: { id: uuid(), name: 'Nope', status: 'Active' },
  });
  assert(forbidden.res.status === 403, 'hospital create forbidden for employee');

  await req('DELETE', `/api/employees/${empId}`, { role: 'admin', employeeId: ADMIN_ID });
  await req('DELETE', `/api/hospitals/${hospId}`, { role: 'admin', employeeId: ADMIN_ID });
  await req('DELETE', `/api/doctors/${docId}`, { role: 'admin', employeeId: ADMIN_ID });
  await req('DELETE', `/api/petrol-requests/${petrolId}`, { role: 'admin', employeeId: ADMIN_ID });
  await req('DELETE', `/api/location-trips/${tripId}`, { role: 'admin', employeeId: ADMIN_ID });

  console.log(failures.length ? failures.map((f) => `  ✗ ${f}`).join('\n') : '  All medium-risk write checks passed.');
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
