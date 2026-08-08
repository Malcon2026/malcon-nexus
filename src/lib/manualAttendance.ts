import type { AttendanceRecord, Employee, LeaveRequest } from '../types';
import { newId } from './database/config';
import {
  getISTDateKey,
  getOpenShift,
  getSortedEmployeeRecords,
  normalizeDateKey,
  pairAttendanceShifts,
  OFFICE_LOCATION,
} from './attendance';

function addDaysToDateKey(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Punch rows on `dateKey` plus any punch-out on a later day that closes a shift starting that day. */
export function findAttendanceRecordIdsForDayClear(
  records: AttendanceRecord[],
  employeeId: string,
  dateKey: string,
): string[] {
  const sorted = getSortedEmployeeRecords(records, employeeId);
  const ids = new Set<string>();

  for (const record of sorted) {
    if (getISTDateKey(record.punchedAt) === dateKey) {
      ids.add(record.id);
    }
  }

  for (const pair of pairAttendanceShifts(records, employeeId)) {
    const inKey = getISTDateKey(pair.punchIn.punchedAt);
    if (inKey === dateKey && pair.punchOut) {
      ids.add(pair.punchIn.id);
      ids.add(pair.punchOut.id);
    }
  }

  return [...ids];
}

export interface LeaveDayClearPlan {
  deleteIds: string[];
  replaceWith: LeaveRequest[];
}

/** Remove or split approved/pending leave that covers `dateKey` so Present/Absent can be marked. */
export function planLeaveClearForDate(
  leaveRequests: LeaveRequest[],
  employeeId: string,
  dateKey: string,
): LeaveDayClearPlan {
  const dayKey = normalizeDateKey(dateKey);
  const deleteIds: string[] = [];
  const replaceWith: LeaveRequest[] = [];

  for (const leave of leaveRequests) {
    if (leave.employeeId !== employeeId) continue;
    if (leave.status === 'cancelled' || leave.status === 'rejected') continue;

    const from = normalizeDateKey(leave.fromDate);
    const to = normalizeDateKey(leave.toDate);
    if (dayKey < from || dayKey > to) continue;

    deleteIds.push(leave.id);

    if (from < dayKey) {
      const segmentTo = addDaysToDateKey(dayKey, -1);
      if (segmentTo >= from) {
        replaceWith.push({
          ...leave,
          id: newId(),
          fromDate: from,
          toDate: segmentTo,
          adminNotes: leave.adminNotes
            ? `${leave.adminNotes} (split — ${dayKey} cleared for manual attendance)`
            : `Split — ${dayKey} cleared for manual attendance`,
        });
      }
    }

    if (to > dayKey) {
      const segmentFrom = addDaysToDateKey(dayKey, 1);
      if (segmentFrom <= to) {
        replaceWith.push({
          ...leave,
          id: newId(),
          fromDate: segmentFrom,
          toDate: to,
          adminNotes: leave.adminNotes
            ? `${leave.adminNotes} (split — ${dayKey} cleared for manual attendance)`
            : `Split — ${dayKey} cleared for manual attendance`,
        });
      }
    }
  }

  return { deleteIds, replaceWith };
}

/** Prior-day punch-in still open — would steal the next punch-out if left alone. */
export function getStaleOpenShiftBeforeDate(
  records: AttendanceRecord[],
  employeeId: string,
  dateKey: string,
): AttendanceRecord | null {
  const open = getOpenShift(records, employeeId);
  if (!open) return null;
  const openDateKey = getISTDateKey(open.punchIn.punchedAt);
  return openDateKey < dateKey ? open.punchIn : null;
}

export function buildAutoCloseOutRecord(
  employee: Employee,
  openPunchIn: AttendanceRecord,
  adminName: string,
): AttendanceRecord {
  const shiftDateKey = getISTDateKey(openPunchIn.punchedAt);
  return {
    id: newId(),
    employeeId: employee.id,
    employeeName: employee.name,
    punchType: 'out',
    punchedAt: new Date(`${shiftDateKey}T23:59:00+05:30`).toISOString(),
    latitude: OFFICE_LOCATION.latitude,
    longitude: OFFICE_LOCATION.longitude,
    accuracyM: 0,
    distanceM: 0,
    withinOffice: true,
    officeAddress: `Auto-closed unclosed shift before manual entry by ${adminName}`,
    selfieUrl: null,
  };
}
