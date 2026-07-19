import React, { useMemo, useState } from 'react';
import {
  CalendarDays, Loader2, Send, XCircle, Clock, CheckCircle2,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useStore } from '../store/useStore';
import type { LeaveRequest, LeaveType } from '../types';
import { LEAVE_TYPES, countWorkingLeaveDays, formatLeaveDateRange } from '../lib/leave';
import { getISTDateKey } from '../lib/attendance';

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white';
const labelClass = 'block text-xs font-medium text-gray-700 mb-1.5';

const statusBadge: Record<LeaveRequest['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const LeaveApplySection: React.FC = () => {
  const currentUser = useStore((s) => s.currentUser);
  const leaveRequests = useStore((s) => s.leaveRequests);
  const applyLeave = useStore((s) => s.applyLeave);
  const cancelLeave = useStore((s) => s.cancelLeave);

  const [leaveType, setLeaveType] = useState<LeaveType>('Casual');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const today = getISTDateKey();
  const myLeaves = useMemo(
    () =>
      leaveRequests
        .filter((lr) => lr.employeeId === currentUser.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8),
    [leaveRequests, currentUser.id],
  );

  const workingDays =
    fromDate && toDate && fromDate <= toDate
      ? countWorkingLeaveDays(fromDate, toDate)
      : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const result = await applyLeave(leaveType, fromDate, toDate || fromDate, reason);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess('Leave request submitted. Awaiting admin approval.');
      setFromDate('');
      setToDate('');
      setReason('');
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    setError(null);
    const result = await cancelLeave(id);
    if (result.error) setError(result.error);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-gray-900">Leave Management</h3>
          </div>
          <Button
            variant={showForm ? 'outline' : 'primary'}
            size="sm"
            onClick={() => {
              setShowForm((v) => !v);
              setError(null);
              setSuccess(null);
            }}
          >
            {showForm ? 'Close' : 'Apply Leave'}
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {showForm && (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Leave Type *</label>
                <select
                  className={inputClass}
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                >
                  {LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                {workingDays > 0 && (
                  <p className="text-xs text-indigo-700 bg-white border border-indigo-100 rounded-lg px-3 py-2 w-full">
                    {workingDays} working day{workingDays === 1 ? '' : 's'} (excl. Sundays)
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>From Date *</label>
                <input
                  type="date"
                  className={inputClass}
                  min={today}
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    if (!toDate || toDate < e.target.value) setToDate(e.target.value);
                  }}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>To Date *</label>
                <input
                  type="date"
                  className={inputClass}
                  min={fromDate || today}
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Reason *</label>
              <textarea
                className={`${inputClass} min-h-[80px] resize-y`}
                placeholder="Brief reason for leave (min 10 characters)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              disabled={submitting}
            >
              Submit Leave Request
            </Button>
          </form>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
        {success && <p className="text-xs text-emerald-700">{success}</p>}

        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">My Leave Requests</p>
          {myLeaves.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No leave requests yet</p>
          ) : (
            <div className="space-y-2">
              {myLeaves.map((lr) => (
                <div
                  key={lr.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-50 border border-gray-100 rounded-lg"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{lr.leaveType}</span>
                      <Badge className={`${statusBadge[lr.status]} text-xs capitalize`}>{lr.status}</Badge>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{formatLeaveDateRange(lr.fromDate, lr.toDate)}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{lr.reason}</p>
                  </div>
                  {lr.status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<XCircle className="h-3.5 w-3.5" />}
                      onClick={() => void handleCancel(lr.id)}
                    >
                      Cancel
                    </Button>
                  )}
                  {lr.status === 'approved' && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 hidden sm:block" />
                  )}
                  {lr.status === 'pending' && (
                    <Clock className="h-4 w-4 text-amber-500 shrink-0 hidden sm:block" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};
