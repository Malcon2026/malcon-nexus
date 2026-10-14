#!/usr/bin/env node
/**
 * Set Cloudflare-native password on production (or local) D1 for an admin employee.
 *
 *   node scripts/worker-set-password.mjs --email admin@example.com --password 'YourNewPass'
 *   node scripts/worker-set-password.mjs --email admin@example.com --password '...' --remote
 */
import { execFileSync } from 'node:child_process';
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { parseArgs } from 'node:util';

const ITERATIONS = 120_000;

function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
  return `pbkdf2_sha256$${ITERATIONS}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    password: { type: 'string' },
    remote: { type: 'boolean', default: false },
  },
});

const email = values.email?.trim().toLowerCase();
const password = values.password;
if (!email || !password) {
  console.error('Usage: --email --password [--remote]');
  process.exit(1);
}

const hash = hashPassword(password);
const escaped = hash.replace(/'/g, "''");
const sql = `UPDATE employees SET password_hash = '${escaped}', updated_at = datetime('now') WHERE lower(email) = '${email.replace(/'/g, "''")}';`;

const cwd = new URL('../worker', import.meta.url).pathname;
const args = ['wrangler', 'd1', 'execute', 'malcon-nexus-production', '--command', sql];
if (values.remote) args.push('--env', 'production', '--remote');
execFileSync('npx', args, { cwd, stdio: 'inherit', env: process.env });

console.info(`Password updated for ${email}. Use Admin login on the SPA.`);
