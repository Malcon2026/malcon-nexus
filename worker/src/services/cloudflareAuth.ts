import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import type { Env } from '../env';
import { createDb } from '../db/client';
import { employees, loginOtps } from '../db/schema';
import { employeeCodeMatches, hashLoginOtp, randomSixDigitOtp } from '../lib/loginOtp';
import { hashPassword, verifyPassword } from '../lib/passwordHash';
import { signAccessToken } from '../lib/malconJwt';
import { normalizeAppRole, type MappedEmployee } from '../lib/employeeLookup';
import { isFullAdminRole, usesEmployeeSignInRole } from '../lib/authRoles';

function jwtSecret(env: Env): string {
  const s = env.JWT_SECRET || env.SUPABASE_JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not configured');
  return s;
}

function otpPepper(env: Env): string {
  return env.LOGIN_OTP_SECRET || jwtSecret(env);
}

function newId(): string {
  return crypto.randomUUID();
}

async function ensureAuthSubject(db: ReturnType<typeof createDb>, employeeId: string, existing: string | null): Promise<string> {
  const sub = existing?.trim() || employeeId;
  if (!existing?.trim()) {
    const now = new Date().toISOString();
    await db.update(employees).set({ authUserId: sub, updatedAt: now }).where(eq(employees.id, employeeId));
  }
  return sub;
}

async function issueToken(env: Env, employee: { id: string; email: string; authUserId: string | null }): Promise<string> {
  const db = createDb(env);
  const sub = await ensureAuthSubject(db, employee.id, employee.authUserId);
  return signAccessToken({ sub, email: employee.email, role: 'authenticated' }, jwtSecret(env));
}

function mapRow(row: typeof employees.$inferSelect): MappedEmployee | null {
  const role = normalizeAppRole(row.role);
  if (!role) return null;
  return {
    id: row.id,
    role,
    name: row.name,
    email: row.email,
    authUserId: row.authUserId,
  };
}

export async function loginWithPassword(
  env: Env,
  email: string,
  password: string,
): Promise<{ accessToken: string; employee: MappedEmployee } | { error: string; status: number }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) {
    return { error: 'Email and password are required', status: 400 };
  }

  const db = createDb(env);
  const rows = await db.select().from(employees).where(eq(employees.email, normalized)).limit(1);
  const row = rows[0];
  if (!row) return { error: 'Invalid email or password', status: 401 };

  const mapped = mapRow(row);
  if (!mapped) return { error: 'Invalid account configuration', status: 403 };

  if (usesEmployeeSignInRole(mapped.role)) {
    return { error: 'Staff sign in with Employee ID and Telegram OTP.', status: 403 };
  }

  if (!isFullAdminRole(mapped.role)) {
    return { error: 'This login type is not supported. Contact your administrator.', status: 403 };
  }

  if (row.status !== 'Active') {
    return { error: 'Your account is inactive. Contact admin.', status: 403 };
  }

  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) {
    return { error: 'Invalid email or password', status: 401 };
  }

  const accessToken = await issueToken(env, row);
  return { accessToken, employee: mapped };
}

export async function requestLoginOtp(
  env: Env,
  employeeCode: string,
): Promise<{ message: string } | { error: string; status: number }> {
  const codeInput = employeeCode.trim();
  if (!codeInput) return { error: 'Employee ID is required', status: 400 };

  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { error: 'Telegram is not configured on the server.', status: 503 };

  const db = createDb(env);
  const rows = await db.select().from(employees).where(eq(employees.status, 'Active'));

  const match = rows.find((e) => employeeCodeMatches(e.employeeCode, codeInput));
  if (!match) {
    return {
      message: 'If this Employee ID is registered and Telegram is linked, an OTP was sent.',
    };
  }

  if (match.role === 'admin') {
    return { error: 'Admins sign in with email and password (Admin login).', status: 403 };
  }
  if (match.role === 'petrol') {
    return { error: 'Petrol desk uses its own login. Contact admin.', status: 403 };
  }

  const chatId = match.telegramChatId?.trim();
  if (!chatId) {
    return {
      error: 'Telegram is not linked for this employee. Ask your admin to link Telegram in Malcon Nexus.',
      status: 400,
    };
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const recent = await db
    .select()
    .from(loginOtps)
    .where(and(eq(loginOtps.employeeId, match.id), isNull(loginOtps.consumedAt)))
    .orderBy(desc(loginOtps.createdAt))
    .limit(1);

  const last = recent[0];
  if (last?.createdAt) {
    const lastMs = Date.parse(last.createdAt);
    if (Number.isFinite(lastMs) && now - lastMs < 60_000) {
      return { error: 'Please wait a minute before requesting another OTP.', status: 429 };
    }
  }

  const otp = randomSixDigitOtp();
  const codeHash = await hashLoginOtp(match.id, otp, otpPepper(env));
  const expiresAt = new Date(now + 5 * 60_000).toISOString();

  await db.insert(loginOtps).values({
    id: newId(),
    employeeId: match.id,
    codeHash,
    expiresAt,
    attempts: 0,
    consumedAt: null,
    createdAt: nowIso,
  });

  const text = `Malcon Nexus login code: ${otp}\nValid for 5 minutes. Do not share this code.`;
  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  const tgBody = (await tgRes.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!tgRes.ok || !tgBody.ok) {
    return { error: tgBody.description ?? 'Could not send OTP via Telegram', status: 502 };
  }

  return {
    message: 'If this Employee ID is registered and Telegram is linked, an OTP was sent.',
  };
}

const MAX_OTP_ATTEMPTS = 5;

export async function verifyLoginOtp(
  env: Env,
  employeeCode: string,
  otp: string,
): Promise<{ accessToken: string; employee: MappedEmployee } | { error: string; status: number }> {
  const codeInput = employeeCode.trim();
  const otpInput = otp.trim().replace(/\s/g, '');
  if (!codeInput || !/^\d{6}$/.test(otpInput)) {
    return { error: 'Employee ID and a 6-digit OTP are required', status: 400 };
  }

  const db = createDb(env);
  const rows = await db.select().from(employees);
  const match = rows.find((e) => employeeCodeMatches(e.employeeCode, codeInput));
  if (!match) return { error: 'Invalid Employee ID or OTP', status: 401 };

  if (match.role === 'admin') {
    return { error: 'Use Admin login with email and password.', status: 403 };
  }
  if (match.role === 'petrol') {
    return { error: 'Petrol desk uses its own login. Contact admin.', status: 403 };
  }
  if (match.status !== 'Active') {
    return { error: 'Your account is inactive. Contact admin.', status: 403 };
  }

  const nowIso = new Date().toISOString();
  const otpRows = await db
    .select()
    .from(loginOtps)
    .where(
      and(eq(loginOtps.employeeId, match.id), isNull(loginOtps.consumedAt), gte(loginOtps.expiresAt, nowIso)),
    )
    .orderBy(desc(loginOtps.createdAt))
    .limit(1);

  const row = otpRows[0];
  if (!row) return { error: 'OTP expired or not found. Request a new code.', status: 401 };

  if (row.attempts >= MAX_OTP_ATTEMPTS) {
    await db.update(loginOtps).set({ consumedAt: nowIso }).where(eq(loginOtps.id, row.id));
    return { error: 'Too many wrong attempts. Request a new OTP.', status: 401 };
  }

  const expectedHash = await hashLoginOtp(match.id, otpInput, otpPepper(env));
  if (expectedHash !== row.codeHash) {
    await db
      .update(loginOtps)
      .set({ attempts: row.attempts + 1 })
      .where(eq(loginOtps.id, row.id));
    return { error: 'Invalid Employee ID or OTP', status: 401 };
  }

  await db.update(loginOtps).set({ consumedAt: nowIso }).where(eq(loginOtps.id, row.id));

  const mapped = mapRow(match);
  if (!mapped) return { error: 'Invalid account configuration', status: 403 };

  const accessToken = await issueToken(env, match);
  return { accessToken, employee: mapped };
}

export async function setEmployeePassword(
  env: Env,
  employeeId: string,
  password: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters', status: 400 };
  }
  const db = createDb(env);
  const hash = await hashPassword(password);
  const now = new Date().toISOString();
  const existing = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, employeeId)).limit(1);
  if (!existing[0]) return { error: 'Employee not found', status: 404 };
  await db.update(employees).set({ passwordHash: hash, updatedAt: now }).where(eq(employees.id, employeeId));
  return { ok: true };
}
