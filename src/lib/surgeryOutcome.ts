import type { ActivityLog, Department, Employee, ImplantCase, StageRecord, SurgeryOutcome, WorkflowStage } from '../types';
import { WORKFLOW_STAGES, normalizeCaseStages, normalizeWorkflowStageName } from './caseWorkflow';

/** Cancelled at surgery sits at Billing until admin closes. Parked completes immediately. */
export function isSurgeryAwaitingAdminClose(c: ImplantCase): boolean {
  if (c.status === 'Completed' || c.status === 'Cancelled') return false;
  return c.surgeryOutcome === 'cancelled';
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

/** Cancelled at surgery: approve Surgery, skip Pickup→Restock, land on Billing. */
export function buildAdvanceToBillingAfterSurgeryCancelled(
  c: ImplantCase,
  opts: {
    now: string;
    notes: string;
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
  const skipNote = 'Skipped — surgery cancelled. Case moved to Billing.';
  const autoNotes = `Auto-advanced to Billing after surgery cancelled by ${opts.uploadedBy}.`;
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
    action: 'Advanced to Billing: Surgery Cancelled',
    performedBy: opts.uploadedBy,
    performedByRole: 'employee',
    timestamp: opts.now,
    details: `Surgery cancelled. Skipped Pickup, Cleaning & Audit, Restock. Case at Billing.${opts.outcomeDetail ? ` ${opts.outcomeDetail}` : ''}`,
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

/** Parked at surgery: approve Surgery and complete the case, skipping all remaining stages. */
export function buildCompleteCaseAfterSurgeryParked(
  c: ImplantCase,
  opts: {
    now: string;
    notes: string;
    outcomeDetail: string;
    uploadedBy: string;
  },
): {
  stages: StageRecord[];
  currentStage: 'Completed';
  currentDepartment: null;
  assignedEmployee: null;
  status: 'Completed';
  advanceLog: ActivityLog;
  closeLog: ActivityLog;
} {
  const surgeryIdx = WORKFLOW_STAGES.indexOf('Surgery');
  const skipNote = 'Skipped — surgery parked. Case completed.';
  const autoNotes = `Case completed after surgery parked by ${opts.uploadedBy}.`;

  const updatedStages = normalizeCaseStages(
    c.stages.map((s, i) => {
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
      if (i > surgeryIdx) {
        return {
          ...s,
          status: 'Approved' as const,
          approvedAt: s.approvedAt ?? opts.now,
          adminNotes: skipNote,
        };
      }
      return s;
    }),
  );

  const advanceLog: ActivityLog = {
    id: `log-${Date.now()}-adv`,
    caseId: c.id,
    action: 'Surgery: Parked — Case Completed',
    performedBy: opts.uploadedBy,
    performedByRole: 'employee',
    timestamp: opts.now,
    details: `Surgery parked. All remaining stages skipped and case completed.${opts.outcomeDetail ? ` Notes: ${opts.outcomeDetail}` : ''}`,
  };

  const closeLog: ActivityLog = {
    id: `log-${Date.now()}-close`,
    caseId: c.id,
    action: 'Case Closed',
    performedBy: opts.uploadedBy,
    performedByRole: 'employee',
    timestamp: opts.now,
    details: `Case closed as Completed after surgery parked.${opts.outcomeDetail ? ` ${opts.outcomeDetail}` : ''}`,
  };

  return {
    stages: updatedStages,
    currentStage: 'Completed',
    currentDepartment: null,
    assignedEmployee: null,
    status: 'Completed',
    advanceLog,
    closeLog,
  };
}
