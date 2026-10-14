import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { employees } from '../db/schema';
import {
  countAttendanceRecords,
  listAttendanceRecords,
  type AttendanceListFilters,
} from './attendanceRecords';

/** Public employee fields — no auth_user_id, telegram, or internal linkage. */
export const EMPLOYEE_PUBLIC_COLUMNS = {
  id: employees.id,
  name: employees.name,
  email: employees.email,
  department: employees.department,
  departments: employees.departments,
  role: employees.role,
  status: employees.status,
  avatar: employees.avatar,
  phone: employees.phone,
  employeeCode: employees.employeeCode,
  casesCompleted: employees.casesCompleted,
  casesActive: employees.casesActive,
  joinDate: employees.joinDate,
  createdAt: employees.createdAt,
  updatedAt: employees.updatedAt,
} as const;

export type EmployeePublicRow = {
  id: string;
  name: string;
  email: string;
  department: string;
  departments: string;
  role: string;
  status: string;
  avatar: string;
  phone: string;
  employeeCode: string | null;
  casesCompleted: number;
  casesActive: number;
  joinDate: string;
  createdAt: string;
  updatedAt: string;
};

function mapEmployee(row: EmployeePublicRow) {
  let departments: string[] = [];
  try {
    departments = JSON.parse(row.departments) as string[];
  } catch {
    departments = [];
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    department: row.department,
    departments,
    role: row.role,
    status: row.status,
    avatar: row.avatar,
    phone: row.phone,
    employee_code: row.employeeCode,
    cases_completed: row.casesCompleted,
    cases_active: row.casesActive,
    join_date: row.joinDate,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function listEmployees(db: Db, limit: number) {
  const rows = await db
    .select(EMPLOYEE_PUBLIC_COLUMNS)
    .from(employees)
    .orderBy(employees.name)
    .limit(limit);
  return rows.map(mapEmployee);
}

export async function getEmployeeById(db: Db, id: string) {
  const rows = await db.select(EMPLOYEE_PUBLIC_COLUMNS).from(employees).where(eq(employees.id, id)).limit(1);
  return rows[0] ? mapEmployee(rows[0]) : null;
}

export async function countEmployeeAttendance(
  db: Db,
  employeeId: string,
  filters: Omit<AttendanceListFilters, 'employeeId'> = {},
) {
  return countAttendanceRecords(db, { ...filters, employeeId });
}

export async function listEmployeeAttendance(
  db: Db,
  employeeId: string,
  offset: number,
  limit: number,
  filters: Omit<AttendanceListFilters, 'employeeId'> = {},
) {
  return listAttendanceRecords(db, { ...filters, employeeId }, offset, limit);
}
