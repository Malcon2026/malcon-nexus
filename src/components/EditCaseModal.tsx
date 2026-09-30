import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useStore } from '../store/useStore';
import type { ImplantCase } from '../types';
import {
  ASSIGNABLE_WORKFLOW_STAGES,
  SURGERY_SELF_ASSIGNMENT_VALUE,
  findStageRecord,
  isCaseAssignedToEmployee,
  stageSupportsAssistant,
  type AssignableStage,
  type StageWithAssistant,
} from '../lib/caseWorkflow';
import { stageAssistantsFromCase, stageExtraFlagsFromCase } from './StageExtraPersonFields';
import { NEXUS_FORM_CONTROL } from '../constants/formStyles';
import { isStoreManager } from '../lib/roles';
import { listEmployeesForCaseAssignment } from '../lib/assignableEmployees';
import { normalizeSentenceText } from '../lib/textFormat';
import { getTodaySurgeryDateKey, getTomorrowSurgeryDateKey, type SurgeryDateMode } from './SurgeryDateQuickPick';
import {
  CASE_DUTY_KINDS,
  CASE_DUTY_WORKFLOW_STAGE,
  getDutyEmployee,
  type CaseDutyKind,
} from '../lib/caseDuties';
import { QUICK_CASE_ASSIGN_STAGES } from '../lib/createCaseFromDraft';
import { formatHospitalLabel } from './HospitalSearchSelect';
import { cn } from '../utils/cn';
import { SurgeryStep } from './case-create/SurgeryStep';
import { TeamStep, type TeamActions, type TeamFormFields } from './case-create/TeamStep';
import { HospitalPickerSheet } from './case-create/HospitalPickerSheet';
import { PickerSheet } from './case-create/PickerSheet';
import { hospitalSubtitle } from './case-create/caseCreateHelpers';

interface EditCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  case: ImplantCase;
}

const PRE_SURGERY_STAGES = QUICK_CASE_ASSIGN_STAGES;
const PAYMENT_STATUSES = ['Pending', 'Partial', 'Collected'] as const;

const emptyStageIds = (): Record<AssignableStage, string> =>
  Object.fromEntries(ASSIGNABLE_WORKFLOW_STAGES.map((s) => [s, ''])) as Record<
    AssignableStage,
    string
  >;

function inferSurgeryDateMode(dateKey: string): SurgeryDateMode {
  const key = dateKey || getTodaySurgeryDateKey();
  if (key === getTodaySurgeryDateKey()) return 'today';
  if (key === getTomorrowSurgeryDateKey()) return 'tomorrow';
  return 'custom';
}

function stageAssignmentsFromCase(c: ImplantCase): Record<AssignableStage, string> {
  const result = emptyStageIds();
  for (const stage of ASSIGNABLE_WORKFLOW_STAGES) {
    const rec = findStageRecord(c.stages, stage);
    if (rec?.selfPerformed) {
      result[stage] = SURGERY_SELF_ASSIGNMENT_VALUE;
    } else if (rec?.assignedEmployee?.id) {
      result[stage] = rec.assignedEmployee.id;
    }
  }
  for (const kind of CASE_DUTY_KINDS) {
    const stage = CASE_DUTY_WORKFLOW_STAGE[kind] as AssignableStage;
    const emp = getDutyEmployee(c, kind);
    if (emp?.id) result[stage] = emp.id;
  }
  return result;
}

function formFromCase(c: ImplantCase) {
  return {
    hospitalId: c.hospital.id,
    doctorName: c.doctor.name,
    surgeryDate: c.surgeryDate,
    surgeryDateMode: inferSurgeryDateMode(c.surgeryDate),
    implantRequired: c.implantRequired,
    implantType: c.implantType,
    implantCompany: c.implantCompany || '',
    priority: c.priority,
    remarks: c.remarks || '',
    invoiceAmount: c.invoiceAmount != null ? String(c.invoiceAmount) : '',
    collectedAmount: c.collectedAmount != null ? String(c.collectedAmount) : '',
    paymentStatus: (c.paymentStatus || 'Pending') as (typeof PAYMENT_STATUSES)[number],
  };
}

const sectionTitle = 'text-base font-semibold text-gray-900 mb-4';
const fieldLabel = 'block text-sm font-semibold text-gray-900 mb-2';

/**
 * Edit case — one simple screen (Surgery + Team), using the same pickers as Add Case.
 * Saving still goes through `updateCase` and `updateCaseStageAssignments`, unchanged.
 */
export const EditCaseModal: React.FC<EditCaseModalProps> = ({ isOpen, onClose, case: c }) => {
  const { updateCase, updateCaseStageAssignments, hospitals, employees, viewMode, currentUser, cases, doctors } =
    useStore();
  const isFullAdmin = viewMode === 'admin';
  const isAdmin = viewMode === 'admin' || viewMode === 'store_manager';
  const isOwnCase = !isAdmin && isCaseAssignedToEmployee(c, currentUser);

  const [form, setForm] = useState(() => formFromCase(c));
  const [stageEmployeeIds, setStageEmployeeIds] = useState(() => stageAssignmentsFromCase(c));
  const [stageAssistantIds, setStageAssistantIds] = useState(() => stageAssistantsFromCase(c.stages));
  const [stageExtraPerson, setStageExtraPerson] = useState(() => stageExtraFlagsFromCase(c.stages));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hospitalOpen, setHospitalOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const procedureRef = useRef<HTMLInputElement>(null);
  const snapshotRef = useRef('');

  const activeEmployees = useMemo(
    () => listEmployeesForCaseAssignment(employees, { alwaysInclude: currentUser }),
    [employees, currentUser],
  );

  const initialStageIds = useMemo(() => stageAssignmentsFromCase(c), [c.id, c.updatedAt]);
  const initialAssistantIds = useMemo(() => stageAssistantsFromCase(c.stages), [c.id, c.updatedAt]);

  useEffect(() => {
    if (!isOpen) return;
    const nextForm = formFromCase(c);
    const nextStages = stageAssignmentsFromCase(c);
    const nextAssistants = stageAssistantsFromCase(c.stages);
    const nextExtra = stageExtraFlagsFromCase(c.stages);
    setError(null);
    setLeaveOpen(false);
    setForm(nextForm);
    setStageEmployeeIds(nextStages);
    setStageAssistantIds(nextAssistants);
    setStageExtraPerson(nextExtra);
    snapshotRef.current = JSON.stringify([nextForm, nextStages, nextAssistants, nextExtra]);
  }, [isOpen, c.id, c.updatedAt]);

  const isDirty =
    JSON.stringify([form, stageEmployeeIds, stageAssistantIds, stageExtraPerson]) !== snapshotRef.current;

  const requestClose = () => {
    if (submitting) return;
    if (isDirty) setLeaveOpen(true);
    else onClose();
  };

  const hospital = hospitals.find((h) => h.id === form.hospitalId);
  const allowPrepAssignToMe =
    isStoreManager(currentUser.role) || (currentUser.role as string) === 'case_manager';

  // People already on the case stay visible even if they are no longer in the active list.
  const teamPool = useMemo(() => {
    const ids = new Set([...Object.values(stageEmployeeIds), ...Object.values(stageAssistantIds)].filter(Boolean));
    const have = new Set(activeEmployees.map((e) => e.id));
    return [...activeEmployees, ...employees.filter((e) => ids.has(e.id) && !have.has(e.id))];
  }, [activeEmployees, employees, stageEmployeeIds, stageAssistantIds]);

  const teamForm: TeamFormFields = {
    startStage: 'Set Preparation',
    stageEmployeeIds,
    stageAssistantIds,
    stageExtraPerson,
    dutyEmployeeIds: Object.fromEntries(
      CASE_DUTY_KINDS.map((k) => [k, stageEmployeeIds[CASE_DUTY_WORKFLOW_STAGE[k] as AssignableStage] ?? '']),
    ) as Record<CaseDutyKind, string>,
    punchedInByEmployeeId: '',
  };

  const teamActions: TeamActions = {
    setStageEmployee: (stage, value) => {
      setStageEmployeeIds((prev) => ({ ...prev, [stage]: value }));
      if (stageSupportsAssistant(stage)) {
        const key = stage as StageWithAssistant;
        if (value && stageAssistantIds[key] === value) {
          setStageAssistantIds((prev) => ({ ...prev, [key]: '' }));
          setStageExtraPerson((prev) => ({ ...prev, [key]: false }));
        }
      }
    },
    setAssistant: (stage, employeeId) => {
      setStageAssistantIds((prev) => ({ ...prev, [stage]: employeeId }));
      setStageExtraPerson((prev) => ({ ...prev, [stage]: Boolean(employeeId) }));
    },
    setDuty: (kind, value) =>
      setStageEmployeeIds((prev) => ({ ...prev, [CASE_DUTY_WORKFLOW_STAGE[kind]]: value })),
    setStartStage: () => {},
    setPunchedInBy: () => {},
  };

  const stageBadges = Object.fromEntries(
    PRE_SURGERY_STAGES.map((stage) => {
      const isCurrent = stage === c.currentStage;
      const isDone = findStageRecord(c.stages, stage)?.status === 'Approved';
      return [stage, isCurrent ? 'Current' : isDone ? 'Done' : undefined];
    }),
  );

  const validate = (): { message: string; focusProcedure?: boolean } | null => {
    if (!form.hospitalId) return { message: 'Select a hospital to save.' };
    if (!form.surgeryDate) return { message: 'Choose the surgery date to save.' };
    if (!form.doctorName.trim()) return { message: 'Select or add the doctor to save.' };
    if (!form.implantRequired.trim()) return { message: 'Enter the procedure to save.', focusProcedure: true };
    return null;
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) {
      setError(problem.message);
      if (problem.focusProcedure) window.setTimeout(() => procedureRef.current?.focus(), 50);
      return;
    }

    const hospitalRow = hospitals.find((h) => h.id === form.hospitalId);
    if (!hospitalRow) return;

    const doctor = {
      id: c.doctor.id.startsWith('doc-') ? c.doctor.id : `doc-${Date.now()}`,
      name: form.doctorName.trim(),
      specialization: 'Surgeon',
      hospitalId: hospitalRow.id,
      phone: '',
    };

    const stageDraft: Partial<Record<AssignableStage, string>> = {};
    for (const stage of ASSIGNABLE_WORKFLOW_STAGES) {
      if (stageEmployeeIds[stage] !== initialStageIds[stage]) {
        stageDraft[stage] = stageEmployeeIds[stage];
      }
    }

    const assistantDraft: Partial<Record<StageWithAssistant, string>> = {};
    for (const stage of ['Delivery', 'Surgery'] as const) {
      const wantsExtra = stageExtraPerson[stage];
      const assistantId = wantsExtra ? stageAssistantIds[stage] : '';
      if (!wantsExtra && !initialAssistantIds[stage]) continue;
      if (assistantId !== initialAssistantIds[stage]) {
        if (wantsExtra && !assistantId) {
          setError(`Please pick an assistant for ${stage}, or remove the assistant.`);
          return;
        }
        assistantDraft[stage] = assistantId;
      }
    }

    for (const stage of ['Delivery', 'Surgery'] as const) {
      if (!stageExtraPerson[stage]) continue;
      const primaryId = stageEmployeeIds[stage];
      const assistantId = stageAssistantIds[stage];
      if (primaryId && assistantId && primaryId === assistantId) {
        setError(`The ${stage} assistant must be a different person from the main assignee.`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      await updateCase(c.id, {
        hospital: hospitalRow,
        doctor,
        surgeryDate: form.surgeryDate,
        implantRequired: form.implantRequired,
        implantType: form.implantType,
        implantCompany: form.implantCompany,
        priority: form.priority,
        remarks: form.remarks,
        dueDate: form.surgeryDate,
        ...(isFullAdmin
          ? {
              invoiceAmount: form.invoiceAmount === '' ? undefined : Number(form.invoiceAmount),
              collectedAmount: form.collectedAmount === '' ? undefined : Number(form.collectedAmount),
              paymentStatus: form.paymentStatus,
            }
          : {}),
      });

      if (Object.keys(stageDraft).length > 0 || Object.keys(assistantDraft).length > 0) {
        const { error: teamError } = await updateCaseStageAssignments(
          c.id,
          stageDraft,
          Object.keys(assistantDraft).length > 0 ? assistantDraft : undefined,
        );
        if (teamError) {
          setError(teamError);
          return;
        }
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmployeeRemarksSave = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await updateCase(c.id, { remarks: form.remarks });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = `${NEXUS_FORM_CONTROL} text-base min-h-[48px]`;

  if (!isAdmin && !isOwnCase) return null;

  if (!isAdmin) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Update notes"
        subtitle={`Case ${c.caseNumber}`}
        size="md"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => void handleEmployeeRemarksSave()} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        {error && (
          <p className="mb-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
        )}
        <textarea
          className={`${inputClass} resize-none min-h-[120px] py-3`}
          rows={4}
          placeholder="Notes for the team…"
          value={form.remarks}
          onChange={(e) => setForm({ ...form, remarks: e.target.value })}
          onBlur={(e) => setForm({ ...form, remarks: normalizeSentenceText(e.target.value) })}
          autoFocus
        />
      </Modal>
    );
  }

  const hospitalSub = hospital ? hospitalSubtitle(hospital) : '';

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={requestClose}
        title="Edit case"
        subtitle={`${c.caseNumber} · currently at ${c.currentStage}`}
        size="screen"
        dismissOnBackdrop={false}
        bodyClassName="flex flex-col min-h-0 bg-gradient-to-b from-gray-50/80 to-white"
        footer={
          <div className="mx-auto w-full max-w-2xl lg:max-w-5xl">
            <div className="flex flex-col gap-3 pb-[env(safe-area-inset-bottom)]">
              {error ? (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </p>
              ) : null}
              <Button
                type="button"
                variant="primary"
                loading={submitting}
                disabled={submitting}
                className="min-h-[56px] w-full justify-center text-base font-semibold"
                onClick={() => void handleSave()}
              >
                {submitting ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-5 sm:py-8 lg:max-w-5xl">
            <div className="space-y-10 lg:grid lg:grid-cols-2 lg:gap-12 lg:space-y-0">
              {/* Surgery */}
              <section aria-labelledby="ec-surgery" className="space-y-7">
                <h2 id="ec-surgery" className={sectionTitle + ' !mb-0'}>
                  Surgery
                </h2>

                <div>
                  <span className={fieldLabel}>Hospital</span>
                  <button
                    type="button"
                    onClick={() => setHospitalOpen(true)}
                    aria-haspopup="dialog"
                    className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-accent)] bg-white px-4 min-h-[60px] py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-gray-900">
                        {hospital ? formatHospitalLabel(hospital) : 'Select hospital'}
                      </span>
                      {hospitalSub ? <span className="block truncate text-xs text-gray-500">{hospitalSub}</span> : null}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
                  </button>
                </div>

                <SurgeryStep
                  form={form}
                  patch={(partial) => setForm((f) => ({ ...f, ...partial }))}
                  hospital={hospital}
                  cases={cases}
                  doctors={doctors}
                  isAdmin={isFullAdmin}
                  error={null}
                  openDoctorSignal={0}
                  procedureRef={procedureRef}
                  onSubmitFromKeyboard={() => {}}
                />

                {c.remarks?.trim() ? (
                  <div>
                    <label htmlFor="ec-notes" className={fieldLabel}>
                      Notes
                    </label>
                    <textarea
                      id="ec-notes"
                      className={`${inputClass} resize-none min-h-[88px] py-3`}
                      rows={3}
                      value={form.remarks}
                      onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                      onBlur={(e) => setForm({ ...form, remarks: normalizeSentenceText(e.target.value) })}
                    />
                  </div>
                ) : null}
              </section>

              {/* Team */}
              <section aria-labelledby="ec-team" className="space-y-4">
                <h2 id="ec-team" className={sectionTitle + ' !mb-0'}>
                  Team
                </h2>
                <p className="text-sm text-gray-500">People who are newly assigned are notified automatically.</p>
                <TeamStep
                  mode="edit"
                  form={teamForm}
                  actions={teamActions}
                  employees={teamPool}
                  currentUser={currentUser}
                  isAdmin={isFullAdmin}
                  allowAssistants={isFullAdmin}
                  allowReturnSpecial={false}
                  allowPrepAssignToMe={allowPrepAssignToMe}
                  badges={stageBadges}
                />
              </section>
            </div>

            {/* Billing — full admin only */}
            {isFullAdmin ? (
              <section className="mt-10 rounded-2xl border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => setBillingOpen((v) => !v)}
                  aria-expanded={billingOpen}
                  aria-controls="ec-billing"
                  className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 min-h-[56px] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                >
                  <span className="text-sm font-semibold text-gray-900">
                    Billing <span className="font-normal text-gray-500">— optional</span>
                  </span>
                  <ChevronDown
                    className={cn('h-5 w-5 text-gray-400 transition-transform', billingOpen && 'rotate-180')}
                    aria-hidden
                  />
                </button>
                {billingOpen ? (
                  <div id="ec-billing" className="space-y-4 border-t border-gray-100 p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="ec-invoice" className={fieldLabel}>
                          Invoice
                        </label>
                        <input
                          id="ec-invoice"
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          className={inputClass}
                          value={form.invoiceAmount}
                          onChange={(e) => setForm({ ...form, invoiceAmount: e.target.value })}
                        />
                      </div>
                      <div>
                        <label htmlFor="ec-collected" className={fieldLabel}>
                          Collected
                        </label>
                        <input
                          id="ec-collected"
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          className={inputClass}
                          value={form.collectedAmount}
                          onChange={(e) => setForm({ ...form, collectedAmount: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <span className={fieldLabel}>Payment status</span>
                      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment status">
                        {PAYMENT_STATUSES.map((status) => {
                          const active = form.paymentStatus === status;
                          return (
                            <button
                              key={status}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => setForm({ ...form, paymentStatus: status })}
                              className={cn(
                                'flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition-colors',
                                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1',
                                active
                                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-gray-900'
                                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                              )}
                            >
                              {active ? <Check className="h-4 w-4 text-[var(--color-accent)]" aria-hidden /> : null}
                              {status}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      </Modal>

      <HospitalPickerSheet
        isOpen={hospitalOpen}
        onClose={() => setHospitalOpen(false)}
        hospitals={hospitals}
        cases={cases}
        value={form.hospitalId}
        onSelect={(hospitalId) => setForm((f) => ({ ...f, hospitalId }))}
      />

      <PickerSheet
        isOpen={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="Discard changes?"
        subtitle="Your edits to this case will not be saved."
        size="sm"
        hideClose
        footer={
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="primary"
              className="min-h-[52px] w-full justify-center text-base font-semibold"
              onClick={() => setLeaveOpen(false)}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[52px] w-full justify-center text-base text-red-700"
              onClick={() => {
                setLeaveOpen(false);
                onClose();
              }}
            >
              Discard
            </Button>
          </div>
        }
      >
        <div className="h-1" />
      </PickerSheet>
    </>
  );
};
