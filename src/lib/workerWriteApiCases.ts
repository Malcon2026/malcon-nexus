import { workerFetchJson } from './workerApi';
import type { Employee, ImplantCase } from '../types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuid(value?: string | null): string | null {
  return value && UUID_RE.test(value) ? value : null;
}

/** Mirrors `caseToRow` in supabaseRepositories for Worker save/create payloads. */
export function implantCaseToWorkerRow(c: ImplantCase): Record<string, unknown> {
  return {
    id: c.id,
    case_number: c.caseNumber,
    hospital_id: asUuid(c.hospital.id),
    doctor_id: asUuid(c.doctor?.id),
    hospital_snapshot: c.hospital,
    doctor_snapshot: c.doctor ?? {},
    surgery_date: c.surgeryDate || null,
    implant_required: c.implantRequired,
    implant_type: c.implantType,
    implant_company: c.implantCompany ?? '',
    priority: c.priority,
    status: c.status,
    current_stage: c.currentStage,
    current_department: c.currentDepartment ?? null,
    assigned_employee_id: asUuid(c.assignedEmployee?.id),
    assigned_employee_snapshot: c.assignedEmployee ?? null,
    created_by: c.createdBy,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    due_date: c.dueDate || null,
    remarks: c.remarks,
    stages: c.stages,
    activity_logs: c.activityLogs,
    comments: c.comments,
    invoice_amount: c.invoiceAmount ?? null,
    collected_amount: c.collectedAmount ?? null,
    payment_status: c.paymentStatus ?? null,
    cancel_reason: c.cancelReason ?? '',
    surgery_outcome: c.surgeryOutcome ?? '',
    surgery_outcome_detail: c.surgeryOutcomeDetail ?? '',
    postpone_reason: c.postponeReason ?? '',
    postponed_from: c.postponedFrom || null,
    post_surgery_duties: c.postSurgeryDuties ?? null,
  };
}

async function write(path: string, init: RequestInit): Promise<void> {
  await workerFetchJson<{ ok?: boolean }>(path, init);
}

export async function createCaseOnWorker(c: ImplantCase): Promise<void> {
  await write('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(implantCaseToWorkerRow(c)),
  });
}

export async function saveCaseOnWorker(c: ImplantCase): Promise<void> {
  await write(`/api/cases/${c.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(implantCaseToWorkerRow(c)),
  });
}

export async function deleteCaseOnWorker(id: string): Promise<void> {
  await write(`/api/cases/${id}`, { method: 'DELETE' });
}

export async function syncCaseHeaderOnWorker(id: string): Promise<void> {
  await write(`/api/cases/${id}/sync-header`, { method: 'POST' });
}

export async function claimCaseOnWorker(
  caseId: string,
  employee: Employee,
): Promise<Record<string, unknown>> {
  const body = await workerFetchJson<{ data: { case: Record<string, unknown> } }>(
    `/api/cases/${caseId}/claim`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee }),
    },
  );
  return body.data.case;
}
