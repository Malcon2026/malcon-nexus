import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';

export type BikeRouteResult = {
  km: number;
  minutes: number | null;
  source: 'google' | 'mappls';
  mode: 'TWO_WHEELER';
};

/** Two-wheeler road km + minutes between start and reached pins (Google Maps card). */
export async function fetchBikeRouteKm(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  endEloc?: string,
): Promise<BikeRouteResult | null> {
  if (!USE_SUPABASE) return null;

  const { data, error } = await supabase.functions.invoke('location-bike-route', {
    body: { startLat, startLng, endLat, endLng, endEloc: endEloc || undefined },
  });

  if (error) {
    console.warn('[bike-route]', error.message);
    return null;
  }

  const payload = data as Partial<BikeRouteResult> | null;
  const km = Number(payload?.km);
  if (!Number.isFinite(km) || km < 0) return null;
  const minutesRaw = payload?.minutes;
  const minutes =
    minutesRaw == null || minutesRaw === ('' as unknown)
      ? null
      : Number.isFinite(Number(minutesRaw))
        ? Number(minutesRaw)
        : null;
  const source = payload?.source === 'mappls' ? 'mappls' : 'google';
  return { km, minutes, source, mode: 'TWO_WHEELER' };
}

export function googleBikeMapsUrl(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
): string {
  const origin = `${startLat},${startLng}`;
  const destination = `${endLat},${endLng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=two-wheeler`;
}
