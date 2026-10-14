import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
  activityLog,
  appSettings,
  approvals,
  employeeDailyExpenses,
  notifications,
  surgicalKits,
  employees,
  cases,
} from '../db/schema';
import { AuthError } from '../middleware/authorization';
import type { RequestContext } from '../middleware/auth';
import {
  assertActivityInsert,
  assertAdminWrite,
  assertApprovalUpsert,
  assertKitPatch,
  assertNotificationCreate,
  assertNotificationRecipientAccess,
} from '../middleware/writeAuth';

function nowIso(): string {
  return new Date().toISOString();
}

export type ActivityInsertBody = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel?: string;
  performedBy: string;
  performedByRole: string;
  details?: string;
};

export async function insertActivityLog(
  db: Db,
  ctx: RequestContext,
  body: ActivityInsertBody,
  relaxed: boolean,
): Promise<void> {
  assertActivityInsert(ctx, relaxed);
  if (!body.id || !body.action || !body.entityType || !body.entityId || !body.performedBy || !body.performedByRole) {
    throw new Error('Missing required activity fields');
  }
  await db.insert(activityLog).values({
    id: body.id,
    action: body.action,
    entityType: body.entityType,
    entityId: body.entityId,
    entityLabel: body.entityLabel ?? '',
    performedBy: body.performedBy,
    performedByRole: body.performedByRole,
    details: body.details ?? '',
    createdAt: nowIso(),
  });
}

export type NotificationCreateBody = {
  id: string;
  title: string;
  message?: string;
  type?: string;
  read?: boolean;
  caseId?: string | null;
  recipientId?: string | null;
};

export async function createNotification(
  db: Db,
  ctx: RequestContext,
  body: NotificationCreateBody,
  relaxed: boolean,
): Promise<void> {
  const recipientId = body.recipientId ?? null;
  assertNotificationCreate(ctx, recipientId, relaxed);
  if (!body.id || !body.title) throw new Error('Missing notification id or title');
  if (body.caseId) {
    const row = await db.select({ id: cases.id }).from(cases).where(eq(cases.id, body.caseId)).limit(1);
    if (!row.length) throw new Error('Invalid case_id');
  }
  if (recipientId) {
    const row = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, recipientId)).limit(1);
    if (!row.length) throw new Error('Invalid recipient_id');
  }
  await db.insert(notifications).values({
    id: body.id,
    title: body.title,
    message: body.message ?? '',
    type: body.type ?? 'info',
    isRead: body.read ?? false,
    caseId: body.caseId ?? null,
    recipientId,
    createdAt: nowIso(),
  });
}

export async function markNotificationRead(
  db: Db,
  ctx: RequestContext,
  id: string,
  relaxed: boolean,
): Promise<void> {
  const rows = await db
    .select({ recipientId: notifications.recipientId })
    .from(notifications)
    .where(eq(notifications.id, id))
    .limit(1);
  if (!rows.length) throw new AuthError('Not found', 404);
  assertNotificationRecipientAccess(ctx, rows[0].recipientId, relaxed);
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(
  db: Db,
  ctx: RequestContext,
  recipientId: string,
  relaxed: boolean,
): Promise<void> {
  assertNotificationRecipientAccess(ctx, recipientId, relaxed);
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.recipientId, recipientId), eq(notifications.isRead, false)));
}

export async function upsertAppSetting(
  db: Db,
  ctx: RequestContext,
  key: string,
  value: string,
  updatedBy: string,
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  if (!key) throw new Error('Missing settings key');
  const ts = nowIso();
  await db
    .insert(appSettings)
    .values({ key, value, updatedBy: updatedBy || '', updatedAt: ts })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedBy: updatedBy || '', updatedAt: ts },
    });
}

export type KitPatchBody = {
  status?: string;
  lastUsedDate?: string;
};

export async function patchSurgicalKit(
  db: Db,
  ctx: RequestContext,
  id: string,
  patch: KitPatchBody,
  relaxed: boolean,
): Promise<void> {
  assertKitPatch(ctx, relaxed);
  if (!patch.status && !patch.lastUsedDate) throw new Error('No kit fields to update');
  const exists = await db.select({ id: surgicalKits.id }).from(surgicalKits).where(eq(surgicalKits.id, id)).limit(1);
  if (!exists.length) throw new AuthError('Not found', 404);
  const set: Record<string, string> = { updatedAt: nowIso() };
  if (patch.status) set.status = patch.status;
  if (patch.lastUsedDate) set.lastUsedDate = patch.lastUsedDate;
  await db.update(surgicalKits).set(set).where(eq(surgicalKits.id, id));
}

export type DailyExpenseBody = {
  id: string;
  employeeId: string;
  employeeName?: string;
  expenseDate: string;
  kmsDriven?: number;
  petrolAmount?: number;
  foodAmount?: number;
  otherAmount?: number;
  otherDescription?: string;
  notes?: string;
  enteredBy?: string;
  enteredById?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export async function upsertDailyExpense(
  db: Db,
  ctx: RequestContext,
  body: DailyExpenseBody,
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  if (!body.id || !body.employeeId || !body.expenseDate) {
    throw new Error('Missing expense id, employeeId, or expenseDate');
  }
  const emp = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, body.employeeId)).limit(1);
  if (!emp.length) throw new Error('Invalid employee_id');
  const ts = nowIso();
  await db
    .insert(employeeDailyExpenses)
    .values({
      id: body.id,
      employeeId: body.employeeId,
      employeeName: body.employeeName ?? '',
      expenseDate: body.expenseDate,
      kmsDriven: body.kmsDriven ?? 0,
      petrolAmount: body.petrolAmount ?? 0,
      foodAmount: body.foodAmount ?? 0,
      otherAmount: body.otherAmount ?? 0,
      otherDescription: body.otherDescription ?? '',
      notes: body.notes ?? '',
      enteredBy: body.enteredBy ?? '',
      enteredById: body.enteredById ?? null,
      createdAt: body.createdAt ?? ts,
      updatedAt: body.updatedAt ?? ts,
    })
    .onConflictDoUpdate({
      target: employeeDailyExpenses.id,
      set: {
        employeeId: body.employeeId,
        employeeName: body.employeeName ?? '',
        expenseDate: body.expenseDate,
        kmsDriven: body.kmsDriven ?? 0,
        petrolAmount: body.petrolAmount ?? 0,
        foodAmount: body.foodAmount ?? 0,
        otherAmount: body.otherAmount ?? 0,
        otherDescription: body.otherDescription ?? '',
        notes: body.notes ?? '',
        enteredBy: body.enteredBy ?? '',
        enteredById: body.enteredById ?? null,
        updatedAt: body.updatedAt ?? ts,
      },
    });
}

export async function deleteDailyExpense(
  db: Db,
  ctx: RequestContext,
  id: string,
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  await db.delete(employeeDailyExpenses).where(eq(employeeDailyExpenses.id, id));
}

export type ApprovalUpsertBody = {
  id: string;
  caseId: string;
  caseNumber: string;
  stage: string;
  submittedBy: string;
  submittedAt: string;
  approvedAt?: string | null;
  status: string;
  notes?: string | null;
  adminNotes?: string | null;
};

export async function upsertApproval(
  db: Db,
  ctx: RequestContext,
  body: ApprovalUpsertBody,
  relaxed: boolean,
): Promise<void> {
  assertApprovalUpsert(ctx, relaxed);
  if (!body.id || !body.caseId || !body.caseNumber || !body.stage || !body.submittedBy || !body.submittedAt || !body.status) {
    throw new Error('Missing required approval fields');
  }
  const caseRow = await db.select({ id: cases.id }).from(cases).where(eq(cases.id, body.caseId)).limit(1);
  if (!caseRow.length) throw new Error('Invalid case_id');
  await db
    .insert(approvals)
    .values({
      id: body.id,
      caseId: body.caseId,
      caseNumber: body.caseNumber,
      stage: body.stage,
      submittedBy: body.submittedBy,
      submittedAt: body.submittedAt,
      approvedAt: body.approvedAt ?? null,
      status: body.status,
      notes: body.notes ?? null,
      adminNotes: body.adminNotes ?? null,
    })
    .onConflictDoUpdate({
      target: approvals.id,
      set: {
        caseId: body.caseId,
        caseNumber: body.caseNumber,
        stage: body.stage,
        submittedBy: body.submittedBy,
        submittedAt: body.submittedAt,
        approvedAt: body.approvedAt ?? null,
        status: body.status,
        notes: body.notes ?? null,
        adminNotes: body.adminNotes ?? null,
      },
    });
}
