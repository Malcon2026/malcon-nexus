import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';
import { USE_CLOUDFLARE_BACKEND } from './cloudflareConfig';
import { workerFetchJson } from './workerApi';

type AlertEvent = 'assignment' | 'postpone';

async function invokeCaseAlertsWorker(
  path: '/api/case-alerts/start' | '/api/case-alerts/acknowledge',
  body: Record<string, string>,
): Promise<void> {
  try {
    await workerFetchJson<{ ok?: boolean }>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`[caseAlerts] ${path} failed:`, err);
  }
}

async function invokeCaseAlertsSupabase(
  fn: string,
  body: Record<string, string>,
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) {
      console.error(`[caseAlerts] ${fn} failed:`, error.message, data ?? '');
      return;
    }
    if (data && typeof data === 'object') {
      if ('error' in data && !('skipped' in data)) {
        console.error(`[caseAlerts] ${fn} failed:`, JSON.stringify(data));
      } else if ('telegram' in data && data.telegram && typeof data.telegram === 'object') {
        const tg = data.telegram as { skipped?: boolean; reason?: string; sent?: boolean };
        if (tg.skipped) {
          console.warn(`[caseAlerts] ${fn} telegram skipped:`, tg.reason ?? 'unknown');
        }
      }
    }
  } catch (err) {
    console.error(`[caseAlerts] ${fn} failed:`, err);
  }
}

/** Start Telegram ladder: Alert 1 now, reminder at +3h if stage not completed (then stop). */
export function startCaseAlertEscalation(
  caseId: string,
  employeeId: string | undefined | null,
  event: AlertEvent,
): void {
  if (!employeeId) return;
  if (USE_CLOUDFLARE_BACKEND) {
    void invokeCaseAlertsWorker('/api/case-alerts/start', { event, caseId, employeeId });
    return;
  }
  if (!USE_SUPABASE) return;
  void invokeCaseAlertsSupabase('start-case-alerts', { event, caseId, employeeId });
}

/** Stop pending reminders when the assignee completes their stage. */
export function acknowledgeCaseAlerts(
  caseId: string,
  employeeId: string | undefined | null,
): void {
  if (!employeeId) return;
  if (USE_CLOUDFLARE_BACKEND) {
    void invokeCaseAlertsWorker('/api/case-alerts/acknowledge', { caseId, employeeId });
    return;
  }
  if (!USE_SUPABASE) return;
  void invokeCaseAlertsSupabase('acknowledge-case-alerts', { caseId, employeeId });
}
