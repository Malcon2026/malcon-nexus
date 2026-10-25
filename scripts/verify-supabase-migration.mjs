import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function argValue(flag, fallback) {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const i = args.indexOf(flag);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
  return fallback;
}

for (const file of ['.env.local', '.env']) {
  const p = resolve(root, file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!(k in process.env)) process.env[k] = v;
  }
}

const url = argValue('--url', process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const key = argValue('--service-key', process.env.SUPABASE_SERVICE_ROLE_KEY);
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const EXPECTED = { employees: 46, doctors: 123, hospitals: 93 };
const REQUIRED_TABLES = [
  'employees', 'doctors', 'hospitals', 'departments', 'cases', 'approvals', 'activity_log',
  'notifications', 'attendance_records', 'attendance_approval_requests', 'leave_requests',
  'petrol_requests', 'location_trips', 'employee_daily_expenses', 'employee_food_selections',
  'case_task_requests', 'case_alert_escalations', 'field_team_attendance_approvals',
  'surgical_kits', 'app_settings', 'login_otps', 'push_subscriptions', 'hospital_trip_punches',
];

const problems = [];
const notes = [];

for (const table of REQUIRED_TABLES) {
  const { error } = await sb.from(table).select('*', { head: true, count: 'exact' }).limit(1);
  if (error) {
    problems.push(
      `table ${table}: ${error.message || error.code || 'unknown error'}${error.code ? ` (${error.code})` : ''}`,
    );
  }
}

for (const [table, expected] of Object.entries(EXPECTED)) {
  const { count, error } = await sb.from(table).select('*', { head: true, count: 'exact' });
  if (error) {
    problems.push(`count ${table}: ${error.message}`);
    continue;
  }
  if (count !== expected) notes.push(`${table}: ${count} rows (expected ${expected})`);
}

const { count: deptCount } = await sb.from('departments').select('*', { head: true, count: 'exact' });
if (!deptCount) problems.push('departments is empty (run the schema seed)');

const { data: employees, error: empErr } = await sb
  .from('employees')
  .select('id,email,auth_user_id,role,status');
if (empErr) problems.push(`employees: ${empErr.message}`);

if (employees) {
  const unlinked = employees.filter((e) => !e.auth_user_id);
  if (unlinked.length) notes.push(`${unlinked.length} employees without auth_user_id`);

  const { data: authList, error: authErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authErr) problems.push(`auth listUsers: ${authErr.message}`);
  const authIds = new Set((authList?.users ?? []).map((u) => u.id));
  const dangling = employees.filter((e) => e.auth_user_id && !authIds.has(e.auth_user_id));
  if (dangling.length) problems.push(`${dangling.length} employees point at missing auth users`);

  const roles = [...new Set(employees.map((e) => e.role))].sort();
  notes.push(`roles: ${roles.join(', ')}`);
}

const { count: dmsDoctors } = await sb.from('dms_doctors').select('*', { head: true, count: 'exact' });
const { count: dmsHospitals } = await sb.from('dms_hospitals').select('*', { head: true, count: 'exact' });
if (dmsDoctors !== null || dmsHospitals !== null) {
  notes.push(`DMS tables moved: dms_doctors (${dmsDoctors ?? '?'}) / dms_hospitals (${dmsHospitals ?? '?'})`);
}

console.log(`Supabase: ${url}`);
console.log('');
if (notes.length) {
  console.log('Notes:');
  for (const n of notes) console.log(`  - ${n}`);
  console.log('');
}
if (problems.length) {
  console.log('PROBLEMS:');
  for (const p of problems) console.log(`  x ${p}`);
  process.exit(1);
}
console.log('All checks passed.');

const out = resolve(root, 'backups/supabase-migration-verify.json');
writeFileSync(out, JSON.stringify({ url, at: new Date().toISOString(), notes, problems }, null, 2));
console.log(`Report written to ${out}`);
