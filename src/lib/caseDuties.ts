import type { Employee, ImplantCase, WorkflowStage } from '../types';
import { findStageRecord, normalizeWorkflowStageName } from './caseWorkflow';
import { isReturnDutySpecialValue } from './returnPickup';

/** After-surgery stages: Return, Clean & audit, Restock (assigned at create or by store manager). */
export type CaseDutyKind = 'return' | 'cleaning' | 'restock';

export interface CaseDutySlot {
  assignedEmployee: Employee | null;
  assignedAt: string | null;
}

export type PostSurgeryDuties = Record<CaseDutyKind, CaseDutySlot>;

export const CASE_DUTY_KINDS: CaseDutyKind[] = ['return', 'cleaning', 'restock'];

export const CASE_DUTY_LABELS: Record<CaseDutyKind, string> = {
  return: 'Return',
  cleaning: 'Clean & audit',
  restock: 'Restock',
};

/** Workflow stage each duty updates on the case (Return → pickup from hospital). */
export const CASE_DUTY_WORKFLOW_STAGE: Record<CaseDutyKind, WorkflowStage> = {
  return: 'Pickup from Hospital',
  cleaning: 'Cleaning & Audit',
  restock: 'Restock',
};

export const CASE_DUTIES_NAV_LABEL = 'Return, clean & restock';

export const CASE_DUTIES_PAGE_TITLE = 'Return, clean & restock';

export const CASE_DUTIES_PAGE_DESCRIPTION =
  'Pick who will do Return, Clean & audit, and Restock on each case. Kit prep through Surgery are chosen when the case is created.';

export const CASE_DUTIES_CREATE_SECTION_TITLE = 'Return, clean & restock (optional)';

export const CASE_DUTIES_CREATE_SECTION_HINT =
  'You can leave these blank — a store manager can assign them later from this screen in the sidebar.';

export function dutyPickerPlaceholder(kind: CaseDutyKind): string {
  return `Select — ${CASE_DUTY_LABELS[kind]}`;
}

/** Single sidebar route for post-surgery assignment. */
export const CASE_DUTIES_TAB_ID = 'case-duties-combined' as const;

export type CaseDutyTabId = typeof CASE_DUTIES_TAB_ID;

const LEGACY_DUTY_TAB_IDS = [
  'case-duties-return',
  'case-duties-pickup',
  'case-duties-cleaning',
  'case-duties-restock',
] as const;

export const CASE_DUTY_TAB_IDS = [CASE_DUTIES_TAB_ID] as const;

export function isCaseDutyTab(tab: string): tab is CaseDutyTabId {
  return tab === CASE_DUTIES_TAB_ID || (LEGACY_DUTY_TAB_IDS as readonly string[]).includes(tab);
}

export function remapLegacyDutyTab(tab: string): string {
  if (tab !== CASE_DUTIES_TAB_ID && isCaseDutyTab(tab)) return CASE_DUTIES_TAB_ID;
  return tab;
}

export function emptyPostSurgeryDuties(): PostSurgeryDuties {
  const slot = (): CaseDutySlot => ({ assignedEmployee: null, assignedAt: null });
  return {
    return: slot(),
    cleaning: slot(),
    restock: slot(),
  };
}

export function normalizePostSurgeryDuties(raw: unknown): PostSurgeryDuties {
  const base = emptyPostSurgeryDuties();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  for (const kind of CASE_DUTY_KINDS) {
    const entry = o[kind];
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    base[kind] = {
      assignedEmployee: (e.assignedEmployee as Employee | null) ?? null,
      assignedAt: (e.assignedAt as string | null) ?? null,
    };
  }
  // Legacy four-slot model: pickupReturn → return if return empty
  const legacyPickup = o.pickupReturn;
  if (!base.return.assignedEmployee && legacyPickup && typeof legacyPickup === 'object') {
    const e = legacyPickup as Record<string, unknown>;
    base.return = {
      assignedEmployee: (e.assignedEmployee as Employee | null) ?? null,
      assignedAt: (e.assignedAt as string | null) ?? null,
    };
  }
  return base;
}

export function getDutyWorkflowStage(kind: CaseDutyKind): WorkflowStage {
  return CASE_DUTY_WORKFLOW_STAGE[kind];
}

/** Person assigned for this duty — from workflow stage, then saved duty snapshot. */
export function getDutyEmployee(c: ImplantCase, kind: CaseDutyKind): Employee | null {
  const stage = CASE_DUTY_WORKFLOW_STAGE[kind];
  const fromStage = findStageRecord(c.stages, stage)?.assignedEmployee;
  if (fromStage) return fromStage;
  return c.postSurgeryDuties?.[kind]?.assignedEmployee ?? null;
}

export function getDutySlot(c: ImplantCase, kind: CaseDutyKind): CaseDutySlot {
  const emp = getDutyEmployee(c, kind);
  const fromJson = c.postSurgeryDuties?.[kind];
  return {
    assignedEmployee: emp,
    assignedAt: fromJson?.assignedAt ?? (emp ? findStageRecord(c.stages, CASE_DUTY_WORKFLOW_STAGE[kind])?.assignedAt ?? null : null),
  };
}

export function isOpenCaseForDutyBoard(c: ImplantCase): boolean {
  return c.status !== 'Completed' && c.status !== 'Cancelled';
}

export function casesForDutyBoard(cases: ImplantCase[]): ImplantCase[] {
  return cases.filter(isOpenCaseForDutyBoard);
}

export function buildPostSurgeryDutiesFromEmployeeIds(
  ids: Partial<Record<CaseDutyKind, string>>,
  employees: Employee[],
): PostSurgeryDuties {
  const duties = emptyPostSurgeryDuties();
  const now = new Date().toISOString();
  for (const kind of CASE_DUTY_KINDS) {
    const id = ids[kind]?.trim();
    if (!id || isReturnDutySpecialValue(id)) continue;
    const emp = employees.find((e) => e.id === id);
    if (!emp) continue;
    duties[kind] = { assignedEmployee: emp, assignedAt: now };
  }
  return duties;
}

export function postSurgerySummaryLine(c: ImplantCase): string {
  return CASE_DUTY_KINDS.map((k) => {
    const name = getDutyEmployee(c, k)?.name?.split(' ')[0] ?? '—';
    return `${CASE_DUTY_LABELS[k]}: ${name}`;
  }).join(' · ');
}

export function stageMatchesDuty(stageName: string, kind: CaseDutyKind): boolean {
  return normalizeWorkflowStageName(stageName as WorkflowStage) === CASE_DUTY_WORKFLOW_STAGE[kind];
}
