import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';

export type BikeRouteResult = {
  km: number;
  source: 'google' | 'mappls';
};

/** Two-wheeler road km between start and reached pins. Null if Maps is not set up. */
export async function fetchBikeRouteKm(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
): Promise<BikeRouteResult | null> {
  if (!USE_SUPABASE) return null;

  const { data, error } = await supabase.functions.invoke('location-bike-route', {
    body: { startLat, startLng, endLat, endLng },
  });

  if (error) {
    console.warn('[bike-route]', error.message);
    return null;
  }

  const km = Number((data as { km?: unknown } | null)?.km);
  const source = (data as { source?: string } | null)?.source;
  if (!Number.isFinite(km) || km < 0) return null;
  if (source !== 'google' && source !== 'mappls') {
    return { km, source: 'google' };
  }
  return { km, source };
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
