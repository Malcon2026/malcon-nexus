import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db/client';
import { attendanceRecords } from '../db/schema';

export type AttendanceListFilters = {
  employeeId?: string;
  since?: string;
  until?: string;
};

const ATTENDANCE_COLUMNS = {
  id: attendanceRecords.id,
  employeeId: attendanceRecords.employeeId,
  employeeName: attendanceRecords.employeeName,
  punchType: attendanceRecords.punchType,
  punchedAt: attendanceRecords.punchedAt,
  latitude: attendanceRecords.latitude,
  longitude: attendanceRecords.longitude,
  accuracyM: attendanceRecords.accuracyM,
  distanceM: attendanceRecords.distanceM,
  withinOffice: attendanceRecords.withinOffice,
  officeAddress: attendanceRecords.officeAddress,
  selfieUrl: attendanceRecords.selfieUrl,
  createdAt: attendanceRecords.createdAt,
} as const;

function attendanceWhere(filters: AttendanceListFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.employeeId) parts.push(eq(attendanceRecords.employeeId, filters.employeeId));
  if (filters.since) parts.push(gte(attendanceRecords.punchedAt, filters.since));
  if (filters.until) parts.push(lte(attendanceRecords.punchedAt, filters.until));
  if (parts.length === 0) return undefined;
  return and(...parts);
}

function mapAttendanceRow(r: {
  id: string;
  employeeId: string;
  employeeName: string;
  punchType: string;
  punchedAt: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  distanceM: number;
  withinOffice: boolean;
  officeAddress: string;
  selfieUrl: string | null;
  createdAt: string;
}) {
  return {
    id: r.id,
    employee_id: r.employeeId,
    employee_name: r.employeeName,
    punch_type: r.punchType,
    punched_at: r.punchedAt,
    latitude: r.latitude,
    longitude: r.longitude,
    accuracy_m: r.accuracyM,
    distance_m: r.distanceM,
    within_office: r.withinOffice,
    office_address: r.officeAddress,
    selfie_url: r.selfieUrl,
    created_at: r.createdAt,
  };
}

export async function countAttendanceRecords(db: Db, filters: AttendanceListFilters): Promise<number> {
  const where = attendanceWhere(filters);
  const row = await db
    .select({ c: sql<number>`count(*)` })
    .from(attendanceRecords)
    .where(where);
  return Number(row[0]?.c ?? 0);
}

export async function listAttendanceRecords(
  db: Db,
  filters: AttendanceListFilters,
  offset: number,
  limit: number,
) {
  const where = attendanceWhere(filters);
  const rows = await db
    .select(ATTENDANCE_COLUMNS)
    .from(attendanceRecords)
    .where(where)
    .orderBy(desc(attendanceRecords.punchedAt))
    .limit(limit)
    .offset(offset);
  return rows.map(mapAttendanceRow);
}
