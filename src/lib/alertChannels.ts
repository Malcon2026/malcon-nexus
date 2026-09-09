import { notifyTelegramAssignment, notifyTelegramPostpone } from './telegram';
import { notifyPushAssignment, notifyPushPostpone } from './webPush';

/** Telegram + Web Push when a case is assigned. */
export function notifyAssignmentAlerts(caseId: string, employeeId: string | undefined | null): void {
  if (!employeeId) return;
  notifyTelegramAssignment(caseId, employeeId);
  notifyPushAssignment(caseId, employeeId);
}

/** Telegram + Web Push when a case is postponed. */
export function notifyPostponeAlerts(caseId: string, employeeId: string | undefined | null): void {
  if (!employeeId) return;
  notifyTelegramPostpone(caseId, employeeId);
  notifyPushPostpone(caseId, employeeId);
}
