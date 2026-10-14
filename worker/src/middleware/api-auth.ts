import type { Env } from '../env';
import { authenticateRequest, type RequestContext } from './auth';
import { AuthError, requireAuthenticated } from './authorization';
import { apiError } from '../lib/http';

export type ApiVariables = {
  auth: RequestContext;
};

/** Phase 7+: auth boundary — production/staging always require mapped employee; dev optional unless API_REQUIRE_AUTH=1. */
export function enforceApiAuth(ctx: RequestContext, env: Env): Response | null {
  if (ctx.authFailure === 'invalid_jwt') {
    return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
  }

  const requireAuth = env.API_REQUIRE_AUTH === '1' || env.ENVIRONMENT !== 'development';
  if (!requireAuth) return null;

  try {
    requireAuthenticated(ctx);
    requireMappedEmployee(ctx);
  } catch (e) {
    if (e instanceof AuthError) {
      return apiError(e.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', e.message, e.status);
    }
    throw e;
  }
  return null;
}

/** JWT valid but no employees.auth_user_id row — same message as Supabase RPCs. */
export function requireMappedEmployee(ctx: RequestContext): void {
  requireAuthenticated(ctx);
  if (!ctx.employeeId || !ctx.role) {
    throw new AuthError(
      'Your login is not linked to an employee record. Log out and log in again.',
      403,
    );
  }
}

export async function buildAuthContext(request: Request, env: Env): Promise<RequestContext> {
  return authenticateRequest(request, env);
}
