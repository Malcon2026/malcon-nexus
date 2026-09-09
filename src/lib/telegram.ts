import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';

type TelegramEvent = 'assignment' | 'postpone';

async function invokeTelegram(event: TelegramEvent, caseId: string, employeeId: string): Promise<void> {
  if (!USE_SUPABASE || !employeeId) return;

  try {
    const { data, error } = await supabase.functions.invoke('send-telegram', {
      body: { event, caseId, employeeId },
    });

    if (error) {
      console.error('[telegram] notification failed:', error.message, data ?? '');
      return;
    }

    if (data && typeof data === 'object' && 'error' in data && !('skipped' in data)) {
      console.error('[telegram] notification failed:', JSON.stringify(data));
    }
  } catch (err) {
    console.error('[telegram] notification failed:', err);
  }
}

/** Fire-and-forget Telegram when a case is assigned to an employee. */
export function notifyTelegramAssignment(caseId: string, employeeId: string | undefined | null): void {
  if (!employeeId) return;
  void invokeTelegram('assignment', caseId, employeeId);
}

/** Fire-and-forget Telegram when a case surgery date is postponed. */
export function notifyTelegramPostpone(caseId: string, employeeId: string | undefined | null): void {
  if (!employeeId) return;
  void invokeTelegram('postpone', caseId, employeeId);
}
