import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import {
  buildPushAlertMessage,
  buildTelegramAlertMessage,
  type AlertEvent,
  type AlertLevel,
  type CaseAlertContext,
} from './alertMessages.ts';

async function loadCaseContext(
  supabase: SupabaseClient,
  caseId: string,
): Promise<CaseAlertContext | null> {
  const { data: caseRow, error } = await supabase
    .from('cases')
    .select('case_number, current_stage, hospital_snapshot, surgery_date, priority, postpone_reason')
    .eq('id', caseId)
    .single();

  if (error || !caseRow) return null;

  const hospitalSnapshot = caseRow.hospital_snapshot as { name?: string } | null;
  return {
    caseNumber: caseRow.case_number as string,
    hospitalName: hospitalSnapshot?.name ?? 'Hospital',
    currentStage: caseRow.current_stage as string,
    surgeryDate: (caseRow.surgery_date as string | null) ?? 'TBD',
    priority: caseRow.priority as string,
    postponeReason: (caseRow.postpone_reason as string | null) ?? undefined,
  };
}

async function telegramSendMessage(
  botToken: string,
  chatId: string | number,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    return { ok: false, error: body.description ?? `HTTP ${res.status}` };
  }
  return { ok: true };
}

export async function deliverTelegramAlert(
  supabase: SupabaseClient,
  botToken: string,
  caseId: string,
  employeeId: string,
  event: AlertEvent,
  level: Extract<AlertLevel, 1 | 3>,
): Promise<{ ok: boolean; skipped?: boolean; reason?: string; error?: string }> {
  const ctx = await loadCaseContext(supabase, caseId);
  if (!ctx) return { ok: false, error: 'Case not found' };

  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('telegram_chat_id')
    .eq('id', employeeId)
    .single();

  if (employeeError || !employee) return { ok: false, error: 'Employee not found' };

  const chatId = employee.telegram_chat_id as string | null | undefined;
  if (!chatId) return { ok: true, skipped: true, reason: 'employee_not_linked' };

  const text = buildTelegramAlertMessage(event, level, ctx);
  const sent = await telegramSendMessage(botToken, chatId, text);
  if (!sent.ok) return { ok: false, error: sent.error ?? 'Telegram send failed' };
  return { ok: true };
}

export async function deliverPushAlert(
  supabase: SupabaseClient,
  vapidPublic: string,
  vapidPrivate: string,
  appUrl: string,
  caseId: string,
  employeeId: string,
  event: AlertEvent,
): Promise<{ ok: boolean; skipped?: boolean; reason?: string; sent?: number; error?: string }> {
  const ctx = await loadCaseContext(supabase, caseId);
  if (!ctx) return { ok: false, error: 'Case not found' };

  webpush.setVapidDetails('mailto:admin@malconnexus.com', vapidPublic, vapidPrivate);

  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('employee_id', employeeId);

  if (subsError) return { ok: false, error: subsError.message };
  if (!subs?.length) return { ok: true, skipped: true, reason: 'no_subscriptions' };

  const { title, body } = buildPushAlertMessage(event, 2, ctx);
  const payload = JSON.stringify({
    title: `Malcon Nexus — ${title}`,
    body,
    url: `${appUrl}/`,
    tag: `case-${caseId}-alert-2`,
  });

  let sent = 0;
  const staleIds: string[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) staleIds.push(sub.id);
    }
  }

  if (staleIds.length) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds);
  }

  return { ok: true, sent };
}
