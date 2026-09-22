import React, { useMemo, useState } from 'react';
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

const STEPS = ['Hospital & doctor', 'Surgery', 'Team', 'Review'] as const;

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export const QuickCreateCaseModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { createCase, hospitals, employees, currentUser } = useStore();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateCaseDraft>(() => {
    const draft = emptyCreateCaseDraft();
    draft.surgeryDate = getTodaySurgeryDateKey();
    return draft;
  });

  const activeEmployees = useMemo(
    () => listEmployeesForCaseAssignment(employees, { alwaysInclude: currentUser }),
    [employees, currentUser],
  );

  const allowPrepAssignToMe =
    isStoreManager(currentUser.role) || (currentUser.role as string) === 'case_manager';

  const hospital = hospitals.find((h) => h.id === form.hospitalId);

  const resetAndClose = () => {
    setStep(0);
    const draft = emptyCreateCaseDraft();
    draft.surgeryDate = getTodaySurgeryDateKey();
    setForm(draft);
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

  const inputClass = `${NEXUS_FORM_CONTROL} text-base`;
  const labelClass = 'block text-sm font-medium text-gray-800 mb-2';

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="New case"
      subtitle={`Step ${step + 1} of ${STEPS.length} — ${STEPS[step]}`}
      size="md"
      bodyClassName="px-4 pb-2"
      footer={
        <div className="flex flex-col gap-2 w-full">
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-2">
            {step > 0 ? (
              <Button type="button" variant="outline" className="flex-1 min-h-11" onClick={goBack} disabled={submitting}>
                Back
              </Button>
            ) : (
              <Button type="button" variant="outline" className="flex-1 min-h-11" onClick={resetAndClose} disabled={submitting}>
                Cancel
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" variant="primary" className="flex-1 min-h-11" onClick={goNext} disabled={submitting}>
                Next
              </Button>
            ) : (
              <Button type="button" variant="primary" className="flex-1 min-h-11" onClick={() => void handleCreate()} disabled={submitting}>
                {submitting ? 'Creating…' : 'Create case'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex gap-1.5 mb-5">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-[var(--color-accent)]' : 'bg-gray-200'}`}
            title={label}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4 pb-4">
          <div>
            <label className={labelClass}>Hospital</label>
            <HospitalSearchSelect
              hospitals={hospitals}
              value={form.hospitalId}
              onChange={(hospitalId) => setForm({ ...form, hospitalId, doctorName: '' })}
              placeholder="Search hospital…"
            />
          </div>
          <div>
            <label className={labelClass}>Doctor</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Doctor name"
              value={form.doctorName}
              onChange={(e) => setForm({ ...form, doctorName: e.target.value })}
              disabled={!form.hospitalId}
            />
          </div>
          <div>
            <label className={labelClass}>Surgery date</label>
            <SurgeryDateQuickPick
              value={form.surgeryDate || getTodaySurgeryDateKey()}
              mode="today"
              onChange={(surgeryDate) => setForm({ ...form, surgeryDate })}
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 pb-4">
          <div>
            <label className={labelClass}>Surgery / procedure</label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. TKR, ACL"
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
            <label className={labelClass}>Notes (optional)</label>
            <textarea
              className={`${inputClass} resize-none min-h-[4.5rem]`}
              rows={2}
              placeholder="Any short note for the team"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 pb-4">
          <p className="text-sm text-gray-600">
            Optional — you can assign people later from the case. Set Preparation is where store photos happen.
          </p>
          {QUICK_CASE_ASSIGN_STAGES.map((stage) => {
            const deptHint = STAGE_DEPARTMENT_MAP[stage];
            return (
              <div key={stage} className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 space-y-2">
                <p className="text-sm font-semibold text-gray-900">{stage}</p>
                {deptHint ? <p className="text-xs text-gray-500">{deptHint}</p> : null}
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
                  allowAssignToMe={stage === SET_PREPARATION_STAGE && allowPrepAssignToMe}
                  currentUser={currentUser}
                  assignToMeLabel="Assign to me"
                  placeholder="Assign later…"
                />
              </div>
            );
          })}
          <Button type="button" variant="ghost" size="sm" className="w-full" onClick={goNext}>
            Skip team — assign later
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3 pb-4 text-sm">
          <div className="rounded-xl border border-gray-100 divide-y divide-gray-100">
            <div className="px-3 py-2.5 flex justify-between gap-3">
              <span className="text-gray-500">Hospital</span>
              <span className="font-medium text-gray-900 text-right">{hospital?.name ?? '—'}</span>
            </div>
            <div className="px-3 py-2.5 flex justify-between gap-3">
              <span className="text-gray-500">Doctor</span>
              <span className="font-medium text-gray-900 text-right">{form.doctorName || '—'}</span>
            </div>
            <div className="px-3 py-2.5 flex justify-between gap-3">
              <span className="text-gray-500">Date</span>
              <span className="font-medium text-gray-900">{form.surgeryDate ? formatDate(form.surgeryDate) : '—'}</span>
            </div>
            <div className="px-3 py-2.5 flex justify-between gap-3">
              <span className="text-gray-500">Surgery</span>
              <span className="font-medium text-gray-900 text-right">{form.implantRequired || '—'}</span>
            </div>
            <div className="px-3 py-2.5 flex justify-between gap-3">
              <span className="text-gray-500">Priority</span>
              <span className="font-medium text-gray-900">{form.priority}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500">Case starts at Set Preparation.</p>
        </div>
      )}
    </Modal>
  );
};
