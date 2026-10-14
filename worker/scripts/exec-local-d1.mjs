#!/usr/bin/env node
/** Run SQL against local D1 only (never --remote). */
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workerRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DB = 'malcon-nexus-dev';

function parseWranglerJson(stdout) {
  const start = stdout.indexOf('[');
  if (start < 0) throw new Error('No JSON in wrangler output');
  const parsed = JSON.parse(stdout.slice(start));
  return parsed[0]?.results ?? [];
}

export function d1Execute(command) {
  if (/--remote/i.test(command)) {
    throw new Error('Refusing --remote in local-only Phase 3');
  }
  const normalized = command
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/;\s*$/, '');
  const stdout = execSync(
    `npx wrangler d1 execute ${DB} --local --command ${JSON.stringify(normalized)} --json`,
    { cwd: workerRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return parseWranglerJson(stdout);
}

export function d1ExecuteFile(sql, { quiet = false } = {}) {
  const file = join(tmpdir(), `malcon-d1-${Date.now()}.sql`);
  writeFileSync(file, sql);
  try {
    execSync(`npx wrangler d1 execute ${DB} --local --file ${JSON.stringify(file)}`, {
      cwd: workerRoot,
      stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
  } finally {
    try {
      unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

export function d1EnableForeignKeys() {
  d1Execute('PRAGMA foreign_keys = ON;');
  getLocalDb().exec('PRAGMA foreign_keys = ON;');
}

/** Wrangler `--file` local execute rejects very long SQL literals (~128KB). */
export const WRANGLER_MAX_SQL_BYTES = 100 * 1024;

let localDb;
let localDbPath;

function findLocalD1SqlitePath() {
  const dir = join(workerRoot, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
  if (files.length !== 1) {
    throw new Error(`Expected one local D1 sqlite file, found ${files.length} in ${dir}`);
  }
  return join(dir, files[0]);
}

function getLocalDb() {
  const path = findLocalD1SqlitePath();
  if (!localDb || localDbPath !== path) {
    localDb = new DatabaseSync(path);
    localDbPath = path;
  }
  return localDb;
}

function assertTableName(table) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
}

/** Parameterized INSERT OR REPLACE — local SQLite file (no Wrangler spawn). */
export function d1InsertOrReplace(table, row) {
  assertTableName(table);
  const db = getLocalDb();
  const cols = Object.keys(row);
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
  db.prepare(sql).run(...cols.map((c) => row[c]));
}

/** PRAGMA / reads against local D1 SQLite (fast; import + validation). */
export function d1SqliteAll(sql) {
  return getLocalDb().prepare(sql).all();
}

export function d1SqliteTableColumns(table) {
  assertTableName(table);
  return d1SqliteAll(`PRAGMA table_info(${table});`).map((c) => c.name);
}

export function d1SqliteCount(table) {
  assertTableName(table);
  return Number(d1SqliteAll(`SELECT COUNT(*) AS c FROM ${table};`)[0]?.c ?? 0);
}

export function d1ForeignKeyCheck() {
  return d1SqliteAll('PRAGMA foreign_key_check;');
}

/**
 * Insert many rows in one transaction (parameterized; FK-safe with foreign_keys=ON).
 * @param {string} table
 * @param {Record<string, unknown>[]} rows
 */
export function d1InsertBatchTransaction(table, rows) {
  if (!rows.length) return;
  assertTableName(table);
  const db = getLocalDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) {
      const cols = Object.keys(row);
      const placeholders = cols.map(() => '?').join(', ');
      const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
      db.prepare(sql).run(...cols.map((c) => row[c]));
    }
    db.exec('COMMIT');
  } catch (e) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  }
}
