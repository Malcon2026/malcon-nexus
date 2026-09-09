import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { deliverTelegramAlert } from '../_shared/alertDelivery.ts';

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

type AlertEvent = 'assignment' | 'postpone';

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
      event?: AlertEvent;
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

    const { error: upsertError } = await supabase.from('case_alert_escalations').upsert(
      {
        case_id: caseId,
        employee_id: employeeId,
        event_type: event,
        alert_1_sent_at: new Date().toISOString(),
        alert_2_sent_at: null,
        alert_3_sent_at: null,
        acknowledged_at: null,
      },
      { onConflict: 'case_id,employee_id,event_type' },
    );

    if (upsertError) {
      return jsonResponse({ error: upsertError.message }, 502);
    }

    const sent = await deliverTelegramAlert(supabase, botToken, caseId, employeeId, event, 1);
    if (!sent.ok && !sent.skipped) {
      return jsonResponse({ error: sent.error ?? 'Alert 1 failed' }, 502);
    }

    return jsonResponse({
      ok: true,
      alertLevel: 1,
      telegram: sent.skipped ? { skipped: true, reason: sent.reason } : { sent: true },
    });
  } catch (err) {
    console.error('[start-case-alerts]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
