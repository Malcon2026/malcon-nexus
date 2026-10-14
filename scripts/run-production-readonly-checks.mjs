#!/usr/bin/env node
/**
 * Phase 4.7 — Run read-only production checks via `supabase db query --linked`.
 * SELECT / catalog queries only.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const date = process.env.CHECK_DATE || new Date().toISOString().slice(0, 10);
const outDir = resolve(root, 'backups', `production-checks-${date}`);
const tmpDir = mkdtempSync(join(tmpdir(), 'malcon-prod-check-'));

function runQuery(sql, label) {
  const file = join(tmpDir, `${label.replace(/\W+/g, '_')}.sql`);
  writeFileSync(file, sql.trim() + '\n');
  const raw = execSync(`npx supabase db query --linked -f ${JSON.stringify(file)}`, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
  });
  const start = raw.indexOf('{');
  if (start < 0) throw new Error(`No JSON for ${label}: ${raw.slice(0, 500)}`);
  const parsed = JSON.parse(raw.slice(start));
  return parsed.rows ?? [];
}

function section(title, rows) {
  const line = `\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}\n`;
  return line + JSON.stringify(rows, null, 2) + '\n';
}

mkdirSync(outDir, { recursive: true });

const rowCountsParts = [];
const ddlParts = [];

console.log(`Output directory: ${outDir}\n`);

// --- Row counts bundle ---
rowCountsParts.push(section('1) Approximate row counts (pg_stat_user_tables, public)', runQuery(`
SELECT schemaname AS schema, relname AS table_name, n_live_tup AS approx_row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC, relname;
`, 'rc1_pg_stat')));

const publicTables = runQuery(`
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
`, 'rc5_public_tables');

rowCountsParts.push(section('4) Complete list of public base tables', publicTables));

const exactCounts = [];
for (const { table_name } of publicTables) {
  const safe = String(table_name).replace(/"/g, '""');
  try {
    const rows = runQuery(`SELECT COUNT(*)::bigint AS row_count FROM public."${safe}";`, `count_${safe}`);
    exactCounts.push({ table_name, row_count: rows[0]?.row_count ?? null, status: 'ok' });
    process.stdout.write(`  COUNT ${table_name}: ${rows[0]?.row_count}\n`);
  } catch (e) {
    exactCounts.push({ table_name, row_count: null, status: 'error', error: String(e.message || e).slice(0, 200) });
    process.stdout.write(`  COUNT ${table_name}: ERROR\n`);
  }
}
rowCountsParts.push(section('2) Exact row counts (COUNT(*) per public table)', exactCounts));

rowCountsParts.push(section('3) Table sizes (pg_total_relation_size)', runQuery(`
SELECT c.relname AS table_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  pg_total_relation_size(c.oid) AS total_bytes
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC;
`, 'rc3_sizes')));

rowCountsParts.push(section('4b) Cases JSON payload sizes', runQuery(`
SELECT COUNT(*) AS case_count,
  pg_size_pretty(SUM(pg_column_size(stages))::bigint) AS stages_bytes_sum,
  pg_size_pretty(MAX(pg_column_size(stages))::bigint) AS max_stages_bytes,
  pg_size_pretty((AVG(pg_column_size(stages)))::bigint) AS avg_stages_bytes
FROM cases;
`, 'rc4_cases_json')));

try {
  rowCountsParts.push(section('5) Storage object counts by bucket', runQuery(`
SELECT bucket_id, COUNT(*) AS object_count
FROM storage.objects
GROUP BY bucket_id
ORDER BY object_count DESC;
`, 'rc7_storage')));
} catch (e) {
  rowCountsParts.push(section('5) Storage object counts by bucket', [{ error: String(e.message || e) }]));
}

const rowCountsFull = rowCountsParts.join('');
writeFileSync(join(outDir, 'production-row-counts-full.txt'), rowCountsFull);

// --- HR/TMS DDL bundle ---
const hrTables = [
  'hr_walk_in_applications',
  'hr_kyc_intake',
  'hr_onboarding_tracks',
  'hr_job_postings',
  'malcon_tms_profiles',
  'malcon_tms_tasks',
  'malcon_tms_activity',
];

ddlParts.push(section('0) HR/TMS table existence', runQuery(`
WITH expected(table_name) AS (
  VALUES
    ('hr_walk_in_applications'), ('hr_kyc_intake'), ('hr_onboarding_tracks'),
    ('hr_job_postings'), ('malcon_tms_profiles'), ('malcon_tms_tasks'), ('malcon_tms_activity')
)
SELECT e.table_name,
  CASE WHEN t.table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM expected e
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = e.table_name AND t.table_type = 'BASE TABLE'
ORDER BY e.table_name;
`, 'ddl0_exists')));

ddlParts.push(section('1) HR/TMS columns', runQuery(`
SELECT c.table_name, c.ordinal_position AS pos, c.column_name, c.data_type, c.udt_name,
  c.character_maximum_length, c.numeric_precision, c.numeric_scale,
  c.is_nullable, c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (${hrTables.map((t) => `'${t}'`).join(', ')})
ORDER BY c.table_name, c.ordinal_position;
`, 'ddl1_columns')));

ddlParts.push(section('2) HR/TMS PRIMARY KEY and UNIQUE', runQuery(`
SELECT tc.table_name, tc.constraint_type, tc.constraint_name, kcu.column_name, kcu.ordinal_position
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
  AND tc.table_name IN (${hrTables.map((t) => `'${t}'`).join(', ')})
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;
`, 'ddl2_pk_unique')));

ddlParts.push(section('3) HR/TMS FOREIGN KEYs', runQuery(`
SELECT tc.table_name AS child_table, kcu.column_name AS child_column,
  ccu.table_name AS parent_table, ccu.column_name AS parent_column,
  tc.constraint_name, rc.update_rule, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.constraint_schema AND tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_schema = rc.constraint_schema AND tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_schema = ccu.constraint_schema AND rc.unique_constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN (${hrTables.map((t) => `'${t}'`).join(', ')})
ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;
`, 'ddl3_fk')));

ddlParts.push(section('4) HR/TMS CHECK constraints', runQuery(`
SELECT n.nspname AS schema_name, t.relname AS table_name, con.conname AS constraint_name,
  pg_get_constraintdef(con.oid, true) AS check_definition
FROM pg_constraint con
JOIN pg_class t ON t.oid = con.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND con.contype = 'c'
  AND t.relname IN (${hrTables.map((t) => `'${t}'`).join(', ')})
ORDER BY t.relname, con.conname;
`, 'ddl4_check')));

ddlParts.push(section('5) HR/TMS indexes', runQuery(`
SELECT schemaname, tablename AS table_name, indexname AS index_name, indexdef AS index_definition
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (${hrTables.map((t) => `'${t}'`).join(', ')})
ORDER BY tablename, indexname;
`, 'ddl5_indexes')));

ddlParts.push(section('6) HR/TMS approximate row counts', runQuery(`
WITH expected(table_name) AS (
  VALUES
    ('hr_walk_in_applications'), ('hr_kyc_intake'), ('hr_onboarding_tracks'),
    ('hr_job_postings'), ('malcon_tms_profiles'), ('malcon_tms_tasks'), ('malcon_tms_activity')
)
SELECT e.table_name, COALESCE(s.n_live_tup, 0) AS approx_row_count,
  CASE WHEN s.relname IS NULL THEN 'no stat (missing or never analyzed)' ELSE 'ok' END AS stat_note
FROM expected e
LEFT JOIN pg_stat_user_tables s ON s.schemaname = 'public' AND s.relname = e.table_name
ORDER BY e.table_name;
`, 'ddl6_hr_counts')));

for (const t of hrTables) {
  try {
    const rows = runQuery(`SELECT COUNT(*)::bigint AS row_count FROM public."${t}";`, `hr_exact_${t}`);
    ddlParts.push(section(`6b) Exact COUNT(*) — ${t}`, rows));
  } catch (e) {
    ddlParts.push(section(`6b) Exact COUNT(*) — ${t}`, [{ error: String(e.message || e).slice(0, 300) }]));
  }
}

ddlParts.push(section('7) HR/TMS RLS status', runQuery(`
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN (${hrTables.map((t) => `'${t}'`).join(', ')})
ORDER BY c.relname;
`, 'ddl7_rls')));

const ddlFull = ddlParts.join('');
writeFileSync(join(outDir, 'production-ddl-full.txt'), ddlFull);

writeFileSync(
  join(outDir, 'production-check-meta.json'),
  JSON.stringify({ collectedAt: new Date().toISOString(), projectLinked: true, outDir }, null, 2),
);

try {
  rmSync(tmpDir, { recursive: true, force: true });
} catch {
  /* ignore */
}

console.log('\nWrote production-row-counts-full.txt and production-ddl-full.txt');
