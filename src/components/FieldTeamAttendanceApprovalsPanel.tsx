import React, { useMemo, useState } from 'react';
import { Calendar, Check, Loader2, X } from 'lucide-react';
import { Card, CardBody } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useStore } from '../store/useStore';
import {
  buildEmployeeAttendanceReport,
  formatTimeIST,
  getISTDateKey,
} from '../lib/attendance';
import {
  FIELD_TEAM_ATTENDANCE_DEPARTMENTS,
  requiresFieldTeamAttendanceApproval,
} from '../lib/fieldTeamAttendance';
import { departmentSelectClass, formatEmployeeDepartments } from '../constants/departments';

export const FieldTeamAttendanceApprovalsPanel: React.FC = () => {
  const employees = useStore((s) => s.employees);
  const attendanceRecords = useStore((s) => s.attendanceRecords);
  const fieldTeamAttendanceApprovals = useStore((s) => s.fieldTeamAttendanceApprovals);
  const approveFieldTeamAttendanceDay = useStore((s) => s.approveFieldTeamAttendanceDay);
  const rejectFieldTeamAttendanceDay = useStore((s) => s.rejectFieldTeamAttendanceDay);

  const [dateKey, setDateKey] = useState(getISTDateKey());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fieldStaff = useMemo(
    () => employees.filter((e) => e.status === 'Active' && requiresFieldTeamAttendanceApproval(e)),
    [employees],
  );

  const report = useMemo(
    () => buildEmployeeAttendanceReport(fieldStaff, attendanceRecords, dateKey, fieldTeamAttendanceApprovals),
    [fieldStaff, attendanceRecords, dateKey, fieldTeamAttendanceApprovals],
  );

  const rows = useMemo(() => {
    return report
      .map((row) => {
        const emp = fieldStaff.find((e) => e.id === row.employeeId);
        const credit = fieldTeamAttendanceApprovals.find(
          (a) => a.employeeId === row.employeeId && a.dateKey === dateKey,
        );
        return {
          ...row,
          departmentsLabel: emp ? formatEmployeeDepartments(emp) : row.department,
          creditStatus: row.punchIn ? (credit?.status ?? 'pending') : undefined,
          creditId: credit?.id,
        };
      })
      .sort((a, b) => {
        const order = (s: string | undefined) => {
          if (s === 'pending') return 0;
          if (!s && a.punchIn) return 0;
          if (s === 'rejected') return 1;
          if (s === 'approved') return 3;
          return 2;
        };
        const d = order(a.creditStatus) - order(b.creditStatus);
        if (d !== 0) return d;
        return a.employeeName.localeCompare(b.employeeName);
      });
  }, [report, fieldStaff, fieldTeamAttendanceApprovals, dateKey]);

  const pendingCount = rows.filter((r) => r.punchIn && r.creditStatus !== 'approved' && r.creditStatus !== 'rejected').length
    + rows.filter((r) => r.punchIn && !r.creditId).length;

  const runAction = async (employeeId: string, action: 'approve' | 'reject') => {
    setError(null);
    setBusyId(employeeId);
    const fn = action === 'approve' ? approveFieldTeamAttendanceDay : rejectFieldTeamAttendanceDay;
    const { error: err } = await fn(employeeId, dateKey);
    setBusyId(null);
    if (err) setError(err);
  };

  return (
    <div className="space-y-4 min-w-0">
      <p className="text-sm text-[var(--color-label-secondary)] max-w-2xl">
        <span className="font-medium text-[var(--color-label)]">Stores</span>,{' '}
        <span className="font-medium text-[var(--color-label)]">Scrub Person</span>, and{' '}
        <span className="font-medium text-[var(--color-label)]">Delivery</span> can punch in and out as usual.
        Their day stays <span className="font-medium">absent</span> on the register until you approve that they completed the work.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[var(--color-label-tertiary)]" aria-hidden />
          <input
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
            className={departmentSelectClass}
          />
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-amber-50 text-amber-800 border-amber-200">{pendingCount} awaiting approval</Badge>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <Card>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--color-separator)] bg-[var(--color-bg)] text-left text-xs text-[var(--color-label-secondary)]">
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Team</th>
                <th className="px-4 py-2.5 font-medium">Punch in</th>
                <th className="px-4 py-2.5 font-medium">Punch out</th>
                <th className="px-4 py-2.5 font-medium">Register</th>
                <th className="px-4 py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-separator)]">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-label-tertiary)]">
                    No active staff in {FIELD_TEAM_ATTENDANCE_DEPARTMENTS.join(', ')}.
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const punched = Boolean(row.punchIn);
                const approved = row.creditStatus === 'approved';
                const rejected = row.creditStatus === 'rejected';
                const pending = punched && !approved && !rejected;

                return (
                  <tr key={row.employeeId} className="hover:bg-[var(--color-bg)]/50">
                    <td className="px-4 py-3 font-medium text-[var(--color-label)]">{row.employeeName}</td>
                    <td className="px-4 py-3 text-[var(--color-label-secondary)]">{row.departmentsLabel}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.punchIn ? formatTimeIST(row.punchIn.punchedAt) : '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.punchOut ? formatTimeIST(row.punchOut.punchedAt) : row.status === 'in' ? 'Still in' : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {!punched && <span className="text-[var(--color-label-tertiary)]">Absent · no punch</span>}
                      {pending && (
                        <Badge className="bg-amber-50 text-amber-800 border-amber-200">Absent · pending approval</Badge>
                      )}
                      {approved && (
                        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">Present · approved</Badge>
                      )}
                      {rejected && (
                        <Badge className="bg-gray-100 text-gray-700 border-gray-200">Absent · not approved</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {pending && (
                          <>
                            <Button
                              variant="success"
                              size="xs"
                              disabled={busyId === row.employeeId}
                              icon={busyId === row.employeeId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              onClick={() => void runAction(row.employeeId, 'approve')}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              disabled={busyId === row.employeeId}
                              icon={<X className="h-3 w-3" />}
                              onClick={() => void runAction(row.employeeId, 'reject')}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
};
