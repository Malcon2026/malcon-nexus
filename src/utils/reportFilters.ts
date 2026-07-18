/** Shared date-range filtering for report exports (IST). */

export type ReportDateRange =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'custom';

export interface ReportDateFilter {
  range: ReportDateRange;
  customFrom?: string;
  customTo?: string;
}

export const REPORT_DATE_RANGE_LABELS: Record<ReportDateRange, string> = {
  all: 'All time',
  today: 'Today',
  yesterday: 'Yesterday',
  last_7_days: 'Last 7 days',
  last_30_days: 'Last 30 days',
  this_month: 'This month',
  last_month: 'Last month',
  custom: 'Custom range',
};

export const REPORT_DATE_RANGE_OPTIONS: ReportDateRange[] = [
  'all',
  'today',
  'yesterday',
  'last_7_days',
  'last_30_days',
  'this_month',
  'last_month',
  'custom',
];

const IST = 'Asia/Kolkata';

function istDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
  };
}

function istDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDays(year: number, month: number, day: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function getReportDateBounds(filter: ReportDateFilter): { from: string; to: string } | null {
  const { range, customFrom, customTo } = filter;
  if (range === 'all') return null;

  const now = istDateParts();
  const today = istDateString(now.year, now.month, now.day);

  if (range === 'today') return { from: today, to: today };

  if (range === 'yesterday') {
    const y = addDays(now.year, now.month, now.day, -1);
    const date = istDateString(y.year, y.month, y.day);
    return { from: date, to: date };
  }

  if (range === 'last_7_days') {
    const start = addDays(now.year, now.month, now.day, -6);
    return { from: istDateString(start.year, start.month, start.day), to: today };
  }

  if (range === 'last_30_days') {
    const start = addDays(now.year, now.month, now.day, -29);
    return { from: istDateString(start.year, start.month, start.day), to: today };
  }

  if (range === 'this_month') {
    return { from: istDateString(now.year, now.month, 1), to: today };
  }

  if (range === 'last_month') {
    const firstOfThisMonth = new Date(Date.UTC(now.year, now.month - 1, 1));
    const lastMonthEnd = new Date(firstOfThisMonth.getTime() - 86400000);
    const lm = istDateParts(lastMonthEnd);
    return {
      from: istDateString(lm.year, lm.month, 1),
      to: istDateString(lm.year, lm.month, lm.day),
    };
  }

  if (range === 'custom') {
    if (!customFrom || !customTo) {
      throw new Error('Select both start and end dates for a custom range.');
    }
    if (customFrom > customTo) {
      throw new Error('Start date must be on or before end date.');
    }
    return { from: customFrom, to: customTo };
  }

  return null;
}

export function toIstDateKey(isoOrDate: string): string {
  if (!isoOrDate) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return isoOrDate;
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date(isoOrDate));
}

export function isDateKeyInRange(dateKey: string, filter: ReportDateFilter): boolean {
  const bounds = getReportDateBounds(filter);
  if (!bounds) return true;
  return dateKey >= bounds.from && dateKey <= bounds.to;
}

export function isTimestampInRange(iso: string, filter: ReportDateFilter): boolean {
  return isDateKeyInRange(toIstDateKey(iso), filter);
}

/** Inclusive list of YYYY-MM-DD keys from `from` to `to`. */
export function listDateKeys(from: string, to: string): string[] {
  const keys: string[] = [];
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  let cur = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  while (cur <= end) {
    const d = new Date(cur);
    keys.push(istDateString(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
    cur += 86400000;
  }
  return keys;
}

export function reportRangeSlug(filter: ReportDateFilter): string {
  if (filter.range === 'custom' && filter.customFrom && filter.customTo) {
    return `${filter.customFrom}_to_${filter.customTo}`;
  }
  return filter.range;
}
