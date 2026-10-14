import { eq, inArray, isNotNull, and } from 'drizzle-orm';
import type { Env } from '../env';
import { createDb } from '../db/client';
import { cases, employees } from '../db/schema';
import { employeeCodeMatches, parseTelegramStartArg, sanitizeEmployeeCodeInput } from '../lib/loginOtp';
import { telegramChatReachable, telegramSendMessage } from '../lib/telegramApi';

type TelegramEvent = 'assignment' | 'postpone';

function parseHospitalName(snapshot: string | null): string {
  if (!snapshot) return 'Hospital';
  try {
    const o = JSON.parse(snapshot) as { name?: string };
    return o.name?.trim() || 'Hospital';
  } catch {
    return 'Hospital';
  }
}

export async function sendCaseTelegram(
  env: Env,
  event: TelegramEvent,
  caseId: string,
  employeeId: string,
): Promise<{ ok: true; skipped?: boolean } | { error: string; status: number }> {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { error: 'TELEGRAM_BOT_TOKEN is not configured', status: 503 };

  const db = createDb(env);
  const [caseRows, empRows] = await Promise.all([
    db
      .select({
        caseNumber: cases.caseNumber,
        currentStage: cases.currentStage,
        hospitalSnapshot: cases.hospitalSnapshot,
        surgeryDate: cases.surgeryDate,
        priority: cases.priority,
        postponeReason: cases.postponeReason,
      })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1),
    db
      .select({ name: employees.name, telegramChatId: employees.telegramChatId })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1),
  ]);

  const caseRow = caseRows[0];
  const employee = empRows[0];
  if (!caseRow) return { error: 'Case not found', status: 404 };
  if (!employee) return { error: 'Employee not found', status: 404 };

  const chatId = employee.telegramChatId?.trim();
  if (!chatId) return { ok: true, skipped: true };

  const hospitalName = parseHospitalName(caseRow.hospitalSnapshot);
  const surgeryDate = caseRow.surgeryDate ?? 'TBD';

  let text: string;
  if (event === 'assignment') {
    text = [
      '🔔 New case assigned',
      '',
      `Case: ${caseRow.caseNumber}`,
      `Hospital: ${hospitalName}`,
      `Stage: ${caseRow.currentStage}`,
      `Surgery: ${surgeryDate}`,
      `Priority: ${caseRow.priority}`,
      '',
      'Open Malcon Nexus app for details.',
    ].join('\n');
  } else {
    const reason = caseRow.postponeReason?.trim();
    text = [
      '⚠️ Case postponed',
      '',
      `Case: ${caseRow.caseNumber}`,
      `Hospital: ${hospitalName}`,
      `New surgery date: ${surgeryDate}`,
      `Kit stays at: ${caseRow.currentStage}`,
      reason ? `Reason: ${reason}` : '',
      '',
      'Open Malcon Nexus app for details.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const sent = await telegramSendMessage(botToken, chatId, text);
  if (!sent.ok) return { error: sent.error, status: 502 };
  return { ok: true };
}

export async function broadcastTelegram(
  env: Env,
  message: string,
  target: 'all' | 'selected',
  employeeIds?: string[],
): Promise<
  | { sent: number; failed: number; total: number; failures: { name: string; error: string }[] }
  | { error: string; status: number; reason?: string }
> {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { error: 'TELEGRAM_BOT_TOKEN is not configured', status: 503 };

  const text = message.trim();
  if (!text) return { error: 'message is required', status: 400 };
  if (text.length > 4000) return { error: 'Message too long (max 4000 characters)', status: 400 };

  const db = createDb(env);
  const conditions = [eq(employees.status, 'Active'), isNotNull(employees.telegramChatId)];
  if (target === 'selected') {
    if (!employeeIds?.length) return { error: 'employeeIds required when target is selected', status: 400 };
    conditions.push(inArray(employees.id, employeeIds));
  }

  const rows = await db
    .select({
      id: employees.id,
      name: employees.name,
      telegramChatId: employees.telegramChatId,
    })
    .from(employees)
    .where(and(...conditions));

  const recipients = rows.filter((r) => r.telegramChatId?.trim());
  if (recipients.length === 0) {
    return { error: 'No connected Telegram recipients', status: 400, reason: 'no_connected_recipients' };
  }

  let sent = 0;
  let failed = 0;
  const failures: { name: string; error: string }[] = [];

  for (const emp of recipients) {
    const result = await telegramSendMessage(botToken, emp.telegramChatId!, text);
    if (result.ok) sent += 1;
    else {
      failed += 1;
      failures.push({ name: emp.name, error: result.error });
    }
  }

  return { sent, failed, total: recipients.length, failures };
}

export async function handleTelegramWebhookUpdate(env: Env, update: unknown): Promise<void> {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  const msg = (update as { message?: { chat?: { id?: number }; text?: string } })?.message;
  const chatId = msg?.chat?.id;
  const text = msg?.text?.trim() ?? '';
  if (!chatId || !text) return;

  const chatIdStr = String(chatId);
  const db = createDb(env);

  if (text === '/status') {
    const linked = await db
      .select({
        name: employees.name,
        employeeCode: employees.employeeCode,
        department: employees.department,
      })
      .from(employees)
      .where(eq(employees.telegramChatId, chatIdStr))
      .limit(1);

    if (linked[0]) {
      const e = linked[0];
      await telegramSendMessage(
        botToken,
        chatId,
        `Connected as ${e.name} (${e.employeeCode ?? 'no code'})\nDepartment: ${e.department}\n\nYou will receive case assignment and postpone alerts here.`,
      );
    } else {
      await telegramSendMessage(
        botToken,
        chatId,
        'Not connected yet.\n\nSend:\n/start YOUR_CODE\n\nFind your code in Malcon Nexus → Settings → Notifications.',
      );
    }
    return;
  }

  if (!text.startsWith('/start')) {
    await telegramSendMessage(
      botToken,
      chatId,
      'Malcon Nexus alerts bot\n\nSend /start YOUR_CODE to connect.\n/status — check connection',
    );
    return;
  }

  const codeArg = parseTelegramStartArg(text);
  if (!codeArg) {
    await telegramSendMessage(
      botToken,
      chatId,
      'Welcome to Malcon Nexus!\n\nTo connect, send:\n/start YOUR_CODE\n\nYour employee code is in the app under Settings → Notifications.',
    );
    return;
  }

  const allActive = await db
    .select({
      id: employees.id,
      name: employees.name,
      employeeCode: employees.employeeCode,
      status: employees.status,
      telegramChatId: employees.telegramChatId,
    })
    .from(employees)
    .where(eq(employees.status, 'Active'));

  const match = allActive.find((e) => employeeCodeMatches(e.employeeCode, codeArg));
  if (!match) {
    await telegramSendMessage(
      botToken,
      chatId,
      `No employee found with code "${codeArg}".\n\nCheck your code in Malcon Nexus → Settings → Notifications and try again.`,
    );
    return;
  }

  if (match.status !== 'Active') {
    await telegramSendMessage(botToken, chatId, 'Your employee account is inactive. Contact admin.');
    return;
  }

  const existingChat = match.telegramChatId?.trim();
  if (existingChat && existingChat !== chatIdStr) {
    const oldReachable = await telegramChatReachable(botToken, existingChat);
    if (oldReachable) {
      await telegramSendMessage(
        botToken,
        chatId,
        `${match.name} is already linked to another Telegram account.\n\nContact admin if you need to switch devices.`,
      );
      return;
    }
  }

  const now = new Date().toISOString();
  try {
    await db
      .update(employees)
      .set({ telegramChatId: chatIdStr, updatedAt: now })
      .where(eq(employees.id, match.id));
  } catch (err) {
    console.error('[telegram-webhook] link save failed', err);
    await telegramSendMessage(
      botToken,
      chatId,
      'Could not save your Telegram link right now (server database is temporarily busy). Please try again after midnight UTC or contact your admin.',
    );
    return;
  }

  await telegramSendMessage(
    botToken,
    chatId,
    `Connected!\n\n${match.name} (${match.employeeCode})\n\nYou will receive Malcon Nexus alerts here when cases are assigned or postponed.`,
  );
}
