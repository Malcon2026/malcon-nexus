import type { AppRole } from '../middleware/auth';

export function isFullAdminRole(role: AppRole): boolean {
  return role === 'admin';
}

export function usesEmployeeSignInRole(role: AppRole): boolean {
  return role === 'employee' || role === 'store_manager';
}
