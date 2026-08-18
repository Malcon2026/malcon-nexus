import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useStore } from '../store/useStore';
import { AttendanceRegisterPanel } from '../components/AttendanceRegisterPanel';
import { EmployeeAttendancePanel } from '../components/EmployeeAttendancePanel';
import { AttendanceApprovalsPanel } from '../components/AttendanceApprovalsPanel';
import { formatTimeIST } from '../lib/attendance';
import { todayLocationTripKm, tripEndPlusCode, tripKm, tripStartPlusCode, visibleLocationTrips } from '../lib/locationTrip';
import { PlusCodeLink } from '../components/PlusCodeLink';
import { googleBikeMapsUrl } from '../lib/bikeRoute';

const LocationTripAdmin: React.FC = () => {
  const trips = useStore((s) => s.locationTrips);
  const today = visibleLocationTrips(trips);
  if (today.length === 0) return null;

  const byEmployee = new Map<string, typeof today>();
  for (const t of today) {
    const list = byEmployee.get(t.employeeId) ?? [];
    list.push(t);
    byEmployee.set(t.employeeId, list);
  }

  return (
    <Card className="mt-4">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900">Location punchin</p>
        <p className="text-xs text-gray-500 mt-0.5">Start → reached. Bike road km from Maps. Plus Code to re-check.</p>
      </div>
      <div className="divide-y divide-gray-50">
        {[...byEmployee.entries()].map(([id, rows]) => {
          const ordered = [...rows].sort((a, b) => a.tripNo - b.tripNo);
          return (
            <div key={id} className="px-4 py-3">
              <p className="text-sm font-medium text-gray-900">
                {rows[0].employeeName}
                <span className="ml-2 text-xs font-semibold text-sky-700 tabular-nums">
                  {todayLocationTripKm(rows, id)} km today
                </span>
              </p>
              <ul className="mt-1 space-y-0.5">
                {ordered.map((t) => (
                  <li key={t.id} className="text-xs text-gray-600 py-1">
                    <p>
                      Trip {t.tripNo} · {formatTimeIST(t.startAt)}
                      {t.endAt ? ` → ${formatTimeIST(t.endAt)}` : ''}
                      {t.status === 'completed' ? ` · ${tripKm(t)} km${t.bikeKm != null ? ' bike' : ''}` : ' · in progress'}
                      {t.notes ? ` · ${t.notes}` : ''}
                    </p>
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      <PlusCodeLink
                        label="Start"
                        plusCode={tripStartPlusCode(t)}
                        lat={t.startLat}
                        lng={t.startLng}
                        accuracyM={t.startAccuracyM}
                      />
                      {t.status === 'completed' && (
                        <PlusCodeLink
                          label="Reached"
                          plusCode={tripEndPlusCode(t)}
                          lat={t.endLat}
                          lng={t.endLng}
                          accuracyM={t.endAccuracyM}
                        />
                      )}
                      {t.status === 'completed' && t.endLat != null && t.endLng != null && (
                        <a
                          href={googleBikeMapsUrl(t.startLat, t.startLng, t.endLat, t.endLng)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-sky-700 hover:underline"
                        >
                          Bike route on Maps
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
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
          <LocationTripAdmin />
        </>
      )}
      {pageTab === 'register' && <AttendanceRegisterPanel compactHeader />}
      {pageTab === 'approvals' && <AttendanceApprovalsPanel />}
    </div>
  );
};
