import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server credentials not configured' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey ?? serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: employee, error: empErr } = await admin
      .from('employees')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (empErr || !employee) {
      return jsonResponse({ error: 'Employee profile not found' }, 404);
    }

    const { endpoint, keys, userAgent } = await req.json() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
      userAgent?: string;
    };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return jsonResponse({ error: 'endpoint and keys (p256dh, auth) are required' }, 400);
    }

    const { error: upsertErr } = await admin.from('push_subscriptions').upsert(
      {
        employee_id: employee.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: userAgent ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );

    if (upsertErr) {
      console.error('[push-subscribe]', upsertErr.message);
      return jsonResponse({ error: 'Failed to save subscription' }, 502);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[push-subscribe]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
