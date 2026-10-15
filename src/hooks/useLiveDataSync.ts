import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { REMOTE_DATA } from '../lib/database/config';
import { LIVE_DATA_POLL_MS, refreshLiveWorkspaceData } from '../lib/liveDataSync';

/**
 * Polls the Worker/AWS API while the tab is visible so workflow cards update
 * when someone else submits a stage (replaces Supabase Realtime on AWS).
 */
export function useLiveDataSync(enabled: boolean): void {
  const reloadFromDatabase = useStore((s) => s.reloadFromDatabase);
  const userId = useStore((s) => s.currentUser.id);
  const userRole = useStore((s) => s.currentUser.role);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled || !REMOTE_DATA) return;

    const run = async () => {
      if (document.visibilityState !== 'visible') return;
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const { bootstrapRoleForEmployee } = await import('../lib/roles');
        const role = bootstrapRoleForEmployee(userRole);
        if (role === 'petrol') return;
        await refreshLiveWorkspaceData(role, { employeeId: userId });
        reloadFromDatabase();
      } catch (err) {
        console.warn('[live-sync] refresh failed:', err);
      } finally {
        inFlight.current = false;
      }
    };

    const intervalId = window.setInterval(() => void run(), LIVE_DATA_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, userId, userRole, reloadFromDatabase]);
}
