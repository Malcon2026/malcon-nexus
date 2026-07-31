import React, { useEffect, useState, useCallback } from 'react';
import {
  MapPin,
  LogIn,
  LogOut,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Navigation,
  AlertTriangle,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { useStore } from '../store/useStore';
import type { PunchType } from '../types';
import {
  OFFICE_LOCATION,
  formatTimeIST,
  formatDateIST,
  formatDateShortIST,
  formatDuration,
  getCurrentPosition,
  checkOfficeGeofence,
  summarizeLiveAttendance,
  getPendingOffsitePunchRequest,
  getPriorDayPendingOffsiteOut,
  getISTDateKey,
  type GeoPosition,
} from '../lib/attendance';
import { attendanceErrorTe } from '../lib/attendanceBilingual';
import { Bilingual, Te } from './BilingualText';

type LocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; position: GeoPosition; distanceM: number; withinOffice: boolean }
  | { status: 'error'; message: string };

export const EmployeeAttendanceHero: React.FC = () => {
  const attendanceRecords = useStore((s) => s.attendanceRecords);
  const attendanceApprovalRequests = useStore((s) => s.attendanceApprovalRequests);
  const currentUser = useStore((s) => s.currentUser);
  const punchAttendance = useStore((s) => s.punchAttendance);
  const punchOutWithReason = useStore((s) => s.punchOutWithReason);
  const submitOffsitePunchRequest = useStore((s) => s.submitOffsitePunchRequest);

  const summary = summarizeLiveAttendance(attendanceRecords, currentUser.id);
  const todayKey = getISTDateKey();
  const todayLabel = formatDateShortIST();
  const punchInFromPriorDay =
    summary.punchIn !== null && getISTDateKey(summary.punchIn.punchedAt) !== todayKey;
  const priorSessionDate = summary.punchIn ? formatDateShortIST(summary.punchIn.punchedAt) : '';
  const pendingOffsiteIn = getPendingOffsitePunchRequest(attendanceApprovalRequests, currentUser.id, 'in');
  const priorDayPendingOut = getPriorDayPendingOffsiteOut(attendanceApprovalRequests, currentUser.id);
  const priorDayOpenSession = punchInFromPriorDay && summary.isPunchedIn && !priorDayPendingOut;
  const loggedInToday = summary.isPunchedIn && !punchInFromPriorDay;
  const canPunchInDespiteOpenShift =
    summary.isPunchedIn && punchInFromPriorDay && !!priorDayPendingOut;
  const punchInDisabled = (!!pendingOffsiteIn) || (summary.isPunchedIn && !canPunchInDespiteOpenShift);
  const punchOutDisabled = !summary.isPunchedIn;

  const punchInActive = !punchInDisabled && !priorDayOpenSession;
  const punchOutActive = !punchOutDisabled;

  const [now, setNow] = useState(new Date());
  const [confirmType, setConfirmType] = useState<PunchType | null>(null);
  const [locationState, setLocationState] = useState<LocationState>({ status: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [offsiteReason, setOffsiteReason] = useState('');

  const firstName = currentUser.name.split(' ')[0];

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

    if (confirmType === 'out') {
      const result = await punchOutWithReason(offsiteReason, position);
      setSubmitting(false);
      if (result.error) {
        setSubmitError(result.error);
        return;
      }
      closeConfirm();
      return;
    }

    if (!geofence.withinOffice) {
      const result = await submitOffsitePunchRequest('in', offsiteReason, position);
      setSubmitting(false);
      if (result.error) {
        setSubmitError(result.error);
        return;
      }
      closeConfirm();
      return;
    }

    const result = await punchAttendance('in', position);
    setSubmitting(false);

    if (result.error) {
      setSubmitError(result.error);
      return;
    }

    closeConfirm();
  };

  const closingPriorSession = confirmType === 'out' && priorDayOpenSession;
  const needsReason = confirmType === 'out' || (confirmType === 'in' && isOffsitePunch);
  const reasonValid = offsiteReason.trim().length >= 10;

  const statusTone = priorDayOpenSession
    ? 'warn'
    : loggedInToday
      ? 'in'
      : pendingOffsiteIn
        ? 'pending'
        : 'out';

  return (
    <>
      <section className="attendance-hero mb-8" aria-label="Attendance">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Welcome, {firstName}
            </h1>
            <Te className="text-gray-500 mt-0.5">స్వాగతం, {firstName}</Te>
            <p className="text-sm text-gray-500 mt-1">{currentUser.department}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-bold text-gray-900 tabular-nums tracking-tight">
              {formatTimeIST(now)}
            </p>
            <p className="text-xs text-gray-500">{formatDateIST(now)}</p>
          </div>
        </div>

        <div
          className={`attendance-status-panel attendance-status-${statusTone} rounded-2xl border px-4 py-4 sm:px-5 sm:py-5 mb-5`}
        >
          {priorDayOpenSession && summary.punchIn ? (
            <div className="flex items-start gap-3">
              <div className="attendance-status-ring warn shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <Bilingual
                  enClassName="text-base sm:text-lg font-bold text-amber-800"
                  teClassName="text-amber-700/90"
                  en="Previous session still open"
                  te="మునుపటి session ఇంకా open గా ఉంది"
                />
                <p className="text-sm text-amber-700">
                  You did not punch out on <span className="font-semibold">{priorSessionDate}</span>.
                  Logged in since{' '}
                  <span className="font-semibold tabular-nums">{formatTimeIST(summary.punchIn.punchedAt)}</span>.
                  This is <span className="font-semibold">not</span> today&apos;s login.
                </p>
                <Te className="text-amber-700/90">
                  మీరు {priorSessionDate} న punch out చేయలేదు. {formatTimeIST(summary.punchIn.punchedAt)} నుండి login ఉంది — ఈ రోజు login కాదు.
                </Te>
                <Te className="text-amber-700/90 pt-0.5">
                  ○ {todayLabel} న login కాలేదు · ముందు Close Session / Punch Out చేయండి.
                </Te>
              </div>
            </div>
          ) : loggedInToday && summary.punchIn ? (
            <div className="flex items-start gap-3">
              <div className="attendance-status-ring in shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <Bilingual
                  enClassName="text-base sm:text-lg font-bold text-emerald-800"
                  teClassName="text-emerald-700/90"
                  en={`You are logged in for ${todayLabel}`}
                  te={`మీరు ${todayLabel} న login అయ్యారు`}
                />
                <p className="text-sm text-emerald-700 mt-0.5">
                  Since{' '}
                  <span className="font-semibold tabular-nums">{formatTimeIST(summary.punchIn.punchedAt)}</span>
                  {' · '}
                  {summary.punchIn.withinOffice ? 'At office' : 'Off-site (approved)'}
                </p>
                <Te className="text-emerald-700/90">
                  {formatTimeIST(summary.punchIn.punchedAt)} నుండి ·{' '}
                  {summary.punchIn.withinOffice ? 'Office లో' : 'Off-site (approval అయింది)'}
                </Te>
              </div>
            </div>
          ) : pendingOffsiteIn ? (
            <div className="flex items-start gap-3">
              <div className="attendance-status-ring pending shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <Bilingual
                  enClassName="text-base sm:text-lg font-bold text-amber-800"
                  teClassName="text-amber-700/90"
                  en="Punch-in pending approval"
                  te="Punch in admin approval కోసం వేచి ఉంది"
                />
                <Bilingual
                  enClassName="text-sm text-amber-700 mt-0.5"
                  teClassName="text-amber-700/90"
                  en={`You are not logged in for ${todayLabel} until admin approves.`}
                  te={`Admin approve చేసే varaku ${todayLabel} న login avvadu.`}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="attendance-status-ring out shrink-0" />
              <div>
                <Bilingual
                  enClassName="text-base sm:text-lg font-bold text-gray-900"
                  teClassName="text-gray-500"
                  en={`You are not logged in for ${todayLabel}`}
                  te={`మీరు ${todayLabel} న login కాలేదు`}
                />
                <Bilingual
                  enClassName="text-sm text-gray-500 mt-0.5"
                  teClassName="text-gray-500"
                  en="Tap Punch In to start your day."
                  te="మీ రోజు ప్రారంభించడానికి Punch In నొక్కండి."
                />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
          <button
            type="button"
            className={`attendance-punch-tile attendance-punch-in ${punchInActive ? 'attendance-punch-active-in' : ''}`}
            onClick={() => openConfirm('in')}
            disabled={punchInDisabled}
            title={priorDayOpenSession ? 'Close your previous session first' : undefined}
          >
            <span className="attendance-punch-icon">
              <LogIn className="h-7 w-7" strokeWidth={2.25} />
            </span>
            <span className="attendance-punch-label">Punch In</span>
            <span className="attendance-punch-hint block">
              {punchInDisabled && priorDayOpenSession
                ? 'Close previous session first'
                : punchInActive
                  ? 'Tap to start · GPS required'
                  : 'Unavailable'}
            </span>
            <span className="attendance-punch-hint-te">
              {punchInDisabled && priorDayOpenSession
                ? 'ముందు session close cheyandi'
                : punchInActive
                  ? 'GPS అవసరం · ప్రారంభించండి'
                  : 'అందుబాటులో లేదు'}
            </span>
          </button>

          <button
            type="button"
            className={`attendance-punch-tile attendance-punch-out ${
              punchOutActive
                ? priorDayOpenSession
                  ? 'attendance-punch-active-warn'
                  : 'attendance-punch-active-out'
                : ''
            }`}
            onClick={() => openConfirm('out')}
            disabled={punchOutDisabled}
          >
            <span className="attendance-punch-icon">
              <LogOut className="h-7 w-7" strokeWidth={2.25} />
            </span>
            <span className="attendance-punch-label">
              {priorDayOpenSession ? 'Close Session' : 'Punch Out'}
            </span>
            <span className="attendance-punch-hint block">
              {punchOutActive
                ? priorDayOpenSession
                  ? 'Reason required · close yesterday'
                  : 'Reason required · GPS required'
                : 'Unavailable'}
            </span>
            <span className="attendance-punch-hint-te">
              {punchOutActive
                ? priorDayOpenSession
                  ? 'కారణం అవసరం · నిన్న close cheyandi'
                  : 'కారణం + GPS అవసరం'
                : 'అందుబాటులో లేదు'}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          {[
            {
              label: priorDayOpenSession ? 'Session In' : 'Punch In',
              labelTe: priorDayOpenSession ? 'Session In' : 'పంచ్ ఇన్',
              value: summary.punchIn ? formatTimeIST(summary.punchIn.punchedAt) : '—',
              sub: priorDayOpenSession && summary.punchIn ? priorSessionDate : undefined,
            },
            {
              label: 'Punch Out',
              labelTe: 'పంచ్ అవుట్',
              value: summary.punchOut ? formatTimeIST(summary.punchOut.punchedAt) : '—',
            },
            {
              label: priorDayOpenSession ? 'Open Since' : 'Hours Today',
              labelTe: priorDayOpenSession ? 'ఎప్పటి నుండి' : 'ఈ రోజు గంటలు',
              value:
                priorDayOpenSession && summary.punchIn
                  ? priorSessionDate
                  : formatDuration(summary.workedMs),
            },
          ].map(({ label, labelTe, value, sub }) => (
            <div
              key={label}
              className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-center"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
              <p className="text-[9px] text-gray-400 leading-tight">{labelTe}</p>
              <p className="text-sm sm:text-base font-bold text-gray-900 tabular-nums mt-0.5 truncate">{value}</p>
              {sub && <p className="text-[10px] text-amber-700 font-medium">{sub}</p>}
            </div>
          ))}
        </div>

        {pendingOffsiteIn && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            <p>
              Off-site punch in at {formatTimeIST(pendingOffsiteIn.requestedAt)} awaiting approval ·{' '}
              {pendingOffsiteIn.reason}
            </p>
            <Te className="text-amber-700/90 mb-0">
              Off-site punch in {formatTimeIST(pendingOffsiteIn.requestedAt)} admin approval కోసం wait చేస్తోంది.
            </Te>
          </div>
        )}

        <div className="text-[11px] text-gray-500 flex items-start gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-indigo-500" />
          <div>
            <p>
              {OFFICE_LOCATION.address} · GPS mandatory · Punch-in off-site needs approval · Punch-out needs reason only (no approval)
            </p>
            <Te className="text-gray-500 mb-0">
              GPS తప్పనిసరి · Off-site punch-in ki admin approval · Punch-out ki reason matrame (approval avasaram ledu)
            </Te>
          </div>
        </div>
      </section>

      <Modal
        isOpen={confirmType !== null}
        onClose={closeConfirm}
        title={
          closingPriorSession
            ? 'Close previous session?'
            : confirmType === 'out'
              ? 'Punch Out'
              : isOffsitePunch
                ? 'Off-site Punch In'
                : 'Punch In'
        }
        subtitle={
          closingPriorSession
            ? `This closes your open session from ${priorSessionDate}`
            : confirmType === 'out'
              ? 'Reason required · saved immediately · no approval'
              : isOffsitePunch
                ? 'Submit a reason for admin approval'
                : 'Confirm punch in for today'
        }
        size="md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={closeConfirm} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant={closingPriorSession ? 'warning' : 'primary'}
              onClick={() => void handleConfirm()}
              disabled={
                submitting ||
                locationState.status === 'loading' ||
                (needsReason && !reasonValid)
              }
              icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
            >
              {submitting
                ? 'Processing…'
                : closingPriorSession
                  ? 'Yes, Close Session'
                  : confirmType === 'out'
                    ? 'Yes, Punch Out'
                    : isOffsitePunch
                      ? 'Submit for Approval'
                      : 'Yes, Punch In'}
            </Button>
          </div>
        }
      >
        <div className="px-4 sm:px-6 py-4 space-y-4">
          <div className="rounded-xl border px-4 py-3 bg-amber-50 border-amber-200">
            <p className="text-sm font-semibold text-amber-900">
              {closingPriorSession
                ? `Closing session from ${priorSessionDate}. You can punch in for ${todayLabel} after this.`
                : confirmType === 'out'
                  ? locationState.status === 'ready' && locationState.withinOffice
                    ? 'At office — enter a reason and punch out (no approval needed).'
                    : 'Enter a reason and punch out — works at office or off-site, no approval needed.'
                  : isOffsitePunch
                    ? 'Outside office — admin approval required to punch in.'
                    : 'Confirm punch in at office?'}
            </p>
            <Te className="text-amber-800/90">
              {closingPriorSession
                ? `${priorSessionDate} session close avutundi. Tarvata ${todayLabel} ki punch in cheyochu.`
                : confirmType === 'out'
                  ? 'కారణం రాసి punch out cheyandi — office/off-site rendu, approval avasaram ledu.'
                  : isOffsitePunch
                    ? 'Office bayata unnaru — punch in ki admin approval avasaram.'
                    : 'Office lo punch in confirm cheyala?'}
            </Te>
            <p className="text-xs text-amber-700 mt-1 tabular-nums">Current time: {formatTimeIST(now)}</p>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-gray-900">Office</p>
                <p className="text-sm text-gray-600">{OFFICE_LOCATION.address}</p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                  <Navigation className="h-3.5 w-3.5" />
                  Your location (GPS)
                </p>
                <button
                  type="button"
                  onClick={() => void refreshLocation()}
                  disabled={locationState.status === 'loading'}
                  className="text-xs text-indigo-500 hover:text-indigo-400 font-medium disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>

              {locationState.status === 'idle' || locationState.status === 'loading' ? (
                <div className="text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Getting GPS…
                  </div>
                  <Te className="text-gray-500 mb-0">GPS teesukuntunnamu…</Te>
                </div>
              ) : locationState.status === 'error' ? (
                <div className="text-sm text-red-700">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{locationState.message}</span>
                  </div>
                  {attendanceErrorTe(locationState.message) && (
                    <Te className="text-red-700/90 mb-0">{attendanceErrorTe(locationState.message)}</Te>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className={`text-sm font-medium ${locationState.withinOffice ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {locationState.withinOffice
                      ? `At office (${locationState.distanceM}m)`
                      : `Off-site (${locationState.distanceM}m from office)`}
                  </p>
                  <Te className={`mb-0 ${locationState.withinOffice ? 'text-emerald-700/90' : 'text-amber-700/90'}`}>
                    {locationState.withinOffice
                      ? `Office lo unnaru (${locationState.distanceM}m)`
                      : `Office nunchi ${locationState.distanceM}m dooram — off-site`}
                  </Te>
                  <p className="text-[11px] text-gray-400 tabular-nums">
                    Accuracy ±{Math.round(locationState.position.accuracyM)}m
                  </p>
                </div>
              )}
            </div>
          </div>

          {needsReason && (
            <div>
              <label htmlFor="punch-reason" className="block text-xs font-semibold text-gray-900 mb-1.5">
                {confirmType === 'out' ? 'Reason for punch out' : 'Reason for off-site punch-in'}
              </label>
              <Te className="text-gray-500 mb-2">
                {confirmType === 'out' ? 'Punch out కారణం' : 'Off-site punch in కారణం'}
              </Te>
              <textarea
                id="punch-reason"
                rows={3}
                value={offsiteReason}
                onChange={(e) => setOffsiteReason(e.target.value)}
                placeholder={
                  confirmType === 'out'
                    ? 'e.g. End of shift, client visit complete, leaving early…'
                    : 'e.g. Client visit, field delivery…'
                }
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                {confirmType === 'out'
                  ? 'Min 10 characters · Saved immediately · No admin approval'
                  : 'Min 10 characters · Admin must approve punch-in'}
              </p>
              <Te className="text-gray-400 mb-0">
                {confirmType === 'out'
                  ? 'కనీసం 10 అక్షరాలు · వెంటనే save · approval avasaram ledu'
                  : 'కనీసం 10 అక్షరాలు · admin approve avasaram'}
              </Te>
            </div>
          )}

          {submitError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <p>{submitError}</p>
              {attendanceErrorTe(submitError) && (
                <Te className="text-red-700/90 mb-0">{attendanceErrorTe(submitError)}</Te>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
