#!/usr/bin/env node
/**
 * Copy employees.telegram_chat_id from linked Supabase Postgres → production D1.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const workerDir = resolve(root, 'worker');

function queryLinked(sql) {
  const file = resolve(tmpdir(), `malcon-pg-${Date.now()}.sql`);
  writeFileSync(file, sql.trim() + '\n');
  try {
    const raw = execFileSync(
      'npx',
      ['supabase', 'db', 'query', '--linked', '-f', file],
      { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    );
    const start = raw.indexOf('{');
    if (start < 0) throw new Error('No JSON from supabase db query');
    const parsed = JSON.parse(raw.slice(start));
    return parsed.rows ?? [];
  } finally {
    try {
      unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

function escapeSql(s) {
  return String(s).replace(/'/g, "''");
}

function main() {
  const rows = queryLinked(`
    SELECT id, telegram_chat_id
    FROM employees
    WHERE telegram_chat_id IS NOT NULL AND trim(telegram_chat_id) <> '';
  `);

  if (rows.length === 0) {
    console.log('No telegram_chat_id rows in Supabase.');
    return;
  }

  const stmts = rows.map(
    (r) =>
      `UPDATE employees SET telegram_chat_id = '${escapeSql(r.telegram_chat_id)}', updated_at = datetime('now') WHERE id = '${escapeSql(r.id)}';`,
  );

  const sqlFile = resolve(tmpdir(), `malcon-d1-telegram-${Date.now()}.sql`);
  writeFileSync(sqlFile, stmts.join('\n') + '\n');
  try {
    execFileSync(
      'npx',
      ['wrangler', 'd1', 'execute', 'malcon-nexus-production', '--remote', '--file', sqlFile],
      { cwd: workerDir, stdio: 'inherit' },
    );
    console.log(`✓ Updated ${rows.length} employee telegram_chat_id row(s) in D1`);
  } finally {
    try {
      unlinkSync(sqlFile);
    } catch {
      /* ignore */
    }
  }
}

main();
