import type { Employee, Priority } from '../types';
import { shouldDefaultPreparationToCurrentUser } from './assignableEmployees';
import {
  ASSIGNABLE_WORKFLOW_STAGES,
  SURGERY_SELF_ASSIGNMENT_VALUE,
  isFcfsStage,
  type AssignableStage,
  type StageAssignments,
  type StageAssistantAssignments,
  type StageWithAssistant,
} from './caseWorkflow';
import {
  buildPostSurgeryDutiesFromEmployeeIds,
  CASE_DUTY_KINDS,
  CASE_DUTY_WORKFLOW_STAGE,
  type CaseDutyKind,
} from './caseDuties';
import type { Hospital } from '../types';
import type { StageWithAssistant } from './caseWorkflow';
import type { SurgeryDateMode } from '../components/SurgeryDateQuickPick';
import { normalizeCaseTextFields } from './textFormat';

function emptyStageAssistantIds(): Record<StageWithAssistant, string> {
  return { Delivery: '', Surgery: '' };
}

function emptyStageExtraFlags(): Record<StageWithAssistant, boolean> {
  return { Delivery: false, Surgery: false };
}

export const QUICK_CASE_ASSIGN_STAGES: AssignableStage[] = ['Set Preparation', 'Delivery', 'Surgery'];

export type CreateCaseDraft = {
  hospitalId: string;
  doctorName: string;
  surgeryDate: string;
  surgeryDateMode: SurgeryDateMode;
  implantRequired: string;
  implantType: string;
  implantCompany: string;
  priority: Priority;
  remarks: string;
  startStage: AssignableStage;
  stageEmployeeIds: Record<AssignableStage, string>;
  stageAssistantIds: ReturnType<typeof emptyStageAssistantIds>;
  stageExtraPerson: ReturnType<typeof emptyStageExtraFlags>;
  dutyEmployeeIds: Record<CaseDutyKind, string>;
};

export function emptyCreateCaseDraft(startStage: AssignableStage = 'Set Preparation'): CreateCaseDraft {
  const stageEmployeeIds = Object.fromEntries(
    ASSIGNABLE_WORKFLOW_STAGES.map((s) => [s, '']),
  ) as Record<AssignableStage, string>;
  return {
    hospitalId: '',
    doctorName: '',
    surgeryDate: '',
    surgeryDateMode: 'today',
    implantRequired: '',
    implantType: '',
    implantCompany: '',
    priority: 'Medium',
    remarks: '',
    startStage,
    stageEmployeeIds,
    stageAssistantIds: emptyStageAssistantIds(),
    stageExtraPerson: emptyStageExtraFlags(),
    dutyEmployeeIds: Object.fromEntries(CASE_DUTY_KINDS.map((k) => [k, ''])) as Record<
      CaseDutyKind,
      string
    >,
  };
}

export function buildCreateCasePayload(
  form: CreateCaseDraft,
  hospitals: Hospital[],
  employees: Employee[],
  currentUser?: Employee | null,
): {
  hospital: Hospital;
  doctor: { id: string; name: string; specialization: string; hospitalId: string; phone: string };
  surgeryDate: string;
  implantRequired: string;
  implantType: string;
  implantCompany: string;
  priority: Priority;
  remarks: string;
  dueDate: string;
  startStage: AssignableStage;
  stageAssignments: StageAssignments;
  stageAssistantAssignments: StageAssistantAssignments;
  surgerySelfPerformed: boolean;
  postSurgeryDuties: ReturnType<typeof buildPostSurgeryDutiesFromEmployeeIds>;
} {
  const hospital = hospitals.find((h) => h.id === form.hospitalId);
  if (!hospital) throw new Error('Hospital not found. Pick the hospital again.');

  const text = normalizeCaseTextFields({
    doctorName: form.doctorName,
    implantRequired: form.implantRequired,
    implantType: form.implantType,
    implantCompany: form.implantCompany,
    remarks: form.remarks,
  });

  const startIdx = ASSIGNABLE_WORKFLOW_STAGES.indexOf(form.startStage);
  const activeStages = ASSIGNABLE_WORKFLOW_STAGES.slice(startIdx);

  const doctor = {
    id: `doc-${Date.now()}`,
    name: text.doctorName ?? '',
    specialization: 'Surgeon',
    hospitalId: hospital.id,
    phone: '',
  };

  const surgerySelfPerformed = form.stageEmployeeIds.Surgery === SURGERY_SELF_ASSIGNMENT_VALUE;
  const stageEmployeeIds = { ...form.stageEmployeeIds };
  if (
    currentUser &&
    shouldDefaultPreparationToCurrentUser(
      form.startStage,
      Boolean(stageEmployeeIds['Set Preparation']),
      currentUser,
    )
  ) {
    stageEmployeeIds['Set Preparation'] = currentUser.id;
  }

  const stageAssignments: StageAssignments = {};
  for (const stage of activeStages) {
    if (isFcfsStage(stage)) continue;
    if (stage === 'Surgery' && surgerySelfPerformed) continue;
    const empId = stageEmployeeIds[stage];
    if (!empId) continue;
    const emp =
      employees.find((e) => e.id === empId) ??
      (currentUser && empId === currentUser.id ? currentUser : undefined);
    if (!emp) throw new Error(`Could not find employee for ${stage}. Please reselect.`);
    stageAssignments[stage] = emp;
  }

  const stageAssistantAssignments: StageAssistantAssignments = {};
  for (const stage of ['Delivery', 'Surgery'] as const) {
    if (!activeStages.includes(stage)) continue;
    if (!form.stageExtraPerson[stage]) continue;
    const assistantId = form.stageAssistantIds[stage];
    if (!assistantId) {
      throw new Error(`Please pick an extra person for ${stage}, or uncheck Extra person required.`);
    }
    const assistant = employees.find((e) => e.id === assistantId);
    if (!assistant) {
      throw new Error(`Could not find extra person for ${stage}. Please reselect.`);
    }
    const primaryId = form.stageEmployeeIds[stage];
    if (primaryId && assistantId === primaryId) {
      throw new Error(`Extra person for ${stage} must be different from the primary assignee.`);
    }
    stageAssistantAssignments[stage] = assistant;
  }

  for (const kind of CASE_DUTY_KINDS) {
    const workflowStage = CASE_DUTY_WORKFLOW_STAGE[kind];
    if (!activeStages.includes(workflowStage)) continue;
    if (stageAssignments[workflowStage]) continue;
    const empId = form.dutyEmployeeIds[kind]?.trim();
    if (!empId) continue;
    const emp = employees.find((e) => e.id === empId);
    if (emp) stageAssignments[workflowStage] = emp;
  }

  return {
    hospital,
    doctor,
    surgeryDate: form.surgeryDate,
    implantRequired: text.implantRequired ?? '',
    implantType: text.implantType ?? '',
    implantCompany: text.implantCompany ?? '',
    priority: form.priority,
    remarks: text.remarks ?? '',
    dueDate: form.surgeryDate,
    startStage: form.startStage,
    stageAssignments,
    stageAssistantAssignments,
    surgerySelfPerformed,
    postSurgeryDuties: buildPostSurgeryDutiesFromEmployeeIds(form.dutyEmployeeIds, employees),
  };
}
