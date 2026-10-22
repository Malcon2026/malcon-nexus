#!/usr/bin/env node
/**
 * Import D1 JSONL backups into Convex (idempotent upsert by table + legacy id).
 *
 * Usage:
 *   node scripts/migrate-to-convex.mjs --dry-run
 *   node scripts/migrate-to-convex.mjs --apply
 *   node scripts/migrate-to-convex.mjs --apply --table employees
 *   node scripts/migrate-to-convex.mjs --apply --prod   # Hostinger prod Convex (not dev)
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
const useProd = args.includes('--prod');

function argValue(flag) {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split('=')[1];
  const i = args.indexOf(flag);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
  return undefined;
}

const tableArg = argValue('--table');
const fromTable = argValue('--from-table');
const dir = resolve(argValue('--dir') ?? join(root, 'backups/d1-production-jsonl'));
const batchSize = Number(process.env.CONVEX_IMPORT_BATCH_SIZE || 50);

if (!dryRun && !apply) {
  console.error('Pass --dry-run or --apply');
  process.exit(1);
}

const PROD_CONVEX_HOST = 'fleet-dinosaur-954.convex.cloud';

/** Set env from file without clobbering variables already set (e.g. CLI overrides). */
function loadEnvFile(relPath, { skipKeys = [] } = {}) {
  const skip = new Set(skipKeys);
  const p = join(root, relPath);
  if (!existsSync(p)) return false;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    if (skip.has(key)) continue;
    if (process.env[key] !== undefined && process.env[key] !== '') continue;
    process.env[key] = t.slice(i + 1).trim();
  }
  return true;
}

function loadEnvLocal() {
  if (useProd) {
    if (!loadEnvFile('.env.production.convex')) {
      console.error('Missing .env.production.convex — copy .env.production.convex.example');
      process.exit(1);
    }
    loadEnvFile('.env.local', { skipKeys: ['VITE_CONVEX_URL', 'VITE_CONVEX_SITE_URL'] });
  } else {
    loadEnvFile('.env.local');
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

let tables = tableArg ? [tableArg] : [...IMPORT_TABLE_ORDER];
if (fromTable && !tableArg) {
  const start = tables.indexOf(fromTable);
  if (start < 0) {
    console.error(`Unknown --from-table: ${fromTable}`);
    process.exit(1);
  }
  tables = tables.slice(start);
}
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

const isProdConvexUrl = convexUrl.includes('fleet-dinosaur-954');
if (apply) {
  if (useProd && !isProdConvexUrl) {
    console.error(
      `--prod requires VITE_CONVEX_URL for ${PROD_CONVEX_HOST} (got ${convexUrl}). Check .env.production.convex.`,
    );
    process.exit(1);
  }
  if (!useProd && isProdConvexUrl) {
    console.error('Refusing prod Convex import without --prod. Use: npm run migrate:convex:prod');
    process.exit(1);
  }
  if (!useProd) {
    console.warn(`[convex-import] dev target ${convexUrl} — Hostinger prod: npm run migrate:convex:prod`);
  }
}

const migrationKey = process.env.CONVEX_MIGRATION_KEY || 'local-dev-migrate';
console.info(`[convex-import] target=${convexUrl}${useProd ? ' (--prod)' : ''}`);
const client = new ConvexHttpClient(convexUrl);

async function importBatch(table, rows) {
  const maxAttempts = Number(process.env.CONVEX_IMPORT_RETRIES || 8);
  let delayMs = 1500;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await client.mutation(api.migration.importBatchPublic, {
        table,
        rows,
        migrationKey,
      });
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const retryable = /502|503|504|Bad Gateway|ECONNRESET|fetch failed/i.test(msg);
      if (!retryable || attempt === maxAttempts) throw e;
      console.warn(`[convex-import] ${table} batch retry ${attempt}/${maxAttempts} in ${delayMs}ms…`);
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs = Math.min(delayMs * 2, 30000);
    }
  }
}

const totals = {};

for (const table of tables) {
  let batch = [];
  let imported = 0;
  for await (const row of lines(table)) {
    batch.push(row);
    if (batch.length >= batchSize) {
      await importBatch(table, batch);
      imported += batch.length;
      batch = [];
      if (imported % 500 === 0) console.info(`  ${table}: ${imported}…`);
    }
  }
  if (batch.length) {
    await importBatch(table, batch);
    imported += batch.length;
  }
  totals[table] = imported;
  console.info(`✓ ${table}: ${imported} rows`);
}

console.info('[convex-import] done', totals);
