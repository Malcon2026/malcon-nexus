import type { LeaveRequest, LeaveType } from '../types';
import { getISTDateKey } from './attendance';
import { isWeeklyOffDateKey } from './attendanceRegister';

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

export function validateLeaveApplication(
  requests: LeaveRequest[],
  employeeId: string,
  fromDate: string,
  toDate: string,
  reason: string,
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

  const overlap = findOverlappingLeave(requests, employeeId, fromDate, toDate);
  if (overlap) {
    return {
      error: `Overlaps with existing ${overlap.status} leave (${overlap.fromDate} to ${overlap.toDate}).`,
    };
  }

  return { error: null };
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
