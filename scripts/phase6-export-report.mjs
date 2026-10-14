#!/usr/bin/env node
/** Build PHASE_6_EXPORT_REPORT.md from manifest + Phase 4.7 expected counts. */
import { readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exportDir = process.argv[2];
if (!exportDir) {
  console.error('Usage: node scripts/phase6-export-report.mjs <export-dir>');
  process.exit(1);
}

const absExport = resolve(exportDir);
const manifestPath = join(absExport, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('manifest.json missing');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const baselinePath = resolve(root, 'backups/production-checks-2026-10-14/production-row-counts-full.txt');
const baselineText = readFileSync(baselinePath, 'utf8');
const baselineMatch = baselineText.match(
  /2\) Exact row counts[\s\S]*?\n(\[[\s\S]*?\])\n\n={10}/,
);
const baselineRows = JSON.parse(baselineMatch[1]);
const expected = Object.fromEntries(baselineRows.map((r) => [r.table_name, r.row_count]));

const lines = [
  '# Phase 6 — Export report',
  '',
  `**Export directory:** \`${absExport}\``,
  `**Exported at:** ${manifest.exportedAt ?? 'unknown'}`,
  '',
  '| Table | Exported | Expected (Phase 4.7) | Diff | File size | Status |',
  '|-------|----------|----------------------|------|-----------|--------|',
];

let mismatches = [];
let totalExported = 0;

for (const [table, info] of Object.entries(manifest.tables).sort(([a], [b]) => a.localeCompare(b))) {
  const exp = expected[table];
  const exported = info.error ? 'ERROR' : (info.exported ?? 0);
  const diff = typeof exported === 'number' && typeof exp === 'number' ? exported - exp : 'n/a';
  let size = '—';
  if (info.path && existsSync(info.path)) {
    size = `${(statSync(info.path).size / 1024).toFixed(1)} KB`;
  }
  let status = 'ok';
  if (info.error) {
    status = `ERROR: ${info.error}`;
    mismatches.push(table);
  } else if (typeof exported === 'number' && typeof exp === 'number' && exported !== exp) {
    status = 'MISMATCH';
    mismatches.push(table);
  }
  if (typeof exported === 'number') totalExported += exported;
  lines.push(`| ${table} | ${exported} | ${exp ?? '?'} | ${diff} | ${size} | ${status} |`);
}

lines.push('', `**Total exported rows:** ${totalExported}`, '');
if (mismatches.length) {
  lines.push('## STOP — count mismatches', '', mismatches.map((t) => `- ${t}`).join('\n'), '');
  writeFileSync(resolve(root, 'PHASE_6_EXPORT_REPORT.md'), lines.join('\n'));
  console.error('MISMATCH tables:', mismatches.join(', '));
  process.exit(2);
}

lines.push('All table row counts match Phase 4.7 baseline.', '');
writeFileSync(resolve(root, 'PHASE_6_EXPORT_REPORT.md'), lines.join('\n'));
console.log('PHASE_6_EXPORT_REPORT.md written — all counts match');
