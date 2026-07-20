import React, { useMemo, useState } from 'react';
import {
  CheckCircle2, XCircle, Clock, MapPin, RefreshCw, AlertCircle,
} from 'lucide-react';
import { Card, CardBody } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Avatar } from './ui/Avatar';
import { Modal } from './ui/Modal';
import { useStore } from '../store/useStore';
import { departmentColors } from '../utils/helpers';
import type { AttendanceApprovalRequest, Department } from '../types';
import { formatTimeIST, formatDateIST, getISTDateKey } from '../lib/attendance';

const statusConfig = {
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
} as const;

export const EmployeeAttendanceApprovalsPanel: React.FC = () => {
  const employees = useStore((s) => s.employees);
  const attendanceApprovalRequests = useStore((s) => s.attendanceApprovalRequests);
  const approveAttendanceApprovalRequest = useStore((s) => s.approveAttendanceApprovalRequest);
  const rejectAttendanceApprovalRequest = useStore((s) => s.rejectAttendanceApprovalRequest);
  const reloadFromDatabase = useStore((s) => s.reloadFromDatabase);

  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [refreshing, setRefreshing] = useState(false);
  const [reviewing, setReviewing] = useState<AttendanceApprovalRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const employeeById = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  );

  const sorted = useMemo(
    () =>
      [...attendanceApprovalRequests].sort(
        (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
      ),
    [attendanceApprovalRequests],
  );

  const filtered = filter === 'pending'
    ? sorted.filter((r) => r.status === 'pending')
    : sorted;

  const pendingCount = sorted.filter((r) => r.status === 'pending').length;

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

  const openReview = (request: AttendanceApprovalRequest, action: 'approve' | 'reject') => {
    setReviewing(request);
    setReviewAction(action);
    setAdminNotes('');
    setError(null);
  };

  const closeReview = () => {
    if (submitting) return;
    setReviewing(null);
    setReviewAction(null);
    setAdminNotes('');
    setError(null);
  };

  const handleSubmitReview = async () => {
    if (!reviewing || !reviewAction) return;
    setSubmitting(true);
    setError(null);

    const result =
      reviewAction === 'approve'
        ? await approveAttendanceApprovalRequest(reviewing.id, adminNotes)
        : await rejectAttendanceApprovalRequest(reviewing.id, adminNotes);

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    closeReview();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Off-site Punch Approvals</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Review employee requests when they punch in or out away from the office.
          </p>
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center mb-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Pending Requests</p>
        </Card>
        <Card className="p-4">
          <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {sorted.filter((r) => r.status === 'approved').length}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Approved</p>
        </Card>
        <Card className="p-4 col-span-2 sm:col-span-1">
          <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center mb-2">
            <XCircle className="h-4 w-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {sorted.filter((r) => r.status === 'rejected').length}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Rejected</p>
        </Card>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {([
          { id: 'pending' as const, label: `Pending${pendingCount ? ` (${pendingCount})` : ''}` },
          { id: 'all' as const, label: 'All Requests' },
        ]).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardBody className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">
                {filter === 'pending' ? 'No pending approval requests' : 'No requests yet'}
              </p>
              <p className="text-xs mt-1">Off-site punch in/out requests will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((request) => {
                const employee = employeeById.get(request.employeeId);
                const dept = (employee?.department ?? 'Stores') as Department;
                const sc = statusConfig[request.status];
                const isToday = getISTDateKey(request.requestedAt) === getISTDateKey();

                return (
                  <div key={request.id} className="p-4 sm:p-5 hover:bg-gray-50/60 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <Avatar name={request.employeeName} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="font-semibold text-gray-900">{request.employeeName}</p>
                            <Badge className={`${departmentColors[dept] ?? 'bg-gray-100 text-gray-700'} text-[10px]`}>
                              {employee?.department ?? '—'}
                            </Badge>
                            <Badge className={`${sc.className} text-[10px]`}>{sc.label}</Badge>
                            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                              {request.punchType === 'in' ? 'Punch In' : 'Punch Out'}
                            </Badge>
                            {isToday && (
                              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                                Today
                              </Badge>
                            )}
                          </div>

                          <p className="text-sm text-gray-600 mb-2">
                            Requested {formatDateIST(request.requestedAt)} at{' '}
                            <span className="font-medium tabular-nums">{formatTimeIST(request.requestedAt)}</span>
                          </p>

                          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 mb-2">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                              Reason
                            </p>
                            <p className="text-sm text-gray-800">{request.reason}</p>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span>{request.distanceM}m from office · GPS ±{Math.round(request.accuracyM)}m</span>
                          </div>

                          {request.status !== 'pending' && request.reviewedBy && (
                            <p className="text-xs text-gray-500 mt-2">
                              {request.status === 'approved' ? 'Approved' : 'Rejected'} by{' '}
                              <span className="font-medium">{request.reviewedBy}</span>
                              {request.reviewedAt && (
                                <> on {formatDateIST(request.reviewedAt)} at {formatTimeIST(request.reviewedAt)}</>
                              )}
                              {request.adminNotes && (
                                <> · Note: {request.adminNotes}</>
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      {request.status === 'pending' && (
                        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<CheckCircle2 className="h-4 w-4" />}
                            onClick={() => openReview(request, 'approve')}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<XCircle className="h-4 w-4" />}
                            onClick={() => openReview(request, 'reject')}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        isOpen={reviewing !== null && reviewAction !== null}
        onClose={closeReview}
        title={
          reviewAction === 'approve'
            ? `Approve ${reviewing?.punchType === 'in' ? 'Punch In' : 'Punch Out'}`
            : 'Reject Request'
        }
        subtitle={
          reviewing
            ? `${reviewing.employeeName} · ${formatTimeIST(reviewing.requestedAt)}`
            : undefined
        }
        size="md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={closeReview} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant={reviewAction === 'approve' ? 'primary' : 'outline'}
              onClick={() => void handleSubmitReview()}
              disabled={submitting}
            >
              {submitting
                ? 'Processing…'
                : reviewAction === 'approve'
                  ? 'Confirm Approval'
                  : 'Confirm Rejection'}
            </Button>
          </div>
        }
      >
        {reviewing && (
          <div className="px-4 sm:px-6 py-4 space-y-4">
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Employee reason</p>
              <p className="text-sm text-gray-800">{reviewing.reason}</p>
            </div>

            {reviewAction === 'approve' ? (
              <p className="text-sm text-gray-600">
                Approving will record {reviewing.punchType === 'in' ? 'punch in' : 'punch out'} at{' '}
                <span className="font-medium tabular-nums">{formatTimeIST(reviewing.requestedAt)}</span>{' '}
                for this employee.
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                {reviewing.punchType === 'in'
                  ? 'The employee will remain not punched in and can punch in again from the office or submit a new request.'
                  : 'The employee will remain punched in and can punch out again from the office or submit a new request.'}
              </p>
            )}

            <div>
              <label htmlFor="admin-notes" className="block text-xs font-semibold text-gray-900 mb-1.5">
                Admin notes (optional)
              </label>
              <textarea
                id="admin-notes"
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Optional note for your records…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
