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
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

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
    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { employeeId, newEmail } = await req.json();
    const normalized = typeof newEmail === 'string' ? newEmail.trim().toLowerCase() : '';

    if (!employeeId || !normalized || !normalized.includes('@')) {
      return jsonResponse({ error: 'employeeId and a valid newEmail are required' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: caller, error: callerError } = await admin
      .from('employees')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (callerError || !caller) {
      return jsonResponse({ error: 'Your employee profile was not found' }, 403);
    }

    const { data: target, error: targetError } = await admin
      .from('employees')
      .select('id, email, auth_user_id')
      .eq('id', employeeId)
      .single();

    if (targetError || !target) {
      return jsonResponse({ error: 'Employee not found' }, 404);
    }

    const isAdmin = caller.role === 'admin';
    const isSelf = caller.id === employeeId;
    if (!isAdmin && !isSelf) {
      return jsonResponse({ error: 'You can only change your own login email' }, 403);
    }

    if (target.email?.toLowerCase() === normalized) {
      return jsonResponse({ ok: true, unchanged: true });
    }

    const { data: emailTaken } = await admin
      .from('employees')
      .select('id')
      .ilike('email', normalized)
      .neq('id', employeeId)
      .maybeSingle();

    if (emailTaken) {
      return jsonResponse({ error: 'That email is already used by another employee' }, 409);
    }

    if (!target.auth_user_id) {
      return jsonResponse({
        error: 'This employee has no login account yet. Add them via the bulk sync script or create an auth user first.',
      }, 400);
    }

    const { error: authError } = await admin.auth.admin.updateUserById(target.auth_user_id, {
      email: normalized,
      email_confirm: true,
    });

    if (authError) {
      console.error('[update-employee-login-email] auth update failed:', authError.message);
      return jsonResponse({ error: authError.message }, 400);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[update-employee-login-email]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
