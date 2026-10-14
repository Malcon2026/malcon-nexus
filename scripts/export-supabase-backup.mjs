#!/usr/bin/env node
/**
 * Export critical Supabase data via REST (no Docker pg_dump required).
 * Usage: VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/export-supabase-backup.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvFile(name) {
  const path = resolve(root, name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    if (!process.env[key]) process.env[key] = t.slice(i + 1).trim();
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env or env)');
  process.exit(1);
}

const outDir =
  process.env.BACKUP_DIR ||
  resolve(root, 'backups', `migration-${new Date().toISOString().slice(0, 10)}`);
mkdirSync(outDir, { recursive: true });

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TABLES = [
  'employees',
  'hospitals',
  'doctors',
  'cases',
  'approvals',
  'notifications',
  'activity_log',
  'departments',
  'surgical_kits',
  'attendance_records',
  'attendance_approval_requests',
  'field_team_attendance_approvals',
  'leave_requests',
  'petrol_requests',
  'location_trips',
  'employee_food_selections',
  'case_task_requests',
  'app_settings',
  'login_otps',
  'push_subscriptions',
  'employee_daily_expenses',
  'case_alert_escalations',
  'hospital_trip_punches',
];

const PAGE = 500;

async function fetchAll(table) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function listAuthUsers() {
  const users = [];
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`auth.users: ${error.message}`);
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    phone: u.phone,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    app_metadata: u.app_metadata,
    user_metadata: u.user_metadata,
  }));
}

async function listStorageInventory() {
  const buckets = ['stage-photos', 'attendance-selfies'];
  const inventory = {};
  for (const bucket of buckets) {
    const files = [];
    async function walk(prefix = '') {
      const { data, error } = await sb.storage.from(bucket).list(prefix, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) {
        inventory[bucket] = { error: error.message };
        return;
      }
      for (const item of data ?? []) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id) {
          files.push({ path, ...item });
        } else {
          await walk(path);
        }
      }
    }
    await walk();
    inventory[bucket] = { count: files.length, files };
  }
  return inventory;
}

console.log(`Export directory: ${outDir}\n`);

const manifest = { exportedAt: new Date().toISOString(), url, tables: {}, authUsers: 0 };

for (const table of TABLES) {
  process.stdout.write(`Fetching ${table}... `);
  try {
    const rows = await fetchAll(table);
    writeFileSync(resolve(outDir, `${table}.json`), JSON.stringify(rows, null, 0));
    manifest.tables[table] = rows.length;
    console.log(`${rows.length} rows`);
  } catch (e) {
    manifest.tables[table] = { error: String(e.message || e) };
    console.log(`SKIP (${e.message})`);
  }
}

process.stdout.write('Fetching auth users... ');
try {
  const users = await listAuthUsers();
  writeFileSync(resolve(outDir, 'auth-users.json'), JSON.stringify(users, null, 2));
  manifest.authUsers = users.length;
  console.log(`${users.length} users`);
} catch (e) {
  manifest.authUsers = { error: String(e.message || e) };
  console.log(`FAIL (${e.message})`);
}

process.stdout.write('Listing storage... ');
try {
  const storage = await listStorageInventory();
  writeFileSync(resolve(outDir, 'storage-inventory.json'), JSON.stringify(storage, null, 2));
  const total = Object.values(storage).reduce(
    (n, v) => n + (typeof v.count === 'number' ? v.count : 0),
    0,
  );
  manifest.storageObjects = total;
  console.log(`${total} objects indexed`);
} catch (e) {
  manifest.storageObjects = { error: String(e.message || e) };
  console.log(`FAIL (${e.message})`);
}

writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('\nDone. See manifest.json');
