import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useStore } from '../store/useStore';
import { AttendanceRegisterPanel } from '../components/AttendanceRegisterPanel';
import { EmployeeAttendancePanel } from '../components/EmployeeAttendancePanel';
import { AttendanceApprovalsPanel } from '../components/AttendanceApprovalsPanel';
import { AttendanceChangesDemo } from '../components/AttendanceChangesDemo';

type AttendanceTab = 'register' | 'today' | 'approvals' | 'demo';

export const Attendance: React.FC = () => {
  const viewMode = useStore((s) => s.viewMode);
  const pendingLeaveCount = useStore((s) =>
    s.leaveRequests.filter((r) => r.status === 'pending').length,
  );
  const pendingOffsiteCount = useStore((s) =>
    s.attendanceApprovalRequests.filter((r) => r.status === 'pending').length,
  );
  const pendingTotal = pendingLeaveCount + pendingOffsiteCount;

  const [pageTab, setPageTab] = useState<AttendanceTab>('register');

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
    <div className="p-4 sm:p-6 w-full min-w-0 overflow-x-hidden">
      <div className="flex flex-wrap gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        {([
          { id: 'register' as const, label: 'Register' },
          { id: 'today' as const, label: 'Today' },
          {
            id: 'approvals' as const,
            label: pendingTotal > 0 ? `Approvals (${pendingTotal})` : 'Approvals',
          },
          { id: 'demo' as const, label: 'Demo' },
        ]).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPageTab(id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              pageTab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {pageTab === 'register' && <AttendanceRegisterPanel compactHeader />}
      {pageTab === 'today' && <EmployeeAttendancePanel />}
      {pageTab === 'approvals' && <AttendanceApprovalsPanel />}
      {pageTab === 'demo' && <AttendanceChangesDemo />}
    </div>
  );
};
