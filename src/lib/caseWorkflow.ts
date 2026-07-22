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
  if (assignee.id === employee.id) return true;
  if (assignee.email && employee.email) {
    return assignee.email.trim().toLowerCase() === employee.email.trim().toLowerCase();
  }
  return false;
}

/** Case stuck after approve+assign race: advanced stage + assignee but case still Approved. */
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
  if (!currentStageRecord || currentStageRecord.status === 'Submitted') return false;

  if (currentStageRecord.status === 'Assigned') return true;

  if (
    currentStageRecord.status === 'Approved' &&
    stageIdx > 0 &&
    implantCase.stages[stageIdx - 1]?.status === 'Approved'
  ) {
    return true;
  }

  return false;
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

  if (implantCase.status === 'Active') return true;
  if (implantCase.status === 'Changes Requested') return true;

  if (needsAssignmentReactivation(implantCase, employee)) return true;

  if (!currentStageRecord) return false;

  return (
    currentStageRecord.status === 'Assigned' ||
    currentStageRecord.status === 'In Progress' ||
    currentStageRecord.status === 'Changes Requested'
  );
}
