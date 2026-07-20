import React, { useEffect, useState, useCallback } from 'react';
import { MapPin, LogIn, LogOut, Clock, Loader2, CheckCircle2, XCircle, Navigation } from 'lucide-react';
import { Card, CardBody } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { useStore } from '../store/useStore';
import type { PunchType } from '../types';
import {
  OFFICE_LOCATION,
  formatTimeIST,
  formatDateIST,
  formatDuration,
  getCurrentPosition,
  checkOfficeGeofence,
  summarizeTodayAttendance,
  getPendingOffsitePunchRequest,
  type GeoPosition,
} from '../lib/attendance';

type LocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; position: GeoPosition; distanceM: number; withinOffice: boolean }
  | { status: 'error'; message: string };

export const AttendanceSection: React.FC = () => {
  const attendanceRecords = useStore((s) => s.attendanceRecords);
  const attendanceApprovalRequests = useStore((s) => s.attendanceApprovalRequests);
  const currentUser = useStore((s) => s.currentUser);
  const punchAttendance = useStore((s) => s.punchAttendance);
  const submitOffsitePunchRequest = useStore((s) => s.submitOffsitePunchRequest);

  const summary = summarizeTodayAttendance(attendanceRecords, currentUser.id);
  const pendingOffsiteIn = getPendingOffsitePunchRequest(attendanceApprovalRequests, currentUser.id, 'in');
  const pendingOffsiteOut = getPendingOffsitePunchRequest(attendanceApprovalRequests, currentUser.id, 'out');

  const [now, setNow] = useState(new Date());
  const [confirmType, setConfirmType] = useState<PunchType | null>(null);
  const [locationState, setLocationState] = useState<LocationState>({ status: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [offsiteReason, setOffsiteReason] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const refreshLocation = useCallback(async () => {
    setLocationState({ status: 'loading' });
    try {
      const position = await getCurrentPosition();
      const geofence = checkOfficeGeofence(position.latitude, position.longitude, position.accuracyM);
      setLocationState({
        status: 'ready',
        position,
        distanceM: geofence.distanceM,
        withinOffice: geofence.withinOffice,
      });
    } catch (err) {
      setLocationState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to get location.',
      });
    }
  }, []);

  const openConfirm = (type: PunchType) => {
    setConfirmType(type);
    setSubmitError(null);
    setOffsiteReason('');
    setLocationState({ status: 'idle' });
    void refreshLocation();
  };

  const closeConfirm = () => {
    if (submitting) return;
    setConfirmType(null);
    setSubmitError(null);
    setOffsiteReason('');
    setLocationState({ status: 'idle' });
  };

  const isOffsitePunch =
    confirmType !== null &&
    locationState.status === 'ready' &&
    !locationState.withinOffice;

  const handleConfirm = async () => {
    if (!confirmType) return;

    setSubmitting(true);
    setSubmitError(null);

    let position: GeoPosition;
    try {
      position =
        locationState.status === 'ready'
          ? locationState.position
          : await getCurrentPosition();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Location required to punch.');
      setSubmitting(false);
      return;
    }

    const geofence = checkOfficeGeofence(position.latitude, position.longitude, position.accuracyM);
    setLocationState({
      status: 'ready',
      position,
      distanceM: geofence.distanceM,
      withinOffice: geofence.withinOffice,
    });

    if (!geofence.withinOffice) {
      const result = await submitOffsitePunchRequest(confirmType, offsiteReason, position);
      setSubmitting(false);
      if (result.error) {
        setSubmitError(result.error);
        return;
      }
      closeConfirm();
      return;
    }

    const result = await punchAttendance(confirmType, position);
    setSubmitting(false);

    if (result.error) {
      setSubmitError(result.error);
      return;
    }

    closeConfirm();
  };

  const punchLabel = confirmType === 'in' ? 'Punch In' : 'Punch Out';
  const canSubmitOffsite = offsiteReason.trim().length >= 10;

  return (
    <>
      <Card className="mb-6 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-4 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-indigo-100 text-xs font-medium uppercase tracking-wide">Attendance</p>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight mt-0.5">
                {formatTimeIST(now)}
              </p>
              <p className="text-indigo-100 text-xs mt-1">{formatDateIST(now)}</p>
            </div>
            <div className="flex flex-col gap-1.5 self-start">
              <Badge
                className={
                  summary.isPunchedIn
                    ? 'bg-emerald-500/20 text-emerald-100 border-emerald-400/30'
                    : 'bg-white/10 text-white border-white/20'
                }
              >
                {summary.isPunchedIn ? '● Punched In' : '○ Not Punched In'}
              </Badge>
              {(pendingOffsiteIn || pendingOffsiteOut) && (
                <Badge className="bg-amber-500/20 text-amber-100 border-amber-400/30 text-[10px]">
                  {pendingOffsiteIn && pendingOffsiteOut
                    ? 'Punch in/out pending approval'
                    : pendingOffsiteIn
                      ? 'Punch in pending approval'
                      : 'Punch out pending approval'}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <CardBody className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Punch In</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums mt-1">
                {summary.punchIn ? formatTimeIST(summary.punchIn.punchedAt) : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Punch Out</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums mt-1">
                {summary.punchOut ? formatTimeIST(summary.punchOut.punchedAt) : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Hours Today</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums mt-1">
                {formatDuration(summary.workedMs)}
              </p>
            </div>
          </div>

          {pendingOffsiteIn && (
            <div className="flex items-start gap-2 text-xs text-amber-800 mb-4 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Your off-site punch in at {formatTimeIST(pendingOffsiteIn.requestedAt)} is awaiting admin approval.
                Reason: <span className="font-medium">{pendingOffsiteIn.reason}</span>
              </span>
            </div>
          )}

          {pendingOffsiteOut && (
            <div className="flex items-start gap-2 text-xs text-amber-800 mb-4 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Your off-site punch out at {formatTimeIST(pendingOffsiteOut.requestedAt)} is awaiting admin approval.
                Reason: <span className="font-medium">{pendingOffsiteOut.reason}</span>
              </span>
            </div>
          )}

          <div className="flex items-start gap-2 text-xs text-gray-500 mb-4 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
            <span>
              Office: <span className="font-medium text-gray-700">{OFFICE_LOCATION.address}</span>
              {' '}· At office: punch directly · Off-site: reason + admin approval (same rule for in and out)
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              icon={<LogIn className="h-4 w-4" />}
              onClick={() => openConfirm('in')}
              disabled={summary.isPunchedIn || !!pendingOffsiteIn}
            >
              Punch In
            </Button>
            <Button
              variant="outline"
              size="md"
              className="flex-1"
              icon={<LogOut className="h-4 w-4" />}
              onClick={() => openConfirm('out')}
              disabled={!summary.isPunchedIn || !!pendingOffsiteOut}
            >
              Punch Out
            </Button>
          </div>
        </CardBody>
      </Card>

      <Modal
        isOpen={confirmType !== null}
        onClose={closeConfirm}
        title={isOffsitePunch ? `Off-site ${punchLabel}` : 'Are you sure?'}
        subtitle={
          isOffsitePunch
            ? 'Submit a reason for admin approval'
            : `Confirm ${punchLabel} for today`
        }
        size="md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={closeConfirm} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleConfirm()}
              disabled={
                submitting ||
                locationState.status === 'loading' ||
                (isOffsitePunch && !canSubmitOffsite)
              }
              icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
            >
              {submitting
                ? 'Processing…'
                : isOffsitePunch
                  ? 'Submit for Approval'
                  : `Yes, ${punchLabel}`}
            </Button>
          </div>
        }
      >
        <div className="px-4 sm:px-6 py-4 space-y-4">
          <div className="rounded-xl border px-4 py-3 bg-amber-50 border-amber-100">
            <p className="text-sm font-semibold text-amber-900">
              {isOffsitePunch
                ? `You are outside the office. Admin approval is required to ${punchLabel.toLowerCase()}.`
                : `Are you sure you want to ${punchLabel.toLowerCase()}?`}
            </p>
            <p className="text-xs text-amber-700 mt-1 tabular-nums">
              Current time: {formatTimeIST(now)}
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-gray-900">Office Location</p>
                <p className="text-sm text-gray-600">{OFFICE_LOCATION.address}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Plus Code: {OFFICE_LOCATION.plusCode}</p>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                  <Navigation className="h-3.5 w-3.5" />
                  Your Location
                </p>
                <button
                  type="button"
                  onClick={() => void refreshLocation()}
                  disabled={locationState.status === 'loading'}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>

              {locationState.status === 'idle' || locationState.status === 'loading' ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Requesting location permission…
                </div>
              ) : locationState.status === 'error' ? (
                <div className="flex items-start gap-2 text-sm text-red-600">
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{locationState.message}</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    {locationState.withinOffice ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className={`text-sm font-medium ${locationState.withinOffice ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {locationState.withinOffice
                        ? `At office (${locationState.distanceM}m away)`
                        : `${locationState.distanceM}m from office — off-site`}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 tabular-nums">
                    GPS accuracy ±{Math.round(locationState.position.accuracyM)}m
                  </p>
                </div>
              )}
            </div>
          </div>

          {isOffsitePunch && (
            <div>
              <label htmlFor="offsite-reason" className="block text-xs font-semibold text-gray-900 mb-1.5">
                Reason for off-site {punchLabel.toLowerCase()}
              </label>
              <textarea
                id="offsite-reason"
                rows={3}
                value={offsiteReason}
                onChange={(e) => setOffsiteReason(e.target.value)}
                placeholder="e.g. Client visit, field work, medical emergency…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Minimum 10 characters. Your manager will review this request.
              </p>
            </div>
          )}

          {submitError && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
              {submitError}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
