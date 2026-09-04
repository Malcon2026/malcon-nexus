import type { Department, Employee, ImplantCase, StageRecord, WorkflowStage } from '../types';
import { CLEANING_AUDIT_DEPARTMENT, getEmployeeDepartments, normalizeDepartment } from '../constants/departments';

export const WORKFLOW_STAGES: WorkflowStage[] = [
  'Kit Preparation',
  'Delivery',
  'Surgery',
  'Pickup from Hospital',
  'Cleaning & Audit',
  'Restock',
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
  'Restock',
  'Billing',
  'Bill Submission',
];

export const STAGE_DEPARTMENT_MAP: Record<WorkflowStage, Department | null> = {
  'Kit Preparation': 'Stores',
  'Delivery': 'Delivery',
  'Surgery': 'Scrub Person',
  'Pickup from Hospital': 'Delivery',
  'Cleaning & Audit': CLEANING_AUDIT_DEPARTMENT,
  'Restock': 'Stores',
  'Billing': 'Accounts',
  'Bill Submission': 'Bill Submission',
  'Completed': null,
};

/**
 * Stage → employee picked at case creation. Partial because a case can start at
 * a later stage, and the skipped stages before it never need an assignee.
 */
export type StageAssignments = Partial<
  Record<(typeof ASSIGNABLE_WORKFLOW_STAGES)[number], Employee>
>;

export type AssignableStage = (typeof ASSIGNABLE_WORKFLOW_STAGES)[number];

/** Stages that support an optional second person at assignment time. */
export const STAGES_WITH_ASSISTANT = ['Delivery', 'Surgery'] as const;
export type StageWithAssistant = (typeof STAGES_WITH_ASSISTANT)[number];
export type StageAssistantIds = Partial<Record<StageWithAssistant, string>>;
export type StageAssistantAssignments = Partial<Record<StageWithAssistant, Employee>>;

/** Sentinel for Surgery — hospital performs independently (no scrub person). */
export const SURGERY_SELF_ASSIGNMENT_VALUE = '__self__';

export function stageSupportsAssistant(stage: WorkflowStage | string): stage is StageWithAssistant {
  return (STAGES_WITH_ASSISTANT as readonly string[]).includes(normalizeWorkflowStageName(stage as WorkflowStage));
}

/** When true, employee stage submit auto-advances the case (no admin Approval Queue). */
export const AUTO_APPROVE_STAGE_SUBMISSIONS = true;

/** Set false to use direct assignment only (no open pool / task requests). */
export const FCFS_POOL_ENABLED = false;

/** Stages that use the FCFS pool when {@link FCFS_POOL_ENABLED} is true. */
export const FCFS_STAGES = [
  'Pickup from Hospital',
  'Billing',
  'Bill Submission',
] as const;

export type FcfsStage = (typeof FCFS_STAGES)[number];

/** Departments allowed to claim each FCFS stage (RTD: Delivery outbound + Drivers for hospital pickup). */
export const FCFS_ELIGIBLE_DEPARTMENTS: Record<FcfsStage, readonly Department[]> = {
  'Pickup from Hospital': ['Delivery', 'Drivers'],
  'Billing': ['Accounts'],
  'Bill Submission': ['Bill Submission'],
};

export function fcfsStagesForEmployeeDepartment(dept: string | null | undefined): FcfsStage[] {
  if (!FCFS_POOL_ENABLED) return [];
  const normalized = normalizeDepartment(dept ?? '');
  if (!normalized) return [];
  return FCFS_STAGES.filter((stage) =>
    (FCFS_ELIGIBLE_DEPARTMENTS[stage] as readonly Department[]).includes(normalized),
  );
}

/** FCFS pool stages this employee can claim (any of their departments). */
export function fcfsStagesForEmployee(emp: Pick<Employee, 'department' | 'departments'>): FcfsStage[] {
  if (!FCFS_POOL_ENABLED) return [];
  const stages = new Set<FcfsStage>();
  for (const dept of getEmployeeDepartments(emp)) {
    for (const stage of fcfsStagesForEmployeeDepartment(dept)) stages.add(stage);
  }
  return FCFS_STAGES.filter((s) => stages.has(s));
}

export function isFcfsStage(stage: WorkflowStage | string): boolean {
  if (!FCFS_POOL_ENABLED) return false;
  return (FCFS_STAGES as readonly string[]).includes(normalizeWorkflowStageName(stage));
}

/** Employee department must be in the FCFS allow-list for that stage. */
export function employeeDepartmentMatchesFcfsStage(
  employeeDept: string | null | undefined,
  stage: WorkflowStage | string,
): boolean {
  const normalized = normalizeDepartment(employeeDept ?? '');
  const stageName = normalizeWorkflowStageName(stage as WorkflowStage);
  if (!normalized || !isFcfsStage(stageName)) return false;
  const eligible = FCFS_ELIGIBLE_DEPARTMENTS[stageName as FcfsStage];
  return (eligible as readonly Department[]).includes(normalized);
}

/** True if any of the employee's departments can claim this FCFS stage. */
export function employeeMatchesFcfsStage(
  emp: Pick<Employee, 'department' | 'departments'>,
  stage: WorkflowStage | string,
): boolean {
  return getEmployeeDepartments(emp).some((d) => employeeDepartmentMatchesFcfsStage(d, stage));
}

export function isFcfsPoolCase(c: ImplantCase): boolean {
  if (!isFcfsStage(c.currentStage)) return false;
  if (c.assignedEmployee) return false;
  // Active = normal pool; Draft = legacy rows advanced before FCFS went live.
  if (c.status !== 'Active' && c.status !== 'Draft') return false;
  if (c.currentStage === 'Completed') return false;
  return true;
}

export function isFcfsClaimedCase(c: ImplantCase): boolean {
  return isFcfsStage(c.currentStage) && Boolean(c.assignedEmployee) && c.status === 'Active';
}

export function canRequestTaskCase(
  c: ImplantCase,
  employee: Pick<Employee, 'id' | 'email' | 'department' | 'departments'>,
): boolean {
  if (!FCFS_POOL_ENABLED) return false;
  if (!isFcfsPoolCase(c)) return false;
  if (!employeeMatchesFcfsStage(employee, c.currentStage)) return false;
  const stageIdx = getStageIndex(c.currentStage);
  const record = stageIdx >= 0 ? c.stages[stageIdx] : undefined;
  if (record?.status === 'Submitted') return false;
  return true;
}

/** @deprecated Use canRequestTaskCase */
export const canClaimCase = canRequestTaskCase;

export function getAvailablePoolCases(
  cases: ImplantCase[],
  employee: Pick<Employee, 'id' | 'email' | 'department' | 'departments'>,
): ImplantCase[] {
  return cases
    .filter((c) => canRequestTaskCase(c, employee))
    .sort((a, b) => {
      const po = { Critical: 0, High: 1, Medium: 2, Low: 3 } as const;
      const p = po[a.priority] - po[b.priority];
      if (p !== 0) return p;
      return new Date(a.surgeryDate).getTime() - new Date(b.surgeryDate).getTime();
    });
}

/** @deprecated Use getAvailablePoolCases */
export const getAvailableFcfsCases = getAvailablePoolCases;

export function countFcfsPoolCases(cases: ImplantCase[], stage?: FcfsStage): number {
  return cases.filter((c) => {
    if (!isFcfsPoolCase(c)) return false;
    if (stage && normalizeWorkflowStageName(c.currentStage) !== stage) return false;
    return true;
  }).length;
}

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
      assistantEmployee: raw.assistantEmployee
        ? {
            ...raw.assistantEmployee,
            department:
              normalizeDepartment(raw.assistantEmployee.department) ??
              raw.assistantEmployee.department,
          }
        : (raw.assistantEmployee ?? null),
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

/** True when the case has moved past the Surgery stage in the workflow. */
export function isPostSurgeryStage(stage: WorkflowStage): boolean {
  const surgeryIdx = getStageIndex('Surgery');
  const idx = getStageIndex(stage);
  return idx > surgeryIdx && stage !== 'Completed';
}

/** Stages shown on the office TV board — Kit Prep through Billing (inclusive). Postponed cases always show. */
const TV_BOARD_STAGES = new Set<WorkflowStage>([
  'Kit Preparation',
  'Delivery',
  'Surgery',
  'Pickup from Hospital',
  'Cleaning & Audit',
  'Restock',
  'Billing',
]);

/**
 * Office TV board: open cases up to Billing, plus postponed. Bill Submission and cancelled cases are excluded.
 */
export function isTvBoardVisibleCase(c: ImplantCase): boolean {
  if (c.status === 'Completed' || c.status === 'Cancelled' || c.currentStage === 'Completed') {
    return false;
  }
  if (c.cancelReason) return false;
  return TV_BOARD_STAGES.has(normalizeWorkflowStageName(c.currentStage));
}

/** Next stage in the workflow. Cancelled cases skip Billing and Bill Submission. */
export function getNextWorkflowStage(
  current: WorkflowStage,
  options?: { skipBilling?: boolean },
): WorkflowStage | null {
  const idx = getStageIndex(current);
  if (idx < 0 || idx >= WORKFLOW_STAGES.length - 1) return null;
  const next = WORKFLOW_STAGES[idx + 1];
  if (options?.skipBilling && (next === 'Billing' || next === 'Bill Submission')) {
    return 'Completed';
  }
  return next;
}

/** Standard case remark when surgery is cancelled and no implants were used. */
export const UNUSED_IMPLANTS_REMARK = 'Implants unused';

export function withUnusedImplantsRemark(existing: string | undefined): string {
  const t = (existing ?? '').trim();
  if (!t) return UNUSED_IMPLANTS_REMARK;
  if (/implants\s+uns[eu]d/i.test(t)) return t;
  return `${t}\n${UNUSED_IMPLANTS_REMARK}`;
}

/**
 * After a surgery cancel (no implants used), unused kits still need to come back.
 * Returns the stage to jump to, or null if the case can close immediately
 * (kit never left Stores, or Restock is already done).
 */
export function returnStageAfterCancel(current: WorkflowStage): WorkflowStage | null {
  const idx = getStageIndex(current);
  const kitIdx = getStageIndex('Kit Preparation');
  const pickupIdx = getStageIndex('Pickup from Hospital');
  const restockIdx = getStageIndex('Restock');
  if (idx > kitIdx && idx < pickupIdx) return 'Pickup from Hospital';
  if (idx >= pickupIdx && idx <= restockIdx) return normalizeWorkflowStageName(current);
  return null;
}

function employeeMatches(
  candidate: Pick<Employee, 'id' | 'email'> | null | undefined,
  employee: Pick<Employee, 'id' | 'email'>,
): boolean {
  if (!candidate) return false;
  if (candidate.id && candidate.id === employee.id) return true;
  if (candidate.email && employee.email) {
    return candidate.email.trim().toLowerCase() === employee.email.trim().toLowerCase();
  }
  return false;
}

export function isCaseAssignedToEmployee(
  implantCase: ImplantCase,
  employee: Pick<Employee, 'id' | 'email'>,
): boolean {
  return employeeMatches(implantCase.assignedEmployee, employee);
}

/** Extra person on the current stage (Delivery / Surgery) — can view, cannot submit. */
export function isCaseAssistantOnCurrentStage(
  implantCase: ImplantCase,
  employee: Pick<Employee, 'id' | 'email'>,
): boolean {
  const rec = findStageRecord(implantCase.stages, implantCase.currentStage);
  return employeeMatches(rec?.assistantEmployee, employee);
}

export function isCaseVisibleToEmployee(
  implantCase: ImplantCase,
  employee: Pick<Employee, 'id' | 'email'>,
): boolean {
  return isCaseAssignedToEmployee(implantCase, employee) || isCaseAssistantOnCurrentStage(implantCase, employee);
}

export function formatAssigneeDisplay(
  primary: Employee | null | undefined,
  assistant: Employee | null | undefined,
): string {
  const p = primary?.name.split(' ')[0];
  const a = assistant?.name.split(' ')[0];
  if (p && a) return `${p} + ${a}`;
  if (p) return p;
  if (a) return `${a} (extra)`;
  return 'Unassigned';
}

export function getCurrentStageTeamDisplay(implantCase: ImplantCase): string {
  const rec = findStageRecord(implantCase.stages, implantCase.currentStage);
  return formatAssigneeDisplay(implantCase.assignedEmployee ?? rec?.assignedEmployee, rec?.assistantEmployee);
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
  employee: Pick<Employee, 'id' | 'email' | 'department'>,
): boolean {
  if (implantCase.currentStage === 'Completed') return false;
  if (implantCase.status === 'Waiting For Approval') return false;
  if (isFcfsPoolCase(implantCase)) return false;
  if (!isCaseAssignedToEmployee(implantCase, employee)) return false;

  const stageIdx = getStageIndex(implantCase.currentStage);
  const currentStageRecord = stageIdx >= 0 ? implantCase.stages[stageIdx] : undefined;
  if (currentStageRecord?.status === 'Submitted') return false;

  if (currentStageRecord?.status === 'Approved') {
    return needsAssignmentReactivation(implantCase, employee);
  }

  return true;
}
