/**
 * Write authorization — mirrors Supabase RLS for Phase 10.1 low-risk tables.
 * When `relaxed` is true (local dev without API_REQUIRE_AUTH), rules are skipped
 * so D1 integration tests can run before JWT wiring lands.
 */

import type { RequestContext } from './auth';
import { AuthError, requireAuthenticated, requireRole } from './authorization';

/** Skip authZ only when local dev has no identity at all (integration tests). */
function skipAuthZ(ctx: RequestContext, relaxed: boolean): boolean {
  return relaxed && !ctx.identity;
}

function assertIdentity(ctx: RequestContext, relaxed: boolean): void {
  if (skipAuthZ(ctx, relaxed)) return;
  requireAuthenticated(ctx);
}

/** Employee self-service writes — never trust employee id from the request body. */
export function requireMappedEmployeeId(ctx: RequestContext, relaxed: boolean): string {
  if (skipAuthZ(ctx, relaxed)) {
    if (ctx.employeeId) return ctx.employeeId;
    throw new AuthError('Unauthorized', 401);
  }
  requireAuthenticated(ctx);
  if (!ctx.employeeId) {
    throw new AuthError(
      'Your login is not linked to an employee record. Log out and log in again.',
      403,
    );
  }
  return ctx.employeeId;
}

export function assertActivityInsert(ctx: RequestContext, relaxed: boolean): void {
  assertIdentity(ctx, relaxed);
  if (skipAuthZ(ctx, relaxed)) return;
  // PG: activity_employee_insert (authenticated) + admin/store_manager ALL
}

export function assertAdminWrite(ctx: RequestContext, relaxed: boolean): void {
  if (skipAuthZ(ctx, relaxed)) return;
  requireRole(ctx, 'admin');
}

export function assertKitPatch(ctx: RequestContext, relaxed: boolean): void {
  assertAdminWrite(ctx, relaxed);
}

export function assertNotificationCreate(
  ctx: RequestContext,
  recipientId: string | null,
  relaxed: boolean,
): void {
  assertIdentity(ctx, relaxed);
  if (skipAuthZ(ctx, relaxed)) return;
  if (ctx.role === 'admin') return;
  if (recipientId && ctx.employeeId === recipientId) return;
  if (!recipientId) {
    throw new AuthError('Forbidden');
  }
  throw new AuthError('Forbidden');
}

export function assertNotificationRecipientAccess(
  ctx: RequestContext,
  recipientId: string | null,
  relaxed: boolean,
): void {
  assertIdentity(ctx, relaxed);
  if (skipAuthZ(ctx, relaxed)) return;
  if (ctx.role === 'admin') return;
  if (recipientId && ctx.employeeId === recipientId) return;
  throw new AuthError('Forbidden');
}

export function assertApprovalUpsert(ctx: RequestContext, relaxed: boolean): void {
  assertIdentity(ctx, relaxed);
  if (skipAuthZ(ctx, relaxed)) return;
  if (ctx.role === 'admin') return;
  if (ctx.role === 'employee' || ctx.role === 'store_manager') return;
  throw new AuthError('Forbidden');
}

export function assertAdminOrStoreManager(ctx: RequestContext, relaxed: boolean): void {
  if (skipAuthZ(ctx, relaxed)) return;
  requireAuthenticated(ctx);
  if (ctx.role === 'admin' || ctx.role === 'store_manager') return;
  throw new AuthError('Forbidden');
}

export function assertEmployeeSelfOrAdmin(
  ctx: RequestContext,
  targetEmployeeId: string,
  relaxed: boolean,
): void {
  assertIdentity(ctx, relaxed);
  if (skipAuthZ(ctx, relaxed)) return;
  if (ctx.role === 'admin' || ctx.role === 'store_manager') return;
  if (ctx.employeeId === targetEmployeeId) return;
  throw new AuthError('Forbidden');
}

export function assertPetrolWrite(
  ctx: RequestContext,
  targetEmployeeId: string,
  relaxed: boolean,
): void {
  assertIdentity(ctx, relaxed);
  if (skipAuthZ(ctx, relaxed)) return;
  if (ctx.role === 'admin' || ctx.role === 'petrol') return;
  if (ctx.employeeId === targetEmployeeId) return;
  throw new AuthError('Forbidden');
}

export function assertCaseTaskAdmin(ctx: RequestContext, relaxed: boolean): void {
  if (skipAuthZ(ctx, relaxed)) return;
  requireRole(ctx, 'admin');
}
