#!/usr/bin/env node
/**
 * Export Supabase data via `supabase db query --linked` (works when REST API is egress-blocked).
 *
 * Prerequisites: npx supabase link --project-ref <old-ref> --yes
 *
 *   node scripts/export-supabase-backup-sql.mjs
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const outDir =
  process.env.BACKUP_DIR ||
  resolve(root, 'backups', `migration-${new Date().toISOString().slice(0, 10)}`);
mkdirSync(outDir, { recursive: true });

const PAGE = Number(process.env.BACKUP_PAGE_SIZE || 200);
/** Comma-separated table names to skip (e.g. activity_log). */
const SKIP = new Set(
  (process.env.BACKUP_SKIP_TABLES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
/** When set, skip noisy / non-critical tables for faster emergency export. */
const ESSENTIAL_ONLY = process.env.BACKUP_ESSENTIAL === '1';
const RESUME = process.env.BACKUP_RESUME === '1';
const ESSENTIAL_SKIP = new Set([
  'notifications',
  'activity_log',
  'malcon_tms_activity',
  'malcon_tms_profiles',
  'malcon_tms_tasks',
  'hr_walk_in_applications',
  'hr_kyc_intake',
  'hr_onboarding_tracks',
  'hr_job_postings',
  'case_alert_escalations',
]);
const queryDir = mkdtempSync(join(tmpdir(), 'malcon-sql-'));

function runQuery(sql) {
  const file = join(queryDir, `q-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  writeFileSync(file, sql.trim() + '\n');
  const raw = execSync(`npx supabase db query --linked -f ${JSON.stringify(file)}`, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 512,
  });
  const start = raw.indexOf('{');
  if (start < 0) throw new Error('No JSON in supabase db query output');
  const parsed = JSON.parse(raw.slice(start));
  return parsed.rows ?? [];
}

function escIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function listPublicTables() {
  const rows = runQuery(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
    order by table_name;
  `);
  return rows.map((r) => r.table_name);
}

function pageSizeFor(table) {
  if (table === 'cases') return Number(process.env.BACKUP_CASES_PAGE_SIZE || 12);
  if (table === 'attendance_records') return Number(process.env.BACKUP_ATTENDANCE_PAGE_SIZE || 80);
  return PAGE;
}

function exportTable(table) {
  const qTable = escIdent(table);
  const page = pageSizeFor(table);
  const countRows = runQuery(`select count(*)::int as c from public.${qTable};`);
  const total = countRows[0]?.c ?? 0;
  if (total === 0) {
    writeFileSync(resolve(outDir, `${table}.json`), '[]');
    return { table, rows: 0 };
  }

  const all = [];
  for (let offset = 0; offset < total; offset += page) {
    const batch = runQuery(`
      select coalesce(json_agg(row_to_json(t)), '[]'::json) as data
      from (
        select * from public.${qTable}
        order by 1
        limit ${page} offset ${offset}
      ) t;
    `);
    const chunk = batch[0]?.data;
    if (Array.isArray(chunk)) all.push(...chunk);
    process.stdout.write(`  ${table}: ${Math.min(offset + page, total)}/${total}\r`);
  }
  process.stdout.write('\n');
  writeFileSync(resolve(outDir, `${table}.json`), JSON.stringify(all));
  return { table, rows: all.length };
}

function exportAuthUsers() {
  const count = runQuery(`select count(*)::int as c from auth.users;`)[0]?.c ?? 0;
  if (!count) {
    writeFileSync(resolve(outDir, 'auth-users.json'), '[]');
    return 0;
  }
  const rows = runQuery(`
    select coalesce(json_agg(row_to_json(u)), '[]'::json) as data
    from (
      select id, email, phone, created_at, updated_at, last_sign_in_at,
             raw_app_meta_data, raw_user_meta_data, is_super_admin, role
      from auth.users
      order by created_at
    ) u;
  `);
  const data = rows[0]?.data ?? [];
  writeFileSync(resolve(outDir, 'auth-users.json'), JSON.stringify(data));
  return data.length;
}

function exportStorageMeta() {
  try {
    const rows = runQuery(`
      select coalesce(json_agg(row_to_json(o)), '[]'::json) as data
      from (
        select id, bucket_id, name, owner, created_at, updated_at, metadata
        from storage.objects
        order by created_at
      ) o;
    `);
    const data = rows[0]?.data ?? [];
    writeFileSync(resolve(outDir, 'storage-objects.json'), JSON.stringify(data));
    return data.length;
  } catch (e) {
    writeFileSync(
      resolve(outDir, 'storage-objects.json'),
      JSON.stringify({ error: String(e.message || e) }),
    );
    return 0;
  }
}

const linkedRef = resolve(root, 'supabase/.temp/project-ref');
if (!existsSync(linkedRef)) {
  console.error('Run: npx supabase link --project-ref iaxkbiejmwnstckiggwg --yes');
  process.exit(1);
}
const projectRef = readFileSync(linkedRef, 'utf8').trim();
console.log(`Export via SQL → ${outDir}`);
console.log(`Linked project: ${projectRef}\n`);

const manifest = {
  exportedAt: new Date().toISOString(),
  projectRef,
  method: 'supabase db query --linked',
  tables: {},
};

const tables = listPublicTables();
console.log(`Public tables: ${tables.length}\n`);

const priority = [
  'cases',
  'employees',
  'hospitals',
  'doctors',
  'approvals',
  'departments',
  'surgical_kits',
  'notifications',
  'attendance_records',
  'leave_requests',
  'petrol_requests',
  'location_trips',
  'case_task_requests',
  'app_settings',
  'login_otps',
  'push_subscriptions',
];
const ordered = [
  ...priority.filter((t) => tables.includes(t)),
  ...tables.filter((t) => !priority.includes(t)),
];

for (const table of ordered) {
  if (SKIP.has(table) || (ESSENTIAL_ONLY && ESSENTIAL_SKIP.has(table))) {
    manifest.tables[table] = 'skipped';
    console.log(`${table}... skipped`);
    continue;
  }
  const outFile = resolve(outDir, `${table}.json`);
  if (RESUME && existsSync(outFile) && readFileSync(outFile, 'utf8').length > 2) {
    try {
      const n = JSON.parse(readFileSync(outFile, 'utf8')).length;
      manifest.tables[table] = n;
      console.log(`${table}... resume (${n} rows on disk)`);
      continue;
    } catch {
      /* re-export */
    }
  }
  process.stdout.write(`${table}... `);
  try {
    const r = exportTable(table);
    manifest.tables[table] = r.rows;
    console.log(`${r.rows} rows`);
  } catch (e) {
    manifest.tables[table] = { error: String(e.message || e) };
    console.log(`FAIL (${e.message})`);
  }
}

process.stdout.write('auth.users... ');
manifest.authUsers = exportAuthUsers();
console.log(`${manifest.authUsers} users`);

process.stdout.write('storage.objects... ');
manifest.storageObjects = exportStorageMeta();
console.log(`${manifest.storageObjects} objects`);

writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
try {
  rmSync(queryDir, { recursive: true, force: true });
} catch {
  /* ignore */
}
console.log('\nDone.');
