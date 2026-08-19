import type { Employee, LocationTrip } from '../types';
import { downloadCsv } from '../utils/csv';
import { formatTimeIST } from './attendance';
import { locationTripDateKey, tripEndPlusCode, tripKm, tripStartPlusCode } from './locationTrip';

const HEADERS = [
  'Date',
  'Employee',
  'Employee ID',
  'Trip no',
  'Start',
  'Reached',
  'Bike km',
  'Minutes',
  'Source',
  'Start Plus Code',
  'Reached Plus Code',
  'Notes',
];

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'staff';
}

export function locationTripsForExport(
  trips: LocationTrip[],
  employeeId?: string,
  month?: string,
): LocationTrip[] {
  return [...trips]
    .filter((t) => t.status === 'completed')
    .filter((t) => (employeeId ? t.employeeId === employeeId : true))
    .filter((t) => (month ? locationTripDateKey(t).startsWith(month) : true))
    .sort((a, b) => locationTripDateKey(a).localeCompare(locationTripDateKey(b)) || a.tripNo - b.tripNo);
}

export function exportLocationKmsCsv(
  trips: LocationTrip[],
  employees: Employee[],
  options: { employeeId?: string; month?: string; label?: string },
): { count: number; filename: string } {
  const rows = locationTripsForExport(trips, options.employeeId, options.month);
  if (rows.length === 0) {
    throw new Error('No completed trips to export for this selection.');
  }

  const codeById = new Map(employees.map((e) => [e.id, e.employeeCode || '']));
  const filename = [
    'kms',
    options.label ? slug(options.label) : options.employeeId ? 'employee' : 'all-staff',
    options.month || 'all',
  ].join('-');

  downloadCsv(
    `${filename}.csv`,
    HEADERS,
    rows.map((t) => [
      locationTripDateKey(t),
      t.employeeName,
      codeById.get(t.employeeId) || '',
      t.tripNo,
      formatTimeIST(t.startAt),
      t.endAt ? formatTimeIST(t.endAt) : '',
      tripKm(t),
      t.bikeMinutes ?? '',
      t.bikeSource || (t.bikeKm != null ? 'bike' : 'straight'),
      tripStartPlusCode(t),
      tripEndPlusCode(t),
      t.notes,
    ]),
  );

  return { count: rows.length, filename: `${filename}.csv` };
}
