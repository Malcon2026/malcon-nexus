/**
 * Office PC folder layout (IST calendar dates):
 *
 *   Cases (by surgery date):
 *     {PHOTOS_ROOT}/{YYYY}/{Month}/{DD-MM-YYYY}/{Case number}/Stage pics/*.jpg
 *
 *   Attendance (by punch date):
 *     {PHOTOS_ROOT}/{YYYY}/{Month}/{DD-MM-YYYY}/Attendance/*.jpg
 */

import { join } from 'node:path';

const IST = 'Asia/Kolkata';
export const CASE_STAGE_PICS_FOLDER = 'Stage pics';

function partsFromYmd(year, monthNum, day) {
  const dateFolder = `${day}-${monthNum}-${year}`;
  const month = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    month: 'long',
  }).format(new Date(Date.UTC(Number(year), Number(monthNum) - 1, Number(day), 12, 0, 0)));
  return { year, month, dateFolder };
}

/** @returns {{ year: string, month: string, dateFolder: string }} */
export function istCalendarParts(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) {
    return { year: 'unknown', month: 'unknown', dateFolder: 'unknown-date' };
  }

  const numeric = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const pick = (type) => numeric.find((p) => p.type === type)?.value ?? '';

  return partsFromYmd(pick('year'), pick('month'), pick('day'));
}

/** Surgery / calendar date key from Supabase (`YYYY-MM-DD`). */
export function istCalendarPartsFromDateKey(dateKey) {
  const raw = String(dateKey || '').trim().slice(0, 10);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return { year: 'unknown', month: 'unknown', dateFolder: 'unknown-date' };
  }
  return partsFromYmd(m[1], m[2], m[3]);
}

/** IST `YYYY-MM-DD` from an ISO timestamp (attendance fallback). */
export function istDateKeyFromIso(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function sanitizeFolderName(name) {
  return (
    String(name || 'Unknown')
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'Unknown'
  );
}

/** Case folder e.g. IMP-2026-279 → IMP 2026 279 */
export function caseFolderName(caseNumber) {
  return sanitizeFolderName(String(caseNumber || 'Unknown case').replace(/-/g, ' '));
}

export function sanitizeFilePart(value) {
  return (
    String(value || 'file')
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .trim()
      .slice(0, 60) || 'file'
  );
}

/** IST HHmmss for attendance filenames. */
export function istTimePart(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '000000';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('hour')}${get('minute')}${get('second')}`;
}

export function officeDayDirFromDateKey(photosRoot, dateKey) {
  const { year, month, dateFolder } = istCalendarPartsFromDateKey(dateKey);
  return join(photosRoot, year, month, dateFolder);
}

/** {Year}/{Month}/{Date}/{Case}/Stage pics */
export function officeCaseStagePicsDir(photosRoot, surgeryDateKey, caseNumber) {
  return join(
    officeDayDirFromDateKey(photosRoot, surgeryDateKey),
    caseFolderName(caseNumber),
    CASE_STAGE_PICS_FOLDER,
  );
}

/** Punch-in selfies for that calendar day. */
export function officeAttendanceDir(photosRoot, iso) {
  const { year, month, dateFolder } = istCalendarParts(iso);
  return join(photosRoot, year, month, dateFolder, 'Attendance');
}

/** Log path under PHOTOS_ROOT for case photos. */
export function officeCasePhotoRelativePath(surgeryDateKey, caseNumber, fileName) {
  const { year, month, dateFolder } = istCalendarPartsFromDateKey(surgeryDateKey);
  return [year, month, dateFolder, caseFolderName(caseNumber), CASE_STAGE_PICS_FOLDER, fileName]
    .filter(Boolean)
    .join('/');
}

/** Log path for attendance. */
export function officeRelativeDayPath(iso, category, ...rest) {
  const { year, month, dateFolder } = istCalendarParts(iso);
  return [year, month, dateFolder, category, ...rest].filter(Boolean).join('/');
}
