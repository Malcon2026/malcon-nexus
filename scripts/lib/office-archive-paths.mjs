/**
 * Office PC folder layout (IST calendar dates):
 *
 *   {PHOTOS_ROOT}/
 *     {YYYY}/
 *       {MM}/
 *         {YYYY-MM-DD}/
 *           Cases/
 *             {Employee Name}/
 *               {Case Number}/
 *                 *.jpg
 *           Attendance/
 *             {employee}_{HHmmss}_{id}.jpg
 */

import { join } from 'node:path';

const IST = 'Asia/Kolkata';

/** @returns {{ year: string, month: string, dateKey: string }} */
export function istCalendarParts(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) {
    return { year: 'unknown', month: 'unknown', dateKey: 'unknown-date' };
  }
  const dateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const [year, month] = dateKey.split('-');
  return { year, month, dateKey };
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
  const { year, month, dateKey } = istCalendarParts(iso);
  return join(photosRoot, year, month, dateKey, category);
}

/** Human-readable path under PHOTOS_ROOT for logs. */
export function officeRelativeDayPath(iso, category, ...rest) {
  const { year, month, dateKey } = istCalendarParts(iso);
  return [year, month, dateKey, category, ...rest].filter(Boolean).join('/');
}
