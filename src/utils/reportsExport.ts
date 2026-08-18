import type {
  ActivityEvent,
  AttendanceApprovalRequest,
  AttendanceRecord,
  DailyExpense,
  Employee,
  Hospital,
  ImplantCase,
  LeaveRequest,
} from '../types';
import { downloadCsv } from './csv';
import { formatCurrency, formatDateTime } from './helpers';
import {
  getReportDateBounds,
  isDateKeyInRange,
  isTimestampInRange,
  reportRangeSlug,
  toIstDateKey,
  type ReportDateFilter,
} from './reportFilters';
import { filterCasesForExport, type CaseExportOptions } from './caseExport';
import { calculateKmIncentive, KM_INCENTIVE_RULE_LABEL } from '../lib/kmIncentive';
import { getISTDateKey, formatTimeIST } from '../lib/attendance';
import {
  buildAttendanceRegisterForRange,
  REGISTER_CELL_STYLES,
  type RegisterCellCode,
} from '../lib/attendanceRegister';

function exportFilename(prefix: string, filter: ReportDateFilter): string {
  return `${prefix}_${reportRangeSlug(filter)}_${new Date().toISOString().slice(0, 10)}.csv`;
}

function slugName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'employee';
}

export function filterActivityForExport(events: ActivityEvent[], filter: ReportDateFilter): ActivityEvent[] {
  return events.filter((e) => isTimestampInRange(e.timestamp, filter));
}

export function filterAttendanceRecordsForExport(
  records: AttendanceRecord[],
  filter: ReportDateFilter,
): AttendanceRecord[] {
  return records.filter((r) => isTimestampInRange(r.punchedAt, filter));
}

export function filterAttendanceApprovalsForExport(
  requests: AttendanceApprovalRequest[],
  filter: ReportDateFilter,
): AttendanceApprovalRequest[] {
  return requests.filter((r) => isTimestampInRange(r.requestedAt, filter));
}

export function filterEmployeesForExport(employees: Employee[], filter: ReportDateFilter): Employee[] {
  return employees.filter((e) => {
    if (filter.range === 'all') return true;
    return isTimestampInRange(e.joinDate, filter);
  });
}

export function resolveAttendanceRange(
  filter: ReportDateFilter,
  records: AttendanceRecord[],
  leaveRequests: LeaveRequest[] = [],
): { from: string; to: string } {
  const bounds = getReportDateBounds(filter);
  if (bounds) return bounds;

  const keys = [
    ...records.map((r) => toIstDateKey(r.punchedAt)),
    ...leaveRequests.flatMap((l) => [l.fromDate, l.toDate].map(toIstDateKey)),
  ].filter(Boolean);
  if (keys.length === 0) {
    throw new Error('No attendance data available. Pick a date range, or wait until staff have punched in.');
  }
  keys.sort();
  return { from: keys[0], to: getISTDateKey() };
}

export interface AttendanceDayWiseRow {
  employeeCode: string;
  employeeName: string;
  department: string;
  date: string;
  weekday: string;
  code: RegisterCellCode;
  status: string;
  punchIn: string;
  punchOut: string;
  hours: string;
  leaveType: string;
  leaveReason: string;
}

export function buildAttendanceDayWiseRows(
  employees: Employee[],
  records: AttendanceRecord[],
  leaveRequests: LeaveRequest[],
  filter: ReportDateFilter,
  employeeId?: string,
): AttendanceDayWiseRow[] {
  const { from, to } = resolveAttendanceRange(filter, records, leaveRequests);
  const register = buildAttendanceRegisterForRange(
    employees,
    records,
    leaveRequests,
    from,
    to,
    employeeId ? { employeeId } : undefined,
  );

  const rows: AttendanceDayWiseRow[] = [];
  for (const emp of register.rows) {
    emp.cells.forEach((cell, i) => {
      const day = register.days[i];
      if (!day) return;
      rows.push({
        employeeCode: emp.employeeCode,
        employeeName: emp.employeeName,
        department: emp.department,
        date: day.dateKey,
        weekday: day.weekday,
        code: cell.code,
        status: REGISTER_CELL_STYLES[cell.code]?.title ?? cell.label,
        punchIn: cell.punchInTime ?? '',
        punchOut: cell.punchOutTime ?? '',
        hours: cell.workedDuration ?? '',
        leaveType: cell.leaveType ?? '',
        leaveReason: cell.leaveReason ?? '',
      });
    });
  }
  return rows;
}

export function exportAttendanceDayWiseCsv(
  employees: Employee[],
  records: AttendanceRecord[],
  leaveRequests: LeaveRequest[],
  filter: ReportDateFilter,
  employeeId?: string,
): { count: number; filename: string } {
  const rows = buildAttendanceDayWiseRows(employees, records, leaveRequests, filter, employeeId);
  if (rows.length === 0) {
    throw new Error('No attendance rows for the selected range.');
  }

  const person = employeeId ? employees.find((e) => e.id === employeeId) : null;
  if (employeeId && person) {
    const filename = exportFilename(`attendance_${slugName(person.name)}`, filter);
    downloadCsv(
      filename,
      ['Date', 'Day', 'Punch In', 'Punch Out', 'Hours', 'Status'],
      rows.map((r) => [r.date, r.weekday, r.punchIn, r.punchOut, r.hours, r.status]),
    );
    return { count: rows.length, filename };
  }

  const filename = exportFilename('attendance_daywise', filter);
  downloadCsv(
    filename,
    [
      'Employee ID',
      'Employee',
      'Department',
      'Date',
      'Day',
      'Code',
      'Status',
      'Punch In',
      'Punch Out',
      'Hours',
      'Leave type',
      'Leave reason',
    ],
    rows.map((r) => [
      r.employeeCode,
      r.employeeName,
      r.department,
      r.date,
      r.weekday,
      r.code,
      r.status,
      r.punchIn,
      r.punchOut,
      r.hours,
      r.leaveType,
      r.leaveReason,
    ]),
  );
  return { count: rows.length, filename };
}

export function exportAttendanceGridCsv(
  employees: Employee[],
  records: AttendanceRecord[],
  leaveRequests: LeaveRequest[],
  filter: ReportDateFilter,
  employeeId?: string,
): { count: number; filename: string } {
  const { from, to } = resolveAttendanceRange(filter, records, leaveRequests);
  const register = buildAttendanceRegisterForRange(
    employees,
    records,
    leaveRequests,
    from,
    to,
    employeeId ? { employeeId } : undefined,
  );
  if (register.rows.length === 0) {
    throw new Error('No staff rows for the selected range.');
  }

  const filename = exportFilename('attendance_grid', filter);
  const dayHeaders = register.days.map((d) => {
    const [, m, day] = d.dateKey.split('-');
    return `${day}-${m} (${d.weekday})`;
  });
  downloadCsv(
    filename,
    ['Employee ID', 'Employee', 'Department', ...dayHeaders, 'Present days', 'Unpaid / Absent', 'Leave', 'Week off'],
    register.rows.map((row) => {
      const present = row.cells.filter((c) => c.code === 'P' || c.code === 'PI').length;
      const unpaid = row.cells.filter((c) => c.code === 'UL' || c.code === 'A').length;
      const leave = row.cells.filter((c) => ['CL', 'SL', 'L', 'CO', 'PL'].includes(c.code)).length;
      const weekOff = row.cells.filter((c) => c.code === 'WO').length;
      return [
        row.employeeCode,
        row.employeeName,
        row.department,
        ...row.cells.map((c) => c.code),
        present,
        unpaid,
        leave,
        weekOff,
      ];
    }),
  );
  return { count: register.rows.length, filename };
}

/** @deprecated Use buildAttendanceDayWiseRows */
export function buildAttendanceSummaryRows(
  employees: Employee[],
  records: AttendanceRecord[],
  filter: ReportDateFilter,
  leaveRequests: LeaveRequest[] = [],
  employeeId?: string,
) {
  return buildAttendanceDayWiseRows(employees, records, leaveRequests, filter, employeeId);
}

/** @deprecated Use exportAttendanceDayWiseCsv */
export function exportAttendanceSummaryCsv(
  employees: Employee[],
  records: AttendanceRecord[],
  filter: ReportDateFilter,
  leaveRequests: LeaveRequest[] = [],
  employeeId?: string,
) {
  return exportAttendanceDayWiseCsv(employees, records, leaveRequests, filter, employeeId);
}

export function exportAttendancePunchesCsv(
  records: AttendanceRecord[],
  filter: ReportDateFilter,
): { count: number; filename: string } {
  const filtered = filterAttendanceRecordsForExport(records, filter);
  if (filtered.length === 0) {
    throw new Error('No punch records match the selected date range.');
  }

  const filename = exportFilename('attendance_punches', filter);
  downloadCsv(
    filename,
    ['Date', 'Employee', 'Punch Type', 'Time', 'Within Office', 'Distance (m)', 'Office'],
    filtered.map((r) => [
      toIstDateKey(r.punchedAt),
      r.employeeName,
      r.punchType,
      formatTimeIST(r.punchedAt),
      r.withinOffice ? 'Yes' : 'No',
      r.distanceM,
      r.officeAddress,
    ]),
  );
  return { count: filtered.length, filename };
}

export function exportEmployeesCsv(
  employees: Employee[],
  filter: ReportDateFilter,
): { count: number; filename: string } {
  const filtered = filterEmployeesForExport(
    employees.filter((e) => e.role === 'employee'),
    filter,
  );
  if (filtered.length === 0) {
    throw new Error('No employees match the selected date range.');
  }

  const filename = exportFilename('employees', filter);
  downloadCsv(
    filename,
    ['Name', 'Employee ID', 'Email', 'Department', 'Role', 'Status', 'Phone', 'Cases Completed', 'Active Cases', 'Join Date'],
    filtered.map((e) => [
      e.name,
      e.employeeCode || '',
      e.email,
      e.department,
      e.role,
      e.status,
      e.phone,
      e.casesCompleted,
      e.casesActive,
      e.joinDate,
    ]),
  );
  return { count: filtered.length, filename };
}

export function exportActivityCsv(
  events: ActivityEvent[],
  filter: ReportDateFilter,
): { count: number; filename: string } {
  const filtered = filterActivityForExport(events, filter);
  if (filtered.length === 0) {
    throw new Error('No activity events match the selected date range.');
  }

  const filename = exportFilename('activity', filter);
  downloadCsv(
    filename,
    ['Timestamp', 'Action', 'Entity Type', 'Entity', 'Performed By', 'Role', 'Details'],
    filtered.map((e) => [
      formatDateTime(e.timestamp),
      e.action,
      e.entityType,
      e.entityLabel,
      e.performedBy,
      e.performedByRole,
      e.details,
    ]),
  );
  return { count: filtered.length, filename };
}

export function exportAttendanceApprovalsCsv(
  requests: AttendanceApprovalRequest[],
  filter: ReportDateFilter,
): { count: number; filename: string } {
  const filtered = filterAttendanceApprovalsForExport(requests, filter);
  if (filtered.length === 0) {
    throw new Error('No off-site punch out requests match the selected date range.');
  }

  const filename = exportFilename('attendance_approvals', filter);
  downloadCsv(
    filename,
    ['Employee', 'Requested At', 'Distance (m)', 'Reason', 'Status', 'Reviewed By', 'Reviewed At', 'Admin Notes'],
    filtered.map((r) => [
      r.employeeName,
      formatDateTime(r.requestedAt),
      r.distanceM,
      r.reason,
      r.status,
      r.reviewedBy ?? '',
      r.reviewedAt ? formatDateTime(r.reviewedAt) : '',
      r.adminNotes,
    ]),
  );
  return { count: filtered.length, filename };
}

export function exportStageApprovalsCsv(
  cases: ImplantCase[],
  filter: ReportDateFilter,
): { count: number; filename: string } {
  const filtered = cases.filter(
    (c) => c.status === 'Waiting For Approval' && isTimestampInRange(c.updatedAt, filter),
  );
  if (filtered.length === 0) {
    throw new Error('No pending stage approvals match the selected date range.');
  }

  const filename = exportFilename('stage_approvals', filter);
  downloadCsv(
    filename,
    ['Case Number', 'Hospital', 'Stage', 'Assigned Employee', 'Status', 'Last Updated', 'Priority'],
    filtered.map((c) => [
      c.caseNumber,
      c.hospital.name,
      c.currentStage,
      c.assignedEmployee?.name ?? '',
      c.status,
      formatDateTime(c.updatedAt),
      c.priority,
    ]),
  );
  return { count: filtered.length, filename };
}

export function exportHospitalsCsv(
  hospitals: Hospital[],
  cases: ImplantCase[],
  filter: ReportDateFilter,
  caseOptions: CaseExportOptions = { range: filter.range, customFrom: filter.customFrom, customTo: filter.customTo },
): { count: number; filename: string } {
  const filteredCases = filterCasesForExport(cases, caseOptions);
  const caseCount = (id: string) => filteredCases.filter((c) => c.hospital.id === id).length;
  const activeCount = (id: string) =>
    filteredCases.filter((c) => c.hospital.id === id && c.status !== 'Completed' && c.status !== 'Cancelled').length;

  const filename = exportFilename('hospitals', filter);
  downloadCsv(
    filename,
    ['Hospital', 'Branch', 'City', 'Contact', 'Phone', 'Email', 'Status', 'Cases In Range', 'Active In Range'],
    hospitals.map((h) => [
      h.name,
      h.branch,
      h.city,
      h.contactPerson,
      h.phone,
      h.email,
      h.status,
      caseCount(h.id),
      activeCount(h.id),
    ]),
  );
  return { count: hospitals.length, filename };
}

export function filterExpensesForExport(
  expenses: DailyExpense[],
  filter: ReportDateFilter,
): DailyExpense[] {
  return expenses.filter((e) => isDateKeyInRange(e.expenseDate, filter));
}

export interface ExpenseSummaryRow {
  employeeId: string;
  employeeName: string;
  department: string;
  days: number;
  totalKms: number;
  totalPetrol: number;
  totalFood: number;
  totalOther: number;
  grandTotal: number;
  incentive: number;
}

export function buildExpenseSummaryRows(
  employees: Employee[],
  expenses: DailyExpense[],
  filter: ReportDateFilter,
): ExpenseSummaryRow[] {
  const filtered = filterExpensesForExport(expenses, filter);
  const byEmployee = new Map<string, ExpenseSummaryRow>();

  for (const entry of filtered) {
    const employee = employees.find((e) => e.id === entry.employeeId);
    const existing = byEmployee.get(entry.employeeId);
    const row: ExpenseSummaryRow = existing ?? {
      employeeId: entry.employeeId,
      employeeName: entry.employeeName,
      department: employee?.department ?? '',
      days: 0,
      totalKms: 0,
      totalPetrol: 0,
      totalFood: 0,
      totalOther: 0,
      grandTotal: 0,
      incentive: 0,
    };
    row.days += 1;
    row.totalKms += entry.kmsDriven;
    row.totalPetrol += entry.petrolAmount;
    row.totalFood += entry.foodAmount;
    row.totalOther += entry.otherAmount;
    row.grandTotal += entry.petrolAmount + entry.foodAmount + entry.otherAmount;
    byEmployee.set(entry.employeeId, row);
  }

  for (const row of byEmployee.values()) {
    row.incentive = calculateKmIncentive(row.totalKms);
  }

  return Array.from(byEmployee.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

export function exportExpenseSummaryCsv(
  employees: Employee[],
  expenses: DailyExpense[],
  filter: ReportDateFilter,
): { count: number; filename: string } {
  const rows = buildExpenseSummaryRows(employees, expenses, filter);
  if (rows.length === 0) {
    throw new Error('No expense entries match the selected date range.');
  }

  const filename = exportFilename('expenses_summary', filter);
  downloadCsv(
    filename,
    ['Employee', 'Department', 'Days Entered', 'Total Kms', `Km Incentive (${KM_INCENTIVE_RULE_LABEL})`, 'Petrol (₹)', 'Food (₹)', 'Other (₹)', 'Grand Total (₹)'],
    rows.map((r) => [
      r.employeeName,
      r.department,
      r.days,
      r.totalKms,
      r.incentive,
      r.totalPetrol,
      r.totalFood,
      r.totalOther,
      r.grandTotal,
    ]),
  );
  return { count: rows.length, filename };
}

export function exportExpenseDetailCsv(
  expenses: DailyExpense[],
  filter: ReportDateFilter,
): { count: number; filename: string } {
  const filtered = filterExpensesForExport(expenses, filter).sort((a, b) =>
    a.expenseDate === b.expenseDate
      ? a.employeeName.localeCompare(b.employeeName)
      : a.expenseDate < b.expenseDate ? 1 : -1,
  );
  if (filtered.length === 0) {
    throw new Error('No expense entries match the selected date range.');
  }

  const filename = exportFilename('expenses_detail', filter);
  downloadCsv(
    filename,
    ['Date', 'Employee', 'Kms', 'Petrol (₹)', 'Food (₹)', 'Other (₹)', 'Other For', 'Notes', 'Entered By'],
    filtered.map((e) => [
      e.expenseDate,
      e.employeeName,
      e.kmsDriven,
      e.petrolAmount,
      e.foodAmount,
      e.otherAmount,
      e.otherDescription,
      e.notes,
      e.enteredBy,
    ]),
  );
  return { count: filtered.length, filename };
}

export function exportBillingCsv(
  cases: ImplantCase[],
  filter: ReportDateFilter,
  caseOptions: CaseExportOptions = { range: filter.range, customFrom: filter.customFrom, customTo: filter.customTo, dateField: 'updatedAt' },
): { count: number; filename: string } {
  const filtered = filterCasesForExport(cases, caseOptions).filter((c) => c.invoiceAmount);
  if (filtered.length === 0) {
    throw new Error('No billing records match the selected date range.');
  }

  const filename = exportFilename('billing', filter);
  downloadCsv(
    filename,
    ['Case ID', 'Hospital', 'Stage', 'Invoice Amount', 'Collected', 'Payment Status', 'Last Updated'],
    filtered.map((c) => [
      c.caseNumber,
      c.hospital.name,
      c.currentStage,
      formatCurrency(c.invoiceAmount || 0),
      formatCurrency(c.collectedAmount || 0),
      c.paymentStatus || 'Pending',
      formatDateTime(c.updatedAt),
    ]),
  );
  return { count: filtered.length, filename };
}
