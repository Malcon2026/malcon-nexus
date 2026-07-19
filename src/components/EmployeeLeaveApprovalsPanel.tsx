import React, { useMemo, useState } from 'react';
import {
  CheckCircle2, XCircle, Clock, RefreshCw, CalendarDays, AlertCircle,
} from 'lucide-react';
import { Card, CardBody } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Avatar } from './ui/Avatar';
import { Modal } from './ui/Modal';
import { useStore } from '../store/useStore';
import { departmentColors } from '../utils/helpers';
import type { LeaveRequest } from '../types';
import { countWorkingLeaveDays, formatLeaveDateRange } from '../lib/leave';

const statusConfig = {
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-600 border-gray-200' },
} as const;

export const EmployeeLeaveApprovalsPanel: React.FC = () => {
  const employees = useStore((s) => s.employees);
  const leaveRequests = useStore((s) => s.leaveRequests);
  const approveLeave = useStore((s) => s.approveLeave);
  const rejectLeave = useStore((s) => s.rejectLeave);
  const reloadFromDatabase = useStore((s) => s.reloadFromDatabase);

  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [refreshing, setRefreshing] = useState(false);
  const [reviewing, setReviewing] = useState<LeaveRequest | null>(null);
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
      [...leaveRequests].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [leaveRequests],
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

  const openReview = (request: LeaveRequest, action: 'approve' | 'reject') => {
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

  const submitReview = async () => {
    if (!reviewing || !reviewAction) return;
    setSubmitting(true);
    setError(null);
    try {
      const result =
        reviewAction === 'approve'
          ? await approveLeave(reviewing.id, adminNotes)
          : await rejectLeave(reviewing.id, adminNotes);
      if (result.error) {
        setError(result.error);
        return;
      }
      closeReview();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
          {(['pending', 'all'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filter === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {id === 'pending' ? `Pending (${pendingCount})` : 'All Requests'}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
          onClick={() => void handleRefresh()}
          disabled={refreshing}
        >
          Refresh
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarDays className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">
            {filter === 'pending' ? 'No pending leave requests' : 'No leave requests found'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((request) => {
            const emp = employeeById.get(request.employeeId);
            const dept = emp?.department ?? 'Stores';
            const days = countWorkingLeaveDays(request.fromDate, request.toDate);
            const sc = statusConfig[request.status];

            return (
              <Card key={request.id}>
                <CardBody>
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <Avatar name={request.employeeName} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{request.employeeName}</p>
                          <Badge className={`${departmentColors[dept]} text-xs`}>{dept}</Badge>
                          <Badge className={`${sc.className} text-xs`}>{sc.label}</Badge>
                        </div>
                        <p className="text-sm text-gray-800 mt-1">
                          <span className="font-medium">{request.leaveType}</span>
                          {' · '}
                          {formatLeaveDateRange(request.fromDate, request.toDate)}
                          {' · '}
                          <span className="text-gray-500">{days} working day{days === 1 ? '' : 's'}</span>
                        </p>
                        <p className="text-xs text-gray-600 mt-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                          {request.reason}
                        </p>
                        {request.reviewedBy && (
                          <p className="text-[10px] text-gray-400 mt-2">
                            Reviewed by {request.reviewedBy}
                            {request.adminNotes ? ` — ${request.adminNotes}` : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    {request.status === 'pending' && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                          onClick={() => openReview(request, 'approve')}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<XCircle className="h-3.5 w-3.5" />}
                          onClick={() => openReview(request, 'reject')}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {reviewing && reviewAction && (
        <Modal
          isOpen
          onClose={closeReview}
          title={reviewAction === 'approve' ? 'Approve Leave' : 'Reject Leave'}
          subtitle={`${reviewing.employeeName} — ${reviewing.leaveType} (${formatLeaveDateRange(reviewing.fromDate, reviewing.toDate)})`}
          size="sm"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={closeReview} disabled={submitting}>Cancel</Button>
              <Button
                variant={reviewAction === 'approve' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => void submitReview()}
                disabled={submitting}
              >
                {reviewAction === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
              </Button>
            </div>
          }
        >
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-gray-400 mt-0.5" />
              <span>{reviewing.reason}</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Admin notes (optional)</label>
              <textarea
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 min-h-[72px]"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Optional note for the employee"
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
};
