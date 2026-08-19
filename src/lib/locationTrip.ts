import type { LocationTrip } from '../types';
import { getDistanceMeters, getISTDateKey } from './attendance';
import { encodePlusCode } from './plusCode';

export function kmBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return Math.round((getDistanceMeters(lat1, lng1, lat2, lng2) / 1000) * 10) / 10;
}

/** IST calendar day the trip belongs to (reached day, else start). */
export function locationTripDateKey(trip: LocationTrip): string {
  return getISTDateKey(trip.endAt || trip.startAt);
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

export function tripKm(trip: LocationTrip): number {
  return trip.bikeKm != null && Number.isFinite(trip.bikeKm) ? trip.bikeKm : trip.distanceKm;
}

/** Same summary Google Maps shows: "13 km · 32 min". */
export function formatBikeCard(trip: LocationTrip): string | null {
  if (trip.bikeKm == null) return null;
  if (trip.bikeMinutes != null) return `${trip.bikeKm} km · ${trip.bikeMinutes} min`;
  return `${trip.bikeKm} km`;
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
        .reduce((sum, t) => sum + tripKm(t), 0) * 10,
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

export function tripStartPlusCode(trip: LocationTrip): string {
  return trip.startPlusCode || encodePlusCode(trip.startLat, trip.startLng);
}

export function tripEndPlusCode(trip: LocationTrip): string {
  if (trip.endPlusCode) return trip.endPlusCode;
  if (trip.endLat == null || trip.endLng == null) return '';
  return encodePlusCode(trip.endLat, trip.endLng);
}

export const TRIP_GRACE_M = 500;

export function tripRouteLabel(trip: LocationTrip): string {
  if (trip.fromName && trip.hospitalName) return `${trip.fromName} → ${trip.hospitalName}`;
  return trip.hospitalName || trip.notes || '';
}

export function metersFromPin(
  lat: number,
  lng: number,
  pinLat: number | null | undefined,
  pinLng: number | null | undefined,
): number | null {
  if (pinLat == null || pinLng == null) return null;
  return Math.round(getDistanceMeters(lat, lng, pinLat, pinLng));
}

export function graceWarning(kind: 'Start' | 'Reached', meters: number | null): string | null {
  if (meters == null || meters <= TRIP_GRACE_M) return null;
  const label = meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
  return `${kind} is ${label} from the planned place (500 m grace). Trip still saved.`;
}
