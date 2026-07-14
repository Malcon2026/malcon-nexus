#!/usr/bin/env node
/**
 * Delete stage photos older than N days from Supabase storage + case records.
 * Local copies under PHOTOS_ROOT are kept (office server archive).
 *
 * Schedule daily on the office server (Task Scheduler).
 *
 * Required .env:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PHOTOS_ROOT=D:\MalconNexus\Photos
 *
 * Optional:
 *   PHOTOS_CLEANUP_RETENTION_DAYS=30
 *   PHOTOS_CLEANUP_MAX_DELETIONS_PER_RUN=50
 *   PHOTOS_CLEANUP_DRY_RUN=true   # log only, no deletes
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

function isImageDocument(doc) {
  if (!doc?.url || String(doc.url).startsWith('data:')) return false;
  const type = String(doc.type || '');
  const name = String(doc.name || '');
  return (
    type.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(name) ||
    /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(doc.url)
  );
}

function storagePathFromUrl(url) {
  try {
    const match = new URL(url).pathname.match(/\/stage-photos\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function isExpired(uploadedAt, cutoff) {
  const uploaded = new Date(uploadedAt);
  return Number.isFinite(uploaded.getTime()) && uploaded < cutoff;
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

const retentionDays = parsePositiveInt(process.env.PHOTOS_CLEANUP_RETENTION_DAYS, 30);
const maxDeletions = parsePositiveInt(process.env.PHOTOS_CLEANUP_MAX_DELETIONS_PER_RUN, 50);
const dryRun = isTruthy(process.env.PHOTOS_CLEANUP_DRY_RUN);
const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
const purgeLogPath = join(photosRoot, '_purge-log.json');
const taskLogPath = join(photosRoot, '_purge-task.log');

function logLine(message) {
  console.log(message);
  appendFileSync(taskLogPath, `${message}\n`, 'utf8');
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

logLine('=== Malcon Nexus Photo Cleanup ===');
logLine(`Env file: ${envFile || '(environment variables)'}`);
logLine(`Retention: ${retentionDays} day(s) (before ${cutoff.toISOString()})`);
logLine(`Max deletions/run: ${maxDeletions}`);
logLine(`Dry run: ${dryRun ? 'yes' : 'no'}\n`);

const { data: cases, error } = await sb
  .from('cases')
  .select('id, case_number, stages')
  .order('updated_at', { ascending: false });

if (error) {
  logLine(`Failed to load cases: ${error.message}`);
  process.exit(1);
}

let deleted = 0;
let failed = 0;
let casesUpdated = 0;
let expiredFound = 0;
let capReached = false;
const deletedEntries = [];

for (const caseRow of cases ?? []) {
  if (capReached) break;

  const stages = Array.isArray(caseRow.stages) ? caseRow.stages : [];
  const pathsToDelete = [];
  let caseDirty = false;

  const updatedStages = stages.map((stageRecord) => {
    const documents = Array.isArray(stageRecord?.documents) ? stageRecord.documents : [];
    const kept = [];
    const stageRemoved = [];

    for (const doc of documents) {
      if (!isImageDocument(doc) || !isExpired(doc.uploadedAt, cutoff)) {
        kept.push(doc);
        continue;
      }

      expiredFound += 1;
      if (capReached) {
        kept.push(doc);
        continue;
      }

      stageRemoved.push(doc);
      pathsToDelete.push({
        doc,
        storagePath: storagePathFromUrl(doc.url),
      });
      deleted += 1;

      if (deleted >= maxDeletions) {
        capReached = true;
      }
    }

    if (stageRemoved.length === 0) {
      return stageRecord;
    }

    caseDirty = true;
    return { ...stageRecord, documents: kept };
  });

  if (!caseDirty) continue;

  const casePaths = pathsToDelete
    .map((entry) => entry.storagePath)
    .filter(Boolean);

  const caseNumber = caseRow.case_number || caseRow.id;

  if (dryRun) {
    for (const entry of pathsToDelete) {
      logLine(`[dry-run] would delete ${caseNumber} / ${entry.doc.id} / ${entry.storagePath || entry.doc.url}`);
      deletedEntries.push({
        caseId: caseRow.id,
        caseNumber,
        documentId: entry.doc.id,
        storagePath: entry.storagePath,
        uploadedAt: entry.doc.uploadedAt,
      });
    }
    casesUpdated += 1;
    continue;
  }

  if (casePaths.length > 0) {
    const { error: storageError } = await sb.storage.from('stage-photos').remove(casePaths);
    if (storageError) {
      failed += casePaths.length;
      logLine(`✗ storage delete failed for ${caseNumber}: ${storageError.message}`);
      continue;
    }
  }

  const { error: updateError } = await sb
    .from('cases')
    .update({ stages: updatedStages })
    .eq('id', caseRow.id);

  if (updateError) {
    failed += pathsToDelete.length;
    logLine(`✗ case update failed for ${caseNumber}: ${updateError.message}`);
    continue;
  }

  casesUpdated += 1;
  for (const entry of pathsToDelete) {
    logLine(`✓ deleted ${caseNumber} / ${entry.doc.id} / ${entry.storagePath || 'no-storage-path'}`);
    deletedEntries.push({
      caseId: caseRow.id,
      caseNumber,
      documentId: entry.doc.id,
      storagePath: entry.storagePath,
      uploadedAt: entry.doc.uploadedAt,
      deletedAt: new Date().toISOString(),
    });
  }
}

writeFileSync(
  purgeLogPath,
  JSON.stringify(
    {
      lastRunAt: new Date().toISOString(),
      retentionDays,
      cutoff: cutoff.toISOString(),
      dryRun,
      expiredFound,
      deleted,
      failed,
      casesUpdated,
      deletedEntries,
    },
    null,
    2,
  ),
  'utf8',
);

logLine('\nDone.');
logLine(`Expired found: ${expiredFound}`);
logLine(`Deleted: ${deleted}`);
logLine(`Cases updated: ${casesUpdated}`);
logLine(`Failed: ${failed}`);
if (capReached) {
  logLine(`Deletion cap reached (${maxDeletions}/run). Remaining photos will be purged on the next run.`);
}

if (failed > 0) process.exit(1);
