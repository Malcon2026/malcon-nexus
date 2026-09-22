/**
 * Office PC folder layout (IST calendar dates):
 *
 *   {PHOTOS_ROOT}/
 *     {YYYY}/
 *       {Month name}/          e.g. September
 *         {DDMMYYYY}/          e.g. 22092026
 *           Cases/
 *             {Employee Name}/
 *               {Case Number}/
 *                 *.jpg
 *           Attendance/
 *             {employee}_{HHmmss}_{id}.jpg
 */

import { join } from 'node:path';

const IST = 'Asia/Kolkata';

/** @returns {{ year: string, month: string, dateFolder: string }} */
export function istCalendarParts(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) {
    return { year: 'unknown', month: 'unknown', dateFolder: 'unknown-date' };
  }

  const named = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    year: 'numeric',
    month: 'long',
  }).formatToParts(d);
  const numeric = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const pick = (parts, type) => parts.find((p) => p.type === type)?.value ?? '';

  const year = pick(named, 'year');
  const month = pick(named, 'month');
  const day = pick(numeric, 'day');
  const monthNum = pick(numeric, 'month');
  const dateFolder = `${day}${monthNum}${year}`;

  return { year, month, dateFolder };
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

/** @param {'Cases' | 'Attendance'} category */
export function officeDayCategoryDir(photosRoot, iso, category) {
  const { year, month, dateFolder } = istCalendarParts(iso);
  return join(photosRoot, year, month, dateFolder, category);
}

/** Human-readable path under PHOTOS_ROOT for logs. */
export function officeRelativeDayPath(iso, category, ...rest) {
  const { year, month, dateFolder } = istCalendarParts(iso);
  return [year, month, dateFolder, category, ...rest].filter(Boolean).join('/');
}
