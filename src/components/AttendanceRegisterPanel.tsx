import React, { useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Download, RefreshCw, Info,
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
import { getISTDateKey } from '../lib/attendance';
import { departmentColors } from '../utils/helpers';

const DEPARTMENTS: (Department | 'All')[] = [
  'All', 'Stores', 'Delivery', 'Scrub Person', 'Cleaning Department', 'Stores Audit', 'Accounts', 'Bill Submission',
];

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
  subtitle = 'Salary cycle (26th–26th/27th) — P Present, L Leave, A Absent, WO Sunday off',
  compactHeader = false,
}) => {
  const employees = useStore((s) => s.employees);
  const attendanceRecords = useStore((s) => s.attendanceRecords);
  const leaveRequests = useStore((s) => s.leaveRequests);
  const reloadFromDatabase = useStore((s) => s.reloadFromDatabase);

  const now = new Date();
  const [monthValue, setMonthValue] = useState(formatYearMonth(now.getFullYear(), now.getMonth() + 1));
  const [filterDept, setFilterDept] = useState<Department | 'All'>('All');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    employeeName: string;
    department: string;
    day: RegisterDayColumn;
    cell: RegisterCellDetail;
  } | null>(null);

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
      const { bootstrapEssential } = await import('../lib/database/bootstrap');
      await bootstrapEssential(employeeId ? 'employee' : 'admin');
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
        Paid window: 26th prev month → 25th ({register.payableDaysCap} days max)
      </p>

      <div className="flex flex-wrap gap-2 text-[10px]">
        {Object.entries(REGISTER_CELL_STYLES).map(([code, style]) => (
          <span key={code} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${style.bg} ${style.text}`}>
            <span className="font-bold">{code === 'PI' ? 'P●' : code}</span>
            {style.title}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-dashed border-slate-300">
          <span className="font-bold">B</span>
          Bridge day (not paid)
        </span>
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
                      day.isBridgeDay
                        ? 'bg-slate-50 border-dashed border-slate-200'
                        : day.isToday
                          ? 'bg-indigo-50'
                          : day.isWeeklyOff
                            ? 'bg-gray-100/60'
                            : ''
                    }`}
                    title={`${day.weekday} ${day.dateKey}${day.isBridgeDay ? ' (bridge — not paid)' : day.isPaidDay ? ' (paid)' : ''}`}
                  >
                    {day.monthShort && (
                      <div className="text-[8px] text-gray-400 font-medium leading-none mb-0.5">{day.monthShort}</div>
                    )}
                    <div
                      className={`font-semibold ${
                        day.isBridgeDay
                          ? 'text-slate-400'
                          : day.isToday
                            ? 'text-indigo-700'
                            : 'text-gray-700'
                      }`}
                    >
                      {day.day}
                    </div>
                    <div className="text-[9px] text-gray-400 font-normal">
                      {day.isBridgeDay ? 'B' : day.weekday.charAt(0)}
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
                            day.isBridgeDay
                              ? 'bg-slate-50/80'
                              : day.isToday
                                ? 'ring-1 ring-inset ring-indigo-200'
                                : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedCell({
                                employeeName: row.employeeName,
                                department: row.department,
                                day,
                                cell,
                              })
                            }
                            className={`inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded font-bold text-[9px] sm:text-[10px] ${
                              day.isBridgeDay ? 'opacity-60 ring-1 ring-dashed ring-slate-300' : ''
                            } ${style.bg} ${style.text} hover:opacity-80 transition-opacity`}
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
        Salary month = month paid (e.g. June = 26 May – 26 Jun). Bridge days at cycle end are not paid. Today: {getISTDateKey()}.
      </p>

      {selectedCell && (
        <Modal
          isOpen
          onClose={() => setSelectedCell(null)}
          title={selectedCell.employeeName}
          subtitle={`${selectedCell.day.weekday}, ${selectedCell.day.dateKey}`}
          size="sm"
          footer={
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedCell(null)}>Close</Button>
            </div>
          }
        >
          <div className="p-6 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded font-bold ${REGISTER_CELL_STYLES[selectedCell.cell.code].bg} ${REGISTER_CELL_STYLES[selectedCell.cell.code].text}`}
              >
                {displayCode(selectedCell.cell.code)}
              </span>
              <span className="font-medium text-gray-900">{selectedCell.cell.label}</span>
            </div>
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
          </div>
        </Modal>
      )}
    </div>
  );
};
