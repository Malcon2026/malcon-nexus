import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { deliverTelegramAlert } from '../_shared/alertDelivery.ts';

const ALERT_2_DELAY_MS = 15 * 60 * 1000;
const ALERT_3_DELAY_MS = 30 * 60 * 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const cronSecret = Deno.env.get('ALERT_CRON_SECRET');
    if (cronSecret) {
      const provided = req.headers.get('x-cron-secret');
      if (provided !== cronSecret) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
    }

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!botToken) {
      return jsonResponse({ error: 'TELEGRAM_BOT_TOKEN is not configured', skipped: true }, 503);
    }
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Supabase service credentials are not configured' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const now = Date.now();

    const { data: rows, error } = await supabase
      .from('case_alert_escalations')
      .select('id, case_id, employee_id, event_type, alert_1_sent_at, alert_2_sent_at, alert_3_sent_at, acknowledged_at')
      .is('acknowledged_at', null)
      .is('alert_3_sent_at', null);

    if (error) {
      return jsonResponse({ error: error.message }, 502);
    }

    let alert2Sent = 0;
    let alert3Sent = 0;

    for (const row of rows ?? []) {
      const t1 = new Date(row.alert_1_sent_at as string).getTime();
      const eventType = row.event_type as 'assignment' | 'postpone';

      if (!row.alert_2_sent_at && now - t1 >= ALERT_2_DELAY_MS) {
        const tg2 = await deliverTelegramAlert(
          supabase,
          botToken,
          row.case_id as string,
          row.employee_id as string,
          eventType,
          2,
        );
        if (tg2.ok) {
          await supabase
            .from('case_alert_escalations')
            .update({ alert_2_sent_at: new Date().toISOString() })
            .eq('id', row.id);
          alert2Sent++;
        }
      }

      if (!row.alert_3_sent_at && now - t1 >= ALERT_3_DELAY_MS) {
        const tg3 = await deliverTelegramAlert(
          supabase,
          botToken,
          row.case_id as string,
          row.employee_id as string,
          eventType,
          3,
        );
        if (tg3.ok) {
          await supabase
            .from('case_alert_escalations')
            .update({ alert_3_sent_at: new Date().toISOString() })
            .eq('id', row.id);
          alert3Sent++;
        }
      }
    }

    return jsonResponse({ ok: true, checked: rows?.length ?? 0, alert2Sent, alert3Sent });
  } catch (err) {
    console.error('[process-alert-escalations]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
