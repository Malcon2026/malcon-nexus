import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Download, RefreshCw, Info, Pencil,
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
  'All', 'Stores', 'Delivery', 'Scrub Person', 'Cleaning Department', 'Stores Audit', 'Accounts', 'Bill Submission', 'Admin',
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
  const [manualMode, setManualMode] = useState(false);
  const [manualEntryKind, setManualEntryKind] = useState<'punch' | 'leave'>('punch');
  const [manualIn, setManualIn] = useState('');
  const [manualOut, setManualOut] = useState('');
  const [manualLeaveType, setManualLeaveType] = useState<LeaveType>('Casual');
  const [manualLeaveNotes, setManualLeaveNotes] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSaving, setManualSaving] = useState(false);

  // Whenever a new cell is opened, prefill the manual-entry form from the
  // employee's actual raw punch records for that day (not the formatted
  // display strings, which are locale text like "09:30:15 am").
  useEffect(() => {
    if (!selectedCell) {
      setManualMode(false);
      setManualError(null);
      return;
    }
    const summary = summarizeDayAttendance(attendanceRecords, selectedCell.employeeId, selectedCell.day.dateKey);
    setManualIn(summary.punchIn ? toHHMM(summary.punchIn.punchedAt) : '');
    setManualOut(summary.punchOut ? toHHMM(summary.punchOut.punchedAt) : '');
    setManualEntryKind(selectedCell.cell.leaveType ? 'leave' : 'punch');
    setManualLeaveType((selectedCell.cell.leaveType as LeaveType) || 'Casual');
    setManualLeaveNotes('');
    setManualMode(false);
    setManualError(null);
  }, [selectedCell, attendanceRecords]);

  const handleSaveManual = async () => {
    if (!selectedCell) return;
    setManualSaving(true);
    setManualError(null);
    try {
      const result =
        manualEntryKind === 'leave'
          ? await addManualLeave(
              selectedCell.employeeId,
              selectedCell.day.dateKey,
              manualLeaveType,
              manualLeaveNotes,
            )
          : await addManualAttendance(
              selectedCell.employeeId,
              selectedCell.day.dateKey,
              manualIn || undefined,
              manualOut || undefined,
            );
      if (result.error) {
        setManualError(result.error);
        return;
      }
      setManualMode(false);
    } finally {
      setManualSaving(false);
    }
  };

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
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
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
          onClose={() => setSelectedCell(null)}
          title={selectedCell.employeeName}
          subtitle={`${selectedCell.day.weekday}, ${selectedCell.day.dateKey}`}
          size="sm"
          footer={
            <div className="flex justify-end gap-2">
              {isAdmin && !selectedCell.day.isFuture && manualMode && (
                <Button variant="outline" size="sm" onClick={() => setManualMode(false)} disabled={manualSaving}>
                  Cancel
                </Button>
              )}
              {isAdmin && !selectedCell.day.isFuture && manualMode ? (
                <Button variant="primary" size="sm" onClick={() => void handleSaveManual()} disabled={manualSaving}>
                  {manualSaving ? 'Saving...' : 'Save'}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setSelectedCell(null)}>Close</Button>
              )}
            </div>
          }
        >
          <div className="p-6 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded font-bold border border-gray-400/60 ${REGISTER_CELL_STYLES[selectedCell.cell.code].bg} ${REGISTER_CELL_STYLES[selectedCell.cell.code].text}`}
                >
                  {displayCode(selectedCell.cell.code)}
                </span>
                <span className="font-medium text-gray-900">{selectedCell.cell.label}</span>
              </div>
              {isAdmin && !selectedCell.day.isFuture && !manualMode && (
                <button
                  type="button"
                  onClick={() => setManualMode(true)}
                  className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  <Pencil className="h-3 w-3" />
                  Mark manually
                </button>
              )}
            </div>

            {isAdmin && !selectedCell.day.isFuture && manualMode ? (
              <div className="space-y-3 pt-1">
                <div className="flex gap-1.5 p-1 bg-gray-100 rounded-lg w-fit">
                  {([
                    { id: 'punch' as const, label: 'Present / punch times' },
                    { id: 'leave' as const, label: 'Leave' },
                  ]).map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setManualEntryKind(id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        manualEntryKind === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {manualEntryKind === 'punch' ? (
                  <>
                    <p className="text-xs text-gray-500">
                      Set punch-in / punch-out for this date. Leave a field blank to clear it. This overrides the
                      device punch shown above and is saved directly to attendance records.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Punch in</label>
                        <input
                          type="time"
                          value={manualIn}
                          onChange={(e) => setManualIn(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Punch out</label>
                        <input
                          type="time"
                          value={manualOut}
                          onChange={(e) => setManualOut(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 bg-white"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-500">
                      Marks this single date as an already-approved leave for {selectedCell.employeeName}.
                    </p>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Leave type</label>
                      <select
                        value={manualLeaveType}
                        onChange={(e) => setManualLeaveType(e.target.value as LeaveType)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 bg-white"
                      >
                        {LEAVE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
                      <input
                        type="text"
                        value={manualLeaveNotes}
                        onChange={(e) => setManualLeaveNotes(e.target.value)}
                        placeholder="e.g. Approved verbally, backdated entry..."
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 bg-white"
                      />
                    </div>
                  </>
                )}

                {manualError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{manualError}</p>
                )}
              </div>
            ) : (
              <>
            {selectedCell.cell.punchInTime && (
              <p className="text-xs text-gray-600">Punch in: <span className="font-medium">{selectedCell.cell.punchInTime}</span></p>
            )}
            {selectedCell.cell.punchOutTime && (
              <p className="text-xs text-gray-600">Punch out: <span className="font-medium">{selectedCell.cell.punchOutTime}</span></p>
            )}
            {selectedCell.cell.workedDuration && (
              <p className="text-xs text-gray-600">Duration: <span className="font-medium">{selectedCell.cell.workedDuration}</span></p>
            )}
            {selectedCell.cell.leaveType && (
              <p className="text-xs text-gray-600">
                Leave: <span className="font-medium">{selectedCell.cell.leaveType}</span>
                {selectedCell.cell.leaveStatus ? ` (${selectedCell.cell.leaveStatus})` : ''}
              </p>
            )}
            {selectedCell.cell.leaveReason && (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-3">{selectedCell.cell.leaveReason}</p>
            )}
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
