#!/usr/bin/env node
/**
 * Move legacy office photo folders (e.g. 23092026) into the current layout:
 *   {PHOTOS_ROOT}/{YYYY}/{Month}/{DD-MM-YYYY}/{IMP 279}/{Set Preparation|Delivery|…}/*.jpg
 *   {PHOTOS_ROOT}/{YYYY}/{Month}/{DD-MM-YYYY}/Attendance/*.jpg
 *
 * Run on the office server (dry-run first):
 *   node scripts/migrate-office-photos-layout.mjs
 *   node scripts/migrate-office-photos-layout.mjs --execute
 *
 * Requires PHOTOS_ROOT in .env (same as photo sync).
 */

import {
  readFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  renameSync,
  copyFileSync,
  unlinkSync,
  rmSync,
} from 'node:fs';
import { resolve, dirname, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  officeCaseStagePhotoDir,
  officeAttendanceDir,
  caseFolderName,
  stageFolderName,
  istCalendarPartsFromDateKey,
} from './lib/office-archive-paths.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const WORKFLOW_STAGES = [
  'Set Preparation',
  'Delivery',
  'Surgery',
  'Pickup from Hospital',
  'Cleaning & Audit',
  'Restock',
  'Billing',
  'Bill Submission',
  'Completed',
];

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);

const SKIP_DIR_NAMES = new Set([
  '_OLD data',
  '_OLD employee folders',
  'node_modules',
]);

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

/** DDMMYYYY → { dateKey: YYYY-MM-DD, dateFolder: DD-MM-YYYY } */
export function parseDdmmyyyyFolder(name) {
  const m = String(name).match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!m) return null;
  const [, day, month, year] = m;
  return {
    dateKey: `${year}-${month}-${day}`,
    dateFolder: `${day}-${month}-${year}`,
  };
}

function parseDdMmYyyyFolder(name) {
  const m = String(name).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const [, day, month, year] = m;
  return {
    dateKey: `${year}-${month}-${day}`,
    dateFolder: `${day}-${month}-${year}`,
  };
}

function isImageFile(name) {
  return IMAGE_EXT.has(extname(name).toLowerCase());
}

function shouldSkipDir(name) {
  if (name.startsWith('_')) return true;
  if (SKIP_DIR_NAMES.has(name)) return true;
  return false;
}

function normalizeStageToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stageFromFolderName(folderName) {
  const token = normalizeStageToken(folderName);
  if (token === 'stage pics') return null;
  if (token === 'cases' || token === 'attendance') return null;
  for (const stage of WORKFLOW_STAGES) {
    if (normalizeStageToken(stage) === token) return stage;
  }
  return null;
}

function stageFromFileName(fileName) {
  for (const stage of WORKFLOW_STAGES) {
    const prefix = stage.replace(/ & /g, '-').replace(/ /g, '-');
    if (fileName.startsWith(`${prefix}-`)) return stage;
  }
  const head = fileName.split('-202')[0]?.split('-20')[0];
  if (head && head.includes('-')) {
    const guess = head.replace(/-/g, ' ').replace('Cleaning Audit', 'Cleaning & Audit');
    const fromList = stageFromFolderName(guess);
    if (fromList) return fromList;
  }
  return 'Unknown stage';
}

function caseNumberFromPathPart(part) {
  const raw = String(part || '').trim();
  if (/^IMP-\d{4}-\d+$/i.test(raw)) return raw;
  const fullSpaced = raw.match(/^IMP\s+(\d{4})\s+(\d+)$/i);
  if (fullSpaced) return `IMP-${fullSpaced[1]}-${fullSpaced[2]}`;
  const spaced = raw.match(/^IMP\s+(\d+)$/i);
  if (spaced) {
    const year = new Date().getFullYear();
    return `IMP-${year}-${Number.parseInt(spaced[1], 10)}`;
  }
  return null;
}

function findCaseNumber(pathParts) {
  for (let i = pathParts.length - 1; i >= 0; i -= 1) {
    const n = caseNumberFromPathPart(pathParts[i]);
    if (n) return n;
    if (/^IMP-\d{4}-\d+$/i.test(pathParts[i])) return pathParts[i];
  }
  return null;
}

function isAttendancePath(pathParts) {
  return pathParts.some((p) => normalizeStageToken(p) === 'attendance');
}

function isAlreadyInNewLayout(photosRoot, absoluteFile) {
  const rel = absoluteFile.slice(photosRoot.length + 1).replace(/\\/g, '/');
  const parts = rel.split('/');
  if (parts.length < 5) return false;
  const datePart = parts[2];
  if (!/^\d{2}-\d{2}-\d{4}$/.test(datePart)) return false;
  if (parts[3] === 'Attendance') return true;
  if (/^IMP \d+$/i.test(parts[3]) && parts[4]) {
    return stageFromFolderName(parts[4]) !== null || parts[4] === 'Unknown stage';
  }
  return false;
}

function collectFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue;
      collectFiles(join(dir, entry.name), out);
    } else if (entry.isFile() && isImageFile(entry.name)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

function findLegacyDateRoots(photosRoot) {
  const roots = [];

  function walk(dir, depth) {
    if (depth > 8) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || shouldSkipDir(entry.name)) continue;
      const full = join(dir, entry.name);
      const ddmmyyyy = parseDdmmyyyyFolder(entry.name);
      if (ddmmyyyy) {
        roots.push({ legacyDir: full, ...ddmmyyyy, kind: 'DDMMYYYY' });
        continue;
      }
      walk(full, depth + 1);
    }
  }

  walk(photosRoot, 0);
  return roots;
}

function resolveTarget(photosRoot, dateKey, legacyRelativeParts, fileName) {
  if (isAttendancePath(legacyRelativeParts)) {
    const { year, month, dateFolder } = istCalendarPartsFromDateKey(dateKey);
    const atIso = `${dateKey}T12:00:00+05:30`;
    return join(officeAttendanceDir(photosRoot, atIso), fileName);
  }

  let caseNumber = findCaseNumber(legacyRelativeParts);
  if (!caseNumber) {
    caseNumber = `IMP-${dateKey.slice(0, 4)}-000`;
  }

  let stage =
    [...legacyRelativeParts].reverse().map(stageFromFolderName).find(Boolean) ||
    stageFromFileName(fileName);

  if (legacyRelativeParts.some((p) => normalizeStageToken(p) === 'stage pics')) {
    stage = stageFromFileName(fileName);
  }

  return join(officeCaseStagePhotoDir(photosRoot, dateKey, caseNumber, stage), fileName);
}

function safeMove(src, dest, execute) {
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) {
    try {
      if (statSync(src).size === statSync(dest).size) return 'skipped-duplicate';
    } catch {
      return 'skipped-error';
    }
    const base = basename(dest, extname(dest));
    dest = join(dirname(dest), `${base}-migrated${extname(dest)}`);
  }
  if (!execute) return 'would-move';
  try {
    renameSync(src, dest);
  } catch {
    copyFileSync(src, dest);
    unlinkSync(src);
  }
  return 'moved';
}

function removeEmptyDirs(dir, photosRoot) {
  if (dir === photosRoot) return;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  if (entries.length > 0) return;
  try {
    rmSync(dir, { recursive: true });
  } catch {
    // ignore
  }
  removeEmptyDirs(dirname(dir), photosRoot);
}

const execute = process.argv.includes('--execute');
const envFile = loadEnv();
const photosRoot = process.env.PHOTOS_ROOT;

if (!photosRoot) {
  console.error('Missing PHOTOS_ROOT in .env');
  process.exit(1);
}
if (!existsSync(photosRoot)) {
  console.error(`PHOTOS_ROOT does not exist: ${photosRoot}`);
  process.exit(1);
}

console.log('=== Malcon Nexus — migrate photo folders ===');
console.log(`Env: ${envFile || '(environment)'}`);
console.log(`Root: ${photosRoot}`);
console.log(`Mode: ${execute ? 'EXECUTE (moving files)' : 'DRY RUN (preview only)'}`);
console.log('Pass --execute to apply moves.\n');

const legacyRoots = findLegacyDateRoots(photosRoot);
if (legacyRoots.length === 0) {
  console.log('No legacy DDMMYYYY folders (e.g. 23092026) found under PHOTOS_ROOT.');
  process.exit(0);
}

let wouldMove = 0;
let moved = 0;
let skipped = 0;
let skippedAlready = 0;

for (const { legacyDir, dateKey, dateFolder, kind } of legacyRoots) {
  console.log(`\nLegacy ${kind} folder: ${legacyDir} → date ${dateFolder} (${dateKey})`);
  const files = collectFiles(legacyDir);
  console.log(`  ${files.length} image(s) inside`);

  for (const filePath of files) {
    if (isAlreadyInNewLayout(photosRoot, filePath)) {
      skippedAlready += 1;
      continue;
    }

    const relInside = filePath.slice(legacyDir.length + 1);
    const parts = relInside.split(/[/\\]/).filter(Boolean);
    const fileName = basename(filePath);
    const dest = resolveTarget(photosRoot, dateKey, parts, fileName);

    if (dest.startsWith(legacyDir)) {
      skipped += 1;
      continue;
    }

    const result = safeMove(filePath, dest, execute);
    if (result === 'would-move') {
      wouldMove += 1;
      console.log(`  → ${dest.replace(photosRoot, '').replace(/^[/\\]/, '')}`);
    } else if (result === 'moved') {
      moved += 1;
      console.log(`  ✓ ${dest.replace(photosRoot, '').replace(/^[/\\]/, '')}`);
    } else {
      skipped += 1;
    }
  }

  if (execute) {
    removeEmptyDirs(legacyDir, photosRoot);
  }
}

console.log('\n--- Summary ---');
console.log(`Legacy date folders found: ${legacyRoots.length}`);
if (execute) {
  console.log(`Moved: ${moved}`);
} else {
  console.log(`Would move: ${wouldMove}`);
}
console.log(`Skipped (duplicate / unknown): ${skipped}`);
console.log(`Already in new layout: ${skippedAlready}`);

if (!execute && wouldMove > 0) {
  console.log('\nRun again with --execute to apply.');
}
