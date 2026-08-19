import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Flag, Loader2, Search, X } from 'lucide-react';
import { Card, CardBody } from './ui/Card';
import { Button } from './ui/Button';
import { useStore } from '../store/useStore';
import { getCurrentPosition, formatTimeIST } from '../lib/attendance';
import {
  openLocationTrip,
  todayLocationTripKm,
  todayLocationTrips,
  tripEndPlusCode,
  tripKm,
  tripStartPlusCode,
  formatBikeCard,
} from '../lib/locationTrip';
import { Te } from './BilingualText';
import { PlusCodeLink } from './PlusCodeLink';
import { googleBikeMapsUrl } from '../lib/bikeRoute';
import { searchMalconHospitals, searchMapplsHospitals, type HospitalPlace } from '../lib/hospitalSearch';

const notesClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white min-h-[5.5rem] resize-y';

export const LocationPunchSection: React.FC = () => {
  const currentUser = useStore((s) => s.currentUser);
  const locationTrips = useStore((s) => s.locationTrips);
  const hospitals = useStore((s) => s.hospitals);
  const startLocationTrip = useStore((s) => s.startLocationTrip);
  const completeLocationTrip = useStore((s) => s.completeLocationTrip);

  const [notes, setNotes] = useState('');
  const [hospitalQuery, setHospitalQuery] = useState('');
  const [hospital, setHospital] = useState<HospitalPlace | null>(null);
  const [hospitalHits, setHospitalHits] = useState<HospitalPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<'start' | 'end' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const open = openLocationTrip(locationTrips, currentUser.id);
  const today = todayLocationTrips(locationTrips, currentUser.id);
  const totalKm = todayLocationTripKm(locationTrips, currentUser.id);

  useEffect(() => {
    if (open) {
      setNotes((prev) => (prev.trim() ? prev : open.notes));
      if (open.hospitalName) {
        setHospital((prev) => prev ?? {
          id: `saved:${open.id}`,
          name: open.hospitalName,
          address: open.hospitalAddress,
          eloc: open.hospitalEloc,
          lat: open.hospitalLat,
          lng: open.hospitalLng,
          source: open.hospitalEloc ? 'mappls' : 'malcon',
        });
      }
    }
  }, [open?.id, open?.notes, open?.hospitalName]);

  useEffect(() => {
    const q = hospitalQuery.trim();
    if (hospital || open) {
      setHospitalHits([]);
      setSearching(false);
      return;
    }
    if (q.length < 2) {
      setHospitalHits([]);
      setSearching(false);
      return;
    }
    const local = searchMalconHospitals(hospitals, q);
    setHospitalHits(local);
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void searchMapplsHospitals(q).then((remote) => {
        if (cancelled) return;
        const seen = new Set(local.map((p) => p.name.toLowerCase()));
        const extra = remote.filter((p) => !seen.has(p.name.toLowerCase()));
        setHospitalHits([...local, ...extra].slice(0, 10));
      }).finally(() => {
        if (!cancelled) setSearching(false);
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hospitalQuery, hospital, open, hospitals]);

  const runGps = async (kind: 'start' | 'end') => {
    setError(null);
    setSuccess(null);
    const trimmed = notes.trim();
    if (kind === 'start' && !hospital) {
      setError('Search and pick a hospital first.');
      return;
    }
    if (kind === 'start' && !trimmed && !hospital?.name) {
      setError('Add notes before starting the trip.');
      return;
    }
    if (kind === 'end' && !trimmed && !open?.notes.trim()) {
      setError('Add notes before completing the trip.');
      return;
    }

    setBusy(kind);
    try {
      const position = await getCurrentPosition();
      if (kind === 'start') {
        const result = await startLocationTrip(trimmed, position, hospital);
        if (result.error) {
          setError(result.error);
          return;
        }
        setSuccess(`Trip ${result.tripNo} to ${hospital?.name ?? 'hospital'} started${result.plusCode ? ` · ${result.plusCode}` : ''}. Press Reached after you arrive.`);
        setNotes(trimmed || hospital?.name || '');
        return;
      }

      const result = await completeLocationTrip(trimmed || open?.notes || '', position);
      if (result.error) {
        setError(result.error);
        return;
      }
      const kmLabel =
        result.bikeKm != null
          ? result.bikeMinutes != null
            ? `${result.bikeKm} km · ${result.bikeMinutes} min (two-wheeler)`
            : `${result.bikeKm} km bike`
          : `${result.distanceKm ?? 0} km straight`;
      setSuccess(`Trip ${result.tripNo} saved · ${kmLabel}${result.plusCode ? ` · ${result.plusCode}` : ''}`);
      setNotes('');
      setHospital(null);
      setHospitalQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get GPS. Try again outdoors.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
              <Navigation className="h-4 w-4 text-sky-700" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">Location punchin</p>
              <Te className="text-gray-500 mb-0">Start → reach → km</Te>
              <p className="text-xs text-gray-500 mt-1">
                Search the hospital, press <span className="font-medium text-gray-700">Start location</span>,
                travel, then <span className="font-medium text-gray-700">Reached</span>. Bike km is the
                two-wheeler road distance to that hospital.
              </p>
            </div>
          </div>

          {open && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-sm font-semibold text-amber-900">
                Trip {open.tripNo} in progress
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Started {formatTimeIST(open.startAt)}. Press Reached at the destination.
              </p>
              {open.hospitalName && (
                <p className="text-xs font-medium text-amber-900 mt-1">{open.hospitalName}</p>
              )}
              {open.notes && (
                <p className="text-xs text-amber-800 mt-1 whitespace-pre-wrap">{open.notes}</p>
              )}
              <div className="mt-1.5">
                <PlusCodeLink
                  label="Start"
                  plusCode={tripStartPlusCode(open)}
                  lat={open.startLat}
                  lng={open.startLng}
                  accuracyM={open.startAccuracyM}
                />
              </div>
            </div>
          )}

          {totalKm > 0 && (
            <p className="text-sm font-semibold text-sky-800 tabular-nums">
              Today GPS trips: {totalKm} km
            </p>
          )}

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {success}
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Hospital <span className="text-red-500">*</span>
            </label>
            {hospital ? (
              <div className="flex items-start justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{hospital.name}</p>
                  {hospital.address && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{hospital.address}</p>
                  )}
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {hospital.source === 'malcon' ? 'Malcon list' : 'Mappls'}
                  </p>
                </div>
                {!open && (
                  <button
                    type="button"
                    className="p-1 rounded-md text-gray-500 hover:bg-white"
                    onClick={() => {
                      setHospital(null);
                      setHospitalQuery('');
                    }}
                    aria-label="Clear hospital"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="search"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                  value={hospitalQuery}
                  onChange={(e) => setHospitalQuery(e.target.value)}
                  placeholder="Search KIMS, Yashoda, Apollo…"
                  disabled={busy != null || !!open}
                  autoComplete="off"
                />
                {(searching || hospitalHits.length > 0) && (
                  <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {searching && hospitalHits.length === 0 && (
                      <li className="px-3 py-2 text-xs text-gray-500">Searching Mappls…</li>
                    )}
                    {hospitalHits.map((hit) => (
                      <li key={hit.id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                          onClick={() => {
                            setHospital(hit);
                            setHospitalQuery('');
                            setHospitalHits([]);
                            setNotes((prev) => (prev.trim() ? prev : hit.name));
                          }}
                        >
                          <p className="text-sm font-medium text-gray-900">{hit.name}</p>
                          {hit.address && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{hit.address}</p>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              className={notesClass}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={open ? open.notes || 'Where are you going / what is this trip?' : 'Where are you going / what is this trip?'}
              disabled={busy != null}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="primary"
              icon={busy === 'start' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              disabled={busy != null || !!open || !hospital}
              onClick={() => void runGps('start')}
            >
              {busy === 'start' ? 'Getting GPS…' : 'Start location'}
            </Button>
            <Button
              type="button"
              variant="success"
              icon={busy === 'end' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
              disabled={busy != null || !open}
              onClick={() => void runGps('end')}
            >
              {busy === 'end' ? 'Getting GPS…' : 'Reached'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {today.length > 0 && (
        <Card>
          <CardBody className="p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Today’s trips</p>
            <ul className="space-y-2">
              {today.map((t) => (
                <li key={t.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">Trip {t.tripNo}</p>
                    <p className="text-xs font-semibold tabular-nums text-sky-700">
                      {t.status === 'completed'
                        ? formatBikeCard(t) ?? `${tripKm(t)} km`
                        : 'In progress'}
                    </p>
                  </div>
                  {t.hospitalName && (
                    <p className="text-xs font-medium text-gray-800 mt-0.5">{t.hospitalName}</p>
                  )}
                  {t.status === 'completed' && t.bikeKm != null && (
                    <p className="text-[11px] text-gray-500">Two-wheeler · Maps</p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatTimeIST(t.startAt)}
                    {t.endAt ? ` → ${formatTimeIST(t.endAt)}` : ' · waiting for Reached'}
                  </p>
                  {t.notes && (
                    <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{t.notes}</p>
                  )}
                  <div className="mt-1.5 flex flex-col gap-0.5">
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
                        href={googleBikeMapsUrl(
                          t.startLat,
                          t.startLng,
                          t.hospitalLat ?? t.endLat,
                          t.hospitalLng ?? t.endLng,
                        )}
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
          </CardBody>
        </Card>
      )}
    </div>
  );
};
