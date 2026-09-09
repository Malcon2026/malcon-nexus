#!/usr/bin/env node
/**
 * Deploy case alert escalation functions and print cron setup steps.
 * Run: node scripts/setup-alert-escalations.mjs
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const cronSecret = randomBytes(16).toString('hex');

console.log('\n=== Case Alert Escalation Setup ===\n');
console.log('1. Run migration: supabase/migrations/add-case-alert-escalations.sql');
console.log('2. Set Supabase secret (optional, secures cron):');
console.log(`     ALERT_CRON_SECRET=${cronSecret}`);
console.log('3. Deploy functions:\n');

const functions = [
  'start-case-alerts',
  'process-alert-escalations',
  'acknowledge-case-alerts',
  'test-case-alerts',
];

for (const fn of functions) {
  console.log(`   npx supabase functions deploy ${fn}${fn === 'process-alert-escalations' ? ' --no-verify-jwt' : ''}`);
}

console.log('\n4. Schedule process-alert-escalations every minute (Supabase Dashboard → Edge Functions → Cron):');
console.log('     */1 * * * *  →  process-alert-escalations');
console.log('     Header: x-cron-secret = <ALERT_CRON_SECRET>');
console.log('\n5. Test: node scripts/test-alert-escalation.mjs 0210 --all\n');

try {
  execFileSync('npx', ['supabase', 'db', 'query', '--linked', '-f', 'supabase/migrations/add-case-alert-escalations.sql'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Migration applied.\n');
} catch {
  console.log('Could not auto-apply migration — run SQL in Supabase Dashboard.\n');
}
