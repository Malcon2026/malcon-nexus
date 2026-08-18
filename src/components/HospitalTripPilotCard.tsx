import React, { useMemo, useState } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { Card, CardBody } from './ui/Card';
import { Button } from './ui/Button';
import { useStore } from '../store/useStore';
import { getCurrentPosition, formatTimeIST, summarizeLiveAttendance } from '../lib/attendance';
import {
  lastTripCheckpoint,
  suggestedHospitals,
  todayHospitalTrips,
  todayTripKm,
} from '../lib/hospitalTrip';
import { Te } from './BilingualText';

export const HospitalTripPilotCard: React.FC = () => {
  const currentUser = useStore((s) => s.currentUser);
  const hospitals = useStore((s) => s.hospitals);
  const cases = useStore((s) => s.cases);
  const attendanceRecords = useStore((s) => s.attendanceRecords);
  const hospitalTripPunches = useStore((s) => s.hospitalTripPunches);
  const punchHospitalTrip = useStore((s) => s.punchHospitalTrip);

  const [hospitalId, setHospitalId] = useState('');
  const [otherName, setOtherName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const punchedIn = summarizeLiveAttendance(attendanceRecords, currentUser.id).isPunchedIn;
  const options = useMemo(
    () => suggestedHospitals(hospitals, cases, currentUser),
    [hospitals, cases, currentUser],
  );
  const today = todayHospitalTrips(hospitalTripPunches, currentUser.id);
  const totalKm = todayTripKm(hospitalTripPunches, currentUser.id);
  const from = lastTripCheckpoint(attendanceRecords, hospitalTripPunches, currentUser.id);

  const selectedName =
    hospitalId === 'other'
      ? otherName.trim()
      : options.find((h) => h.id === hospitalId)?.name ?? '';

  const handlePunch = async () => {
    setError(null);
    setSuccess(null);
    if (!selectedName) {
      setError('Select the hospital you reached.');
      return;
    }
    setBusy(true);
    try {
      const position = await getCurrentPosition();
      const result = await punchHospitalTrip(
        hospitalId === 'other' ? null : hospitalId || null,
        selectedName,
        position,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      const km = result.distanceKm ?? 0;
      setSuccess(
        km > 0
          ? `Hospital received. ${km} km from ${from?.label ?? 'last punch'}.`
          : 'Hospital punch saved. Punch in at office first next time to get km.',
      );
      setHospitalId('');
      setOtherName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get GPS. Try again outdoors.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-4 border-dashed border-sky-200 bg-sky-50/40">
      <CardBody className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
            <Navigation className="h-4 w-4 text-sky-700" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">Hospital punch · optional pilot</p>
            <Te className="text-gray-500 mb-0">Optional — skip cheyochu</Te>
            <p className="text-xs text-gray-500 mt-1">
              Office punch → hospital received punch. App calculates km. Not required for attendance or petrol.
            </p>
          </div>
        </div>

        {totalKm > 0 && (
          <p className="text-sm font-semibold text-sky-800 tabular-nums">
            Today GPS trip: {totalKm} km
          </p>
        )}

        {today.length > 0 && (
          <ul className="space-y-1">
            {today.map((p) => (
              <li key={p.id} className="text-xs text-gray-600">
                {formatTimeIST(p.punchedAt)} · {p.hospitalName}
                {p.distanceKm > 0 ? ` · ${p.distanceKm} km from ${p.fromLabel}` : ''}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            {success}
          </p>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Hospital reached</label>
          <select
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
          >
            <option value="">Select hospital</option>
            {options.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}{h.branch ? ` · ${h.branch}` : ''}
              </option>
            ))}
            <option value="other">Other</option>
          </select>
          {hospitalId === 'other' && (
            <input
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white mt-2"
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
              placeholder="Hospital name"
            />
          )}
        </div>

        {from && (
          <p className="text-[11px] text-gray-500 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            Distance from: {from.label}
            {!punchedIn ? ' (punch in at office for office→hospital km)' : ''}
          </p>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          disabled={busy}
          onClick={() => void handlePunch()}
        >
          {busy ? 'Getting GPS…' : 'Hospital received punch'}
        </Button>
      </CardBody>
    </Card>
  );
};
