import type { AttendanceRecord, LeaveRequest } from '../types';
import {
  getISTDateKey,
  summarizeTodayAttendance,
  formatTimeIST,
  type TodayAttendanceSummary,
} from './attendance';

export type RegisterCellCode = 'P' | 'PI' | 'L' | 'PL' | 'A' | 'WO' | '—';

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
}

export interface RegisterEmployeeRow {
  employeeId: string;
  employeeName: string;
  department: string;
  cells: RegisterCellDetail[];
}

export interface AttendanceRegisterData {
  year: number;
  month: number;
  monthLabel: string;
  days: RegisterDayColumn[];
  rows: RegisterEmployeeRow[];
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

export function isWeeklyOffDateKey(dateKey: string): boolean {
  const [y, m, d] = dateKey.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  return weekday === 0;
}

export function getWeekNumberInMonth(year: number, month: number, day: number): number {
  return Math.ceil(day / 7);
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

  const summary = summarizeTodayAttendance(records, employeeId, dateKey);
  const todayKey = getISTDateKey();

  if (summary.punchIn && summary.punchOut) {
    return {
      code: 'P',
      label: 'Present',
      punchInTime: formatTimeIST(summary.punchIn.punchedAt),
      punchOutTime: formatTimeIST(summary.punchOut.punchedAt),
      workedDuration: formatWorkedDuration(summary),
    };
  }

  if (summary.isPunchedIn && dateKey === todayKey) {
    return {
      code: 'PI',
      label: 'Present (still in)',
      punchInTime: summary.punchIn ? formatTimeIST(summary.punchIn.punchedAt) : undefined,
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

export function buildMonthDayColumns(year: number, month: number): RegisterDayColumn[] {
  const todayKey = getISTDateKey();
  const daysInMonth = new Date(year, month, 0).getDate();
  const columns: RegisterDayColumn[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = dateKeyFromParts(year, month, day);
    const date = new Date(year, month - 1, day);
    columns.push({
      day,
      dateKey,
      weekday: WEEKDAY_SHORT[date.getDay()],
      weekNumber: getWeekNumberInMonth(year, month, day),
      isWeeklyOff: isWeeklyOffDateKey(dateKey),
      isFuture: dateKey > todayKey,
      isToday: dateKey === todayKey,
    });
  }

  return columns;
}

export function buildAttendanceRegister(
  employees: { id: string; name: string; department: string; role: string; status: string }[],
  records: AttendanceRecord[],
  leaveRequests: LeaveRequest[],
  year: number,
  month: number,
  options?: { employeeId?: string },
): AttendanceRegisterData {
  const days = buildMonthDayColumns(year, month);
  const staff = employees
    .filter((e) => e.role === 'employee' && e.status === 'Active')
    .filter((e) => !options?.employeeId || e.id === options.employeeId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const rows: RegisterEmployeeRow[] = staff.map((employee) => ({
    employeeId: employee.id,
    employeeName: employee.name,
    department: employee.department,
    cells: days.map((col) =>
      resolveRegisterCell(col.dateKey, employee.id, records, leaveRequests, col.isFuture),
    ),
  }));

  return {
    year,
    month,
    monthLabel: getMonthLabel(year, month),
    days,
    rows,
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
  const header = ['Employee', 'Department', ...data.days.map((d) => String(d.day))];
  const lines = [header.join(',')];

  for (const row of data.rows) {
    lines.push(
      [
        `"${row.employeeName.replace(/"/g, '""')}"`,
        `"${row.department.replace(/"/g, '""')}"`,
        ...row.cells.map((c) => c.code),
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
  link.download = `attendance-register-${data.year}-${String(data.month).padStart(2, '0')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
