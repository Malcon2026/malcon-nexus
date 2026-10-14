#!/usr/bin/env node
/**
 * Phase 6 final data fidelity validation (local D1 vs production export).
 */
import { readFileSync, writeFileSync, existsSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMPORT_TABLE_ORDER } from './migration/table-order.mjs';
import { pgNumericToMinor } from './migration/transforms.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exportDir = resolve(process.argv[2] || 'backups/production-data-2026-10-14-175253');
const logPath = resolve(root, 'backups/phase6-import-optimized.log');

const {
  d1SqliteAll,
  d1SqliteCount,
  d1ForeignKeyCheck,
  d1SqliteTableColumns,
} = await import(join(root, 'worker/scripts/exec-local-d1.mjs'));

const HR_TMS = [
  'hr_walk_in_applications',
  'hr_kyc_intake',
  'hr_onboarding_tracks',
  'hr_job_postings',
  'malcon_tms_profiles',
  'malcon_tms_tasks',
  'malcon_tms_activity',
];

const baselineText = readFileSync(
  resolve(root, 'backups/production-checks-2026-10-14/production-row-counts-full.txt'),
  'utf8',
);
const baselineMatch = baselineText.match(/2\) Exact row counts[\s\S]*?\n(\[[\s\S]*?\])\n\n={10}/);
const expectedProd = Object.fromEntries(
  JSON.parse(baselineMatch[1]).map((r) => [r.table_name, r.row_count]),
);

const report = {
  validatedAt: new Date().toISOString(),
  exportDir,
  sections: {},
  failures: [],
  warnings: [],
};

function fail(section, msg) {
  report.failures.push(`[${section}] ${msg}`);
}

function warn(section, msg) {
  report.warnings.push(`[${section}] ${msg}`);
}

function jsonStable(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    try {
      return JSON.stringify(JSON.parse(val));
    } catch {
      return null;
    }
  }
  return JSON.stringify(val);
}

async function* streamJsonl(table) {
  const path = join(exportDir, `${table}.jsonl`);
  if (!existsSync(path)) return;
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line) yield JSON.parse(line);
  }
}

async function countJsonl(table) {
  let n = 0;
  for await (const _ of streamJsonl(table)) n += 1;
  return n;
}

// --- 1. Row counts ---
const rowCounts = { tables: {}, totalD1: 0, totalExpected: 0 };
let rowPass = true;
for (const table of IMPORT_TABLE_ORDER) {
  const exp = expectedProd[table] ?? 0;
  const d1 = d1SqliteCount(table);
  const expLines = await countJsonl(table);
  rowCounts.tables[table] = { phase47: exp, exportJsonl: expLines, d1, match: d1 === exp && d1 === expLines };
  rowCounts.totalD1 += d1;
  rowCounts.totalExpected += exp;
  if (!rowCounts.tables[table].match) {
    rowPass = false;
    fail('ROW_COUNTS', `${table}: phase47=${exp} export=${expLines} d1=${d1}`);
  }
}
if (rowCounts.totalD1 !== 161050) {
  rowPass = false;
  fail('ROW_COUNTS', `total d1=${rowCounts.totalD1}, expected 161050`);
}
report.sections.rowCounts = { pass: rowPass, ...rowCounts };

// --- 2. Primary keys ---
let pkPass = true;
const pkDetails = {};
for (const table of IMPORT_TABLE_ORDER) {
  if (d1SqliteCount(table) === 0) continue;
  const info = d1SqliteAll(`PRAGMA table_info(${table});`);
  const pkCols = info.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name);
  if (!pkCols.length) {
    pkPass = false;
    fail('PRIMARY_KEYS', `${table}: no PK column`);
    continue;
  }
  const pkCol = pkCols[0];
  const dup = d1SqliteAll(
    `SELECT ${pkCol} AS id, COUNT(*) AS c FROM ${table} GROUP BY ${pkCol} HAVING c > 1 LIMIT 3;`,
  );
  const nullPk = d1SqliteAll(
    `SELECT COUNT(*) AS c FROM ${table} WHERE ${pkCol} IS NULL OR ${pkCol} = '';`,
  )[0]?.c;
  pkDetails[table] = { pkCol, duplicates: dup.length, nullOrEmptyPk: Number(nullPk) };
  if (dup.length || nullPk > 0) {
    pkPass = false;
    fail('PRIMARY_KEYS', `${table}: dup=${JSON.stringify(dup)} nullPk=${nullPk}`);
  }
}
report.sections.primaryKeys = { pass: pkPass, pkDetails };

// --- 3. Foreign keys ---
const fkIssues = d1ForeignKeyCheck();
const fkPass = fkIssues.length === 0;
if (!fkPass) fail('FOREIGN_KEYS', JSON.stringify(fkIssues.slice(0, 10)));
report.sections.foreignKeys = { pass: fkPass, issueCount: fkIssues.length, sample: fkIssues.slice(0, 5) };

// --- 4. NULL behavior (notifications + nullable FK empty strings) ---
let nullPass = true;
const nullStats = {};
let exportNullRecipient = 0;
let exportEmptyRecipient = 0;
let exportNotifTotal = 0;
for await (const r of streamJsonl('notifications')) {
  exportNotifTotal += 1;
  if (r.recipient_id == null) exportNullRecipient += 1;
  if (r.recipient_id === '') exportEmptyRecipient += 1;
}
const d1NullRecipient = Number(
  d1SqliteAll('SELECT COUNT(*) AS c FROM notifications WHERE recipient_id IS NULL;')[0]?.c ?? 0,
);
const d1EmptyRecipient = Number(
  d1SqliteAll("SELECT COUNT(*) AS c FROM notifications WHERE recipient_id = '';")[0]?.c ?? 0,
);
nullStats.notifications = {
  exportTotal: exportNotifTotal,
  exportNullRecipient,
  exportEmptyRecipient,
  d1NullRecipient,
  d1EmptyRecipient,
};
if (d1NullRecipient !== exportNullRecipient) {
  nullPass = false;
  fail('NULL_HANDLING', `notifications.recipient_id null: export=${exportNullRecipient} d1=${d1NullRecipient}`);
}
if (d1EmptyRecipient !== exportEmptyRecipient) {
  nullPass = false;
  fail('NULL_HANDLING', `notifications.recipient_id empty: export=${exportEmptyRecipient} d1=${d1EmptyRecipient}`);
}

const nullableFkChecks = [
  { table: 'cases', col: 'doctor_id' },
  { table: 'cases', col: 'assigned_employee_id' },
  { table: 'notifications', col: 'case_id' },
];
for (const { table, col } of nullableFkChecks) {
  if (d1SqliteCount(table) === 0) continue;
  const d1Empty = Number(
    d1SqliteAll(`SELECT COUNT(*) AS c FROM ${table} WHERE ${col} = '';`)[0]?.c ?? 0,
  );
  let exportEmpty = 0;
  for await (const r of streamJsonl(table)) {
    if (r[col] === '') exportEmpty += 1;
  }
  nullStats[`${table}.${col}`] = { exportEmpty, d1Empty };
  if (exportEmpty > 0 && d1Empty !== exportEmpty) {
    nullPass = false;
    fail('NULL_HANDLING', `${table}.${col} empty string mismatch`);
  }
}
report.sections.nullHandling = { pass: nullPass, nullStats };

// --- 5. JSON (cases) ---
let jsonPass = true;
const jsonStats = { cases: { total: 0, stagesOk: 0, hospitalOk: 0, doctorOk: 0, dutiesOk: 0, logsOk: 0, parseFail: 0 } };
for await (const pgRow of streamJsonl('cases')) {
  jsonStats.cases.total += 1;
  const id = String(pgRow.id).replace(/'/g, "''");
  const d1 = d1SqliteAll(
    `SELECT stages, hospital_snapshot, doctor_snapshot, post_surgery_duties, activity_logs FROM cases WHERE id = '${id}';`,
  )[0];
  if (!d1) {
    jsonPass = false;
    fail('JSON', `cases missing in D1: ${pgRow.id}`);
    continue;
  }
  for (const [field, pgVal] of [
    ['stages', pgRow.stages],
    ['hospital_snapshot', pgRow.hospital_snapshot],
    ['doctor_snapshot', pgRow.doctor_snapshot],
    ['post_surgery_duties', pgRow.post_surgery_duties],
    ['activity_logs', pgRow.activity_logs],
  ]) {
    const pgJ = jsonStable(pgVal);
    const d1J = jsonStable(d1[field]);
    if (pgJ === null && d1J !== null && d1[field] !== null && d1[field] !== '') {
      jsonStats.cases.parseFail += 1;
    }
    if (pgJ !== d1J) {
      jsonPass = false;
      fail('JSON', `cases.${field} id=${pgRow.id}`);
      break;
    }
  }
  if (jsonStable(pgRow.stages) === jsonStable(d1.stages)) jsonStats.cases.stagesOk += 1;
  if (jsonStable(pgRow.hospital_snapshot) === jsonStable(d1.hospital_snapshot)) jsonStats.cases.hospitalOk += 1;
  if (jsonStable(pgRow.doctor_snapshot) === jsonStable(d1.doctor_snapshot)) jsonStats.cases.doctorOk += 1;
  if (jsonStable(pgRow.post_surgery_duties) === jsonStable(d1.post_surgery_duties)) jsonStats.cases.dutiesOk += 1;
  if (jsonStable(pgRow.activity_logs) === jsonStable(d1.activity_logs)) jsonStats.cases.logsOk += 1;
}
report.sections.json = { pass: jsonPass, jsonStats };

// --- 6. Timestamps (representative) ---
let tsPass = true;
const tsSamples = [];
const tsTables = [
  { table: 'cases', cols: ['created_at', 'updated_at'] },
  { table: 'employees', cols: ['created_at', 'updated_at'] },
  { table: 'notifications', cols: ['created_at'] },
  { table: 'leave_requests', cols: ['created_at', 'updated_at'] },
];
for (const { table, cols } of tsTables) {
  let n = 0;
  for await (const pgRow of streamJsonl(table)) {
    if (n >= 50) break;
    n += 1;
    const id = String(pgRow.id ?? pgRow.key).replace(/'/g, "''");
    const pk = pgRow.id ? 'id' : 'key';
    const d1 = d1SqliteAll(`SELECT ${cols.join(', ')} FROM ${table} WHERE ${pk} = '${id}';`)[0];
    if (!d1) {
      tsPass = false;
      fail('TIMESTAMPS', `${table} missing ${id}`);
      continue;
    }
    for (const col of cols) {
      const pg = pgRow[col];
      const d1v = d1[col];
      if (pg == null && d1v == null) continue;
      if (String(pg) !== String(d1v)) {
        if (table === 'leave_requests' && col === 'updated_at' && pg == null && d1v === pgRow.created_at) {
          tsSamples.push({ table, id: pgRow.id, col, note: 'updated_at coalesced from created_at (PG has no column)' });
          continue;
        }
        tsPass = false;
        fail('TIMESTAMPS', `${table}.${col} id=${pgRow.id} pg=${pg} d1=${d1v}`);
      }
    }
  }
}
report.sections.timestamps = { pass: tsPass, tsSamples: tsSamples.slice(0, 5) };

// --- 7. Booleans ---
let boolPass = true;
let boolChecked = 0;
for await (const pgRow of streamJsonl('notifications')) {
  if (boolChecked >= 200) break;
  boolChecked += 1;
  const id = String(pgRow.id).replace(/'/g, "''");
  const d1 = d1SqliteAll(`SELECT is_read FROM notifications WHERE id = '${id}';`)[0];
  const expected = pgRow.is_read ? 1 : 0;
  if (d1?.is_read !== expected) {
    boolPass = false;
    fail('BOOLEANS', `notifications.is_read id=${pgRow.id}`);
  }
}
for await (const pgRow of streamJsonl('attendance_records')) {
  if (boolChecked >= 250) break;
  boolChecked += 1;
  const id = String(pgRow.id).replace(/'/g, "''");
  const d1 = d1SqliteAll(`SELECT within_office FROM attendance_records WHERE id = '${id}';`)[0];
  const expected = pgRow.within_office ? 1 : 0;
  if (d1?.within_office !== expected) {
    boolPass = false;
    fail('BOOLEANS', `attendance_records.within_office id=${pgRow.id}`);
  }
}
report.sections.booleans = { pass: boolPass, sampled: boolChecked };

// --- 8. Money ---
let moneyPass = true;
const moneyStats = { cases: { ok: 0, fail: 0 }, petrol: { ok: 0, fail: 0 }, expenses: { ok: 0, fail: 0 } };
for await (const pgRow of streamJsonl('cases')) {
  const id = String(pgRow.id).replace(/'/g, "''");
  const d1 = d1SqliteAll(
    `SELECT invoice_amount_minor, collected_amount_minor FROM cases WHERE id = '${id}';`,
  )[0];
  const inv = pgNumericToMinor(pgRow.invoice_amount);
  const col = pgNumericToMinor(pgRow.collected_amount);
  if (d1?.invoice_amount_minor === inv && d1?.collected_amount_minor === col) moneyStats.cases.ok += 1;
  else {
    moneyStats.cases.fail += 1;
    moneyPass = false;
    if (moneyStats.cases.fail <= 3) fail('MONEY', `cases id=${pgRow.id}`);
  }
}
for await (const pgRow of streamJsonl('employee_daily_expenses')) {
  const id = String(pgRow.id).replace(/'/g, "''");
  const d1 = d1SqliteAll(
    `SELECT petrol_amount, food_amount, other_amount, kms_driven FROM employee_daily_expenses WHERE id = '${id}';`,
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
  if (ok) moneyStats.expenses.ok += 1;
  else {
    moneyStats.expenses.fail += 1;
    moneyPass = false;
  }
}
report.sections.money = { pass: moneyPass, moneyStats };

// --- 9. HR/TMS ---
let hrPass = true;
const hrDetails = {};
for (const t of HR_TMS) {
  const exp = expectedProd[t] ?? 0;
  const d1 = d1SqliteCount(t);
  hrDetails[t] = { expected: exp, d1, match: d1 === exp };
  if (d1 !== exp) {
    hrPass = false;
    fail('HR_TMS', `${t}: expected ${exp}, got ${d1}`);
  }
}
report.sections.hrTms = { pass: hrPass, hrDetails, fkIssuesForHr: fkPass };

// --- 10. Import log ---
let importPass = true;
const logText = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
if (!logText.includes('Import complete (local D1 only).')) {
  importPass = false;
  fail('IMPORT_COMPLETENESS', 'log missing successful completion');
}
if (/Import failed/i.test(logText)) {
  importPass = false;
  fail('IMPORT_COMPLETENESS', 'log contains Import failed');
}
const skipLines = logText.match(/^\s*skip .+$/gm) || [];
const skipNotes = skipLines.map((l) => l.trim());
const verifiedTables = (logText.match(/✓ .+ verified/g) || []).length;
report.sections.importCompleteness = {
  pass: importPass,
  verifiedTables,
  skipLines: skipNotes,
  note: 'skip = empty export file (0 production rows), not skipped records within a table',
};

// --- Summary flags ---
const summary = {
  rowCounts: rowPass,
  primaryKeys: pkPass,
  foreignKeys: fkPass,
  nullHandling: nullPass,
  json: jsonPass,
  timestamps: tsPass,
  booleans: boolPass,
  money: moneyPass,
  hrTms: hrPass,
  importCompleteness: importPass,
};
report.summary = summary;
report.overallPass = Object.values(summary).every(Boolean);

const outJson = resolve(root, 'backups/phase6-final-validation-result.json');
writeFileSync(outJson, JSON.stringify(report, null, 2));

console.log(JSON.stringify({ overallPass: report.overallPass, summary, failureCount: report.failures.length }, null, 2));
if (report.failures.length) {
  console.error(report.failures.slice(0, 20).join('\n'));
  process.exit(1);
}
