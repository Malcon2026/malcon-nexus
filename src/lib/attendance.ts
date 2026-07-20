import type { AttendanceApprovalRequest, AttendanceRecord, PunchType } from '../types';

/** Malcon Nexus office — CCWW+RJ, Hyderabad, Telangana (7J9WCCWW+RJ) */
export const OFFICE_LOCATION = {
  address: 'CCWW+RJ, Hyderabad, Telangana',
  plusCode: '7J9WCCWW+RJ',
  latitude: 17.4470625,
  longitude: 78.4465625,
  /** Allowed radius from office center (meters) */
  radiusM: 350,
} as const;

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracyM: number;
}

export interface GeofenceResult {
  distanceM: number;
  withinOffice: boolean;
}

const IST = 'Asia/Kolkata';

export function formatTimeIST(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-IN', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function formatDateIST(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    timeZone: IST,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** YYYY-MM-DD in IST for grouping punches by calendar day */
export function getISTDateKey(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-CA', { timeZone: IST });
}

export function getDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function checkOfficeGeofence(
  latitude: number,
  longitude: number,
  accuracyM = 0,
): GeofenceResult {
  const distanceM = getDistanceMeters(
    latitude,
    longitude,
    OFFICE_LOCATION.latitude,
    OFFICE_LOCATION.longitude,
  );
  // Allow GPS uncertainty — indoor fixes are often 50–150m off
  const effectiveRadius = OFFICE_LOCATION.radiusM + Math.min(accuracyM, 250);
  return {
    distanceM: Math.round(distanceM),
    withinOffice: distanceM <= effectiveRadius,
  };
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return '0h 0m';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported on this device.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Location permission denied. Please allow location access to punch attendance.'));
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          reject(new Error('Unable to detect your location. Please try again outdoors or enable GPS.'));
        } else if (err.code === err.TIMEOUT) {
          reject(new Error('Location request timed out. Please try again.'));
        } else {
          reject(new Error('Failed to get your location.'));
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export interface TodayAttendanceSummary {
  punchIn: AttendanceRecord | null;
  punchOut: AttendanceRecord | null;
  isPunchedIn: boolean;
  workedMs: number;
}


export function summarizeTodayAttendance(
  records: AttendanceRecord[],
  employeeId: string,
  dateKey = getISTDateKey(),
): TodayAttendanceSummary {
  const today = records
    .filter((r) => r.employeeId === employeeId && getISTDateKey(r.punchedAt) === dateKey)
    .sort((a, b) => new Date(a.punchedAt).getTime() - new Date(b.punchedAt).getTime());

  const punchIn = today.find((r) => r.punchType === 'in') ?? null;
  const punchOut = [...today].reverse().find((r) => r.punchType === 'out') ?? null;

  const last = today[today.length - 1] ?? null;
  const isPunchedIn = last?.punchType === 'in';

  let workedMs = 0;
  for (let i = 0; i < today.length; i++) {
    const rec = today[i];
    if (rec.punchType === 'in') {
      const nextOut = today.slice(i + 1).find((r) => r.punchType === 'out');
      const end = nextOut ? new Date(nextOut.punchedAt).getTime() : isPunchedIn ? Date.now() : new Date(rec.punchedAt).getTime();
      workedMs += end - new Date(rec.punchedAt).getTime();
    }
  }

  return { punchIn, punchOut, isPunchedIn, workedMs };
}

export type AttendanceDayStatus = 'absent' | 'in' | 'out';

export function getAttendanceDayStatus(summary: TodayAttendanceSummary): AttendanceDayStatus {
  if (!summary.punchIn) return 'absent';
  if (summary.isPunchedIn) return 'in';
  return 'out';
}

export interface EmployeeAttendanceRow extends TodayAttendanceSummary {
  employeeId: string;
  employeeName: string;
  department: string;
  status: AttendanceDayStatus;
}

export function getPendingOffsitePunchRequest(
  requests: AttendanceApprovalRequest[] | null | undefined,
  employeeId: string,
  punchType: PunchType,
  dateKey = getISTDateKey(),
): AttendanceApprovalRequest | null {
  return (
    (requests ?? []).find(
      (r) =>
        r.employeeId === employeeId &&
        r.punchType === punchType &&
        r.status === 'pending' &&
        getISTDateKey(r.requestedAt) === dateKey,
    ) ?? null
  );
}

/** @deprecated Use getPendingOffsitePunchRequest(..., 'out') */
export function getPendingOffsitePunchOutRequest(
  requests: AttendanceApprovalRequest[] | null | undefined,
  employeeId: string,
  dateKey = getISTDateKey(),
): AttendanceApprovalRequest | null {
  return getPendingOffsitePunchRequest(requests, employeeId, 'out', dateKey);
}

export function buildEmployeeAttendanceReport(
  employees: { id: string; name: string; department: string; role: string; status: string }[],
  records: AttendanceRecord[],
  dateKey = getISTDateKey(),
): EmployeeAttendanceRow[] {
  return employees
    .filter((e) => e.role === 'employee' && e.status === 'Active')
    .map((employee) => {
      const summary = summarizeTodayAttendance(records, employee.id, dateKey);
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        department: employee.department,
        status: getAttendanceDayStatus(summary),
        ...summary,
      };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}
