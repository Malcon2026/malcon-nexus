import type { AppRole, RequestContext } from './authContext';
import { apiError } from './httpUtil';

export function isFullAdminRole(role: AppRole): boolean {
  return role === 'admin';
}

export function requireMappedEmployee(auth: RequestContext): Response | null {
  if (!auth.identity) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401);
  }
  if (!auth.employeeId || !auth.role) {
    return apiError(
      'FORBIDDEN',
      'Your login is not linked to an employee record. Log out and log in again.',
      403,
    );
  }
  return null;
}

export function requireAdminOrStoreManager(auth: RequestContext): Response | null {
  if (!auth.identity) return apiError('UNAUTHORIZED', 'Unauthorized', 401);
  if (auth.role !== 'admin' && auth.role !== 'store_manager') {
    return apiError('FORBIDDEN', 'Forbidden', 403);
  }
  return null;
}
