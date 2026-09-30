import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  PauseCircle,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { Employee } from '../../types';
import type { CreateCaseDraft } from '../../lib/createCaseFromDraft';

/** The slice of the draft the team UI needs (Add Case and Edit Case both provide it). */
export type TeamFormFields = Pick<
  CreateCaseDraft,
  'startStage' | 'stageEmployeeIds' | 'stageAssistantIds' | 'stageExtraPerson' | 'dutyEmployeeIds' | 'punchedInByEmployeeId'
>;
import type { AssignableStage, StageWithAssistant } from '../../lib/caseWorkflow';
import {
  ASSIGNABLE_WORKFLOW_STAGES,
  SURGERY_SELF_ASSIGNMENT_VALUE,
  STAGE_DEPARTMENT_MAP,
  isFcfsStage,
  stageSupportsAssistant,
} from '../../lib/caseWorkflow';
import { SET_PREPARATION_STAGE } from '../../lib/roles';
import {
  CASE_DUTY_KINDS,
  CASE_DUTY_LABELS,
  CASE_DUTY_WORKFLOW_STAGE,
  type CaseDutyKind,
} from '../../lib/caseDuties';
import { cn } from '../../utils/cn';
import { Avatar } from '../ui/Avatar';
import { EmployeePickerSheet } from './EmployeePickerSheet';
import { HOSPITAL_SELF_LABEL, resolveAssignee, type AssigneeView } from './caseCreateHelpers';

const CORE_STAGES: AssignableStage[] = ['Set Preparation', 'Delivery', 'Surgery'];

const STAGE_COPY: Record<string, { label: string; question: string }> = {
  'Set Preparation': { label: 'Preparation', question: 'Who is preparing the set?' },
  Delivery: { label: 'Delivery', question: 'Who is delivering it?' },
  Surgery: { label: 'Surgery', question: 'Who is handling the surgery?' },
};

const DUTY_COPY: Record<CaseDutyKind, string> = {
  return: 'Who brings the set back from the hospital?',
  cleaning: 'Who checks the returned set?',
  restock: 'Who restocks it?',
};

export interface TeamActions {
  setStageEmployee: (stage: AssignableStage, value: string) => void;
  setAssistant: (stage: StageWithAssistant, employeeId: string) => void;
  setDuty: (kind: CaseDutyKind, value: string) => void;
  setStartStage: (stage: AssignableStage) => void;
  setPunchedInBy: (employeeId: string) => void;
}

interface TeamStepProps {
  form: TeamFormFields;
  actions: TeamActions;
  /** `edit` hides Add-Case-only controls (punched in by, start stage). */
  mode?: 'create' | 'edit';
  /** Defaults to admin-only. */
  allowAssistants?: boolean;
  /** Return can be set to Used / no return or Parked (Add Case only). */
  allowReturnSpecial?: boolean;
  /** Small tag per stage, e.g. Current / Done. */
  badges?: Partial<Record<string, string>>;
  employees: Employee[];
  punchInCandidates?: Employee[];
  currentUser: Employee;
  isAdmin: boolean;
  allowPrepAssignToMe: boolean;
  /** Validation message for "Punched in by". */
  punchError?: string | null;
}

type PickerTarget =
  | { kind: 'stage'; stage: AssignableStage }
  | { kind: 'assistant'; stage: StageWithAssistant }
  | { kind: 'duty'; duty: CaseDutyKind }
  | { kind: 'punch' };

const chipClass =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1';

/* --------------------------------- Row card -------------------------------- */

interface TeamRowProps {
  label: string;
  question: string;
  view: AssigneeView;
  badge?: string;
  note?: string;
  error?: string | null;
  onChoose: () => void;
  /** Surgery only. */
  onPickHospitalSelf?: () => void;
  assistant?: { view: AssigneeView; onAdd: () => void; onRemove: () => void } | null;
  emphasised?: boolean;
}

const AssigneeIcon: React.FC<{ view: AssigneeView }> = ({ view }) => {
  if (view.kind === 'person') return <Avatar name={view.employee.name} size="lg" />;
  const Icon = view.kind === 'hospital' ? Building2 : view.kind === 'special' && view.label.toLowerCase().includes('park') ? PauseCircle : Clock;
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
      <Icon className="h-5 w-5" />
    </span>
  );
};

const TeamRow: React.FC<TeamRowProps> = ({
  label,
  question,
  view,
  badge,
  note,
  error,
  onChoose,
  onPickHospitalSelf,
  assistant,
  emphasised,
}) => {
  const assigned = view.kind !== 'none';
  const assignedLabel =
    view.kind === 'person'
      ? view.employee.name
      : view.kind === 'none'
        ? ''
        : view.label;

  return (
    <div
      className={cn(
        'rounded-2xl border bg-white p-4 shadow-sm',
        emphasised ? 'border-[var(--color-accent)]/30' : 'border-gray-100',
      )}
    >
      <div className="flex items-center gap-2">
        <p className="text-base font-semibold text-gray-900">{label}</p>
        {badge ? (
          <span
            className={cn(
              'rounded border px-1.5 py-0.5 text-[10px] font-semibold',
              badge === 'Done'
                ? 'border-emerald-100 bg-emerald-50 text-emerald-600'
                : 'border-[var(--color-accent)]/20 bg-[var(--color-accent-muted)] text-[var(--color-accent)]',
            )}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-sm text-gray-500">{question}</p>

      {note ? (
        <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">{note}</p>
      ) : assigned ? (
        <button
          type="button"
          onClick={onChoose}
          aria-label={`${label}: ${assignedLabel}. Change`}
          className="mt-3 flex w-full items-center gap-3 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent-muted)]/40 px-3 min-h-[56px] py-2 text-left transition-colors hover:bg-[var(--color-accent-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <AssigneeIcon view={view} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-gray-900">{assignedLabel}</span>
            <span className="block text-xs text-gray-500">Tap to change</span>
          </span>
          <Check className="h-5 w-5 shrink-0 text-[var(--color-accent)]" aria-hidden />
        </button>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Assign ${label}`}>
          {onPickHospitalSelf ? (
            <button
              type="button"
              onClick={onPickHospitalSelf}
              className={cn(chipClass, 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50')}
            >
              <Building2 className="h-4 w-4" aria-hidden /> {HOSPITAL_SELF_LABEL}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onChoose}
            className={cn(chipClass, 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50')}
          >
            Choose person <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden />
          </button>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}

      {assistant && view.kind !== 'hospital' && !note ? (
        <div className="mt-3 border-t border-gray-100 pt-3">
          {assistant.view.kind === 'person' ? (
            <div className="flex items-center gap-3">
              <Avatar name={assistant.view.employee.name} size="md" />
              <span className="min-w-0 flex-1 text-sm">
                <span className="text-gray-500">Assistant: </span>
                <span className="font-semibold text-gray-900">{assistant.view.employee.name}</span>
              </span>
              <button
                type="button"
                onClick={assistant.onRemove}
                aria-label="Remove assistant"
                className="rounded-xl p-2.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={assistant.onAdd}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 -ml-3 text-sm font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <Plus className="h-4 w-4" aria-hidden /> Add assistant
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
};

/* --------------------------- Collapsible section --------------------------- */

const Disclosure: React.FC<{
  id: string;
  title: string;
  hint?: string;
  badge?: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ id, title, hint, badge, icon, open, onToggle, children }) => (
  <section className="rounded-2xl border border-gray-200 bg-white">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={id}
      className="flex w-full items-center gap-3 rounded-2xl px-4 min-h-[56px] py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        {hint ? <span className="block text-xs text-gray-500">{hint}</span> : null}
      </span>
      {badge ? (
        <span className="rounded-full bg-[var(--color-accent-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--color-accent)]">
          {badge}
        </span>
      ) : null}
      <ChevronDown className={cn('h-5 w-5 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} aria-hidden />
    </button>
    {open ? (
      <div id={id} className="space-y-3 border-t border-gray-100 p-4">
        {children}
      </div>
    ) : null}
  </section>
);

/* ---------------------------------- Step ---------------------------------- */

export const TeamStep: React.FC<TeamStepProps> = ({
  form,
  actions,
  employees,
  punchInCandidates = [],
  currentUser,
  isAdmin,
  mode = 'create',
  allowAssistants,
  allowReturnSpecial = true,
  badges,
  allowPrepAssignToMe,
  punchError,
}) => {
  const startIdx = ASSIGNABLE_WORKFLOW_STAGES.indexOf(form.startStage);
  const activeStages = ASSIGNABLE_WORKFLOW_STAGES.slice(startIdx);
  const skippedStages = ASSIGNABLE_WORKFLOW_STAGES.slice(0, startIdx);
  const coreStages = CORE_STAGES.filter((s) => activeStages.includes(s));
  const dutyKinds = CASE_DUTY_KINDS.filter((k) => (activeStages as string[]).includes(CASE_DUTY_WORKFLOW_STAGE[k]));

  const [moreOpen, setMoreOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [target, setTarget] = useState<PickerTarget>({ kind: 'punch' });

  // Nothing to show in the main block (admin started late) → open the duties list by default.
  useEffect(() => {
    if (coreStages.length === 0) setMoreOpen(true);
  }, [coreStages.length]);

  const openPicker = (t: PickerTarget) => {
    setTarget(t);
    setPickerOpen(true);
  };

  const view = (value: string | undefined) => resolveAssignee(value, employees, currentUser);
  const assignedDuties = dutyKinds.filter((k) => form.dutyEmployeeIds[k]).length;

  const sheet = useMemo(() => {
    switch (target.kind) {
      case 'stage': {
        const { stage } = target;
        return {
          title: STAGE_COPY[stage].question,
          subtitle: undefined as string | undefined,
          employees,
          value: form.stageEmployeeIds[stage] ?? '',
          onSelect: (v: string) => actions.setStageEmployee(stage, v),
          allowHospitalSelf: stage === 'Surgery',
          allowReturnSpecial: false,
          suggestedDepartment: STAGE_DEPARTMENT_MAP[stage],
          excludeId: undefined as string | undefined,
          clearLabel: 'Assign later',
          allowClear: true,
        };
      }
      case 'assistant': {
        const { stage } = target;
        return {
          title: 'Add assistant',
          subtitle: STAGE_COPY[stage].label,
          employees,
          value: form.stageAssistantIds[stage] ?? '',
          onSelect: (v: string) => actions.setAssistant(stage, v),
          allowHospitalSelf: false,
          allowReturnSpecial: false,
          suggestedDepartment: STAGE_DEPARTMENT_MAP[stage],
          excludeId: form.stageEmployeeIds[stage] || undefined,
          clearLabel: 'Remove assistant',
          allowClear: true,
        };
      }
      case 'duty': {
        const { duty } = target;
        return {
          title: CASE_DUTY_LABELS[duty],
          subtitle: DUTY_COPY[duty],
          employees,
          value: form.dutyEmployeeIds[duty] ?? '',
          onSelect: (v: string) => actions.setDuty(duty, v),
          allowHospitalSelf: false,
          allowReturnSpecial: allowReturnSpecial && duty === 'return',
          suggestedDepartment: STAGE_DEPARTMENT_MAP[CASE_DUTY_WORKFLOW_STAGE[duty]],
          excludeId: undefined,
          clearLabel: 'Assign later',
          allowClear: true,
        };
      }
      default:
        return {
          title: 'Who punched in this case?',
          subtitle: undefined,
          employees: punchInCandidates,
          value: form.punchedInByEmployeeId,
          onSelect: (v: string) => actions.setPunchedInBy(v),
          allowHospitalSelf: false,
          allowReturnSpecial: false,
          suggestedDepartment: undefined,
          excludeId: undefined,
          clearLabel: 'Clear',
          allowClear: false,
        };
    }
  }, [target, employees, punchInCandidates, form, actions, allowReturnSpecial]);

  const isCreate = mode === 'create';
  const assistantsOn = allowAssistants ?? isAdmin;

  return (
    <div className="space-y-4">
      {isCreate && !isAdmin ? (
        <p className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
          Only assign what you know now — anything left blank can be assigned later from the case.
        </p>
      ) : null}

      {isCreate && isAdmin ? (
        <TeamRow
          label="Punched in by"
          question="Who is entering this case?"
          view={resolveAssignee(form.punchedInByEmployeeId, punchInCandidates, currentUser)}
          error={punchError}
          onChoose={() => openPicker({ kind: 'punch' })}
        />
      ) : null}

      {coreStages.map((stage) => {
        const copy = STAGE_COPY[stage];
        const isPrep = stage === SET_PREPARATION_STAGE;
        const fcfs = isFcfsStage(stage);
        const value = form.stageEmployeeIds[stage] ?? '';
        const supportsAssistant = assistantsOn && stageSupportsAssistant(stage);
        const assistantStage = stage as StageWithAssistant;
        return (
          <TeamRow
            key={stage}
            label={copy.label}
            question={copy.question}
            view={view(value)}
            badge={
              badges?.[stage] ??
              (isCreate && isAdmin && stage === form.startStage && stage !== SET_PREPARATION_STAGE ? 'Starts here' : undefined)
            }
            emphasised={isPrep && allowPrepAssignToMe}
            note={fcfs ? 'Pool stage — assigned when it opens on the board.' : undefined}
            onChoose={() => openPicker({ kind: 'stage', stage })}
            onPickHospitalSelf={
              stage === 'Surgery' ? () => actions.setStageEmployee(stage, SURGERY_SELF_ASSIGNMENT_VALUE) : undefined
            }
            assistant={
              supportsAssistant
                ? {
                    view: view(form.stageAssistantIds[assistantStage]),
                    onAdd: () => openPicker({ kind: 'assistant', stage: assistantStage }),
                    onRemove: () => actions.setAssistant(assistantStage, ''),
                  }
                : null
            }
          />
        );
      })}

      {dutyKinds.length > 0 ? (
        <Disclosure
          id="cc-more-assignments"
          title="More assignments"
          hint="Return, checking & audit, restock — optional"
          badge={assignedDuties > 0 ? `${assignedDuties} set` : undefined}
          open={moreOpen}
          onToggle={() => setMoreOpen((v) => !v)}
        >
          {dutyKinds.map((kind) => (
            <TeamRow
              key={kind}
              label={CASE_DUTY_LABELS[kind]}
              question={DUTY_COPY[kind]}
              view={view(form.dutyEmployeeIds[kind])}
              onChoose={() => openPicker({ kind: 'duty', duty: kind })}
            />
          ))}
        </Disclosure>
      ) : null}

      {isCreate && isAdmin ? (
        <Disclosure
          id="cc-admin-options"
          title="Admin options"
          hint="Start stage"
          icon={<ShieldCheck className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />}
          open={adminOpen}
          onToggle={() => setAdminOpen((v) => !v)}
        >
          <div role="radiogroup" aria-label="Start case at stage" className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">Start case at stage</p>
            <p className="text-xs text-gray-500">
              Use when work already started outside the app — e.g. jump in at Delivery or Surgery.
            </p>
            {ASSIGNABLE_WORKFLOW_STAGES.map((stage) => {
              const selected = stage === form.startStage;
              return (
                <button
                  key={stage}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => actions.setStartStage(stage)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-xl border px-4 min-h-[48px] text-left text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
                    selected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-gray-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                  )}
                >
                  <span>
                    {stage}
                    {stage === SET_PREPARATION_STAGE ? <span className="ml-1 text-xs font-normal text-gray-500">(normal start)</span> : null}
                  </span>
                  {selected ? <Check className="h-5 w-5 text-[var(--color-accent)]" aria-hidden /> : null}
                </button>
              );
            })}
            {skippedStages.length > 0 ? (
              <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                Earlier stages will be marked skipped: {skippedStages.join(', ')}
              </p>
            ) : null}
          </div>

        </Disclosure>
      ) : null}

      <EmployeePickerSheet
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={sheet.title}
        subtitle={sheet.subtitle}
        employees={sheet.employees}
        value={sheet.value}
        onSelect={sheet.onSelect}
        allowHospitalSelf={sheet.allowHospitalSelf}
        allowReturnSpecial={sheet.allowReturnSpecial}
        suggestedDepartment={sheet.suggestedDepartment}
        excludeId={sheet.excludeId}
        clearLabel={sheet.clearLabel}
        allowClear={sheet.allowClear}
      />
    </div>
  );
};
