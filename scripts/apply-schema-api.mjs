#!/usr/bin/env node
/**
 * Apply a SQL file to a Supabase project through the Management API.
 *
 * This avoids needing the Postgres password or a linked CLI — it only needs a
 * personal access token (https://supabase.com/dashboard/account/tokens).
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-schema-api.mjs
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-schema-api.mjs --ref=<ref> --file=supabase/nexus-full-schema.sql
 *
 * Defaults: --ref=tukoefkroyxycwlkhaot, --file=supabase/nexus-full-schema.sql
 * The schema is idempotent, so re-running is safe.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function argValue(flag, fallback) {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const i = args.indexOf(flag);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
  return fallback;
}

const token = argValue('--token', process.env.SUPABASE_ACCESS_TOKEN);
const ref = argValue('--ref', process.env.SUPABASE_PROJECT_REF || 'tukoefkroyxycwlkhaot');
const file = resolve(root, argValue('--file', 'supabase/nexus-full-schema.sql'));

if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN (create one at https://supabase.com/dashboard/account/tokens).');
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`SQL file not found: ${file}`);
  process.exit(1);
}

const sql = readFileSync(file, 'utf8');
console.log(`Applying ${file} (${sql.length} bytes) to project ${ref}…`);

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`FAILED (HTTP ${res.status}):`);
  console.error(text.slice(0, 4000));
  process.exit(1);
}

console.log(`OK (HTTP ${res.status}) ${text.slice(0, 200)}`);
console.log('Run `npm run db:verify-migration` next.');
