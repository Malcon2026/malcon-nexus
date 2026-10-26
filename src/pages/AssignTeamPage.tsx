import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useStore } from '../store/useStore';
import { NexusPage, NexusPageHeader } from '../components/layout/NexusPageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getDutyEmployee, type CaseDutyKind } from '../lib/caseDuties';
import { findStageRecord, type AssignableStage } from '../lib/caseWorkflow';
import { RETURN_OUTCOMES, returnOutcomeToDutyId } from '../lib/returnPickup';
import { findChandraGajelli } from '../lib/checkingPool';
import type { Employee, ImplantCase } from '../types';

/** One value per dropdown, in the order the page shows them. '' means "keep current". */
interface TeamDraft {
  delivery: string;
  scrubbing: string;
  return: string;
  cleaning: string;
  restock: string;
}

const ROLE_KEYS: (keyof TeamDraft)[] = ['delivery', 'scrubbing', 'return', 'cleaning', 'restock'];

const ROLE_LABELS: Record<keyof TeamDraft, string> = {
  delivery: 'Delivery',
  scrubbing: 'Scrubbing',
  return: 'Return',
  cleaning: 'Cleaning',
  restock: 'Restock',
};

const selectClass =
  'nexus-field-input nexus-field-input--plain w-full min-h-[44px] text-sm rounded-xl disabled:opacity-60';

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

const AssignTeamRow: React.FC<{ caseItem: ImplantCase; employees: Employee[]; chandraId: string }> = ({
  caseItem: c,
  employees,
  chandraId,
}) => {
  const { confirmPostSurgeryTeam, updateCaseStageAssignments } = useStore();
  const initial = useMemo(() => draftFromCase(c, chandraId), [c, chandraId]);
  const [draft, setDraft] = useState<TeamDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === 'Active').sort((a, b) => a.name.localeCompare(b.name)),
    [employees],
  );

  /** Keeps a current person in the list even if they are no longer active. */
  const optionsFor = (currentId: string): Employee[] => {
    const current = employees.find((e) => e.id === currentId);
    if (current && !activeEmployees.some((e) => e.id === current.id)) return [...activeEmployees, current];
    return activeEmployees;
  };

  const changed = ROLE_KEYS.some((k) => draft[k] !== initial[k]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const select = (key: keyof TeamDraft, emptyLabel: string, extra?: React.ReactNode) => {
    const currentId = initial[key];
    return (
      <div className="min-w-0">
        <label htmlFor={`${c.id}-${key}`} className="block text-xs font-semibold text-gray-600 mb-1">
          {ROLE_LABELS[key]}
        </label>
        <select
          id={`${c.id}-${key}`}
          className={selectClass}
          value={draft[key]}
          disabled={saving}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
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
  };

  return (
    <Card className="p-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1.1fr)_repeat(5,minmax(0,1fr))_auto] lg:items-end">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--color-accent)]">{c.caseNumber}</p>
          <p className="text-sm font-semibold text-gray-900 leading-snug">{c.implantRequired || 'No case name'}</p>
          <p className="text-xs text-gray-500 truncate">
            {c.hospital.name} · Dr. {c.doctor.name}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:contents">
          {select('delivery', 'Keep current')}
          {select('scrubbing', 'Keep current')}
          {select(
            'return',
            'Keep current',
            RETURN_OUTCOMES.map((o) => (
              <option key={o.id} value={returnOutcomeToDutyId(o.id)}>
                {o.title}
              </option>
            )),
          )}
          {select('cleaning', 'Keep current (FCFS pool if empty)')}
          {select('restock', 'Keep current')}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={!changed || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      {error ? <p className="mt-2 text-sm font-medium text-red-600">{error}</p> : null}
    </Card>
  );
};

export const AssignTeamPage: React.FC = () => {
  const { cases, employees } = useStore();
  const [search, setSearch] = useState('');
  const chandraId = findChandraGajelli(employees)?.id ?? '';

  const list = useMemo(() => {
    let rows = cases.filter((c) => c.status !== 'Completed' && c.status !== 'Cancelled');
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.caseNumber.toLowerCase().includes(q) ||
          (c.implantRequired ?? '').toLowerCase().includes(q) ||
          c.hospital.name.toLowerCase().includes(q) ||
          c.doctor.name.toLowerCase().includes(q),
      );
    }
    return rows.sort((a, b) => b.caseNumber.localeCompare(a.caseNumber));
  }, [cases, search]);

  return (
    <NexusPage maxWidthClass="max-w-[1600px]">
      <NexusPageHeader title="Assign team" description={`${list.length} open ${list.length === 1 ? 'case' : 'cases'}`} />
      <p className="mb-4 text-sm text-gray-600 leading-relaxed px-0.5">
        Pick the people for each role on a case, then press Save on that row. &quot;Keep current&quot; leaves a role
        unchanged.
      </p>
      <Card className="mb-4 p-4">
        <div className="relative w-full min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            placeholder="Search case name, number, hospital or doctor…"
            className="nexus-field-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      <div className="space-y-3">
        {list.map((c) => (
          <AssignTeamRow key={c.id} caseItem={c} employees={employees} chandraId={chandraId} />
        ))}
      </div>

      {list.length === 0 && (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100 mt-2">
          <p className="text-sm font-medium">No open cases</p>
        </div>
      )}

    </NexusPage>
  );
};
