import type { ImplantCase } from '../types';
import { downloadCsv } from './csv';
import {
  getReportDateBounds,
  reportRangeSlug,
  toIstDateKey,
  type ReportDateFilter,
} from './reportFilters';

export type CaseDateField = 'createdAt' | 'updatedAt' | 'surgeryDate';

export type CaseExportRange = ReportDateFilter['range'];
export type CaseExportOptions = ReportDateFilter & { dateField?: CaseDateField };

export {
  REPORT_DATE_RANGE_LABELS as CASE_EXPORT_RANGE_LABELS,
  REPORT_DATE_RANGE_OPTIONS,
} from './reportFilters';

export function getCaseExportBounds(options: ReportDateFilter): { from: string; to: string } | null {
  return getReportDateBounds(options);
}

export function filterCasesForExport(
  cases: ImplantCase[],
  options: CaseExportOptions,
): ImplantCase[] {
  const bounds = getReportDateBounds(options);
  if (!bounds) return cases;

  const field = options.dateField ?? 'createdAt';
  return cases.filter((c) => {
    const raw = c[field];
    if (!raw) return false;
    const date = toIstDateKey(raw);
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

  const filename = `${filenamePrefix}_${reportRangeSlug(options)}_${new Date().toISOString().slice(0, 10)}.csv`;

  downloadCsv(
    filename,
    CASE_EXPORT_HEADERS,
    filtered.map(caseToExportRow),
  );

  return { count: filtered.length, filename };
}
