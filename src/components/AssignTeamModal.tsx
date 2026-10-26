import React, { useMemo, useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useStore } from '../store/useStore';
import type { Employee, ImplantCase } from '../types';
import { CASE_DUTY_LABELS, getDutyEmployee, type CaseDutyKind } from '../lib/caseDuties';
import { findStageRecord, type AssignableStage } from '../lib/caseWorkflow';
import { RETURN_OUTCOMES, returnOutcomeToDutyId } from '../lib/returnPickup';
import { findChandraGajelli } from '../lib/checkingPool';

interface AssignTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  case: ImplantCase;
}

/** One value per dropdown. '' means "leave as it is". */
interface TeamDraft {
  delivery: string;
  scrubbing: string;
  return: string;
  cleaning: string;
  restock: string;
}

const fieldLabel = 'block text-sm font-semibold text-gray-900 mb-2';
const selectClass = 'nexus-field-input nexus-field-input--plain w-full min-h-[48px] text-base rounded-xl';

function draftFromCase(c: ImplantCase, chandraId: string): TeamDraft {
  const returnOutcome = findStageRecord(c.stages, 'Pickup from Hospital')?.returnOutcome;
  return {
    delivery: findStageRecord(c.stages, 'Delivery')?.assignedEmployee?.id ?? '',
    scrubbing: findStageRecord(c.stages, 'Surgery')?.assignedEmployee?.id ?? '',
    return: returnOutcome ? returnOutcomeToDutyId(returnOutcome) : getDutyEmployee(c, 'return')?.id ?? '',
    cleaning: getDutyEmployee(c, 'cleaning')?.id ?? '',
    restock: getDutyEmployee(c, 'restock')?.id ?? chandraId,
  };
}

export const AssignTeamModal: React.FC<AssignTeamModalProps> = ({ isOpen, onClose, case: c }) => {
  const { employees, confirmPostSurgeryTeam, updateCaseStageAssignments } = useStore();
  const chandraId = findChandraGajelli(employees)?.id ?? '';
  const initial = useMemo(() => draftFromCase(c, chandraId), [c, chandraId]);
  const [draft, setDraft] = useState<TeamDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === 'Active').sort((a, b) => a.name.localeCompare(b.name)),
    [employees],
  );

  /** Keeps the current person in the list even if they are no longer active. */
  const optionsFor = (currentId: string): Employee[] => {
    const current = employees.find((e) => e.id === currentId);
    if (current && !activeEmployees.some((e) => e.id === current.id)) {
      return [...activeEmployees, current];
    }
    return activeEmployees;
  };

  const hasChanges = (Object.keys(draft) as (keyof TeamDraft)[]).some((k) => draft[k] !== initial[k]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const stageDraft: Partial<Record<AssignableStage, string>> = {};
      if (draft.delivery && draft.delivery !== initial.delivery) stageDraft.Delivery = draft.delivery;
      if (draft.scrubbing && draft.scrubbing !== initial.scrubbing) stageDraft.Surgery = draft.scrubbing;
      if (Object.keys(stageDraft).length > 0) {
        const { error: stageError } = await updateCaseStageAssignments(c.id, stageDraft);
        if (stageError) throw new Error(stageError);
      }

      const dutyDraft: Record<CaseDutyKind, string> = {
        return: draft.return,
        cleaning: draft.cleaning,
        restock: draft.restock,
      };
      await confirmPostSurgeryTeam(c.id, dutyDraft);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the team. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const personSelect = (
    id: keyof TeamDraft,
    label: string,
    currentId: string,
    emptyLabel: string,
    extra?: React.ReactNode,
  ) => (
    <div>
      <label htmlFor={`assign-${id}`} className={fieldLabel}>
        {label}
      </label>
      <select
        id={`assign-${id}`}
        className={selectClass}
        value={draft[id]}
        disabled={saving}
        onChange={(e) => setDraft((d) => ({ ...d, [id]: e.target.value }))}
      >
        <option value="">{emptyLabel}</option>
        {extra}
        {optionsFor(currentId).map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign team"
      subtitle={`${c.caseNumber} · ${c.hospital.name}`}
      size="md"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
          <Button variant="outline" size="md" className="w-full sm:w-auto" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            className="w-full sm:w-auto"
            onClick={() => void handleSave()}
            disabled={!hasChanges || saving}
          >
            {saving ? 'Saving…' : 'Save team'}
          </Button>
        </div>
      }
    >
      <div className="p-4 sm:p-6 space-y-5">
        <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Case</p>
          <p className="text-lg font-semibold text-gray-900 leading-snug">{c.implantRequired || 'No case name'}</p>
          <p className="text-sm text-gray-600 mt-1">
            {c.hospital.name} · Dr. {c.doctor.name}
          </p>
        </div>

        {personSelect('delivery', 'Delivery', initial.delivery, 'Keep current')}
        {personSelect('scrubbing', 'Scrubbing', initial.scrubbing, 'Keep current')}
        {personSelect(
          'return',
          CASE_DUTY_LABELS.return,
          initial.return,
          'Keep current',
          RETURN_OUTCOMES.map((o) => (
            <option key={o.id} value={returnOutcomeToDutyId(o.id)}>
              {o.title}
            </option>
          )),
        )}
        {personSelect('cleaning', CASE_DUTY_LABELS.cleaning, initial.cleaning, 'Keep current (FCFS pool if empty)')}
        {personSelect('restock', CASE_DUTY_LABELS.restock, initial.restock, 'Keep current')}

        <p className="text-xs text-gray-500">
          Choose a name to change that role. &quot;Keep current&quot; leaves it unchanged. Each person chosen is
          shown on the case and notified.
        </p>

        {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      </div>
    </Modal>
  );
};
