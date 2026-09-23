import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Calendar, CheckCircle2, ClipboardList, Stethoscope, Users } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { EmployeeSearchSelect } from './EmployeeSearchSelect';
import { HospitalSearchSelect } from './HospitalSearchSelect';
import { PriorityQuickPick } from './PriorityQuickPick';
import {
  SurgeryDateQuickPick,
  getTodaySurgeryDateKey,
  getTomorrowSurgeryDateKey,
  type SurgeryDateMode,
} from './SurgeryDateQuickPick';
import { useStore } from '../store/useStore';
import type { ImplantCase } from '../types';
import {
  ASSIGNABLE_WORKFLOW_STAGES,
  STAGE_DEPARTMENT_MAP,
  SURGERY_SELF_ASSIGNMENT_VALUE,
  findStageRecord,
  isCaseAssignedToEmployee,
  isFcfsStage,
  stageSupportsAssistant,
  type AssignableStage,
  type StageWithAssistant,
} from '../lib/caseWorkflow';
import {
  StageExtraPersonFields,
  stageAssistantsFromCase,
  stageExtraFlagsFromCase,
} from './StageExtraPersonFields';
import { NEXUS_FORM_CONTROL } from '../constants/formStyles';
import { isStoreManager, SET_PREPARATION_STAGE } from '../lib/roles';
import { listEmployeesForCaseAssignment } from '../lib/assignableEmployees';
import { normalizeSentenceText, normalizeTitleCaseWords } from '../lib/textFormat';
import { formatDate } from '../utils/helpers';
import {
  CASE_DUTIES_CREATE_SECTION_HINT,
  CASE_DUTIES_CREATE_SECTION_TITLE,
  CASE_DUTY_KINDS,
  CASE_DUTY_LABELS,
  CASE_DUTY_WORKFLOW_STAGE,
  dutyPickerPlaceholder,
  getDutyEmployee,
} from '../lib/caseDuties';
import { QUICK_CASE_ASSIGN_STAGES } from '../lib/createCaseFromDraft';

interface EditCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  case: ImplantCase;
}

const STEPS = [
  { key: 'place', label: 'Hospital', icon: Building2 },
  { key: 'surgery', label: 'Surgery', icon: Stethoscope },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'review', label: 'Review', icon: CheckCircle2 },
] as const;

const PRE_SURGERY_STAGES = QUICK_CASE_ASSIGN_STAGES;

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
    const stage = CASE_DUTY_WORKFLOW_STAGE[kind];
    const emp = getDutyEmployee(c, kind);
    if (emp?.id) result[stage] = emp.id;
  }
  return result;
}

export const EditCaseModal: React.FC<EditCaseModalProps> = ({ isOpen, onClose, case: c }) => {
  const { updateCase, updateCaseStageAssignments, hospitals, employees, viewMode, currentUser } =
    useStore();
  const isFullAdmin = viewMode === 'admin';
  const isAdmin = viewMode === 'admin' || viewMode === 'store_manager';
  const isOwnCase = !isAdmin && isCaseAssignedToEmployee(c, currentUser);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
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
    paymentStatus: c.paymentStatus || 'Pending',
  });
  const [stageEmployeeIds, setStageEmployeeIds] = useState(() => stageAssignmentsFromCase(c));
  const [stageAssistantIds, setStageAssistantIds] = useState(() => stageAssistantsFromCase(c.stages));
  const [stageExtraPerson, setStageExtraPerson] = useState(() => stageExtraFlagsFromCase(c.stages));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeEmployees = useMemo(
    () => listEmployeesForCaseAssignment(employees, { alwaysInclude: currentUser }),
    [employees, currentUser],
  );

  const allowPrepAssignToMe =
    isStoreManager(currentUser.role) || (currentUser.role as string) === 'case_manager';

  const initialStageIds = useMemo(() => stageAssignmentsFromCase(c), [c.id, c.updatedAt]);
  const initialAssistantIds = useMemo(() => stageAssistantsFromCase(c.stages), [c.id, c.updatedAt]);

  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setError(null);
    setForm({
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
      paymentStatus: c.paymentStatus || 'Pending',
    });
    setStageEmployeeIds(stageAssignmentsFromCase(c));
    setStageAssistantIds(stageAssistantsFromCase(c.stages));
    setStageExtraPerson(stageExtraFlagsFromCase(c.stages));
  }, [isOpen, c.id, c.updatedAt]);

  const hospital = hospitals.find((h) => h.id === form.hospitalId);

  const validateStep = (index: number): string | null => {
    if (index === 0) {
      if (!form.hospitalId) return 'Choose a hospital.';
      if (!form.doctorName.trim()) return 'Enter the doctor name.';
      if (!form.surgeryDate) return 'Pick a surgery date.';
    }
    if (index === 1) {
      if (!form.implantRequired.trim()) return 'Enter the surgery / procedure name.';
    }
    return null;
  };

  const goNext = () => {
    const msg = validateStep(step);
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const setDutyEmployee = (kind: (typeof CASE_DUTY_KINDS)[number], employeeId: string) => {
    const stage = CASE_DUTY_WORKFLOW_STAGE[kind];
    setStageEmployeeIds((prev) => ({ ...prev, [stage]: employeeId }));
  };

  const dutyEmployeeId = (kind: (typeof CASE_DUTY_KINDS)[number]) =>
    stageEmployeeIds[CASE_DUTY_WORKFLOW_STAGE[kind]] ?? '';

  const handleSave = async () => {
    for (let i = 0; i <= 1; i++) {
      const msg = validateStep(i);
      if (msg) {
        setError(msg);
        setStep(i);
        return;
      }
    }

    if (!form.hospitalId || !form.doctorName || !form.surgeryDate || !form.implantRequired) {
      setError('Please complete required fields.');
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
          setError(`Please pick an extra person for ${stage}, or uncheck Extra person required.`);
          setStep(2);
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
        setError(`Extra person for ${stage} must be different from the primary assignee.`);
        setStep(2);
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
  const labelClass = 'block text-sm font-semibold text-gray-800 mb-2';

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

  const stepMeta = STEPS[step];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      subtitle={`Step ${step + 1} of ${STEPS.length} · ${stepMeta.label} · ${c.caseNumber}`}
      size="screen"
      dismissOnBackdrop={false}
      bodyClassName="flex flex-col min-h-0 bg-gradient-to-b from-gray-50/80 to-white"
      title="Edit implant case"
      footer={
        <div className="flex flex-col gap-3 w-full max-w-2xl mx-auto">
          {error && (
            <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
          )}
          <div className="flex gap-3">
            {step > 0 ? (
              <Button type="button" variant="outline" className="flex-1 min-h-[52px] text-base" onClick={goBack} disabled={submitting}>
                Back
              </Button>
            ) : (
              <Button type="button" variant="outline" className="flex-1 min-h-[52px] text-base" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" variant="primary" className="flex-1 min-h-[52px] text-base font-semibold" onClick={goNext} disabled={submitting}>
                Continue
              </Button>
            ) : (
              <Button type="button" variant="primary" className="flex-1 min-h-[52px] text-base font-semibold" onClick={() => void handleSave()} disabled={submitting}>
                {submitting ? 'Saving…' : 'Save changes'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={`mx-auto w-full px-4 sm:px-6 py-5 sm:py-8 ${step === 2 ? 'max-w-3xl' : 'max-w-2xl'}`}>
          <nav className="mb-8" aria-label="Progress">
            <ol className="flex items-center gap-1 sm:gap-2">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const done = i < step;
                const current = i === step;
                return (
                  <li key={s.key} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                    <div
                      className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border-2 transition-colors ${
                        done
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                          : current
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]'
                            : 'border-gray-200 bg-white text-gray-400'
                      }`}
                    >
                      <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden />
                    </div>
                    <span className={`text-[10px] sm:text-xs font-medium truncate w-full text-center ${current ? 'text-gray-900' : 'text-gray-400'}`}>
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </nav>

          {step === 0 && (
            <section className="space-y-5 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
                Update hospital, doctor, or surgery date. Current stage on the case stays the same.
              </div>
              <div>
                <label className={labelClass}>Hospital</label>
                <HospitalSearchSelect
                  hospitals={hospitals}
                  value={form.hospitalId}
                  onChange={(hospitalId) => setForm({ ...form, hospitalId, doctorName: '' })}
                  placeholder="Search hospital name or city…"
                />
              </div>
              <div>
                <label className={labelClass}>Doctor</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Surgeon name"
                  value={form.doctorName}
                  onChange={(e) => setForm({ ...form, doctorName: e.target.value })}
                  onBlur={(e) => setForm({ ...form, doctorName: normalizeTitleCaseWords(e.target.value) })}
                  disabled={!form.hospitalId}
                />
              </div>
              <div>
                <label className={labelClass}>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    Surgery date
                  </span>
                </label>
                <SurgeryDateQuickPick
                  value={form.surgeryDate || getTodaySurgeryDateKey()}
                  mode={form.surgeryDateMode}
                  onChange={(surgeryDate, surgeryDateMode) => setForm({ ...form, surgeryDate, surgeryDateMode })}
                />
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="space-y-5 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
                Procedure and priority — what the team sees on boards and lists.
              </div>
              <div>
                <label className={labelClass}>Surgery / procedure</label>
                <input
                  type="text"
                  className={inputClass}
                  value={form.implantRequired}
                  onChange={(e) => setForm({ ...form, implantRequired: e.target.value })}
                  onBlur={(e) => setForm({ ...form, implantRequired: normalizeTitleCaseWords(e.target.value) })}
                  autoFocus
                />
              </div>
              <div>
                <label className={labelClass}>Priority</label>
                <PriorityQuickPick value={form.priority} onChange={(priority) => setForm({ ...form, priority })} />
              </div>
              {isFullAdmin && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Implant type (optional)</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={form.implantType}
                      onChange={(e) => setForm({ ...form, implantType: e.target.value })}
                      onBlur={(e) => setForm({ ...form, implantType: normalizeTitleCaseWords(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Implant company (optional)</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={form.implantCompany}
                      onChange={(e) => setForm({ ...form, implantCompany: e.target.value })}
                      onBlur={(e) => setForm({ ...form, implantCompany: normalizeTitleCaseWords(e.target.value) })}
                    />
                  </div>
                </div>
              )}
              <div>
                <label className={labelClass}>Notes for the team (optional)</label>
                <textarea
                  className={`${inputClass} resize-none min-h-[100px] py-3`}
                  rows={3}
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  onBlur={(e) => setForm({ ...form, remarks: normalizeSentenceText(e.target.value) })}
                />
              </div>
              {isFullAdmin && (
                <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-4 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">Billing (optional)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Invoice</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={inputClass}
                        value={form.invoiceAmount}
                        onChange={(e) => setForm({ ...form, invoiceAmount: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Collected</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={inputClass}
                        value={form.collectedAmount}
                        onChange={(e) => setForm({ ...form, collectedAmount: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                      <select
                        className={inputClass}
                        value={form.paymentStatus}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            paymentStatus: e.target.value as 'Pending' | 'Partial' | 'Collected',
                          })
                        }
                      >
                        <option value="Pending">Pending</option>
                        <option value="Partial">Partial</option>
                        <option value="Collected">Collected</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
                <p className="font-medium">Kit prep → Delivery → Surgery</p>
                <p className="mt-1 text-amber-900/90">Change assignees here. Telegram alerts go to anyone newly assigned.</p>
              </div>

              {PRE_SURGERY_STAGES.map((stage) => {
                const deptHint = STAGE_DEPARTMENT_MAP[stage];
                const isPrep = stage === SET_PREPARATION_STAGE;
                const isCurrent = stage === c.currentStage;
                const stageRecord = findStageRecord(c.stages, stage);
                const isDone = stageRecord?.status === 'Approved';
                const fcfs = isFcfsStage(stage);

                return (
                  <div
                    key={stage}
                    className={`rounded-2xl border p-4 space-y-3 shadow-sm ${
                      isCurrent ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent-muted)]/15' : 'border-gray-100 bg-white'
                    }`}
                  >
                    <div>
                      <p className="text-base font-semibold text-gray-900">
                        {stage}
                        {isCurrent && (
                          <span className="ml-2 text-[10px] font-semibold text-[var(--color-accent)] bg-[var(--color-accent-muted)] border border-[var(--color-accent)]/20 rounded px-1.5 py-0.5">
                            Current
                          </span>
                        )}
                        {isDone && !isCurrent && (
                          <span className="ml-2 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">
                            Done
                          </span>
                        )}
                      </p>
                      {deptHint ? <p className="text-xs text-gray-500 mt-0.5">{deptHint}</p> : null}
                    </div>
                    {isPrep && allowPrepAssignToMe && !fcfs && (
                      <Button
                        type="button"
                        variant={stageEmployeeIds[stage] === currentUser.id ? 'primary' : 'outline'}
                        className="w-full min-h-[44px] justify-center"
                        onClick={() => setStageEmployeeIds({ ...stageEmployeeIds, [stage]: currentUser.id })}
                      >
                        Assign to me ({currentUser.name.split(' ')[0]})
                      </Button>
                    )}
                    {fcfs ? (
                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        Pool stage — assign when it opens on the board.
                      </p>
                    ) : (
                      <>
                        <EmployeeSearchSelect
                          employees={activeEmployees}
                          value={stageEmployeeIds[stage]}
                          onChange={(value) => {
                            setStageEmployeeIds({ ...stageEmployeeIds, [stage]: value });
                            if (stageSupportsAssistant(stage) && stageAssistantIds[stage as StageWithAssistant] === value) {
                              setStageAssistantIds({ ...stageAssistantIds, [stage as StageWithAssistant]: '' });
                            }
                          }}
                          suggestedDepartment={deptHint}
                          allowSelf={stage === 'Surgery'}
                          allowAssignToMe={isPrep && allowPrepAssignToMe}
                          currentUser={currentUser}
                          assignToMeLabel="Assign to me"
                          placeholder="Unassigned"
                        />
                        {isFullAdmin && stageSupportsAssistant(stage) ? (
                          <StageExtraPersonFields
                            stage={stage as StageWithAssistant}
                            employees={activeEmployees}
                            primaryEmployeeId={stageEmployeeIds[stage]}
                            extraEnabled={stageExtraPerson[stage as StageWithAssistant]}
                            assistantId={stageAssistantIds[stage as StageWithAssistant]}
                            onExtraEnabledChange={(enabled) => {
                              setStageExtraPerson({ ...stageExtraPerson, [stage as StageWithAssistant]: enabled });
                              if (!enabled) setStageAssistantIds({ ...stageAssistantIds, [stage as StageWithAssistant]: '' });
                            }}
                            onAssistantChange={(value) =>
                              setStageAssistantIds({ ...stageAssistantIds, [stage as StageWithAssistant]: value })
                            }
                          />
                        ) : null}
                      </>
                    )}
                  </div>
                );
              })}

              <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-900">{CASE_DUTIES_CREATE_SECTION_TITLE}</p>
                <p className="text-xs text-gray-700 leading-relaxed">{CASE_DUTIES_CREATE_SECTION_HINT}</p>
                {CASE_DUTY_KINDS.map((kind) => (
                  <div key={kind}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{CASE_DUTY_LABELS[kind]}</label>
                    <EmployeeSearchSelect
                      employees={activeEmployees}
                      value={dutyEmployeeId(kind)}
                      onChange={(value) => setDutyEmployee(kind, value)}
                      placeholder={dutyPickerPlaceholder(kind)}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4">
                <ClipboardList className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-950">Review changes</p>
                  <p className="text-sm text-emerald-900/80 mt-0.5">Current workflow stage: {c.currentStage}</p>
                </div>
              </div>

              <dl className="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-100 shadow-sm overflow-hidden">
                {[
                  ['Hospital', hospital?.name ?? '—'],
                  ['Doctor', form.doctorName || '—'],
                  ['Surgery date', form.surgeryDate ? formatDate(form.surgeryDate) : '—'],
                  ['Procedure', form.implantRequired || '—'],
                  ['Priority', form.priority],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 px-4 py-3.5 sm:px-5">
                    <dt className="text-sm text-gray-500 shrink-0">{label}</dt>
                    <dd className="text-sm font-semibold text-gray-900 text-right">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Team</p>
                {PRE_SURGERY_STAGES.map((stage) => {
                  const id = stageEmployeeIds[stage];
                  const name =
                    id === SURGERY_SELF_ASSIGNMENT_VALUE
                      ? 'Self (hospital)'
                      : id
                        ? employees.find((e) => e.id === id)?.name ?? '—'
                        : 'Unassigned';
                  return (
                    <div key={stage} className="flex justify-between text-sm gap-3">
                      <span className="text-gray-600">{stage}</span>
                      <span className="font-medium text-gray-900 text-right">{name}</span>
                    </div>
                  );
                })}
                {CASE_DUTY_KINDS.map((kind) => {
                  const id = dutyEmployeeId(kind);
                  const name = id ? employees.find((e) => e.id === id)?.name ?? '—' : 'Unassigned';
                  return (
                    <div key={kind} className="flex justify-between text-sm gap-3">
                      <span className="text-gray-600">{CASE_DUTY_LABELS[kind]}</span>
                      <span className="font-medium text-gray-900 text-right">{name}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </Modal>
  );
};
