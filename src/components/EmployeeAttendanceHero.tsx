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
import { formatAttendanceError } from '../lib/attendanceBilingual';
import { Bilingual, Te } from './BilingualText';
import {
  AttendanceSelfieCapture,
  type CapturedSelfie,
} from './AttendanceSelfieCapture';

type LocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; position: GeoPosition; distanceM: number; withinOffice: boolean }
  | { status: 'error'; message: string; messageTe?: string | null };

export const EmployeeAttendanceHero: React.FC = () => {
  const attendanceRecords = useStore((s) => s.attendanceRecords);
  const attendanceApprovalRequests = useStore((s) => s.attendanceApprovalRequests);
  const currentUser = useStore((s) => s.currentUser);
  const punchAttendance = useStore((s) => s.punchAttendance);
  const punchOut = useStore((s) => s.punchOut);
  const submitOffsitePunchRequest = useStore((s) => s.submitOffsitePunchRequest);

  const summary = summarizeLiveAttendance(attendanceRecords, currentUser.id);
  const todayKey = getISTDateKey();
  const todayLabel = formatDateShortIST();
  const punchInFromPriorDay =
    summary.punchIn !== null && getISTDateKey(summary.punchIn.punchedAt) !== todayKey;
  const priorSessionDate = summary.punchIn ? formatDateShortIST(summary.punchIn.punchedAt) : '';
  const unclosedShiftDate =
    summary.unclosedShiftFromDateKey
      ? formatDateShortIST(`${summary.unclosedShiftFromDateKey}T12:00:00+05:30`)
      : priorSessionDate;
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
  const [submitError, setSubmitError] = useState<{ en: string; te: string | null } | null>(null);
  const [offsiteReason, setOffsiteReason] = useState('');
  const [punchInSelfie, setPunchInSelfie] = useState<CapturedSelfie | null>(null);

  const firstName = currentUser.name.split(' ')[0];

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const setErrorFromMessage = (message: string) => {
    setSubmitError(formatAttendanceError(message));
  };

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
      const raw = err instanceof Error ? err.message : 'Failed to get location.';
      const { en, te } = formatAttendanceError(raw);
      setLocationState({ status: 'error', message: en, messageTe: te });
    }
  }, []);

  const openConfirm = (type: PunchType) => {
    setConfirmType(type);
    setSubmitError(null);
    setOffsiteReason('');
    setPunchInSelfie(null);
    setLocationState({ status: 'idle' });
    if (type === 'in') {
      void refreshLocation();
    }
  };

  const closeConfirm = () => {
    if (submitting) return;
    setConfirmType(null);
    setSubmitError(null);
    setOffsiteReason('');
    setPunchInSelfie(null);
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

    if (confirmType === 'out') {
      const result = await punchOut();
      setSubmitting(false);
      if (result.error) {
        setErrorFromMessage(result.error);
        return;
      }
      closeConfirm();
      return;
    }

    let position: GeoPosition;
    try {
      position =
        locationState.status === 'ready'
          ? locationState.position
          : await getCurrentPosition();
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Location required to punch.';
      setErrorFromMessage(raw);
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
      if (!punchInSelfie) {
        setErrorFromMessage('Please take a selfie before submitting.');
        setSubmitting(false);
        return;
      }
      const result = await submitOffsitePunchRequest('in', offsiteReason, position, punchInSelfie.file);
      setSubmitting(false);
      if (result.error) {
        setErrorFromMessage(result.error);
        return;
      }
      closeConfirm();
      return;
    }

    if (!punchInSelfie) {
      setErrorFromMessage('Please take a selfie before punch in.');
      setSubmitting(false);
      return;
    }

    const result = await punchAttendance('in', position, punchInSelfie.file);
    setSubmitting(false);

    if (result.error) {
      setErrorFromMessage(result.error);
      return;
    }

    closeConfirm();
  };

  const closingPriorSession = confirmType === 'out' && priorDayOpenSession;
  const needsSelfie = confirmType === 'in';
  const needsReason = confirmType === 'in' && isOffsitePunch;
  const reasonValid = offsiteReason.trim().length >= 10;
  const selfieValid = !!punchInSelfie;

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
              Hi, {firstName}
            </h1>
            <Te className="text-gray-500 mt-0.5">హాయ్, {firstName}</Te>
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
                  en={`Unclosed shift from ${unclosedShiftDate}`}
                  te={`${unclosedShiftDate} shift close cheyyaledu`}
                />
                <p className="text-sm text-amber-700">
                  Still IN from {priorSessionDate} at {formatTimeIST(summary.punchIn.punchedAt)}.
                  This is <strong>not</strong> a punch-in for today ({todayLabel}).
                </p>
                <Te className="text-amber-700/90">
                  {priorSessionDate} nunchi IN · {formatTimeIST(summary.punchIn.punchedAt)} — eeroju ({todayLabel}) kaadu.
                </Te>
                <Bilingual
                  enClassName="text-sm text-amber-800 font-medium"
                  teClassName="text-amber-700/90 pt-0.5"
                  en={`Punch Out that day first. Then Punch In for today (${todayLabel}).`}
                  te={`Mundu aa roju Punch Out cheyandi. Taruvata ${todayLabel} ki Punch In.`}
                />
              </div>
            </div>
          ) : punchInFromPriorDay && summary.isPunchedIn && priorDayPendingOut && summary.punchIn ? (
            <div className="flex items-start gap-3">
              <div className="attendance-status-ring warn shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <Bilingual
                  enClassName="text-base sm:text-lg font-bold text-amber-800"
                  teClassName="text-amber-700/90"
                  en={`Unclosed shift from ${unclosedShiftDate}`}
                  te={`${unclosedShiftDate} shift close cheyyaledu`}
                />
                <Bilingual
                  enClassName="text-sm text-amber-700 mt-0.5"
                  teClassName="text-amber-700/90"
                  en={`You are OUT for ${todayLabel} until you close ${priorSessionDate}.`}
                  te={`${priorSessionDate} close cheyakunda ${todayLabel} n IN avvadu.`}
                />
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
                  en={`You are IN for today (${todayLabel})`}
                  te={`మీరు ${todayLabel} న IN అయ్యారు`}
                />
                <p className="text-sm text-emerald-700 mt-0.5">
                  Since {formatTimeIST(summary.punchIn.punchedAt)}
                  {' · '}
                  {summary.punchIn.withinOffice ? 'At office' : 'Out of office (approved)'}
                </p>
                <Te className="text-emerald-700/90">
                  {formatTimeIST(summary.punchIn.punchedAt)} నుండి ·{' '}
                  {summary.punchIn.withinOffice ? 'Office లో' : 'Office బయట (admin approve అయింది)'}
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
                  en="Punch In waiting for admin"
                  te="Punch In admin approval కోసం వేచి ఉంది"
                />
                <Bilingual
                  enClassName="text-sm text-amber-700 mt-0.5"
                  teClassName="text-amber-700/90"
                  en={`You are not IN for ${todayLabel} until admin approves.`}
                  te={`Admin approve చేసే varaku ${todayLabel} న IN avvadu.`}
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
                  en={`You are OUT for today (${todayLabel})`}
                  te={`మీరు ${todayLabel} న OUT`}
                />
                <Bilingual
                  enClassName="text-sm text-gray-500 mt-0.5"
                  teClassName="text-gray-500"
                  en="Tap Punch In to start work."
                  te="పని ప్రారంభించడానికి Punch In నొక్కండి."
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
            title={priorDayOpenSession ? 'Punch Out yesterday first' : undefined}
          >
            <span className="attendance-punch-icon">
              <LogIn className="h-7 w-7" strokeWidth={2.25} />
            </span>
            <span className="attendance-punch-label">Punch In</span>
            <span className="attendance-punch-hint block">
              {punchInDisabled && priorDayOpenSession
                ? 'Punch Out yesterday first'
                : punchInActive
                  ? 'Tap here · GPS + selfie'
                  : 'Not available'}
            </span>
            <span className="attendance-punch-hint-te">
              {punchInDisabled && priorDayOpenSession
                ? 'ముందు Punch Out cheyandi'
                : punchInActive
                  ? 'GPS + selfie · ikkada tap cheyandi'
                  : 'available ledu'}
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
              {priorDayOpenSession || (punchInFromPriorDay && summary.isPunchedIn)
                ? `Punch Out (${unclosedShiftDate})`
                : 'Punch Out'}
            </span>
            <span className="attendance-punch-hint block">
              {punchOutActive ? 'Tap here to finish' : 'Not available'}
            </span>
            <span className="attendance-punch-hint-te">
              {punchOutActive ? 'Ikkada tap cheyandi' : 'available ledu'}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          {[
            {
              label: punchInFromPriorDay ? 'In (old day)' : 'In time',
              labelTe: punchInFromPriorDay ? 'In (pati roju)' : 'In time',
              value: summary.punchIn ? formatTimeIST(summary.punchIn.punchedAt) : '—',
              sub: punchInFromPriorDay && summary.punchIn ? priorSessionDate : undefined,
            },
            {
              label: 'Out time',
              labelTe: 'Out time',
              value: summary.punchOut ? formatTimeIST(summary.punchOut.punchedAt) : '—',
            },
            {
              label: punchInFromPriorDay ? 'Since date' : 'Hours today',
              labelTe: punchInFromPriorDay ? 'Date nunchi' : 'Hours today',
              value:
                punchInFromPriorDay && summary.punchIn
                  ? priorSessionDate
                  : formatDuration(summary.workedMs),
            },
          ].map(({ label, labelTe, value, sub }) => (
            <div
              key={label}
              className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-center"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
              <p className="text-[9px] text-gray-400">{labelTe}</p>
              <p className="text-sm sm:text-base font-bold text-gray-900 tabular-nums mt-0.5 truncate">{value}</p>
              {sub && <p className="text-[10px] text-amber-700 font-medium">{sub}</p>}
            </div>
          ))}
        </div>

        {pendingOffsiteIn && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            <p>
              Punch In sent at {formatTimeIST(pendingOffsiteIn.requestedAt)} — waiting for admin.
              Reason: {pendingOffsiteIn.reason}
            </p>
            <Te className="text-amber-700/90 mb-0">
              {formatTimeIST(pendingOffsiteIn.requestedAt)} న పంపారు — admin approval wait.
            </Te>
          </div>
        )}

        <div className="text-[11px] text-gray-500 flex items-start gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-indigo-500" />
          <div>
            <p>
              {OFFICE_LOCATION.address} · Punch In needs GPS + selfie · Out of office = reason + admin OK
            </p>
            <Te className="text-gray-400 mb-0">
              Punch In ki GPS + selfie avasaram · Office bayata reason + admin OK · Punch Out simple ga
            </Te>
          </div>
        </div>
      </section>

      <Modal
        isOpen={confirmType !== null}
        onClose={closeConfirm}
        title={
          closingPriorSession
            ? 'Punch Out yesterday?'
            : confirmType === 'out'
              ? 'Punch Out'
              : isOffsitePunch
                ? 'Punch In (out of office)'
                : 'Punch In'
        }
        subtitle={
          closingPriorSession
            ? `This closes ${priorSessionDate}. Then you can Punch In for today.`
            : confirmType === 'out'
              ? 'Tap Yes to finish your day.'
              : isOffsitePunch
                ? 'Write reason + selfie. Admin must approve.'
                : 'Take selfie + GPS. OK to Punch In?'
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
                (confirmType === 'in' && locationState.status === 'loading') ||
                (needsReason && !reasonValid) ||
                (needsSelfie && !selfieValid)
              }
              icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
            >
              {submitting
                ? 'Please wait…'
                : closingPriorSession
                  ? 'Yes, Punch Out'
                  : confirmType === 'out'
                    ? 'Yes, Punch Out'
                    : isOffsitePunch
                      ? 'Send to admin'
                      : 'Yes, Punch In'}
            </Button>
          </div>
        }
      >
        <div className="px-4 sm:px-6 py-4 space-y-4">
          <div className="rounded-xl border px-4 py-3 bg-amber-50 border-amber-200">
            <p className="text-sm font-semibold text-amber-900">
              {closingPriorSession
                ? `Close ${priorSessionDate}. After that, Punch In for ${todayLabel}.`
                : confirmType === 'out'
                  ? 'Ready to Punch Out? Tap Yes.'
                  : isOffsitePunch
                    ? 'You are out of office. Selfie + reason sent to admin.'
                    : 'You are at office. Selfie required to Punch In.'}
            </p>
            {closingPriorSession ? (
              <Te className="text-amber-800/90">
                {priorSessionDate} close cheyandi. Taruvata {todayLabel} ki Punch In.
              </Te>
            ) : confirmType === 'out' ? (
              <Te className="text-amber-800/90">Punch Out cheyadaniki Yes ani press cheyandi.</Te>
            ) : isOffsitePunch ? (
              <Te className="text-amber-800/90">Office bayata unnaru. Selfie + reason admin ki pothundi.</Te>
            ) : (
              <Te className="text-amber-800/90">Office lo unnaru. Selfie teesukoni Punch In cheyandi.</Te>
            )}
            <p className="text-xs text-amber-700 mt-1 tabular-nums">Time now: {formatTimeIST(now)}</p>
          </div>

          {confirmType === 'in' && (
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
                  Your GPS
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
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Getting GPS…
                </div>
              ) : locationState.status === 'error' ? (
                <div className="flex items-start gap-2 text-sm text-red-700">
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span>{locationState.message}</span>
                    {locationState.messageTe && (
                      <Te className="text-red-600/90 mb-0">{locationState.messageTe}</Te>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className={`text-sm font-medium ${locationState.withinOffice ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {locationState.withinOffice
                      ? `At office (${locationState.distanceM}m away)`
                      : `Out of office (${locationState.distanceM}m away)`}
                  </p>
                  <Te className={locationState.withinOffice ? 'text-emerald-600/90 mb-0' : 'text-amber-600/90 mb-0'}>
                    {locationState.withinOffice
                      ? `Office lo (${locationState.distanceM}m dooram)`
                      : `Office bayata (${locationState.distanceM}m dooram)`}
                  </Te>
                  <p className="text-[11px] text-gray-400 tabular-nums">
                    GPS accuracy ±{Math.round(locationState.position.accuracyM)}m
                  </p>
                </div>
              )}
            </div>
          </div>
          )}

          {needsSelfie && (
            <AttendanceSelfieCapture
              selfie={punchInSelfie}
              onSelfieChange={setPunchInSelfie}
              employeeName={currentUser.name}
              employeeId={currentUser.id}
              disabled={submitting}
            />
          )}

          {needsReason && (
            <div>
              <label htmlFor="punch-reason" className="block text-xs font-semibold text-gray-900 mb-1.5">
                Why are you out of office?
              </label>
              <Te className="text-gray-500 mb-1.5">Office bayata enduku unnaru?</Te>
              <textarea
                id="punch-reason"
                rows={3}
                value={offsiteReason}
                onChange={(e) => setOffsiteReason(e.target.value)}
                placeholder="Example: Client visit, delivery trip…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">At least 10 letters · Admin must approve</p>
              <Te className="text-gray-400 mb-0">10 letters minimum · admin approve cheyali</Te>
            </div>
          )}

          {submitError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <p>{submitError.en}</p>
              {submitError.te && <Te className="text-red-600/90 mb-0">{submitError.te}</Te>}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
