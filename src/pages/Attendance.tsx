import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useStore } from '../store/useStore';
import { AttendanceRegisterPanel } from '../components/AttendanceRegisterPanel';
import { EmployeeAttendancePanel } from '../components/EmployeeAttendancePanel';
import { AttendanceApprovalsPanel } from '../components/AttendanceApprovalsPanel';
import { getISTDateKey, formatTimeIST } from '../lib/attendance';
import { todayTripKm } from '../lib/hospitalTrip';

const HospitalTripPilotAdmin: React.FC = () => {
  const punches = useStore((s) => s.hospitalTripPunches);
  const todayKey = getISTDateKey();
  const today = punches
    .filter((p) => getISTDateKey(p.punchedAt) === todayKey)
    .sort((a, b) => new Date(b.punchedAt).getTime() - new Date(a.punchedAt).getTime());
  if (today.length === 0) return null;

  const byEmployee = new Map<string, typeof today>();
  for (const p of today) {
    const list = byEmployee.get(p.employeeId) ?? [];
    list.push(p);
    byEmployee.set(p.employeeId, list);
  }

  return (
    <Card className="mt-4">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900">Hospital trip punches · optional pilot</p>
        <p className="text-xs text-gray-500 mt-0.5">Office → hospital GPS km. Boys can skip this.</p>
      </div>
      <div className="divide-y divide-gray-50">
        {[...byEmployee.entries()].map(([id, rows]) => (
          <div key={id} className="px-4 py-3">
            <p className="text-sm font-medium text-gray-900">
              {rows[0].employeeName}
              <span className="ml-2 text-xs font-semibold text-sky-700 tabular-nums">
                {todayTripKm(rows, id)} km today
              </span>
            </p>
            <ul className="mt-1 space-y-0.5">
              {rows.map((p) => (
                <li key={p.id} className="text-xs text-gray-600">
                  {formatTimeIST(p.punchedAt)} · {p.hospitalName}
                  {p.distanceKm > 0 ? ` · ${p.distanceKm} km from ${p.fromLabel}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
};

type AttendanceTab = 'today' | 'register' | 'approvals';

export const Attendance: React.FC = () => {
  const viewMode = useStore((s) => s.viewMode);
  const pendingLeaveCount = useStore((s) =>
    s.leaveRequests.filter((r) => r.status === 'pending').length,
  );
  const pendingOffsiteCount = useStore((s) =>
    s.attendanceApprovalRequests.filter((r) => r.status === 'pending').length,
  );
  const pendingTotal = pendingLeaveCount + pendingOffsiteCount;

  const [pageTab, setPageTab] = useState<AttendanceTab>('today');

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
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              pageTab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {pageTab === 'today' && (
        <>
          <EmployeeAttendancePanel />
          <HospitalTripPilotAdmin />
        </>
      )}
      {pageTab === 'register' && <AttendanceRegisterPanel compactHeader />}
      {pageTab === 'approvals' && <AttendanceApprovalsPanel />}
    </div>
  );
};
