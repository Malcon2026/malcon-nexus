#!/usr/bin/env node
import { readFileSync, existsSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const dir = process.argv[2] || 'backups/production-data-2026-10-14-175253';

function loadIds(file) {
  const s = new Set();
  if (!existsSync(file)) return s;
  for (const l of readFileSync(file, 'utf8').split('\n')) {
    if (!l) continue;
    s.add(JSON.parse(l).id);
  }
  return s;
}

const employees = loadIds(join(dir, 'employees.jsonl'));
const hospitals = loadIds(join(dir, 'hospitals.jsonl'));
const doctors = loadIds(join(dir, 'doctors.jsonl'));
const cases = loadIds(join(dir, 'cases.jsonl'));
const attendance = loadIds(join(dir, 'attendance_records.jsonl'));

async function scan(file, rules) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let orphan = null;
  let emptyFk = null;
  for await (const line of rl) {
    if (!line) continue;
    const row = JSON.parse(line);
    for (const { col, set, parent, nullable } of rules) {
      const v = row[col];
      if (v === '' && nullable && !emptyFk) emptyFk = { file, id: row.id, col, parent };
      if (v == null || v === '') continue;
      if (!set.has(v) && !orphan) orphan = { file, id: row.id, col, value: v, parent };
    }
  }
  return { orphan, emptyFk };
}

const results = [];
results.push(await scan(join(dir, 'cases.jsonl'), [
  { col: 'hospital_id', set: hospitals, parent: 'hospitals', nullable: false },
  { col: 'doctor_id', set: doctors, parent: 'doctors', nullable: true },
  { col: 'assigned_employee_id', set: employees, parent: 'employees', nullable: true },
]));
results.push(await scan(join(dir, 'notifications.jsonl'), [
  { col: 'case_id', set: cases, parent: 'cases', nullable: true },
  { col: 'recipient_id', set: employees, parent: 'employees', nullable: true },
]));
results.push(await scan(join(dir, 'attendance_approval_requests.jsonl'), [
  { col: 'employee_id', set: employees, parent: 'employees', nullable: false },
  { col: 'reviewed_by_id', set: employees, parent: 'employees', nullable: true },
  { col: 'attendance_record_id', set: attendance, parent: 'attendance_records', nullable: true },
]));

console.log(JSON.stringify(results, null, 2));
