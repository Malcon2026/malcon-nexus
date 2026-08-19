import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Flag, Loader2, Search, X, Plus } from 'lucide-react';
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
  tripRouteLabel,
} from '../lib/locationTrip';
import { Te } from './BilingualText';
import { PlusCodeLink } from './PlusCodeLink';
import { googleBikeMapsUrl } from '../lib/bikeRoute';
import { searchMalconHospitals, searchMapplsPlaces, type HospitalPlace } from '../lib/hospitalSearch';
import type { Hospital } from '../types';

function PlaceField({
  label,
  place,
  onChange,
  hospitals,
  disabled,
  placeholder,
}: {
  label: string;
  place: HospitalPlace | null;
  onChange: (place: HospitalPlace | null) => void;
  hospitals: Hospital[];
  disabled: boolean;
  placeholder: string;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<HospitalPlace[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (place || disabled) {
      setHits([]);
      setSearching(false);
      return;
    }
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    const local = searchMalconHospitals(hospitals, q);
    setHits(local);
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void searchMapplsPlaces(q).then((remote) => {
        if (cancelled) return;
        const seen = new Set(local.map((p) => p.name.toLowerCase()));
        setHits([...local, ...remote.filter((p) => !seen.has(p.name.toLowerCase()))].slice(0, 10));
      }).finally(() => {
        if (!cancelled) setSearching(false);
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, place, disabled, hospitals]);

  if (place) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
        <div className="flex items-start justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
            {place.address && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{place.address}</p>
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              className="p-1 rounded-md text-gray-500 hover:bg-white"
              onClick={() => {
                onChange(null);
                setQuery('');
              }}
              aria-label={`Clear ${label}`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          type="search"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        {(searching || hits.length > 0) && (
          <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {searching && hits.length === 0 && (
              <li className="px-3 py-2 text-xs text-gray-500">Searching Mappls…</li>
            )}
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  onClick={() => {
                    onChange(hit);
                    setQuery('');
                    setHits([]);
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
    </div>
  );
}

export const LocationPunchSection: React.FC = () => {
  const currentUser = useStore((s) => s.currentUser);
  const locationTrips = useStore((s) => s.locationTrips);
  const hospitals = useStore((s) => s.hospitals);
  const startLocationTrip = useStore((s) => s.startLocationTrip);
  const completeLocationTrip = useStore((s) => s.completeLocationTrip);

  const [adding, setAdding] = useState(false);
  const [from, setFrom] = useState<HospitalPlace | null>(null);
  const [to, setTo] = useState<HospitalPlace | null>(null);
  const [busy, setBusy] = useState<'start' | 'end' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const open = openLocationTrip(locationTrips, currentUser.id);
  const today = todayLocationTrips(locationTrips, currentUser.id);
  const totalKm = todayLocationTripKm(locationTrips, currentUser.id);

  useEffect(() => {
    if (!open) return;
    setAdding(false);
    setFrom((prev) => prev ?? (open.fromName ? {
      id: `saved-from:${open.id}`,
      name: open.fromName,
      address: open.fromAddress,
      eloc: open.fromEloc,
      lat: open.fromLat,
      lng: open.fromLng,
      source: open.fromEloc ? 'mappls' : 'malcon',
    } : null));
    setTo((prev) => prev ?? (open.hospitalName ? {
      id: `saved-to:${open.id}`,
      name: open.hospitalName,
      address: open.hospitalAddress,
      eloc: open.hospitalEloc,
      lat: open.hospitalLat,
      lng: open.hospitalLng,
      source: open.hospitalEloc ? 'mappls' : 'malcon',
    } : null));
  }, [open?.id, open?.fromName, open?.hospitalName]);

  const resetForm = () => {
    setAdding(false);
    setFrom(null);
    setTo(null);
  };

  const runGps = async (kind: 'start' | 'end') => {
    setError(null);
    setWarning(null);
    setSuccess(null);
    if (kind === 'start' && (!from || !to)) {
      setError('Pick From and To first.');
      return;
    }

    setBusy(kind);
    try {
      const position = await getCurrentPosition();
      if (kind === 'start') {
        const result = await startLocationTrip(position, from!, to!);
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.warning) setWarning(result.warning);
        setSuccess(`Trip ${result.tripNo} started. Press Reached after you arrive.`);
        return;
      }

      const result = await completeLocationTrip(position);
      if (result.error) {
        setError(result.error);
        return;
      }
      const kmLabel =
        result.bikeKm != null
          ? result.bikeMinutes != null
            ? `${result.bikeKm} km · ${result.bikeMinutes} min`
            : `${result.bikeKm} km bike`
          : `${result.distanceKm ?? 0} km`;
      if (result.warning) setWarning(result.warning);
      setSuccess(`Trip ${result.tripNo} saved · ${kmLabel}`);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get GPS. Try again outdoors.');
    } finally {
      setBusy(null);
    }
  };

  const showForm = adding || !!open;

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
              <Te className="text-gray-500 mb-0">Add trip → start → reached</Te>
            </div>
          </div>

          {open && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-sm font-semibold text-amber-900">
                Trip {open.tripNo} in progress
              </p>
              <p className="text-xs font-medium text-amber-900 mt-1">{tripRouteLabel(open)}</p>
              <p className="text-xs text-amber-800 mt-0.5">
                Started {formatTimeIST(open.startAt)}. Press Reached at To.
              </p>
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
          {warning && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {warning}
            </p>
          )}
          {success && (
            <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {success}
            </p>
          )}

          {!showForm && (
            <Button
              type="button"
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setError(null);
                setWarning(null);
                setSuccess(null);
                setAdding(true);
              }}
            >
              Add trip
            </Button>
          )}

          {showForm && (
            <>
              <PlaceField
                label="From"
                place={from}
                onChange={setFrom}
                hospitals={hospitals}
                disabled={busy != null || !!open}
                placeholder="Search starting place…"
              />
              <PlaceField
                label="To"
                place={to}
                onChange={setTo}
                hospitals={hospitals}
                disabled={busy != null || !!open}
                placeholder="Search destination…"
              />

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="primary"
                  icon={busy === 'start' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                  disabled={busy != null || !!open || !from || !to}
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

              {adding && !open && (
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-gray-800"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
            </>
          )}
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
                  {tripRouteLabel(t) && (
                    <p className="text-xs font-medium text-gray-800 mt-0.5">{tripRouteLabel(t)}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatTimeIST(t.startAt)}
                    {t.endAt ? ` → ${formatTimeIST(t.endAt)}` : ' · waiting for Reached'}
                  </p>
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
                          t.fromLat ?? t.startLat,
                          t.fromLng ?? t.startLng,
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
