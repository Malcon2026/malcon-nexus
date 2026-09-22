import type { Employee } from '../types';
import { isSetPreparationStage } from './roles';

/** Roles that may appear in stage assignee pickers (in addition to field employees). */
export function isCaseStageAssigneeRole(role: string): boolean {
  return role === 'employee' || role === 'store_manager' || role === 'case_manager';
}

/** Active employees eligible for workflow assignment; always includes `alwaysInclude` when active. */
export function listEmployeesForCaseAssignment(
  employees: Employee[],
  options?: { alwaysInclude?: Employee | null },
): Employee[] {
  const byId = new Map<string, Employee>();
  for (const e of employees) {
    if (e.status !== 'Active') continue;
    if (isCaseStageAssigneeRole(e.role)) byId.set(e.id, e);
  }
  const extra = options?.alwaysInclude;
  if (extra && extra.status === 'Active' && extra.id) {
    byId.set(extra.id, extra);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Store / legacy case managers creating at Set Preparation with no assignee → self. */
export function shouldDefaultPreparationToCurrentUser(
  startStage: string,
  hasPreparationAssignee: boolean,
  currentUser: Employee,
): boolean {
  if (hasPreparationAssignee) return false;
  if (!isSetPreparationStage(startStage)) return false;
  const role = currentUser.role as string;
  return role === 'store_manager' || role === 'case_manager';
}
