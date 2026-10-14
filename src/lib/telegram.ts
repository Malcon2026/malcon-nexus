import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';
import { USE_CLOUDFLARE_BACKEND } from './cloudflareConfig';
import { workerFetchJson } from './workerApi';

type TelegramEvent = 'assignment' | 'postpone';

async function invokeTelegramWorker(event: TelegramEvent, caseId: string, employeeId: string): Promise<void> {
  try {
    await workerFetchJson<{ ok?: boolean; skipped?: boolean }>('/api/telegram/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, caseId, employeeId }),
    });
  } catch (err) {
    console.error('[telegram] Worker notification failed:', err);
  }
}

async function invokeTelegramSupabase(event: TelegramEvent, caseId: string, employeeId: string): Promise<void> {
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

async function invokeTelegram(event: TelegramEvent, caseId: string, employeeId: string): Promise<void> {
  if (!employeeId) return;
  if (USE_CLOUDFLARE_BACKEND) {
    await invokeTelegramWorker(event, caseId, employeeId);
    return;
  }
  if (!USE_SUPABASE) return;
  await invokeTelegramSupabase(event, caseId, employeeId);
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
