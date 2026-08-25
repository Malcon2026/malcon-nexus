import React, { useMemo, useState } from 'react';
import {
  CalendarDays, Send, XCircle, Clock, CheckCircle2,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useStore } from '../store/useStore';
import type { LeaveRequest, LeaveType } from '../types';
import { countWorkingLeaveDays, formatCompOffWorkDate, formatLeaveDateRange, formatLeaveTypeBreakdown, groupLeaveSubmissions, LEAVE_TYPES, originalLeaveReason } from '../lib/leave';
import { getISTDateKey } from '../lib/attendance';
import { Te } from './BilingualText';

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
  const [compOffWorkDate, setCompOffWorkDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const today = getISTDateKey();
  const myLeaves = useMemo(
    () =>
      groupLeaveSubmissions(leaveRequests.filter((lr) => lr.employeeId === currentUser.id)).slice(0, 8),
    [leaveRequests, currentUser.id],
  );

  const effectiveToDate = toDate || fromDate;

  const workingDays =
    fromDate && effectiveToDate && fromDate <= effectiveToDate
      ? countWorkingLeaveDays(fromDate, effectiveToDate)
      : 0;

  const openForm = () => {
    setShowForm(true);
    setError(null);
    setSuccess(null);
    if (!fromDate) {
      setFromDate(today);
      setToDate(today);
    }
  };

  const validateClient = (): string | null => {
    if (!fromDate.trim()) return 'Please select From date.';
    if (!effectiveToDate.trim()) return 'Please select To date.';
    if (fromDate > effectiveToDate) return 'From date cannot be after To date.';
    if (reason.trim().length < 10) {
      return 'Please write a reason with at least 10 characters.';
    }
    if (leaveType === 'Comp Off' && !compOffWorkDate.trim()) {
      return 'Please select the work day for Comp Off.';
    }
    return null;
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    setSubmitting(true);
    try {
      const result = await applyLeave(
        leaveType,
        fromDate,
        effectiveToDate,
        reason,
        leaveType === 'Comp Off' ? compOffWorkDate : null,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(result.message ?? (leaveType === 'Comp Off'
        ? 'Comp Off sent. Waiting for admin.'
        : 'Leave sent. Waiting for admin.'));
      setFromDate('');
      setToDate('');
      setCompOffWorkDate('');
      setReason('');
      setShowForm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
      console.error('[leave] submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (ids: string[]) => {
    setError(null);
    for (const id of ids) {
      const result = await cancelLeave(id);
      if (result.error) {
        setError(result.error);
        return;
      }
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-indigo-600" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Leave</h3>
              <Te className="text-gray-500 mb-0">సెలవు</Te>
            </div>
          </div>
          <Button
            type="button"
            variant={showForm ? 'outline' : 'primary'}
            size="sm"
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                setError(null);
                setSuccess(null);
              } else {
                openForm();
              }
            }}
          >
            {showForm ? 'Close' : 'Apply Leave'}
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {showForm && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            className="space-y-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Leave Type *</label>
                <select
                  className={inputClass}
                  value={leaveType}
                  onChange={(e) => {
                    const next = e.target.value as LeaveType;
                    setLeaveType(next);
                    if (next !== 'Comp Off') setCompOffWorkDate('');
                  }}
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
                />
              </div>
              {leaveType === 'Comp Off' && (
                <div className="sm:col-span-2">
                  <label className={labelClass}>Work day (day you will work) *</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={compOffWorkDate}
                    onChange={(e) => setCompOffWorkDate(e.target.value)}
                  />
                  <p className="text-[11px] text-indigo-700/80 mt-1.5">
                    Pick the day you will work instead (often a Sunday).
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className={labelClass}>Reason *</label>
              <textarea
                className={`${inputClass} min-h-[80px] resize-y`}
                placeholder="Why do you need leave? (at least 10 letters)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minLength={10}
              />
              <p className="text-[11px] text-gray-500 mt-1">
                {reason.trim().length}/10 characters minimum
              </p>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting}
              icon={!submitting ? <Send className="h-3.5 w-3.5" /> : undefined}
              disabled={submitting}
            >
              Send to Admin
            </Button>
          </form>
        )}

        {error && (
          <p className="text-xs text-red-600 font-medium" role="alert">
            {error}
          </p>
        )}
        {success && (
          <div>
            <p className="text-xs text-emerald-700">{success}</p>
            <Te className="text-emerald-600/90 mb-0">Admin approval kosam wait chestunnaru.</Te>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">My leave</p>
          <Te className="text-gray-400 mb-2">Na leave</Te>
          {myLeaves.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-xs text-gray-400">No leave yet</p>
              <Te className="text-gray-400 mb-0">Inka leave ledu</Te>
            </div>
          ) : (
            <div className="space-y-2">
              {myLeaves.map((group) => (
                <div
                  key={group.key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-50 border border-gray-100 rounded-lg"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">
                        {group.segments.length === 1
                          ? group.segments[0].leaveType
                          : formatLeaveTypeBreakdown(group.segments)}
                      </span>
                      <Badge className={`${statusBadge[group.status]} text-xs capitalize`}>{group.status}</Badge>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{formatLeaveDateRange(group.fromDate, group.toDate)}</p>
                    {group.segments.length > 1 && (
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {group.segments
                          .map((s) => `${formatLeaveDateRange(s.fromDate, s.toDate)} ${s.leaveType}`)
                          .join(' · ')}
                      </p>
                    )}
                    {group.segments.some((s) => s.leaveType === 'Comp Off' && s.compOffWorkDate) && (
                      <p className="text-xs text-violet-700 mt-0.5">
                        Work day: {formatCompOffWorkDate(group.segments.find((s) => s.compOffWorkDate)?.compOffWorkDate)}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 truncate mt-0.5">{originalLeaveReason(group.reason)}</p>
                  </div>
                  {group.status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<XCircle className="h-3.5 w-3.5" />}
                      onClick={() => void handleCancel(group.pendingIds)}
                    >
                      Cancel
                    </Button>
                  )}
                  {group.status === 'approved' && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 hidden sm:block" />
                  )}
                  {group.status === 'pending' && (
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
