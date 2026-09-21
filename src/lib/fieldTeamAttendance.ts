import type { Department, Employee, FieldTeamAttendanceApproval } from '../types';
import { employeeCoversDepartment } from '../constants/departments';

/** Departments that need admin sign-off before a day counts as present. */
export const FIELD_TEAM_ATTENDANCE_DEPARTMENTS: Department[] = [
  'Stores',
  'Scrub Person',
  'Delivery',
];

export function isFieldTeamAttendanceDepartment(dept: string | null | undefined): boolean {
  if (!dept) return false;
  return FIELD_TEAM_ATTENDANCE_DEPARTMENTS.includes(dept as Department);
}

export function requiresFieldTeamAttendanceApproval(
  employee: Pick<Employee, 'department' | 'departments' | 'role'>,
): boolean {
  if (employee.role !== 'employee') return false;
  return FIELD_TEAM_ATTENDANCE_DEPARTMENTS.some((dept) => employeeCoversDepartment(employee, dept));
}

export function getFieldTeamApprovalForDay(
  approvals: FieldTeamAttendanceApproval[] | undefined,
  employeeId: string,
  dateKey: string,
): FieldTeamAttendanceApproval | undefined {
  return (approvals ?? []).find((a) => a.employeeId === employeeId && a.dateKey === dateKey);
}

export function fieldTeamAttendanceCountsAsPresent(
  employee: Pick<Employee, 'department' | 'departments' | 'role'>,
  approvals: FieldTeamAttendanceApproval[] | undefined,
  employeeId: string,
  dateKey: string,
): boolean {
  if (!requiresFieldTeamAttendanceApproval(employee)) return true;
  const row = getFieldTeamApprovalForDay(approvals, employeeId, dateKey);
  return row?.status === 'approved';
}
