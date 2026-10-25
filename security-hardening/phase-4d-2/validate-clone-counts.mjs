#!/usr/bin/env node
/**
 * Compare table row counts on source vs clone host (private VPC use only).
 * Requires DATABASE_URL in env (ECS secrets injection). Never logs connection strings.
 * Usage: VALIDATE_RDS_HOST=<clone-endpoint> node validate-clone-counts.mjs
 */
import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cloneHost = process.env.VALIDATE_RDS_HOST;
const baseUrl = process.env.DATABASE_URL;
if (!cloneHost || !baseUrl) {
  console.error('Set VALIDATE_RDS_HOST and DATABASE_URL');
  process.exit(1);
}

function swapHost(connectionString, host) {
  const url = new URL(connectionString.replace(/^postgresql:/, 'http:'));
  url.hostname = host;
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) {
    url.searchParams.delete(key);
  }
  return url.toString().replace(/^http:/, 'postgresql:');
}

const here = dirname(fileURLToPath(import.meta.url));
const caCandidates = [
  process.env.PGSSLROOTCERT,
  process.env.AWS_RDS_CA_BUNDLE,
  join(here, '../../aws/certs/ap-south-1-bundle.pem'),
  '/app/aws/certs/ap-south-1-bundle.pem',
].filter(Boolean);
const caPath = caCandidates.find((p) => existsSync(p));

function sslConfig() {
  if (process.env.PGSSL === '0') return false;
  if (!caPath) {
    throw new Error('RDS CA bundle not found (set PGSSLROOTCERT or AWS_RDS_CA_BUNDLE)');
  }
  return { ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
}

const tables = ['employees', 'cases', 'hospitals', 'attendance_records'];

async function countsForHost(label, host) {
  const pool = new pg.Pool({
    connectionString: swapHost(baseUrl, host),
    ssl: sslConfig(),
    max: 2,
  });
  try {
    const out = { label, host: '[redacted]', tables: {} };
    for (const t of tables) {
      const r = await pool.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
      out.tables[t] = r.rows[0]?.c ?? null;
    }
    const db = await pool.query('SELECT current_database() AS db');
    out.database = db.rows[0]?.db;
    return out;
  } finally {
    await pool.end();
  }
}

const sourceHost = new URL(baseUrl.replace(/^postgresql:/, 'http:')).hostname;

const [source, clone] = await Promise.all([
  countsForHost('source', sourceHost),
  countsForHost('clone', cloneHost),
]);

const match = tables.every((t) => source.tables[t] === clone.tables[t]);
console.log(JSON.stringify({ ok: match, source, clone }, null, 2));
process.exit(match ? 0 : 2);
