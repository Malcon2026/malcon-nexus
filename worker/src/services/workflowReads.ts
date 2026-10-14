import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { activityLog, approvals, caseTaskRequests } from '../db/schema';

const APPROVAL_COLUMNS = {
  id: approvals.id,
  caseId: approvals.caseId,
  caseNumber: approvals.caseNumber,
  stage: approvals.stage,
  submittedBy: approvals.submittedBy,
  submittedAt: approvals.submittedAt,
  approvedAt: approvals.approvedAt,
  status: approvals.status,
  notes: approvals.notes,
  adminNotes: approvals.adminNotes,
} as const;

function mapApproval(r: {
  id: string;
  caseId: string;
  caseNumber: string;
  stage: string;
  submittedBy: string;
  submittedAt: string;
  approvedAt: string | null;
  status: string;
  notes: string | null;
  adminNotes: string | null;
}) {
  return {
    id: r.id,
    case_id: r.caseId,
    case_number: r.caseNumber,
    stage: r.stage,
    submitted_by: r.submittedBy,
    submitted_at: r.submittedAt,
    approved_at: r.approvedAt,
    status: r.status,
    notes: r.notes,
    admin_notes: r.adminNotes,
  };
}

export async function countApprovals(db: Db) {
  const row = await db.select({ c: sql<number>`count(*)` }).from(approvals);
  return Number(row[0]?.c ?? 0);
}

export async function listApprovals(db: Db, offset: number, limit: number) {
  const rows = await db
    .select(APPROVAL_COLUMNS)
    .from(approvals)
    .orderBy(desc(approvals.submittedAt))
    .offset(offset)
    .limit(limit);
  return rows.map(mapApproval);
}

const TASK_COLUMNS = {
  id: caseTaskRequests.id,
  caseId: caseTaskRequests.caseId,
  caseNumber: caseTaskRequests.caseNumber,
  stage: caseTaskRequests.stage,
  employeeId: caseTaskRequests.employeeId,
  employeeName: caseTaskRequests.employeeName,
  employeeDepartment: caseTaskRequests.employeeDepartment,
  status: caseTaskRequests.status,
  requestedAt: caseTaskRequests.requestedAt,
  reviewedBy: caseTaskRequests.reviewedBy,
  reviewedById: caseTaskRequests.reviewedById,
  reviewedAt: caseTaskRequests.reviewedAt,
  adminNotes: caseTaskRequests.adminNotes,
} as const;

function mapTaskRequest(r: {
  id: string;
  caseId: string;
  caseNumber: string;
  stage: string;
  employeeId: string;
  employeeName: string;
  employeeDepartment: string;
  status: string;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  adminNotes: string | null;
}) {
  return {
    id: r.id,
    case_id: r.caseId,
    case_number: r.caseNumber,
    stage: r.stage,
    employee_id: r.employeeId,
    employee_name: r.employeeName,
    employee_department: r.employeeDepartment,
    status: r.status,
    requested_at: r.requestedAt,
    reviewed_by: r.reviewedBy,
    reviewed_by_id: r.reviewedById,
    reviewed_at: r.reviewedAt,
    admin_notes: r.adminNotes,
  };
}

export type CaseTaskFilters = {
  employeeId?: string;
  caseId?: string;
  status?: string;
};

function taskWhere(filters: CaseTaskFilters) {
  const parts = [];
  if (filters.employeeId) parts.push(eq(caseTaskRequests.employeeId, filters.employeeId));
  if (filters.caseId) parts.push(eq(caseTaskRequests.caseId, filters.caseId));
  if (filters.status) parts.push(eq(caseTaskRequests.status, filters.status));
  if (parts.length === 0) return undefined;
  return and(...parts);
}

export async function countCaseTaskRequests(db: Db, filters: CaseTaskFilters) {
  const where = taskWhere(filters);
  const row = await db.select({ c: sql<number>`count(*)` }).from(caseTaskRequests).where(where);
  return Number(row[0]?.c ?? 0);
}

export async function listCaseTaskRequests(db: Db, filters: CaseTaskFilters, offset: number, limit: number) {
  const where = taskWhere(filters);
  const rows = await db
    .select(TASK_COLUMNS)
    .from(caseTaskRequests)
    .where(where)
    .orderBy(desc(caseTaskRequests.requestedAt))
    .offset(offset)
    .limit(limit);
  return rows.map(mapTaskRequest);
}

const ACTIVITY_COLUMNS = {
  id: activityLog.id,
  action: activityLog.action,
  entityType: activityLog.entityType,
  entityId: activityLog.entityId,
  entityLabel: activityLog.entityLabel,
  performedBy: activityLog.performedBy,
  performedByRole: activityLog.performedByRole,
  details: activityLog.details,
  createdAt: activityLog.createdAt,
} as const;

function mapActivity(r: {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  performedBy: string;
  performedByRole: string;
  details: string;
  createdAt: string;
}) {
  return {
    id: r.id,
    action: r.action,
    entity_type: r.entityType,
    entity_id: r.entityId,
    entity_label: r.entityLabel,
    performed_by: r.performedBy,
    performed_by_role: r.performedByRole,
    details: r.details,
    created_at: r.createdAt,
  };
}

/** Matches SPA cap (500). */
export const ACTIVITY_READ_CAP = 500;

export async function countActivityLog(db: Db) {
  const row = await db.select({ c: sql<number>`count(*)` }).from(activityLog);
  return Number(row[0]?.c ?? 0);
}

export async function listActivityLog(db: Db, offset: number, limit: number) {
  const capped = Math.min(limit, ACTIVITY_READ_CAP - offset);
  if (capped <= 0) return [];
  const rows = await db
    .select(ACTIVITY_COLUMNS)
    .from(activityLog)
    .orderBy(desc(activityLog.createdAt))
    .offset(offset)
    .limit(capped);
  return rows.map(mapActivity);
}
