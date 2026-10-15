import type { Db } from '../db/client';
import { employees } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { RequestContext } from '../middleware/auth';
import { AuthError } from '../middleware/authorization';
import type { EmployeeDeptContext } from './caseReadAuth';

export function requireAdminOrStoreManager(ctx: RequestContext): void {
  if (!ctx.identity) throw new AuthError('Unauthorized', 401);
  if (ctx.role !== 'admin' && ctx.role !== 'store_manager') {
    throw new AuthError('Forbidden', 403);
  }
}

/** Notifications: employees may only read their own rows (Supabase notifications_own). */
export function resolveNotificationRecipientFilter(
  ctx: RequestContext,
  requestedRecipientId: string | undefined,
): string | undefined {
  if (ctx.role === 'admin') return requestedRecipientId;
  if (!ctx.employeeId) throw new AuthError('Forbidden', 403);
  if (requestedRecipientId && requestedRecipientId !== ctx.employeeId) {
    throw new AuthError('Forbidden', 403);
  }
  return ctx.employeeId;
}

/** Attendance list: non-admins may only query their own employee_id. */
export function enforceAttendanceListScope(
  ctx: RequestContext,
  employeeIdFilter: string | undefined,
): string | undefined {
  if (ctx.role === 'admin' || ctx.role === 'store_manager') return employeeIdFilter;
  if (!ctx.employeeId) throw new AuthError('Forbidden', 403);
  if (employeeIdFilter && employeeIdFilter !== ctx.employeeId) {
    throw new AuthError('Forbidden', 403);
  }
  return ctx.employeeId;
}

export async function loadEmployeeDeptContext(
  db: Db,
  employeeId: string,
): Promise<EmployeeDeptContext | null> {
  const rows = await db
    .select({ department: employees.department, departments: employees.departments })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { department: row.department, departments: row.departments };
}
