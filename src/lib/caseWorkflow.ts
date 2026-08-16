import type { Department, Employee, ImplantCase, StageRecord, WorkflowStage } from '../types';
import { CLEANING_AUDIT_DEPARTMENT, normalizeDepartment } from '../constants/departments';

export const WORKFLOW_STAGES: WorkflowStage[] = [
  'Kit Preparation',
  'Delivery',
  'Surgery',
  'Pickup from Hospital',
  'Cleaning & Audit',
  'Billing',
  'Bill Submission',
  'Completed',
];

/** Stages that need an employee when creating a case. */
export const ASSIGNABLE_WORKFLOW_STAGES: Exclude<WorkflowStage, 'Completed'>[] = [
  'Kit Preparation',
  'Delivery',
  'Surgery',
  'Pickup from Hospital',
  'Cleaning & Audit',
  'Billing',
  'Bill Submission',
];

export const STAGE_DEPARTMENT_MAP: Record<WorkflowStage, Department | null> = {
  'Kit Preparation': 'Stores',
  'Delivery': 'Delivery',
  'Surgery': 'Scrub Person',
  'Pickup from Hospital': 'Delivery',
  'Cleaning & Audit': CLEANING_AUDIT_DEPARTMENT,
  'Billing': 'Accounts',
  'Bill Submission': 'Bill Submission',
  'Completed': null,
};

export type StageAssignments = Record<
  (typeof ASSIGNABLE_WORKFLOW_STAGES)[number],
  Employee
>;

const STAGE_STATUS_RANK: Record<string, number> = {
  Pending: 0,
  Assigned: 1,
  'Changes Requested': 2,
  Submitted: 3,
  Rejected: 3,
  Approved: 4,
};

export function normalizeWorkflowStageName(stage: string | null | undefined): WorkflowStage {
  if (!stage) return 'Kit Preparation';
  if (stage === 'Collection') return 'Bill Submission';
  if (stage === 'Cleaning' || stage === 'Audit' || stage === 'Cleaning & Audit') {
    return 'Cleaning & Audit';
  }
  if ((WORKFLOW_STAGES as string[]).includes(stage)) {
    return stage as WorkflowStage;
  }
  return 'Kit Preparation';
}

function emptyStage(stage: WorkflowStage): StageRecord {
  return {
    stage,
    department: (STAGE_DEPARTMENT_MAP[stage] ?? 'Admin') as Department,
    assignedEmployee: null,
    assignedAt: null,
    submittedAt: null,
    approvedAt: null,
    status: 'Pending',
    notes: '',
    adminNotes: '',
    documents: [],
  };
}

function preferStageRecord(a: StageRecord, b: StageRecord): StageRecord {
  const rankA = STAGE_STATUS_RANK[a.status] ?? 0;
  const rankB = STAGE_STATUS_RANK[b.status] ?? 0;
  const primary = rankB > rankA ? b : a;
  const secondary = primary === a ? b : a;
  return {
    ...primary,
    stage: primary.stage,
    department: primary.department,
    assignedEmployee: primary.assignedEmployee ?? secondary.assignedEmployee,
    assignedAt: primary.assignedAt ?? secondary.assignedAt,
    submittedAt: primary.submittedAt ?? secondary.submittedAt,
    approvedAt: primary.approvedAt ?? secondary.approvedAt,
    notes: primary.notes || secondary.notes,
    adminNotes: primary.adminNotes || secondary.adminNotes,
    documents: primary.documents.length > 0 ? primary.documents : secondary.documents,
  };
}

/** Collapse legacy Cleaning + Audit stage rows into one Cleaning & Audit record. */
export function normalizeCaseStages(stages: StageRecord[] | null | undefined): StageRecord[] {
  const byStage = new Map<WorkflowStage, StageRecord>();

  for (const raw of stages ?? []) {
    const stage = normalizeWorkflowStageName(raw.stage);
    const next: StageRecord = {
      ...raw,
      stage,
      department: (normalizeDepartment(raw.department) ?? STAGE_DEPARTMENT_MAP[stage] ?? raw.department) as Department,
      assignedEmployee: raw.assignedEmployee
        ? {
            ...raw.assignedEmployee,
            department:
              normalizeDepartment(raw.assignedEmployee.department) ?? raw.assignedEmployee.department,
          }
        : null,
    };

    const existing = byStage.get(stage);
    byStage.set(stage, existing ? preferStageRecord(existing, next) : next);
  }

  return WORKFLOW_STAGES.map((stage) => byStage.get(stage) ?? emptyStage(stage));
}

export function findStageRecord(
  stages: StageRecord[] | null | undefined,
  stage: WorkflowStage | string,
): StageRecord | undefined {
  const target = normalizeWorkflowStageName(stage);
  return (stages ?? []).find((s) => normalizeWorkflowStageName(s.stage) === target);
}

export function getStageIndex(stage: WorkflowStage): number {
  return WORKFLOW_STAGES.indexOf(normalizeWorkflowStageName(stage));
}

export function isCaseAssignedToEmployee(
  implantCase: ImplantCase,
  employee: Pick<Employee, 'id' | 'email'>,
): boolean {
  const assignee = implantCase.assignedEmployee;
  if (!assignee) return false;
  if (assignee.id && assignee.id === employee.id) return true;
  if (assignee.email && employee.email) {
    return assignee.email.trim().toLowerCase() === employee.email.trim().toLowerCase();
  }
  return false;
}

/**
 * Detects the narrow approve+assign race: the CURRENT stage record was already
 * re-assigned to someone (status 'Assigned'), but the case's top-level status
 * field is stale at 'Approved' because a parallel write lost the race.
 *
 * IMPORTANT: This must NOT match a normal "admin approved this stage and hasn't
 * assigned the next stage yet" state — that is status 'Approved' with the
 * CURRENT stage record ALSO 'Approved'. Treating that as "stuck" would silently
 * revert legitimate approvals and hide the admin's "Assign Next Stage" button.
 */
export function needsAssignmentReactivation(
  implantCase: ImplantCase,
  employee?: Pick<Employee, 'id' | 'email'>,
): boolean {
  if (implantCase.status !== 'Approved' || !implantCase.assignedEmployee) return false;
  if (employee && !isCaseAssignedToEmployee(implantCase, employee)) return false;
  if (implantCase.currentStage === 'Completed') return false;

  const stageIdx = getStageIndex(implantCase.currentStage);
  if (stageIdx < 0) return false;

  const currentStageRecord = implantCase.stages[stageIdx];
  if (!currentStageRecord) return false;

  // Only the genuine race: current stage already re-assigned, but case status
  // field is stuck at 'Approved' instead of 'Active'.
  return currentStageRecord.status === 'Assigned';
}

export function canEmployeeSubmitCase(
  implantCase: ImplantCase,
  employee: Pick<Employee, 'id' | 'email'>,
): boolean {
  if (implantCase.currentStage === 'Completed') return false;
  if (implantCase.status === 'Waiting For Approval') return false;
  if (!isCaseAssignedToEmployee(implantCase, employee)) return false;

  const stageIdx = getStageIndex(implantCase.currentStage);
  const currentStageRecord = stageIdx >= 0 ? implantCase.stages[stageIdx] : undefined;
  if (currentStageRecord?.status === 'Submitted') return false;

  if (currentStageRecord?.status === 'Approved') {
    return needsAssignmentReactivation(implantCase, employee);
  }

  return true;
}
