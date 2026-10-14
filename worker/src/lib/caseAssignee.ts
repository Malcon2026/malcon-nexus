/** Ports PostgreSQL helpers from sync-case-header-from-stages.sql */

type StageElem = {
  stage?: string;
  status?: string;
  assignedEmployee?: { id?: string; name?: string };
  assistantEmployee?: { id?: string };
};

const OPEN_STATUSES = new Set([
  'Pending',
  'Assigned',
  'In Progress',
  'Changes Requested',
  'Rejected',
  'Submitted',
]);

export function parseStagesJson(stagesJson: string): StageElem[] {
  try {
    return JSON.parse(stagesJson) as StageElem[];
  } catch {
    return [];
  }
}

export function employeeIsAssigneeOnOpenStage(stagesJson: string, empId: string | null): boolean {
  if (!empId) return false;
  return parseStagesJson(stagesJson).some(
    (elem) =>
      elem.assignedEmployee?.id === empId &&
      OPEN_STATUSES.has(elem.status ?? 'Pending'),
  );
}

export function employeeIsAssigneeOnStages(stagesJson: string, empId: string | null): boolean {
  if (!empId) return false;
  return parseStagesJson(stagesJson).some(
    (elem) =>
      elem.assignedEmployee?.id === empId || elem.assistantEmployee?.id === empId,
  );
}
