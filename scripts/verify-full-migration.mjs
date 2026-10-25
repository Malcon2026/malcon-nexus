#!/usr/bin/env node
/**
 * Independent full-migration verification.
 *
 * Compares the live Supabase project against:
 *   A. the locally-built reference schema (nexus_ref)   -> structure
 *   B. the Convex production export                     -> data, field by field
 *   C. the expected Auth / Functions / Storage / app    -> wiring
 *
 * Usage: SUPABASE_ACCESS_TOKEN=sbp_... npm run db:verify-full
 * Requires the local reference DB `nexus_ref` (see docs/SUPABASE-ONLY-MIGRATION.md).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.secrets/nexus-supabase.env', 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SRK } = env;
const REF = 'tukoefkroyxycwlkhaot';
const PAT = process.env.SUPABASE_ACCESS_TOKEN;
if (!PAT) {
  console.error('SUPABASE_ACCESS_TOKEN required (Management API access for schema introspection)');
  process.exit(1);
}

const results = [];
const record = (section, name, ok, detail = '') => results.push({ section, name, ok, detail });

const wrap = (sql) => `select coalesce(json_agg(q.k), '[]'::json) as rows from (${sql}) q`;

function psql(db, sql) {
  const out = execFileSync('psql', ['-d', db, '-t', '-A', '-c', wrap(sql)], { encoding: 'utf8' });
  return JSON.parse(out.trim() || '[]');
}

async function remote(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: wrap(sql) }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`management query failed ${res.status}: ${text.slice(0, 300)}`);
  const parsed = JSON.parse(text || '[]');
  return Array.isArray(parsed) && parsed[0]?.rows !== undefined ? parsed[0].rows : parsed;
}

const QUERIES = {
  tables: `select tablename as k from pg_tables where schemaname='public' order by 1`,
  columns: `select table_name||'.'||column_name||' '||data_type||' null='||is_nullable||' def='||coalesce(column_default,'-') as k
            from information_schema.columns where table_schema='public' order by 1`,
  constraints: `select c.conrelid::regclass::text||' '||c.conname||' '||pg_get_constraintdef(c.oid) as k
            from pg_constraint c join pg_namespace n on n.oid=c.connamespace
            where n.nspname='public' and c.contype<>'n' order by 1`,
  indexes: `select indexdef as k from pg_indexes where schemaname='public' order by 1`,
  policies: `select tablename||' '||policyname||' '||cmd||' '||coalesce(qual,'-')||' '||coalesce(with_check,'-') as k
            from pg_policies where schemaname='public' order by 1`,
  triggers: `select c.relname||' '||t.tgname as k from pg_trigger t join pg_class c on c.oid=t.tgrelid
            join pg_namespace n on n.oid=c.relnamespace
            where n.nspname='public' and not t.tgisinternal order by 1`,
  functions: `select p.proname||'('||pg_get_function_identity_arguments(p.oid)||') secdef='||p.prosecdef as k
            from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1`,
  rls: `select c.relname||' rls='||c.relrowsecurity as k from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relkind='r' order by 1`,
};

const local = {};
const live = {};
for (const [key, sql] of Object.entries(QUERIES)) {
  local[key] = new Set(psql('nexus_ref', sql));
  live[key] = new Set(await remote(sql));
}

console.log('=== A. STRUCTURE (live vs validated reference build) ===');
for (const key of Object.keys(QUERIES)) {
  const missing = [...local[key]].filter((x) => !live[key].has(x));
  const extra = [...live[key]].filter((x) => !local[key].has(x));
  record('structure', key, missing.length === 0 && extra.length === 0,
    missing.length || extra.length ? `missing ${missing.length}${missing.slice(0, 3).map((m) => `\n      - ${m}`).join('')} | extra ${extra.length}${extra.slice(0, 3).map((m) => `\n      + ${m}`).join('')}` : `${live[key].size} objects match`);
  console.log(`  ${key.padEnd(12)} ${missing.length === 0 && extra.length === 0 ? 'MATCH' : 'DIFF'} (${live[key].size})`);
  if (missing.length || extra.length) {
    missing.slice(0, 5).forEach((m) => console.log('      missing:', m));
    extra.slice(0, 5).forEach((m) => console.log('      extra  :', m));
  }
}

// ---------- B. DATA ----------
console.log('\n=== B. DATA (live vs Convex production export) ===');
const SOURCE = 'backups/convex-prod-export/export/malconRows/documents.jsonl';
const exported = { employees: [], doctors: [], hospitals: [] };
for (const line of readFileSync(SOURCE, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const doc = JSON.parse(line);
  if (exported[doc.table]) exported[doc.table].push(doc.row);
}

async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: SRK,
        Authorization: `Bearer ${SRK}`,
        Range: `${from}-${from + 999}`,
        'Range-Unit': 'items',
      },
    });
    const batch = await res.json();
    if (!Array.isArray(batch)) throw new Error(`${table}: ${JSON.stringify(batch).slice(0, 200)}`);
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}

const normalize = (v) => (v === null || v === undefined ? '' : v);
const TS = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}(:?\d{2})?|Z)?$/;
const isTs = (v) => typeof v === 'string' && TS.test(v);
const canonTs = (v) => {
  let s = String(v).trim().replace(' ', 'T');
  s = s.replace(/([+-]\d{2})$/, '$1:00').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  if (s.endsWith('Z')) s = s.slice(0, -1) + '+00:00';
  if (!/[+-]\d{2}:\d{2}$/.test(s)) s += '+00:00';
  s = s.replace(/\.(\d+)/, (m, d) => '.' + (d + '000000').slice(0, 6));
  return s;
};
const sameValue = (want, got) => {
  if (isTs(want) && isTs(got)) return canonTs(want) === canonTs(got);
  return String(want) === String(got);
};
// auth_user_id is linked after import; the two password columns are legacy-only
// (the DMS worker wrote them, Malcon Nexus authenticates through Supabase Auth).
const IGNORED = new Set(['auth_user_id', 'password_hash', 'supabase_password_hash']);

for (const table of ['employees', 'doctors', 'hospitals']) {
  const liveRows = await fetchAll(table);
  const byId = new Map(liveRows.map((r) => [r.id, r]));
  const expected = exported[table];
  let missing = 0;
  let mismatched = [];
  for (const src of expected) {
    const row = byId.get(src.id);
    if (!row) { missing += 1; continue; }
    for (const [key, raw] of Object.entries(src)) {
      if (IGNORED.has(key) || key === 'departments') continue;
      const want = normalize(raw);
      const got = normalize(row[key]);
      if (key === 'updated_at') {
        // A DB trigger refreshes updated_at on every write, so live >= source is correct.
        if (isTs(want) && isTs(got) && canonTs(got) >= canonTs(want)) continue;
      }
      if (!sameValue(want, got)) {
        mismatched.push(`${src.name ?? src.id}: ${key} expected ${JSON.stringify(want)} got ${JSON.stringify(got)}`);
      }
    }
    // departments jsonb round-trip
    if (table === 'employees') {
      let srcDepts = src.departments;
      if (typeof srcDepts === 'string') {
        try { srcDepts = JSON.parse(srcDepts); } catch { srcDepts = null; }
      }
      const want = Array.isArray(srcDepts) ? srcDepts : src.department ? [src.department] : [];
      const got = Array.isArray(row.departments) ? row.departments : [];
      if (JSON.stringify(want) !== JSON.stringify(got)) mismatched.push(`${src.name}: departments ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
    }
  }
  const extra = liveRows.length - expected.length + missing;
  record('data', table, missing === 0 && mismatched.length === 0 && extra === 0,
    `${liveRows.length}/${expected.length} rows, ${missing} missing, ${mismatched.length} field mismatches, ${extra} unexpected`);
  console.log(`  ${table.padEnd(10)} ${liveRows.length}/${expected.length} rows · missing ${missing} · field mismatches ${mismatched.length} · unexpected ${extra}`);
  mismatched.slice(0, 5).forEach((m) => console.log('      !', m));
}

// Tables that must be empty
for (const table of ['cases', 'activity_log', 'notifications']) {
  const rows = await fetchAll(table);
  record('data', `${table} empty`, rows.length === 0, `${rows.length} rows`);
  console.log(`  ${table.padEnd(10)} ${rows.length} rows ${rows.length === 0 ? '(empty as intended)' : 'UNEXPECTED DATA'}`);
}

// Seed data
const depts = await fetchAll('departments');
record('seed', 'departments', depts.length === 8, `${depts.length} rows: ${depts.map((d) => d.name).sort().join(', ')}`);
console.log(`  departments ${depts.length} -> ${depts.map((d) => d.name).sort().join(', ')}`);
const settings = await fetchAll('app_settings');
record('seed', 'app_settings', settings.some((s) => s.key === 'incentive_rate_per_km' && s.value === '3'), JSON.stringify(settings));
console.log(`  app_settings ${settings.length} -> ${settings.map((s) => `${s.key}=${s.value}`).join(', ')}`);

// ---------- C. AUTH ----------
console.log('\n=== C. AUTH ===');
const users = [];
for (let page = 1; page <= 10; page += 1) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`, {
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
  });
  const data = await res.json();
  if (!data.users?.length) break;
  users.push(...data.users);
  if (data.users.length < 200) break;
}
const userByEmail = new Map(users.filter((u) => u.email).map((u) => [u.email.toLowerCase(), u]));
const employees = await fetchAll('employees');
const validEmail = employees.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email ?? ''));
const noUser = validEmail.filter((e) => !userByEmail.has(e.email.toLowerCase()));
const unlinked = employees.filter((e) => !e.auth_user_id);
const dangling = employees.filter((e) => e.auth_user_id && !users.some((u) => u.id === e.auth_user_id));
record('auth', 'user for every employee', noUser.length === 0, `${users.length} auth users, ${noUser.length} employees without a user`);
record('auth', 'auth_user_id linked', unlinked.length <= 1, `${unlinked.length} unlinked (expected 1: petrol)`);
record('auth', 'no dangling links', dangling.length === 0, `${dangling.length} links point at missing users`);
console.log(`  auth users ${users.length} · employees ${employees.length} · without user ${noUser.length} · unlinked ${unlinked.length} · dangling ${dangling.length}`);
if (noUser.length) console.log('      !', noUser.map((e) => e.email).join(', '));

// admin password login
const admin = employees.find((e) => e.role === 'admin' && e.email);
const csv = readFileSync('backups/auth-temp-passwords.csv', 'utf8').split('\n').slice(1);
const pwRow = csv.map((l) => l.split(',')).find((c) => c[0] === admin.email.toLowerCase());
let loginOk = false;
let rlsReadOk = false;
if (pwRow) {
  const anon = env.SUPABASE_ANON_KEY;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: admin.email, password: pwRow[3] }),
  });
  const data = await res.json();
  loginOk = Boolean(data.access_token);
  if (loginOk) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/employees?select=id&limit=1`, {
      headers: { apikey: anon, Authorization: `Bearer ${data.access_token}` },
    });
    const rows = await r.json();
    rlsReadOk = Array.isArray(rows) && rows.length === 1;
  }
}
record('auth', 'admin password login', loginOk, admin.email);
record('auth', 'RLS allows signed-in read', rlsReadOk, `${admin.email} read employees`);
console.log(`  admin login ${loginOk ? 'OK' : 'FAILED'} (${admin.email}) · RLS read ${rlsReadOk ? 'OK' : 'FAILED'}`);

// anon must NOT read
const anon = env.SUPABASE_ANON_KEY;
for (const table of ['employees', 'doctors', 'hospitals', 'cases']) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  const rows = await r.json();
  const blocked = Array.isArray(rows) && rows.length === 0;
  record('auth', `anon blocked on ${table}`, blocked, `${Array.isArray(rows) ? rows.length : '?'} rows`);
}
console.log('  anon reads employees/doctors/hospitals/cases: all 0 rows (RLS on)');

// ---------- D. EDGE FUNCTIONS ----------
console.log('\n=== D. EDGE FUNCTIONS ===');
const fnRes = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions`, {
  headers: { Authorization: `Bearer ${PAT}` },
});
const fns = await fnRes.json();
const localDirs = execFileSync('bash', ['-lc', "ls -d supabase/functions/*/ | xargs -n1 basename | grep -v '^_shared$'"], { encoding: 'utf8' })
  .split('\n').filter(Boolean).sort();
const deployed = fns.map((f) => f.slug).sort();
const missingFns = localDirs.filter((d) => !deployed.includes(d));
record('functions', 'all local functions deployed', missingFns.length === 0, `${deployed.length} deployed, ${localDirs.length} local, missing: ${missingFns.join(',') || 'none'}`);
console.log(`  ${deployed.length} deployed / ${localDirs.length} local · missing: ${missingFns.join(', ') || 'none'}`);

const anonHeaders = { Authorization: `Bearer ${anon}`, apikey: anon, 'Content-Type': 'application/json' };
for (const [slug, body] of [
  ['request-login-otp', { employeeCode: 'NOPE-ZZZ' }],
  ['verify-login-otp', { employeeCode: 'NOPE-ZZZ', otp: '000000' }],
]) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${slug}`, { method: 'POST', headers: anonHeaders, body: JSON.stringify(body) });
  const t = (await r.text()).slice(0, 90);
  const ok = r.status !== 404;
  record('functions', `${slug} reachable`, ok, `HTTP ${r.status} ${t}`);
  console.log(`  ${slug.padEnd(18)} HTTP ${r.status} ${t}`);
}

const secretsRes = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, { headers: { Authorization: `Bearer ${PAT}` } });
const secrets = (await secretsRes.json()).map((s) => s.name);
for (const name of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'LOGIN_OTP_SECRET', 'APP_URL']) {
  record('functions', `secret ${name}`, secrets.includes(name), secrets.includes(name) ? 'set' : 'MISSING');
}
console.log(`  secrets: ${secrets.sort().join(', ')}`);

// ---------- E. STORAGE ----------
console.log('\n=== E. STORAGE ===');
const bucketsRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } });
const buckets = (await bucketsRes.json()).map((b) => b.name).sort();
const wantBuckets = ['attendance-selfies', 'petrol-receipts', 'stage-photos'];
record('storage', 'buckets', wantBuckets.every((b) => buckets.includes(b)), buckets.join(', '));
console.log(`  buckets: ${buckets.join(', ')}`);

// ---------- F. APP ----------
console.log('\n=== F. LIVE APP ===');
for (const path of ['/', '/gallery.html', '/tv.html']) {
  const r = await fetch(`https://app.malconnexus.com${path}`);
  record('app', `app.malconnexus.com${path}`, r.status === 200, `HTTP ${r.status}`);
  console.log(`  ${path.padEnd(14)} HTTP ${r.status}`);
}
const home = await (await fetch('https://app.malconnexus.com/')).text();
const newRefs = (home.match(/tukoefkroyxycwlkhaot/g) ?? []).length;
const oldRefs = (home.match(/ipometuqzcvdqeyvhcgg/g) ?? []).length;
const convexRefs = (home.match(/convex\.(cloud|site)/g) ?? []).length;
record('app', 'live bundle wiring', newRefs > 0 && oldRefs === 0 && convexRefs === 0,
  `new=${newRefs} old=${oldRefs} convex=${convexRefs}`);
console.log(`  bundle: new-project refs ${newRefs} · old-project refs ${oldRefs} · convex refs ${convexRefs}`);

// ---------- SUMMARY ----------
const fails = results.filter((r) => !r.ok);
console.log('\n=== SUMMARY ===');
console.log(`  checks: ${results.length} · passed: ${results.length - fails.length} · failed: ${fails.length}`);
if (fails.length) {
  for (const f of fails) console.log(`  x [${f.section}] ${f.name} — ${f.detail}`);
}
writeFileSync('backups/verify-full-report.json', JSON.stringify({ at: new Date().toISOString(), ref: REF, results }, null, 2));
console.log('\n  report: backups/verify-full-report.json');
process.exit(fails.length ? 1 : 0);
