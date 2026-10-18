#!/usr/bin/env node
/**
 * Fail Hostinger AWS/Cloudflare deploy if the built SPA still references Supabase.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const dist = resolve(root, 'dist');

const FORBIDDEN = [/supabase\.co/i, /VITE_SUPABASE_URL/i];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (/\.(html|js|css)$/i.test(name)) files.push(p);
  }
  return files;
}

const hits = [];
for (const file of walk(dist)) {
  const text = readFileSync(file, 'utf8');
  for (const re of FORBIDDEN) {
    if (re.test(text)) {
      hits.push({ file, pattern: re.source });
    }
  }
}

if (hits.length) {
  console.error('[verify] Supabase references found in production dist (delink failed):');
  for (const h of hits.slice(0, 10)) {
    console.error(`  ${h.file} (${h.pattern})`);
  }
  process.exit(1);
}

console.info('[verify] dist/ has no supabase.co / VITE_SUPABASE_URL references');
