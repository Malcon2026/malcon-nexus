#!/usr/bin/env node
/**
 * Read employees CSV (edit in Excel → Save As CSV) and generate Supabase bootstrap SQL.
 *
 * Usage:
 *   node scripts/generate-employee-bootstrap.mjs
 *   node scripts/generate-employee-bootstrap.mjs path/to/employees.csv
 *
 * Output: supabase/bootstrap-generated.sql
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvObjects } from './lib/csv.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const VALID_DEPARTMENTS = new Set([
  'Stores',
  'Scrub Person',
  'Cleaning Department',
  'Stores Audit',
  'Accounts',
  'Bill Submission',
  'Admin',
]);

const VALID_ROLES = new Set(['admin', 'employee']);

function parseCsv(text) {
  return parseCsvObjects(text, {
    requiredColumns: ['name', 'email', 'password', 'department', 'role', 'phone'],
  }).map((row) => {
    if (!VALID_DEPARTMENTS.has(row.department)) {
      throw new Error(
        `Row ${row._line}: invalid department "${row.department}". Use one of: ${[...VALID_DEPARTMENTS].join(', ')}`,
      );
    }
    if (!VALID_ROLES.has(row.role)) {
      throw new Error(`Row ${row._line}: role must be "admin" or "employee".`);
    }
    return row;
  });
}

function initials(name) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function sqlEscape(value) {
  return value.replace(/'/g, "''");
}

function generateSql(rows) {
  const emails = rows.map((r) => `'${sqlEscape(r.email)}'`).join(',\n  ');

  const confirmBlock = `-- Confirm all auth users
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email IN (
  ${emails}
);

`;

  const insertBlocks = rows.map((row) => {
    const email = sqlEscape(row.email);
    const name = sqlEscape(row.name);
    const dept = sqlEscape(row.department);
    const role = sqlEscape(row.role);
    const phone = sqlEscape(row.phone || '');
    const avatar = sqlEscape(initials(row.name));

    return `-- ${row.name} (${row.email})
INSERT INTO employees (
  name, email, department, role, status, avatar, phone,
  cases_completed, cases_active, join_date, auth_user_id
)
SELECT
  '${name}',
  '${email}',
  '${dept}',
  '${role}',
  'Active',
  '${avatar}',
  '${phone}',
  0, 0, CURRENT_DATE, u.id
FROM auth.users u
WHERE u.email = '${email}'
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  role = EXCLUDED.role,
  status = 'Active',
  auth_user_id = EXCLUDED.auth_user_id;
`;
  });

  return `-- Auto-generated employee bootstrap
-- Source CSV rows: ${rows.length}
-- Prerequisite: auth users must exist (run scripts/create-auth-users.mjs first, or add users in Supabase Dashboard)

${confirmBlock}${insertBlocks.join('\n')}`;
}

const inputPath = resolve(root, process.argv[2] ?? 'supabase/employees-test-team.csv');
const outputPath = resolve(root, 'supabase/bootstrap-generated.sql');

const csv = readFileSync(inputPath, 'utf8');
const rows = parseCsv(csv);
const sql = generateSql(rows);

writeFileSync(outputPath, sql, 'utf8');

console.log(`Read ${rows.length} employees from ${inputPath}`);
console.log(`Wrote ${outputPath}`);
console.log('\nNext:');
console.log('  1. node scripts/create-auth-users.mjs   (or add users manually in Supabase Dashboard)');
console.log('  2. Run bootstrap-generated.sql in Supabase SQL Editor');
