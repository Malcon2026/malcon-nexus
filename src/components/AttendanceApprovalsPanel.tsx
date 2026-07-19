import React, { useState } from 'react';
import { EmployeeLeaveApprovalsPanel } from './EmployeeLeaveApprovalsPanel';
import { EmployeeAttendanceApprovalsPanel } from './EmployeeAttendanceApprovalsPanel';
import { useStore } from '../store/useStore';

type ApprovalFilter = 'all' | 'leave' | 'offsite';

export const AttendanceApprovalsPanel: React.FC = () => {
  const pendingLeaveCount = useStore((s) =>
    s.leaveRequests.filter((r) => r.status === 'pending').length,
  );
  const pendingOffsiteCount = useStore((s) =>
    s.attendanceApprovalRequests.filter((r) => r.status === 'pending').length,
  );
  const [filter, setFilter] = useState<ApprovalFilter>('all');

  const tabs: { id: ApprovalFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: pendingLeaveCount + pendingOffsiteCount },
    { id: 'leave', label: 'Leave', count: pendingLeaveCount },
    { id: 'offsite', label: 'Off-site Punch Out', count: pendingOffsiteCount },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {tabs.map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {count > 0 && filter !== id ? `${label} (${count})` : label}
            {count > 0 && filter === id ? ` (${count})` : ''}
          </button>
        ))}
      </div>

      {(filter === 'all' || filter === 'leave') && (
        <div>
          {filter === 'all' && (
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Leave Requests</h3>
          )}
          <EmployeeLeaveApprovalsPanel />
        </div>
      )}

      {(filter === 'all' || filter === 'offsite') && (
        <div>
          {filter === 'all' && (
            <h3 className="text-sm font-semibold text-gray-900 mb-3 pt-2 border-t border-gray-100">
              Off-site Punch Out
            </h3>
          )}
          <EmployeeAttendanceApprovalsPanel />
        </div>
      )}
    </div>
  );
};
