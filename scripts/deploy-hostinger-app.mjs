#!/usr/bin/env node
/**
 * Build and deploy static dist to https://app.malconnexus.com (Hostinger).
 *
 * Prerequisites: `hostinger` CLI authenticated; .env with VITE_SUPABASE_*.
 *
 *   node scripts/deploy-hostinger-app.mjs
 *   node scripts/deploy-hostinger-app.mjs --dry-run
 */

import { readFileSync, existsSync, rmSync, mkdirSync, cpSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

const HOSTINGER_USER = process.env.HOSTINGER_USERNAME ?? 'u308766170';
const HOSTINGER_DOMAIN = process.env.HOSTINGER_APP_DOMAIN ?? 'app.malconnexus.com';
const ARCHIVE_NAME = 'malcon-nexus-dist.zip';

function loadEnv() {
  for (const f of ['.env', '.env.local', '.env.production']) {
    const p = resolve(root, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0 && !process.env[t.slice(0, i).trim()]) {
        process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

async function tusUpload(baseUrl, authKey, restAuthKey, relativePath, filePath) {
  const size = statSync(filePath).size;
  const target = `${baseUrl.replace(/\/$/, '')}/${relativePath}?override=true`;
  const commonHeaders = {
    'X-Auth': authKey,
    'X-Auth-Rest': restAuthKey,
    'Tus-Resumable': '1.0.0',
  };

  const createRes = await fetch(target, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'Upload-Length': String(size),
      'Upload-Offset': '0',
    },
  });
  if (createRes.status !== 201 && createRes.status !== 204) {
    throw new Error(`TUS create failed ${createRes.status}: ${await createRes.text()}`);
  }

  const body = readFileSync(filePath);
  const patchRes = await fetch(target, {
    method: 'PATCH',
    headers: {
      ...commonHeaders,
      'Content-Type': 'application/offset+octet-stream',
      'Upload-Offset': '0',
    },
    body,
  });
  if (patchRes.status !== 204) {
    throw new Error(`TUS upload failed ${patchRes.status}: ${await patchRes.text()}`);
  }
}

loadEnv();

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

console.info('[deploy] npm run build…');
execSync('npm run build', { cwd: root, stdio: 'inherit', env: process.env });

const dist = resolve(root, 'dist');
if (!existsSync(resolve(dist, 'index.html'))) {
  console.error('[deploy] dist/index.html missing');
  process.exit(1);
}

const htaccess = resolve(root, 'public/.htaccess');
if (existsSync(htaccess)) {
  cpSync(htaccess, resolve(dist, '.htaccess'));
}

const workDir = resolve(root, '.hostinger-deploy');
mkdirSync(workDir, { recursive: true });
const zipPath = resolve(workDir, ARCHIVE_NAME);
if (existsSync(zipPath)) rmSync(zipPath);

execSync(`cd "${dist}" && zip -r -q "${zipPath}" .`, { stdio: 'inherit' });
console.info(`[deploy] Archive ${(statSync(zipPath).size / 1024 / 1024).toFixed(2)} MB`);

if (dryRun) {
  console.info('[deploy] dry-run complete');
  process.exit(0);
}

const uploadJson = execSync(
  `hostinger hosting files generate-upload-url --username ${HOSTINGER_USER} --domain ${HOSTINGER_DOMAIN} --format json`,
  { encoding: 'utf8' },
);
const upload = JSON.parse(uploadJson);
const { url, auth_key: authKey, rest_auth_key: restAuthKey } = upload;
if (!url || !authKey || !restAuthKey) {
  console.error('Unexpected upload URL response', uploadJson);
  process.exit(1);
}

console.info('[deploy] Uploading zip…');
await tusUpload(url, authKey, restAuthKey, ARCHIVE_NAME, zipPath);

console.info('[deploy] Extracting on Hostinger…');
execSync(
  `hostinger hosting websites deploy-static-site-archive ${HOSTINGER_USER} ${HOSTINGER_DOMAIN} --archive-path ${ARCHIVE_NAME}`,
  { stdio: 'inherit' },
);

console.info('\nLive at https://app.malconnexus.com/');
console.info('Update Supabase → Authentication → URL Configuration: Site URL + redirect https://app.malconnexus.com');
console.info('Set Supabase secret APP_URL=https://app.malconnexus.com for assignment emails/alerts.');
