import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { NexusPage, NexusPageHeader } from '../components/layout/NexusPageHeader';
import { useStore } from '../store/useStore';
import { AttendanceRegisterPanel } from '../components/AttendanceRegisterPanel';
import { EmployeeAttendancePanel } from '../components/EmployeeAttendancePanel';
import { AttendanceApprovalsPanel } from '../components/AttendanceApprovalsPanel';
import { countPendingLeaveSubmissions } from '../lib/leave';

type AttendanceTab = 'today' | 'register' | 'approvals';

export const Attendance: React.FC = () => {
  const viewMode = useStore((s) => s.viewMode);
  const pendingLeaveCount = useStore((s) => countPendingLeaveSubmissions(s.leaveRequests));
  const pendingOffsiteCount = useStore((s) =>
    s.attendanceApprovalRequests.filter((r) => r.status === 'pending').length,
  );
  const pendingTotal = pendingLeaveCount + pendingOffsiteCount;

  const [pageTab, setPageTab] = React.useState<AttendanceTab>('today');

  if (viewMode !== 'admin') {
    return (
      <div className="p-6 max-w-lg mx-auto mt-20">
        <Card className="p-8 text-center">
          <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900">Admin Access Required</h1>
          <p className="text-sm text-gray-500 mt-2">Attendance management is only available to administrators.</p>
        </Card>
      </div>
    );
  }

  return (
    <NexusPage maxWidthClass="max-w-[1400px]">
      <NexusPageHeader
        title="Attendance"
        description="Daily presence, register, and leave / off-site approvals."
      />
      <div className="nexus-segmented mb-6 flex-wrap">
        {([
          { id: 'today' as const, label: 'Today' },
          { id: 'register' as const, label: 'Register' },
          {
            id: 'approvals' as const,
            label: pendingTotal > 0 ? `Approvals (${pendingTotal})` : 'Approvals',
          },
        ]).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPageTab(id)}
            className={pageTab === id ? 'is-active' : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      {pageTab === 'today' && <EmployeeAttendancePanel />}
      {pageTab === 'register' && <AttendanceRegisterPanel compactHeader />}
      {pageTab === 'approvals' && <AttendanceApprovalsPanel />}
    </NexusPage>
  );
};
