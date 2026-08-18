import type { AttendanceRecord, Hospital, HospitalTripPunch, ImplantCase } from '../types';
import { getDistanceMeters, getISTDateKey, getOpenShift } from './attendance';
import { isCaseAssignedToEmployee } from './caseWorkflow';

export function kmBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return Math.round((getDistanceMeters(lat1, lng1, lat2, lng2) / 1000) * 10) / 10;
}

export function todayHospitalTrips(
  punches: HospitalTripPunch[],
  employeeId: string,
  dateKey = getISTDateKey(),
): HospitalTripPunch[] {
  return punches
    .filter((p) => p.employeeId === employeeId && getISTDateKey(p.punchedAt) === dateKey)
    .sort((a, b) => new Date(a.punchedAt).getTime() - new Date(b.punchedAt).getTime());
}

export function todayTripKm(punches: HospitalTripPunch[], employeeId: string, dateKey = getISTDateKey()): number {
  return Math.round(todayHospitalTrips(punches, employeeId, dateKey).reduce((sum, p) => sum + p.distanceKm, 0) * 10) / 10;
}

export type TripCheckpoint = {
  latitude: number;
  longitude: number;
  label: string;
};

/** Last GPS point today: previous hospital punch, else office punch in. */
export function lastTripCheckpoint(
  attendanceRecords: AttendanceRecord[],
  tripPunches: HospitalTripPunch[],
  employeeId: string,
  dateKey = getISTDateKey(),
): TripCheckpoint | null {
  const todayTrips = todayHospitalTrips(tripPunches, employeeId, dateKey);
  const lastHospital = todayTrips[todayTrips.length - 1];
  if (lastHospital) {
    return {
      latitude: lastHospital.latitude,
      longitude: lastHospital.longitude,
      label: lastHospital.hospitalName || 'Last hospital punch',
    };
  }

  const open = getOpenShift(attendanceRecords, employeeId);
  if (open && getISTDateKey(open.punchIn.punchedAt) === dateKey && open.punchIn.latitude && open.punchIn.longitude) {
    return {
      latitude: open.punchIn.latitude,
      longitude: open.punchIn.longitude,
      label: 'Office punch in',
    };
  }

  const officeIn = [...attendanceRecords]
    .filter(
      (r) =>
        r.employeeId === employeeId &&
        r.punchType === 'in' &&
        getISTDateKey(r.punchedAt) === dateKey &&
        r.latitude &&
        r.longitude,
    )
    .sort((a, b) => new Date(b.punchedAt).getTime() - new Date(a.punchedAt).getTime())[0];
  if (officeIn) {
    return {
      latitude: officeIn.latitude,
      longitude: officeIn.longitude,
      label: 'Office punch in',
    };
  }

  return null;
}

export function suggestedHospitals(
  hospitals: Hospital[],
  cases: ImplantCase[],
  employee: { id: string; email: string },
): Hospital[] {
  const fromCases = cases
    .filter((c) => isCaseAssignedToEmployee(c, employee) && (c.status === 'Active' || c.status === 'Waiting For Approval'))
    .map((c) => c.hospital)
    .filter(Boolean);
  const seen = new Set<string>();
  const ranked: Hospital[] = [];
  for (const h of [...fromCases, ...hospitals.filter((h) => h.status === 'Active')]) {
    if (!h?.id || seen.has(h.id)) continue;
    seen.add(h.id);
    ranked.push(h);
  }
  return ranked;
}
