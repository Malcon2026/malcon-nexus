import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
};

function jsonOk() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeEmployeeCode(raw: string): string {
  return raw.trim().replace(/^0+/, '') || '0';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';
  if (webhookSecret) {
    const header = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
    if (header !== webhookSecret) {
      console.warn('[telegram-webhook] invalid secret token');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!botToken || !supabaseUrl || !serviceRoleKey) {
    console.error('[telegram-webhook] missing env');
    return jsonOk();
  }

  let update: {
    message?: {
      chat?: { id?: number };
      text?: string;
    };
  };

  try {
    update = await req.json();
  } catch {
    return jsonOk();
  }

  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim() ?? '';
  if (!chatId || !text) return jsonOk();

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const chatIdStr = String(chatId);

  if (text === '/status') {
    const { data: linked } = await admin
      .from('employees')
      .select('name, employee_code, department')
      .eq('telegram_chat_id', chatIdStr)
      .maybeSingle();

    if (linked) {
      await telegramSendMessage(
        botToken,
        chatId,
        `Connected as ${linked.name} (${linked.employee_code ?? 'no code'})\nDepartment: ${linked.department}\n\nYou will receive case assignment and postpone alerts here.`,
      );
    } else {
      await telegramSendMessage(
        botToken,
        chatId,
        'Not connected yet.\n\nSend:\n/start YOUR_CODE\n\nFind your code in Malcon Nexus → Settings → Notifications.',
      );
    }
    return jsonOk();
  }

  if (!text.startsWith('/start')) {
    await telegramSendMessage(
      botToken,
      chatId,
      'Malcon Nexus alerts bot\n\nSend /start YOUR_CODE to connect.\n/status — check connection',
    );
    return jsonOk();
  }

  const codeArg = text.slice('/start'.length).trim();
  if (!codeArg) {
    await telegramSendMessage(
      botToken,
      chatId,
      'Welcome to Malcon Nexus!\n\nTo connect, send:\n/start YOUR_CODE\n\nYour employee code is in the app under Settings → Notifications.',
    );
    return jsonOk();
  }

  const normalized = normalizeEmployeeCode(codeArg);
  const { data: employees, error } = await admin
    .from('employees')
    .select('id, name, employee_code, status, telegram_chat_id')
    .not('employee_code', 'is', null);

  if (error) {
    console.error('[telegram-webhook] employee lookup', error.message);
    await telegramSendMessage(botToken, chatId, 'Server error. Try again in a minute.');
    return jsonOk();
  }

  const match = (employees ?? []).find((e) => {
    const code = String(e.employee_code ?? '').trim();
    if (!code) return false;
    return normalizeEmployeeCode(code) === normalized || code === codeArg.trim();
  });

  if (!match) {
    await telegramSendMessage(
      botToken,
      chatId,
      `No employee found with code "${codeArg}".\n\nCheck your code in Malcon Nexus → Settings → Notifications and try again.`,
    );
    return jsonOk();
  }

  if (match.status !== 'Active') {
    await telegramSendMessage(botToken, chatId, 'Your employee account is inactive. Contact admin.');
    return jsonOk();
  }

  if (match.telegram_chat_id && match.telegram_chat_id !== chatIdStr) {
    await telegramSendMessage(
      botToken,
      chatId,
      `${match.name} is already linked to another Telegram account.\n\nContact admin if you need to switch devices.`,
    );
    return jsonOk();
  }

  const { error: updateErr } = await admin
    .from('employees')
    .update({ telegram_chat_id: chatIdStr })
    .eq('id', match.id);

  if (updateErr) {
    console.error('[telegram-webhook] link failed', updateErr.message);
    await telegramSendMessage(botToken, chatId, 'Could not save connection. Try again.');
    return jsonOk();
  }

  await telegramSendMessage(
    botToken,
    chatId,
    `Connected!\n\n${match.name} (${match.employee_code})\n\nYou will receive Malcon Nexus alerts here when cases are assigned or postponed.`,
  );

  return jsonOk();
});
