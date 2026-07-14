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

    const { data: caller } = await admin
      .from('employees')
      .select('role')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!caller || caller.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required' }, 403);
    }

    const { employeeId, email, password, name } = await req.json();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!employeeId || !normalizedEmail || !password || !name) {
      return jsonResponse({ error: 'employeeId, email, password, and name are required' }, 400);
    }

    const { data: employee, error: empError } = await admin
      .from('employees')
      .select('id, auth_user_id')
      .eq('id', employeeId)
      .single();

    if (empError || !employee) {
      return jsonResponse({ error: 'Employee not found' }, 404);
    }

    if (employee.auth_user_id) {
      return jsonResponse({ ok: true, unchanged: true, authUserId: employee.auth_user_id });
    }

    const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
    let authUser = existingUsers?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);

    if (authUser) {
      const { error: updateError } = await admin.auth.admin.updateUserById(authUser.id, {
        password,
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: { name },
      });
      if (updateError) return jsonResponse({ error: updateError.message }, 400);
    } else {
      const { data, error: createError } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (createError) return jsonResponse({ error: createError.message }, 400);
      authUser = data.user;
    }

    const { error: linkError } = await admin
      .from('employees')
      .update({ auth_user_id: authUser!.id, email: normalizedEmail })
      .eq('id', employeeId);

    if (linkError) return jsonResponse({ error: linkError.message }, 400);

    return jsonResponse({ ok: true, authUserId: authUser!.id });
  } catch (err) {
    console.error('[create-employee-login]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
