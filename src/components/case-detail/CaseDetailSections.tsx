import React from 'react';
import { Building2, HandMetal, Mail, Phone, User } from 'lucide-react';
import type { Employee, ImplantCase, StageRecord } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { CaseStageMiniGallery, useStagePhotoViewUrls } from './CaseStagePhotoAlbum';
import { RestockOutcomeBadge } from '../RestockOutcomeBadge';
import { ReturnOutcomeBadge } from '../ReturnOutcomeBadge';
import { AfterSurgeryTeam } from '../AfterSurgeryTeam';
import { cn } from '../../utils/cn';
import { formatCurrency, formatDate, formatDateTime, timeAgo } from '../../utils/helpers';

const surface =
  'rounded-[var(--radius-lg)] border border-[var(--color-separator)] bg-white shadow-[var(--shadow-card)]';
const sectionTitle = 'text-xs font-medium uppercase tracking-wide text-gray-500';

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="text-xs text-gray-500">{label}</dt>
    <dd className="mt-0.5 break-words text-sm font-medium text-gray-900">{value}</dd>
  </div>
);

/* --------------------------------- Overview -------------------------------- */

export const CaseOverview: React.FC<{ case: ImplantCase; onManageTeam?: () => void }> = ({ case: c, onManageTeam }) => {
  const details: { label: string; value: React.ReactNode }[] = [
    { label: 'Surgery date', value: formatDate(c.surgeryDate) },
    { label: 'Procedure', value: c.implantRequired },
    ...(c.implantType ? [{ label: 'Implant type', value: c.implantType }] : []),
    ...(c.implantCompany ? [{ label: 'Implant company', value: c.implantCompany }] : []),
    { label: 'Case added by', value: c.createdBy },
    { label: 'Created', value: formatDate(c.createdAt) },
    ...(c.dueDate && c.dueDate !== c.surgeryDate ? [{ label: 'Due date', value: formatDate(c.dueDate) }] : []),
  ];
  const reasons: { label: string; value: React.ReactNode }[] = [
    ...(c.cancelReason ? [{ label: 'Cancel reason', value: c.cancelReason }] : []),
    ...(c.postponeReason ? [{ label: 'Postpone reason', value: c.postponeReason }] : []),
    ...(c.postponeReason && c.postponedFrom ? [{ label: 'Original surgery date', value: formatDate(c.postponedFrom) }] : []),
  ];
  const hospitalContacts = [
    c.hospital.contactPerson ? { icon: User, value: c.hospital.contactPerson } : null,
    c.hospital.phone ? { icon: Phone, value: c.hospital.phone } : null,
    c.hospital.email ? { icon: Mail, value: c.hospital.email } : null,
  ].filter(Boolean) as { icon: typeof User; value: string }[];
  const showBilling = Boolean(c.invoiceAmount && c.invoiceAmount > 0);

  return (
    <div className={cn(surface, 'lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]')}>
      <div className="divide-y divide-gray-100">
        <section className="px-4 py-5 sm:px-6">
          <h3 className={sectionTitle}>Case details</h3>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {details.map((d) => (
              <Field key={d.label} {...d} />
            ))}
          </dl>
          {reasons.length > 0 ? (
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {reasons.map((d) => (
                <Field key={d.label} {...d} />
              ))}
            </dl>
          ) : null}
          {c.remarks ? (
            <div className="mt-4">
              <p className="text-xs text-gray-500">Notes</p>
              <p className="mt-1 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-gray-700">{c.remarks}</p>
            </div>
          ) : null}
        </section>

        <section className="py-1">
          <AfterSurgeryTeam case={c} onManage={onManageTeam} bare />
        </section>
      </div>

      <div className="divide-y divide-gray-100 border-t border-gray-100 lg:border-t-0 lg:border-l">
        <section className="px-4 py-5 sm:px-6">
          <h3 className={sectionTitle}>Hospital</h3>
          <div className="mt-3 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
              <Building2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-gray-900">{c.hospital.name}</p>
              {[c.hospital.branch, c.hospital.city].filter(Boolean).length > 0 ? (
                <p className="text-xs text-gray-500">{[c.hospital.branch, c.hospital.city].filter(Boolean).join(' · ')}</p>
              ) : null}
              {hospitalContacts.map(({ icon: Icon, value }) => (
                <p key={value} className="mt-1.5 flex items-center gap-1.5 break-all text-xs text-gray-600">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                  {value}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-5 sm:px-6">
          <h3 className={sectionTitle}>Doctor</h3>
          <div className="mt-3 flex items-start gap-3">
            <Avatar name={c.doctor.name} size="lg" />
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-gray-900">{c.doctor.name}</p>
              {c.doctor.specialization ? <p className="text-xs text-gray-500">{c.doctor.specialization}</p> : null}
              {c.doctor.phone ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-600">
                  <Phone className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                  {c.doctor.phone}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {showBilling ? (
          <section className="px-4 py-5 sm:px-6">
            <h3 className={sectionTitle}>Billing</h3>
            <dl className="mt-3 grid grid-cols-2 gap-4">
              <Field label="Invoice" value={formatCurrency(c.invoiceAmount ?? 0)} />
              <Field label="Collected" value={formatCurrency(c.collectedAmount || 0)} />
              <Field
                label="Payment status"
                value={
                  <Badge className={c.paymentStatus === 'Collected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                    {c.paymentStatus || 'Pending'}
                  </Badge>
                }
              />
            </dl>
          </section>
        ) : null}
      </div>
    </div>
  );
};

/* ------------------------------ Progress timeline ------------------------------ */

const PersonLine: React.FC<{ emp: Employee; small?: boolean }> = ({ emp, small }) => (
  <div className="flex items-center gap-2">
    <Avatar name={emp.name} size={small ? 'xs' : 'sm'} />
    <span className={cn('text-sm', small ? 'text-gray-600' : 'font-medium text-gray-900')}>{emp.name}</span>
    <span className="text-xs text-gray-500">{emp.department}</span>
  </div>
);

export const CaseProgressTimeline: React.FC<{
  stages: StageRecord[];
  currentIndex: number;
  viewer: Employee;
}> = ({ stages, currentIndex, viewer }) => {
  const photoUrls = useStagePhotoViewUrls(stages, viewer);

  return (
  <div className={cn(surface, 'px-4 py-2 sm:px-6')}>
    <ol>
      {stages.map((stage, idx) => {
        const isCurrent = idx === currentIndex;
        const isDone = idx < currentIndex || stage.status === 'Approved';
        const last = idx === stages.length - 1;
        const dates = [
          stage.assignedAt ? `Assigned ${formatDate(stage.assignedAt)}` : null,
          stage.submittedAt ? `Submitted ${formatDate(stage.submittedAt)}` : null,
          stage.approvedAt ? `Approved ${formatDate(stage.approvedAt)}` : null,
        ].filter(Boolean);
        return (
          <li key={stage.stage} className="relative flex gap-4 py-4" aria-current={isCurrent ? 'step' : undefined}>
            {!last ? (
              <span
                className={cn('absolute left-[11px] top-10 bottom-0 w-0.5', isDone ? 'bg-[var(--color-accent)]' : 'bg-gray-100')}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                'relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                isDone && 'bg-[var(--color-accent)] text-white',
                isCurrent && !isDone && 'bg-white text-[var(--color-accent)] ring-2 ring-[var(--color-accent)]',
                !isDone && !isCurrent && 'bg-gray-100 text-gray-400',
              )}
            >
              {isDone ? '✓' : idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h4 className={cn('text-sm', isCurrent ? 'font-semibold text-gray-900' : isDone ? 'font-medium text-gray-900' : 'text-gray-500')}>
                  {stage.stage}
                  {isCurrent ? <span className="ml-2 text-xs font-medium text-[var(--color-accent)]">Now</span> : null}
                </h4>
                <span className="text-xs text-gray-500">{stage.status}</span>
              </div>

              {stage.stage !== 'Completed' ? (
                <div className="mt-2 space-y-1.5">
                  {stage.selfPerformed ? (
                    <p className="flex items-center gap-2 text-sm text-amber-700">
                      <HandMetal className="h-4 w-4" aria-hidden />
                      Self — Hospital performed independently
                    </p>
                  ) : stage.assignedEmployee ? (
                    <PersonLine emp={stage.assignedEmployee} />
                  ) : (
                    <p className="text-sm text-gray-400">No employee assigned yet</p>
                  )}
                  {!stage.selfPerformed && stage.assistantEmployee ? (
                    <div className="pl-1">
                      <PersonLine emp={stage.assistantEmployee} small />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {dates.length > 0 ? <p className="mt-2 text-xs text-gray-400">{dates.join(' · ')}</p> : null}

              {stage.returnOutcome || stage.restockOutcome ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {stage.returnOutcome ? <ReturnOutcomeBadge outcome={stage.returnOutcome} /> : null}
                  {stage.restockOutcome ? <RestockOutcomeBadge outcome={stage.restockOutcome} /> : null}
                </div>
              ) : null}

              {stage.notes ? (
                <p className="mt-2 border-l-2 border-gray-200 pl-3 text-sm text-gray-700">
                  <span className="block text-xs font-medium text-gray-500">Employee notes</span>
                  {stage.notes}
                </p>
              ) : null}
              {stage.adminNotes ? (
                <p className="mt-2 border-l-2 border-blue-200 pl-3 text-sm text-gray-700">
                  <span className="block text-xs font-medium text-blue-600">Admin notes</span>
                  {stage.adminNotes}
                </p>
              ) : null}

              <CaseStageMiniGallery
                stage={stage}
                canView={photoUrls.canView}
                viewUrls={photoUrls.viewUrls}
                loading={photoUrls.loading}
              />
            </div>
          </li>
        );
      })}
    </ol>
  </div>
  );
};

/* --------------------------------- Activity --------------------------------- */

export const CaseActivity: React.FC<{ logs: ImplantCase['activityLogs'] }> = ({ logs }) => {
  if (logs.length === 0) {
    return <div className={cn(surface, 'py-12 text-center text-sm text-gray-400')}>No activity yet</div>;
  }
  const newestFirst = [...logs].reverse();
  return (
    <div className={cn(surface, 'px-4 py-2 sm:px-6')}>
      <ol>
        {newestFirst.map((log, i) => (
          <li key={log.id} className="relative flex gap-3 py-3.5">
            {i < newestFirst.length - 1 ? (
              <span className="absolute left-[13px] top-11 bottom-0 w-px bg-gray-100" aria-hidden />
            ) : null}
            <Avatar name={log.performedBy} size="sm" className="relative z-10" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-900">
                <span className="font-semibold">{log.performedBy}</span>
                <span className="text-gray-500"> · {log.action}</span>
              </p>
              {log.details ? <p className="mt-0.5 text-sm text-gray-600">{log.details}</p> : null}
              <p className="mt-1 text-xs text-gray-400">{formatDateTime(log.timestamp)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

/* --------------------------------- Comments --------------------------------- */

export const CaseComments: React.FC<{ comments: ImplantCase['comments'] }> = ({ comments }) => (
  <div className={cn(surface, 'divide-y divide-gray-100')}>
    {comments.map((cmt) => (
      <div key={cmt.id} className="flex items-start gap-3 px-4 py-4 sm:px-6">
        <Avatar name={cmt.author} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-semibold text-gray-900">{cmt.author}</span>
            {cmt.department ? <span className="text-gray-500"> · {cmt.department}</span> : null}
            <span className="text-xs text-gray-400"> · {timeAgo(cmt.timestamp)}</span>
          </p>
          <p className="mt-1 text-sm text-gray-700">{cmt.content}</p>
        </div>
      </div>
    ))}
  </div>
);
