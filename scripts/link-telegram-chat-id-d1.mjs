#!/usr/bin/env node
/**
 * Link an employee's Telegram chat id in production D1 (manual / admin).
 *
 *   npm run telegram:link -- 1234 987654321
 *
 * Get chat id from @userinfobot on Telegram (numeric "Id:" field).
 */
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerDir = resolve(__dirname, '../worker');

const employeeCode = process.argv[2]?.trim();
const chatId = process.argv[3]?.trim();

if (!employeeCode || !chatId || !/^\d+$/.test(chatId)) {
  console.error('Usage: npm run telegram:link -- <employee_code> <telegram_chat_id>');
  console.error('Example: npm run telegram:link -- 1234 987654321');
  process.exit(1);
}

function escapeSql(s) {
  return String(s).replace(/'/g, "''");
}

const codeEsc = escapeSql(employeeCode);
const chatEsc = escapeSql(chatId);

const verifySql = `SELECT employee_code, name, telegram_chat_id FROM employees WHERE employee_code = '${codeEsc}';`;
const updateSql = `UPDATE employees SET telegram_chat_id = '${chatEsc}', updated_at = datetime('now') WHERE employee_code = '${codeEsc}';`;

function d1(sql) {
  return execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'malcon-nexus-production', '--remote', '--command', sql],
    { cwd: workerDir, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
}

console.log(`Linking employee ${employeeCode} → Telegram chat ${chatId}…\n`);
d1(updateSql);
const out = d1(verifySql);
const start = out.indexOf('"results"');
if (start >= 0) {
  const slice = out.slice(start);
  const match = slice.match(/"employee_code":\s*"([^"]*)".*?"name":\s*"([^"]*)".*?"telegram_chat_id":\s*"([^"]*)"/s);
  if (match) {
    console.log(`✓ ${match[2]} (${match[1]}) → telegram_chat_id ${match[3]}`);
    process.exit(0);
  }
}
console.log(out);
console.log('\n✓ Update sent. Verify in app: Settings → Notifications or OTP login.');
