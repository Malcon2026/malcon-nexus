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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Supabase service credentials are not configured' }, 500);
    }

    const { caseId, employeeId } = (await req.json()) as {
      caseId?: string;
      employeeId?: string;
    };

    if (!caseId || !employeeId) {
      return jsonResponse({ error: 'caseId and employeeId are required' }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('case_alert_escalations')
      .update({ acknowledged_at: now })
      .eq('case_id', caseId)
      .eq('employee_id', employeeId)
      .is('acknowledged_at', null);

    if (error) {
      return jsonResponse({ error: error.message }, 502);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[acknowledge-case-alerts]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
