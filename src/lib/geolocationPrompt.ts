import { getCurrentPosition, type GeoPosition } from './attendance';

export type GeolocationPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true ||
    new URLSearchParams(window.location.search).has('pwa')
  );
}

export async function queryGeolocationPermission(): Promise<GeolocationPermissionState> {
  if (!navigator.permissions?.query) return 'unknown';
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state as GeolocationPermissionState;
  } catch {
    return 'unknown';
  }
}

export function locationDeniedMessage(): string {
  if (isStandalonePwa()) {
    return 'Location blocked. Open phone Settings → Malcon Nexus → Location → Allow, or tap below to ask again.';
  }
  return 'Location permission denied. Allow location in browser settings, then tap Try again.';
}

/** Always fresh GPS read; triggers the system prompt when the browser allows it. */
export async function requestLocationAccess(): Promise<GeoPosition> {
  await queryGeolocationPermission();
  return getCurrentPosition();
}

export function isLocationPermissionDeniedError(message: string): boolean {
  return /permission denied|location blocked|not allowed/i.test(message);
}
