import type { ActivityLog, Department, Employee, ImplantCase, StageRecord, SurgeryOutcome, WorkflowStage } from '../types';
import { WORKFLOW_STAGES, normalizeCaseStages, normalizeWorkflowStageName } from './caseWorkflow';

export function isSurgeryAwaitingAdminClose(c: ImplantCase): boolean {
  if (c.status === 'Completed' || c.status === 'Cancelled') return false;
  return c.surgeryOutcome === 'cancelled' || c.surgeryOutcome === 'parked';
}

export function getSurgeryOutcomeLabel(outcome: SurgeryOutcome | '' | undefined): string | null {
  if (outcome === 'parked') return 'Parked';
  if (outcome === 'cancelled') return 'Cancelled';
  return null;
}

/** Stage badge text — shows Parked/Cancelled on Surgery when applicable. */
export function getStageStatusLabel(stage: StageRecord, implantCase: ImplantCase): string {
  if (stage.stage === 'Surgery' && implantCase.surgeryOutcome) {
    return getSurgeryOutcomeLabel(implantCase.surgeryOutcome) ?? stage.status;
  }
  return stage.status;
}

export function surgeryOutcomeLogAction(outcome: SurgeryOutcome): string {
  return outcome === 'parked' ? 'Surgery: Parked' : 'Surgery: Cancelled';
}

const STAGES_SKIPPED_TO_BILLING: WorkflowStage[] = [
  'Pickup from Hospital',
  'Cleaning & Audit',
  'Restock',
];

/** After scrub marks cancelled/parked: approve Surgery, skip Pickup→Restock, land on Billing. */
export function buildAdvanceToBillingAfterSurgeryOutcome(
  c: ImplantCase,
  opts: {
    now: string;
    notes: string;
    outcome: SurgeryOutcome;
    outcomeDetail: string;
    uploadedBy: string;
  },
): {
  stages: StageRecord[];
  currentStage: 'Billing';
  currentDepartment: Department;
  assignedEmployee: Employee | null;
  status: ImplantCase['status'];
  advanceLog: ActivityLog;
} {
  const surgeryIdx = WORKFLOW_STAGES.indexOf('Surgery');
  const billingIdx = WORKFLOW_STAGES.indexOf('Billing');
  const outcomeLabel = getSurgeryOutcomeLabel(opts.outcome) ?? opts.outcome;
  const skipNote = `Skipped — surgery ${outcomeLabel.toLowerCase()}. Case moved to Billing.`;
  const autoNotes = `Auto-advanced to Billing after surgery ${outcomeLabel.toLowerCase()} by ${opts.uploadedBy}.`;

  const skipNames = new Set(STAGES_SKIPPED_TO_BILLING.map(normalizeWorkflowStageName));

  let billingEmp: Employee | null = null;
  const updatedStages = normalizeCaseStages(
    c.stages.map((s, i) => {
      const name = normalizeWorkflowStageName(s.stage);
      if (i === surgeryIdx) {
        return {
          ...s,
          status: 'Approved' as const,
          submittedAt: opts.now,
          approvedAt: opts.now,
          notes: opts.notes.trim() || opts.outcomeDetail,
          adminNotes: autoNotes,
        };
      }
      if (skipNames.has(name)) {
        return {
          ...s,
          status: 'Approved' as const,
          approvedAt: s.approvedAt ?? opts.now,
          adminNotes: skipNote,
        };
      }
      if (i === billingIdx) {
        billingEmp = s.assignedEmployee ?? null;
        if (billingEmp) {
          return {
            ...s,
            assignedEmployee: billingEmp,
            assignedAt: s.assignedAt ?? opts.now,
            status: 'Assigned' as const,
          };
        }
        return {
          ...s,
          assignedEmployee: null,
          assignedAt: null,
          status: 'Pending' as const,
        };
      }
      return s;
    }),
  );

  const advanceLog: ActivityLog = {
    id: `log-${Date.now()}-adv`,
    caseId: c.id,
    action: `Advanced to Billing: Surgery ${outcomeLabel}`,
    performedBy: opts.uploadedBy,
    performedByRole: 'employee',
    timestamp: opts.now,
    details: `Surgery ${outcomeLabel.toLowerCase()}. Skipped Pickup, Cleaning & Audit, Restock. Case at Billing.${opts.outcomeDetail ? ` ${opts.outcomeDetail}` : ''}`,
  };

  return {
    stages: updatedStages,
    currentStage: 'Billing',
    currentDepartment: 'Accounts',
    assignedEmployee: billingEmp,
    status: billingEmp ? 'Active' : 'Draft',
    advanceLog,
  };
}
