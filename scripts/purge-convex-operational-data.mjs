#!/usr/bin/env node
/**
 * Remove operational/historical rows from Convex prod while keeping reference data.
 *
 * Usage:
 *   node scripts/purge-convex-operational-data.mjs --dry-run --prod
 *   node scripts/purge-convex-operational-data.mjs --apply --prod
 *   node scripts/purge-convex-operational-data.mjs --apply --prod --table cases
 *
 * Requires .env.production.convex (VITE_CONVEX_URL=fleet-dinosaur-954) and CONVEX_MIGRATION_KEY.
 * Does NOT re-import JSONL.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
const batchSize = Number(process.env.CONVEX_PURGE_BATCH_SIZE || 150);
const batchDelayMs = Number(process.env.CONVEX_PURGE_BATCH_DELAY_MS || 250);

/** Minimal set for login + employees / hospitals / masters in Convex HTTP API. */
const KEEP_TABLES = new Set([
  'departments',
  'app_settings',
  'hospitals',
  'surgical_kits',
  'employees',
  'doctors',
]);

const DELETE_TABLES = IMPORT_TABLE_ORDER.filter((t) => !KEEP_TABLES.has(t));

if (!dryRun && !apply) {
  console.error('Pass --dry-run or --apply');
  process.exit(1);
}

if (!useProd) {
  console.error('Refusing to purge without --prod (this script is prod-only).');
  process.exit(1);
}

const PROD_CONVEX_HOST = 'fleet-dinosaur-954.convex.cloud';

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

if (!loadEnvFile('.env.production.convex')) {
  console.error('Missing .env.production.convex');
  process.exit(1);
}
loadEnvFile('.env.local', { skipKeys: ['VITE_CONVEX_URL', 'VITE_CONVEX_SITE_URL'] });

const convexUrl = process.env.VITE_CONVEX_URL;
if (!convexUrl?.includes('fleet-dinosaur-954')) {
  console.error(`--prod requires VITE_CONVEX_URL for ${PROD_CONVEX_HOST} (got ${convexUrl ?? 'unset'})`);
  process.exit(1);
}

const deploymentSlug = convexUrl.match(/https:\/\/([^.]+)\.convex\.cloud/)?.[1];
if (!deploymentSlug) {
  console.error(`Could not parse deployment slug from VITE_CONVEX_URL=${convexUrl}`);
  process.exit(1);
}
const convexDeployment = `prod:${deploymentSlug}`;

function convexRun(functionName, fnArgs) {
  const out = execFileSync('npx', ['convex', 'run', functionName, JSON.stringify(fnArgs)], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, CONVEX_DEPLOYMENT: convexDeployment },
  }).trim();
  const start = out.indexOf('{');
  const end = out.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`No JSON in convex run output: ${out.slice(0, 500)}`);
  return JSON.parse(out.slice(start, end + 1));
}

const manifestPath = join(root, 'backups/d1-production-jsonl/manifest.json');
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : null;

async function tableTotal(table) {
  try {
    const { total } = convexRun('dataQueries:listRows', { table, limit: 1 });
    return total;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Too many documents read|Many bytes read/.test(msg)) {
      const fromManifest = manifest?.tables?.[table]?.rows;
      return fromManifest != null ? fromManifest : null;
    }
    throw e;
  }
}

async function tableEmpty(table) {
  const { empty } = convexRun('migration:tableIsEmpty', { table });
  return empty;
}

async function countTables(tables) {
  const counts = {};
  for (const table of tables) {
    counts[table] = await tableTotal(table);
  }
  return counts;
}

async function purgeTable(table) {
  let removed = 0;
  let batches = 0;
  for (;;) {
    const { deleted, hasMore } = convexRun('migration:clearTableBatch', {
      table,
      limit: batchSize,
    });
    removed += deleted;
    batches++;
    if (deleted > 0 && removed % 2000 < batchSize) {
      console.info(`  ${table}: ${removed} deleted…`);
    }
    if (!hasMore || deleted === 0) break;
    if (batchDelayMs > 0) await new Promise((r) => setTimeout(r, batchDelayMs));
  }
  return { removed, batches };
}

const tablesToDelete = tableArg ? [tableArg] : DELETE_TABLES;

if (tableArg && KEEP_TABLES.has(tableArg)) {
  console.error(`Refusing to purge KEEP table: ${tableArg}`);
  process.exit(1);
}

console.info(`[convex-purge] target=${convexUrl} mode=${dryRun ? 'dry-run' : 'apply'}`);
console.info(`[convex-purge] keep: ${[...KEEP_TABLES].sort().join(', ')}`);
console.info(`[convex-purge] delete tables: ${tablesToDelete.length}`);

const beforeKeep = await countTables([...KEEP_TABLES].sort());
const beforeDelete = await countTables(tablesToDelete);

console.info('\n--- counts (before) ---');
for (const [t, n] of Object.entries({ ...beforeKeep, ...beforeDelete }).sort(([a], [b]) => a.localeCompare(b))) {
  const tag = KEEP_TABLES.has(t) ? 'KEEP' : 'DEL';
  const label = n == null ? '(large; count skipped)' : n;
  console.log(`  ${t}: ${label} [${tag}]`);
}

if (dryRun) {
  const deleteTotal = Object.values(beforeDelete).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  console.info(`\n[dry-run] would delete ~${deleteTotal}+ rows across ${tablesToDelete.length} tables`);
  process.exit(0);
}

console.info('\n--- purging ---');
const purged = {};
for (const table of tablesToDelete) {
  if (await tableEmpty(table)) {
    console.info(`✓ ${table}: 0 (skip)`);
    purged[table] = 0;
    continue;
  }
  const { removed, batches } = await purgeTable(table);
  purged[table] = removed;
  console.info(`✓ ${table}: ${removed} rows (${batches} batches)`);
}

const afterKeep = await countTables([...KEEP_TABLES].sort());

console.info('\n--- counts (after) ---');
for (const table of tablesToDelete) {
  if (!(await tableEmpty(table))) {
    console.warn(`  WARN: ${table} still has rows after purge`);
  }
}
for (const [t, n] of Object.entries(afterKeep).sort(([a], [b]) => a.localeCompare(b))) {
  const label = n == null ? '(large; count skipped)' : n;
  console.log(`  ${t}: ${label} [KEEP]`);
}

const removedTotal = Object.values(purged).reduce((a, b) => a + b, 0);
console.info('\n[convex-purge] done', { removedTotal, purged });
