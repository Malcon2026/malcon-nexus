import type { LeaveRequest, LeaveType } from '../types';
import { getISTDateKey, normalizeDateKey } from './attendance';
import { getSalaryCycleBounds, getSalaryMonthForDateKey, isWeeklyOffDateKey, CL_SL_QUOTA_PER_CYCLE } from './attendanceRegister';

/** Max paid casual / sick leave days per salary cycle (28th→27th, max 30 pay days). */
export { CL_SL_QUOTA_PER_CYCLE };

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
  options?: { excludeDateKey?: string; excludeRequestId?: string },
): number {
  const bounds = getSalaryCycleBounds(year, salaryMonth);
  const exclude = options?.excludeDateKey ? normalizeDateKey(options.excludeDateKey) : null;
  const excludeRequestId = options?.excludeRequestId;
  let count = 0;

  for (const lr of requests) {
    if (lr.id === excludeRequestId) continue;
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

export interface LeaveSegment {
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
}

function salaryCycleKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function buildClSlQuotaUsedByCycle(
  requests: LeaveRequest[],
  employeeId: string,
  leaveType: 'Casual' | 'Sick',
  options?: { excludeRequestId?: string; excludeDateKeys?: Set<string> },
): Map<string, number> {
  const used = new Map<string, number>();
  const excludeId = options?.excludeRequestId;
  const excludeDates = options?.excludeDateKeys;

  for (const lr of requests) {
    if (lr.id === excludeId) continue;
    if (lr.employeeId !== employeeId || lr.leaveType !== leaveType) continue;
    if (lr.status !== 'approved' && lr.status !== 'pending') continue;

    const from = normalizeDateKey(lr.fromDate);
    const to = normalizeDateKey(lr.toDate);
    for (const dayKey of iterateDateKeys(from, to)) {
      if (excludeDates?.has(dayKey)) continue;
      const cycle = getSalaryMonthForDateKey(dayKey);
      const key = salaryCycleKey(cycle.year, cycle.month);
      used.set(key, (used.get(key) ?? 0) + 1);
    }
  }

  return used;
}

function mergeConsecutiveLeaveSegments(
  days: { dateKey: string; leaveType: LeaveType }[],
): LeaveSegment[] {
  if (days.length === 0) return [];

  const segments: LeaveSegment[] = [];
  let current: LeaveSegment = {
    leaveType: days[0].leaveType,
    fromDate: days[0].dateKey,
    toDate: days[0].dateKey,
  };

  for (let i = 1; i < days.length; i++) {
    const { dateKey, leaveType } = days[i];
    const nextExpected = addDaysToDateKey(current.toDate, 1);
    if (leaveType === current.leaveType && dateKey === nextExpected) {
      current.toDate = dateKey;
    } else {
      segments.push(current);
      current = { leaveType, fromDate: dateKey, toDate: dateKey };
    }
  }

  segments.push(current);
  return segments;
}

/** Split a CL/SL range: first day per salary month stays CL/SL, extra days become UL. */
export function splitLeaveByClSlQuota(
  requests: LeaveRequest[],
  employeeId: string,
  fromDate: string,
  toDate: string,
  requestedType: 'Casual' | 'Sick',
  options?: { excludeRequestId?: string; excludeDateKeys?: string[] },
): LeaveSegment[] {
  const excludeDates = options?.excludeDateKeys
    ? new Set(options.excludeDateKeys.map(normalizeDateKey))
    : undefined;
  const quotaUsed = buildClSlQuotaUsedByCycle(requests, employeeId, requestedType, {
    excludeRequestId: options?.excludeRequestId,
    excludeDateKeys: excludeDates,
  });

  const dayAssignments: { dateKey: string; leaveType: LeaveType }[] = [];
  const from = normalizeDateKey(fromDate);
  const to = normalizeDateKey(toDate);

  for (const dayKey of iterateDateKeys(from, to)) {
    if (excludeDates?.has(dayKey)) continue;

    const cycle = getSalaryMonthForDateKey(dayKey);
    const cycleKey = salaryCycleKey(cycle.year, cycle.month);
    const used = quotaUsed.get(cycleKey) ?? 0;

    if (used < CL_SL_QUOTA_PER_CYCLE) {
      dayAssignments.push({ dateKey: dayKey, leaveType: requestedType });
      quotaUsed.set(cycleKey, used + 1);
    } else {
      dayAssignments.push({ dateKey: dayKey, leaveType: 'Unpaid' });
    }
  }

  return mergeConsecutiveLeaveSegments(dayAssignments);
}

/** Resolve one manual CL/SL mark — returns UL when quota for that salary month is used. */
export function resolveSingleDayLeaveType(
  requests: LeaveRequest[],
  employeeId: string,
  dateKey: string,
  requestedType: 'Casual' | 'Sick',
): LeaveType {
  const segments = splitLeaveByClSlQuota(
    requests,
    employeeId,
    dateKey,
    dateKey,
    requestedType,
    { excludeDateKeys: [dateKey] },
  );
  return segments[0]?.leaveType ?? 'Unpaid';
}

export function countDaysInLeaveSegments(segments: LeaveSegment[]): number {
  return segments.reduce(
    (total, seg) => total + iterateDateKeys(seg.fromDate, seg.toDate).length,
    0,
  );
}

export function describeClSlQuotaSplit(
  segments: LeaveSegment[],
  requestedType: 'Casual' | 'Sick',
): string | null {
  const label = requestedType === 'Casual' ? 'Casual' : 'Sick';
  let unpaidDays = 0;
  for (const seg of segments) {
    if (seg.leaveType !== 'Unpaid') continue;
    unpaidDays += iterateDateKeys(seg.fromDate, seg.toDate).length;
  }
  if (unpaidDays === 0) return null;
  return `${unpaidDays} day${unpaidDays === 1 ? '' : 's'} converted to Unpaid Leave (only 1 ${label} day per salary month).`;
}

export function segmentReasonForQuotaSplit(
  baseReason: string,
  segment: LeaveSegment,
  requestedType: 'Casual' | 'Sick',
): string {
  if (segment.leaveType !== 'Unpaid') return baseReason;
  return `${baseReason} (Auto: ${requestedType} quota used — unpaid)`;
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
