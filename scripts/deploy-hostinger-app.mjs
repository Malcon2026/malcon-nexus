#!/usr/bin/env node
/**
 * Build and deploy static dist to https://app.malconnexus.com (Hostinger).
 *
 * Prerequisites: `hostinger` CLI authenticated; `.env.production.convex` for production (Convex + Supabase Auth).
 *
 *   node scripts/deploy-hostinger-app.mjs --convex       # default production path
 *   node scripts/deploy-hostinger-app.mjs --dry-run --convex
 *   node scripts/deploy-hostinger-app.mjs --cutover      # legacy Worker/D1 + Supabase Auth
 *   node scripts/deploy-hostinger-app.mjs --cloudflare   # legacy Worker-only auth
 *   node scripts/deploy-hostinger-app.mjs --aws          # deprecated AWS path
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
const convex = process.argv.includes('--convex');
/** Supabase-only: Postgres data plane + Supabase Auth (no Convex/Worker/AWS). */
const supabaseMode = process.argv.includes('--supabase');

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
  if (convex) {
    const path = '.env.production.convex';
    if (!loadEnvFile(path, { override: true })) {
      console.error(`Missing ${path}. Copy .env.production.convex.example → ${path}.`);
      process.exit(1);
    }
    console.info('[deploy] Convex data plane + Supabase Auth (no AWS/Worker required)');
  } else if (supabaseMode) {
    const path = '.env.production.supabase';
    if (!loadEnvFile(path, { override: true })) {
      console.error(`Missing ${path}. Copy .env.production.supabase.example → ${path}.`);
      process.exit(1);
    }
    console.info('[deploy] Supabase Postgres + Supabase Auth (no Convex/Worker/AWS)');
  } else if (aws) {
    const path = '.env.production.aws';
    if (!loadEnvFile(path, { override: true })) {
      console.error(`Missing ${path}. Copy .env.production.aws.example → ${path}.`);
      process.exit(1);
    }
    stripSupabaseViteEnv();
    console.info('[deploy] AWS backend — deprecated; use --convex');
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

if (!convex && !cloudflare && !aws && (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY)) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

if (supabaseMode) {
  const remoteFlags = [
    'VITE_USE_CONVEX_BACKEND',
    'VITE_USE_CLOUDFLARE_BACKEND',
    'VITE_USE_AWS_BACKEND',
  ].filter((flag) => process.env[flag] === 'true');
  if (remoteFlags.length) {
    console.error(`Supabase-only deploy, but these are still "true": ${remoteFlags.join(', ')}`);
    process.exit(1);
  }
}

if (convex) {
  if (process.env.VITE_USE_CONVEX_BACKEND !== 'true') {
    console.error('Convex deploy requires VITE_USE_CONVEX_BACKEND=true');
    process.exit(1);
  }
  if (!process.env.VITE_CONVEX_URL || !process.env.VITE_CONVEX_SITE_URL) {
    console.error('Convex deploy requires VITE_CONVEX_URL and VITE_CONVEX_SITE_URL');
    process.exit(1);
  }
  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    console.error('Convex deploy requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (auth only)');
    process.exit(1);
  }
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

const galleryApiBase =
  convex
    ? process.env.VITE_CONVEX_SITE_URL
    : supabaseMode
      ? `${String(process.env.VITE_SUPABASE_URL).replace(/\/+$/, '')}/functions/v1`
      : process.env.VITE_WORKER_API_URL;
if (aws || cloudflare || convex || supabaseMode) {
  patchGalleryStaticApiBase(dist, galleryApiBase);
}
if (aws || cloudflare) {
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
if (convex) {
  console.info('Convex — set SUPABASE_JWT_SECRET on Convex deployment; see .env.production.convex.example');
} else if (supabaseMode) {
  console.info('Supabase — data + auth only. Verify RLS and Edge Functions in the Supabase dashboard.');
} else if (aws) {
  console.info('AWS backend is deprecated — migrate to --convex');
} else if (cloudflare) {
  console.info('Cloudflare backend — see .env.production.cloudflare.example');
} else {
  console.info('Update Supabase → Authentication → URL Configuration: Site URL + redirect https://app.malconnexus.com');
  console.info('Set Supabase secret APP_URL=https://app.malconnexus.com for assignment emails/alerts.');
}
