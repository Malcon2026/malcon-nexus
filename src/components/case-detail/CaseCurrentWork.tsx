import React, { useState } from 'react';
import { Check, ChevronDown, User } from 'lucide-react';
import type { Employee, WorkflowStage } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { stageColors } from '../../utils/helpers';

export interface CaseAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  /** Set on actions that may lead the area. Actions without a tone never become the big button. */
  tone?: 'primary' | 'success';
  /** Secondary actions with a destructive meaning get red text. */
  danger?: boolean;
  disabled?: boolean;
}

const STAGE_SHORT: Partial<Record<WorkflowStage, string>> = {
  'Set Preparation': 'Set Preparation',
  'Pickup from Hospital': 'Pickup',
  'Checking & Audit': 'Checking',
};

const shortStage = (s: WorkflowStage) => STAGE_SHORT[s] ?? s;

interface CaseCurrentWorkProps {
  currentStage: WorkflowStage;
  stages: WorkflowStage[];
  currentIndex: number;
  owner: Employee | null;
  assistant: Employee | null;
  /** One sentence describing the situation, e.g. "Waiting for admin approval". */
  statusLine?: string | null;
  actions: CaseAction[];
  /** Non-button items shown with actions (e.g. "Request pending" badge). */
  extra?: React.ReactNode;
}

/** The heart of Case Detail: where the case is, who has it, what to do now. */
export const CaseCurrentWork: React.FC<CaseCurrentWorkProps> = ({
  currentStage,
  stages,
  currentIndex,
  owner,
  assistant,
  statusLine,
  actions,
  extra,
}) => {
  const [stepsOpen, setStepsOpen] = useState(false);
  const idx = Math.max(currentIndex, 0);
  const sc = stageColors[currentStage];
  const primary = actions.find((a) => a.tone);
  const secondary = actions.filter((a) => a !== primary);

  const ownerBlock = (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Assigned to</p>
      {owner || assistant ? (
        <div className="mt-3 space-y-3">
          {owner ? (
            <div className="flex items-center gap-3">
              <Avatar name={owner.name} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-gray-900">{owner.name}</p>
                <p className="truncate text-sm text-gray-500">{owner.department}</p>
              </div>
            </div>
          ) : null}
          {assistant ? (
            <div className="flex items-center gap-3">
              <Avatar name={assistant.name} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{assistant.name}</p>
                <p className="text-xs text-gray-500">{owner ? 'Assistant · the main person submits' : 'Assistant only'}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <User className="h-5 w-5" />
          </span>
          <p className="text-sm text-gray-500">No one assigned yet</p>
        </div>
      )}
    </div>
  );

  const actionBlock = (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">What happens now</p>
      {statusLine ? <p className="mt-2 text-sm text-gray-700">{statusLine}</p> : null}
      {primary || secondary.length > 0 ? (
        <div className="mt-3 space-y-2">
          {primary ? (
          <Button
            type="button"
            variant={primary.tone === 'success' ? 'success' : 'primary'}
            icon={primary.icon}
            disabled={primary.disabled}
            onClick={primary.onClick}
            className="min-h-[52px] w-full justify-center text-base font-semibold"
          >
            {primary.label}
          </Button>
          ) : null}
          {secondary.length > 0 ? (
            <div className={cn('grid gap-2', secondary.length > 1 && 'sm:grid-cols-2')}>
              {secondary.map((a) => (
                <Button
                  key={a.key}
                  type="button"
                  variant="outline"
                  icon={a.icon}
                  disabled={a.disabled}
                  onClick={a.onClick}
                  className={cn('min-h-[44px] w-full justify-center', a.danger && 'text-red-600')}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : !statusLine ? (
        <p className="mt-2 text-sm text-gray-500">Nothing for you to do on this case right now.</p>
      ) : null}
      {extra ? <div className="mt-3">{extra}</div> : null}
    </div>
  );

  return (
    <section
      aria-label="Current work"
      className="mb-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-separator)] bg-white shadow-[var(--shadow-card)]"
    >
      {/* Stage + progress */}
      <div className="px-4 pt-5 pb-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Current stage</p>
            <div className="mt-1 flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', sc.dot)} aria-hidden />
              <h2 className="truncate text-xl font-semibold text-gray-900 sm:text-2xl">{currentStage}</h2>
            </div>
          </div>
          <p className="shrink-0 pt-5 text-sm font-medium text-gray-500">
            Step {idx + 1} of {stages.length}
          </p>
        </div>

        {/* Desktop stepper */}
        <ol className="mt-5 hidden items-start sm:flex" aria-label="Case progress">
          {stages.map((stage, i) => {
            const done = i < idx;
            const current = i === idx;
            return (
              <li key={stage} className="flex min-w-0 flex-1 flex-col" aria-current={current ? 'step' : undefined}>
                <div className="flex items-center">
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                      done && 'bg-[var(--color-accent)] text-white',
                      current && 'bg-white text-[var(--color-accent)] ring-2 ring-[var(--color-accent)]',
                      !done && !current && 'bg-gray-100 text-gray-400',
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                  </span>
                  {i < stages.length - 1 ? (
                    <span className={cn('mx-1 h-0.5 flex-1 rounded-full', done ? 'bg-[var(--color-accent)]' : 'bg-gray-100')} />
                  ) : null}
                </div>
                <span
                  className={cn(
                    'mt-2 truncate pr-2 text-xs',
                    current ? 'font-semibold text-gray-900' : done ? 'text-gray-600' : 'text-gray-400',
                  )}
                >
                  {shortStage(stage)}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Mobile: slim bar + expandable list */}
        <div className="mt-4 sm:hidden">
          <div className="flex gap-1" aria-hidden>
            {stages.map((stage, i) => (
              <span
                key={stage}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  i < idx ? 'bg-[var(--color-accent)]' : i === idx ? sc.dot : 'bg-gray-100',
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStepsOpen((v) => !v)}
            aria-expanded={stepsOpen}
            className="mt-2 -ml-1 inline-flex min-h-[40px] items-center gap-1 rounded-lg px-1 text-sm font-medium text-[var(--color-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            {stepsOpen ? 'Hide steps' : 'Show all steps'}
            <ChevronDown className={cn('h-4 w-4 transition-transform', stepsOpen && 'rotate-180')} aria-hidden />
          </button>
          {stepsOpen ? (
            <ol className="mt-1 space-y-2" aria-label="Case progress">
              {stages.map((stage, i) => {
                const done = i < idx;
                const current = i === idx;
                return (
                  <li key={stage} className="flex items-center gap-3" aria-current={current ? 'step' : undefined}>
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                        done && 'bg-[var(--color-accent)] text-white',
                        current && 'ring-2 ring-[var(--color-accent)]',
                        !done && !current && 'border border-gray-300',
                      )}
                    >
                      {done ? <Check className="h-3 w-3" aria-hidden /> : null}
                    </span>
                    <span className={cn('text-sm', current ? 'font-semibold text-gray-900' : done ? 'text-gray-700' : 'text-gray-400')}>
                      {stage}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </div>
      </div>

      {/* Owner + actions */}
      <div className="grid gap-6 border-t border-gray-100 px-4 py-5 sm:px-6 lg:grid-cols-2 lg:gap-10">
        {ownerBlock}
        <div className="border-t border-gray-100 pt-5 lg:border-t-0 lg:border-l lg:pl-10 lg:pt-0">{actionBlock}</div>
      </div>
    </section>
  );
};
