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

/** Send all 3 Telegram alert templates immediately (testing only). */
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

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const alert1 = await deliverTelegramAlert(supabase, botToken, caseId, employeeId, event, 1);
    const alert2 = await deliverTelegramAlert(supabase, botToken, caseId, employeeId, event, 2);
    const alert3 = await deliverTelegramAlert(supabase, botToken, caseId, employeeId, event, 3);

    return jsonResponse({ ok: true, results: { alert1, alert2, alert3 } });
  } catch (err) {
    console.error('[test-case-alerts]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
