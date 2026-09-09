import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function telegramSendMessage(
  botToken: string,
  chatId: string | number,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    return { ok: false, error: body.description ?? `HTTP ${res.status}` };
  }
  return { ok: true };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type TelegramEvent = 'assignment' | 'postpone';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!botToken) {
      return jsonResponse({ error: 'TELEGRAM_BOT_TOKEN is not configured', skipped: true }, 503);
    }
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Supabase service credentials are not configured' }, 500);
    }

    const { event, caseId, employeeId } = (await req.json()) as {
      event?: TelegramEvent;
      caseId?: string;
      employeeId?: string;
    };

    if (!event || !caseId || !employeeId) {
      return jsonResponse({ error: 'event, caseId, and employeeId are required' }, 400);
    }
    if (event !== 'assignment' && event !== 'postpone') {
      return jsonResponse({ error: 'event must be assignment or postpone' }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const [{ data: caseRow, error: caseError }, { data: employee, error: employeeError }] =
      await Promise.all([
        supabase
          .from('cases')
          .select('case_number, current_stage, hospital_snapshot, surgery_date, priority, postpone_reason')
          .eq('id', caseId)
          .single(),
        supabase
          .from('employees')
          .select('name, telegram_chat_id')
          .eq('id', employeeId)
          .single(),
      ]);

    if (caseError || !caseRow) {
      return jsonResponse({ error: 'Case not found' }, 404);
    }
    if (employeeError || !employee) {
      return jsonResponse({ error: 'Employee not found' }, 404);
    }

    const chatId = employee.telegram_chat_id as string | null | undefined;
    if (!chatId) {
      return jsonResponse({ ok: true, skipped: true, reason: 'employee_not_linked' });
    }

    const hospitalSnapshot = caseRow.hospital_snapshot as { name?: string } | null;
    const hospitalName = hospitalSnapshot?.name ?? 'Hospital';
    const surgeryDate = (caseRow.surgery_date as string | null) ?? 'TBD';

    let text: string;
    if (event === 'assignment') {
      text = [
        '🔔 New case assigned',
        '',
        `Case: ${caseRow.case_number}`,
        `Hospital: ${hospitalName}`,
        `Stage: ${caseRow.current_stage}`,
        `Surgery: ${surgeryDate}`,
        `Priority: ${caseRow.priority}`,
        '',
        'Open Malcon Nexus app for details.',
      ].join('\n');
    } else {
      const reason = (caseRow.postpone_reason as string | null)?.trim();
      text = [
        '⚠️ Case postponed',
        '',
        `Case: ${caseRow.case_number}`,
        `Hospital: ${hospitalName}`,
        `New surgery date: ${surgeryDate}`,
        `Kit stays at: ${caseRow.current_stage}`,
        reason ? `Reason: ${reason}` : '',
        '',
        'Open Malcon Nexus app for details.',
      ]
        .filter(Boolean)
        .join('\n');
    }

    const sent = await telegramSendMessage(botToken, chatId, text);
    if (!sent.ok) {
      return jsonResponse({ error: 'Failed to send Telegram message', details: sent.error }, 502);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[send-telegram]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
