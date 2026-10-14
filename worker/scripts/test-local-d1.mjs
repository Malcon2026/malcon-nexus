#!/usr/bin/env node
/**
 * Local D1 integration tests (Phase 3). Uses wrangler --local only.
 */
import { d1Execute, d1EnableForeignKeys } from './exec-local-d1.mjs';

const failures = [];

function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

console.log('=== Local D1 tests ===\n');
d1EnableForeignKeys();

const TEST_NOTIF_ID = 'test-notif-fk-0001-4001-8001-000000000099';
const TEST_CASE_CASCADE = 'test-case-cascade-4001-8001-000000000001';
const TEST_DOC_SETNULL = 'test-doc-setnull-4001-8001-000000000001';

function tryD1(sql) {
  try {
    d1Execute(sql);
  } catch {
    /* ok */
  }
}

tryD1(`DELETE FROM notifications WHERE id = '${TEST_NOTIF_ID}'`);
tryD1(`DELETE FROM cases WHERE id = '${TEST_CASE_CASCADE}'`);
tryD1(`DELETE FROM doctors WHERE id = '${TEST_DOC_SETNULL}'`);
tryD1(`DELETE FROM employees WHERE id = 'a1000099-0001-4001-8001-000000000099'`);

// --- JSON round-trip ---
const updatedStages = JSON.stringify([
  { stage: 'Set Preparation', status: 'Approved', documents: [] },
  { stage: 'Surgery', status: 'Pending', documents: [{ id: 'x', url: 'https://example.invalid/x.jpg' }] },
]);
d1Execute(`UPDATE cases SET stages = '${updatedStages.replace(/'/g, "''")}', post_surgery_duties = '{"restock":true}' WHERE case_number = 'IMP-DEV-001';`);
d1Execute(`UPDATE employees SET departments = '["Stores","Delivery"]' WHERE email = 'store.a@example.invalid';`);

const caseRow = d1Execute(`SELECT stages, post_surgery_duties, hospital_snapshot, doctor_snapshot, invoice_amount_minor, collected_amount_minor FROM cases WHERE case_number = 'IMP-DEV-001';`)[0];
if (!caseRow) {
  assert(false, 'cases IMP-DEV-001 missing — run npm run db:seed:local after reset');
} else {
const stagesParsed = JSON.parse(caseRow.stages);
assert(Array.isArray(stagesParsed) && stagesParsed.length === 2, 'cases.stages JSON parse');
assert(JSON.parse(caseRow.post_surgery_duties).restock === true, 'post_surgery_duties JSON');
assert(JSON.parse(caseRow.hospital_snapshot).name === 'Dev Hospital Alpha', 'hospital_snapshot JSON');
assert(caseRow.invoice_amount_minor === 125050, 'invoice_amount_minor 125050 (= ₹1250.50)');
assert(caseRow.collected_amount_minor === 125050, 'collected_amount_minor');
console.log('✓ JSON + money fields');
}

// --- FK valid ---
d1Execute(`INSERT INTO notifications (id, title, message, type, is_read, case_id, recipient_id, created_at) VALUES ('${TEST_NOTIF_ID}', 't', 'm', 'info', 0, 'e5000001-0001-4001-8001-000000000001', 'a1000001-0001-4001-8001-000000000001', '2026-04-01T10:00:00.000Z')`);
console.log('✓ valid FK insert');

// --- FK invalid (expect failure) ---
let fkBlocked = false;
try {
  d1Execute(`INSERT INTO cases (id, case_number, hospital_id, hospital_snapshot, doctor_snapshot, implant_required, implant_type, implant_company, priority, status, current_stage, post_surgery_duties, created_by, stages, activity_logs, comments, created_at, updated_at) VALUES ('bad-case-0001-4001-8001-000000000001', 'BAD-001', '00000000-0000-4000-8000-000000000099', '{}', '{}', '', '', '', 'Low', 'Draft', 'Set Preparation', '{}', 'x', '[]', '[]', '[]', '2026-04-01T10:00:00.000Z', '2026-04-01T10:00:00.000Z');`);
} catch {
  fkBlocked = true;
}
assert(fkBlocked, 'invalid hospital_id FK should fail');
console.log(fkBlocked ? '✓ invalid FK rejected' : '✗ invalid FK NOT rejected');

// --- RESTRICT: delete hospital with cases ---
let restrictBlocked = false;
try {
  d1Execute(`DELETE FROM hospitals WHERE id = 'b2000001-0001-4001-8001-000000000001';`);
} catch {
  restrictBlocked = true;
}
assert(restrictBlocked, 'DELETE hospital with cases should RESTRICT fail');
console.log(restrictBlocked ? '✓ RESTRICT on cases.hospital_id' : '✗ RESTRICT missing');

// --- CASCADE: delete case removes notifications ---
d1Execute(`INSERT INTO cases (id, case_number, hospital_id, hospital_snapshot, doctor_snapshot, implant_required, implant_type, implant_company, priority, status, current_stage, post_surgery_duties, created_by, stages, activity_logs, comments, created_at, updated_at) VALUES ('${TEST_CASE_CASCADE}', 'TEST-CASCADE-001', 'b2000001-0001-4001-8001-000000000001', '{}', '{}', '', '', '', 'Low', 'Draft', 'Set Preparation', '{}', 'dev-test', '[]', '[]', '[]', '2026-04-01T10:00:00.000Z', '2026-04-01T10:00:00.000Z')`);
d1Execute(`INSERT INTO notifications (id, title, message, type, is_read, case_id, recipient_id, created_at) VALUES ('test-notif-cascade-4001-8001-000000000001', 'cascade', 'm', 'info', 0, '${TEST_CASE_CASCADE}', 'a1000001-0001-4001-8001-000000000001', '2026-04-01T10:00:00.000Z')`);
const before = d1Execute(`SELECT COUNT(*) AS c FROM notifications WHERE case_id = '${TEST_CASE_CASCADE}'`)[0].c;
d1Execute(`DELETE FROM cases WHERE id = '${TEST_CASE_CASCADE}'`);
const after = d1Execute(`SELECT COUNT(*) AS c FROM notifications WHERE case_id = '${TEST_CASE_CASCADE}'`)[0].c;
assert(before === 1 && after === 0, 'CASCADE notifications on case delete');
console.log('✓ CASCADE notifications');

// --- SET NULL: doctor delete ---
d1Execute(`INSERT INTO doctors (id, name, specialization, hospital_id, phone, created_at) VALUES ('${TEST_DOC_SETNULL}', 'Dev Temp Doc', 'Ortho', 'b2000001-0001-4001-8001-000000000001', '', '2026-04-01T10:00:00.000Z')`);
d1Execute(`UPDATE cases SET doctor_id = '${TEST_DOC_SETNULL}' WHERE id = 'e5000002-0001-4001-8001-000000000002'`);
d1Execute(`DELETE FROM doctors WHERE id = '${TEST_DOC_SETNULL}'`);
const docNull = d1Execute(`SELECT doctor_id FROM cases WHERE id = 'e5000002-0001-4001-8001-000000000002'`)[0].doctor_id;
assert(docNull === null, 'doctor SET NULL on cases');
console.log('✓ SET NULL doctor_id');

// --- CRUD employees ---
d1Execute(`INSERT INTO employees (id, name, email, department, departments, role, status, avatar, phone, join_date, created_at, updated_at) VALUES ('a1000099-0001-4001-8001-000000000099', 'Dev Temp', 'temp@example.invalid', 'Stores', '[]', 'employee', 'Active', '', '', '2026-04-01', '2026-04-01T10:00:00.000Z', '2026-04-01T10:00:00.000Z');`);
d1Execute(`UPDATE employees SET name = 'Dev Temp Updated' WHERE id = 'a1000099-0001-4001-8001-000000000099';`);
const empName = d1Execute(`SELECT name FROM employees WHERE id = 'a1000099-0001-4001-8001-000000000099';`)[0].name;
assert(empName === 'Dev Temp Updated', 'employee UPDATE');
d1Execute(`DELETE FROM employees WHERE id = 'a1000099-0001-4001-8001-000000000099';`);
console.log('✓ employees CRUD');

// --- Egress-safe list query (no SELECT *) ---
const caseList = d1Execute(`
SELECT id, case_number, status, current_stage, assigned_employee_id, surgery_date, updated_at
FROM cases
WHERE status = 'Active'
ORDER BY updated_at DESC
LIMIT 5;
`);
assert(caseList.length <= 5 && !('stages' in (caseList[0] || {})), 'case list summary columns only');
console.log('✓ case LIST projection (no stages blob)');

const caseDetail = d1Execute(`SELECT stages FROM cases WHERE case_number = 'IMP-DEV-001';`);
assert(caseDetail[0]?.stages?.length > 10, 'case DETAIL includes stages');
console.log('✓ case DETAIL includes JSON');

// --- Pagination notifications ---
const page1 = d1Execute(`
SELECT id, title, is_read, created_at FROM notifications
WHERE recipient_id = 'a1000001-0001-4001-8001-000000000001'
ORDER BY created_at DESC, id DESC
LIMIT 5;
`);
assert(page1.length <= 5, 'notifications page size');
console.log('✓ notifications pagination');

// --- activity_log date filter + limit ---
const activity = d1Execute(`
SELECT id, action, created_at FROM activity_log
WHERE created_at >= '2026-04-01T00:00:00.000Z'
ORDER BY created_at DESC
LIMIT 10;
`);
assert(activity.length <= 10, 'activity_log capped');
console.log('✓ activity_log pagination + date filter');

// --- attendance employee + date ---
const att = d1Execute(`
SELECT id, punch_type, punched_at FROM attendance_records
WHERE employee_id = 'a1000001-0001-4001-8001-000000000001'
  AND punched_at >= '2026-04-01T00:00:00.000Z'
ORDER BY punched_at DESC
LIMIT 10;
`);
assert(att.length >= 1, 'attendance filter');
console.log('✓ attendance employee + date filter');

// --- TV-style updatedSince ---
const since = d1Execute(`
SELECT id, case_number, status, current_stage, updated_at
FROM cases
WHERE updated_at > '2026-03-31T23:59:59.000Z'
ORDER BY updated_at DESC
LIMIT 50;
`);
assert(since.length <= 50, 'updatedSince case summary');
console.log('✓ TV/gallery updatedSince-style query');

console.log('\n=== Summary ===');
if (failures.length) {
  for (const f of failures) console.log('FAIL:', f);
  process.exit(1);
}
console.log('All tests passed.');
process.exit(0);
