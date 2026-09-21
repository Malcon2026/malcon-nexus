import React from 'react';
import { NexusPage, NexusPageHeader } from '../components/layout/NexusPageHeader';
import { AdminAccessGate } from '../components/layout/AdminAccessGate';
import { FieldTeamAttendanceApprovalsPanel } from '../components/FieldTeamAttendanceApprovalsPanel';
import { useStore } from '../store/useStore';
import { getISTDateKey } from '../lib/attendance';
import { requiresFieldTeamAttendanceApproval } from '../lib/fieldTeamAttendance';

export const AttendanceApprovals: React.FC = () => {
  const viewMode = useStore((s) => s.viewMode);
  const employees = useStore((s) => s.employees);
  const attendanceRecords = useStore((s) => s.attendanceRecords);
  const fieldTeamAttendanceApprovals = useStore((s) => s.fieldTeamAttendanceApprovals);

  const todayKey = getISTDateKey();
  const pendingCount = React.useMemo(() => {
    const fieldIds = new Set(
      employees.filter((e) => e.status === 'Active' && requiresFieldTeamAttendanceApproval(e)).map((e) => e.id),
    );
    const punchedToday = new Set(
      attendanceRecords
        .filter((r) => fieldIds.has(r.employeeId) && r.punchType === 'in')
        .filter((r) => r.punchedAt.slice(0, 10) <= todayKey)
        .map((r) => r.employeeId),
    );
    let pending = 0;
    for (const id of punchedToday) {
      const credit = fieldTeamAttendanceApprovals.find((a) => a.employeeId === id && a.dateKey === todayKey);
      if (!credit || credit.status === 'pending') pending += 1;
    }
    return pending;
  }, [employees, attendanceRecords, fieldTeamAttendanceApprovals, todayKey]);

  if (viewMode !== 'admin') {
    return (
      <AdminAccessGate description="Attendance approvals are only available to administrators." />
    );
  }

  return (
    <NexusPage maxWidthClass="max-w-[1200px]">
      <NexusPageHeader
        title="Attendance Approvals"
        description={
          pendingCount > 0
            ? `${pendingCount} field-team punch${pendingCount === 1 ? '' : 'es'} awaiting credit today (IST).`
            : 'Approve daily attendance for Stores, Scrub Person, and Delivery.'
        }
      />
      <FieldTeamAttendanceApprovalsPanel />
    </NexusPage>
  );
};
