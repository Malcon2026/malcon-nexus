import type { LeaveRequest, LeaveType } from '../types';
import { getISTDateKey, normalizeDateKey } from './attendance';
import { getSalaryCycleBounds, getSalaryMonthForDateKey, isWeeklyOffDateKey } from './attendanceRegister';

/** Max paid casual / sick leave days per salary cycle (28th→27th, max 30 pay days). */
export const CL_SL_QUOTA_PER_CYCLE = 1;

export const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: 'Casual', label: 'Casual Leave (CL)' },
  { value: 'Sick', label: 'Sick Leave (SL)' },
  { value: 'Comp Off', label: 'Comp Off (CO)' },
  { value: 'Unpaid', label: 'Unpaid Leave' },
];

export function rangesOverlap(
  aFrom: string,
  aTo: string,
  bFrom: string,
  bTo: string,
): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

export function findOverlappingLeave(
  requests: LeaveRequest[],
  employeeId: string,
  fromDate: string,
  toDate: string,
  excludeId?: string,
): LeaveRequest | null {
  return (
    requests.find(
      (lr) =>
        lr.id !== excludeId &&
        lr.employeeId === employeeId &&
        (lr.status === 'pending' || lr.status === 'approved') &&
        rangesOverlap(fromDate, toDate, lr.fromDate, lr.toDate),
    ) ?? null
  );
}

export function validateCompOffWorkDate(
  fromDate: string,
  toDate: string,
  workDate: string | null | undefined,
): { error: string | null } {
  if (!workDate || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return { error: 'Please select the day you will work for this Comp Off.' };
  }
  if (workDate >= fromDate && workDate <= toDate) {
    return { error: 'Work day cannot fall inside the Comp Off leave dates.' };
  }
  return { error: null };
}

function addDaysToDateKey(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return getISTDateKey(date);
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

/** Count calendar days with approved/pending leave of `leaveType` in a salary cycle. */
export function countLeaveTypeDaysInSalaryCycle(
  requests: LeaveRequest[],
  employeeId: string,
  year: number,
  salaryMonth: number,
  leaveType: LeaveType,
  options?: { excludeDateKey?: string },
): number {
  const bounds = getSalaryCycleBounds(year, salaryMonth);
  const exclude = options?.excludeDateKey ? normalizeDateKey(options.excludeDateKey) : null;
  let count = 0;

  for (const lr of requests) {
    if (lr.employeeId !== employeeId || lr.leaveType !== leaveType) continue;
    if (lr.status !== 'approved' && lr.status !== 'pending') continue;

    const from = normalizeDateKey(lr.fromDate);
    const to = normalizeDateKey(lr.toDate);
    const rangeStart = from > bounds.startDateKey ? from : bounds.startDateKey;
    const rangeEnd = to < bounds.endDateKey ? to : bounds.endDateKey;
    if (rangeStart > rangeEnd) continue;

    for (const dayKey of iterateDateKeys(rangeStart, rangeEnd)) {
      if (exclude && dayKey === exclude) continue;
      count++;
    }
  }

  return count;
}

export function validateLeaveQuota(
  requests: LeaveRequest[],
  employeeId: string,
  fromDate: string,
  toDate: string,
  leaveType: LeaveType,
  options?: { excludeDateKey?: string },
): { error: string | null } {
  if (leaveType !== 'Casual' && leaveType !== 'Sick') {
    return { error: null };
  }

  const salaryMonth = getSalaryMonthForDateKey(fromDate);
  const existing = countLeaveTypeDaysInSalaryCycle(
    requests,
    employeeId,
    salaryMonth.year,
    salaryMonth.month,
    leaveType,
    options,
  );

  let newDays = 0;
  for (const dayKey of iterateDateKeys(fromDate, toDate)) {
    if (options?.excludeDateKey && dayKey === normalizeDateKey(options.excludeDateKey)) continue;
    newDays++;
  }

  if (existing + newDays > CL_SL_QUOTA_PER_CYCLE) {
    const label = leaveType === 'Casual' ? 'Casual Leave' : 'Sick Leave';
    return {
      error: `Only ${CL_SL_QUOTA_PER_CYCLE} ${label} day is allowed per salary month. Use Unpaid Leave for additional days.`,
    };
  }

  return { error: null };
}

export function validateLeaveApplication(
  requests: LeaveRequest[],
  employeeId: string,
  fromDate: string,
  toDate: string,
  reason: string,
  leaveType?: LeaveType,
  compOffWorkDate?: string | null,
): { error: string | null } {
  if (!fromDate || !toDate) {
    return { error: 'Please select from and to dates.' };
  }
  if (fromDate > toDate) {
    return { error: 'From date cannot be after to date.' };
  }

  const today = getISTDateKey();
  if (fromDate < today) {
    return { error: 'Leave cannot be applied for past dates.' };
  }

  const trimmed = reason.trim();
  if (trimmed.length < 10) {
    return { error: 'Please provide a reason (at least 10 characters).' };
  }

  if (leaveType === 'Comp Off') {
    const workCheck = validateCompOffWorkDate(fromDate, toDate, compOffWorkDate);
    if (workCheck.error) return workCheck;
  }

  const overlap = findOverlappingLeave(requests, employeeId, fromDate, toDate);
  if (overlap) {
    return {
      error: `Overlaps with existing ${overlap.status} leave (${overlap.fromDate} to ${overlap.toDate}).`,
    };
  }

  if (leaveType === 'Casual' || leaveType === 'Sick') {
    const quotaCheck = validateLeaveQuota(requests, employeeId, fromDate, toDate, leaveType);
    if (quotaCheck.error) return quotaCheck;
  }

  return { error: null };
}

export function formatCompOffWorkDate(workDate: string | null | undefined): string | null {
  if (!workDate) return null;
  return new Date(`${workDate}T12:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    weekday: 'short',
  });
}

export function countWorkingLeaveDays(fromDate: string, toDate: string): number {
  const start = new Date(`${fromDate}T12:00:00`);
  const end = new Date(`${toDate}T12:00:00`);
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = getISTDateKey(d);
    if (!isWeeklyOffDateKey(key)) count++;
  }
  return count;
}

export function formatLeaveDateRange(fromDate: string, toDate: string): string {
  const fmt = (s: string) =>
    new Date(`${s}T12:00:00`).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  if (fromDate === toDate) return fmt(fromDate);
  return `${fmt(fromDate)} – ${fmt(toDate)}`;
}
