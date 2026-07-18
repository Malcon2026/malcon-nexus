import React, { useMemo } from 'react';
import { Download, MapPin } from 'lucide-react';
import { Card, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useStore } from '../../store/useStore';
import { formatDateIST, formatTimeIST } from '../../lib/attendance';
import { formatDateTime } from '../../utils/helpers';
import { exportAttendanceApprovalsCsv } from '../../utils/reportsExport';

export const ReportsApprovalsSection: React.FC = () => {
  const cases = useStore((s) => s.cases);
  const attendanceApprovalRequests = useStore((s) => s.attendanceApprovalRequests);

  const pendingStageApprovals = useMemo(
    () => cases.filter((c) => c.status === 'Waiting For Approval'),
    [cases],
  );

  const pendingOffsite = useMemo(
    () => attendanceApprovalRequests.filter((r) => r.status === 'pending'),
    [attendanceApprovalRequests],
  );

  const recentOffsite = useMemo(
    () => [...attendanceApprovalRequests].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()).slice(0, 20),
    [attendanceApprovalRequests],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-3xl font-bold text-amber-600">{pendingStageApprovals.length}</p>
          <p className="text-sm font-medium text-gray-900 mt-1">Stage Approvals Pending</p>
          <p className="text-xs text-gray-500 mt-0.5">Cases waiting for admin review</p>
        </Card>
        <Card className="p-5">
          <p className="text-3xl font-bold text-indigo-600">{pendingOffsite.length}</p>
          <p className="text-sm font-medium text-gray-900 mt-1">Off-site Punch Out Requests</p>
          <p className="text-xs text-gray-500 mt-0.5">Attendance approvals awaiting action</p>
        </Card>
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Cases Awaiting Stage Approval</h3>
        </div>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                {['Case', 'Hospital', 'Stage', 'Assigned To', 'Updated'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pendingStageApprovals.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-semibold text-indigo-600">{c.caseNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{c.hospital.name}</td>
                  <td className="px-4 py-3"><Badge className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">{c.currentStage}</Badge></td>
                  <td className="px-4 py-3 text-gray-700">{c.assignedEmployee?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 tabular-nums">{formatDateTime(c.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pendingStageApprovals.length === 0 && (
            <p className="text-center py-10 text-sm text-gray-400">No pending stage approvals</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Off-site Punch Out Requests</h3>
          <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={() => exportAttendanceApprovalsCsv(recentOffsite)}>
            Export CSV
          </Button>
        </div>
        <CardBody className="p-0">
          <div className="divide-y divide-gray-50">
            {recentOffsite.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">{r.employeeName}</span>
                  <Badge className={`text-[10px] ${r.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : r.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {r.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{formatDateIST(r.requestedAt)} · {formatTimeIST(r.requestedAt)}</p>
                <p className="text-sm text-gray-800 mt-2">{r.reason}</p>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {r.distanceM}m from office
                </p>
              </div>
            ))}
            {recentOffsite.length === 0 && (
              <p className="text-center py-10 text-sm text-gray-400">No off-site punch out requests</p>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
