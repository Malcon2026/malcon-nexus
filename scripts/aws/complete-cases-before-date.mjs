#!/usr/bin/env node
/**
 * Mark in-progress cases as Completed through an IST calendar cutoff (inclusive).
 * Default cutoff = yesterday IST. Requires DATABASE_URL (RDS).
 *
 *   node scripts/aws/complete-cases-before-date.mjs
 *   node scripts/aws/complete-cases-before-date.mjs --execute
 *   CUTOFF_DATE=2026-10-14 node scripts/aws/complete-cases-before-date.mjs --execute
 */
import pg from 'pg';
import { createPgPoolOptions } from './pg-connection.mjs';

const execute = process.argv.includes('--execute');

function getISTDateKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function addDaysToDateKey(dateKey, delta) {
  const d = new Date(`${dateKey}T12:00:00+05:30`);
  d.setDate(d.getDate() + delta);
  return getISTDateKey(d);
}

const cutoff =
  process.env.CUTOFF_DATE?.trim() ||
  addDaysToDateKey(getISTDateKey(), -1);
const todayKey = getISTDateKey();
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new pg.Pool(createPgPoolOptions(connectionString));

const previewSql = `
  SELECT status, COUNT(*)::int AS c
  FROM cases
  WHERE status NOT IN ('Completed', 'Cancelled')
    AND (
      (NULLIF(trim(surgery_date), '') IS NOT NULL AND left(trim(surgery_date), 10) <= $1)
      OR (NULLIF(trim(surgery_date), '') IS NULL AND left(trim(updated_at), 10) <= $1)
    )
  GROUP BY status
  ORDER BY status
`;

const updateSql = `
  UPDATE cases
  SET
    status = 'Completed',
    current_stage = 'Completed',
    current_department = NULL,
    assigned_employee_id = NULL,
    assigned_employee_snapshot = NULL,
    updated_at = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')
  WHERE status NOT IN ('Completed', 'Cancelled')
    AND (
      (NULLIF(trim(surgery_date), '') IS NOT NULL AND left(trim(surgery_date), 10) <= $1)
      OR (NULLIF(trim(surgery_date), '') IS NULL AND left(trim(updated_at), 10) <= $1)
    )
`;

try {
  console.log(`IST today: ${todayKey}`);
  console.log(`Cutoff (surgery date <=): ${cutoff}`);
  const preview = await pool.query(previewSql, [cutoff]);
  const total = preview.rows.reduce((n, r) => n + r.c, 0);
  console.log('Cases to mark Completed:', preview.rows, `total=${total}`);

  if (!execute) {
    console.log('\nDry run only. Pass --execute to apply.');
    process.exit(0);
  }

  const res = await pool.query(updateSql, [cutoff]);
  console.log(`Updated ${res.rowCount} case(s) to Completed.`);

  const remain = await pool.query(
    `SELECT status, COUNT(*)::int c FROM cases WHERE status NOT IN ('Completed','Cancelled') GROUP BY 1`,
  );
  console.log('Remaining non-terminal:', remain.rows);
} finally {
  await pool.end();
}
