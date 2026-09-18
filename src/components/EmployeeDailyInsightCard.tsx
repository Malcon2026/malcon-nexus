import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { GeminiIcon } from './PoweredByAiBadge';
import { Card, CardBody } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Te } from './BilingualText';
import {
  buildEmployeeDashboardMetrics,
  fetchEmployeeDashboardInsight,
  type DashboardInsightResult,
} from '../lib/dashboardInsights';
import { useStore } from '../store/useStore';
import type { Employee } from '../types';
import { cn } from '../utils/cn';

type Props = {
  employee: Employee;
  onOpenAttendance?: () => void;
  onOpenCases?: () => void;
  onOpenFood?: () => void;
};

export const EmployeeDailyInsightCard: React.FC<Props> = ({
  employee,
  onOpenAttendance,
  onOpenCases,
  onOpenFood,
}) => {
  const attendanceRecords = useStore((s) => s.attendanceRecords);
  const cases = useStore((s) => s.cases);
  const foodSelections = useStore((s) => s.foodSelections);
  const leaveRequests = useStore((s) => s.leaveRequests);
  const locationTrips = useStore((s) => s.locationTrips);
  const petrolRequests = useStore((s) => s.petrolRequests);
  const unreadAlerts = useStore((s) => s.notifications.filter((n) => !n.read).length);

  const metrics = useMemo(
    () =>
      buildEmployeeDashboardMetrics(
        employee,
        attendanceRecords,
        cases,
        foodSelections,
        leaveRequests,
        locationTrips,
        petrolRequests,
        unreadAlerts,
      ),
    [
      employee,
      attendanceRecords,
      cases,
      foodSelections,
      leaveRequests,
      locationTrips,
      petrolRequests,
      unreadAlerts,
    ],
  );

  const [result, setResult] = useState<DashboardInsightResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorHint, setErrorHint] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setErrorHint(null);
      try {
        const next = await fetchEmployeeDashboardInsight(metrics, { refresh });
        setResult(next);
        if (next.notice) {
          setErrorHint(next.notice);
        } else if (next.source === 'demo') {
          setErrorHint(
            next.errorDetail
              ? `On-device brief. ${next.errorDetail}`
              : 'On-device brief. AI text loads when Gemini is configured.',
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [metrics],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const statPills = useMemo(() => {
    const pills: { label: string; value: string; warn?: boolean; onClick?: () => void }[] = [
      {
        label: 'Yesterday',
        value: metrics.yesterdayPunched ? metrics.yesterdayWorkedLabel : 'No punch',
      },
      {
        label: 'Today',
        value: metrics.todayPunchLabel ?? (metrics.todayPunchedIn ? 'In' : 'Not in'),
        warn: !metrics.todayPunchedIn && !metrics.todayPunchLabel,
        onClick: onOpenAttendance,
      },
      {
        label: 'Cases',
        value:
          metrics.casesNeedingSubmit > 0
            ? `${metrics.casesNeedingSubmit} submit`
            : `${metrics.activeMyCases} active`,
        warn: metrics.casesNeedingSubmit > 0,
        onClick: onOpenCases,
      },
      {
        label: 'Food',
        value: metrics.foodSubmittedToday ? 'Done' : 'Pending',
        warn: !metrics.foodSubmittedToday,
        onClick: onOpenFood,
      },
    ];
    return pills;
  }, [metrics, onOpenAttendance, onOpenCases, onOpenFood]);

  return (
    <Card className="mb-4 overflow-hidden border-gray-200/80 shadow-sm bg-gradient-to-br from-sky-50/50 via-white to-white">
      <CardBody className="p-0">
        <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-gray-100/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl border border-sky-100 bg-white flex items-center justify-center shrink-0 shadow-sm">
              <GeminiIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-gray-900">Your day</h2>
                {(result?.source === 'gemini' || result?.source === 'cached') && (
                  <Badge className="bg-sky-100 text-sky-800 border-sky-200 text-[10px]">AI</Badge>
                )}
              </div>
              <p className="text-[11px] text-gray-500 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-sky-400" />
                Gemini · attendance &amp; your tasks
              </p>
              <Te className="text-[11px] text-gray-400 mb-0">Nee roju brief</Te>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />}
            onClick={() => void load(true)}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>

        <div className="px-4 py-3 flex flex-wrap gap-2">
          {statPills.map((pill) => {
            const inner = (
              <>
                <span className="text-[10px] uppercase tracking-wide text-gray-500">{pill.label}</span>
                <span className={cn('text-xs font-semibold', pill.warn ? 'text-amber-800' : 'text-gray-900')}>
                  {pill.value}
                </span>
              </>
            );
            if (pill.onClick) {
              return (
                <button
                  key={pill.label}
                  type="button"
                  onClick={pill.onClick}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-left min-w-[4.5rem] transition-colors',
                    pill.warn
                      ? 'border-amber-200 bg-amber-50/80 hover:bg-amber-50'
                      : 'border-gray-100 bg-white hover:bg-gray-50',
                  )}
                >
                  {inner}
                </button>
              );
            }
            return (
              <div
                key={pill.label}
                className="rounded-xl border border-gray-100 bg-white px-3 py-2 min-w-[4.5rem]"
              >
                {inner}
              </div>
            );
          })}
        </div>

        <div className="px-4 pb-4">
          {loading && !result ? (
            <div className="space-y-2" aria-hidden>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-3 rounded-full bg-sky-100/80 animate-pulse"
                  style={{ width: `${90 - i * 10}%` }}
                />
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
              {result?.summary}
            </div>
          )}
          {errorHint && !loading && (
            <p className="text-[11px] text-amber-800 mt-3 pt-2 border-t border-amber-100/80">{errorHint}</p>
          )}
        </div>
      </CardBody>
    </Card>
  );
};
