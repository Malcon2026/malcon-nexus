/** Shared staff roster rules — keep Employees totals and Attendance in sync. */

export type StaffLike = {
  role: string;
  status: string;
  department?: string;
};

/**
 * People who appear on the attendance register / active workforce count:
 * active employees and admins (admins may have manual attendance).
 */
export function isAttendanceStaff(person: StaffLike): boolean {
  return (person.role === 'employee' || person.role === 'admin') && person.status === 'Active';
}

export function filterAttendanceStaff<T extends StaffLike>(people: T[]): T[] {
  return people.filter(isAttendanceStaff);
}
