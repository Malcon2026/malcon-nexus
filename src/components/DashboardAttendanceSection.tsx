import React, { useMemo } from 'react';
import { ArrowRight, Clock } from 'lucide-react';
import { Card, CardHeader, CardBody } from './ui/Card';
import { Button } from './ui/Button';
import type { DashboardAttendanceMetrics } from '../lib/dashboardAttendanceMetrics';

type Props = {
  metrics: DashboardAttendanceMetrics;
  onOpenAttendance: () => void;
};

type StripSegment = {
  key: string;
  count: number;
  color: string;
  label: string;
};

const STRIP_COLORS = {
  in: '#30b07a',
  out: '#0071e3',
  leave: '#e8a020',
  absent: '#c7c7cc',
} as const;

function pct(count: number, total: number): number {
  if (total <= 0 || count <= 0) return 0;
  return (count / total) * 100;
}

export const DashboardAttendanceSection: React.FC<Props> = ({ metrics, onOpenAttendance }) => {
  const { totalStaff } = metrics;
  const accounted = metrics.present + metrics.onLeave + metrics.absent;

  const stripSegments: StripSegment[] = useMemo(
    () => [
      { key: 'in', count: metrics.punchedIn, color: STRIP_COLORS.in, label: 'In' },
      { key: 'out', count: metrics.punchedOut, color: STRIP_COLORS.out, label: 'Out' },
      { key: 'leave', count: metrics.onLeave, color: STRIP_COLORS.leave, label: 'Leave' },
      { key: 'absent', count: metrics.absent, color: STRIP_COLORS.absent, label: 'Absent' },
    ],
    [metrics],
  );

  const registerRows = useMemo(
    () => [
      { label: 'Punched in now', value: metrics.punchedIn, emphasis: metrics.punchedIn > 0 },
      { label: 'Punched out today', value: metrics.punchedOut, emphasis: false },
      { label: 'Absent', value: metrics.absent, emphasis: metrics.absent > 0 },
      { label: 'Approved leave', value: metrics.onLeave, emphasis: false },
      {
        label: 'Off-site (field / outside office)',
        value: metrics.offSite,
        emphasis: metrics.offSite > 0,
        note: metrics.offSite > 0 ? 'Includes pending off-site punch-in' : undefined,
      },
      {
        label: 'Unclosed shift',
        value: metrics.unclosed,
        emphasis: metrics.unclosed > 0,
        warn: metrics.unclosed > 0,
      },
    ],
    [metrics],
  );

  const pendingLine =
    metrics.pendingOffsiteApprovals > 0 || metrics.pendingLeaveApprovals > 0
      ? [
          metrics.pendingOffsiteApprovals > 0
            ? `${metrics.pendingOffsiteApprovals} off-site approval${metrics.pendingOffsiteApprovals === 1 ? '' : 's'}`
            : null,
          metrics.pendingLeaveApprovals > 0
            ? `${metrics.pendingLeaveApprovals} leave pending`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Attendance · Today</h3>
            <p className="text-xs text-gray-500 mt-0.5">Register snapshot · IST</p>
            {pendingLine && (
              <p className="text-xs text-amber-800 mt-1.5 flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0" aria-hidden />
                {pendingLine}
              </p>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenAttendance}
            className="shrink-0 w-full sm:w-auto"
            iconRight={<ArrowRight className="h-3.5 w-3.5" />}
          >
            Open Attendance
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-label-tertiary)]">
              Present today
            </p>
            <p className="mt-1 flex items-baseline gap-2 flex-wrap">
              <span className="text-4xl sm:text-[2.75rem] font-semibold tabular-nums tracking-tight text-[var(--color-label)] leading-none">
                {metrics.present}
              </span>
              <span className="text-lg text-[var(--color-label-secondary)] tabular-nums">
                / {totalStaff}
              </span>
            </p>
            <p className="text-xs text-[var(--color-label-secondary)] mt-2 max-w-md">
              {accounted === totalStaff
                ? 'Full register accounted for.'
                : `${accounted} of ${totalStaff} counted · refresh if someone just punched.`}
            </p>
          </div>
          <dl className="flex gap-6 sm:gap-8 text-right shrink-0">
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-[var(--color-label-tertiary)]">Off-site</dt>
              <dd className="text-xl font-semibold tabular-nums text-[var(--color-accent)]">{metrics.offSite}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-[var(--color-label-tertiary)]">Unclosed</dt>
              <dd
                className={`text-xl font-semibold tabular-nums ${
                  metrics.unclosed > 0 ? 'text-amber-700' : 'text-[var(--color-label)]'
                }`}
              >
                {metrics.unclosed}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <div
            className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-bg)] ring-1 ring-[var(--color-separator)]"
            role="img"
            aria-label={`Attendance mix: ${stripSegments.map((s) => `${s.label} ${s.count}`).join(', ')}`}
          >
            {stripSegments.map((seg) =>
              seg.count > 0 ? (
                <div
                  key={seg.key}
                  className="h-full min-w-[2px] transition-[width] duration-500 ease-out"
                  style={{
                    width: `${pct(seg.count, totalStaff)}%`,
                    backgroundColor: seg.color,
                  }}
                  title={`${seg.label}: ${seg.count}`}
                />
              ) : null,
            )}
            {totalStaff === 0 && (
              <div className="h-full w-full bg-[var(--color-separator)] opacity-40" aria-hidden />
            )}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--color-label-secondary)]">
            {stripSegments.map((seg) => (
              <li key={seg.key} className="flex items-center gap-1.5 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: seg.color }} aria-hidden />
                <span>{seg.label}</span>
                <span className="font-semibold text-[var(--color-label)]">{seg.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-separator)] overflow-hidden">
          <div className="px-4 py-2 bg-[var(--color-bg)] border-b border-[var(--color-separator)]">
            <p className="text-[11px] font-medium text-[var(--color-label-secondary)]">Register detail</p>
          </div>
          <ul className="divide-y divide-[var(--color-separator)]">
            {registerRows.map((row) => (
              <li
                key={row.label}
                className={`flex items-start justify-between gap-4 px-4 py-2.5 ${
                  row.warn ? 'bg-amber-50/80' : row.emphasis ? 'bg-[var(--color-bg)]/60' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm text-[var(--color-label)]">{row.label}</p>
                  {'note' in row && row.note && (
                    <p className="text-[10px] text-[var(--color-label-tertiary)] mt-0.5">{row.note}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {totalStaff > 0 && (
                    <div
                      className="hidden sm:block h-1 w-16 rounded-full bg-[var(--color-bg)] overflow-hidden"
                      aria-hidden
                    >
                      <div
                        className="h-full rounded-full bg-[var(--color-label-tertiary)] opacity-50"
                        style={{ width: `${Math.max(pct(row.value, totalStaff), row.value > 0 ? 8 : 0)}%` }}
                      />
                    </div>
                  )}
                  <span
                    className={`text-sm font-semibold tabular-nums min-w-[2ch] text-right ${
                      row.warn && row.value > 0 ? 'text-amber-800' : 'text-[var(--color-label)]'
                    }`}
                  >
                    {row.value}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </CardBody>
    </Card>
  );
};
