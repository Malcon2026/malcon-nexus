/**
 * Authorization layer replacing Supabase RLS (design only).
 * Mirrors policies in supabase/schema.sql + migrations.
 */

import type { AppRole, RequestContext } from './auth';

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status = 403,
  ) {
    super(message);
  }
}

export function requireAuthenticated(ctx: RequestContext): asserts ctx is RequestContext & {
  identity: NonNullable<RequestContext['identity']>;
} {
  if (!ctx.identity) throw new AuthError('Unauthorized', 401);
}

export function requireRole(ctx: RequestContext, ...roles: AppRole[]): AppRole {
  requireAuthenticated(ctx);
  if (!ctx.role || !roles.includes(ctx.role)) {
    throw new AuthError('Forbidden');
  }
  return ctx.role;
}

/** Employee may only access their own row unless admin/store_manager rules apply. */
export function requireEmployeeAccess(ctx: RequestContext, targetEmployeeId: string): void {
  requireAuthenticated(ctx);
  if (ctx.role === 'admin') return;
  if (ctx.role === 'store_manager') return; // refined per-route in Phase 8
  if (ctx.employeeId !== targetEmployeeId) {
    throw new AuthError('Forbidden');
  }
}

/**
 * Case visibility — port of RLS + parallel workflow helpers:
 * - admin / store_manager: broad access (store_manager rules TBD per route)
 * - employee: assigned_employee_id OR stage assignee/assistant in JSON stages
 */
export function canReadCase(
  ctx: RequestContext,
  caseRow: {
    assignedEmployeeId: string | null;
    stagesJson: string;
  },
): boolean {
  if (!ctx.identity) return false;
  if (ctx.role === 'admin' || ctx.role === 'store_manager') return true;
  if (!ctx.employeeId) return false;
  if (caseRow.assignedEmployeeId === ctx.employeeId) return true;
  try {
    const stages = JSON.parse(caseRow.stagesJson) as Array<{
      stage?: string;
      assignedEmployee?: { id?: string };
      assistantEmployee?: { id?: string };
    }>;
    return stages.some(
      (s) =>
        s.assignedEmployee?.id === ctx.employeeId || s.assistantEmployee?.id === ctx.employeeId,
    );
  } catch {
    return false;
  }
}
