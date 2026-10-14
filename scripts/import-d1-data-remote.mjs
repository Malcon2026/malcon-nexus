#!/usr/bin/env node
/**
 * Import validated local D1 SQLite → remote Cloudflare D1 via parameterized D1 HTTP API.
 * Uses the same row data as import-d1-data.mjs (local file must already be loaded).
 *
 *   CONFIRM_REMOTE_D1=malcon-nexus-production node scripts/import-d1-data-remote.mjs
 *   CONFIRM_REMOTE_D1=malcon-nexus-production node scripts/import-d1-data-remote.mjs --from-table cases
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMPORT_TABLE_ORDER } from './migration/table-order.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workerRoot = join(root, 'worker');
const ACCOUNT_ID = '8c319d08ed49912d25c582198500c265';
const DATABASE_ID = '232961fe-ff35-4b9b-a661-b7f9e2e4bf58';

const args = process.argv.slice(2);
const fromTable = args.find((a) => a.startsWith('--from-table='))?.split('=')[1]
  || (args.includes('--from-table') ? args[args.indexOf('--from-table') + 1] : null);

if (process.env.CONFIRM_REMOTE_D1 !== 'malcon-nexus-production') {
  console.error('Refusing remote import. Set CONFIRM_REMOTE_D1=malcon-nexus-production');
  process.exit(1);
}

function wranglerOAuthToken() {
  const path = join(homedir(), 'Library/Preferences/.wrangler/config/default.toml');
  const text = readFileSync(path, 'utf8');
  const m = text.match(/oauth_token\s*=\s*"([^"]+)"/);
  if (!m) throw new Error('Could not read oauth_token from wrangler config');
  return m[1];
}

async function d1Query(sql, params = []) {
  const token = wranglerOAuthToken();
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params.length ? { sql, params } : { sql }),
    },
  );
  const body = await res.json();
  if (!body.success) {
    throw new Error(JSON.stringify(body.errors ?? body));
  }
  return body.result?.[0];
}

const { d1SqliteAll, d1SqliteCount, d1ForeignKeyCheck } = await import(
  join(workerRoot, 'scripts/exec-local-d1.mjs')
);

const TABLE_BATCH_ROWS = {
  cases: 5,
  notifications: 200,
  activity_log: 200,
  attendance_records: 100,
};

const DEFAULT_BATCH = 100;

async function remoteCount(table) {
  const r = await d1Query(`SELECT COUNT(*) AS c FROM ${table}`);
  return Number(r?.results?.[0]?.c ?? 0);
}

async function importTable(table) {
  const localCount = d1SqliteCount(table);
  if (!localCount) {
    console.log(`skip ${table} (empty local)`);
    return;
  }
  const remoteBefore = await remoteCount(table);
  if (remoteBefore === localCount) {
    console.log(`✓ ${table} already ${localCount} rows on remote`);
    return;
  }
  if (remoteBefore > 0 && remoteBefore < localCount) {
    console.log(`${table}: remote=${remoteBefore} local=${localCount} — continuing import (INSERT OR REPLACE)`);
  }

  const cols = d1SqliteAll(`PRAGMA table_info(${table});`).map((c) => c.name);
  const colList = cols.join(', ');
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${placeholders})`;

  const rows = d1SqliteAll(`SELECT * FROM ${table};`);
  const batchSize = TABLE_BATCH_ROWS[table] ?? DEFAULT_BATCH;
  let done = 0;

  function sqlLiteral(v) {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
    if (typeof v === 'bigint') return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
  }

  const useParamRows = table === 'cases';
  let i = 0;
  while (i < rows.length) {
    if (useParamRows) {
      const row = rows[i];
      const params = cols.map((c) => (row[c] === undefined ? null : row[c]));
      await d1Query(sql, params);
      done += 1;
      i += 1;
    } else {
      let chunk = [];
      let est = 0;
      while (i < rows.length && chunk.length < batchSize) {
        const row = rows[i];
        const values = cols.map((c) => sqlLiteral(row[c] === undefined ? null : row[c])).join(', ');
        const line = `(${values})`;
        if (chunk.length && est + line.length > 85000) break;
        chunk.push(line);
        est += line.length;
        i += 1;
      }
      const bulk = `INSERT OR REPLACE INTO ${table} (${colList}) VALUES ${chunk.join(', ')};`;
      await d1Query(bulk);
      done += chunk.length;
    }
    if (done % 2000 === 0 || done === rows.length) console.log(`  ${table}: ${done}/${rows.length}`);
  }

  const remoteAfter = await remoteCount(table);
  if (remoteAfter !== localCount) {
    throw new Error(`${table}: local=${localCount} remote=${remoteAfter} after import`);
  }
  console.log(`✓ ${table} imported ${localCount} rows`);
}

const tables = fromTable
  ? IMPORT_TABLE_ORDER.slice(IMPORT_TABLE_ORDER.indexOf(fromTable))
  : IMPORT_TABLE_ORDER;

if (fromTable && !IMPORT_TABLE_ORDER.includes(fromTable)) {
  console.error('Unknown table:', fromTable);
  process.exit(1);
}

console.log('Remote D1 import from local SQLite → malcon-nexus-production\n');

for (const table of tables) {
  console.log(`\n=== ${table} ===`);
  await importTable(table);
}

console.log('\nRemote import pass complete.');
console.log('Run validation: CONFIRM_REMOTE_D1=malcon-nexus-production node scripts/validate-remote-d1.mjs');
