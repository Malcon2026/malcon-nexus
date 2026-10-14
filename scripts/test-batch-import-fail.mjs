#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMPORT_TABLE_ORDER } from './migration/table-order.mjs';
import { normalizeRowForD1, sqlLiteral } from './migration/transforms.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(process.argv[2] || 'backups/production-data-2026-10-14-175253');
const batchSize = Number(process.env.IMPORT_BATCH_SIZE || 50);

const { d1Execute, d1ExecuteFile, d1EnableForeignKeys } = await import(
  join(root, 'worker/scripts/exec-local-d1.mjs'),
);

function buildInsert(table, row) {
  const normalized = normalizeRowForD1(table, row, { source: 'postgres' });
  const cols = Object.keys(normalized);
  const vals = cols.map((c) => sqlLiteral(normalized[c]));
  return `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
}

function readJsonl(table) {
  const path = join(dir, `${table}.jsonl`);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

d1EnableForeignKeys();

for (const table of IMPORT_TABLE_ORDER) {
  const rows = readJsonl(table);
  if (!rows.length) continue;
  let batch = '';
  let n = 0;
  let batchStart = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    batch += buildInsert(table, row) + '\n';
    n += 1;
    if (n >= batchSize) {
      try {
        d1ExecuteFile(batch);
      } catch (e) {
        console.error('BATCH FAIL', table, 'rows', batchStart, '-', i);
        for (const r of rows.slice(batchStart, i + 1)) {
          try {
            d1Execute(buildInsert(table, r));
          } catch (e2) {
            console.error('ROW FAIL', {
              table,
              id: r.id ?? r.key,
              error: String(e2.message || e2).split('\n')[0],
            });
            process.exit(1);
          }
        }
      }
      batch = '';
      n = 0;
      batchStart = i + 1;
    }
  }
  if (batch) {
    try {
      d1ExecuteFile(batch);
    } catch (e) {
      console.error('FINAL BATCH FAIL', table);
      process.exit(1);
    }
  }
  console.log('OK', table, rows.length);
}
