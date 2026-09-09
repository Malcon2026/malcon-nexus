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

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') ?? '';
    const expected = Deno.env.get('TV_BOARD_TOKEN') ?? '';

    if (!expected) {
      return jsonResponse({ error: 'TV board not configured' }, 503);
    }
    if (!token || !safeEqual(token, expected)) {
      return jsonResponse({ error: 'Invalid or missing token' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server credentials not configured' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const [casesRes, employeesRes, settingsRes] = await Promise.all([
      supabase.from('cases').select('*').order('updated_at', { ascending: false }),
      supabase.from('employees').select('*').order('name'),
      supabase.from('app_settings').select('value').eq('key', 'tv_notice').maybeSingle(),
    ]);

    if (casesRes.error) {
      console.error('[tv-board-feed] cases', casesRes.error.message);
      return jsonResponse({ error: 'Failed to load cases' }, 502);
    }
    if (employeesRes.error) {
      console.error('[tv-board-feed] employees', employeesRes.error.message);
      return jsonResponse({ error: 'Failed to load employees' }, 502);
    }

    const tvNotice = (settingsRes.data?.value as string | undefined) ?? '';

    return jsonResponse({
      ok: true,
      cases: casesRes.data ?? [],
      employees: employeesRes.data ?? [],
      tvNotice,
    });
  } catch (err) {
    console.error('[tv-board-feed]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
