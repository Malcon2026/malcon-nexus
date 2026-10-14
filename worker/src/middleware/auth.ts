/**
 * Supabase JWT → employee mapping → application role (D1).
 * D1 has no RLS — authorization runs in Worker middleware + handlers.
 */

import type { Env } from '../env';
import { JwtVerificationError, parseBearerToken, verifySupabaseAccessToken } from '../lib/jwt';
import { lookupEmployeeForAuth } from '../lib/employeeLookup';

export type AppRole = 'admin' | 'employee' | 'petrol' | 'store_manager';

export interface AuthIdentity {
  /** Supabase auth.users.id (JWT `sub`) */
  authUserId: string;
  email?: string | null;
  phone?: string | null;
}

export interface RequestContext {
  identity: AuthIdentity | null;
  employeeId: string | null;
  role: AppRole | null;
  /** Set when Authorization bearer was present but verification failed. */
  authFailure?: 'invalid_jwt';
}

function jwtSecret(env: Env): string | undefined {
  return env.SUPABASE_JWT_SECRET || env.JWT_SECRET;
}

/** Parse and verify Supabase access token from Authorization header. */
export async function resolveAuthFromRequest(request: Request, env: Env): Promise<AuthIdentity | null> {
  const token = parseBearerToken(request);
  if (!token) return null;

  const secret = jwtSecret(env);
  if (!secret) {
    throw new JwtVerificationError('JWT verification is not configured on the Worker');
  }

  const aud = env.SUPABASE_JWT_AUD || 'authenticated';
  const verified = await verifySupabaseAccessToken(token, secret, { audience: aud });
  return {
    authUserId: verified.authUserId,
    email: verified.email,
    phone: verified.phone,
  };
}

/** Local-only dev identity for Worker tests (never staging/production). */
function devIdentityFromRequest(request: Request, env: Env): RequestContext | null {
  if (env.ENVIRONMENT !== 'development') return null;
  const raw = request.headers.get('X-Malcon-Dev-Identity');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(atob(raw)) as {
      authUserId?: string;
      employeeId?: string | null;
      role?: AppRole | null;
    };
    if (!parsed.authUserId) return null;
    return {
      identity: { authUserId: parsed.authUserId },
      employeeId: parsed.employeeId ?? null,
      role: parsed.role ?? null,
    };
  } catch {
    return null;
  }
}

/** Build request auth context — employee id and role always from D1 when using JWT. */
export async function authenticateRequest(request: Request, env: Env): Promise<RequestContext> {
  const devCtx = devIdentityFromRequest(request, env);
  if (devCtx) return devCtx;

  const token = parseBearerToken(request);
  if (!token) {
    return { identity: null, employeeId: null, role: null };
  }

  try {
    const identity = await resolveAuthFromRequest(request, env);
    if (!identity) {
      return { identity: null, employeeId: null, role: null, authFailure: 'invalid_jwt' };
    }
    const mapped = await lookupEmployeeForAuth(env, identity.authUserId);
    return {
      identity,
      employeeId: mapped?.id ?? null,
      role: mapped?.role ?? null,
    };
  } catch (e) {
    if (e instanceof JwtVerificationError) {
      return { identity: null, employeeId: null, role: null, authFailure: 'invalid_jwt' };
    }
    throw e;
  }
}

export function getCurrentUser(ctx: RequestContext): AuthIdentity | null {
  return ctx.identity;
}

export function getCurrentEmployeeId(ctx: RequestContext): string | null {
  return ctx.employeeId;
}

export function getCurrentRole(ctx: RequestContext): AppRole | null {
  return ctx.role;
}
