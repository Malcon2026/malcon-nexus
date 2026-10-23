import type { ActionCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import {
  employeeCodeMatches,
  hashLoginOtp,
  randomSixDigitOtp,
  sanitizeEmployeeCodeInput,
} from './loginOtp';
import { jsonResponse } from './httpUtil';
import { checkRateLimit } from './memoryRateLimit';
import { generateMagicLinkTokenHash } from './supabaseAuthAdmin';
import { isStaleTelegramChatError, telegramSendMessage } from './telegramApi';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function otpPepper(): string {
  return (
    process.env.LOGIN_OTP_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_JWT_SECRET?.trim() ||
    ''
  );
}

function botToken(): string | null {
  const t = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return t || null;
}

async function listEmployees(ctx: ActionCtx): Promise<Record<string, unknown>[]> {
  const { items } = await ctx.runQuery(internal.dataQueries.listRows, { table: 'employees' });
  return items.filter((e) => String(e.employee_code ?? '').trim());
}

function findEmployeeByCode(
  employees: Record<string, unknown>[],
  codeInput: string,
): Record<string, unknown> | undefined {
  return employees.find((e) => employeeCodeMatches(String(e.employee_code ?? ''), codeInput));
}

async function listActiveOtpsForEmployee(
  ctx: ActionCtx,
  employeeId: string,
): Promise<Record<string, unknown>[]> {
  const { items } = await ctx.runQuery(internal.dataQueries.listRows, { table: 'login_otps' });
  return items.filter(
    (r) => String(r.employee_id ?? '') === employeeId && (r.consumed_at == null || r.consumed_at === ''),
  );
}

export async function handleAuthRequestOtp(ctx: ActionCtx, request: Request): Promise<Response> {
  const token = botToken();
  if (!token) {
    return jsonResponse({ error: 'Telegram is not configured on the server.' }, 503);
  }
  const pepper = otpPepper();
  if (!pepper) {
    return jsonResponse({ error: 'Server credentials are not configured' }, 500);
  }

  let body: { employeeCode?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const codeInput = sanitizeEmployeeCodeInput(String(body.employeeCode ?? ''));
  if (!codeInput) {
    return jsonResponse({ error: 'Employee ID is required' }, 400);
  }

  const employees = await listEmployees(ctx);
  const match = findEmployeeByCode(employees, codeInput);

  if (!match) {
    return jsonResponse({
      ok: true,
      message: 'If this Employee ID is registered and Telegram is linked, an OTP was sent.',
    });
  }

  const role = String(match.role ?? '');
  if (role === 'admin') {
    return jsonResponse({ error: 'Admins sign in with email and password (Admin login).' }, 403);
  }
  if (role === 'petrol') {
    return jsonResponse({ error: 'Petrol desk uses its own login. Contact admin.' }, 403);
  }
  if (String(match.status ?? '') !== 'Active') {
    return jsonResponse({ error: 'Your account is inactive. Contact admin.' }, 403);
  }

  const chatId = String(match.telegram_chat_id ?? '').trim();
  if (!chatId) {
    return jsonResponse(
      {
        error:
          'Telegram is not linked for this ID. Open @Malcon_Nexus_bot and send /start YOUR_CODE, or ask admin.',
      },
      400,
    );
  }

  const authUserId = String(match.auth_user_id ?? '').trim();
  if (!authUserId) {
    return jsonResponse({ error: 'Login is not set up for this employee yet. Ask your admin.' }, 400);
  }

  const employeeId = String(match.id ?? '');
  const sinceMs = Date.now() - RESEND_COOLDOWN_MS;
  const activeOtps = await listActiveOtpsForEmployee(ctx, employeeId);
  const recent = activeOtps
    .filter((r) => {
      const created = Date.parse(String(r.created_at ?? ''));
      return Number.isFinite(created) && created >= sinceMs;
    })
    .sort((a, b) => Date.parse(String(b.created_at ?? '')) - Date.parse(String(a.created_at ?? '')));

  if (recent.length > 0) {
    return jsonResponse({ error: 'Please wait a minute before requesting another OTP.' }, 429);
  }

  const otp = randomSixDigitOtp();
  const codeHash = await hashLoginOtp(employeeId, otp, pepper);
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  await ctx.runMutation(internal.dataMutations.upsertTableRow, {
    table: 'login_otps',
    row: {
      id: crypto.randomUUID(),
      employee_id: employeeId,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0,
      consumed_at: null,
      created_at: nowIso,
    },
  });

  const text = [
    '🔐 Malcon Nexus sign-in code',
    '',
    otp,
    '',
    'Valid for 5 minutes. Do not share this code.',
    'If you did not request this, ignore this message.',
  ].join('\n');

  const sent = await telegramSendMessage(token, chatId, text);
  if (!sent.ok) {
    console.error('[request-otp] telegram', sent.error);
    if (isStaleTelegramChatError(sent.error)) {
      await ctx.runMutation(internal.dataMutations.mergeTableRow, {
        table: 'employees',
        legacyId: employeeId,
        patch: { telegram_chat_id: null, updated_at: nowIso },
      });
      return jsonResponse(
        {
          error:
            'Telegram link expired or blocked. Open @Malcon_Nexus_bot and send /start YOUR_CODE to reconnect, then request OTP again.',
        },
        400,
      );
    }
    return jsonResponse({ error: 'Could not send OTP on Telegram. Try again.' }, 502);
  }

  return jsonResponse({
    ok: true,
    message: 'OTP sent to your linked Telegram.',
  });
}

export async function handleAuthVerifyOtp(ctx: ActionCtx, request: Request): Promise<Response> {
  const pepper = otpPepper();
  if (!pepper) {
    return jsonResponse({ error: 'Server credentials are not configured' }, 500);
  }

  let body: { employeeCode?: string; otp?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const codeInput = sanitizeEmployeeCodeInput(String(body.employeeCode ?? ''));
  const otpInput = String(body.otp ?? '')
    .trim()
    .replace(/\s/g, '');

  if (!codeInput || !/^\d{6}$/.test(otpInput)) {
    return jsonResponse({ error: 'Employee ID and a 6-digit OTP are required' }, 400);
  }

  if (!checkRateLimit(`otp-verify:${codeInput}`, 12, 15 * 60_000)) {
    return jsonResponse({ error: 'Too many OTP attempts. Try again later.' }, 429);
  }

  const employees = await listEmployees(ctx);
  const match = findEmployeeByCode(employees, codeInput);

  if (!match) {
    return jsonResponse({ error: 'Invalid Employee ID or OTP' }, 401);
  }

  const role = String(match.role ?? '');
  if (role === 'admin') {
    return jsonResponse({ error: 'Use Admin login with email and password.' }, 403);
  }
  if (role === 'petrol') {
    return jsonResponse({ error: 'Petrol desk uses its own login. Contact admin.' }, 403);
  }
  if (String(match.status ?? '') !== 'Active') {
    return jsonResponse({ error: 'Your account is inactive. Contact admin.' }, 403);
  }

  if (!String(match.auth_user_id ?? '').trim()) {
    return jsonResponse({ error: 'Login is not set up for this employee. Ask your admin.' }, 400);
  }

  const employeeId = String(match.id ?? '');
  const nowIso = new Date().toISOString();
  const activeOtps = await listActiveOtpsForEmployee(ctx, employeeId);
  const valid = activeOtps
    .filter((r) => String(r.expires_at ?? '') >= nowIso)
    .sort((a, b) => Date.parse(String(b.created_at ?? '')) - Date.parse(String(a.created_at ?? '')));

  const row = valid[0];
  if (!row) {
    return jsonResponse({ error: 'OTP expired or not found. Request a new code.' }, 401);
  }

  const otpId = String(row.id ?? '');
  const attempts = Number(row.attempts ?? 0);

  if (attempts >= MAX_OTP_ATTEMPTS) {
    await ctx.runMutation(internal.dataMutations.mergeTableRow, {
      table: 'login_otps',
      legacyId: otpId,
      patch: { consumed_at: nowIso },
    });
    return jsonResponse({ error: 'Too many wrong attempts. Request a new OTP.' }, 401);
  }

  const expectedHash = await hashLoginOtp(employeeId, otpInput, pepper);
  if (expectedHash !== String(row.code_hash ?? '')) {
    await ctx.runMutation(internal.dataMutations.mergeTableRow, {
      table: 'login_otps',
      legacyId: otpId,
      patch: { attempts: attempts + 1 },
    });
    return jsonResponse({ error: 'Invalid Employee ID or OTP' }, 401);
  }

  await ctx.runMutation(internal.dataMutations.mergeTableRow, {
    table: 'login_otps',
    legacyId: otpId,
    patch: { consumed_at: nowIso },
  });

  const loginEmail = String(match.email ?? '')
    .trim()
    .toLowerCase();
  if (!loginEmail) {
    return jsonResponse({ error: 'Employee email missing. Contact admin.' }, 500);
  }

  const link = await generateMagicLinkTokenHash(loginEmail);
  if ('error' in link) {
    return jsonResponse({ error: link.error }, 500);
  }

  return jsonResponse({
    ok: true,
    token_hash: link.tokenHash,
  });
}
