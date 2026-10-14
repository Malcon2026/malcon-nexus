#!/usr/bin/env node
/**
 * Phase 11 — staging bake-off runner (API tests only; no SPA deploy).
 *
 * Prerequisites:
 *   - Staging Worker deployed with staging D1 + SUPABASE_JWT_SECRET
 *   - Staging SPA OR manual JWT from production Supabase login
 *
 *   WORKER_BASE_URL=https://<staging-worker-host> npm run phase11:bakeoff
 *
 * Optional strict auth (Worker must have JWT_SECRET matching signed test tokens — staging only):
 *   ENFORCE_AUTH_TESTS=1 JWT_SECRET=... WORKER_BASE_URL=... node scripts/phase11-staging-bakeoff.mjs
 */
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.WORKER_BASE_URL;

if (!base || base.includes('127.0.0.1') || base.includes('localhost')) {
  console.error(
    'Set WORKER_BASE_URL to the deployed staging Worker (not localhost).\n' +
      'Example: WORKER_BASE_URL=https://malcon-nexus-api-staging.<account>.workers.dev npm run phase11:bakeoff',
  );
  process.exit(1);
}

const env = { ...process.env, WORKER_BASE_URL: base };

const steps = [
  ['test:api', 'worker'],
  ['test:writes', 'worker'],
  ['test:writes:medium', 'worker'],
  ['test:writes:cases', 'worker'],
  ['test:auth', 'worker'],
  ['test:storage', 'worker'],
];

console.log('Staging bake-off against', base, '\n');

for (const [script, cwdName] of steps) {
  const cwd = cwdName === 'worker' ? resolve(root, 'worker') : root;
  console.log(`\n>>> npm run ${script} (${cwdName}/)\n`);
  execSync(`npm run ${script}`, { cwd, env, stdio: 'inherit' });
}

console.log('\n--- Manual staging checklist (SPA) ---');
console.log('1. Deploy staging SPA at https://app-staging.malconnexus.com with VITE_WORKER_API_URL=' + base);
console.log('2. Enable Worker flags ONE domain at a time on staging only.');
console.log('3. Login via Supabase; confirm API calls send Authorization bearer.');
console.log('4. FCFS claim: two employees claim same unassigned case — expect 200 + 409.');
console.log('\nBake-off API scripts finished.');
