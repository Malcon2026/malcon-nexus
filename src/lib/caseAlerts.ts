import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';

type AlertEvent = 'assignment' | 'postpone';

async function invokeCaseAlerts(
  fn: string,
  body: Record<string, string>,
): Promise<void> {
  if (!USE_SUPABASE) return;

  try {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) {
      console.error(`[caseAlerts] ${fn} failed:`, error.message, data ?? '');
      return;
    }
    if (data && typeof data === 'object' && 'error' in data && !('skipped' in data)) {
      console.error(`[caseAlerts] ${fn} failed:`, JSON.stringify(data));
    }
  } catch (err) {
    console.error(`[caseAlerts] ${fn} failed:`, err);
  }
}

/** Start 3-step alert ladder: Alert 1 now, 2 at +15m, 3 at +30m (then stop). */
export function startCaseAlertEscalation(
  caseId: string,
  employeeId: string | undefined | null,
  event: AlertEvent,
): void {
  if (!employeeId) return;
  void invokeCaseAlerts('start-case-alerts', { event, caseId, employeeId });
}

/** Stop pending Alert 2 / Alert 3 when employee acts on the case. */
export function acknowledgeCaseAlerts(
  caseId: string,
  employeeId: string | undefined | null,
): void {
  if (!employeeId) return;
  void invokeCaseAlerts('acknowledge-case-alerts', { caseId, employeeId });
}
