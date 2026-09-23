/**
 * Office PC folder layout (IST calendar dates):
 *
 *   {PHOTOS_ROOT}/
 *     {YYYY}/
 *       {Month name}/          e.g. September
 *         {DD-MM-YYYY}/        e.g. 22-09-2026 — surgery day for Cases, punch day for Attendance
 *           Cases/
 *             {Employee Name}/
 *               {Case Number}/
 *                 *.jpg
 *           Attendance/
 *             {employee}_{HHmmss}_{id}.jpg
 */

import { join } from 'node:path';

const IST = 'Asia/Kolkata';

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
    String(name || 'Unknown Employee')
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'Unknown Employee'
  );
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

/** @param {'Cases' | 'Attendance'} category — day from ISO timestamp (punch time). */
export function officeDayCategoryDir(photosRoot, iso, category) {
  const { year, month, dateFolder } = istCalendarParts(iso);
  return join(photosRoot, year, month, dateFolder, category);
}

/** @param {'Cases' | 'Attendance'} category — day from `YYYY-MM-DD` (case surgery date). */
export function officeDayCategoryDirFromDateKey(photosRoot, dateKey, category) {
  const { year, month, dateFolder } = istCalendarPartsFromDateKey(dateKey);
  return join(photosRoot, year, month, dateFolder, category);
}

/** Human-readable path under PHOTOS_ROOT for logs (ISO day). */
export function officeRelativeDayPath(iso, category, ...rest) {
  const { year, month, dateFolder } = istCalendarParts(iso);
  return [year, month, dateFolder, category, ...rest].filter(Boolean).join('/');
}

/** Human-readable path for case photos (surgery date key). */
export function officeRelativeDayPathFromDateKey(dateKey, category, ...rest) {
  const { year, month, dateFolder } = istCalendarPartsFromDateKey(dateKey);
  return [year, month, dateFolder, category, ...rest].filter(Boolean).join('/');
}
