import { desc, eq, gte, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db/client';
import { cases } from '../db/schema';

/** List projection — excludes large JSON blobs. */
export const CASE_LIST_COLUMNS = {
  id: cases.id,
  caseNumber: cases.caseNumber,
  hospitalId: cases.hospitalId,
  doctorId: cases.doctorId,
  hospitalSnapshot: cases.hospitalSnapshot,
  doctorSnapshot: cases.doctorSnapshot,
  surgeryDate: cases.surgeryDate,
  implantRequired: cases.implantRequired,
  implantType: cases.implantType,
  implantCompany: cases.implantCompany,
  priority: cases.priority,
  status: cases.status,
  currentStage: cases.currentStage,
  currentDepartment: cases.currentDepartment,
  assignedEmployeeId: cases.assignedEmployeeId,
  assignedEmployeeSnapshot: cases.assignedEmployeeSnapshot,
  createdBy: cases.createdBy,
  remarks: cases.remarks,
  paymentStatus: cases.paymentStatus,
  invoiceAmountMinor: cases.invoiceAmountMinor,
  collectedAmountMinor: cases.collectedAmountMinor,
  dueDate: cases.dueDate,
  createdAt: cases.createdAt,
  updatedAt: cases.updatedAt,
} as const;

const CASE_DETAIL_COLUMNS = {
  id: cases.id,
  caseNumber: cases.caseNumber,
  hospitalId: cases.hospitalId,
  doctorId: cases.doctorId,
  hospitalSnapshot: cases.hospitalSnapshot,
  doctorSnapshot: cases.doctorSnapshot,
  surgeryDate: cases.surgeryDate,
  implantRequired: cases.implantRequired,
  implantType: cases.implantType,
  implantCompany: cases.implantCompany,
  cancelReason: cases.cancelReason,
  surgeryOutcome: cases.surgeryOutcome,
  surgeryOutcomeDetail: cases.surgeryOutcomeDetail,
  postponeReason: cases.postponeReason,
  postponedFrom: cases.postponedFrom,
  priority: cases.priority,
  status: cases.status,
  currentStage: cases.currentStage,
  currentDepartment: cases.currentDepartment,
  postSurgeryDuties: cases.postSurgeryDuties,
  assignedEmployeeId: cases.assignedEmployeeId,
  assignedEmployeeSnapshot: cases.assignedEmployeeSnapshot,
  createdBy: cases.createdBy,
  dueDate: cases.dueDate,
  remarks: cases.remarks,
  stages: cases.stages,
  activityLogs: cases.activityLogs,
  comments: cases.comments,
  invoiceAmountMinor: cases.invoiceAmountMinor,
  collectedAmountMinor: cases.collectedAmountMinor,
  paymentStatus: cases.paymentStatus,
  createdAt: cases.createdAt,
  updatedAt: cases.updatedAt,
} as const;

type CaseListRow = {
  id: string;
  caseNumber: string;
  hospitalId: string;
  doctorId: string | null;
  hospitalSnapshot: string | null;
  doctorSnapshot: string | null;
  surgeryDate: string | null;
  implantRequired: string;
  implantType: string;
  implantCompany: string;
  priority: string;
  status: string;
  currentStage: string;
  currentDepartment: string | null;
  assignedEmployeeId: string | null;
  assignedEmployeeSnapshot: string | null;
  createdBy: string;
  remarks: string | null;
  paymentStatus: string | null;
  invoiceAmountMinor: number | null;
  collectedAmountMinor: number | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type CaseDetailRow = {
  id: string;
  caseNumber: string;
  hospitalId: string;
  doctorId: string | null;
  hospitalSnapshot: string | null;
  doctorSnapshot: string | null;
  surgeryDate: string | null;
  implantRequired: string;
  implantType: string;
  implantCompany: string;
  cancelReason: string;
  surgeryOutcome: string;
  surgeryOutcomeDetail: string;
  postponeReason: string;
  postponedFrom: string | null;
  priority: string;
  status: string;
  currentStage: string;
  currentDepartment: string | null;
  postSurgeryDuties: string | null;
  assignedEmployeeId: string | null;
  assignedEmployeeSnapshot: string | null;
  createdBy: string;
  dueDate: string | null;
  remarks: string | null;
  stages: string | null;
  activityLogs: string | null;
  comments: string | null;
  invoiceAmountMinor: number | null;
  collectedAmountMinor: number | null;
  paymentStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

function parseJsonField(raw: string | null, fallback: unknown) {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return fallback;
  }
}

export function mapCaseDetail(r: CaseDetailRow) {
  return {
    id: r.id,
    case_number: r.caseNumber,
    hospital_id: r.hospitalId,
    doctor_id: r.doctorId,
    hospital_snapshot: parseJsonField(r.hospitalSnapshot, {}),
    doctor_snapshot: parseJsonField(r.doctorSnapshot, {}),
    surgery_date: r.surgeryDate,
    implant_required: r.implantRequired,
    implant_type: r.implantType,
    implant_company: r.implantCompany,
    cancel_reason: r.cancelReason,
    surgery_outcome: r.surgeryOutcome,
    surgery_outcome_detail: r.surgeryOutcomeDetail,
    postpone_reason: r.postponeReason,
    postponed_from: r.postponedFrom,
    priority: r.priority,
    status: r.status,
    current_stage: r.currentStage,
    current_department: r.currentDepartment,
    post_surgery_duties: parseJsonField(r.postSurgeryDuties, {}),
    assigned_employee_id: r.assignedEmployeeId,
    assigned_employee_snapshot: r.assignedEmployeeSnapshot
      ? parseJsonField(r.assignedEmployeeSnapshot, null)
      : null,
    created_by: r.createdBy,
    due_date: r.dueDate,
    remarks: r.remarks,
    stages: parseJsonField(r.stages, []),
    activity_logs: parseJsonField(r.activityLogs, []),
    comments: parseJsonField(r.comments, []),
    invoice_amount_minor: r.invoiceAmountMinor,
    collected_amount_minor: r.collectedAmountMinor,
    payment_status: r.paymentStatus,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

function mapCaseList(r: CaseListRow) {
  return {
    id: r.id,
    case_number: r.caseNumber,
    hospital_id: r.hospitalId,
    doctor_id: r.doctorId,
    hospital_snapshot: parseJsonField(r.hospitalSnapshot, {}),
    doctor_snapshot: parseJsonField(r.doctorSnapshot, {}),
    surgery_date: r.surgeryDate,
    implant_required: r.implantRequired,
    implant_type: r.implantType,
    implant_company: r.implantCompany,
    priority: r.priority,
    status: r.status,
    current_stage: r.currentStage,
    current_department: r.currentDepartment,
    assigned_employee_id: r.assignedEmployeeId,
    assigned_employee_snapshot: r.assignedEmployeeSnapshot
      ? parseJsonField(r.assignedEmployeeSnapshot, null)
      : null,
    created_by: r.createdBy,
    remarks: r.remarks,
    payment_status: r.paymentStatus,
    invoice_amount_minor: r.invoiceAmountMinor,
    collected_amount_minor: r.collectedAmountMinor,
    due_date: r.dueDate,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    stages: [],
    activity_logs: [],
    comments: [],
  };
}

function istDayStartIso(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00+05:30`).toISOString();
}

/** Surgery scheduled today (IST) or touched since midnight IST. */
export function whereCasesForBootstrapDay(dayKey: string): SQL {
  return or(
    sql`substr(${cases.surgeryDate}, 1, 10) = ${dayKey}`,
    gte(cases.updatedAt, istDayStartIso(dayKey)),
  )!;
}

export async function countCases(db: Db, dayKey?: string) {
  const where = dayKey ? whereCasesForBootstrapDay(dayKey) : undefined;
  const row = await db
    .select({ c: sql<number>`count(*)` })
    .from(cases)
    .where(where);
  return Number(row[0]?.c ?? 0);
}

export async function listCases(db: Db, offset: number, limit: number, dayKey?: string) {
  const where = dayKey ? whereCasesForBootstrapDay(dayKey) : undefined;
  const rows = await db
    .select(CASE_LIST_COLUMNS)
    .from(cases)
    .where(where)
    .orderBy(desc(cases.updatedAt))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => mapCaseList(r));
}

/** Paginated case rows including stages JSON (one D1 round-trip per page). */
export async function listCasesFull(db: Db, offset: number, limit: number, dayKey?: string) {
  const where = dayKey ? whereCasesForBootstrapDay(dayKey) : undefined;
  const rows = await db
    .select(CASE_DETAIL_COLUMNS)
    .from(cases)
    .where(where)
    .orderBy(desc(cases.updatedAt))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => mapCaseDetail(r));
}

export async function getCaseDetailsByIds(db: Db, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const rows = await db
    .select(CASE_DETAIL_COLUMNS)
    .from(cases)
    .where(inArray(cases.id, unique));
  const byId = new Map(rows.map((r) => [r.id, mapCaseDetail(r)]));
  return unique.map((id) => byId.get(id)).filter((row): row is NonNullable<typeof row> => row != null);
}

export async function getCaseDetail(db: Db, id: string) {
  const rows = await db
    .select(CASE_DETAIL_COLUMNS)
    .from(cases)
    .where(eq(cases.id, id))
    .limit(1);

  const r = rows[0];
  if (!r) return null;

  return mapCaseDetail(r);
}
