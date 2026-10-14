#!/usr/bin/env node
/** Validate remote production D1 row counts vs export manifest / local D1. */
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMPORT_TABLE_ORDER } from './migration/table-order.mjs';

const ACCOUNT_ID = '8c319d08ed49912d25c582198500c265';
const DATABASE_ID = '232961fe-ff35-4b9b-a661-b7f9e2e4bf58';

if (process.env.CONFIRM_REMOTE_D1 !== 'malcon-nexus-production') {
  console.error('Set CONFIRM_REMOTE_D1=malcon-nexus-production');
  process.exit(1);
}

function wranglerOAuthToken() {
  const path = join(homedir(), 'Library/Preferences/.wrangler/config/default.toml');
  const text = readFileSync(path, 'utf8');
  const m = text.match(/oauth_token\s*=\s*"([^"]+)"/);
  if (!m) throw new Error('Could not read oauth_token');
  return m[1];
}

async function d1Query(sql) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${wranglerOAuthToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    },
  );
  const body = await res.json();
  if (!body.success) throw new Error(JSON.stringify(body.errors ?? body));
  return body.result?.[0]?.results ?? [];
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  readFileSync(join(root, 'backups/production-data-2026-10-14-175253/manifest.json'), 'utf8'),
);

const failures = [];
let expectedTotal = 0;
let actualTotal = 0;

console.log('=== Remote D1 validation ===\n');

const tables = await d1Query(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;",
);
const tableNames = new Set(tables.map((r) => r.name));

for (const t of IMPORT_TABLE_ORDER) {
  const exp = manifest.tables[t]?.exported ?? 0;
  expectedTotal += exp;
  if (!tableNames.has(t)) {
    if (exp > 0) failures.push(`missing table ${t}`);
    continue;
  }
  const c = Number((await d1Query(`SELECT COUNT(*) AS c FROM ${t};`))[0]?.c ?? 0);
  actualTotal += c;
  if (c !== exp) failures.push(`${t}: expected ${exp}, got ${c}`);
  else console.log(`✓ ${t}: ${c}`);
}

const fk = await d1Query('PRAGMA foreign_key_check;');
if (fk.length) failures.push(`foreign_key_check: ${JSON.stringify(fk.slice(0, 5))}`);
else console.log('\n✓ foreign_key_check OK');

console.log(`\nExpected rows (manifest): ${expectedTotal}`);
console.log(`Actual rows (remote):     ${actualTotal}`);

if (failures.length) {
  console.error('\nFAILURES:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('\nPASS — remote D1 matches export manifest.');
