#!/usr/bin/env node
/**
 * Sync stage photos from Supabase → local Windows folders (one folder per employee).
 *
 * Run on your 24/7 office server:
 *   node scripts/windows-photo-sync.mjs
 *
 * Schedule with Windows Task Scheduler every 5 minutes.
 *
 * Required .env (on the server only — never commit):
 *   VITE_SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 *   PHOTOS_ROOT=D:\MalconNexus\Photos
 *
 * Optional limits (reduce Supabase + server load):
 *   PHOTOS_SYNC_MAX_DOWNLOADS_PER_RUN=20   # new photos per run (default 20)
 *   PHOTOS_SYNC_MAX_CASES=100              # cases fetched per query (default 100)
 *   PHOTOS_SYNC_LOOKBACK_DAYS=90           # ignore older cases (default 90)
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  createWriteStream,
} from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(__dirname, '.env'),
    resolve(__dirname, '..', '.env'),
  ];
  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
    return envPath;
  }
  return null;
}

function sanitizeFolderName(name) {
  return String(name || 'Unknown Employee')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Unknown Employee';
}

function sanitizeFilePart(value) {
  return String(value || 'file')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .trim()
    .slice(0, 60) || 'file';
}

function isImageDocument(doc) {
  if (!doc?.url) return false;
  const type = String(doc.type || '');
  const name = String(doc.name || '');
  return type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(name) || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(doc.url);
}

function guessExtension(doc) {
  const fromUrl = extname(new URL(doc.url).pathname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'].includes(fromUrl)) {
    return fromUrl;
  }
  const mime = String(doc.type || '').toLowerCase();
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('heic')) return '.heic';
  if (mime.includes('heif')) return '.heif';
  return '.jpg';
}

function resolveEmployeeName(caseRow, stageRecord, doc) {
  return (
    stageRecord?.assignedEmployee?.name ||
    caseRow.assigned_employee_snapshot?.name ||
    doc.uploadedBy ||
    'Unknown Employee'
  );
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const body = res.body;
  if (!body) throw new Error(`Empty response for ${url}`);
  await pipeline(Readable.fromWeb(body), createWriteStream(destPath));
}

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function resolveCasesSince(syncLog) {
  const lookbackDays = parsePositiveInt(process.env.PHOTOS_SYNC_LOOKBACK_DAYS, 90);
  const lookbackFloor = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  if (syncLog.lastRunAt) {
    const overlapMs = 15 * 60 * 1000;
    const incrementalSince = new Date(new Date(syncLog.lastRunAt).getTime() - overlapMs);
    return incrementalSince > lookbackFloor ? incrementalSince : lookbackFloor;
  }

  return lookbackFloor;
}

const envFile = loadEnv();
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const photosRoot = process.env.PHOTOS_ROOT;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
if (!photosRoot) {
  console.error('Missing PHOTOS_ROOT in .env (example: D:\\MalconNexus\\Photos)');
  process.exit(1);
}

mkdirSync(photosRoot, { recursive: true });

const syncLogPath = join(photosRoot, '_sync-log.json');
let syncLog = { syncedDocumentIds: [] };
if (existsSync(syncLogPath)) {
  try {
    syncLog = JSON.parse(readFileSync(syncLogPath, 'utf8'));
  } catch {
    syncLog = { syncedDocumentIds: [] };
  }
}
const synced = new Set(syncLog.syncedDocumentIds || []);
const maxDownloadsPerRun = parsePositiveInt(process.env.PHOTOS_SYNC_MAX_DOWNLOADS_PER_RUN, 20);
const maxCases = parsePositiveInt(process.env.PHOTOS_SYNC_MAX_CASES, 100);
const casesSince = resolveCasesSince(syncLog);

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('=== Malcon Nexus Photo Sync ===');
console.log(`Env file: ${envFile || '(environment variables)'}`);
console.log(`Photos root: ${photosRoot}`);
console.log(`Already synced: ${synced.size} photo(s)`);
console.log(`Limits: ${maxDownloadsPerRun} download(s)/run, ${maxCases} case(s)/query`);
console.log(`Cases updated since: ${casesSince.toISOString()}\n`);

const { data: cases, error } = await sb
  .from('cases')
  .select('id, case_number, assigned_employee_snapshot, stages')
  .gte('updated_at', casesSince.toISOString())
  .order('updated_at', { ascending: false })
  .limit(maxCases);

if (error) {
  console.error('Failed to load cases:', error.message);
  process.exit(1);
}

let downloaded = 0;
let skipped = 0;
let failed = 0;
let downloadCapReached = false;

for (const caseRow of cases ?? []) {
  if (downloadCapReached) break;
  const stages = Array.isArray(caseRow.stages) ? caseRow.stages : [];
  const caseNumber = sanitizeFilePart(caseRow.case_number || caseRow.id);

  for (const stageRecord of stages) {
    const stageName = sanitizeFilePart(stageRecord?.stage || 'stage');
    const documents = Array.isArray(stageRecord?.documents) ? stageRecord.documents : [];

    for (const doc of documents) {
      if (downloadCapReached) break;
      if (!isImageDocument(doc)) continue;
      if (synced.has(doc.id)) {
        skipped += 1;
        continue;
      }
      if (downloaded >= maxDownloadsPerRun) {
        downloadCapReached = true;
        break;
      }

      const employeeName = sanitizeFolderName(
        resolveEmployeeName(caseRow, stageRecord, doc),
      );
      const ext = guessExtension(doc);
      const timestamp = sanitizeFilePart(
        (doc.uploadedAt || new Date().toISOString()).replace(/[:.]/g, '-'),
      );
      const fileName = `${stageName}-${timestamp}-${String(doc.id).slice(0, 8)}${ext}`;
      const destDir = join(photosRoot, employeeName, caseNumber);
      const destPath = join(destDir, fileName);

      mkdirSync(destDir, { recursive: true });

      try {
        await downloadToFile(doc.url, destPath);
        synced.add(doc.id);
        downloaded += 1;
        console.log(`✓ ${employeeName} / ${caseNumber} / ${fileName}`);
      } catch (err) {
        failed += 1;
        console.error(`✗ ${employeeName} / ${caseNumber} / ${fileName}`);
        console.error(`  ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}

writeFileSync(
  syncLogPath,
  JSON.stringify({ syncedDocumentIds: [...synced], lastRunAt: new Date().toISOString() }, null, 2),
  'utf8',
);

console.log('\nDone.');
console.log(`Downloaded: ${downloaded}`);
console.log(`Skipped (already synced): ${skipped}`);
console.log(`Failed: ${failed}`);
if (downloadCapReached) {
  console.log(`Download cap reached (${maxDownloadsPerRun}/run). Remaining photos will sync on the next run.`);
}

if (failed > 0) process.exit(1);
