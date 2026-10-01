#!/usr/bin/env node
/**
 * Apply add-doctor-code.sql when SUPABASE_DATABASE_URL is set (direct Postgres).
 * Example (Dashboard → Database → Connection string → URI):
 *   SUPABASE_DATABASE_URL='postgresql://postgres.[ref]:[PASSWORD]@...pooler.supabase.com:6543/postgres' \
 *     node scripts/apply-doctor-code-migration.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const envPath = resolve(root, name);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0 && !process.env[t.slice(0, i).trim()]) {
        process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
      }
    }
  }
}

loadEnv();

const url = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.log('Skip: set SUPABASE_DATABASE_URL to run DDL (see script header).');
  process.exit(0);
}

const sql = readFileSync(resolve(root, 'supabase/migrations/add-doctor-code.sql'), 'utf8');
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log('Applied add-doctor-code.sql');
} finally {
  await client.end();
}
