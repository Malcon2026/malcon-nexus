import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Download, RefreshCw, Info, Loader2,
} from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { useStore } from '../store/useStore';
import type { Department } from '../types';
import {
  buildAttendanceRegister,
  REGISTER_CELL_STYLES,
  formatYearMonth,
  parseYearMonth,
  downloadRegisterCsv,
  type RegisterCellDetail,
  type RegisterDayColumn,
} from '../lib/attendanceRegister';
import { getISTDateKey, summarizeDayAttendance } from '../lib/attendance';
import { LEAVE_TYPES } from '../lib/leave';
import type { LeaveType } from '../types';
import { departmentColors } from '../utils/helpers';

const DEPARTMENTS: (Department | 'All')[] = [
  'All', 'Stores', 'Delivery', 'Drivers', 'Scrub Person', 'Cleaning Department', 'Stores Audit', 'Accounts', 'Bill Submission', 'Office Staff', 'Admin',
];

/** ISO punchedAt -> "HH:mm" 24h string in IST, for prefilling <input type="time">. */
function toHHMM(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

interface AttendanceRegisterPanelProps {
  /** When set, show only this employee's row (employee dashboard). */
  employeeId?: string;
  title?: string;
  subtitle?: string;
  /** Hide section title — used on admin Attendance page (TopBar + tabs are enough). */
  compactHeader?: boolean;
}

export const AttendanceRegisterPanel: React.FC<AttendanceRegisterPanelProps> = ({
  employeeId,
  title = 'Attendance Register',
  subtitle = 'Salary cycle register — P Present, L Leave, A Absent, WO Sunday off',
  compactHeader = false,
}) => {
  const employees = useStore((s) => s.employees);
  const attendanceRecords = useStore((s) => s.attendanceRecords);
  const leaveRequests = useStore((s) => s.leaveRequests);
  const reloadFromDatabase = useStore((s) => s.reloadFromDatabase);
  const viewMode = useStore((s) => s.viewMode);
  const addManualAttendance = useStore((s) => s.addManualAttendance);
  const addManualLeave = useStore((s) => s.addManualLeave);
  const markManualAbsent = useStore((s) => s.markManualAbsent);
  const isAdmin = viewMode === 'admin' && !employeeId;

  const now = new Date();
  const [monthValue, setMonthValue] = useState(formatYearMonth(now.getFullYear(), now.getMonth() + 1));
  const [filterDept, setFilterDept] = useState<Department | 'All'>('All');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    employeeId: string;
    employeeName: string;
    department: string;
    day: RegisterDayColumn;
    cell: RegisterCellDetail;
  } | null>(null);
  const [showTimes, setShowTimes] = useState(false);
  const [manualIn, setManualIn] = useState('');
  const [manualOut, setManualOut] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSaving, setManualSaving] = useState(false);
  /** menu = pick status; comp-off = pick work day */
  const [markView, setMarkView] = useState<'menu' | 'comp-off'>('menu');
  const [compOffWorkDate, setCompOffWorkDate] = useState('');

  useEffect(() => {
    if (!selectedCell) {
      setShowTimes(false);
      setManualError(null);
      setMarkView('menu');
      setCompOffWorkDate('');
      return;
    }
    const summary = summarizeDayAttendance(attendanceRecords, selectedCell.employeeId, selectedCell.day.dateKey);
    setManualIn(summary.punchIn ? toHHMM(summary.punchIn.punchedAt) : '');
    setManualOut(summary.punchOut ? toHHMM(summary.punchOut.punchedAt) : '');
    setShowTimes(false);
    setManualError(null);
    setMarkView('menu');
    setCompOffWorkDate('');
  }, [selectedCell, attendanceRecords]);

  const applyMark = async (
    kind: 'present' | 'absent' | LeaveType,
  ) => {
    if (!selectedCell) return;
    setManualSaving(true);
    setManualError(null);
    try {
      let result: { error: string | null };
      if (kind === 'present') {
        result = await addManualAttendance(
          selectedCell.employeeId,
          selectedCell.day.dateKey,
          showTimes ? (manualIn || undefined) : undefined,
          showTimes ? (manualOut || undefined) : undefined,
        );
      } else if (kind === 'absent') {
        result = await markManualAbsent(selectedCell.employeeId, selectedCell.day.dateKey);
      } else if (kind === 'Comp Off') {
        if (!compOffWorkDate) {
          setManualError('Select the day they will work for this Comp Off.');
          setMarkView('comp-off');
          return;
        }
        result = await addManualLeave(
          selectedCell.employeeId,
          selectedCell.day.dateKey,
          kind,
          '',
          compOffWorkDate,
        );
      } else {
        result = await addManualLeave(selectedCell.employeeId, selectedCell.day.dateKey, kind);
      }
      if (result.error) {
        setManualError(result.error);
        return;
      }
      setSelectedCell(null);
    } finally {
      setManualSaving(false);
    }
  };

  const formatCellDate = (dateKey: string, weekday: string) => {
    const nice = new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `${weekday}, ${nice}`;
  };

  const markTile =
    'flex flex-col items-center justify-center gap-0.5 h-16 w-full rounded-sm border text-center transition-colors disabled:opacity-50 disabled:pointer-events-none';
  const markTileCode = 'text-sm font-bold leading-none';
  const markTileLabel = 'text-[10px] font-medium leading-tight opacity-90';

  const { year, month } = parseYearMonth(monthValue);

  const register = useMemo(() => {
    const data = buildAttendanceRegister(
      employees,
      attendanceRecords,
      leaveRequests,
      year,
      month,
      employeeId ? { employeeId } : undefined,
    );
    if (filterDept === 'All' || employeeId) return data;
    return {
      ...data,
      rows: data.rows.filter((r) => r.department === filterDept),
    };
  }, [employees, attendanceRecords, leaveRequests, year, month, employeeId, filterDept]);

  const weekBands = useMemo(() => {
    const bands: { week: number; span: number }[] = [];
    let currentWeek = register.days[0]?.weekNumber ?? 1;
    let span = 0;
    for (const day of register.days) {
      if (day.weekNumber === currentWeek) {
        span++;
      } else {
        bands.push({ week: currentWeek, span });
        currentWeek = day.weekNumber;
        span = 1;
      }
    }
    if (span > 0) bands.push({ week: currentWeek, span });
    return bands;
  }, [register.days]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setMonthValue(formatYearMonth(d.getFullYear(), d.getMonth() + 1));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { bootstrapEssential, bootstrapDeferred } = await import('../lib/database/bootstrap');
      const force = { force: true as const };
      if (employeeId) {
        await bootstrapEssential('employee', { employeeId }, force);
        await bootstrapDeferred('employee', { employeeId }, force);
      } else {
        await bootstrapEssential('admin', undefined, force);
        await bootstrapDeferred('admin', undefined, force);
      }
      reloadFromDatabase();
    } finally {
      setRefreshing(false);
    }
  };

  const displayCode = (code: RegisterCellDetail['code']) => {
    if (code === 'PI') return 'P●';
    return code;
  };

  return (
    <div className="space-y-4 min-w-0 w-full max-w-full">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {!compactHeader && (
          <div>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {subtitle}
              {!employeeId && (
                <span className="text-gray-400"> · {register.rows.length} staff</span>
              )}
            </p>
          </div>
        )}
        <div className={`flex flex-wrap items-center gap-2 ${compactHeader ? 'w-full lg:w-auto lg:ml-auto' : ''}`}>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex flex-col items-center px-1 min-w-[7rem]">
              <input
                type="month"
                value={monthValue}
                max={formatYearMonth(now.getFullYear(), now.getMonth() + 1)}
                onChange={(e) => e.target.value && setMonthValue(e.target.value)}
                className="text-sm border-0 focus:ring-0 bg-transparent w-full"
                aria-label="Salary month"
              />
              <span className="text-[9px] text-gray-400 leading-tight text-center whitespace-nowrap">
                {register.salaryLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {!employeeId && (
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={() => downloadRegisterCsv(register)}
            >
              Export CSV
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
            onClick={() => void handleRefresh()}
            disabled={refreshing}
          >
            Refresh
          </Button>
        </div>
      </div>

      {!employeeId && (
        <div className="flex flex-wrap gap-1.5">
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
      )}

      <p className="text-xs text-gray-600">
        <span className="font-medium text-gray-800">{register.cycleLabel}</span>
        <span className="text-gray-400 mx-1.5">·</span>
        {register.cycleDescription}
        {!employeeId && (
          <>
            <span className="text-gray-400 mx-1.5">·</span>
            <span className="font-medium text-gray-800">{register.rows.length} staff</span>
          </>
        )}
      </p>

      <div className="flex flex-wrap gap-2 text-[10px]">
        {Object.entries(REGISTER_CELL_STYLES).map(([code, style]) => (
          <span key={code} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${style.bg} ${style.text}`}>
            <span className="font-bold">{code === 'PI' ? 'P●' : code}</span>
            {style.title}
          </span>
        ))}
      </div>

      <Card className="min-w-0 w-full max-w-full overflow-hidden">
        <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
          <table
            className="w-full border-collapse text-xs table-fixed"
            style={{
              minWidth: employeeId
                ? `${140 + register.days.length * 28 + 52}px`
                : `${250 + register.days.length * 28 + 52}px`,
            }}
          >
            <colgroup>
              <col style={{ width: 140 }} />
              {!employeeId && <col style={{ width: 110 }} />}
              {register.days.map((day) => (
                <col key={day.dateKey} />
              ))}
              <col style={{ width: 52 }} />
            </colgroup>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 bg-gray-50 border-r border-gray-200 px-3 py-2 text-left font-semibold text-gray-700 min-w-[140px]"
                >
                  Employee
                </th>
                {!employeeId && (
                  <th
                    rowSpan={2}
                    className="sticky left-[140px] z-20 bg-gray-50 border-r border-gray-200 px-2 py-2 text-left font-semibold text-gray-600 min-w-[100px]"
                  >
                    Dept
                  </th>
                )}
                {weekBands.map(({ week, span }) => (
                  <th
                    key={`w${week}`}
                    colSpan={span}
                    className="border-r border-gray-200 px-1 py-1 text-center font-medium text-gray-500 bg-gray-100/80"
                  >
                    Week {week}
                  </th>
                ))}
                <th
                  rowSpan={2}
                  className="sticky right-0 z-20 bg-gray-50 border-l border-gray-200 px-2 py-2 text-center font-semibold text-gray-700 min-w-[52px]"
                >
                  Pay
                </th>
              </tr>
              <tr className="bg-gray-50 border-b border-gray-200">
                {register.days.map((day) => (
                  <th
                    key={day.dateKey}
                    className={`border-r border-gray-100 px-0.5 py-1 text-center ${
                      day.isToday
                        ? 'bg-indigo-50'
                        : day.isWeeklyOff
                          ? 'bg-gray-100/60'
                          : ''
                    }`}
                    title={`${day.weekday} ${day.dateKey}`}
                  >
                    {day.monthShort && (
                      <div className="text-[8px] text-gray-400 font-medium leading-none mb-0.5">{day.monthShort}</div>
                    )}
                    <div
                      className={`font-semibold ${
                        day.isToday ? 'text-indigo-700' : 'text-gray-700'
                      }`}
                    >
                      {day.day}
                    </div>
                    <div className="text-[9px] text-gray-400 font-normal">
                      {day.weekday.charAt(0)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {register.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={register.days.length + (employeeId ? 2 : 3)}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No employees to display
                  </td>
                </tr>
              ) : (
                register.rows.map((row) => (
                  <tr key={row.employeeId} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                      {row.employeeName}
                    </td>
                    {!employeeId && (
                      <td className="sticky left-[140px] z-10 bg-white border-r border-gray-200 px-2 py-2">
                        <Badge className={`${departmentColors[row.department as Department] ?? 'bg-gray-100 text-gray-700'} text-[10px]`}>
                          {row.department}
                        </Badge>
                      </td>
                    )}
                    {row.cells.map((cell, idx) => {
                      const day = register.days[idx];
                      const style = REGISTER_CELL_STYLES[cell.code];
                      return (
                        <td
                          key={`${row.employeeId}-${day.dateKey}`}
                          className={`border-r border-gray-50 px-0.5 py-1 text-center ${
                            day.isToday ? 'ring-1 ring-inset ring-indigo-200' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedCell({
                                employeeId: row.employeeId,
                                employeeName: row.employeeName,
                                department: row.department,
                                day,
                                cell,
                              })
                            }
                            className={`inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded font-bold text-[9px] sm:text-[10px] border border-gray-400/60 ${style.bg} ${style.text} hover:opacity-80 transition-opacity`}
                            title={cell.label}
                          >
                            {displayCode(cell.code)}
                          </button>
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-10 bg-white border-l border-gray-200 px-2 py-2 text-center font-semibold text-gray-800">
                      {row.payDays}
                      <span className="text-gray-400 font-normal">/{register.payableDaysCap}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-[10px] text-gray-400 flex items-center gap-1">
        <Info className="h-3 w-3" />
        Salary month = month paid (e.g. June = 28 May – 27 Jun). Pay days = P + L + WO (max 30). Today: {getISTDateKey()}.
      </p>

      {selectedCell && (
        <Modal
          isOpen
          onClose={() => !manualSaving && setSelectedCell(null)}
          title={selectedCell.employeeName}
          subtitle={formatCellDate(selectedCell.day.dateKey, selectedCell.day.weekday)}
          size="sm"
          footer={
            <div className="flex justify-end gap-2 w-full">
              {markView === 'comp-off' ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMarkView('menu');
                      setManualError(null);
                      setCompOffWorkDate('');
                    }}
                    disabled={manualSaving}
                  >
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={manualSaving || !compOffWorkDate}
                    onClick={() => void applyMark('Comp Off')}
                    icon={manualSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
                  >
                    Save Comp Off
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setSelectedCell(null)} disabled={manualSaving}>
                  Close
                </Button>
              )}
            </div>
          }
        >
          <div className="px-4 py-4 space-y-4 text-sm">
            {/* Current status */}
            <div className="flex items-start gap-3 rounded-sm bg-gray-50 border border-gray-100 px-3.5 py-3">
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-sm font-bold border border-gray-300/50 ${REGISTER_CELL_STYLES[selectedCell.cell.code].bg} ${REGISTER_CELL_STYLES[selectedCell.cell.code].text}`}
              >
                {displayCode(selectedCell.cell.code)}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-gray-900">{selectedCell.cell.label}</p>
                <div className="mt-1 text-[11px] text-gray-500 space-y-0.5">
                  {selectedCell.cell.punchInTime && selectedCell.cell.punchOutTime && (
                    <p>{selectedCell.cell.punchInTime} – {selectedCell.cell.punchOutTime}</p>
                  )}
                  {selectedCell.cell.punchInTime && !selectedCell.cell.punchOutTime && (
                    <p>In: {selectedCell.cell.punchInTime}</p>
                  )}
                  {selectedCell.cell.leaveType && <p>{selectedCell.cell.leaveType}</p>}
                  {selectedCell.cell.compOffWorkDate && (
                    <p className="text-violet-700">Works: {selectedCell.cell.compOffWorkDate}</p>
                  )}
                </div>
              </div>
            </div>

            {isAdmin && !selectedCell.day.isFuture && markView === 'menu' && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Attendance
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={manualSaving}
                      onClick={() => void applyMark('present')}
                      className={`${markTile} bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100`}
                    >
                      <span className={markTileCode}>P</span>
                      <span className={markTileLabel}>
                        {selectedCell.day.isWeeklyOff ? 'Worked' : 'Present'}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={manualSaving}
                      onClick={() => void applyMark('absent')}
                      className={`${markTile} ${
                        selectedCell.day.isWeeklyOff
                          ? 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100'
                          : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
                      }`}
                    >
                      <span className={markTileCode}>{selectedCell.day.isWeeklyOff ? 'WO' : 'A'}</span>
                      <span className={markTileLabel}>
                        {selectedCell.day.isWeeklyOff ? 'Week off' : 'Absent'}
                      </span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowTimes((v) => !v)}
                    className="mt-2 text-[11px] text-gray-500 hover:text-gray-800"
                  >
                    {showTimes ? 'Hide custom punch times' : 'Set custom punch times (optional)'}
                  </button>
                  {showTimes && (
                    <div className="mt-2 grid grid-cols-2 gap-2 p-2.5 rounded-sm bg-white border border-gray-100">
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">In</label>
                        <input
                          type="time"
                          value={manualIn}
                          onChange={(e) => setManualIn(e.target.value)}
                          className="w-full px-2 py-2 text-sm border border-gray-200 rounded-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Out</label>
                        <input
                          type="time"
                          value={manualOut}
                          onChange={(e) => setManualOut(e.target.value)}
                          className="w-full px-2 py-2 text-sm border border-gray-200 rounded-sm bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Leave
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {LEAVE_TYPES.filter((t) => t.value !== 'Comp Off').map((t) => {
                      const code =
                        t.value === 'Casual' ? 'CL' : t.value === 'Sick' ? 'SL' : 'UL';
                      return (
                        <button
                          key={t.value}
                          type="button"
                          disabled={manualSaving}
                          onClick={() => void applyMark(t.value)}
                          className={`${markTile} bg-amber-50 text-amber-950 border-amber-200 hover:bg-amber-100`}
                        >
                          <span className={markTileCode}>{code}</span>
                          <span className={markTileLabel}>{t.value}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      disabled={manualSaving}
                      onClick={() => {
                        setMarkView('comp-off');
                        setManualError(null);
                      }}
                      className={`${markTile} bg-violet-50 text-violet-950 border-violet-200 hover:bg-violet-100 col-span-2 h-12 flex-row justify-between px-3`}
                    >
                      <span className="flex items-center gap-2 text-left">
                        <span className={markTileCode}>CO</span>
                        <span>
                          <span className="block text-xs font-semibold">Comp Off</span>
                          <span className="block text-[10px] opacity-80">Pick work day next</span>
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
                    </button>
                  </div>
                </div>

                {manualError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-sm px-3 py-2">{manualError}</p>
                )}
                {manualSaving && (
                  <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                  </p>
                )}
              </div>
            )}

            {isAdmin && !selectedCell.day.isFuture && markView === 'comp-off' && (
              <div className="space-y-4">
                <button
                  type="button"
                  disabled={manualSaving}
                  onClick={() => {
                    setMarkView('menu');
                    setManualError(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  All options
                </button>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Comp Off</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Leave on{' '}
                    <span className="font-medium text-gray-700">
                      {formatCellDate(selectedCell.day.dateKey, selectedCell.day.weekday)}
                    </span>
                    . Choose the day they will work instead (usually a Sunday).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Work day *
                  </label>
                  <input
                    type="date"
                    value={compOffWorkDate}
                    onChange={(e) => setCompOffWorkDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-violet-200 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-100"
                    autoFocus
                  />
                </div>

                {manualError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-sm px-3 py-2">{manualError}</p>
                )}
              </div>
            )}

            {(!isAdmin || selectedCell.day.isFuture) && (
              <p className="text-xs text-gray-500">
                {selectedCell.day.isFuture
                  ? 'Future dates cannot be marked yet.'
                  : 'Only admins can change attendance from the register.'}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
