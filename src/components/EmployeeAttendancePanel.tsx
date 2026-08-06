import React, { useMemo, useRef, useState } from 'react';
import {
  Search, Calendar, RefreshCw, LogIn, LogOut, UserX, Users, AlertTriangle, Download, Loader2,
} from 'lucide-react';
import { Card, CardBody } from './ui/Card';
import { Badge } from './ui/Badge';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { useStore } from '../store/useStore';
import { departmentColors } from '../utils/helpers';
import type { Department } from '../types';
import {
  buildEmployeeAttendanceReport,
  formatDuration,
  formatTimeIST,
  getISTDateKey,
  type AttendanceDayStatus,
} from '../lib/attendance';

const DEPARTMENTS: (Department | 'All')[] = [
  'All', 'Stores', 'Delivery', 'Drivers', 'Scrub Person', 'Cleaning Department', 'Stores Audit', 'Accounts', 'Bill Submission', 'Office Staff', 'Admin',
];

type StatusFilter = 'all' | AttendanceDayStatus | 'unclosed';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in', label: 'Punched In' },
  { id: 'out', label: 'Punched Out' },
  { id: 'absent', label: 'Absent' },
  { id: 'unclosed', label: 'Unclosed Shift' },
];

const statusConfig = {
  in: { label: 'Punched In', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', shareTitle: 'Punched In Today' },
  out: { label: 'Completed', className: 'bg-blue-50 text-blue-700 border-blue-200', shareTitle: 'Punched Out Today' },
  absent: { label: 'Absent', className: 'bg-gray-100 text-gray-600 border-gray-200', shareTitle: 'Absent Today' },
  unclosed: { label: 'Unclosed Shift', className: 'bg-amber-50 text-amber-800 border-amber-200', shareTitle: 'Unclosed Shift (forgot Punch Out)' },
} as const;

function formatShareDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

function formatShortShiftDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

type ShareRow = ReturnType<typeof buildEmployeeAttendanceReport>[number];

function shareDetailLines(row: ShareRow, filterStatus: StatusFilter): string[] {
  const lines: string[] = [];
  if (filterStatus === 'in' || (filterStatus === 'unclosed' && row.status === 'in')) {
    if (row.punchIn) lines.push(`In ${formatTimeIST(row.punchIn.punchedAt)}`);
  } else if (filterStatus === 'out') {
    const inT = row.punchIn ? formatTimeIST(row.punchIn.punchedAt) : '—';
    const outT = row.punchOut ? formatTimeIST(row.punchOut.punchedAt) : '—';
    lines.push(`In ${inT} · Out ${outT}`);
  } else if (filterStatus === 'absent' && row.status === 'absent') {
    lines.push('Absent');
  }
  if (row.unclosedPriorShift && row.unclosedShiftFromDateKey) {
    lines.push(`Unclosed shift from ${formatShortShiftDate(row.unclosedShiftFromDateKey)}`);
    if (filterStatus === 'unclosed' && row.punchIn) {
      lines.push(`Still IN since ${formatTimeIST(row.punchIn.punchedAt)}`);
    }
  }
  return lines;
}

function shareTitleForFilter(filterStatus: StatusFilter): string {
  if (filterStatus === 'all') return 'All Staff';
  if (filterStatus === 'unclosed') return statusConfig.unclosed.shareTitle;
  return statusConfig[filterStatus].shareTitle;
}

export const EmployeeAttendancePanel: React.FC = () => {
  const employees = useStore((s) => s.employees);
  const attendanceRecords = useStore((s) => s.attendanceRecords);
  const reloadFromDatabase = useStore((s) => s.reloadFromDatabase);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState<Department | 'All'>('All');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('in');
  const [dateKey, setDateKey] = useState(getISTDateKey());
  const [refreshing, setRefreshing] = useState(false);
  const [simpleView, setSimpleView] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const shareListRef = useRef<HTMLDivElement>(null);

  const report = useMemo(
    () => buildEmployeeAttendanceReport(employees, attendanceRecords, dateKey),
    [employees, attendanceRecords, dateKey],
  );

  const filtered = report.filter((row) => {
    if (filterDept !== 'All' && row.department !== filterDept) return false;
    if (filterStatus === 'unclosed') {
      if (!row.unclosedPriorShift) return false;
    } else if (filterStatus !== 'all' && row.status !== filterStatus) {
      return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return row.employeeName.toLowerCase().includes(q) || row.department.toLowerCase().includes(q);
  });

  const stats = useMemo(() => ({
    total: report.length,
    in: report.filter((r) => r.status === 'in').length,
    out: report.filter((r) => r.status === 'out').length,
    absent: report.filter((r) => r.status === 'absent').length,
    unclosed: report.filter((r) => r.unclosedPriorShift).length,
  }), [report]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { bootstrapEssential } = await import('../lib/database/bootstrap');
      await bootstrapEssential('admin');
      reloadFromDatabase();
    } finally {
      setRefreshing(false);
    }
  };

  const isToday = dateKey === getISTDateKey();

  const shareTitle = shareTitleForFilter(filterStatus);

  const sortedForShare = useMemo(
    () => [...filtered]
      .filter((row) => row.department !== 'Admin')
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
    [filtered],
  );

  const handleDownloadImage = async () => {
    const node = shareListRef.current;
    if (!node) return;
    setDownloading(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `malcon-attendance-${dateKey}-${filterStatus}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('[attendance] image download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      {/* Summary — tap a card to filter the table */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { id: 'all' as const, label: 'Total Staff', value: stats.total, icon: <Users className="h-4 w-4 text-gray-600" />, bg: 'bg-gray-50', activeRing: 'ring-gray-400' },
          { id: 'in' as const, label: 'Punched In', value: stats.in, icon: <LogIn className="h-4 w-4 text-emerald-600" />, bg: 'bg-emerald-50', activeRing: 'ring-emerald-500' },
          { id: 'out' as const, label: 'Punched Out', value: stats.out, icon: <LogOut className="h-4 w-4 text-blue-600" />, bg: 'bg-blue-50', activeRing: 'ring-blue-500' },
          { id: 'absent' as const, label: 'Absent', value: stats.absent, icon: <UserX className="h-4 w-4 text-gray-500" />, bg: 'bg-gray-50', activeRing: 'ring-gray-500' },
          { id: 'unclosed' as const, label: 'Unclosed Shift', value: stats.unclosed, icon: <AlertTriangle className="h-4 w-4 text-amber-600" />, bg: 'bg-amber-50', activeRing: 'ring-amber-500' },
        ].map(({ id, label, value, icon, bg, activeRing }) => {
          const active = filterStatus === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFilterStatus(id)}
              className={`text-left rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                active ? `ring-2 ${activeRing} shadow-sm` : 'ring-1 ring-gray-200 hover:ring-gray-300'
              }`}
            >
              <Card className="p-4 border-0 shadow-none">
                <div className={`h-8 w-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>{icon}</div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                {active && id !== 'all' && (
                  <p className="text-[10px] text-indigo-600 font-medium mt-1">Filter active</p>
                )}
              </Card>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            type="date"
            value={dateKey}
            max={getISTDateKey()}
            onChange={(e) => setDateKey(e.target.value || getISTDateKey())}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
          />
          {isToday && (
            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">Today</Badge>
          )}
        </div>

        <div className="relative flex-1 min-w-[12rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or department..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-gray-50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          icon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}
          onClick={() => void handleRefresh()}
          disabled={refreshing}
        >
          Refresh
        </Button>
      </div>

      <div className="flex gap-1.5 flex-wrap items-center">
        <span className="text-xs font-semibold text-gray-500 mr-1">Status:</span>
        {STATUS_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilterStatus(id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterStatus === id
                ? id === 'in'
                  ? 'bg-emerald-600 text-white'
                  : id === 'out'
                    ? 'bg-blue-600 text-white'
                    : id === 'absent'
                      ? 'bg-gray-700 text-white'
                      : id === 'unclosed'
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 flex-wrap items-center">
        <span className="text-xs font-semibold text-gray-500 mr-1">Dept:</span>
        {DEPARTMENTS.map((dept) => (
          <button
            key={dept}
            type="button"
            onClick={() => setFilterDept(dept)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterDept === dept ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {dept}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-gray-500">
          Pick a status, then <strong>Download image</strong> or screenshot the white list for your group.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {simpleView && filterStatus !== 'all' && (
            <Button
              variant="outline"
              size="sm"
              disabled={downloading || sortedForShare.length === 0}
              icon={downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              onClick={() => void handleDownloadImage()}
            >
              Download image
            </Button>
          )}
          <button
            type="button"
            onClick={() => setSimpleView((v) => !v)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
          >
            {simpleView ? 'Show full table' : 'Show simple list'}
          </button>
        </div>
      </div>

      {simpleView && filterStatus !== 'all' && (
        <div
          ref={shareListRef}
          className="rounded-2xl border border-gray-200 bg-white text-gray-900 p-4 sm:p-5 shadow-sm max-w-3xl"
          id="attendance-share-list"
        >
          <p className="text-center text-xs font-semibold text-indigo-700 uppercase tracking-wide">
            Malcon Nexus
          </p>
          <h2 className="text-center text-base font-bold mt-0.5">{shareTitle}</h2>
          <p className="text-center text-xs text-gray-600">{formatShareDate(dateKey)}</p>
          <p className="text-center text-[11px] text-gray-500 mt-0.5 mb-3">
            Total: <strong>{sortedForShare.length}</strong>
          </p>

          {sortedForShare.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-6">No one in this list.</p>
          ) : (
            <ol className="grid grid-cols-3 gap-x-2 gap-y-2">
              {sortedForShare.map((row, i) => {
                const details = shareDetailLines(row, filterStatus);
                return (
                  <li
                    key={row.employeeId}
                    className="min-w-0 rounded-lg border border-gray-100 bg-gray-50/50 px-2 py-1.5 leading-tight"
                  >
                    <p className="text-[11px] text-gray-900">
                      <span className="font-bold text-gray-400 tabular-nums">{i + 1}. </span>
                      <span className="font-semibold">{row.employeeName}</span>
                    </p>
                    {details.map((line) => (
                      <p
                        key={line}
                        className={`text-[10px] mt-0.5 tabular-nums leading-snug ${
                          line.startsWith('Unclosed') ? 'text-amber-700 font-medium' : 'text-gray-600'
                        }`}
                      >
                        {line}
                      </p>
                    ))}
                  </li>
                );
              })}
            </ol>
          )}

          <p className="text-center text-[10px] text-gray-400 mt-5 pt-3 border-t border-gray-100">
            Updated {formatTimeIST(new Date())} · malcon-nexus-gamma.vercel.app
          </p>
        </div>
      )}

      {simpleView && filterStatus === 'all' && (
        <p className="text-sm text-gray-500 text-center py-8 rounded-xl bg-gray-50 border border-gray-200">
          Select <strong>Punched In</strong>, <strong>Punched Out</strong>, <strong>Absent</strong>, or{' '}
          <strong>Unclosed Shift</strong> above to see the simple list for your group.
        </p>
      )}

      {!simpleView && (
      <Card className="min-w-0 w-full max-w-full overflow-hidden">
        <CardBody className="p-0 overflow-x-auto overscroll-x-contain max-w-full">
          <table className="w-max min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Punch In</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Punch Out</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hours</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((row) => {
                const sc = statusConfig[row.status];
                const dept = row.department as Department;
                return (
                  <tr key={row.employeeId} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={row.employeeName} size="sm" />
                        <span className="font-medium text-gray-900 truncate">{row.employeeName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${departmentColors[dept] ?? 'bg-gray-100 text-gray-700'} text-[10px]`}>
                        {row.department}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">
                      {row.punchIn ? formatTimeIST(row.punchIn.punchedAt) : '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">
                      {row.punchOut ? formatTimeIST(row.punchOut.punchedAt) : '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium text-gray-900">
                      {row.punchIn ? formatDuration(row.workedMs) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Badge className={`${sc.className} text-[10px] w-fit`}>{sc.label}</Badge>
                        {isToday && row.unclosedPriorShift && row.unclosedShiftFromDateKey && (
                          <span className="text-[10px] text-amber-700 font-medium">
                            Unclosed shift from{' '}
                            {new Date(`${row.unclosedShiftFromDateKey}T12:00:00`).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              timeZone: 'Asia/Kolkata',
                            })}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No employees match this filter</p>
              <p className="text-xs mt-1">
                {filterStatus !== 'all'
                  ? `No one with status "${STATUS_FILTERS.find((f) => f.id === filterStatus)?.label}" for this date.`
                  : 'Try another date or adjust filters.'}
              </p>
            </div>
          )}
        </CardBody>
      </Card>
      )}
    </div>
  );
};
