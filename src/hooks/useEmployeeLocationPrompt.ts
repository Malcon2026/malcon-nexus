import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isLocationPermissionDeniedError,
  queryGeolocationPermission,
  requestLocationAccess,
  type GeolocationPermissionState,
} from '../lib/geolocationPrompt';

export type EmployeeLocationPromptState = {
  permission: GeolocationPermissionState;
  lastError: string | null;
  requesting: boolean;
  retryLocation: () => Promise<void>;
};

/**
 * Ask for GPS when the employee app opens and every time they return to the app.
 * If denied, call again on each retry (punch screen, banner button, foreground).
 */
export function useEmployeeLocationPrompt(enabled: boolean): EmployeeLocationPromptState {
  const [permission, setPermission] = useState<GeolocationPermissionState>('unknown');
  const [lastError, setLastError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const retryLocation = useCallback(async () => {
    if (!enabled || !navigator.geolocation) return;
    setRequesting(true);
    setLastError(null);
    try {
      await requestLocationAccess();
      if (!mounted.current) return;
      setPermission('granted');
      setLastError(null);
    } catch (err) {
      if (!mounted.current) return;
      const message = err instanceof Error ? err.message : 'Failed to get location.';
      setLastError(message);
      if (isLocationPermissionDeniedError(message)) {
        setPermission('denied');
      } else {
        const q = await queryGeolocationPermission();
        setPermission(q);
      }
    } finally {
      if (mounted.current) setRequesting(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void retryLocation();
  }, [enabled, retryLocation]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void retryLocation();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [enabled, retryLocation]);

  return { permission, lastError, requesting, retryLocation };
}
