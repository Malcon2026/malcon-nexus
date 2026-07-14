import type { ImplantCase } from '../types';
import { downloadCsv } from './csv';

export type CaseDateField = 'createdAt' | 'updatedAt' | 'surgeryDate';

export type CaseExportRange =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'custom';

export interface CaseExportOptions {
  range: CaseExportRange;
  dateField?: CaseDateField;
  customFrom?: string;
  customTo?: string;
}

export const CASE_EXPORT_RANGE_LABELS: Record<CaseExportRange, string> = {
  all: 'All time',
  today: 'Today',
  yesterday: 'Yesterday',
  last_7_days: 'Last 7 days',
  last_30_days: 'Last 30 days',
  this_month: 'This month',
  last_month: 'Last month',
  custom: 'Custom range',
};

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

export function getCaseExportBounds(options: CaseExportOptions): { from: string; to: string } | null {
  const { range, customFrom, customTo } = options;
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

function caseDateInIst(isoOrDate: string): string {
  if (!isoOrDate) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return isoOrDate;
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date(isoOrDate));
}

export function filterCasesForExport(
  cases: ImplantCase[],
  options: CaseExportOptions,
): ImplantCase[] {
  const bounds = getCaseExportBounds(options);
  if (!bounds) return cases;

  const field = options.dateField ?? 'createdAt';
  return cases.filter((c) => {
    const raw = c[field];
    if (!raw) return false;
    const date = caseDateInIst(raw);
    return date >= bounds.from && date <= bounds.to;
  });
}

export const CASE_EXPORT_HEADERS = [
  'Case Number',
  'Hospital',
  'Hospital Branch',
  'Doctor',
  'Surgery Date',
  'Implant Required',
  'Implant Type',
  'Priority',
  'Status',
  'Current Stage',
  'Department',
  'Assigned Employee',
  'Created At',
  'Last Updated',
  'Invoice Amount',
  'Collected Amount',
  'Payment Status',
  'Remarks',
];

export function caseToExportRow(c: ImplantCase): unknown[] {
  return [
    c.caseNumber,
    c.hospital.name,
    c.hospital.branch ?? '',
    c.doctor.name,
    c.surgeryDate,
    c.implantRequired,
    c.implantType ?? '',
    c.priority,
    c.status,
    c.currentStage,
    c.currentDepartment ?? '',
    c.assignedEmployee?.name ?? '',
    c.createdAt,
    c.updatedAt,
    c.invoiceAmount ?? 0,
    c.collectedAmount ?? 0,
    c.paymentStatus ?? 'Pending',
    c.remarks ?? '',
  ];
}

export function exportCasesCsv(
  cases: ImplantCase[],
  options: CaseExportOptions,
  filenamePrefix = 'malconnexus_cases',
): { count: number; filename: string } {
  const filtered = filterCasesForExport(cases, options);
  if (filtered.length === 0) {
    throw new Error('No cases match the selected date range.');
  }

  const rangeSlug =
    options.range === 'custom' && options.customFrom && options.customTo
      ? `${options.customFrom}_to_${options.customTo}`
      : options.range;
  const filename = `${filenamePrefix}_${rangeSlug}_${new Date().toISOString().slice(0, 10)}.csv`;

  downloadCsv(
    filename,
    CASE_EXPORT_HEADERS,
    filtered.map(caseToExportRow),
  );

  return { count: filtered.length, filename };
}
