/**
 * Worker API write client (Phase 10.1). No silent fallback to Supabase.
 */
import { WorkerApiError, workerFetchJson } from './workerApi';
import type { ActivityEvent, Approval, DailyExpense, Notification, SurgicalKit } from '../types';

async function workerWrite(path: string, init: RequestInit): Promise<void> {
  await workerFetchJson<{ ok?: boolean }>(path, init);
}

export async function writeActivityToWorker(event: ActivityEvent): Promise<void> {
  await workerWrite('/api/activity-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: event.id,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      entityLabel: event.entityLabel,
      performedBy: event.performedBy,
      performedByRole: event.performedByRole,
      details: event.details,
    }),
  });
}

export async function createNotificationOnWorker(
  n: Notification & { recipientId?: string },
): Promise<void> {
  await workerWrite('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      read: n.read,
      caseId: n.caseId ?? null,
      recipientId: n.recipientId ?? null,
    }),
  });
}

export async function markNotificationReadOnWorker(id: string): Promise<void> {
  await workerWrite(`/api/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsReadOnWorker(recipientId: string): Promise<void> {
  await workerWrite('/api/notifications/mark-all-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipientId }),
  });
}

export async function setAppSettingOnWorker(
  key: string,
  value: string,
  updatedBy: string,
): Promise<void> {
  await workerWrite(`/api/settings/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value, updatedBy }),
  });
}

export async function patchSurgicalKitOnWorker(
  id: string,
  updates: Partial<SurgicalKit>,
): Promise<void> {
  await workerWrite(`/api/surgical-kits/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: updates.status,
      lastUsedDate: updates.lastUsedDate,
    }),
  });
}

export async function upsertDailyExpenseOnWorker(expense: DailyExpense): Promise<void> {
  await workerWrite(`/api/daily-expenses/${expense.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: expense.id,
      employeeId: expense.employeeId,
      employeeName: expense.employeeName,
      expenseDate: expense.expenseDate,
      kmsDriven: expense.kmsDriven,
      petrolAmount: expense.petrolAmount,
      foodAmount: expense.foodAmount,
      otherAmount: expense.otherAmount,
      otherDescription: expense.otherDescription,
      notes: expense.notes,
      enteredBy: expense.enteredBy,
      enteredById: expense.enteredById,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    }),
  });
}

export async function deleteDailyExpenseOnWorker(id: string): Promise<void> {
  await workerWrite(`/api/daily-expenses/${id}`, { method: 'DELETE' });
}

export async function upsertApprovalOnWorker(a: Approval): Promise<void> {
  await workerWrite(`/api/approvals/${a.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: a.id,
      caseId: a.caseId,
      caseNumber: a.caseNumber,
      stage: a.stage,
      submittedBy: a.submittedBy,
      submittedAt: a.submittedAt,
      approvedAt: a.approvedAt ?? null,
      status: a.status,
      notes: a.notes ?? null,
      adminNotes: a.adminNotes ?? null,
    }),
  });
}

export { WorkerApiError };
