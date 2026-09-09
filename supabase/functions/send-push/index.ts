import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

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

type PushEvent = 'assignment' | 'postpone';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const appUrl = Deno.env.get('APP_URL') ?? 'https://malcon-nexus-gamma.vercel.app';

    if (!publicKey || !privateKey) {
      return jsonResponse({ error: 'VAPID keys not configured', skipped: true }, 503);
    }
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Supabase service credentials are not configured' }, 500);
    }

    const { event, caseId, employeeId } = (await req.json()) as {
      event?: PushEvent;
      caseId?: string;
      employeeId?: string;
    };

    if (!event || !caseId || !employeeId) {
      return jsonResponse({ error: 'event, caseId, and employeeId are required' }, 400);
    }
    if (event !== 'assignment' && event !== 'postpone') {
      return jsonResponse({ error: 'event must be assignment or postpone' }, 400);
    }

    webpush.setVapidDetails('mailto:admin@malconnexus.com', publicKey, privateKey);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const [{ data: caseRow, error: caseError }, { data: subs, error: subsError }] = await Promise.all([
      supabase
        .from('cases')
        .select('case_number, current_stage, hospital_snapshot, surgery_date, priority, postpone_reason')
        .eq('id', caseId)
        .single(),
      supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('employee_id', employeeId),
    ]);

    if (caseError || !caseRow) {
      return jsonResponse({ error: 'Case not found' }, 404);
    }
    if (subsError) {
      console.error('[send-push] subscriptions', subsError.message);
      return jsonResponse({ error: 'Failed to load subscriptions' }, 502);
    }

    if (!subs?.length) {
      return jsonResponse({ ok: true, skipped: true, reason: 'no_subscriptions' });
    }

    const hospitalSnapshot = caseRow.hospital_snapshot as { name?: string } | null;
    const hospitalName = hospitalSnapshot?.name ?? 'Hospital';
    const surgeryDate = (caseRow.surgery_date as string | null) ?? 'TBD';

    let title: string;
    let body: string;
    if (event === 'assignment') {
      title = 'New case assigned';
      body = `${caseRow.case_number} · ${hospitalName} · ${caseRow.current_stage} · ${surgeryDate}`;
    } else {
      const reason = (caseRow.postpone_reason as string | null)?.trim();
      title = 'Case postponed';
      body = `${caseRow.case_number} → ${surgeryDate}${reason ? ` · ${reason}` : ''}`;
    }

    const payload = JSON.stringify({
      title: `Malcon Nexus — ${title}`,
      body,
      url: `${appUrl}/`,
      tag: `case-${caseId}`,
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
        console.error('[send-push] send failed', status, sub.endpoint.slice(0, 40));
        if (status === 404 || status === 410) staleIds.push(sub.id);
      }
    }

    if (staleIds.length) {
      await supabase.from('push_subscriptions').delete().in('id', staleIds);
    }

    return jsonResponse({ ok: true, sent, total: subs.length });
  } catch (err) {
    console.error('[send-push]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
