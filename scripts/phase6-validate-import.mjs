#!/usr/bin/env node
/**
 * Phase 6 — compare production export JSONL vs local D1 after import.
 * Writes validation JSON + exits 1 on critical failures.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMPORT_TABLE_ORDER } from './migration/table-order.mjs';
import { pgNumericToMinor } from './migration/transforms.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exportDir = process.argv[2];
if (!exportDir) {
  console.error('Usage: node scripts/phase6-validate-import.mjs <export-dir>');
  process.exit(1);
}

const absExport = resolve(exportDir);
const baselinePath = resolve(root, 'backups/production-checks-2026-10-14/production-row-counts-full.txt');
const baselineText = readFileSync(baselinePath, 'utf8');
const baselineMatch = baselineText.match(
  /2\) Exact row counts[\s\S]*?\n(\[[\s\S]*?\])\n\n={10}/,
);
const baselineRows = JSON.parse(baselineMatch[1]);
const expectedProd = Object.fromEntries(baselineRows.map((r) => [r.table_name, r.row_count]));

const { d1Execute } = await import(join(root, 'worker/scripts/exec-local-d1.mjs'));

const HR_TMS = [
  'hr_walk_in_applications',
  'hr_kyc_intake',
  'hr_onboarding_tracks',
  'hr_job_postings',
  'malcon_tms_profiles',
  'malcon_tms_tasks',
  'malcon_tms_activity',
];

const failures = [];
const warnings = [];
const tableResults = {};

function readJsonl(table) {
  const path = join(absExport, `${table}.jsonl`);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function jsonStable(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    try {
      return JSON.stringify(JSON.parse(val));
    } catch {
      return val;
    }
  }
  return JSON.stringify(val);
}

console.log('=== Phase 6 import validation ===\n');

// Row counts + PK uniqueness
for (const table of IMPORT_TABLE_ORDER) {
  const exp = expectedProd[table];
  const d1Count = Number(d1Execute(`SELECT COUNT(*) AS c FROM ${table};`)[0]?.c ?? 0);
  const exportRows = readJsonl(table);
  const exportCount = exportRows.length;

  let pkOk = true;
  let pkDetail = '';
  const pkCol = d1Execute(`PRAGMA table_info(${table});`).find((c) => c.pk === 1)?.name;
  if (pkCol) {
    const dup = d1Execute(
      `SELECT ${pkCol}, COUNT(*) AS c FROM ${table} GROUP BY ${pkCol} HAVING c > 1 LIMIT 5;`,
    );
    if (dup.length) {
      pkOk = false;
      pkDetail = `duplicate PK on ${pkCol}: ${JSON.stringify(dup)}`;
    }
  }

  const rowMatch = d1Count === exp && exportCount === exp;
  if (!rowMatch) {
    failures.push(
      `${table}: prod=${exp} export=${exportCount} d1=${d1Count}`,
    );
  }
  if (!pkOk) failures.push(`${table}: ${pkDetail}`);

  tableResults[table] = {
    expectedProduction: exp,
    exportCount,
    d1Count,
    rowCountMatch: rowMatch,
    pkUnique: pkOk,
  };
  console.log(
    `${rowMatch && pkOk ? '✓' : '✗'} ${table}: prod=${exp} export=${exportCount} d1=${d1Count}`,
  );
}

// FK integrity
let fkIssues = [];
try {
  fkIssues = d1Execute('PRAGMA foreign_key_check;');
} catch (e) {
  failures.push(`foreign_key_check error: ${e.message}`);
}
if (fkIssues.length) {
  failures.push(`foreign_key_check: ${JSON.stringify(fkIssues.slice(0, 20))}`);
} else {
  console.log('\n✓ foreign_key_check: OK');
}

// Cases — JSON semantics (export PG shape vs D1 stored text)
const caseRows = readJsonl('cases');
let caseJsonChecks = { total: caseRows.length, stagesOk: 0, hospitalOk: 0, doctorOk: 0, dutiesOk: 0, logsOk: 0 };
for (const pgRow of caseRows) {
  const id = pgRow.id;
  const d1 = d1Execute(`SELECT stages, hospital_snapshot, doctor_snapshot, post_surgery_duties, activity_logs FROM cases WHERE id = '${String(id).replace(/'/g, "''")}';`)[0];
  if (!d1) {
    failures.push(`cases missing in D1: ${id}`);
    continue;
  }
  if (jsonStable(pgRow.stages) === jsonStable(d1.stages)) caseJsonChecks.stagesOk += 1;
  else failures.push(`cases.stages mismatch id=${id}`);

  if (jsonStable(pgRow.hospital_snapshot) === jsonStable(d1.hospital_snapshot)) caseJsonChecks.hospitalOk += 1;
  else failures.push(`cases.hospital_snapshot mismatch id=${id}`);

  if (jsonStable(pgRow.doctor_snapshot) === jsonStable(d1.doctor_snapshot)) caseJsonChecks.doctorOk += 1;
  else failures.push(`cases.doctor_snapshot mismatch id=${id}`);

  if (jsonStable(pgRow.post_surgery_duties) === jsonStable(d1.post_surgery_duties)) caseJsonChecks.dutiesOk += 1;
  else failures.push(`cases.post_surgery_duties mismatch id=${id}`);

  if (jsonStable(pgRow.activity_logs) === jsonStable(d1.activity_logs)) caseJsonChecks.logsOk += 1;
  else failures.push(`cases.activity_logs mismatch id=${id}`);
}
console.log(`\nCases JSON: ${caseJsonChecks.stagesOk}/${caseJsonChecks.total} stages OK`);

// Money — cases + petrol
let moneyChecks = { cases: 0, casesFail: 0, petrol: 0, petrolFail: 0 };
for (const pgRow of caseRows) {
  const id = pgRow.id;
  const d1 = d1Execute(
    `SELECT invoice_amount_minor, collected_amount_minor FROM cases WHERE id = '${String(id).replace(/'/g, "''")}';`,
  )[0];
  if (!d1) continue;
  const invMinor = pgNumericToMinor(pgRow.invoice_amount);
  const colMinor = pgNumericToMinor(pgRow.collected_amount);
  if (d1.invoice_amount_minor === invMinor && d1.collected_amount_minor === colMinor) moneyChecks.cases += 1;
  else {
    moneyChecks.casesFail += 1;
    failures.push(`cases money id=${id} pg inv=${pgRow.invoice_amount} col=${pgRow.collected_amount} d1=${d1.invoice_amount_minor}/${d1.collected_amount_minor}`);
  }
}

const petrolRows = readJsonl('petrol_requests');
for (const pgRow of petrolRows) {
  const id = pgRow.id;
  const d1 = d1Execute(
    `SELECT amount_minor FROM petrol_requests WHERE id = '${String(id).replace(/'/g, "''")}';`,
  )[0];
  if (!d1) continue;
  const minor = pgNumericToMinor(pgRow.amount);
  if (d1.amount_minor === minor) moneyChecks.petrol += 1;
  else {
    moneyChecks.petrolFail += 1;
    failures.push(`petrol money id=${id}`);
  }
}
console.log(`Money: cases ${moneyChecks.cases} ok / ${moneyChecks.casesFail} fail; petrol ${moneyChecks.petrol} ok`);

// employee_daily_expenses REAL columns (no minor transform)
const expenseRows = readJsonl('employee_daily_expenses');
let expMoneyOk = 0;
let expMoneyFail = 0;
for (const pgRow of expenseRows.slice(0, 500)) {
  const id = pgRow.id;
  const d1 = d1Execute(
    `SELECT petrol_amount, food_amount, other_amount, kms_driven FROM employee_daily_expenses WHERE id = '${String(id).replace(/'/g, "''")}';`,
  )[0];
  if (!d1) continue;
  const nums = ['petrol_amount', 'food_amount', 'other_amount', 'kms_driven'];
  let ok = true;
  for (const col of nums) {
    const pg = pgRow[col];
    const d1v = d1[col];
    if (pg == null && d1v == null) continue;
    if (pg != null && d1v != null && Math.abs(Number(pg) - Number(d1v)) < 0.001) continue;
    ok = false;
  }
  if (ok) expMoneyOk += 1;
  else expMoneyFail += 1;
}
if (expMoneyFail) failures.push(`employee_daily_expenses REAL mismatch sample: ${expMoneyFail}`);

// HR/TMS summary
const hrTmsResults = {};
for (const t of HR_TMS) {
  hrTmsResults[t] = tableResults[t];
}

// NULL / boolean spot-check on notifications
const notifSample = readJsonl('notifications').slice(0, 100);
let boolOk = 0;
for (const pgRow of notifSample) {
  const d1 = d1Execute(
    `SELECT is_read FROM notifications WHERE id = '${String(pgRow.id).replace(/'/g, "''")}';`,
  )[0];
  if (!d1) continue;
  const expected = pgRow.is_read ? 1 : 0;
  if (d1.is_read === expected) boolOk += 1;
}

const report = {
  exportDir: absExport,
  validatedAt: new Date().toISOString(),
  tableResults,
  caseJsonChecks,
  moneyChecks,
  employeeDailyExpensesSample: { ok: expMoneyOk, fail: expMoneyFail, sampled: Math.min(500, expenseRows.length) },
  notificationsBooleanSample: { ok: boolOk, sampled: notifSample.length },
  hrTmsResults,
  fkIssueCount: fkIssues.length,
  failures: failures.slice(0, 200),
  failureCount: failures.length,
  warnings,
};

writeFileSync(resolve(root, 'backups/phase6-validation-result.json'), JSON.stringify(report, null, 2));

console.log(`\nFailures: ${failures.length}`);
if (failures.length) {
  console.error(failures.slice(0, 15).join('\n'));
  process.exit(1);
}
console.log('Validation PASS');
process.exit(0);
