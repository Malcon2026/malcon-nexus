import { notifyTelegramAssignment, notifyTelegramPostpone } from './telegram';
import { notifyPushAssignment, notifyPushPostpone } from './webPush';

/** Priority 1–2 alerts when a case is assigned (Telegram, then Web Push). In-app siren is priority 3 on the employee device. */
export function notifyAssignmentAlerts(caseId: string, employeeId: string | undefined | null): void {
  if (!employeeId) return;
  notifyTelegramAssignment(caseId, employeeId);
  notifyPushAssignment(caseId, employeeId);
}

/** Priority 1–2 alerts when a case is postponed (Telegram, then Web Push). In-app siren is priority 3 on the employee device. */
export function notifyPostponeAlerts(caseId: string, employeeId: string | undefined | null): void {
  if (!employeeId) return;
  notifyTelegramPostpone(caseId, employeeId);
  notifyPushPostpone(caseId, employeeId);
}
