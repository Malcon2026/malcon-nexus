#!/usr/bin/env node
/**
 * Import JSONL exports into LOCAL D1 only (never --remote).
 * Uses local D1 SQLite file + parameterized inserts (no per-batch Wrangler spawn).
 *
 * Usage:
 *   node scripts/import-d1-data.mjs --dir worker/fixtures/synthetic-migration
 *   node scripts/import-d1-data.mjs --dir backups/production-data-... --source postgres
 */
import { readFileSync, existsSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMPORT_TABLE_ORDER } from './migration/table-order.mjs';
import { normalizeRowForD1 } from './migration/transforms.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workerRoot = resolve(root, 'worker');

const args = process.argv.slice(2);
const dirArg = args.find((a) => a.startsWith('--dir='))?.split('=')[1] || args[args.indexOf('--dir') + 1];
const sourceEq = args.find((a) => a.startsWith('--source='))?.split('=')[1];
const sourceIdx = args.indexOf('--source');
const source =
  sourceEq || (sourceIdx >= 0 && args[sourceIdx + 1] && !args[sourceIdx + 1].startsWith('--') ? args[sourceIdx + 1] : 'synthetic');

/** Rows per SQLite transaction (tuned for local D1; not Wrangler SQL limits). */
const TABLE_BATCH_ROWS = {
  cases: 40,
  notifications: 2500,
  activity_log: 2500,
  attendance_records: 800,
};

const DEFAULT_BATCH_ROWS = Number(process.env.IMPORT_BATCH_SIZE || 500);

if (!dirArg) {
  console.error('Usage: node scripts/import-d1-data.mjs --dir <jsonl-directory> [--source postgres|synthetic]');
  process.exit(1);
}

const importDir = resolve(dirArg);
if (!existsSync(importDir)) {
  console.error(`Directory not found: ${importDir}`);
  process.exit(1);
}

if (/--remote/i.test(process.argv.join(' '))) {
  console.error('Refusing --remote');
  process.exit(1);
}

const {
  d1EnableForeignKeys,
  d1InsertBatchTransaction,
  d1SqliteTableColumns,
  d1SqliteCount,
  d1ForeignKeyCheck,
} = await import(join(workerRoot, 'scripts/exec-local-d1.mjs'));

async function countJsonlLines(table) {
  const path = join(importDir, `${table}.jsonl`);
  if (!existsSync(path)) return 0;
  let n = 0;
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line) n += 1;
  }
  return n;
}

async function* iterateJsonl(table) {
  const path = join(importDir, `${table}.jsonl`);
  if (!existsSync(path)) return;
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line) yield JSON.parse(line);
  }
}

function rowPrimaryKey(table, row) {
  return row.id ?? row.key ?? row.case_number ?? '(unknown)';
}

const tableColumnsCache = new Map();
function columnsForTable(table) {
  if (!tableColumnsCache.has(table)) {
    tableColumnsCache.set(table, new Set(d1SqliteTableColumns(table)));
  }
  return tableColumnsCache.get(table);
}

function normalizeForInsert(table, row) {
  const normalizedRaw = normalizeRowForD1(table, row, { source });
  const allowed = columnsForTable(table);
  const normalized = {};
  for (const [k, v] of Object.entries(normalizedRaw)) {
    if (allowed.has(k)) normalized[k] = v;
  }
  return normalized;
}

function logProgress(table, batchIndex, batchTotal, rowsDone, rowTotal) {
  console.log(`TABLE: ${table}`);
  console.log(`BATCH: ${batchIndex}/${batchTotal}`);
  console.log(`ROWS: ${rowsDone}/${rowTotal}`);
}

console.log(`Import LOCAL D1 from ${importDir} (source=${source}, engine=local-sqlite)\n`);
d1EnableForeignKeys();

let importedRows = 0;
const perTableImported = {};

for (const table of IMPORT_TABLE_ORDER) {
  const rowTotal = await countJsonlLines(table);
  if (!rowTotal) {
    console.log(`  skip ${table} (no file or empty)`);
    perTableImported[table] = 0;
    continue;
  }

  const batchSize = TABLE_BATCH_ROWS[table] ?? DEFAULT_BATCH_ROWS;
  const batchTotal = Math.ceil(rowTotal / batchSize);
  console.log(`\n=== ${table}: ${rowTotal} rows (${batchSize} per transaction) ===`);

  let batch = [];
  let batchIndex = 0;
  let rowsDone = 0;

  for await (const row of iterateJsonl(table)) {
    batch.push(normalizeForInsert(table, row));
    if (batch.length >= batchSize) {
      batchIndex += 1;
      try {
        d1InsertBatchTransaction(table, batch);
      } catch (e) {
        const pk = rowPrimaryKey(table, row);
        console.error(`\nImport failed on ${table}`);
        console.error(`  primary key: ${pk}`);
        console.error(`  error: ${e.message || e}`);
        process.exit(1);
      }
      rowsDone += batch.length;
      importedRows += batch.length;
      logProgress(table, batchIndex, batchTotal, rowsDone, rowTotal);
      batch = [];
    }
  }

  if (batch.length) {
    batchIndex += 1;
    try {
      d1InsertBatchTransaction(table, batch);
    } catch (e) {
      const last = batch[batch.length - 1];
      console.error(`\nImport failed on ${table}`);
      console.error(`  primary key: ${rowPrimaryKey(table, last)}`);
      console.error(`  error: ${e.message || e}`);
      process.exit(1);
    }
    rowsDone += batch.length;
    importedRows += batch.length;
    logProgress(table, batchIndex, batchTotal, rowsDone, rowTotal);
  }

  const d1Count = d1SqliteCount(table);
  if (d1Count !== rowTotal) {
    console.error(`\nRow count mismatch after ${table}: jsonl=${rowTotal} d1=${d1Count}`);
    process.exit(1);
  }
  perTableImported[table] = rowTotal;
  console.log(`  ✓ ${table} verified ${d1Count} rows`);
}

console.log(`\nImported ${importedRows} rows total.`);

const fkIssues = d1ForeignKeyCheck();
if (fkIssues.length) {
  console.error('foreign_key_check FAILED:', JSON.stringify(fkIssues.slice(0, 10)));
  process.exit(1);
}
console.log('foreign_key_check: OK');

const baselinePath = resolve(root, 'backups/production-checks-2026-10-14/production-row-counts-full.txt');
if (existsSync(baselinePath) && source === 'postgres') {
  const baselineText = readFileSync(baselinePath, 'utf8');
  const baselineMatch = baselineText.match(/2\) Exact row counts[\s\S]*?\n(\[[\s\S]*?\])\n\n={10}/);
  if (baselineMatch) {
    const baselineRows = JSON.parse(baselineMatch[1]);
    const expected = Object.fromEntries(baselineRows.map((r) => [r.table_name, r.row_count]));
    const hrTms = [
      'hr_walk_in_applications',
      'hr_kyc_intake',
      'hr_onboarding_tracks',
      'hr_job_postings',
      'malcon_tms_profiles',
      'malcon_tms_tasks',
      'malcon_tms_activity',
    ];
    const checks = [
      'cases',
      'notifications',
      'activity_log',
      'attendance_records',
      ...hrTms,
    ];
    let mismatches = [];
    for (const t of checks) {
      const exp = expected[t];
      const got = d1SqliteCount(t);
      if (got !== exp) mismatches.push(`${t}: expected ${exp}, got ${got}`);
    }
    if (mismatches.length) {
      console.error('Phase 4.7 row count validation FAILED:\n', mismatches.join('\n'));
      process.exit(1);
    }
    console.log('Phase 4.7 spot-check row counts: OK');
  }
}

console.log('Import complete (local D1 only).');
