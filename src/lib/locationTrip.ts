import type { LocationTrip } from '../types';
import { getDistanceMeters, getISTDateKey } from './attendance';

export function kmBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return Math.round((getDistanceMeters(lat1, lng1, lat2, lng2) / 1000) * 10) / 10;
}

export function todayLocationTrips(
  trips: LocationTrip[],
  employeeId: string,
  dateKey = getISTDateKey(),
): LocationTrip[] {
  return trips
    .filter((t) => t.employeeId === employeeId && getISTDateKey(t.startAt) === dateKey)
    .sort((a, b) => a.tripNo - b.tripNo || new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

export function openLocationTrip(
  trips: LocationTrip[],
  employeeId: string,
): LocationTrip | undefined {
  return trips.find((t) => t.employeeId === employeeId && t.status === 'started');
}

export function nextTripNo(
  trips: LocationTrip[],
  employeeId: string,
  dateKey = getISTDateKey(),
): number {
  const today = todayLocationTrips(trips, employeeId, dateKey);
  return today.reduce((max, t) => Math.max(max, t.tripNo), 0) + 1;
}

export function todayLocationTripKm(
  trips: LocationTrip[],
  employeeId: string,
  dateKey = getISTDateKey(),
): number {
  return (
    Math.round(
      todayLocationTrips(trips, employeeId, dateKey)
        .filter((t) => t.status === 'completed')
        .reduce((sum, t) => sum + t.distanceKm, 0) * 10,
    ) / 10
  );
}

/** Today's started/completed trips, plus any still-open trip from earlier. */
export function visibleLocationTrips(
  trips: LocationTrip[],
  dateKey = getISTDateKey(),
): LocationTrip[] {
  return trips
    .filter(
      (t) =>
        t.status === 'started' ||
        getISTDateKey(t.startAt) === dateKey ||
        (t.endAt != null && getISTDateKey(t.endAt) === dateKey),
    )
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
}
