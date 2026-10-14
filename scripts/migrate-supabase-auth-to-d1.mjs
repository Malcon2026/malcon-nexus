#!/usr/bin/env node
/**
 * Copy Supabase Auth password hashes + auth_user_id onto production D1 employees.
 * Does NOT read plaintext passwords — only GoTrue bcrypt hashes (same as Supabase login).
 *
 * Requires (in .env / .env.local):
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 *   node scripts/migrate-supabase-auth-to-d1.mjs
 *   node scripts/migrate-supabase-auth-to-d1.mjs --dry-run
 *   node scripts/migrate-supabase-auth-to-d1.mjs --remote
 *
 * Password hashes are NOT exposed via the Auth Admin API — export from SQL when the
 * project is available (Dashboard → SQL):
 *   SELECT id, email, encrypted_password FROM auth.users;
 * Save as CSV with header id,email,encrypted_password and run:
 *   node scripts/migrate-supabase-auth-to-d1.mjs --from-csv=backups/auth-users.csv --remote
 *
 * Optional: --sync-auth-ids-only uses Admin API to set employees.auth_user_id by email (no passwords).
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const remote = process.argv.includes('--remote');
const syncIdsOnly = process.argv.includes('--sync-auth-ids-only');
const csvArg = process.argv.find((a) => a.startsWith('--from-csv='));
const csvPath = csvArg ? csvArg.slice('--from-csv='.length) : null;

function loadEnv() {
  for (const f of ['.env', '.env.local']) {
    const p = resolve(root, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0 && !process.env[t.slice(0, i).trim()]) {
        process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

loadEnv();

function sqlEscape(s) {
  return String(s).replace(/'/g, "''");
}

async function listSupabaseAuthUsers() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or use --from-csv=...)');
    process.exit(1);
  }
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const users = [];
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    users.push(...(data.users ?? []));
    if ((data.users ?? []).length < perPage) break;
    page += 1;
  }
  return users.map((u) => ({
    id: u.id,
    email: (u.email ?? '').trim().toLowerCase(),
    encrypted_password: null,
  }));
}

function loadCsv(path) {
  const text = readFileSync(resolve(root, path), 'utf8');
  const lines = text.split('\n').filter((l) => l.trim());
  const header = lines[0].split(',').map((h) => h.trim());
  const idIdx = header.indexOf('id');
  const emailIdx = header.indexOf('email');
  const passIdx = header.indexOf('encrypted_password');
  if (emailIdx < 0 || passIdx < 0) {
    throw new Error('CSV needs columns: id, email, encrypted_password');
  }
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    return {
      id: idIdx >= 0 ? cols[idIdx]?.trim() : '',
      email: cols[emailIdx]?.trim().toLowerCase() ?? '',
      encrypted_password: cols[passIdx]?.trim() ?? '',
    };
  });
}

async function main() {
  let users;
  if (csvPath) {
    users = loadCsv(csvPath);
    console.info(`Loaded ${users.length} rows from ${csvPath}`);
  } else if (syncIdsOnly) {
    console.info('Fetching Supabase auth users (auth_user_id sync only)…');
    users = await listSupabaseAuthUsers();
    console.info(`Fetched ${users.length} auth users`);
  } else {
    console.error(
      'Pass --from-csv=backups/auth-users.csv (from SQL export) or --sync-auth-ids-only for id mapping only.',
    );
    process.exit(1);
  }

  const statements = [];
  let skipped = 0;
  for (const u of users) {
    if (!u.email) {
      skipped += 1;
      continue;
    }
    if (syncIdsOnly && !csvPath) {
      if (!u.id) {
        skipped += 1;
        continue;
      }
      const email = sqlEscape(u.email);
      const authId = sqlEscape(u.id);
      statements.push(
        `UPDATE employees SET auth_user_id = COALESCE(auth_user_id, '${authId}'), updated_at = datetime('now') WHERE lower(email) = '${email}';`,
      );
      continue;
    }
    if (!u.encrypted_password?.startsWith('$2')) {
      skipped += 1;
      continue;
    }
    const email = sqlEscape(u.email);
    const hash = sqlEscape(u.encrypted_password);
    const authId = u.id ? sqlEscape(u.id) : null;
    if (authId) {
      statements.push(
        `UPDATE employees SET supabase_password_hash = '${hash}', auth_user_id = COALESCE(auth_user_id, '${authId}'), updated_at = datetime('now') WHERE lower(email) = '${email}';`,
      );
    } else {
      statements.push(
        `UPDATE employees SET supabase_password_hash = '${hash}', updated_at = datetime('now') WHERE lower(email) = '${email}';`,
      );
    }
  }

  console.info(`SQL updates: ${statements.length}, skipped (no bcrypt hash): ${skipped}`);

  const outDir = resolve(root, 'backups');
  mkdirSync(outDir, { recursive: true });
  const sqlFile = resolve(outDir, 'migrate-supabase-auth-to-d1.sql');
  writeFileSync(sqlFile, statements.join('\n') + '\n', 'utf8');
  console.info(`Wrote ${sqlFile}`);

  if (dryRun) {
    console.info('dry-run — not applying to D1');
    return;
  }

  const workerDir = resolve(root, 'worker');
  const envFlag = remote ? '--env production --remote' : '--local';
  const dbName = remote ? 'malcon-nexus-production' : 'malcon-nexus-dev';
  for (const sql of statements) {
    execSync(`npx wrangler d1 execute ${dbName} ${envFlag} --command ${JSON.stringify(sql)}`, {
      cwd: workerDir,
      stdio: 'pipe',
    });
  }
  console.info(`Applied ${statements.length} updates to D1 (${remote ? 'production remote' : 'local'}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
