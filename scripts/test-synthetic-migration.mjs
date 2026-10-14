#!/usr/bin/env node
/**
 * Phase 5 local test: generate synthetic JSONL → fresh local D1 → import → verify.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workerRoot = resolve(root, 'worker');
const fixtureDir = resolve(workerRoot, 'fixtures/synthetic-migration');

console.log('=== Synthetic migration test ===\n');

execSync('node scripts/generate-synthetic-jsonl.mjs', { cwd: root, stdio: 'inherit' });
execSync('rm -rf .wrangler/state/v3/d1 && npm run db:migrate:local', { cwd: workerRoot, stdio: 'inherit' });
execSync(`node scripts/import-d1-data.mjs --dir ${JSON.stringify(fixtureDir)} --source synthetic`, {
  cwd: root,
  stdio: 'inherit',
});

const manifest = JSON.parse(readFileSync(join(fixtureDir, 'manifest.json'), 'utf8'));
const { d1Execute } = await import(join(workerRoot, 'scripts/exec-local-d1.mjs'));

const failures = [];
for (const [table, expected] of Object.entries(manifest.expected_counts)) {
  const c = d1Execute(`SELECT COUNT(*) AS c FROM ${table}`)[0]?.c;
  if (c !== expected) failures.push(`${table}: expected ${expected}, got ${c}`);
  else console.log(`  ✓ ${table}: ${c}`);
}

const caseMoney = d1Execute(`SELECT invoice_amount_minor FROM cases WHERE case_number = 'SYN-001'`)[0]?.invoice_amount_minor;
if (caseMoney !== 125050) failures.push(`cases.invoice_amount_minor: ${caseMoney}`);

const stages = d1Execute(`SELECT stages FROM cases WHERE case_number = 'SYN-001'`)[0]?.stages;
try {
  JSON.parse(stages);
  console.log('  ✓ cases.stages JSON');
} catch {
  failures.push('cases.stages JSON parse');
}

const onboard = d1Execute(`SELECT kyc_intake_id FROM hr_onboarding_tracks WHERE id = 'o2100001-0001-4001-8001-000000000001'`)[0]?.kyc_intake_id;
if (onboard !== 'k2100001-0001-4001-8001-000000000001') failures.push('HR FK onboarding→kyc');

if (failures.length) {
  console.error('\nFAIL:', failures);
  process.exit(1);
}
console.log('\nSynthetic migration test: PASS');
process.exit(0);
