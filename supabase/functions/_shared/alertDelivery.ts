import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildTelegramAlertMessage,
  type AlertEvent,
  type AlertLevel,
  type CaseDetails,
} from './alertMessages.ts';

export const DEFAULT_APP_URL = 'https://malcon-nexus-gamma.vercel.app';

export function getAppUrl(): string {
  const url = Deno.env.get('APP_URL') ?? DEFAULT_APP_URL;
  return url.replace(/\/$/, '');
}

async function loadCaseContext(
  supabase: SupabaseClient,
  caseId: string,
): Promise<CaseDetails | null> {
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
  appUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[{ text: '📲 Open Malcon Nexus', url: appUrl }]],
      },
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
  level: AlertLevel,
): Promise<{ ok: boolean; skipped?: boolean; reason?: string; error?: string }> {
  const ctx = await loadCaseContext(supabase, caseId);
  if (!ctx) return { ok: false, error: 'Case not found' };

  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('name, telegram_chat_id')
    .eq('id', employeeId)
    .single();

  if (employeeError || !employee) return { ok: false, error: 'Employee not found' };

  const chatId = employee.telegram_chat_id as string | null | undefined;
  if (!chatId) return { ok: true, skipped: true, reason: 'employee_not_linked' };

  const text = buildTelegramAlertMessage(event, level, {
    ...ctx,
    employeeName: (employee.name as string) ?? 'Employee',
  });
  const sent = await telegramSendMessage(botToken, chatId, text, getAppUrl());
  if (!sent.ok) return { ok: false, error: sent.error ?? 'Telegram send failed' };
  return { ok: true };
}
