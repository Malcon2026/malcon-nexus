#!/usr/bin/env node
/**
 * Archive punch-in selfies: Supabase → office PC, then purge cloud after 24h.
 *
 * 1) Download any attendance / off-site approval selfies not yet on disk
 * 2) After SELFIE_CLOUD_RETENTION_HOURS (default 24), delete from Supabase
 *    storage + clear selfie_url — only if the local file exists (safety).
 *
 * Run on the 24/7 office server every 15 minutes:
 *   node scripts/archive-punch-in-selfies.mjs
 *
 * Required .env (server only — never commit):
 *   VITE_SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 *   PHOTOS_ROOT=D:\MalconNexus\Photos
 *     (legacy: SELFIE_ARCHIVE_ROOT — same tree if PHOTOS_ROOT unset)
 *
 * Saves under: {YYYY}/{MonthName}/{DDMMYYYY}/Attendance/
 *
 * Optional:
 *   SELFIE_CLOUD_RETENTION_HOURS=24   (use 0 to purge cloud copies as soon as local file exists)
 *   SELFIE_ARCHIVE_MAX_DOWNLOADS_PER_RUN=50
 *   SELFIE_ARCHIVE_MAX_DELETIONS_PER_RUN=50
 *   SELFIE_ARCHIVE_DRY_RUN=true
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  createWriteStream,
  appendFileSync,
  statSync,
} from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createClient } from '@supabase/supabase-js';
import {
  officeDayCategoryDir,
  officeRelativeDayPath,
  sanitizeFilePart,
  istTimePart,
} from './lib/office-archive-paths.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUCKET = 'attendance-selfies';

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

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** 0 = purge from cloud as soon as a local copy exists (after download pass). */
function parseRetentionHours(value, fallback) {
  const raw = String(value ?? '').trim();
  if (raw === '0') return 0;
  return parsePositiveInt(value, fallback);
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

function guessExtension(url) {
  try {
    const fromUrl = extname(new URL(url).pathname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'].includes(fromUrl)) {
      return fromUrl === '.jpeg' ? '.jpg' : fromUrl;
    }
  } catch {
    // ignore
  }
  return '.jpg';
}

function storagePathFromUrl(url) {
  try {
    const match = new URL(url).pathname.match(/\/attendance-selfies\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function localFileExists(path) {
  try {
    return existsSync(path) && statSync(path).size > 0;
  } catch {
    return false;
  }
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const body = res.body;
  if (!body) throw new Error(`Empty response for ${url}`);
  await pipeline(Readable.fromWeb(body), createWriteStream(destPath));
}

function buildLocalPath(archiveRoot, item) {
  const name = sanitizeFilePart(item.employeeName);
  const time = istTimePart(item.at);
  const idShort = String(item.id).replace(/-/g, '').slice(0, 8);
  const ext = guessExtension(item.selfieUrl);
  const fileName = `${name}_${time}_${idShort}${ext}`;
  const destDir = officeDayCategoryDir(archiveRoot, item.at, 'Attendance');
  const relPath = officeRelativeDayPath(item.at, 'Attendance', fileName);
  return { destDir, destPath: join(destDir, fileName), relPath, fileName };
}

const envFile = loadEnv();
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const archiveRoot = process.env.PHOTOS_ROOT || process.env.SELFIE_ARCHIVE_ROOT;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
if (!archiveRoot) {
  console.error(
    'Missing PHOTOS_ROOT in .env (example: D:\\MalconNexus\\Photos). Legacy: SELFIE_ARCHIVE_ROOT also works.',
  );
  process.exit(1);
}

mkdirSync(archiveRoot, { recursive: true });

const retentionHours = parseRetentionHours(process.env.SELFIE_CLOUD_RETENTION_HOURS, 24);
const maxDownloads = parsePositiveInt(process.env.SELFIE_ARCHIVE_MAX_DOWNLOADS_PER_RUN, 50);
const maxDeletions = parsePositiveInt(process.env.SELFIE_ARCHIVE_MAX_DELETIONS_PER_RUN, 50);
const dryRun = isTruthy(process.env.SELFIE_ARCHIVE_DRY_RUN);
const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
const taskLogPath = join(archiveRoot, '_selfie-archive.log');
const statePath = join(archiveRoot, '_selfie-archive-state.json');

function logLine(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(message);
  appendFileSync(taskLogPath, `${line}\n`, 'utf8');
}

let state = { localPathsByKey: {} };
if (existsSync(statePath)) {
  try {
    state = JSON.parse(readFileSync(statePath, 'utf8'));
    if (!state.localPathsByKey || typeof state.localPathsByKey !== 'object') {
      state = { localPathsByKey: {} };
    }
  } catch {
    state = { localPathsByKey: {} };
  }
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

logLine('=== Malcon Nexus Punch-in Selfie Archive ===');
logLine(`Env file: ${envFile || '(environment variables)'}`);
logLine(`Archive root: ${archiveRoot}`);
logLine(`Cloud retention: ${retentionHours}h (before ${cutoff.toISOString()})`);
logLine(`Dry run: ${dryRun ? 'yes' : 'no'}`);
logLine(`Limits: ${maxDownloads} download(s)/run, ${maxDeletions} deletion(s)/run\n`);

const items = [];

const { data: records, error: recordsError } = await sb
  .from('attendance_records')
  .select('id, employee_name, punched_at, selfie_url')
  .eq('punch_type', 'in')
  .not('selfie_url', 'is', null);

if (recordsError) {
  logLine(`Failed to load attendance_records: ${recordsError.message}`);
  process.exit(1);
}

for (const row of records ?? []) {
  if (!row.selfie_url) continue;
  items.push({
    source: 'attendance_records',
    id: row.id,
    employeeName: row.employee_name || 'Unknown',
    at: row.punched_at,
    selfieUrl: row.selfie_url,
  });
}

const { data: approvals, error: approvalsError } = await sb
  .from('attendance_approval_requests')
  .select('id, employee_name, requested_at, selfie_url')
  .not('selfie_url', 'is', null);

if (approvalsError) {
  logLine(`Failed to load attendance_approval_requests: ${approvalsError.message}`);
  process.exit(1);
}

for (const row of approvals ?? []) {
  if (!row.selfie_url) continue;
  items.push({
    source: 'attendance_approval_requests',
    id: row.id,
    employeeName: row.employee_name || 'Unknown',
    at: row.requested_at,
    selfieUrl: row.selfie_url,
  });
}

logLine(`Found ${items.length} cloud selfie(s) to process.\n`);

let downloaded = 0;
let skippedLocal = 0;
let downloadFailed = 0;
let downloadCapReached = false;
let purged = 0;
let purgeSkippedNoLocal = 0;
let purgeFailed = 0;
let purgeCapReached = false;

for (const item of items) {
  const key = `${item.source}:${item.id}`;
  const { destDir, destPath, relPath, fileName } = buildLocalPath(archiveRoot, item);

  let localPath = state.localPathsByKey[key];
  if (localPath && !localFileExists(localPath)) {
    localPath = null;
  }
  if (!localPath && localFileExists(destPath)) {
    localPath = destPath;
    state.localPathsByKey[key] = destPath;
  }

  if (!localPath) {
    if (downloaded >= maxDownloads) {
      downloadCapReached = true;
    } else {
      mkdirSync(destDir, { recursive: true });
      try {
        if (dryRun) {
          logLine(`[dry-run] would download ${relPath}`);
        } else {
          await downloadToFile(item.selfieUrl, destPath);
          if (!localFileExists(destPath)) {
            throw new Error('Download completed but file missing or empty');
          }
          logLine(`✓ downloaded ${relPath}`);
        }
        localPath = destPath;
        state.localPathsByKey[key] = destPath;
        downloaded += 1;
      } catch (err) {
        downloadFailed += 1;
        logLine(`✗ download failed ${relPath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } else {
    skippedLocal += 1;
  }

  const atMs = new Date(item.at).getTime();
  const isExpired = Number.isFinite(atMs) && atMs < cutoff.getTime();
  if (!isExpired) continue;

  if (purgeCapReached) continue;

  const confirmedLocal = localPath && localFileExists(localPath);
  if (!confirmedLocal) {
    purgeSkippedNoLocal += 1;
    logLine(`⚠ skip purge (no local copy yet): ${item.source} ${item.id}`);
    continue;
  }

  if (purged >= maxDeletions) {
    purgeCapReached = true;
    continue;
  }

  const storagePath = storagePathFromUrl(item.selfieUrl);

  if (dryRun) {
    logLine(`[dry-run] would purge ${item.source} ${item.id} / ${storagePath || item.selfieUrl}`);
    purged += 1;
    continue;
  }

  if (storagePath) {
    const { error: storageError } = await sb.storage.from(BUCKET).remove([storagePath]);
    if (storageError) {
      purgeFailed += 1;
      logLine(`✗ storage delete failed ${storagePath}: ${storageError.message}`);
      continue;
    }
  } else {
    logLine(`⚠ no storage path parsed; clearing DB URL only for ${item.id}`);
  }

  const { error: updateError } = await sb
    .from(item.source)
    .update({ selfie_url: null })
    .eq('id', item.id);

  if (updateError) {
    purgeFailed += 1;
    logLine(`✗ DB clear failed ${item.source} ${item.id}: ${updateError.message}`);
    continue;
  }

  purged += 1;
  logLine(`✓ purged cloud ${item.source} ${item.id} (kept ${localPath})`);
}

writeFileSync(
  statePath,
  JSON.stringify(
    {
      lastRunAt: new Date().toISOString(),
      retentionHours,
      cutoff: cutoff.toISOString(),
      dryRun,
      localPathsByKey: state.localPathsByKey,
    },
    null,
    2,
  ),
  'utf8',
);

logLine('\nDone.');
logLine(`Downloaded: ${downloaded}`);
logLine(`Already on disk: ${skippedLocal}`);
logLine(`Download failed: ${downloadFailed}`);
logLine(`Purged from cloud: ${purged}`);
logLine(`Purge skipped (no local): ${purgeSkippedNoLocal}`);
logLine(`Purge failed: ${purgeFailed}`);
if (downloadCapReached) {
  logLine(`Download cap reached (${maxDownloads}/run). Remaining will sync next run.`);
}
if (purgeCapReached) {
  logLine(`Deletion cap reached (${maxDeletions}/run). Remaining will purge next run.`);
}

if (downloadFailed > 0 || purgeFailed > 0) process.exit(1);
