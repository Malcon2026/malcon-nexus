#!/usr/bin/env node
/**
 * Build and deploy static dist to https://app.malconnexus.com (Hostinger).
 *
 * Prerequisites: `hostinger` CLI authenticated; `.env.production.aws` for AWS deploy (no Supabase).
 *
 *   node scripts/deploy-hostinger-app.mjs
 *   node scripts/deploy-hostinger-app.mjs --dry-run
 *   node scripts/deploy-hostinger-app.mjs --cutover   # loads .env.production.cutover (Worker/D1 data; Supabase Auth only)
 *   node scripts/deploy-hostinger-app.mjs --cloudflare # loads .env.production.cloudflare (no Supabase)
 *   node scripts/deploy-hostinger-app.mjs --aws          # loads .env.production.aws (PostgreSQL API)
 */

import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, cpSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const cutover = process.argv.includes('--cutover');
const cloudflare = process.argv.includes('--cloudflare');
const aws = process.argv.includes('--aws');

const HOSTINGER_USER = process.env.HOSTINGER_USERNAME ?? 'u308766170';
const HOSTINGER_DOMAIN = process.env.HOSTINGER_APP_DOMAIN ?? 'app.malconnexus.com';
const ARCHIVE_NAME = 'malcon-nexus-dist.zip';

function loadEnvFile(relativePath, { override = false } = {}) {
  const p = resolve(root, relativePath);
  if (!existsSync(p)) return false;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    if (!override && process.env[key]) continue;
    process.env[key] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return true;
}

/** Production remote backends must not embed Supabase URLs/keys from .env.local. */
function stripSupabaseViteEnv() {
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.VITE_SUPABASE_ANON_KEY;
}

function loadEnv() {
  for (const f of ['.env', '.env.local', '.env.production']) {
    loadEnvFile(f);
  }
  if (aws) {
    const path = '.env.production.aws';
    if (!loadEnvFile(path, { override: true })) {
      console.error(`Missing ${path}. Copy .env.production.aws.example → ${path}.`);
      process.exit(1);
    }
    stripSupabaseViteEnv();
    console.info('[deploy] AWS backend — PostgreSQL API + S3 (no Supabase)');
  } else if (cloudflare) {
    const path = '.env.production.cloudflare';
    if (!loadEnvFile(path, { override: true })) {
      console.error(`Missing ${path}. Copy .env.production.cloudflare.example → ${path}.`);
      process.exit(1);
    }
    stripSupabaseViteEnv();
    console.info('[deploy] Cloudflare-only — Worker auth + D1 (no Supabase)');
  } else if (cutover) {
    const cutoverPath = '.env.production.cutover';
    if (!loadEnvFile(cutoverPath, { override: true })) {
      console.error(
        `Missing ${cutoverPath}. Copy .env.production.cutover.example → ${cutoverPath} and set VITE_SUPABASE_* plus Worker URL.`,
      );
      process.exit(1);
    }
    console.info('[deploy] cutover mode — SPA data via Cloudflare Worker/D1; Supabase Auth unchanged');
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

if (!cloudflare && !aws && (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY)) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

if ((cutover || cloudflare || aws) && !process.env.VITE_WORKER_API_URL) {
  console.error('Cutover/Cloudflare/AWS deploy requires VITE_WORKER_API_URL');
  process.exit(1);
}

if (cloudflare && process.env.VITE_USE_CLOUDFLARE_BACKEND !== 'true') {
  console.error('Cloudflare deploy requires VITE_USE_CLOUDFLARE_BACKEND=true');
  process.exit(1);
}

if (aws && process.env.VITE_USE_AWS_BACKEND !== 'true') {
  console.error('AWS deploy requires VITE_USE_AWS_BACKEND=true');
  process.exit(1);
}

console.info('[deploy] npm run build…');
execSync('npm run build', { cwd: root, stdio: 'inherit', env: process.env });

const dist = resolve(root, 'dist');
if (!existsSync(resolve(dist, 'index.html'))) {
  console.error('[deploy] dist/index.html missing');
  process.exit(1);
}

if (aws || cloudflare) {
  patchGalleryStaticApiBase(dist, process.env.VITE_WORKER_API_URL);
  execSync('node scripts/verify-production-bundle-no-supabase.mjs', {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
}

function patchGalleryStaticApiBase(distDir, apiBase) {
  const base = (apiBase || '').trim().replace(/\/+$/, '');
  if (!base) return;
  const galleryHtml = resolve(distDir, 'gallery/index.html');
  if (!existsSync(galleryHtml)) return;
  const raw = readFileSync(galleryHtml, 'utf8');
  const next = raw.replaceAll('__MALCON_API_BASE__', base);
  if (next === raw) return;
  writeFileSync(galleryHtml, next);
  console.info('[deploy] gallery/index.html → Malcon API base set');
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
if (aws) {
  console.info('AWS backend — ensure RDS, S3, and API secrets are set; see .env.production.aws.example');
} else if (cloudflare) {
  console.info('Cloudflare backend — ensure Worker secrets (JWT, TELEGRAM_BOT_TOKEN) are set; see .env.production.cloudflare.example');
} else {
  console.info('Update Supabase → Authentication → URL Configuration: Site URL + redirect https://app.malconnexus.com');
  console.info('Set Supabase secret APP_URL=https://app.malconnexus.com for assignment emails/alerts.');
}
