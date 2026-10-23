/**
 * Case SELECT visibility — mirrors Supabase RLS (parallel workflow + FCFS pool).
 */
import type { RequestContext } from './authContext';
import { employeeIsAssigneeOnOpenStage, parseStagesJson } from './caseAssignee';

const FCFS_STAGES = new Set(['Pickup from Hospital', 'Billing', 'Bill Submission']);

export type CaseReadRow = {
  assignedEmployeeId: string | null;
  stagesJson: string;
  currentStage: string;
  currentDepartment: string | null;
  status: string;
};

export type EmployeeDeptContext = {
  department: string;
  departments: string;
};

function parseDepartments(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === 'string') : [];
  } catch {
    return [];
  }
}

function departmentTags(ctx: EmployeeDeptContext): Set<string> {
  const tags = new Set<string>([ctx.department]);
  for (const d of parseDepartments(ctx.departments)) tags.add(d);
  return tags;
}

/** Port of `employee_can_claim_fcfs_case` (add-fcfs-case-pool.sql). */
export function employeeCanClaimFcfsCase(
  caseStage: string,
  caseDept: string | null,
  employee: EmployeeDeptContext,
): boolean {
  const tags = departmentTags(employee);
  if (caseStage === 'Pickup from Hospital' && caseDept === 'Delivery') {
    return tags.has('Delivery') || tags.has('Drivers');
  }
  if (caseStage === 'Billing' && caseDept === 'Accounts') {
    return tags.has('Accounts');
  }
  if (caseStage === 'Bill Submission' && caseDept === 'Bill Submission') {
    return tags.has('Bill Submission');
  }
  return false;
}

export function canReadCaseRow(
  ctx: RequestContext,
  row: CaseReadRow,
  employee?: EmployeeDeptContext | null,
): boolean {
  if (!ctx.identity) return false;
  if (ctx.role === 'admin' || ctx.role === 'store_manager') return true;
  if (!ctx.employeeId) return false;

  if (row.assignedEmployeeId === ctx.employeeId) return true;

  if (employeeIsAssigneeOnOpenStage(row.stagesJson, ctx.employeeId)) return true;

  const stages = parseStagesJson(row.stagesJson);
  const onCurrentAssistant = stages.some(
    (elem) =>
      elem.stage === row.currentStage && elem.assistantEmployee?.id === ctx.employeeId,
  );
  if (onCurrentAssistant) return true;

  if (
    employee &&
    !row.assignedEmployeeId &&
    (row.status === 'Active' || row.status === 'Draft') &&
    FCFS_STAGES.has(row.currentStage) &&
    employeeCanClaimFcfsCase(row.currentStage, row.currentDepartment, employee)
  ) {
    return true;
  }

  return false;
}

export function caseRowToReadShape(row: Record<string, unknown>): CaseReadRow {
  const snapshot = row.assigned_employee_snapshot as { id?: string } | null | undefined;
  const assignedId =
    (row.assigned_employee_id as string | null | undefined) ??
    (snapshot?.id ? String(snapshot.id) : null);
  return {
    assignedEmployeeId: assignedId,
    stagesJson:
      typeof row.stages === 'string' ? row.stages : JSON.stringify(row.stages ?? []),
    currentStage: String(row.current_stage ?? ''),
    currentDepartment: (row.current_department as string | null) ?? null,
    status: String(row.status ?? ''),
  };
}
