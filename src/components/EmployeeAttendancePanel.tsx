import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Calendar, RefreshCw, LogIn, LogOut, UserX, Users, AlertTriangle, Download, Loader2,
  Camera,
} from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { LazyPhotoViewer } from './LazyPhotoViewer';
import { useStore } from '../store/useStore';
import type { Department } from '../types';
import {
  buildEmployeeAttendanceReport,
  formatTimeIST,
  getISTDateKey,
  type AttendanceDayStatus,
} from '../lib/attendance';
import { DEPARTMENTS_WITH_ALL, departmentSelectClass } from '../constants/departments';

type SelfieItem = {
  employeeId: string;
  employeeName: string;
  selfieUrl: string;
  punchedAt: string;
};

type StatusFilter = 'all' | AttendanceDayStatus | 'unclosed';

const statusConfig = {
  in: { shareTitleToday: 'Punched In Today', shareTitlePast: 'Still punched in' },
  out: { shareTitleToday: 'Punched Out Today', shareTitlePast: 'Punched Out' },
  absent: { shareTitleToday: 'Absent Today', shareTitlePast: 'Absent' },
  unclosed: { shareTitleToday: 'Unclosed Shift (forgot Punch Out)', shareTitlePast: 'Unclosed Shift (forgot Punch Out)' },
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

function shareTitleForFilter(filterStatus: StatusFilter, isToday: boolean): string {
  if (filterStatus === 'all') return 'All Staff';
  if (filterStatus === 'unclosed') {
    return isToday ? statusConfig.unclosed.shareTitleToday : statusConfig.unclosed.shareTitlePast;
  }
  const titles = statusConfig[filterStatus];
  return isToday ? titles.shareTitleToday : titles.shareTitlePast;
}

export const EmployeeAttendancePanel: React.FC = () => {
  const employees = useStore((s) => s.employees);
  const attendanceRecords = useStore((s) => s.attendanceRecords);
  const fieldTeamAttendanceApprovals = useStore((s) => s.fieldTeamAttendanceApprovals);
  const reloadFromDatabase = useStore((s) => s.reloadFromDatabase);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState<Department | 'All'>('All');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('in');
  const [dateKey, setDateKey] = useState(getISTDateKey());
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const shareListRef = useRef<HTMLDivElement>(null);

  // Past days are closed: people who came are "out", not still "in".
  useEffect(() => {
    if (dateKey !== getISTDateKey() && filterStatus === 'in') {
      setFilterStatus('out');
    }
  }, [dateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAttendance = async (force = false) => {
    setRefreshing(true);
    try {
      const { bootstrapEssential } = await import('../lib/database/bootstrap');
      await bootstrapEssential('admin', undefined, force ? { force: true } : undefined);
      reloadFromDatabase();
    } finally {
      setRefreshing(false);
    }
  };

  // Reload punches for the selected day. Live-refresh only while viewing today.
  useEffect(() => {
    void refreshAttendance(true);
    if (dateKey !== getISTDateKey()) return;
    const onFocus = () => void refreshAttendance(true);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [dateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const report = useMemo(
    () => buildEmployeeAttendanceReport(employees, attendanceRecords, dateKey, fieldTeamAttendanceApprovals),
    [employees, attendanceRecords, dateKey, fieldTeamAttendanceApprovals],
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
    await refreshAttendance(true);
  };

  const isToday = dateKey === getISTDateKey();
  const shareTitle = shareTitleForFilter(filterStatus, isToday);

  const sortedForShare = useMemo(
    () => [...filtered]
      .filter((row) => row.department !== 'Admin')
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
    [filtered],
  );

  const selfieItems = useMemo((): SelfieItem[] => {
    if (filterStatus !== 'in') return [];
    return sortedForShare
      .filter((row) => !!row.punchIn?.selfieUrl)
      .map((row) => ({
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        selfieUrl: row.punchIn!.selfieUrl!,
        punchedAt: row.punchIn!.punchedAt,
      }));
  }, [sortedForShare, filterStatus]);

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
    <div className="space-y-4 min-w-0 w-full max-w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { id: 'all' as const, label: 'Total Staff', value: stats.total, icon: <Users className="h-4 w-4 text-gray-600" />, bg: 'bg-gray-50', activeRing: 'ring-gray-400' },
          { id: 'in' as const, label: isToday ? 'Punched In' : 'Still in', value: stats.in, icon: <LogIn className="h-4 w-4 text-emerald-600" />, bg: 'bg-emerald-50', activeRing: 'ring-emerald-500' },
          { id: 'out' as const, label: isToday ? 'Punched Out' : 'Present (out)', value: stats.out, icon: <LogOut className="h-4 w-4 text-blue-600" />, bg: 'bg-blue-50', activeRing: 'ring-blue-500' },
          { id: 'absent' as const, label: 'Absent', value: stats.absent, icon: <UserX className="h-4 w-4 text-gray-500" />, bg: 'bg-gray-50', activeRing: 'ring-gray-500' },
          { id: 'unclosed' as const, label: 'Unclosed Shift', value: stats.unclosed, icon: <AlertTriangle className="h-4 w-4 text-amber-600" />, bg: 'bg-amber-50', activeRing: 'ring-amber-500' },
        ].map(({ id, label, value, icon, bg, activeRing }) => {
          const active = filterStatus === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFilterStatus(id)}
              className={`text-left rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                active ? `ring-2 ${activeRing} shadow-sm` : 'ring-1 ring-gray-200 hover:ring-gray-300'
              }`}
            >
              <Card className="p-4 border-0 shadow-none">
                <div className={`h-8 w-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>{icon}</div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </Card>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <Calendar className="h-4 w-4 text-gray-400" />
          <input
            type="date"
            value={dateKey}
            max={getISTDateKey()}
            onChange={(e) => setDateKey(e.target.value || getISTDateKey())}
            className={departmentSelectClass}
            aria-label="Attendance date"
          />
          {isToday && (
            <Badge className="bg-[var(--color-accent-muted)] text-[var(--color-accent)] border-[var(--color-accent)]/25 text-[10px]">Today</Badge>
          )}
          {!isToday && (
            <p className="text-xs text-gray-500">
              Finished day — list opens on Present (out).
            </p>
          )}
        </div>

        <div className="relative flex-1 min-w-[10rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name or dept…"
            className="nexus-field-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value as Department | 'All')}
          className={`${departmentSelectClass} min-w-[10rem]`}
          aria-label="Filter by department"
        >
          {DEPARTMENTS_WITH_ALL.map((dept) => (
            <option key={dept} value={dept}>
              {dept === 'All' ? 'All departments' : dept}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            aria-label="Refresh"
          >
            Refresh
          </Button>
          {filterStatus !== 'all' && (
            <Button
              variant="outline"
              size="sm"
              disabled={downloading || sortedForShare.length === 0}
              icon={downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              onClick={() => void handleDownloadImage()}
            >
              Download
            </Button>
          )}
        </div>
      </div>

      {filterStatus !== 'all' ? (
        <div
          ref={shareListRef}
          className="rounded-2xl border border-gray-200 bg-white text-gray-900 p-4 sm:p-5 shadow-sm max-w-3xl"
          id="attendance-share-list"
        >
          <p className="text-center text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wide">
            Malcon Nexus
          </p>
          <h2 className="text-center text-base font-bold mt-0.5">{shareTitle}</h2>
          <p className="text-center text-xs text-gray-600">{formatShareDate(dateKey)}</p>
          <p className="text-center text-[11px] text-gray-500 mt-0.5 mb-3">
            Total: <strong>{sortedForShare.length}</strong>
          </p>

          {sortedForShare.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-6">
              {!isToday && filterStatus === 'in'
                ? 'Nobody is still punched in on this date. Open Present (out) to see who came.'
                : 'No one in this list.'}
            </p>
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
      ) : (
        <p className="text-sm text-gray-500 text-center py-8 rounded-xl bg-gray-50 border border-gray-200">
          Tap a card above to see punched in, out, absent, or unclosed lists.
        </p>
      )}

      {selfieItems.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <Camera className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-semibold text-gray-900">
              Punch-in selfies ({selfieItems.length})
            </h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Photos are not downloaded until you open them. Cloud keeps these ~24 hours; older copies
            stay on the office PC
            {' '}
            <span className="font-mono text-[11px]">D:\MalconNexus\PunchInSelfies</span>
            .
          </p>
          <LazyPhotoViewer
            photos={selfieItems.map((item) => ({
              id: item.employeeId,
              alt: `Selfie — ${item.employeeName}`,
              url: item.selfieUrl,
              title: item.employeeName,
              caption: formatTimeIST(item.punchedAt),
            }))}
            title="Punch-in selfies"
            note="Loads on demand — thumbnails only."
          />
        </div>
      )}

      {filterStatus === 'in' && selfieItems.length === 0 && sortedForShare.length > 0 && (
        <p className="text-xs text-gray-500 max-w-3xl">
          No punch-in selfies in cloud for this list. Cloud keeps selfies ~24 hours; older photos are archived on the office PC
          {' '}
          <span className="font-mono text-[11px]">D:\MalconNexus\PunchInSelfies</span>
          .
        </p>
      )}
    </div>
  );
};

