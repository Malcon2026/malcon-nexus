#!/usr/bin/env node
/** Upload public/gallery/index.html to Supabase Storage for normal browser rendering. */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(resolve(root, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch { /* optional */ }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const token = env.GALLERY_TOKEN || 'malcon2026gallery';

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const html = readFileSync(resolve(root, 'public/gallery/index.html'), 'utf8');
const bucket = 'gallery-site';
const objectPath = 'index.html';

async function ensureBucket() {
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: bucket, name: bucket, public: true }),
  });
  if (!res.ok && res.status !== 409) {
    const body = await res.text();
    console.warn('Bucket create note:', res.status, body);
  }
}

async function upload() {
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': 'text/html; charset=utf-8',
      'x-upsert': 'true',
    },
    body: html,
  });
  if (!res.ok) {
    console.error('Upload failed:', res.status, await res.text());
    process.exit(1);
  }
}

await ensureBucket();
await upload();

const publicUrl = `${url}/storage/v1/object/public/${bucket}/${objectPath}?token=${token}`;
console.log('\n✓ Gallery published to Supabase Storage\n');
console.log('Open this link in Safari/Chrome (NOT HTML Online Viewer):\n');
console.log(publicUrl);
console.log('');
