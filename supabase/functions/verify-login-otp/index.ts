import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { employeeCodeMatches, hashLoginOtp } from '../_shared/loginOtp.ts';

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

const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const otpPepper = Deno.env.get('LOGIN_OTP_SECRET') ?? serviceRoleKey ?? '';

    if (!supabaseUrl || !serviceRoleKey || !otpPepper) {
      return jsonResponse({ error: 'Server credentials are not configured' }, 500);
    }

    const { employeeCode, otp } = (await req.json()) as {
      employeeCode?: string;
      otp?: string;
    };

    const codeInput = typeof employeeCode === 'string' ? employeeCode.trim() : '';
    const otpInput = typeof otp === 'string' ? otp.trim().replace(/\s/g, '') : '';

    if (!codeInput || !/^\d{6}$/.test(otpInput)) {
      return jsonResponse({ error: 'Employee ID and a 6-digit OTP are required' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: employees, error: listError } = await admin
      .from('employees')
      .select('id, email, role, status, employee_code, auth_user_id')
      .not('employee_code', 'is', null);

    if (listError) {
      console.error('[verify-login-otp] list', listError.message);
      return jsonResponse({ error: 'Could not look up employee' }, 500);
    }

    const match = (employees ?? []).find((e) => employeeCodeMatches(e.employee_code as string, codeInput));

    if (!match) {
      return jsonResponse({ error: 'Invalid Employee ID or OTP' }, 401);
    }

    if (match.role === 'admin') {
      return jsonResponse({ error: 'Use Admin login with email and password.' }, 403);
    }

    if (match.role === 'petrol') {
      return jsonResponse({ error: 'Petrol desk uses its own login. Contact admin.' }, 403);
    }

    if (match.status !== 'Active') {
      return jsonResponse({ error: 'Your account is inactive. Contact admin.' }, 403);
    }

    if (!match.auth_user_id) {
      return jsonResponse({ error: 'Login is not set up for this employee. Ask your admin.' }, 400);
    }

    const nowIso = new Date().toISOString();
    const { data: otpRows, error: otpError } = await admin
      .from('login_otps')
      .select('id, code_hash, expires_at, attempts')
      .eq('employee_id', match.id)
      .is('consumed_at', null)
      .gte('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1);

    if (otpError) {
      console.error('[verify-login-otp] otp fetch', otpError.message);
      return jsonResponse({ error: 'Could not verify OTP' }, 500);
    }

    const row = otpRows?.[0];
    if (!row) {
      return jsonResponse({ error: 'OTP expired or not found. Request a new code.' }, 401);
    }

    if ((row.attempts as number) >= MAX_ATTEMPTS) {
      await admin
        .from('login_otps')
        .update({ consumed_at: nowIso })
        .eq('id', row.id);
      return jsonResponse({ error: 'Too many wrong attempts. Request a new OTP.' }, 401);
    }

    const expectedHash = await hashLoginOtp(match.id, otpInput, otpPepper);
    if (expectedHash !== row.code_hash) {
      await admin
        .from('login_otps')
        .update({ attempts: (row.attempts as number) + 1 })
        .eq('id', row.id);
      return jsonResponse({ error: 'Invalid Employee ID or OTP' }, 401);
    }

    await admin
      .from('login_otps')
      .update({ consumed_at: nowIso })
      .eq('id', row.id);

    const loginEmail = (match.email as string | null)?.trim().toLowerCase();
    if (!loginEmail) {
      return jsonResponse({ error: 'Employee email missing. Contact admin.' }, 500);
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: loginEmail,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('[verify-login-otp] generateLink', linkError?.message);
      return jsonResponse({ error: 'Could not start session. Contact admin.' }, 500);
    }

    return jsonResponse({
      ok: true,
      token_hash: linkData.properties.hashed_token,
    });
  } catch (err) {
    console.error('[verify-login-otp]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
