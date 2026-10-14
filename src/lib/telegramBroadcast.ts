import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';
import { USE_CLOUDFLARE_BACKEND } from './cloudflareConfig';
import { WorkerApiError, workerFetchJson } from './workerApi';

export type TelegramBroadcastResult =
  | { ok: true; sent: number; failed: number; skipped?: number; total?: number; failures?: { name: string; error: string }[] }
  | { ok: false; error: string };

export async function sendTelegramBroadcast(
  message: string,
  target: 'all' | 'selected',
  employeeIds?: string[],
): Promise<TelegramBroadcastResult> {
  if (USE_CLOUDFLARE_BACKEND) {
    try {
      const body = await workerFetchJson<{
        sent?: number;
        failed?: number;
        total?: number;
        failures?: { name: string; error: string }[];
        error?: string;
        reason?: string;
      }>('/api/telegram/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, target, employeeIds }),
      });

      if (body.reason === 'no_connected_recipients') {
        return { ok: false, error: 'No connected Telegram recipients for this selection.' };
      }

      return {
        ok: true,
        sent: body.sent ?? 0,
        failed: body.failed ?? 0,
        total: body.total,
        failures: body.failures,
      };
    } catch (e) {
      const msg =
        e instanceof WorkerApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Broadcast failed.';
      return { ok: false, error: msg };
    }
  }

  if (!USE_SUPABASE) return { ok: false, error: 'Telegram broadcast is not configured for this deployment.' };

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
