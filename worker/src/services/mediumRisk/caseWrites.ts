import { and, eq, isNull } from 'drizzle-orm';
import type { Env } from '../../env';
import type { Db } from '../../db/client';
import { cases, hospitals } from '../../db/schema';
import {
  employeeIsAssigneeOnOpenStage,
  employeeIsAssigneeOnStages,
  parseStagesJson,
} from '../../lib/caseAssignee';
import { syncCaseHeaderFromStages } from '../../lib/caseHeaderSync';
import { nowIso } from '../../lib/writeContext';
import type { RequestContext } from '../../middleware/auth';
import { AuthError } from '../../middleware/authorization';
import { assertAdminWrite } from '../../middleware/writeAuth';
import { getCaseDetail } from '../cases';

export type CaseWritePayload = Record<string, unknown>;

function jsonStr(v: unknown, fallback = '{}'): string {
  if (v == null) return fallback;
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function moneyToMinor(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function assertCaseSaveAuth(
  ctx: RequestContext,
  existing: { assignedEmployeeId: string | null; stages: string; assignedEmployeeSnapshot: string | null },
  relaxed: boolean,
): void {
  if (relaxed && !ctx.identity) return;
  if (!ctx.identity) throw new AuthError('Unauthorized', 401);
  if (ctx.role === 'admin') return;
  const empId = ctx.employeeId;
  if (!empId) throw new AuthError('Your login is not linked to an employee profile.', 403);
  if (
    existing.assignedEmployeeId !== empId &&
    !employeeIsAssigneeOnOpenStage(existing.stages, empId) &&
    !employeeIsAssigneeOnStages(existing.stages, empId)
  ) {
    let name = 'another employee';
    try {
      const snap = existing.assignedEmployeeSnapshot
        ? (JSON.parse(existing.assignedEmployeeSnapshot) as { name?: string })
        : null;
      if (snap?.name) name = snap.name;
    } catch {
      /* ignore */
    }
    throw new AuthError(`This case is assigned to ${name}, not you. Ask admin to reassign it.`, 403);
  }
}

function rowFromPayload(p: CaseWritePayload, updatedAt: string) {
  return {
    caseNumber: (p.case_number as string) ?? undefined,
    hospitalId: (p.hospital_id as string) || undefined,
    doctorId: p.doctor_id === undefined ? undefined : ((p.doctor_id as string) || null),
    hospitalSnapshot: jsonStr(p.hospital_snapshot, '{}'),
    doctorSnapshot: jsonStr(p.doctor_snapshot, '{}'),
    surgeryDate: (p.surgery_date as string) || null,
    implantRequired: (p.implant_required as string) ?? '',
    implantType: (p.implant_type as string) ?? '',
    implantCompany: (p.implant_company as string) ?? '',
    priority: (p.priority as string) ?? 'Medium',
    status: (p.status as string) ?? 'Draft',
    currentStage: (p.current_stage as string) ?? 'Set Preparation',
    currentDepartment: p.current_department === undefined ? undefined : ((p.current_department as string) || null),
    assignedEmployeeId:
      p.assigned_employee_id === undefined ? undefined : ((p.assigned_employee_id as string) || null),
    assignedEmployeeSnapshot:
      p.assigned_employee_snapshot === undefined
        ? undefined
        : p.assigned_employee_snapshot
          ? jsonStr(p.assigned_employee_snapshot)
          : null,
    createdBy: (p.created_by as string) ?? '',
    dueDate: p.due_date === undefined ? undefined : ((p.due_date as string) || null),
    remarks: (p.remarks as string) ?? '',
    stages: jsonStr(p.stages, '[]'),
    activityLogs: jsonStr(p.activity_logs, '[]'),
    comments: jsonStr(p.comments, '[]'),
    postSurgeryDuties:
      p.post_surgery_duties === undefined ? undefined : jsonStr(p.post_surgery_duties, '{}'),
    invoiceAmountMinor: p.invoice_amount === undefined ? undefined : moneyToMinor(p.invoice_amount),
    collectedAmountMinor:
      p.collected_amount === undefined ? undefined : moneyToMinor(p.collected_amount),
    paymentStatus: p.payment_status === undefined ? undefined : ((p.payment_status as string) || null),
    cancelReason: (p.cancel_reason as string) ?? '',
    postponeReason: (p.postpone_reason as string) ?? '',
    postponedFrom: p.postponed_from === undefined ? undefined : ((p.postponed_from as string) || null),
    surgeryOutcome: (p.surgery_outcome as string) ?? '',
    surgeryOutcomeDetail: (p.surgery_outcome_detail as string) ?? '',
    updatedAt,
  };
}

export async function createCase(
  db: Db,
  ctx: RequestContext,
  payload: CaseWritePayload,
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  const id = payload.id as string;
  const hospitalId = payload.hospital_id as string;
  if (!hospitalId) throw new Error('Hospital must be saved in the database before creating a case.');
  const hosp = await db.select({ id: hospitals.id }).from(hospitals).where(eq(hospitals.id, hospitalId)).limit(1);
  if (!hosp.length) throw new Error('Invalid hospital_id');
  const ts = nowIso();
  const row = rowFromPayload(payload, ts);
  await db.insert(cases).values({
    id,
    caseNumber: row.caseNumber!,
    hospitalId,
    doctorId: row.doctorId ?? null,
    hospitalSnapshot: row.hospitalSnapshot!,
    doctorSnapshot: row.doctorSnapshot!,
    surgeryDate: row.surgeryDate ?? null,
    implantRequired: row.implantRequired!,
    implantType: row.implantType!,
    implantCompany: row.implantCompany!,
    cancelReason: row.cancelReason!,
    surgeryOutcome: row.surgeryOutcome!,
    surgeryOutcomeDetail: row.surgeryOutcomeDetail!,
    postponeReason: row.postponeReason!,
    postponedFrom: row.postponedFrom ?? null,
    priority: row.priority!,
    status: row.status!,
    currentStage: row.currentStage!,
    currentDepartment: row.currentDepartment ?? null,
    postSurgeryDuties: row.postSurgeryDuties ?? '{}',
    assignedEmployeeId: row.assignedEmployeeId ?? null,
    assignedEmployeeSnapshot: row.assignedEmployeeSnapshot ?? null,
    createdBy: row.createdBy!,
    dueDate: row.dueDate ?? null,
    remarks: row.remarks!,
    stages: row.stages!,
    activityLogs: row.activityLogs!,
    comments: row.comments!,
    invoiceAmountMinor: row.invoiceAmountMinor ?? null,
    collectedAmountMinor: row.collectedAmountMinor ?? null,
    paymentStatus: row.paymentStatus ?? null,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function saveCaseForSession(
  db: Db,
  ctx: RequestContext,
  payload: CaseWritePayload,
  relaxed: boolean,
): Promise<void> {
  const caseId = payload.id as string;
  const existingRows = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
  const existing = existingRows[0];
  if (!existing) {
    throw new Error(
      'Case not found in database. Refresh the page or ask admin to confirm the case was created.',
    );
  }
  let authRow = existing;
  try {
    assertCaseSaveAuth(ctx, authRow, relaxed);
  } catch (e) {
    if (
      e instanceof AuthError &&
      e.message.includes('assigned to') &&
      ctx.role !== 'admin' &&
      ctx.employeeId
    ) {
      await syncCaseHeaderFromStages(db, caseId);
      const refreshed = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
      if (!refreshed[0]) throw e;
      authRow = refreshed[0];
      assertCaseSaveAuth(ctx, authRow, relaxed);
    } else {
      throw e;
    }
  }
  const ts = nowIso();
  const patch = rowFromPayload(payload, ts);

  /** List/bootstrap rows ship `stages: []` — reject accidental wipe of assignments/submissions. */
  let stagesToWrite = patch.stages ?? existing.stages;
  if (patch.stages != null && patch.stages !== existing.stages) {
    const existingStages = parseStagesJson(existing.stages);
    const incomingStages = parseStagesJson(patch.stages);
    const existingHadWork = existingStages.some(
      (s) =>
        s.assignedEmployee?.id ||
        s.status === 'Submitted' ||
        s.status === 'Approved' ||
        s.submittedAt,
    );
    const incomingHasWork = incomingStages.some(
      (s) =>
        s.assignedEmployee?.id ||
        s.status === 'Submitted' ||
        s.status === 'Approved' ||
        s.submittedAt,
    );
    if (existingHadWork && !incomingHasWork) {
      stagesToWrite = existing.stages;
    }
  }

  await db
    .update(cases)
    .set({
      caseNumber: patch.caseNumber ?? existing.caseNumber,
      hospitalId: patch.hospitalId ?? existing.hospitalId,
      doctorId: patch.doctorId === undefined ? existing.doctorId : patch.doctorId,
      hospitalSnapshot: patch.hospitalSnapshot ?? existing.hospitalSnapshot,
      doctorSnapshot: patch.doctorSnapshot ?? existing.doctorSnapshot,
      surgeryDate: patch.surgeryDate === undefined ? existing.surgeryDate : patch.surgeryDate,
      implantRequired: patch.implantRequired ?? existing.implantRequired,
      implantType: patch.implantType ?? existing.implantType,
      implantCompany: patch.implantCompany ?? existing.implantCompany,
      priority: patch.priority ?? existing.priority,
      status: patch.status ?? existing.status,
      currentStage: patch.currentStage ?? existing.currentStage,
      currentDepartment:
        patch.currentDepartment === undefined ? existing.currentDepartment : patch.currentDepartment,
      assignedEmployeeId:
        patch.assignedEmployeeId === undefined ? existing.assignedEmployeeId : patch.assignedEmployeeId,
      assignedEmployeeSnapshot:
        patch.assignedEmployeeSnapshot === undefined
          ? existing.assignedEmployeeSnapshot
          : patch.assignedEmployeeSnapshot,
      createdBy: patch.createdBy ?? existing.createdBy,
      dueDate: patch.dueDate === undefined ? existing.dueDate : patch.dueDate,
      remarks: patch.remarks ?? existing.remarks,
      stages: stagesToWrite,
      activityLogs: patch.activityLogs ?? existing.activityLogs,
      comments: patch.comments ?? existing.comments,
      postSurgeryDuties:
        patch.postSurgeryDuties === undefined ? existing.postSurgeryDuties : patch.postSurgeryDuties,
      invoiceAmountMinor:
        patch.invoiceAmountMinor === undefined ? existing.invoiceAmountMinor : patch.invoiceAmountMinor,
      collectedAmountMinor:
        patch.collectedAmountMinor === undefined
          ? existing.collectedAmountMinor
          : patch.collectedAmountMinor,
      paymentStatus: patch.paymentStatus === undefined ? existing.paymentStatus : patch.paymentStatus,
      cancelReason: patch.cancelReason ?? existing.cancelReason,
      postponeReason: patch.postponeReason ?? existing.postponeReason,
      postponedFrom: patch.postponedFrom === undefined ? existing.postponedFrom : patch.postponedFrom,
      surgeryOutcome: patch.surgeryOutcome ?? existing.surgeryOutcome,
      surgeryOutcomeDetail: patch.surgeryOutcomeDetail ?? existing.surgeryOutcomeDetail,
      updatedAt: ts,
    })
    .where(eq(cases.id, caseId));

  await syncCaseHeaderFromStages(db, caseId);
}

export async function deleteCase(db: Db, ctx: RequestContext, id: string, relaxed: boolean): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  await db.delete(cases).where(eq(cases.id, id));
}

export async function syncCaseHeader(
  db: Db,
  ctx: RequestContext,
  caseId: string,
  relaxed: boolean,
): Promise<void> {
  if (relaxed && !ctx.identity) {
    await syncCaseHeaderFromStages(db, caseId);
    return;
  }
  if (!ctx.identity) throw new AuthError('Unauthorized', 401);
  if (ctx.role === 'admin' || !ctx.employeeId) return;
  const existing = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
  if (!existing.length) throw new AuthError('Case not found', 404);
  if (!employeeIsAssigneeOnStages(existing[0].stages, ctx.employeeId)) {
    throw new AuthError('You are not assigned on this case.', 403);
  }
  await syncCaseHeaderFromStages(db, caseId);
}

const FCFS_STAGES = new Set(['Set Preparation', 'Delivery', 'Pickup from Hospital', 'Return to Depot']);

export async function claimCaseFcfs(
  env: Env,
  db: Db,
  ctx: RequestContext,
  caseId: string,
  employee: { id: string; name: string; department: string; departments?: string[] },
  relaxed: boolean,
): Promise<Record<string, unknown>> {
  if (relaxed && !ctx.identity) {
    /* allow test */
  } else {
    if (!ctx.identity) throw new AuthError('Unauthorized', 401);
    if (ctx.role !== 'admin' && ctx.employeeId !== employee.id) {
      throw new AuthError('Forbidden', 403);
    }
  }

  const detail = await getCaseDetail(db, caseId);
  if (!detail) throw new AuthError('Case not found', 404);
  if (!FCFS_STAGES.has(detail.current_stage as string)) {
    throw new Error('This stage is not FCFS.');
  }
  if (detail.assigned_employee_id) {
    throw new AuthError('This case was already claimed or assigned.', 409);
  }

  const assignedAt = nowIso();
  const stages = parseStagesJson(JSON.stringify(detail.stages));
  const stageName = detail.current_stage as string;
  const updatedStages = stages.map((s) =>
    (s.stage ?? '') === stageName
      ? {
          ...s,
          assignedEmployee: employee,
          assignedAt,
          status: 'Assigned',
        }
      : s,
  );
  const stagesJson = JSON.stringify(updatedStages);
  const empSnap = JSON.stringify(employee);

  const claimed = await db
    .update(cases)
    .set({
      assignedEmployeeId: employee.id,
      assignedEmployeeSnapshot: empSnap,
      status: 'Active',
      currentDepartment: employee.department,
      stages: stagesJson,
      updatedAt: assignedAt,
    })
    .where(and(eq(cases.id, caseId), isNull(cases.assignedEmployeeId)))
    .returning({ id: cases.id });

  if (claimed.length !== 1) {
    throw new AuthError('This case was already claimed by someone else.', 409);
  }

  const after = await getCaseDetail(db, caseId);
  if (!after) throw new Error('Case not found after claim');
  return after;
}
