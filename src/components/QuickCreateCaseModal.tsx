import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react';
import type { AssignableStage, StageWithAssistant } from '../lib/caseWorkflow';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { getTodaySurgeryDateKey } from './SurgeryDateQuickPick';
import { useStore } from '../store/useStore';
import {
  buildCreateCasePayload,
  emptyCreateCaseDraft,
  type CreateCaseDraft,
} from '../lib/createCaseFromDraft';
import { listEmployeesForCaseAssignment } from '../lib/assignableEmployees';
import { isCaseOpsView, isStoreManager, SET_PREPARATION_STAGE } from '../lib/roles';
import type { CaseDutyKind } from '../lib/caseDuties';
import { HospitalStep } from './case-create/HospitalStep';
import { SurgeryStep, type SurgeryField } from './case-create/SurgeryStep';
import { TeamStep, type TeamActions } from './case-create/TeamStep';
import { CaseSummary, formatSurgeryDateLabel } from './case-create/CaseSummary';
import { CaseCreateProgress, CaseCreateRail, CASE_CREATE_STEPS } from './case-create/CaseCreateProgress';
import { CaseCreateSuccess, type CreatedCaseInfo } from './case-create/CaseCreateSuccess';
import { PickerSheet } from './case-create/PickerSheet';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type ProblemField = 'hospital' | SurgeryField | 'punch';
interface Problem {
  step: number;
  field: ProblemField;
  message: string;
}

const LAST_STEP = CASE_CREATE_STEPS.length - 1;

function freshDraft(): CreateCaseDraft {
  const draft = emptyCreateCaseDraft();
  draft.surgeryDate = getTodaySurgeryDateKey();
  return draft;
}

/**
 * Case entry — a guided 4-step flow (Hospital → Surgery → Team → Review).
 *
 * UI only: it still builds a `CreateCaseDraft`, converts it with
 * `buildCreateCasePayload()` and saves through the store's `createCase()`.
 */
export const QuickCreateCaseModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    createCase,
    createDoctor,
    ensureDoctorForCase,
    hospitals,
    employees,
    currentUser,
    viewMode,
    cases,
    doctors,
    setSelectedCase,
  } = useStore();
  const isFullAdmin = viewMode === 'admin';
  const isCaseOps = isCaseOpsView(viewMode);

  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [form, setForm] = useState<CreateCaseDraft>(freshDraft);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedCaseInfo | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [doctorSignal, setDoctorSignal] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const procedureRef = useRef<HTMLInputElement>(null);

  const activeEmployees = useMemo(
    () => listEmployeesForCaseAssignment(employees, { alwaysInclude: currentUser }),
    [employees, currentUser],
  );
  const punchInCandidates = useMemo(
    () => employees.filter((e) => e.status === 'Active').sort((a, b) => a.name.localeCompare(b.name)),
    [employees],
  );

  const allowPrepAssignToMe =
    isStoreManager(currentUser.role) || (currentUser.role as string) === 'case_manager';

  const hospital = hospitals.find((h) => h.id === form.hospitalId);

  const initDraft = useCallback(() => {
    const draft = freshDraft();
    if (allowPrepAssignToMe) {
      draft.stageEmployeeIds[SET_PREPARATION_STAGE] = currentUser.id;
    }
    if (isFullAdmin) {
      draft.punchedInByEmployeeId = currentUser.id;
    }
    return draft;
  }, [allowPrepAssignToMe, currentUser.id, isFullAdmin]);

  const resetAll = useCallback(() => {
    setForm(initDraft());
    setStep(0);
    setMaxStep(0);
    setProblem(null);
    setCreateError(null);
    setCreated(null);
    setLeaveOpen(false);
    setSubmitting(false);
  }, [initDraft]);

  useEffect(() => {
    if (isOpen) resetAll();
  }, [isOpen, resetAll]);

  // New step → start at the top and let screen readers hear the question.
  useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step, isOpen, created]);

  /* ------------------------------ form helpers ------------------------------ */

  const patch = useCallback((partial: Partial<CreateCaseDraft>) => {
    setForm((f) => ({ ...f, ...partial }));
  }, []);

  const selectHospital = useCallback((hospitalId: string) => {
    setForm((f) => ({
      ...f,
      hospitalId,
    }));
  }, []);

  const teamActions = useMemo<TeamActions>(
    () => ({
      setStageEmployee: (stage: AssignableStage, value: string) =>
        setForm((f) => {
          const assistantKey = stage as StageWithAssistant;
          const clashes = Boolean(value) && f.stageAssistantIds[assistantKey] === value;
          return {
            ...f,
            stageEmployeeIds: { ...f.stageEmployeeIds, [stage]: value },
            ...(clashes
              ? {
                  stageAssistantIds: { ...f.stageAssistantIds, [assistantKey]: '' },
                  stageExtraPerson: { ...f.stageExtraPerson, [assistantKey]: false },
                }
              : {}),
          };
        }),
      setAssistant: (stage: StageWithAssistant, employeeId: string) =>
        setForm((f) => ({
          ...f,
          stageAssistantIds: { ...f.stageAssistantIds, [stage]: employeeId },
          stageExtraPerson: { ...f.stageExtraPerson, [stage]: Boolean(employeeId) },
        })),
      setDuty: (kind: CaseDutyKind, value: string) =>
        setForm((f) => ({ ...f, dutyEmployeeIds: { ...f.dutyEmployeeIds, [kind]: value } })),
      setStartStage: (startStage: AssignableStage) => setForm((f) => ({ ...f, startStage })),
      setPunchedInBy: (punchedInByEmployeeId: string) => setForm((f) => ({ ...f, punchedInByEmployeeId })),
    }),
    [],
  );

  /* ------------------------------- validation ------------------------------- */

  /** First thing that's missing in steps 0..upTo — one guiding message at a time. */
  const findProblem = (upTo: number): Problem | null => {
    const checks: Problem[] = [];
    if (!form.hospitalId) checks.push({ step: 0, field: 'hospital', message: 'Select a hospital to continue.' });
    if (!form.surgeryDate) checks.push({ step: 1, field: 'date', message: 'Choose the surgery date to continue.' });
    if (!form.doctorName.trim()) checks.push({ step: 1, field: 'doctor', message: 'Select or add the doctor to continue.' });
    if (!form.implantRequired.trim()) checks.push({ step: 1, field: 'procedure', message: 'Enter the procedure to continue.' });
    if (isFullAdmin && !form.punchedInByEmployeeId.trim()) {
      checks.push({ step: 2, field: 'punch', message: 'Choose who punched in this case.' });
    }
    return checks.find((c) => c.step <= upTo) ?? null;
  };

  const surface = (p: Problem) => {
    setProblem(p);
    setStep(p.step);
    if (p.field === 'doctor') setDoctorSignal((n) => n + 1);
    if (p.field === 'procedure') window.setTimeout(() => procedureRef.current?.focus(), 50);
  };

  // A message disappears as soon as its field is fixed.
  const visibleProblem = problem && findProblem(LAST_STEP)?.field === problem.field ? problem : null;

  /* -------------------------------- navigation ------------------------------- */

  const goNext = () => {
    const p = findProblem(step);
    if (p) {
      surface(p);
      return;
    }
    setProblem(null);
    const next = Math.min(step + 1, LAST_STEP);
    setStep(next);
    setMaxStep((m) => Math.max(m, next));
  };

  const goBack = () => {
    setProblem(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const goTo = (index: number) => {
    if (index > maxStep) return;
    setProblem(null);
    setStep(index);
  };

  /* ------------------------------ leave / close ------------------------------ */

  const isDirty =
    !created &&
    Boolean(
      form.hospitalId ||
        form.doctorName.trim() ||
        form.implantRequired.trim() ||
        form.remarks.trim() ||
        form.implantType.trim() ||
        form.implantCompany.trim(),
    );

  const closeForGood = () => {
    setLeaveOpen(false);
    onClose();
  };

  const requestClose = useCallback(() => {
    if (submitting) return;
    if (isDirty) setLeaveOpen(true);
    else closeForGood();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting, isDirty, onClose]);

  /* --------------------------------- create --------------------------------- */

  const handleCreate = async () => {
    if (submitting) return;
    const p = findProblem(LAST_STEP);
    if (p) {
      surface(p);
      return;
    }
    setProblem(null);
    setCreateError(null);
    setSubmitting(true);
    try {
      const knownIds = new Set(useStore.getState().cases.map((c) => c.id));
      await ensureDoctorForCase(form.doctorName);
      const freshDoctors = useStore.getState().doctors;
      const payload = buildCreateCasePayload(form, hospitals, employees, freshDoctors, currentUser);
      await createCase(payload);
      const newCase = useStore.getState().cases.find((c) => !knownIds.has(c.id));
      setCreated({
        id: newCase?.id ?? '',
        caseNumber: newCase?.caseNumber ?? 'New case',
        hospitalName: newCase?.hospital?.name ?? hospital?.name ?? '—',
        doctorName: newCase?.doctor?.name ?? form.doctorName,
        dateLabel: formatSurgeryDateLabel(form),
      });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const viewCreated = () => {
    if (!created) return;
    const id = created.id;
    closeForGood();
    if (id) setSelectedCase(id);
  };

  /* ---------------------------------- render --------------------------------- */

  const meta = CASE_CREATE_STEPS[step];
  const errorFor = (field: ProblemField) => (visibleProblem?.field === field ? visibleProblem.message : null);
  const surgeryError =
    visibleProblem && (visibleProblem.field === 'doctor' || visibleProblem.field === 'procedure' || visibleProblem.field === 'date')
      ? { field: visibleProblem.field, message: visibleProblem.message }
      : null;

  const summaryProps = {
    form,
    hospital,
    employees: activeEmployees,
    punchInCandidates,
    currentUser,
    showImplantDetails: isCaseOps,
    isFullAdmin,
  };

  const footer = created ? null : (
    <div className="mx-auto w-full max-w-2xl lg:max-w-6xl">
      <div className="flex flex-col gap-3 pb-[env(safe-area-inset-bottom)] lg:ml-[240px] lg:mr-[360px]">
      {step === LAST_STEP && createError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">We couldn&apos;t create this case.</p>
          <p className="mt-0.5 text-sm text-red-700">{createError}</p>
          <p className="mt-0.5 text-xs text-red-700/80">Your information is still here — nothing was lost.</p>
        </div>
      ) : null}
      {step === LAST_STEP ? (
        <Button
          type="button"
          variant="primary"
          loading={submitting}
          disabled={submitting}
          icon={createError ? <RotateCcw className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          className="min-h-[56px] w-full justify-center text-base font-bold tracking-wide"
          onClick={() => void handleCreate()}
        >
          {submitting ? 'Creating…' : createError ? 'Try again' : 'CREATE CASE'}
        </Button>
      ) : (
        <Button
          type="button"
          variant="primary"
          iconRight={<ArrowRight className="h-5 w-5" />}
          className="min-h-[56px] w-full justify-center text-base font-semibold"
          onClick={goNext}
        >
          {step === LAST_STEP - 1 ? 'Review' : 'Continue'}
        </Button>
      )}
      </div>
    </div>
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={requestClose}
        title={created ? 'Case created' : isCaseOps ? 'New implant case' : 'New case'}
        subtitle={created ? undefined : `${step + 1} of ${CASE_CREATE_STEPS.length} · ${meta.label}`}
        size="screen"
        dismissOnBackdrop={false}
        bodyClassName="flex flex-col min-h-0 bg-gradient-to-b from-gray-50/80 to-white"
        footer={footer}
      >
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
          {created ? (
            <CaseCreateSuccess
              info={created}
              onView={viewCreated}
              onCreateAnother={resetAll}
              onDone={closeForGood}
            />
          ) : (
            <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-5 sm:py-8 lg:grid lg:max-w-6xl lg:grid-cols-[200px_minmax(0,1fr)_320px] lg:gap-10">
              {/* Left rail — desktop */}
              <aside className="hidden lg:block">
                <div className="sticky top-8">
                  <CaseCreateRail step={step} maxStep={maxStep} onGo={goTo} />
                </div>
              </aside>

              {/* Task */}
              <div className="min-w-0">
                <div className="mb-5 space-y-3 lg:hidden">
                  <div className="flex items-center justify-between">
                    {step > 0 ? (
                      <button
                        type="button"
                        onClick={goBack}
                        disabled={submitting}
                        className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                      >
                        <ArrowLeft className="h-4 w-4" aria-hidden /> Back
                      </button>
                    ) : (
                      <span aria-hidden className="min-h-[44px]" />
                    )}
                    <span className="text-sm font-medium text-gray-500">
                      {step + 1} of {CASE_CREATE_STEPS.length}
                    </span>
                  </div>
                  <CaseCreateProgress step={step} />
                </div>

                {step > 0 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={submitting}
                    className="-ml-2 mb-3 hidden min-h-[44px] items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] lg:inline-flex"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden /> Back
                  </button>
                ) : null}

                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="mb-5 text-2xl font-semibold tracking-tight text-gray-900 focus:outline-none"
                  aria-live="polite"
                >
                  {meta.title}
                </h2>

                <div className="animate-in fade-in duration-200" key={step}>
                  {step === 0 && (
                    <HospitalStep
                      hospitals={hospitals}
                      cases={cases}
                      value={form.hospitalId}
                      onSelect={selectHospital}
                      error={errorFor('hospital')}
                    />
                  )}
                  {step === 1 && (
                    <SurgeryStep
                      form={form}
                      patch={patch}
                      hospital={hospital}
                      cases={cases}
                      doctors={doctors}
                      showImplantDetails={isCaseOps}
                      error={surgeryError}
                      openDoctorSignal={doctorSignal}
                      procedureRef={procedureRef}
                      onSubmitFromKeyboard={goNext}
                      onAddDoctor={(name) => createDoctor({ name })}
                    />
                  )}
                  {step === 2 && (
                    <TeamStep
                      form={form}
                      actions={teamActions}
                      employees={activeEmployees}
                      punchInCandidates={punchInCandidates}
                      currentUser={currentUser}
                      isFullAdmin={isFullAdmin}
                      allowAssistants={isCaseOps}
                      allowPrepAssignToMe={allowPrepAssignToMe}
                      punchError={errorFor('punch')}
                    />
                  )}
                  {step === 3 && (
                    <div className="space-y-4">
                      <CaseSummary {...summaryProps} onEdit={goTo} />
                      <p className="px-1 text-sm text-gray-500">
                        The case opens at <span className="font-semibold text-gray-800">{form.startStage}</span>. You can
                        change assignments anytime from the case page.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Live summary — desktop */}
              <aside className="hidden lg:block" aria-label="Case summary">
                <div className="sticky top-8 space-y-3">
                  <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Your case</h3>
                  <CaseSummary {...summaryProps} />
                </div>
              </aside>
            </div>
          )}
        </div>
      </Modal>

      <PickerSheet
        isOpen={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="Leave case creation?"
        subtitle="Your entered information will be lost."
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
              Continue editing
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[52px] w-full justify-center text-base text-red-700"
              onClick={closeForGood}
            >
              Leave
            </Button>
          </div>
        }
      >
        <div className="h-1" />
      </PickerSheet>
    </>
  );
};
