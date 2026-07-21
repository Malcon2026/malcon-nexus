import type { AttendanceRecord, LeaveRequest } from '../types';
import {
  getISTDateKey,
  summarizeDayAttendance,
  formatTimeIST,
  type TodayAttendanceSummary,
} from './attendance';

export type RegisterCellCode = 'P' | 'PI' | 'L' | 'PL' | 'A' | 'WO' | '—';

export const PAYABLE_DAYS_PER_CYCLE = 30;

export interface RegisterCellDetail {
  code: RegisterCellCode;
  label: string;
  punchInTime?: string;
  punchOutTime?: string;
  workedDuration?: string;
  leaveType?: string;
  leaveReason?: string;
  leaveStatus?: string;
}

export interface RegisterDayColumn {
  day: number;
  dateKey: string;
  weekday: string;
  weekNumber: number;
  isWeeklyOff: boolean;
  isFuture: boolean;
  isToday: boolean;
  /** Short month label when the calendar month changes (e.g. "Jun"). */
  monthShort: string;
}

export interface RegisterEmployeeRow {
  employeeId: string;
  employeeName: string;
  department: string;
  cells: RegisterCellDetail[];
  payDays: number;
}

export interface SalaryCycleBounds {
  startDateKey: string;
  endDateKey: string;
}

export interface AttendanceRegisterData {
  year: number;
  month: number;
  monthLabel: string;
  salaryLabel: string;
  cycleLabel: string;
  cycleDescription: string;
  days: RegisterDayColumn[];
  rows: RegisterEmployeeRow[];
  payableDaysCap: number;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseYearMonth(value: string): { year: number; month: number } {
  const [y, m] = value.split('-').map(Number);
  return { year: y, month: m };
}

export function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function dateKeyFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function daysInCalendarMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function isWeeklyOffDateKey(dateKey: string): boolean {
  const [y, m, d] = dateKey.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  return weekday === 0;
}

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDaysToDateKey(dateKey: string, delta: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + delta);
  return dateKeyFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function iterateDateKeys(fromDateKey: string, toDateKey: string): string[] {
  const keys: string[] = [];
  let current = fromDateKey;
  while (current <= toDateKey) {
    keys.push(current);
    current = addDaysToDateKey(current, 1);
  }
  return keys;
}

function formatShortDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

/** May salary uses 27th→27th; all other months use 28th→27th. */
export function getSalaryCycleStartDay(salaryMonth: number): number {
  return salaryMonth === 5 ? 27 : 28;
}

export function getSalaryCycleBounds(year: number, salaryMonth: number): SalaryCycleBounds {
  const prevMonth = salaryMonth === 1 ? 12 : salaryMonth - 1;
  const prevYear = salaryMonth === 1 ? year - 1 : year;
  const cycleStartDay = getSalaryCycleStartDay(salaryMonth);

  return {
    startDateKey: dateKeyFromParts(prevYear, prevMonth, cycleStartDay),
    endDateKey: dateKeyFromParts(year, salaryMonth, 27),
  };
}

export function getSalaryCycleDescription(salaryMonth: number): string {
  const startDay = getSalaryCycleStartDay(salaryMonth);
  return `${startDay}th prev month → 27th · max ${PAYABLE_DAYS_PER_CYCLE} pay days`;
}

export function getSalaryCycleLabel(year: number, salaryMonth: number): string {
  const bounds = getSalaryCycleBounds(year, salaryMonth);
  const endYear = year;
  const endMonth = salaryMonth;
  const startParts = bounds.startDateKey.split('-').map(Number);
  const startLabel = new Date(startParts[0], startParts[1] - 1, startParts[2]).toLocaleDateString(
    'en-IN',
    { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' },
  );
  const endLabel = new Date(endYear, endMonth - 1, parseInt(bounds.endDateKey.split('-')[2], 10))
    .toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  return `${startLabel} – ${endLabel}`;
}

export function getSalaryLabel(year: number, salaryMonth: number): string {
  return `${getMonthLabel(year, salaryMonth)} salary`;
}

function getWeekNumberInCycle(cycleStartDateKey: string, dateKey: string): number {
  const start = parseDateKey(cycleStartDateKey);
  const current = parseDateKey(dateKey);
  const diffDays = Math.round((current.getTime() - start.getTime()) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}

function isDateInRange(dateKey: string, fromDate: string, toDate: string): boolean {
  return dateKey >= fromDate && dateKey <= toDate;
}

function findLeaveForDate(
  leaveRequests: LeaveRequest[],
  employeeId: string,
  dateKey: string,
): LeaveRequest | null {
  return (
    leaveRequests.find(
      (lr) =>
        lr.employeeId === employeeId &&
        lr.status !== 'cancelled' &&
        lr.status !== 'rejected' &&
        isDateInRange(dateKey, lr.fromDate, lr.toDate),
    ) ?? null
  );
}

function formatWorkedDuration(summary: TodayAttendanceSummary): string {
  if (summary.workedMs <= 0) return '';
  const totalMinutes = Math.floor(summary.workedMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function resolveRegisterCell(
  dateKey: string,
  employeeId: string,
  records: AttendanceRecord[],
  leaveRequests: LeaveRequest[],
  isFuture: boolean,
): RegisterCellDetail {
  if (isWeeklyOffDateKey(dateKey)) {
    return { code: 'WO', label: 'Sunday off' };
  }

  const leave = findLeaveForDate(leaveRequests, employeeId, dateKey);
  if (leave) {
    if (leave.status === 'approved') {
      return {
        code: 'L',
        label: `${leave.leaveType} leave`,
        leaveType: leave.leaveType,
        leaveReason: leave.reason,
        leaveStatus: leave.status,
      };
    }
    if (leave.status === 'pending') {
      return {
        code: 'PL',
        label: `Pending ${leave.leaveType} leave`,
        leaveType: leave.leaveType,
        leaveReason: leave.reason,
        leaveStatus: leave.status,
      };
    }
  }

  const summary = summarizeDayAttendance(records, employeeId, dateKey);

  if (summary.punchIn && summary.punchOut) {
    return {
      code: 'P',
      label: 'Present',
      punchInTime: formatTimeIST(summary.punchIn.punchedAt),
      punchOutTime: formatTimeIST(summary.punchOut.punchedAt),
      workedDuration: formatWorkedDuration(summary),
    };
  }

  if (summary.isPunchedIn) {
    return {
      code: 'PI',
      label: 'Present (still in)',
      punchInTime: formatTimeIST(summary.punchIn!.punchedAt),
      workedDuration: formatWorkedDuration(summary),
    };
  }

  if (summary.punchIn && !summary.punchOut) {
    return {
      code: 'P',
      label: 'Present (missing punch out)',
      punchInTime: formatTimeIST(summary.punchIn.punchedAt),
      workedDuration: formatWorkedDuration(summary),
    };
  }

  if (isFuture) {
    return { code: '—', label: 'Future date' };
  }

  return { code: 'A', label: 'Absent' };
}

export function buildSalaryCycleDayColumns(year: number, salaryMonth: number): RegisterDayColumn[] {
  const todayKey = getISTDateKey();
  const bounds = getSalaryCycleBounds(year, salaryMonth);
  const dateKeys = iterateDateKeys(bounds.startDateKey, bounds.endDateKey);
  const columns: RegisterDayColumn[] = [];
  let previousMonth = -1;

  for (const dateKey of dateKeys) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const monthShort =
      m !== previousMonth
        ? date.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' })
        : '';
    previousMonth = m;

    columns.push({
      day: d,
      dateKey,
      weekday: WEEKDAY_SHORT[date.getDay()],
      weekNumber: getWeekNumberInCycle(bounds.startDateKey, dateKey),
      isWeeklyOff: isWeeklyOffDateKey(dateKey),
      isFuture: dateKey > todayKey,
      isToday: dateKey === todayKey,
      monthShort,
    });
  }

  return columns;
}

/** @deprecated Use buildSalaryCycleDayColumns — kept for any external callers. */
export function buildMonthDayColumns(year: number, month: number): RegisterDayColumn[] {
  return buildSalaryCycleDayColumns(year, month);
}

export function countPayDays(cells: RegisterCellDetail[], days: RegisterDayColumn[]): number {
  let count = 0;
  for (let i = 0; i < days.length; i++) {
    const code = cells[i].code;
    if (code === 'P' || code === 'PI' || code === 'L' || code === 'WO') count++;
  }
  return Math.min(count, PAYABLE_DAYS_PER_CYCLE);
}

export function buildAttendanceRegister(
  employees: { id: string; name: string; department: string; role: string; status: string }[],
  records: AttendanceRecord[],
  leaveRequests: LeaveRequest[],
  year: number,
  month: number,
  options?: { employeeId?: string },
): AttendanceRegisterData {
  const days = buildSalaryCycleDayColumns(year, month);
  const staff = employees
    .filter((e) => e.role === 'employee' && e.status === 'Active')
    .filter((e) => !options?.employeeId || e.id === options.employeeId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const rows: RegisterEmployeeRow[] = staff.map((employee) => {
    const cells = days.map((col) =>
      resolveRegisterCell(
        col.dateKey,
        employee.id,
        records,
        leaveRequests,
        col.isFuture,
      ),
    );
    return {
      employeeId: employee.id,
      employeeName: employee.name,
      department: employee.department,
      cells,
      payDays: countPayDays(cells, days),
    };
  });

  return {
    year,
    month,
    monthLabel: getMonthLabel(year, month),
    salaryLabel: getSalaryLabel(year, month),
    cycleLabel: getSalaryCycleLabel(year, month),
    cycleDescription: getSalaryCycleDescription(month),
    days,
    rows,
    payableDaysCap: PAYABLE_DAYS_PER_CYCLE,
  };
}

export const REGISTER_CELL_STYLES: Record<
  RegisterCellCode,
  { bg: string; text: string; title: string }
> = {
  P: { bg: 'bg-emerald-100', text: 'text-emerald-800', title: 'Present' },
  PI: { bg: 'bg-emerald-50', text: 'text-emerald-700', title: 'Present (in)' },
  L: { bg: 'bg-blue-100', text: 'text-blue-800', title: 'Approved leave' },
  PL: { bg: 'bg-amber-100', text: 'text-amber-800', title: 'Pending leave' },
  A: { bg: 'bg-red-50', text: 'text-red-700', title: 'Absent' },
  WO: { bg: 'bg-gray-100', text: 'text-gray-500', title: 'Sunday off' },
  '—': { bg: 'bg-white', text: 'text-gray-300', title: 'Future' },
};

export function countLeaveDays(fromDate: string, toDate: string): number {
  const start = new Date(`${fromDate}T12:00:00`);
  const end = new Date(`${toDate}T12:00:00`);
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = getISTDateKey(d);
    if (!isWeeklyOffDateKey(key)) count++;
  }
  return count;
}

export function exportRegisterCsv(data: AttendanceRegisterData): string {
  const header = [
    'Employee',
    'Department',
    ...data.days.map((d) => formatShortDate(d.dateKey)),
    `Pay days (max ${data.payableDaysCap})`,
  ];
  const lines = [header.join(',')];

  for (const row of data.rows) {
    lines.push(
      [
        `"${row.employeeName.replace(/"/g, '""')}"`,
        `"${row.department.replace(/"/g, '""')}"`,
        ...row.cells.map((c) => c.code),
        String(row.payDays),
      ].join(','),
    );
  }

  return lines.join('\n');
}

export function downloadRegisterCsv(data: AttendanceRegisterData): void {
  const csv = exportRegisterCsv(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `attendance-register-${data.year}-${String(data.month).padStart(2, '0')}-salary.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
