#!/usr/bin/env node
/**
 * Phase 11 — read-only verification of production JSONL export (no D1 writes).
 *
 *   node scripts/phase11-verify-export.mjs
 *   node scripts/phase11-verify-export.mjs --dir backups/production-data-2026-10-14-175253
 */
import { readFileSync, existsSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMPORT_TABLE_ORDER } from './migration/table-order.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dirArg =
  args.find((a) => a.startsWith('--dir='))?.split('=')[1] ||
  (args.includes('--dir') ? args[args.indexOf('--dir') + 1] : null) ||
  'backups/production-data-2026-10-14-175253';

const importDir = resolve(root, dirArg);
const manifestPath = join(importDir, 'manifest.json');
const baselinePath = resolve(root, 'backups/production-checks-2026-10-14/production-row-counts-full.txt');

if (!existsSync(manifestPath)) {
  console.error(`Missing manifest: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const failures = [];

async function countLines(file) {
  if (!existsSync(file)) return null;
  let n = 0;
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) n += 1;
  }
  return n;
}

function loadBaselineCounts() {
  if (!existsSync(baselinePath)) return null;
  const text = readFileSync(baselinePath, 'utf8');
  const m = text.match(/2\) Exact row counts[\s\S]*?\n(\[[\s\S]*?\])\n\n={10}/);
  if (!m) return null;
  const rows = JSON.parse(m[1]);
  return Object.fromEntries(rows.map((r) => [r.table_name, r.row_count]));
}

console.log('=== Phase 11 export verification (read-only) ===\n');
console.log('Directory:', importDir);
console.log('Exported at:', manifest.exportedAt);
console.log('Source:', manifest.source);
console.log('Format:', manifest.format);

let totalRows = 0;
const tableReport = [];

for (const table of IMPORT_TABLE_ORDER) {
  const meta = manifest.tables?.[table];
  const file = meta?.path ? resolve(meta.path) : join(importDir, `${table}.jsonl`);
  const lines = await countLines(file);
  const expected = meta?.exported;
  if (expected === undefined && lines === null) continue;
  if (lines !== expected) {
    failures.push(`${table}: manifest=${expected} lines=${lines}`);
  }
  if (lines) totalRows += lines;
  tableReport.push({ table, rows: lines ?? 0, expected: expected ?? '—' });
}

console.log('\n--- Tables (import order) ---');
for (const r of tableReport) {
  console.log(`  ${r.table.padEnd(32)} ${String(r.rows).padStart(8)}  (manifest ${r.expected})`);
}
console.log(`\nTotal JSONL rows (ordered tables): ${totalRows}`);

const baseline = loadBaselineCounts();
if (baseline) {
  console.log('\n--- Spot-check vs production-checks-2026-10-14 ---');
  for (const t of ['employees', 'cases', 'notifications', 'activity_log', 'attendance_records']) {
    const exp = baseline[t];
    const got = manifest.tables?.[t]?.exported;
    const ok = exp === got;
    console.log(`  ${t}: baseline=${exp} manifest=${got} ${ok ? 'OK' : 'MISMATCH'}`);
    if (!ok) failures.push(`baseline mismatch ${t}`);
  }
}

const empFile = manifest.tables?.employees?.path;
if (empFile && existsSync(empFile)) {
  const first = readFileSync(empFile, 'utf8').split('\n').find(Boolean);
  if (first) {
    const row = JSON.parse(first);
    const badDev =
      String(row.email || '').includes('example.invalid') ||
      String(row.employee_code || '').startsWith('DEV');
    if (badDev) failures.push('employees.jsonl looks like dev fixture data');
    const withAuth = readFileSync(empFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .filter((e) => e.auth_user_id).length;
    console.log(`\nemployees: ${withAuth} rows with auth_user_id (JWT mapping depends on this)`);
  }
}

if (failures.length) {
  console.error('\nFAILED:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('\nExport verification passed.');
