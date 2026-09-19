import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  employeeCodeMatches,
  hashLoginOtp,
  randomSixDigitOtp,
} from '../_shared/loginOtp.ts';

async function telegramSendMessage(
  botToken: string,
  chatId: string | number,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    return { ok: false, error: body.description ?? `HTTP ${res.status}` };
  }
  return { ok: true };
}

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

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const otpPepper = Deno.env.get('LOGIN_OTP_SECRET') ?? serviceRoleKey ?? '';

    if (!botToken) {
      return jsonResponse({ error: 'Telegram is not configured on the server.' }, 503);
    }
    if (!supabaseUrl || !serviceRoleKey || !otpPepper) {
      return jsonResponse({ error: 'Server credentials are not configured' }, 500);
    }

    const { employeeCode } = (await req.json()) as { employeeCode?: string };
    const codeInput = typeof employeeCode === 'string' ? employeeCode.trim() : '';
    if (!codeInput) {
      return jsonResponse({ error: 'Employee ID is required' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: employees, error: listError } = await admin
      .from('employees')
      .select('id, name, role, status, employee_code, telegram_chat_id, auth_user_id')
      .not('employee_code', 'is', null);

    if (listError) {
      console.error('[request-login-otp] list', listError.message);
      return jsonResponse({ error: 'Could not look up employee' }, 500);
    }

    const match = (employees ?? []).find((e) => employeeCodeMatches(e.employee_code as string, codeInput));

    if (!match) {
      return jsonResponse({
        ok: true,
        message: 'If this Employee ID is registered and Telegram is linked, an OTP was sent.',
      });
    }

    if (match.role === 'admin') {
      return jsonResponse({ error: 'Admins sign in with email and password (Admin login).' }, 403);
    }

    if (match.status !== 'Active') {
      return jsonResponse({ error: 'Your account is inactive. Contact admin.' }, 403);
    }

    const chatId = match.telegram_chat_id as string | null | undefined;
    if (!chatId || String(chatId).trim() === '') {
      return jsonResponse({
        error:
          'Telegram is not linked for this ID. Open @Malcon_Nexus_bot and send /start YOUR_CODE, or ask admin.',
      }, 400);
    }

    if (!match.auth_user_id) {
      return jsonResponse({
        error: 'Login is not set up for this employee yet. Ask your admin.',
      }, 400);
    }

    const since = new Date(Date.now() - RESEND_COOLDOWN_MS).toISOString();
    const { data: recent } = await admin
      .from('login_otps')
      .select('id, created_at')
      .eq('employee_id', match.id)
      .is('consumed_at', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1);

    if (recent && recent.length > 0) {
      return jsonResponse({
        error: 'Please wait a minute before requesting another OTP.',
      }, 429);
    }

    const otp = randomSixDigitOtp();
    const codeHash = await hashLoginOtp(match.id, otp, otpPepper);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { error: insertError } = await admin.from('login_otps').insert({
      employee_id: match.id,
      code_hash: codeHash,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('[request-login-otp] insert', insertError.message);
      return jsonResponse({ error: 'Could not create OTP. Try again.' }, 500);
    }

    const text = [
      '🔐 Malcon Nexus sign-in code',
      '',
      otp,
      '',
      'Valid for 5 minutes. Do not share this code.',
      'If you did not request this, ignore this message.',
    ].join('\n');

    const sent = await telegramSendMessage(botToken, chatId, text);
    if (!sent.ok) {
      console.error('[request-login-otp] telegram', sent.error);
      return jsonResponse({ error: 'Could not send OTP on Telegram. Try again.' }, 502);
    }

    return jsonResponse({
      ok: true,
      message: 'OTP sent to your linked Telegram.',
    });
  } catch (err) {
    console.error('[request-login-otp]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
