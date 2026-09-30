import React from 'react';
import { Building2, Check, CheckCircle2, Stethoscope, Users } from 'lucide-react';
import { cn } from '../../utils/cn';

export const CASE_CREATE_STEPS = [
  { key: 'hospital', label: 'Hospital', title: 'Where is the surgery?', icon: Building2 },
  { key: 'surgery', label: 'Surgery', title: 'When and who?', icon: Stethoscope },
  { key: 'team', label: 'Team', title: 'Who is on the team?', icon: Users },
  { key: 'review', label: 'Review', title: 'Ready to create?', icon: CheckCircle2 },
] as const;

/** Compact progress — phones and tablets. */
export const CaseCreateProgress: React.FC<{ step: number }> = ({ step }) => (
  <div
    role="progressbar"
    aria-valuemin={1}
    aria-valuemax={CASE_CREATE_STEPS.length}
    aria-valuenow={step + 1}
    aria-label={`Step ${step + 1} of ${CASE_CREATE_STEPS.length}: ${CASE_CREATE_STEPS[step].label}`}
    className="flex gap-1.5"
  >
    {CASE_CREATE_STEPS.map((s, i) => (
      <span
        key={s.key}
        className={cn(
          'h-1.5 flex-1 rounded-full transition-colors',
          i <= step ? 'bg-[var(--color-accent)]' : 'bg-gray-200',
        )}
      />
    ))}
  </div>
);

/** Vertical step list — desktop left rail. Completed steps can be revisited. */
export const CaseCreateRail: React.FC<{
  step: number;
  maxStep: number;
  onGo: (index: number) => void;
}> = ({ step, maxStep, onGo }) => (
  <nav aria-label="Case creation steps">
    <ol className="space-y-1">
      {CASE_CREATE_STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = i < step;
        const current = i === step;
        const reachable = i <= maxStep;
        return (
          <li key={s.key}>
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onGo(i)}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 min-h-[48px] text-left text-sm font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
                current
                  ? 'bg-[var(--color-accent-muted)] text-gray-900'
                  : reachable
                    ? 'text-gray-700 hover:bg-gray-100'
                    : 'text-gray-400 cursor-not-allowed',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  done
                    ? 'bg-[var(--color-accent)] text-white'
                    : current
                      ? 'border-2 border-[var(--color-accent)] text-[var(--color-accent)]'
                      : 'border border-gray-300 text-gray-400',
                )}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
              </span>
              <span>
                {s.label}
                {done ? <span className="sr-only"> (completed)</span> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  </nav>
);
