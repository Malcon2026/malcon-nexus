import React, { useMemo, useState } from 'react';
import {
  Search, Calendar, RefreshCw, LogIn, LogOut, UserX, Users,
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
} from '../lib/attendance';

const DEPARTMENTS: (Department | 'All')[] = [
  'All', 'Stores', 'Delivery', 'Scrub Person', 'Cleaning Department', 'Stores Audit', 'Accounts', 'Bill Submission', 'Admin',
];

const statusConfig = {
  in: { label: 'Punched In', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  out: { label: 'Completed', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  absent: { label: 'Absent', className: 'bg-gray-100 text-gray-600 border-gray-200' },
} as const;

export const EmployeeAttendancePanel: React.FC = () => {
  const employees = useStore((s) => s.employees);
  const attendanceRecords = useStore((s) => s.attendanceRecords);
  const reloadFromDatabase = useStore((s) => s.reloadFromDatabase);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState<Department | 'All'>('All');
  const [dateKey, setDateKey] = useState(getISTDateKey());
  const [refreshing, setRefreshing] = useState(false);

  const report = useMemo(
    () => buildEmployeeAttendanceReport(employees, attendanceRecords, dateKey),
    [employees, attendanceRecords, dateKey],
  );

  const filtered = report.filter((row) => {
    if (filterDept !== 'All' && row.department !== filterDept) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return row.employeeName.toLowerCase().includes(q) || row.department.toLowerCase().includes(q);
  });

  const stats = useMemo(() => ({
    total: report.length,
    in: report.filter((r) => r.status === 'in').length,
    out: report.filter((r) => r.status === 'out').length,
    absent: report.filter((r) => r.status === 'absent').length,
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

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Staff', value: stats.total, icon: <Users className="h-4 w-4 text-gray-600" />, bg: 'bg-gray-50' },
          { label: 'Punched In', value: stats.in, icon: <LogIn className="h-4 w-4 text-emerald-600" />, bg: 'bg-emerald-50' },
          { label: 'Punched Out', value: stats.out, icon: <LogOut className="h-4 w-4 text-blue-600" />, bg: 'bg-blue-50' },
          { label: 'Absent', value: stats.absent, icon: <UserX className="h-4 w-4 text-gray-500" />, bg: 'bg-gray-50' },
        ].map(({ label, value, icon, bg }) => (
          <Card key={label} className="p-4">
            <div className={`h-8 w-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>{icon}</div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Card>
        ))}
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

      <div className="flex gap-1.5 flex-wrap">
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

      {/* Table */}
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
                      <Badge className={`${sc.className} text-[10px]`}>{sc.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No attendance records found</p>
              <p className="text-xs mt-1">Try another date or adjust filters</p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
