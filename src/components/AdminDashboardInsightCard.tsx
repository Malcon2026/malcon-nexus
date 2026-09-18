import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  UtensilsCrossed,
  CalendarOff,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { GeminiIcon } from './PoweredByAiBadge';
import { Card, CardBody } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Avatar } from './ui/Avatar';
import {
  fetchAdminDashboardInsight,
  type AdminDashboardMetrics,
  type DashboardInsightResult,
} from '../lib/dashboardInsights';
import {
  buildDashboardStaffSnapshot,
  filterStaffHighlights,
  type StaffHighlightKind,
} from '../lib/dashboardStaffSnapshot';
import { useStore } from '../store/useStore';
import { cn } from '../utils/cn';

type Props = {
  metrics: AdminDashboardMetrics;
};

type StaffFilter = 'all' | StaffHighlightKind | 'food';

const STAFF_FILTERS: { id: StaffFilter; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: <Users className="h-3.5 w-3.5" /> },
  { id: 'in', label: 'In', icon: <UserCheck className="h-3.5 w-3.5" /> },
  { id: 'out', label: 'Out', icon: <UserCheck className="h-3.5 w-3.5" /> },
  { id: 'absent', label: 'Absent', icon: <UserX className="h-3.5 w-3.5" /> },
  { id: 'leave', label: 'Leave', icon: <CalendarOff className="h-3.5 w-3.5" /> },
  { id: 'food', label: 'Food', icon: <UtensilsCrossed className="h-3.5 w-3.5" /> },
];

function kindBadge(kind: StaffHighlightKind): string {
  switch (kind) {
    case 'in':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'out':
      return 'bg-sky-50 text-sky-700 border-sky-100';
    case 'absent':
      return 'bg-gray-100 text-gray-600 border-gray-200';
    case 'leave':
      return 'bg-violet-50 text-violet-700 border-violet-100';
    case 'food':
      return 'bg-amber-50 text-amber-800 border-amber-100';
    default:
      return 'bg-gray-50 text-gray-600';
  }
}

export const AdminDashboardInsightCard: React.FC<Props> = ({ metrics }) => {
  const {
    employees,
    attendanceRecords,
    foodSelections,
    leaveRequests,
    setActiveTab,
  } = useStore();

  const [result, setResult] = useState<DashboardInsightResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [staffFilter, setStaffFilter] = useState<StaffFilter>('all');
  const [previewExpanded, setPreviewExpanded] = useState(true);

  const staffSnapshot = useMemo(
    () => buildDashboardStaffSnapshot(employees, attendanceRecords, foodSelections, leaveRequests),
    [employees, attendanceRecords, foodSelections, leaveRequests],
  );

  const filteredStaff = useMemo(
    () => filterStaffHighlights(staffSnapshot.highlights, staffFilter).slice(0, 12),
    [staffSnapshot.highlights, staffFilter],
  );

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setErrorHint(null);
    try {
      const next = await fetchAdminDashboardInsight(metrics, { refresh });
      setResult(next);
      if (next.notice) {
        setErrorHint(next.notice);
      } else if (next.source === 'demo') {
        setErrorHint(
          next.errorDetail
            ? `On-device preview. ${next.errorDetail}`
            : 'On-device preview. Add GEMINI_API_KEY for AI text.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, [metrics]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const statCount = (filter: StaffFilter): number => {
    if (filter === 'all') return staffSnapshot.totalStaff;
    if (filter === 'in') return staffSnapshot.punchedIn;
    if (filter === 'out') return staffSnapshot.punchedOut;
    if (filter === 'absent') return staffSnapshot.absent;
    if (filter === 'leave') return staffSnapshot.onLeaveToday;
    if (filter === 'food') return staffSnapshot.foodNotSubmitted;
    return 0;
  };

  return (
    <Card className="overflow-hidden border-gray-200/80 shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[280px]">
        {/* Preview panel */}
        <div className="border-b lg:border-b-0 lg:border-r border-gray-100 flex flex-col bg-gradient-to-br from-violet-50/40 via-white to-white">
          <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-gray-100/80">
            <button
              type="button"
              onClick={() => setPreviewExpanded((e) => !e)}
              className="flex items-center gap-2.5 text-left group min-w-0"
            >
              <div className="h-9 w-9 rounded-xl border border-violet-100 bg-white flex items-center justify-center shrink-0 shadow-sm">
                <GeminiIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-gray-900">Ops preview</h3>
                  {(result?.source === 'gemini' || result?.source === 'cached') && (
                    <Badge className="bg-violet-100 text-violet-800 border-violet-200 text-[10px]">
                      {result.source === 'cached' ? 'AI saved' : 'AI'}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-violet-400" />
                  Gemini · today&apos;s case numbers
                </p>
              </div>
            </button>
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

          <AnimatePresence initial={false}>
            {previewExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex-1 overflow-hidden"
              >
                <div className="px-4 sm:px-5 py-4 flex-1">
                  {loading && !result ? (
                    <div className="space-y-2.5" aria-hidden>
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="h-3 rounded-full bg-violet-100/80 animate-pulse"
                          style={{ width: `${92 - i * 12}%` }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-800 whitespace-pre-line leading-relaxed max-h-[220px] overflow-y-auto pr-1">
                      {result?.summary}
                    </div>
                  )}
                  {errorHint && !loading && (
                    <p className="text-[11px] text-amber-800 mt-3 pt-3 border-t border-amber-100/80 bg-amber-50/50 rounded-lg px-2 py-1.5">
                      {errorHint}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Staff panel */}
        <div className="flex flex-col bg-white">
          <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Staff today</h3>
              <p className="text-[11px] text-gray-500">
                {staffSnapshot.totalStaff} active · tap a filter
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-0.5 shrink-0"
            >
              Attendance
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="px-4 sm:px-5 py-3 flex flex-wrap gap-1.5">
            {STAFF_FILTERS.map(({ id, label, icon }) => {
              const active = staffFilter === id;
              const count = statCount(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStaffFilter(id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/50',
                  )}
                >
                  {icon}
                  {label}
                  <span
                    className={cn(
                      'min-w-[18px] text-center rounded-full px-1 text-[10px] font-bold',
                      active ? 'bg-white/20 text-white' : 'bg-white text-gray-700',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {staffSnapshot.pendingLeaveApprovals > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className="mx-4 sm:mx-5 mb-2 text-left text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 hover:bg-amber-100/80"
            >
              {staffSnapshot.pendingLeaveApprovals} leave request(s) pending approval
            </button>
          )}

          <div className="flex-1 px-4 sm:px-5 pb-4 min-h-[140px] max-h-[240px] overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {filteredStaff.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No one in this filter.</p>
              ) : (
                <ul className="space-y-1.5">
                  {filteredStaff.map((row) => (
                    <motion.li
                      key={`${row.employeeId}-${row.kind}`}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="flex items-center gap-2.5 p-2 rounded-xl border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors"
                    >
                      <Avatar name={row.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{row.name}</p>
                        {row.detail && (
                          <p className="text-[10px] text-gray-500 truncate">{row.detail}</p>
                        )}
                      </div>
                      <Badge className={cn('text-[9px] shrink-0', kindBadge(row.kind))}>
                        {row.kind === 'in' ? 'In' : row.kind === 'out' ? 'Out' : row.kind === 'leave' ? 'Leave' : row.kind === 'food' ? 'Food' : 'Absent'}
                      </Badge>
                    </motion.li>
                  ))}
                </ul>
              )}
            </AnimatePresence>
          </div>

          <div className="px-4 sm:px-5 py-2.5 border-t border-gray-100 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('food-dashboard')}
              className="flex-1 text-[11px] font-medium text-gray-600 hover:text-indigo-700 py-1.5 rounded-lg hover:bg-gray-50"
            >
              Food board
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('employees')}
              className="flex-1 text-[11px] font-medium text-gray-600 hover:text-indigo-700 py-1.5 rounded-lg hover:bg-gray-50"
            >
              Employees
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
};
