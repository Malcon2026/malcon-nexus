import type {
  AttendanceRecord,
  Employee,
  EmployeeFoodSelection,
  FieldTeamAttendanceApproval,
  LeaveRequest,
} from '../types';
import { buildEmployeeAttendanceReport } from './attendance';
import { getISTDateKey } from './attendance';
import { isFoodSelectionSubmitted, getFoodSelectionForDay } from './food';
import { countPendingLeaveSubmissions } from './leave';
import { filterAttendanceStaff } from './staff';

export type StaffHighlightKind = 'in' | 'out' | 'absent' | 'leave' | 'food';

export type StaffHighlight = {
  employeeId: string;
  name: string;
  kind: StaffHighlightKind;
  detail?: string;
};

export type DashboardStaffSnapshot = {
  dateKey: string;
  totalStaff: number;
  punchedIn: number;
  punchedOut: number;
  absent: number;
  onLeaveToday: number;
  foodNotSubmitted: number;
  pendingLeaveApprovals: number;
  highlights: StaffHighlight[];
};

function isOnApprovedLeaveToday(requests: LeaveRequest[], employeeId: string, dateKey: string): boolean {
  return requests.some(
    (lr) =>
      lr.employeeId === employeeId &&
      lr.status === 'approved' &&
      lr.fromDate <= dateKey &&
      dateKey <= lr.toDate,
  );
}

export function buildDashboardStaffSnapshot(
  employees: Employee[],
  attendanceRecords: AttendanceRecord[],
  foodSelections: EmployeeFoodSelection[],
  leaveRequests: LeaveRequest[],
  dateKey = getISTDateKey(),
  fieldTeamAttendanceApprovals: FieldTeamAttendanceApproval[] = [],
): DashboardStaffSnapshot {
  const staff = filterAttendanceStaff(employees).filter((e) => e.role === 'employee' && e.status === 'Active');
  const rows = buildEmployeeAttendanceReport(
    employees,
    attendanceRecords,
    dateKey,
    fieldTeamAttendanceApprovals,
  );
  const rowById = new Map(rows.map((r) => [r.employeeId, r]));

  const highlights: StaffHighlight[] = [];
  let punchedIn = 0;
  let punchedOut = 0;
  let absent = 0;
  let onLeaveToday = 0;
  let foodNotSubmitted = 0;

  for (const employee of staff) {
    if (isOnApprovedLeaveToday(leaveRequests, employee.id, dateKey)) {
      onLeaveToday += 1;
      highlights.push({ employeeId: employee.id, name: employee.name, kind: 'leave', detail: 'On leave' });
      continue;
    }

    const row = rowById.get(employee.id);
    const status = row?.status ?? 'absent';

    if (status === 'in') {
      punchedIn += 1;
      highlights.push({ employeeId: employee.id, name: employee.name, kind: 'in', detail: 'Punched in' });
    } else if (status === 'out') {
      punchedOut += 1;
      highlights.push({ employeeId: employee.id, name: employee.name, kind: 'out', detail: 'Punched out' });
    } else {
      absent += 1;
      highlights.push({ employeeId: employee.id, name: employee.name, kind: 'absent', detail: 'Not punched in' });
    }

    const food = getFoodSelectionForDay(foodSelections, employee.id, dateKey);
    const foodOk =
      isFoodSelectionSubmitted(food) &&
      Boolean(food?.breakfast || food?.lunch || food?.dinner);
    if (!foodOk) {
      foodNotSubmitted += 1;
      const existing = highlights.find((h) => h.employeeId === employee.id);
      if (existing) {
        existing.detail = `${existing.detail ?? ''} · Food pending`.trim();
      } else {
        highlights.push({ employeeId: employee.id, name: employee.name, kind: 'food', detail: 'Food not submitted' });
      }
    }
  }

  highlights.sort((a, b) => a.name.localeCompare(b.name));

  return {
    dateKey,
    totalStaff: staff.length,
    punchedIn,
    punchedOut,
    absent,
    onLeaveToday,
    foodNotSubmitted,
    pendingLeaveApprovals: countPendingLeaveSubmissions(leaveRequests),
    highlights,
  };
}

export function filterStaffHighlights(
  highlights: StaffHighlight[],
  filter: StaffHighlightKind | 'all' | 'food',
): StaffHighlight[] {
  if (filter === 'all') return highlights;
  if (filter === 'food') {
    return highlights.filter((h) => h.kind === 'food' || h.detail?.includes('Food pending'));
  }
  return highlights.filter((h) => h.kind === filter);
}
