import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Calendar, CheckCircle2, ClipboardList, Stethoscope, Users } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { HospitalSearchSelect } from './HospitalSearchSelect';
import { EmployeeSearchSelect } from './EmployeeSearchSelect';
import { PriorityQuickPick } from './PriorityQuickPick';
import {
  SurgeryDateQuickPick,
  getTodaySurgeryDateKey,
} from './SurgeryDateQuickPick';
import { useStore } from '../store/useStore';
import { NEXUS_FORM_CONTROL } from '../constants/formStyles';
import {
  buildCreateCasePayload,
  emptyCreateCaseDraft,
  QUICK_CASE_ASSIGN_STAGES,
  type CreateCaseDraft,
} from '../lib/createCaseFromDraft';
import { STAGE_DEPARTMENT_MAP } from '../lib/caseWorkflow';
import { formatDate } from '../utils/helpers';
import { listEmployeesForCaseAssignment } from '../lib/assignableEmployees';
import { isStoreManager, SET_PREPARATION_STAGE } from '../lib/roles';

const STEPS = [
  { key: 'place', label: 'Hospital', icon: Building2 },
  { key: 'surgery', label: 'Surgery', icon: Stethoscope },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'review', label: 'Review', icon: CheckCircle2 },
] as const;

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

function freshDraft(): CreateCaseDraft {
  const draft = emptyCreateCaseDraft();
  draft.surgeryDate = getTodaySurgeryDateKey();
  return draft;
}

export const QuickCreateCaseModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { createCase, hospitals, employees, currentUser } = useStore();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateCaseDraft>(freshDraft);

  const activeEmployees = useMemo(
    () => listEmployeesForCaseAssignment(employees, { alwaysInclude: currentUser }),
    [employees, currentUser],
  );

  const allowPrepAssignToMe =
    isStoreManager(currentUser.role) || (currentUser.role as string) === 'case_manager';

  const hospital = hospitals.find((h) => h.id === form.hospitalId);

  useEffect(() => {
    if (!isOpen) return;
    const draft = freshDraft();
    if (allowPrepAssignToMe) {
      draft.stageEmployeeIds[SET_PREPARATION_STAGE] = currentUser.id;
    }
    setForm(draft);
    setStep(0);
    setError(null);
  }, [isOpen, allowPrepAssignToMe, currentUser.id]);

  const resetAndClose = () => {
    setStep(0);
    setForm(freshDraft());
    setError(null);
    onClose();
  };

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

  const handleCreate = async () => {
    for (let i = 0; i <= 1; i++) {
      const msg = validateStep(i);
      if (msg) {
        setError(msg);
        setStep(i);
        return;
      }
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = buildCreateCasePayload(form, hospitals, employees, currentUser);
      await createCase(payload);
      resetAndClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create case.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = `${NEXUS_FORM_CONTROL} text-base min-h-[48px]`;
  const labelClass = 'block text-sm font-semibold text-gray-800 mb-2';
  const stepMeta = STEPS[step];

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="New implant case"
      subtitle={`Step ${step + 1} of ${STEPS.length} · ${stepMeta.label}`}
      size="screen"
      dismissOnBackdrop={false}
      bodyClassName="flex flex-col min-h-0 bg-gradient-to-b from-gray-50/80 to-white"
      footer={
        <div className="flex flex-col gap-3 w-full max-w-2xl mx-auto">
          {error && (
            <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
          )}
          <div className="flex gap-3">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="flex-1 min-h-[52px] text-base"
                onClick={goBack}
                disabled={submitting}
              >
                Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="flex-1 min-h-[52px] text-base"
                onClick={resetAndClose}
                disabled={submitting}
              >
                Cancel
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                variant="primary"
                className="flex-1 min-h-[52px] text-base font-semibold"
                onClick={goNext}
                disabled={submitting}
              >
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                className="flex-1 min-h-[52px] text-base font-semibold"
                onClick={() => void handleCreate()}
                disabled={submitting}
              >
                {submitting ? 'Creating…' : 'Create case'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-8">
          {/* Step rail */}
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
                    <span
                      className={`text-[10px] sm:text-xs font-medium truncate w-full text-center ${
                        current ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
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
                Start with where and when the surgery happens. You can add implant details on the next step.
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
                  mode="today"
                  onChange={(surgeryDate) => setForm({ ...form, surgeryDate })}
                />
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="space-y-5 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
                What procedure is planned? Keep it short — the team sees this on the board.
              </div>
              <div>
                <label className={labelClass}>Surgery / procedure</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. TKR, ACL, Hip replacement"
                  value={form.implantRequired}
                  onChange={(e) => setForm({ ...form, implantRequired: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className={labelClass}>Priority</label>
                <PriorityQuickPick value={form.priority} onChange={(priority) => setForm({ ...form, priority })} />
              </div>
              <div>
                <label className={labelClass}>Notes for the team (optional)</label>
                <textarea
                  className={`${inputClass} resize-none min-h-[100px] py-3`}
                  rows={3}
                  placeholder="Kit notes, timing, anything stores or delivery should know"
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                />
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
                <p className="font-medium">Set Preparation starts here</p>
                <p className="mt-1 text-amber-900/90">
                  Assign who prepares the set (often you). Other stages can wait — assign them later from the case.
                </p>
              </div>

              {QUICK_CASE_ASSIGN_STAGES.map((stage) => {
                const deptHint = STAGE_DEPARTMENT_MAP[stage];
                const isPrep = stage === SET_PREPARATION_STAGE;
                return (
                  <div
                    key={stage}
                    className={`rounded-2xl border p-4 space-y-3 shadow-sm ${
                      isPrep ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent-muted)]/20' : 'border-gray-100 bg-white'
                    }`}
                  >
                    <div>
                      <p className="text-base font-semibold text-gray-900">{stage}</p>
                      {deptHint ? <p className="text-xs text-gray-500 mt-0.5">{deptHint}</p> : null}
                    </div>
                    {isPrep && allowPrepAssignToMe && (
                      <Button
                        type="button"
                        variant={form.stageEmployeeIds[stage] === currentUser.id ? 'primary' : 'outline'}
                        className="w-full min-h-[44px] justify-center"
                        onClick={() =>
                          setForm({
                            ...form,
                            stageEmployeeIds: { ...form.stageEmployeeIds, [stage]: currentUser.id },
                          })
                        }
                      >
                        Assign to me ({currentUser.name.split(' ')[0]})
                      </Button>
                    )}
                    <EmployeeSearchSelect
                      employees={activeEmployees}
                      value={form.stageEmployeeIds[stage] ?? ''}
                      onChange={(value) =>
                        setForm({
                          ...form,
                          stageEmployeeIds: { ...form.stageEmployeeIds, [stage]: value },
                        })
                      }
                      suggestedDepartment={deptHint}
                      allowSelf={stage === 'Surgery'}
                      allowAssignToMe={isPrep && allowPrepAssignToMe}
                      currentUser={currentUser}
                      assignToMeLabel="Assign to me"
                      placeholder={isPrep ? 'Or pick someone else…' : 'Assign later…'}
                    />
                  </div>
                );
              })}

              <button
                type="button"
                className="w-full text-center text-sm font-medium text-[var(--color-accent)] py-3 hover:underline"
                onClick={goNext}
              >
                Skip for now — I&apos;ll assign later
              </button>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4">
                <ClipboardList className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-950">Ready to create</p>
                  <p className="text-sm text-emerald-900/80 mt-0.5">
                    Case opens at Set Preparation. You can edit assignments anytime from the case page.
                  </p>
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
                {form.remarks.trim() ? (
                  <div className="px-4 py-3.5 sm:px-5">
                    <dt className="text-sm text-gray-500 mb-1">Notes</dt>
                    <dd className="text-sm text-gray-800">{form.remarks}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          )}
        </div>
      </div>
    </Modal>
  );
};
