#!/usr/bin/env node
/** Scan export JSONL for orphan FKs + optional single-row import until failure. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMPORT_TABLE_ORDER } from './migration/table-order.mjs';
import { normalizeRowForD1, sqlLiteral } from './migration/transforms.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exportDir = resolve(process.argv[2] || 'backups/production-data-2026-10-14-175253');

function readJsonl(table) {
  const path = join(exportDir, `${table}.jsonl`);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function idSet(table) {
  return new Set(readJsonl(table).map((r) => r.id).filter(Boolean));
}

const employees = idSet('employees');
const hospitals = idSet('hospitals');
const doctors = idSet('doctors');
const cases = idSet('cases');
const attendance = idSet('attendance_records');

const checks = [
  {
    table: 'cases',
    rows: readJsonl('cases'),
    rules: [
      { col: 'hospital_id', parent: 'hospitals', set: hospitals, required: true },
      { col: 'doctor_id', parent: 'doctors', set: doctors, required: false },
      { col: 'assigned_employee_id', parent: 'employees', set: employees, required: false },
    ],
  },
  {
    table: 'notifications',
    rows: readJsonl('notifications'),
    rules: [
      { col: 'case_id', parent: 'cases', set: cases, required: true },
      { col: 'recipient_id', parent: 'employees', set: employees, required: true },
    ],
  },
  {
    table: 'approvals',
    rows: readJsonl('approvals'),
    rules: [{ col: 'case_id', parent: 'cases', set: cases, required: true }],
  },
];

for (const { table, rows, rules } of checks) {
  for (const row of rows) {
    for (const { col, parent, set, required } of rules) {
      const v = row[col];
      if (v === null || v === undefined) {
        if (required) console.log('NULL required FK', { table, id: row.id, col, parent });
        continue;
      }
      if (v === '') console.log('EMPTY STRING FK', { table, id: row.id, col, parent });
      else if (!set.has(v)) console.log('ORPHAN FK', { table, id: row.id, col, value: v, parent });
    }
  }
}

// Live import until first failure
const workerRoot = join(root, 'worker');
const { d1Execute, d1EnableForeignKeys } = await import(join(workerRoot, 'scripts/exec-local-d1.mjs'));

function buildInsert(table, row) {
  const normalized = normalizeRowForD1(table, row, { source: 'postgres' });
  const cols = Object.keys(normalized);
  const vals = cols.map((c) => sqlLiteral(normalized[c]));
  return `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
}

console.log('\n--- Live import (stop on first FK error) ---\n');
d1EnableForeignKeys();

for (const table of IMPORT_TABLE_ORDER) {
  const rows = readJsonl(table);
  if (!rows.length) continue;
  let i = 0;
  for (const row of rows) {
    i += 1;
    const sql = buildInsert(table, row);
    const pk = row.id ?? row.key ?? JSON.stringify(row).slice(0, 40);
    try {
      d1Execute(sql);
    } catch (e) {
      console.error('FIRST FAILURE');
      console.error({ table, rowIndex: i, pk, error: String(e.message || e) });
      console.error('SQL snippet:', sql.slice(0, 500));
      process.exit(1);
    }
  }
  console.log(`OK ${table} (${rows.length})`);
}
console.log('All tables imported in diagnostic run');
