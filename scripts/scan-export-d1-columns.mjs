#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMPORT_TABLE_ORDER } from './migration/table-order.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(process.argv[2] || 'backups/production-data-2026-10-14-175253');
const { d1Execute } = await import(join(root, 'worker/scripts/exec-local-d1.mjs'));

for (const table of IMPORT_TABLE_ORDER) {
  const path = join(dir, `${table}.jsonl`);
  if (!existsSync(path)) continue;
  const line = readFileSync(path, 'utf8').split('\n').find(Boolean);
  if (!line) continue;
  const keys = Object.keys(JSON.parse(line));
  const cols = new Set(d1Execute(`PRAGMA table_info(${table});`).map((c) => c.name));
  const extra = keys.filter((k) => !cols.has(k));
  if (extra.length) console.log(table, 'export-only columns:', extra.join(', '));
}
