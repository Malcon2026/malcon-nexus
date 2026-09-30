import React from 'react';
import { ClipboardCheck, PackageCheck, Undo2, type LucideIcon } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { Card, CardBody, CardHeader } from './ui/Card';
import { ReturnOutcomeBadge } from './ReturnOutcomeBadge';
import type { ImplantCase } from '../types';
import {
  CASE_DUTY_KINDS,
  CASE_DUTY_LABELS,
  CASE_DUTY_WORKFLOW_STAGE,
  getDutyEmployee,
  type CaseDutyKind,
} from '../lib/caseDuties';
import { findStageRecord } from '../lib/caseWorkflow';

/** Plain-language description + icon per responsibility (display only). */
const DUTY_UI: Record<CaseDutyKind, { hint: string; Icon: LucideIcon }> = {
  return: { hint: 'Pickup from hospital', Icon: Undo2 },
  cleaning: { hint: 'Verify and audit returned implants', Icon: ClipboardCheck },
  restock: { hint: 'Return items to store and complete restocking', Icon: PackageCheck },
};

interface AfterSurgeryTeamProps {
  case: ImplantCase;
  /** Shown only when an existing route to the Case Duties page is available to this user. */
  onManage?: () => void;
  /** Render without its own card (inside another surface). */
  bare?: boolean;
}

/**
 * Read-only summary of who handles Return, Checking & audit and Restock.
 * Data comes from the same helpers as before (`getDutyEmployee`, stage `returnOutcome`).
 */
export const AfterSurgeryTeam: React.FC<AfterSurgeryTeamProps> = ({ case: c, onManage, bare = false }) => {
  const returnOutcome = findStageRecord(c.stages, CASE_DUTY_WORKFLOW_STAGE.return)?.returnOutcome ?? null;

  const header = (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              className={
                bare
                  ? 'text-xs font-medium uppercase tracking-wide text-gray-500'
                  : 'text-sm font-semibold text-gray-900'
              }
            >
              After-surgery team
            </h3>
            <p className="mt-0.5 text-xs font-normal text-gray-500">
              People assigned to return, checking &amp; audit, and restock.
            </p>
          </div>
          {onManage ? (
            <button
              type="button"
              onClick={onManage}
              className="-my-1 -mr-2 inline-flex min-h-[40px] shrink-0 items-center rounded-lg px-2 text-xs font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              Manage assignments →
            </button>
          ) : null}
        </div>
  );

  const list = (
        <ul className="divide-y divide-gray-100">
          {CASE_DUTY_KINDS.map((kind) => {
            const emp = getDutyEmployee(c, kind);
            const outcome = kind === 'return' && !emp ? returnOutcome : null;
            const { hint, Icon } = DUTY_UI[kind];
            return (
              <li
                key={kind}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{CASE_DUTY_LABELS[kind]}</p>
                    <p className="text-xs text-gray-500">{hint}</p>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-2.5 pl-11 sm:pl-0 sm:justify-end">
                  {emp ? (
                    <>
                      <Avatar name={emp.name} size="sm" />
                      <div className="min-w-0 sm:text-right">
                        <p className="truncate text-sm font-semibold text-gray-900">{emp.name}</p>
                        {emp.department ? <p className="truncate text-xs text-gray-500">{emp.department}</p> : null}
                      </div>
                    </>
                  ) : outcome ? (
                    <ReturnOutcomeBadge outcome={outcome} />
                  ) : (
                    <p className="text-sm text-gray-400">Not assigned yet</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
  );

  if (bare) {
    return (
      <div>
        <div className="px-4 pt-4 pb-1 sm:px-6">{header}</div>
        <div className="px-4 sm:px-6">{list}</div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="!py-3">{header}</CardHeader>
      <CardBody className="!py-0">{list}</CardBody>
    </Card>
  );
};
