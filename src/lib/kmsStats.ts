import type { LocationTrip } from '../types';
import { getISTDateKey } from './attendance';
import { locationTripDateKey, tripKm } from './locationTrip';

export function currentKmsMonth(now = new Date()): string {
  return getISTDateKey(now).slice(0, 7);
}

export function shiftKmsMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftKmsDate(dateKey: string, delta: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const next = new Date(year, month - 1, day + delta);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

export function kmsMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function daysInMonth(yearMonth: string): string[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const last = new Date(year, month, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${yearMonth}-${String(i + 1).padStart(2, '0')}`);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export type KmsEmployeeRow = {
  employeeId: string;
  name: string;
  trips: number;
  km: number;
  todayTrips: number;
  todayKm: number;
  bikeTrips: number;
  lastDate: string;
};

export function summarizeLocationKms(trips: LocationTrip[], month = currentKmsMonth(), now = new Date()) {
  const today = getISTDateKey(now);
  const completed = trips.filter((t) => t.status === 'completed');
  const inProgress = trips.filter((t) => t.status === 'started');
  const monthTrips = completed.filter((t) => locationTripDateKey(t).startsWith(month));
  const todayTrips = completed.filter((t) => locationTripDateKey(t) === today);

  const sumKm = (rows: LocationTrip[]) => round1(rows.reduce((sum, t) => sum + tripKm(t), 0));

  const daily = daysInMonth(month).map((date) => {
    const rows = monthTrips.filter((t) => locationTripDateKey(t) === date);
    return {
      date,
      label: date.slice(8),
      trips: rows.length,
      km: sumKm(rows),
    };
  });

  const byEmployeeMap = new Map<string, KmsEmployeeRow>();
  for (const trip of monthTrips) {
    const current = byEmployeeMap.get(trip.employeeId) ?? {
      employeeId: trip.employeeId,
      name: trip.employeeName,
      trips: 0,
      km: 0,
      todayTrips: 0,
      todayKm: 0,
      bikeTrips: 0,
      lastDate: locationTripDateKey(trip),
    };
    current.trips += 1;
    current.km = round1(current.km + tripKm(trip));
    if (locationTripDateKey(trip) === today) {
      current.todayTrips += 1;
      current.todayKm = round1(current.todayKm + tripKm(trip));
    }
    if (trip.bikeKm != null) current.bikeTrips += 1;
    const dateKey = locationTripDateKey(trip);
    if (dateKey > current.lastDate) current.lastDate = dateKey;
    byEmployeeMap.set(trip.employeeId, current);
  }
  const byEmployee = [...byEmployeeMap.values()].sort((a, b) => b.km - a.km || b.todayKm - a.todayKm);

  return {
    today,
    todayKm: sumKm(todayTrips),
    todayTrips: todayTrips.length,
    monthKm: sumKm(monthTrips),
    monthTripCount: monthTrips.length,
    bikeTrips: monthTrips.filter((t) => t.bikeKm != null).length,
    uniqueStaff: byEmployee.length,
    inProgress,
    daily,
    byEmployee,
    completedMonth: monthTrips,
  };
}
