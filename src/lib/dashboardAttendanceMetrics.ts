import type {
  AttendanceApprovalRequest,
  AttendanceRecord,
  Employee,
  FieldTeamAttendanceApproval,
  LeaveRequest,
} from '../types';
import { buildEmployeeAttendanceReport, getISTDateKey } from './attendance';

export type DashboardAttendanceMetrics = {
  dateKey: string;
  totalStaff: number;
  present: number;
  punchedIn: number;
  punchedOut: number;
  absent: number;
  onLeave: number;
  offSite: number;
  unclosed: number;
  pendingOffsiteApprovals: number;
  pendingLeaveApprovals: number;
};

function isOnApprovedLeaveToday(
  requests: LeaveRequest[],
  employeeId: string,
  dateKey: string,
): boolean {
  return requests.some(
    (lr) =>
      lr.employeeId === employeeId &&
      lr.status === 'approved' &&
      lr.fromDate <= dateKey &&
      dateKey <= lr.toDate,
  );
}

function countPendingLeaveSubmissions(requests: LeaveRequest[]): number {
  return requests.filter((lr) => lr.status === 'pending').length;
}

export function buildDashboardAttendanceMetrics(
  employees: Employee[],
  attendanceRecords: AttendanceRecord[],
  leaveRequests: LeaveRequest[],
  attendanceApprovalRequests: AttendanceApprovalRequest[] | undefined,
  fieldTeamAttendanceApprovals: FieldTeamAttendanceApproval[] | undefined,
  dateKey = getISTDateKey(),
): DashboardAttendanceMetrics {
  const report = buildEmployeeAttendanceReport(
    employees,
    attendanceRecords,
    dateKey,
    fieldTeamAttendanceApprovals,
  );
  const rows = report.filter((row) => row.department !== 'Admin');

  let punchedIn = 0;
  let punchedOut = 0;
  let absent = 0;
  let onLeave = 0;
  let unclosed = 0;

  for (const row of rows) {
    if (isOnApprovedLeaveToday(leaveRequests, row.employeeId, dateKey)) {
      onLeave += 1;
      continue;
    }
    if (row.unclosedPriorShift) unclosed += 1;
    if (row.status === 'in') punchedIn += 1;
    else if (row.status === 'out') punchedOut += 1;
    else absent += 1;
  }

  const offsiteEmployeeIds = new Set<string>();
  for (const row of rows) {
    const punchIn = row.punchIn;
    if (
      punchIn &&
      getISTDateKey(punchIn.punchedAt) === dateKey &&
      !punchIn.withinOffice
    ) {
      offsiteEmployeeIds.add(row.employeeId);
    }
  }

  const pendingToday = (attendanceApprovalRequests ?? []).filter(
    (r) => r.status === 'pending' && getISTDateKey(r.requestedAt) === dateKey,
  );
  for (const req of pendingToday) {
    if (req.punchType === 'in') offsiteEmployeeIds.add(req.employeeId);
  }

  return {
    dateKey,
    totalStaff: rows.length,
    present: punchedIn + punchedOut,
    punchedIn,
    punchedOut,
    absent,
    onLeave,
    offSite: offsiteEmployeeIds.size,
    unclosed,
    pendingOffsiteApprovals: pendingToday.length,
    pendingLeaveApprovals: countPendingLeaveSubmissions(leaveRequests),
  };
}
