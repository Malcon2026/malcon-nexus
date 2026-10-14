#!/usr/bin/env node
/**
 * Validate local D1 schema after migrations (Phase 3).
 */
import { d1Execute } from './exec-local-d1.mjs';

const REQUIRED_TABLES = [
  'employees',
  'hospitals',
  'doctors',
  'departments',
  'surgical_kits',
  'cases',
  'notifications',
  'approvals',
  'activity_log',
  'attendance_records',
  'petrol_requests',
  'location_trips',
  'attendance_approval_requests',
  'field_team_attendance_approvals',
  'leave_requests',
  'employee_food_selections',
  'employee_daily_expenses',
  'case_task_requests',
  'case_alert_escalations',
  'app_settings',
  'login_otps',
  'push_subscriptions',
  'hospital_trip_punches',
];

const HR_TMS_TABLES = [
  'hr_walk_in_applications',
  'hr_kyc_intake',
  'hr_onboarding_tracks',
  'hr_job_postings',
  'malcon_tms_profiles',
  'malcon_tms_tasks',
  'malcon_tms_activity',
];

const failures = [];

function ok(label) {
  console.log(`  ✓ ${label}`);
}

function fail(label, detail) {
  console.log(`  ✗ ${label}: ${detail}`);
  failures.push(`${label}: ${detail}`);
}

console.log('=== Local D1 schema validation ===\n');

const tables = d1Execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
).map((r) => r.name);

for (const t of REQUIRED_TABLES) {
  if (tables.includes(t)) ok(`table ${t}`);
  else fail(`table ${t}`, 'missing');
}

for (const t of HR_TMS_TABLES) {
  if (tables.includes(t)) ok(`HR/TMS table ${t}`);
  else fail(`HR/TMS table ${t}`, 'missing');
}

const pkRows = d1Execute("SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE '%PRIMARY KEY%';");
if (pkRows.length >= REQUIRED_TABLES.length) ok('primary keys present on core tables');
else fail('primary keys', `only ${pkRows.length} tables with PK in DDL`);

const fkList = d1Execute('PRAGMA foreign_key_list(cases);');
if (fkList.length >= 2) ok(`cases FK count (${fkList.length})`);
else fail('cases foreign keys', JSON.stringify(fkList));

const idxCount = d1Execute(
  "SELECT COUNT(*) AS c FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';",
)[0]?.c;
ok(`indexes created (${idxCount})`);

const notNullCases = d1Execute('PRAGMA table_info(cases);').filter((c) => c.notnull === 1);
if (notNullCases.some((c) => c.name === 'case_number')) ok('cases.case_number NOT NULL');
else fail('cases.case_number NOT NULL', 'missing');

const uniqueEmpEmailIdx = d1Execute(
  "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='employees' AND sql LIKE '%email%';",
);
if (uniqueEmpEmailIdx.length > 0) ok('employees.email UNIQUE (index)');
else fail('employees.email UNIQUE', 'no unique index on email');

const expenseCols = d1Execute('PRAGMA table_info(employee_daily_expenses);').map((c) => c.name);
for (const col of [
  'kms_driven',
  'petrol_amount',
  'food_amount',
  'other_amount',
  'entered_by',
  'entered_by_id',
]) {
  if (expenseCols.includes(col)) ok(`employee_daily_expenses.${col}`);
  else fail(`employee_daily_expenses.${col}`, 'missing');
}
const expenseUnique = d1Execute(
  "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='employee_daily_expenses' AND sql LIKE '%UNIQUE%';",
);
if (expenseUnique.length > 0) ok('employee_daily_expenses UNIQUE (employee_id, expense_date)');
else fail('employee_daily_expenses unique per day', 'missing');

const settingsCols = d1Execute('PRAGMA table_info(app_settings);').map((c) => c.name);
if (settingsCols.includes('updated_by')) ok('app_settings.updated_by');
else fail('app_settings.updated_by', 'missing');

const hrJobCols = d1Execute('PRAGMA table_info(hr_job_postings);').map((c) => c.name);
if (hrJobCols.includes('code') && !hrJobCols.includes('payload')) ok('hr_job_postings production columns');
else fail('hr_job_postings', 'still placeholder or missing code');

console.log('\n=== Summary ===');
if (failures.length) {
  console.log(`FAILED (${failures.length}):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('All schema checks passed.');
process.exit(0);
