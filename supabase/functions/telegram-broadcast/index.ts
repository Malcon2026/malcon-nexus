import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendTelegramPlainMessage } from '../_shared/alertDelivery.ts';

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

type BroadcastTarget = 'all' | 'selected';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!botToken) {
      return jsonResponse({ error: 'TELEGRAM_BOT_TOKEN is not configured', skipped: true }, 503);
    }
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server credentials not configured' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey ?? serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: caller, error: callerError } = await admin
      .from('employees')
      .select('id, role, name')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (callerError || !caller) {
      return jsonResponse({ error: 'Your employee profile was not found' }, 403);
    }
    if (caller.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required' }, 403);
    }

    const { message, target, employeeIds } = (await req.json()) as {
      message?: string;
      target?: BroadcastTarget;
      employeeIds?: string[];
    };

    const text = message?.trim() ?? '';
    if (!text) return jsonResponse({ error: 'message is required' }, 400);
    if (text.length > 4000) return jsonResponse({ error: 'Message too long (max 4000 characters)' }, 400);
    if (target !== 'all' && target !== 'selected') {
      return jsonResponse({ error: 'target must be all or selected' }, 400);
    }
    if (target === 'selected' && (!employeeIds?.length)) {
      return jsonResponse({ error: 'employeeIds required when target is selected' }, 400);
    }

    let query = admin
      .from('employees')
      .select('id, name, employee_code, telegram_chat_id')
      .eq('status', 'Active')
      .not('telegram_chat_id', 'is', null);

    if (target === 'selected') {
      query = query.in('id', employeeIds!);
    }

    const { data: recipients, error: listError } = await query;
    if (listError) return jsonResponse({ error: listError.message }, 502);

    const withChat = (recipients ?? []).filter(
      (r) => r.telegram_chat_id && String(r.telegram_chat_id).trim() !== '',
    );

    if (!withChat.length) {
      return jsonResponse({
        ok: true,
        sent: 0,
        skipped: 0,
        failed: 0,
        reason: 'no_connected_recipients',
      });
    }

    const header = `📢 Malcon Nexus\n\n${text}\n\n— ${caller.name}`;
    let sent = 0;
    let failed = 0;
    const failures: { name: string; error: string }[] = [];

    for (const emp of withChat) {
      const result = await sendTelegramPlainMessage(
        botToken,
        emp.telegram_chat_id as string,
        header,
      );
      if (result.ok) {
        sent++;
      } else {
        failed++;
        failures.push({
          name: emp.name as string,
          error: result.error ?? 'send failed',
        });
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    return jsonResponse({
      ok: true,
      sent,
      failed,
      skipped: (recipients?.length ?? 0) - withChat.length,
      total: withChat.length,
      failures: failures.slice(0, 10),
    });
  } catch (err) {
    console.error('[telegram-broadcast]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
