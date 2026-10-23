import type { ActionCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import { employeeCodeMatches, parseTelegramStartArg } from './loginOtp';
import { telegramChatReachable, telegramSendMessage } from './telegramApi';

type TelegramEvent = 'assignment' | 'postpone';

function botToken(): string | null {
  const t = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return t || null;
}

function parseHospitalName(snapshot: unknown): string {
  if (!snapshot) return 'Hospital';
  const raw = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot);
  try {
    const o = JSON.parse(raw) as { name?: string };
    return o.name?.trim() || 'Hospital';
  } catch {
    return 'Hospital';
  }
}

export async function sendCaseTelegram(
  ctx: ActionCtx,
  event: TelegramEvent,
  caseId: string,
  employeeId: string,
): Promise<{ ok: true; skipped?: boolean } | { error: string; status: number }> {
  const token = botToken();
  if (!token) return { error: 'TELEGRAM_BOT_TOKEN is not configured', status: 503 };

  const [caseRow, employee] = await Promise.all([
    ctx.runQuery(internal.dataQueries.getRow, { table: 'cases', legacyId: caseId }),
    ctx.runQuery(internal.dataQueries.getRow, { table: 'employees', legacyId: employeeId }),
  ]);

  if (!caseRow) return { error: 'Case not found', status: 404 };
  if (!employee) return { error: 'Employee not found', status: 404 };

  const chatId = String(employee.telegram_chat_id ?? '').trim();
  if (!chatId) return { ok: true, skipped: true };

  const hospitalName = parseHospitalName(caseRow.hospital_snapshot);
  const surgeryDate = String(caseRow.surgery_date ?? 'TBD');

  let text: string;
  if (event === 'assignment') {
    text = [
      '🔔 New case assigned',
      '',
      `Case: ${caseRow.case_number}`,
      `Hospital: ${hospitalName}`,
      `Stage: ${caseRow.current_stage}`,
      `Surgery: ${surgeryDate}`,
      `Priority: ${caseRow.priority}`,
      '',
      'Open Malcon Nexus app for details.',
    ].join('\n');
  } else {
    const reason = String(caseRow.postpone_reason ?? '').trim();
    text = [
      '⚠️ Case postponed',
      '',
      `Case: ${caseRow.case_number}`,
      `Hospital: ${hospitalName}`,
      `New surgery date: ${surgeryDate}`,
      `Kit stays at: ${caseRow.current_stage}`,
      reason ? `Reason: ${reason}` : '',
      '',
      'Open Malcon Nexus app for details.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const sent = await telegramSendMessage(token, chatId, text);
  if (!sent.ok) return { error: sent.error, status: 502 };
  return { ok: true };
}

export async function broadcastTelegram(
  ctx: ActionCtx,
  message: string,
  target: 'all' | 'selected',
  employeeIds?: string[],
): Promise<
  | { sent: number; failed: number; total: number; failures: { name: string; error: string }[] }
  | { error: string; status: number; reason?: string }
> {
  const token = botToken();
  if (!token) return { error: 'TELEGRAM_BOT_TOKEN is not configured', status: 503 };

  const text = message.trim();
  if (!text) return { error: 'message is required', status: 400 };
  if (text.length > 4000) return { error: 'Message too long (max 4000 characters)', status: 400 };

  const { items } = await ctx.runQuery(internal.dataQueries.listRows, { table: 'employees' });
  let rows = items.filter(
    (r) => String(r.status ?? '') === 'Active' && String(r.telegram_chat_id ?? '').trim(),
  );
  if (target === 'selected') {
    if (!employeeIds?.length) {
      return { error: 'employeeIds required when target is selected', status: 400 };
    }
    const set = new Set(employeeIds);
    rows = rows.filter((r) => set.has(String(r.id)));
  }

  if (rows.length === 0) {
    return { error: 'No connected Telegram recipients', status: 400, reason: 'no_connected_recipients' };
  }

  let sent = 0;
  let failed = 0;
  const failures: { name: string; error: string }[] = [];

  for (const emp of rows) {
    const chatId = String(emp.telegram_chat_id ?? '').trim();
    const result = await telegramSendMessage(token, chatId, text);
    if (result.ok) sent += 1;
    else {
      failed += 1;
      failures.push({ name: String(emp.name ?? 'Unknown'), error: result.error });
    }
  }

  return { sent, failed, total: rows.length, failures };
}

export async function handleTelegramWebhookUpdate(ctx: ActionCtx, update: unknown): Promise<void> {
  const token = botToken();
  if (!token) return;

  const msg = (update as { message?: { chat?: { id?: number }; text?: string } })?.message;
  const chatId = msg?.chat?.id;
  const text = msg?.text?.trim() ?? '';
  if (!chatId || !text) return;

  const chatIdStr = String(chatId);
  const { items: employees } = await ctx.runQuery(internal.dataQueries.listRows, {
    table: 'employees',
  });

  if (text === '/status') {
    const linked = employees.find((e) => String(e.telegram_chat_id ?? '') === chatIdStr);
    if (linked) {
      await telegramSendMessage(
        token,
        chatId,
        `Connected as ${linked.name} (${linked.employee_code ?? 'no code'})\nDepartment: ${linked.department}\n\nYou will receive case assignment and postpone alerts here.`,
      );
    } else {
      await telegramSendMessage(
        token,
        chatId,
        'Not connected yet.\n\nSend:\n/start YOUR_CODE\n\nFind your code in Malcon Nexus → Settings → Notifications.',
      );
    }
    return;
  }

  if (!text.startsWith('/start')) {
    await telegramSendMessage(
      token,
      chatId,
      'Malcon Nexus alerts bot\n\nSend /start YOUR_CODE to connect.\n/status — check connection',
    );
    return;
  }

  const codeArg = parseTelegramStartArg(text);
  if (!codeArg) {
    await telegramSendMessage(
      token,
      chatId,
      'Welcome to Malcon Nexus!\n\nTo connect, send:\n/start YOUR_CODE\n\nYour employee code is in the app under Settings → Notifications.',
    );
    return;
  }

  const active = employees.filter((e) => String(e.status ?? '') === 'Active');
  const match = active.find((e) => employeeCodeMatches(String(e.employee_code ?? ''), codeArg));
  if (!match) {
    await telegramSendMessage(
      token,
      chatId,
      `No employee found with code "${codeArg}".\n\nCheck your code in Malcon Nexus → Settings → Notifications and try again.`,
    );
    return;
  }

  const existingChat = String(match.telegram_chat_id ?? '').trim();
  if (existingChat && existingChat !== chatIdStr) {
    const oldReachable = await telegramChatReachable(token, existingChat);
    if (oldReachable) {
      await telegramSendMessage(
        token,
        chatId,
        `${match.name} is already linked to another Telegram account.\n\nContact admin if you need to switch devices.`,
      );
      return;
    }
  }

  const employeeId = String(match.id ?? '');
  const now = new Date().toISOString();
  try {
    await ctx.runMutation(internal.dataMutations.mergeTableRow, {
      table: 'employees',
      legacyId: employeeId,
      patch: { telegram_chat_id: chatIdStr, updated_at: now },
    });
  } catch (err) {
    console.error('[telegram-webhook] link save failed', err);
    await telegramSendMessage(
      token,
      chatId,
      'Could not save your Telegram link right now. Please try again in a few minutes or contact your admin.',
    );
    return;
  }

  await telegramSendMessage(
    token,
    chatId,
    `Connected!\n\n${match.name} (${match.employee_code})\n\nYou will receive Malcon Nexus alerts here when cases are assigned or postponed.`,
  );
}
