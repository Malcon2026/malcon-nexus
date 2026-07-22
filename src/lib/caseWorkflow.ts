import type { Employee, ImplantCase, WorkflowStage } from '../types';

export const WORKFLOW_STAGES: WorkflowStage[] = [
  'Kit Preparation',
  'Delivery',
  'Surgery',
  'Cleaning',
  'Audit',
  'Billing',
  'Bill Submission',
  'Completed',
];

export function getStageIndex(stage: WorkflowStage): number {
  return WORKFLOW_STAGES.indexOf(stage);
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
