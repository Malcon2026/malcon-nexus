#!/usr/bin/env node
/**
 * Import D1 JSONL backups into Convex (idempotent upsert by table + legacy id).
 *
 * Usage:
 *   node scripts/migrate-to-convex.mjs --dry-run
 *   node scripts/migrate-to-convex.mjs --apply
 *   node scripts/migrate-to-convex.mjs --apply --table employees
 */
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';
import { IMPORT_TABLE_ORDER } from './migration/table-order.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const apply = args.includes('--apply');

function argValue(flag) {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split('=')[1];
  const i = args.indexOf(flag);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
  return undefined;
}

const tableArg = argValue('--table');
const dir = resolve(argValue('--dir') ?? join(root, 'backups/d1-production-jsonl'));
const batchSize = Number(process.env.CONVEX_IMPORT_BATCH_SIZE || 50);

if (!dryRun && !apply) {
  console.error('Pass --dry-run or --apply');
  process.exit(1);
}

function loadEnvLocal() {
  const p = join(root, '.env.local');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    process.env[key] = t.slice(i + 1).trim();
  }
}

async function* lines(table) {
  const path = join(dir, `${table}.jsonl`);
  if (!existsSync(path)) return;
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) yield JSON.parse(line);
  }
}

async function countLines(table) {
  let n = 0;
  for await (const _ of lines(table)) n++;
  return n;
}

loadEnvLocal();

const tables = tableArg ? [tableArg] : IMPORT_TABLE_ORDER;
const manifest = existsSync(join(dir, 'manifest.json'))
  ? JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
  : null;

console.info(`[convex-import] dir=${dir} tables=${tables.length} mode=${dryRun ? 'dry-run' : 'apply'}`);

if (dryRun) {
  for (const table of tables) {
    const expected = manifest?.tables?.[table]?.rows;
    const counted = await countLines(table);
    const label = expected != null && expected !== counted ? `${counted} (manifest ${expected})` : String(counted);
    console.log(`  ${table}: ${label} rows`);
  }
  process.exit(0);
}

const convexUrl = process.env.VITE_CONVEX_URL;
if (!convexUrl) {
  console.error('VITE_CONVEX_URL missing — run npx convex dev --configure');
  process.exit(1);
}

const migrationKey = process.env.CONVEX_MIGRATION_KEY || 'local-dev-migrate';
const client = new ConvexHttpClient(convexUrl);

const totals = {};

for (const table of tables) {
  let batch = [];
  let imported = 0;
  for await (const row of lines(table)) {
    batch.push(row);
    if (batch.length >= batchSize) {
      await client.mutation(api.migration.importBatchPublic, {
        table,
        rows: batch,
        migrationKey,
      });
      imported += batch.length;
      batch = [];
      if (imported % 500 === 0) console.info(`  ${table}: ${imported}…`);
    }
  }
  if (batch.length) {
    await client.mutation(api.migration.importBatchPublic, {
      table,
      rows: batch,
      migrationKey,
    });
    imported += batch.length;
  }
  totals[table] = imported;
  console.info(`✓ ${table}: ${imported} rows`);
}

console.info('[convex-import] done', totals);
