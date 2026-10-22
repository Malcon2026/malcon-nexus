import type { ActionCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import { JwtVerificationError, parseBearerToken, verifySupabaseAccessToken } from './jwt';

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
  if (!secrets.length) {
    return { identity: null, employeeId: null, role: null, authFailure: 'invalid_jwt' };
  }

  let identity: { authUserId: string; email?: string | null } | null = null;
  for (const secret of secrets) {
    try {
      const verified = await verifySupabaseAccessToken(token, secret, {
        audience: process.env.SUPABASE_JWT_AUD || 'authenticated',
      });
      identity = { authUserId: verified.authUserId, email: verified.email };
      break;
    } catch (e) {
      if (e instanceof JwtVerificationError && e.message === 'Token expired') {
        return { identity: null, employeeId: null, role: null, authFailure: 'invalid_jwt' };
      }
    }
  }

  if (!identity) {
    return { identity: null, employeeId: null, role: null, authFailure: 'invalid_jwt' };
  }

  const employee = await ctx.runQuery(internal.dataQueries.employeeByAuthUserId, {
    authUserId: identity.authUserId,
  });

  if (!employee) {
    return { identity, employeeId: null, role: null };
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
