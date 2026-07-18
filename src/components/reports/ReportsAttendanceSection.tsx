import React, { useMemo, useState } from 'react';
import { Calendar, Download, RefreshCw, Search } from 'lucide-react';
import { Card, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { useStore } from '../../store/useStore';
import { departmentColors } from '../../utils/helpers';
import type { Department } from '../../types';
import {
  buildEmployeeAttendanceReport,
  formatDuration,
  formatTimeIST,
  getISTDateKey,
} from '../../lib/attendance';
import { exportAttendanceCsv } from '../../utils/reportsExport';

const statusConfig = {
  in: { label: 'Punched In', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  out: { label: 'Completed', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  absent: { label: 'Absent', className: 'bg-gray-100 text-gray-600 border-gray-200' },
} as const;

export const ReportsAttendanceSection: React.FC = () => {
  const employees = useStore((s) => s.employees);
  const attendanceRecords = useStore((s) => s.attendanceRecords);
  const reloadFromDatabase = useStore((s) => s.reloadFromDatabase);
  const [search, setSearch] = useState('');
  const [dateKey, setDateKey] = useState(getISTDateKey());
  const [refreshing, setRefreshing] = useState(false);

  const report = useMemo(
    () => buildEmployeeAttendanceReport(employees, attendanceRecords, dateKey),
    [employees, attendanceRecords, dateKey],
  );

  const filtered = report.filter((row) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return row.employeeName.toLowerCase().includes(q) || row.department.toLowerCase().includes(q);
  });

  const stats = useMemo(() => ({
    in: report.filter((r) => r.status === 'in').length,
    out: report.filter((r) => r.status === 'out').length,
    absent: report.filter((r) => r.status === 'absent').length,
  }), [report]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { bootstrapEssential } = await import('../../lib/database/bootstrap');
      await bootstrapEssential('admin');
      reloadFromDatabase();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Punched In', value: stats.in, className: 'text-emerald-600' },
          { label: 'Completed', value: stats.out, className: 'text-blue-600' },
          { label: 'Absent', value: stats.absent, className: 'text-gray-600' },
        ].map(({ label, value, className }) => (
          <Card key={label} className="p-4">
            <p className={`text-2xl font-bold ${className}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

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
        </div>
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employee or department…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-gray-50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" icon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />} onClick={() => void handleRefresh()} disabled={refreshing}>
          Refresh
        </Button>
        <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={() => exportAttendanceCsv(filtered, dateKey)}>
          Export CSV
        </Button>
      </div>

      <Card>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                {['Employee', 'Department', 'Punch In', 'Punch Out', 'Hours', 'Status'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((row) => {
                const sc = statusConfig[row.status];
                const dept = row.department as Department;
                return (
                  <tr key={row.employeeId} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={row.employeeName} size="sm" />
                        <span className="font-medium text-gray-900">{row.employeeName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${departmentColors[dept] ?? 'bg-gray-100 text-gray-700'} text-[10px]`}>{row.department}</Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.punchIn ? formatTimeIST(row.punchIn.punchedAt) : '—'}</td>
                    <td className="px-4 py-3 tabular-nums">{row.punchOut ? formatTimeIST(row.punchOut.punchedAt) : '—'}</td>
                    <td className="px-4 py-3 tabular-nums font-medium">{row.punchIn ? formatDuration(row.workedMs) : '—'}</td>
                    <td className="px-4 py-3"><Badge className={`${sc.className} text-[10px]`}>{sc.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center py-12 text-sm text-gray-400">No attendance data for this date</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
