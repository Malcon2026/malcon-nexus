import type { ActionCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import { JwtVerificationError, parseBearerToken, verifySupabaseJwt } from './jwt';

export type AppRole = 'admin' | 'employee' | 'petrol' | 'store_manager';

export type RequestContext = {
  identity: { authUserId: string; email?: string | null } | null;
  employeeId: string | null;
  role: AppRole | null;
  authFailure?: 'invalid_jwt';
};

function jwtSecrets(): string[] {
  const primary = process.env.SUPABASE_JWT_SECRET?.trim();
  const legacy = process.env.SUPABASE_JWT_SECRET_LEGACY?.trim();
  return [primary, legacy].filter(Boolean) as string[];
}

export async function authenticateRequest(ctx: ActionCtx, request: Request): Promise<RequestContext> {
  const token = parseBearerToken(request);
  if (!token) {
    return { identity: null, employeeId: null, role: null };
  }

  const secrets = jwtSecrets();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  if (!secrets.length && !supabaseUrl) {
    return { identity: null, employeeId: null, role: null, authFailure: 'invalid_jwt' };
  }

  let identity: { authUserId: string; email?: string | null } | null = null;
  try {
    const verified = await verifySupabaseJwt(token, {
      audience: process.env.SUPABASE_JWT_AUD || 'authenticated',
      secrets,
      supabaseUrl,
    });
    identity = { authUserId: verified.authUserId, email: verified.email };
  } catch (e) {
    if (e instanceof JwtVerificationError && e.message === 'Token expired') {
      return { identity: null, employeeId: null, role: null, authFailure: 'invalid_jwt' };
    }
  }

  if (!identity) {
    return { identity: null, employeeId: null, role: null, authFailure: 'invalid_jwt' };
  }

  let employee = await ctx.runQuery(internal.dataQueries.employeeByAuthUserId, {
    authUserId: identity.authUserId,
  });

  if (!employee && identity.email?.trim()) {
    employee = await ctx.runQuery(internal.dataQueries.employeeByEmail, {
      email: identity.email,
    });
  }

  if (!employee) {
    return { identity, employeeId: null, role: null };
  }

  const existingAuth = employee.auth_user_id ? String(employee.auth_user_id) : '';
  const jwtEmail = identity.email?.trim().toLowerCase();
  const rowEmail = String(employee.email ?? '')
    .trim()
    .toLowerCase();
  if (
    (!existingAuth || existingAuth !== identity.authUserId) &&
    jwtEmail &&
    rowEmail &&
    jwtEmail === rowEmail
  ) {
    await ctx.runMutation(internal.dataMutations.mergeTableRow, {
      table: 'employees',
      legacyId: String(employee.id),
      patch: { auth_user_id: identity.authUserId, updated_at: new Date().toISOString() },
    });
    employee = { ...employee, auth_user_id: identity.authUserId };
  }

  const role = String(employee.role ?? 'employee') as AppRole;
  return {
    identity,
    employeeId: String(employee.id),
    role,
  };
}

export function requireIdentity(ctx: RequestContext): Response | null {
  if (!ctx.identity) {
    return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}
