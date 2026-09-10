import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';

export type TelegramBroadcastResult =
  | { ok: true; sent: number; failed: number; skipped?: number; total?: number; failures?: { name: string; error: string }[] }
  | { ok: false; error: string };

export async function sendTelegramBroadcast(
  message: string,
  target: 'all' | 'selected',
  employeeIds?: string[],
): Promise<TelegramBroadcastResult> {
  if (!USE_SUPABASE) return { ok: false, error: 'Supabase is not enabled.' };

  const { data, error } = await supabase.functions.invoke('telegram-broadcast', {
    body: { message, target, employeeIds },
  });

  if (error) {
    return { ok: false, error: error.message ?? 'Broadcast failed.' };
  }

  if (data && typeof data === 'object' && 'error' in data) {
    return { ok: false, error: String((data as { error: string }).error) };
  }

  const body = data as {
    sent?: number;
    failed?: number;
    skipped?: number;
    total?: number;
    failures?: { name: string; error: string }[];
    reason?: string;
  };

  if (body.reason === 'no_connected_recipients') {
    return { ok: false, error: 'No connected Telegram recipients for this selection.' };
  }

  return {
    ok: true,
    sent: body.sent ?? 0,
    failed: body.failed ?? 0,
    skipped: body.skipped,
    total: body.total,
    failures: body.failures,
  };
}
