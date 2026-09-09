import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { deliverPushAlert, deliverTelegramAlert } from '../_shared/alertDelivery.ts';

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

/** Send all 3 alert templates immediately (testing only). */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const appUrl = Deno.env.get('APP_URL') ?? 'https://malcon-nexus-gamma.vercel.app';

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
    const results: Record<string, unknown> = {};

    if (botToken) {
      results.alert1 = await deliverTelegramAlert(supabase, botToken, caseId, employeeId, event, 1);
      results.alert3 = await deliverTelegramAlert(supabase, botToken, caseId, employeeId, event, 3);
    } else {
      results.alert1 = { skipped: true, reason: 'no_bot_token' };
      results.alert3 = { skipped: true, reason: 'no_bot_token' };
    }

    if (vapidPublic && vapidPrivate) {
      results.alert2 = await deliverPushAlert(
        supabase,
        vapidPublic,
        vapidPrivate,
        appUrl,
        caseId,
        employeeId,
        event,
      );
    } else {
      results.alert2 = { skipped: true, reason: 'no_vapid_keys' };
    }

    return jsonResponse({ ok: true, results });
  } catch (err) {
    console.error('[test-case-alerts]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
