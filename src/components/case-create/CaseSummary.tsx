import React from 'react';
import { Pencil } from 'lucide-react';
import type { Employee, Hospital } from '../../types';
import type { CreateCaseDraft } from '../../lib/createCaseFromDraft';
import { ASSIGNABLE_WORKFLOW_STAGES, isFcfsStage } from '../../lib/caseWorkflow';
import { CASE_DUTY_KINDS, CASE_DUTY_LABELS, CASE_DUTY_WORKFLOW_STAGE } from '../../lib/caseDuties';
import { formatDate } from '../../utils/helpers';
import { formatHospitalLabel } from '../HospitalSearchSelect';
import { resolveAssignee } from './caseCreateHelpers';

interface CaseSummaryProps {
  form: CreateCaseDraft;
  hospital: Hospital | undefined;
  employees: Employee[];
  punchInCandidates: Employee[];
  currentUser: Employee;
  showImplantDetails?: boolean;
  /** Punched in by / start stage — full admin only. */
  isFullAdmin?: boolean;
  /** When set, each section gets an Edit button that jumps to that step. */
  onEdit?: (step: number) => void;
}

export function formatSurgeryDateLabel(form: Pick<CreateCaseDraft, 'surgeryDate' | 'surgeryDateMode'>): string {
  if (!form.surgeryDate) return '—';
  const base = formatDate(form.surgeryDate);
  if (form.surgeryDateMode === 'today') return `Today · ${base}`;
  if (form.surgeryDateMode === 'tomorrow') return `Tomorrow · ${base}`;
  return base;
}

const Row: React.FC<{ label: string; value: React.ReactNode; muted?: boolean }> = ({ label, value, muted }) => (
  <div className="flex items-baseline justify-between gap-4 py-2">
    <dt className="text-sm text-gray-500 shrink-0">{label}</dt>
    <dd className={muted ? 'text-sm text-gray-400 text-right' : 'text-sm font-medium text-gray-900 text-right break-words min-w-0'}>
      {value}
    </dd>
  </div>
);

const Block: React.FC<{ title: string; step?: number; onEdit?: (s: number) => void; children: React.ReactNode }> = ({
  title,
  step,
  onEdit,
  children,
}) => (
  <section className="px-4 py-3">
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {onEdit && step !== undefined ? (
        <button
          type="button"
          onClick={() => onEdit(step)}
          aria-label={`Edit ${title}`}
          className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
        </button>
      ) : null}
    </div>
    <dl className="divide-y divide-gray-50">{children}</dl>
  </section>
);

export const CaseSummary: React.FC<CaseSummaryProps> = ({
  form,
  hospital,
  employees,
  punchInCandidates,
  currentUser,
  showImplantDetails = false,
  isFullAdmin = false,
  onEdit,
}) => {
  const activeStages = ASSIGNABLE_WORKFLOW_STAGES.slice(ASSIGNABLE_WORKFLOW_STAGES.indexOf(form.startStage));
  const name = (v: string | undefined, pool: Employee[] = employees) => {
    const a = resolveAssignee(v, pool, currentUser);
    if (a.kind === 'none') return null;
    if (a.kind === 'person') return a.employee.name;
    return a.label;
  };

  const teamRows: { label: string; value: string | null }[] = [];
  const core: [string, string][] = [
    ['Set Preparation', 'Preparation'],
    ['Delivery', 'Delivery'],
    ['Surgery', 'Surgery'],
  ];
  for (const [stage, label] of core) {
    if (!activeStages.includes(stage as (typeof activeStages)[number])) continue;
    if (isFcfsStage(stage as (typeof activeStages)[number])) {
      teamRows.push({ label, value: 'Assigned when it opens' });
      continue;
    }
    let value = name(form.stageEmployeeIds[stage as keyof typeof form.stageEmployeeIds]);
    if (stage === 'Delivery' || stage === 'Surgery') {
      const assistant = name(form.stageAssistantIds[stage]);
      if (value && assistant && form.stageExtraPerson[stage]) value += ` + ${assistant}`;
    }
    teamRows.push({ label, value });
  }
  for (const kind of CASE_DUTY_KINDS) {
    if (!(activeStages as string[]).includes(CASE_DUTY_WORKFLOW_STAGE[kind])) continue;
    const v = name(form.dutyEmployeeIds[kind]);
    if (v) teamRows.push({ label: CASE_DUTY_LABELS[kind], value: v });
  }

  return (
    <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <Block title="Hospital" step={0} onEdit={onEdit}>
        <Row label="Hospital" value={hospital ? formatHospitalLabel(hospital) : '—'} muted={!hospital} />
      </Block>
      <Block title="Surgery" step={1} onEdit={onEdit}>
        <Row label="Date" value={formatSurgeryDateLabel(form)} />
        <Row label="Doctor" value={form.doctorName.trim() || '—'} muted={!form.doctorName.trim()} />
        <Row label="Procedure" value={form.implantRequired.trim() || '—'} muted={!form.implantRequired.trim()} />
        {form.priority !== 'Medium' ? <Row label="Priority" value={form.priority} /> : null}
        {showImplantDetails && form.implantType.trim() ? <Row label="Implant type" value={form.implantType.trim()} /> : null}
        {showImplantDetails && form.implantCompany.trim() ? <Row label="Company" value={form.implantCompany.trim()} /> : null}
      </Block>
      <Block title="Team" step={2} onEdit={onEdit}>
        {teamRows.map((r) => (
          <Row key={r.label} label={r.label} value={r.value ?? 'Assign later'} muted={!r.value} />
        ))}
        {isFullAdmin ? (
          <>
            <Row label="Starts at" value={form.startStage} />
            <Row
              label="Punched in by"
              value={name(form.punchedInByEmployeeId, punchInCandidates) ?? '—'}
            />
          </>
        ) : null}
      </Block>
    </div>
  );
};
