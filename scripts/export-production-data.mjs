#!/usr/bin/env node
/**
 * Read-only production export → JSONL per table.
 *
 * SAFETY:
 * - SELECT only via `supabase db query --linked`
 * - Requires ALLOW_PRODUCTION_EXPORT=1
 * - Does NOT run unless --execute is passed (default is dry-run plan)
 *
 * Usage:
 *   node scripts/export-production-data.mjs                    # dry-run
 *   ALLOW_PRODUCTION_EXPORT=1 node scripts/export-production-data.mjs --execute
 *   ALLOW_PRODUCTION_EXPORT=1 node scripts/export-production-data.mjs --execute --tables cases,employees
 */
import { execSync } from 'node:child_process';
import { createWriteStream, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { IMPORT_TABLE_ORDER } from './migration/table-order.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const execute = args.includes('--execute');
const tablesArg = args.find((a) => a.startsWith('--tables='))?.split('=')[1];
const outDir =
  process.env.EXPORT_DIR ||
  resolve(root, 'backups', `production-export-${new Date().toISOString().slice(0, 10)}`);
const batchSize = Number(process.env.EXPORT_BATCH_SIZE || 200);
const resume = args.includes('--resume');

const tables = tablesArg
  ? tablesArg.split(',').map((t) => t.trim())
  : [...IMPORT_TABLE_ORDER];

function runQuery(sql) {
  const file = join(tmpdir(), `malcon-export-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  writeFileSync(file, sql.trim() + '\n');
  const raw = execSync(`npx supabase db query --linked -f ${JSON.stringify(file)}`, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 128,
  });
  const start = raw.indexOf('{');
  if (start < 0) throw new Error('No JSON in supabase db query output');
  return JSON.parse(raw.slice(start)).rows ?? [];
}

function escIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

console.log('Malcon Nexus — production export (read-only SELECT)\n');
console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY-RUN (pass --execute to write files)'}`);
console.log(`Tables: ${tables.length}`);
console.log(`Output: ${outDir}\n`);

if (execute && process.env.ALLOW_PRODUCTION_EXPORT !== '1') {
  console.error('Refusing to export: set ALLOW_PRODUCTION_EXPORT=1');
  process.exit(1);
}

if (!execute) {
  for (const t of tables) console.log(`  would export: ${t}.jsonl (batch ${batchSize})`);
  console.log('\nDry-run complete. No production data written.');
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
const manifest = {
  exportedAt: new Date().toISOString(),
  source: 'supabase-postgres-linked',
  format: 'jsonl',
  batchSize,
  tables: {},
};

for (const table of tables) {
  const outPath = join(outDir, `${table}.jsonl`);
  if (resume && existsSync(outPath)) {
    console.log(`Skip ${table} (resume, file exists)`);
    manifest.tables[table] = { skipped: true, path: outPath };
    continue;
  }

  console.log(`Exporting ${table}...`);
  const stream = createWriteStream(outPath, { encoding: 'utf8' });
  let offset = 0;
  let total = 0;

  for (;;) {
    const sql = `SELECT * FROM ${escIdent('public')}.${escIdent(table)} ORDER BY 1 LIMIT ${batchSize} OFFSET ${offset};`;
    let rows;
    try {
      rows = runQuery(sql);
    } catch (e) {
      manifest.tables[table] = { error: String(e.message || e), exported: total };
      console.log(`  ERROR: ${e.message}`);
      stream.end();
      break;
    }
    if (!rows.length) break;
    for (const row of rows) {
      stream.write(`${JSON.stringify(row)}\n`);
      total += 1;
    }
    if (rows.length < batchSize) break;
    offset += batchSize;
    process.stdout.write(`  ${total} rows...\r`);
  }
  stream.end();
  manifest.tables[table] = { exported: total, path: outPath };
  console.log(`  ${table}: ${total} rows`);
}

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nDone. Manifest: ${join(outDir, 'manifest.json')}`);
