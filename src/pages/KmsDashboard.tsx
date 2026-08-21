import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Check, ChevronLeft, ChevronRight, Download, Flag, Gauge, MapPin, Navigation, Pencil, ShieldAlert, Trash2, Users, X,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PlusCodeLink } from '../components/PlusCodeLink';
import { useStore } from '../store/useStore';
import { formatTimeIST, getISTDateKey } from '../lib/attendance';
import { googleBikeMapsUrl } from '../lib/bikeRoute';
import { exportLocationKmsCsv } from '../lib/kmsExport';
import {
  currentKmsMonth,
  kmsMonthLabel,
  shiftKmsDate,
  shiftKmsMonth,
  summarizeLocationKms,
} from '../lib/kmsStats';
import {
  formatBikeCard,
  locationTripDateKey,
  tripEndPlusCode,
  tripKm,
  tripRouteLabel,
  tripStartPlusCode,
} from '../lib/locationTrip';
import { formatDate } from '../utils/helpers';
import type { LocationTrip } from '../types';

const KmsChartTooltip: React.FC<{
  active?: boolean;
  payload?: { value?: number; payload?: { date?: string; trips?: number } }[];
}> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  const date = point.payload?.date;
  const trips = point.payload?.trips ?? 0;
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-gray-900">{date ? formatDate(date) : ''}</p>
      <p className="text-sm font-bold text-sky-700 tabular-nums mt-0.5">
        {Number(point.value ?? 0)} km
      </p>
      <p className="text-[11px] text-gray-500 mt-0.5">
        {trips} trip{trips === 1 ? '' : 's'}
      </p>
    </div>
  );
};

function EmployeeTripRow({
  trip,
  onDelete,
  onSaveKm,
  busy,
}: {
  trip: LocationTrip;
  onDelete: (trip: LocationTrip) => void;
  onSaveKm: (trip: LocationTrip, km: number) => Promise<boolean>;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [kmValue, setKmValue] = useState(String(tripKm(trip)));

  const startEdit = () => {
    setKmValue(String(tripKm(trip)));
    setEditing(true);
  };

  const save = async () => {
    const ok = await onSaveKm(trip, Number(kmValue));
    if (ok) setEditing(false);
  };

  return (
    <li className="px-4 py-2.5 border-t border-gray-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-gray-800">
          Trip {trip.tripNo}
          {tripRouteLabel(trip) ? ` · ${tripRouteLabel(trip)}` : ''}
        </p>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <input
                type="number"
                min="0"
                step="0.1"
                value={kmValue}
                onChange={(e) => setKmValue(e.target.value)}
                className="w-20 px-2 py-1 text-xs border border-gray-200 rounded-md tabular-nums"
                disabled={busy}
                autoFocus
              />
              <span className="text-xs text-gray-500">km</span>
              <button
                type="button"
                className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                aria-label="Save km"
                disabled={busy}
                onClick={() => void save()}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="p-1 rounded-md text-gray-400 hover:bg-gray-100"
                aria-label="Cancel"
                disabled={busy}
                onClick={() => setEditing(false)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold tabular-nums text-sky-700">
                {formatBikeCard(trip) ?? `${tripKm(trip)} km`}
              </p>
              <button
                type="button"
                className="p-1 rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-40"
                aria-label="Edit km"
                disabled={busy}
                onClick={startEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                aria-label="Delete trip"
                disabled={busy}
                onClick={() => onDelete(trip)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
      <p className="text-[11px] text-gray-500 mt-0.5">
        {formatDate(locationTripDateKey(trip))} · {formatTimeIST(trip.startAt)}
        {trip.endAt ? ` → ${formatTimeIST(trip.endAt)}` : ''}
      </p>
      {trip.notes && (
        <p className="text-[11px] text-gray-600 mt-1 whitespace-pre-wrap">{trip.notes}</p>
      )}
      <div className="mt-1 flex flex-col gap-0.5">
        <PlusCodeLink
          label="Start"
          plusCode={tripStartPlusCode(trip)}
          lat={trip.startLat}
          lng={trip.startLng}
          accuracyM={trip.startAccuracyM}
        />
        {trip.endLat != null && trip.endLng != null && (
          <>
            <PlusCodeLink
              label="Reached"
              plusCode={tripEndPlusCode(trip)}
              lat={trip.endLat}
              lng={trip.endLng}
              accuracyM={trip.endAccuracyM}
            />
            <a
              href={googleBikeMapsUrl(trip.startLat, trip.startLng, trip.endLat, trip.endLng)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-sky-700 hover:underline"
            >
              Bike route on Maps
            </a>
          </>
        )}
      </div>
    </li>
  );
}

export const KmsDashboard: React.FC = () => {
  const viewMode = useStore((s) => s.viewMode);
  const trips = useStore((s) => s.locationTrips);
  const employees = useStore((s) => s.employees);
  const deleteLocationTrip = useStore((s) => s.deleteLocationTrip);
  const updateLocationTripKm = useStore((s) => s.updateLocationTripKm);

  const [month, setMonth] = useState(currentKmsMonth);
  const [range, setRange] = useState<'today' | 'day' | 'month'>('today');
  const [selectedDate, setSelectedDate] = useState(getISTDateKey);
  const [selectedId, setSelectedId] = useState<string | 'all'>('all');
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const stats = useMemo(() => summarizeLocationKms(trips, month), [trips, month]);
  const todayMonth = currentKmsMonth();
  const todayKey = stats.today;
  const viewDate = range === 'month' ? null : range === 'today' ? todayKey : selectedDate;

  const openDate = (date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayKey) return;
    setSelectedDate(date);
    setMonth(date.slice(0, 7));
    setRange(date === todayKey ? 'today' : 'day');
  };

  const staffRows = useMemo(() => {
    if (!viewDate) {
      return [...stats.byEmployee]
        .map((row) => ({ ...row, dayKm: row.todayKm, dayTrips: row.todayTrips }))
        .sort((a, b) => b.km - a.km || b.dayKm - a.dayKm);
    }
    const monthById = new Map(stats.byEmployee.map((row) => [row.employeeId, row]));
    const map = new Map<string, { employeeId: string; name: string; dayKm: number; dayTrips: number; km: number; trips: number; lastDate: string }>();
    for (const trip of stats.completedMonth) {
      if (locationTripDateKey(trip) !== viewDate) continue;
      const monthRow = monthById.get(trip.employeeId);
      const current = map.get(trip.employeeId) ?? {
        employeeId: trip.employeeId,
        name: trip.employeeName,
        dayKm: 0,
        dayTrips: 0,
        km: monthRow?.km ?? 0,
        trips: monthRow?.trips ?? 0,
        lastDate: viewDate,
      };
      current.dayTrips += 1;
      current.dayKm = Math.round((current.dayKm + tripKm(trip)) * 10) / 10;
      map.set(trip.employeeId, current);
    }
    return [...map.values()].sort((a, b) => b.dayKm - a.dayKm || b.km - a.km);
  }, [stats.byEmployee, stats.completedMonth, viewDate]);

  const tripsByEmployee = useMemo(() => {
    const map = new Map<string, LocationTrip[]>();
    const source = viewDate
      ? stats.completedMonth.filter((t) => locationTripDateKey(t) === viewDate)
      : stats.completedMonth;
    for (const trip of source) {
      const list = map.get(trip.employeeId) ?? [];
      list.push(trip);
      map.set(trip.employeeId, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          locationTripDateKey(b).localeCompare(locationTripDateKey(a)) ||
          a.tripNo - b.tripNo ||
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
    }
    return map;
  }, [stats.completedMonth, viewDate]);

  const handleExport = (employeeId?: string, name?: string) => {
    setExportMsg(null);
    try {
      const result = exportLocationKmsCsv(trips, employees, {
        employeeId,
        date: viewDate ?? undefined,
        month: viewDate ? undefined : month,
        label: name || 'all-staff',
      });
      setExportMsg(`Downloaded ${result.count} ${result.count === 1 ? 'trip' : 'trips'} → ${result.filename}`);
    } catch (err) {
      setExportMsg(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  const handleDelete = async (trip: LocationTrip) => {
    const label = tripRouteLabel(trip) || `Trip ${trip.tripNo}`;
    if (!window.confirm(`Delete ${trip.employeeName} · ${label}? This cannot be undone.`)) return;
    setDeletingId(trip.id);
    setExportMsg(null);
    const result = await deleteLocationTrip(trip.id);
    setDeletingId(null);
    if (result.error) {
      setExportMsg(result.error);
      return;
    }
    setExportMsg(`Deleted ${trip.employeeName} · ${label}.`);
  };

  const handleSaveKm = async (trip: LocationTrip, km: number) => {
    setDeletingId(trip.id);
    setExportMsg(null);
    const result = await updateLocationTripKm(trip.id, km);
    setDeletingId(null);
    if (result.error) {
      setExportMsg(result.error);
      return false;
    }
    setExportMsg(`Updated ${trip.employeeName} · Trip ${trip.tripNo} to ${Math.round(km * 10) / 10} km.`);
    return true;
  };

  if (viewMode !== 'admin') {
    return (
      <div className="p-6 max-w-lg mx-auto mt-20">
        <Card className="p-8 text-center">
          <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900">Admin Access Required</h1>
          <p className="text-sm text-gray-500 mt-2">KMs Dashboard is only available to administrators.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto w-full min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-500">Location trips</p>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">KMs Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Two-wheeler road km from Start → Reached. Not attendance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
            <button
              type="button"
              className="p-2 rounded-md hover:bg-gray-100 text-gray-500"
              onClick={() => {
                setMonth((m) => shiftKmsMonth(m, -1));
                setRange('month');
              }}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm font-semibold text-gray-900 min-w-[9.5rem] text-center">
              {kmsMonthLabel(month)}
            </span>
            <button
              type="button"
              className="p-2 rounded-md hover:bg-gray-100 text-gray-500 disabled:opacity-30"
              onClick={() => {
                setMonth((m) => shiftKmsMonth(m, 1));
                setRange('month');
              }}
              disabled={month >= todayMonth}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={() => handleExport()}>
            Export month
          </Button>
        </div>
      </div>

      {exportMsg && (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">{exportMsg}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {[
          { label: 'Today', value: `${stats.todayKm} km`, sub: `${stats.todayTrips} trip${stats.todayTrips === 1 ? '' : 's'}`, icon: <Navigation className="h-4 w-4 text-sky-600" />, bg: 'bg-sky-50' },
          { label: 'Month km', value: stats.monthKm.toLocaleString('en-IN'), sub: `${stats.monthTripCount} completed`, icon: <Gauge className="h-4 w-4 text-cyan-600" />, bg: 'bg-cyan-50' },
          { label: 'Bike routes', value: stats.bikeTrips, sub: 'Mappls two-wheeler', icon: <MapPin className="h-4 w-4 text-indigo-600" />, bg: 'bg-indigo-50' },
          { label: 'Staff this month', value: stats.uniqueStaff, sub: 'With a completed trip', icon: <Users className="h-4 w-4 text-violet-600" />, bg: 'bg-violet-50' },
          { label: 'In progress', value: stats.inProgress.length, sub: 'Waiting for Reached', icon: <Flag className="h-4 w-4 text-amber-600" />, bg: 'bg-amber-50' },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${item.bg} mb-3`}>{item.icon}</div>
            <p className="text-xl font-bold text-gray-900 tabular-nums leading-none">{item.value}</p>
            <p className="text-xs font-medium text-gray-700 mt-1.5">{item.label}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{item.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-w-0">
        <Card className="xl:col-span-2">
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-900">Daily km · {kmsMonthLabel(month)}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Tap a bar to open that day's staff list</p>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.daily} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<KmsChartTooltip />} cursor={{ fill: 'rgba(14,165,233,0.08)' }} />
                <Bar
                  dataKey="km"
                  name="Km"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                  cursor="pointer"
                  onClick={(data) => {
                    const point = data as { date?: string; payload?: { date?: string } };
                    const date = point.date || point.payload?.date;
                    if (date) openDate(date);
                  }}
                >
                  {stats.daily.map((d) => (
                    <Cell key={d.date} fill={viewDate === d.date ? '#0369a1' : '#0ea5e9'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-900">In progress</h2>
            <p className="text-xs text-gray-500 mt-0.5">Started, not yet Reached</p>
          </CardHeader>
          <CardBody className="p-0">
            {stats.inProgress.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-400">No open trips</p>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {stats.inProgress.map((t) => (
                  <li key={t.id} className="px-4 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{t.employeeName}</p>
                        <p className="text-xs text-gray-500">Trip {t.tripNo} · started {formatTimeIST(t.startAt)}</p>
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200 mt-1">Waiting for Reached</Badge>
                      </div>
                      <button
                        type="button"
                        className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                        aria-label="Delete trip"
                        disabled={deletingId === t.id}
                        onClick={() => void handleDelete(t)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Employees</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {viewDate
                ? `${formatDate(viewDate)} · highest km first. Tap a name to open trips.`
                : 'Month km first. Tap a name to open trips.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium rounded-md ${range === 'today' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                onClick={() => openDate(todayKey)}
              >
                Today
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium rounded-md ${range === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                onClick={() => {
                  const date = selectedDate > todayKey ? todayKey : selectedDate;
                  setSelectedDate(date);
                  setMonth(date.slice(0, 7));
                  setRange('day');
                }}
              >
                Date
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium rounded-md ${range === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                onClick={() => setRange('month')}
              >
                Month
              </button>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
              <button
                type="button"
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
                onClick={() => openDate(shiftKmsDate(viewDate ?? selectedDate, -1))}
                aria-label="Previous day"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <input
                type="date"
                value={viewDate ?? selectedDate}
                max={todayKey}
                onChange={(e) => openDate(e.target.value)}
                className="px-1 py-1 text-xs text-gray-800 bg-transparent"
                aria-label="Pick a date"
              />
              <button
                type="button"
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 disabled:opacity-30"
                onClick={() => openDate(shiftKmsDate(viewDate ?? selectedDate, 1))}
                disabled={(viewDate ?? selectedDate) >= todayKey}
                aria-label="Next day"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button variant="outline" size="xs" icon={<Download className="h-3.5 w-3.5" />} onClick={() => handleExport()}>
              {viewDate ? 'Export day' : 'Export all staff'}
            </Button>
          </div>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          {staffRows.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-gray-400">
              {viewDate ? `No trips on ${formatDate(viewDate)}` : `No trips in ${kmsMonthLabel(month)}`}
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2.5 w-10">#</th>
                  <th className="px-4 py-2.5">Employee</th>
                  <th className="px-4 py-2.5 text-right">{viewDate && viewDate !== todayKey ? 'Day km' : 'Today km'}</th>
                  <th className="px-4 py-2.5 text-right">{viewDate && viewDate !== todayKey ? 'Day trips' : 'Today trips'}</th>
                  <th className="px-4 py-2.5 text-right">Month km</th>
                  <th className="px-4 py-2.5 text-right">Month trips</th>
                  <th className="px-4 py-2.5">Last trip</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffRows.map((row, index) => {
                  const open = selectedId === row.employeeId;
                  const employeeTrips = tripsByEmployee.get(row.employeeId) ?? [];
                  return (
                    <React.Fragment key={row.employeeId}>
                      <tr
                        className={`cursor-pointer hover:bg-gray-50 ${open ? 'bg-indigo-50' : 'bg-white'}`}
                        onClick={() => setSelectedId((id) => (id === row.employeeId ? 'all' : row.employeeId))}
                      >
                        <td className="px-4 py-2.5 text-xs font-semibold tabular-nums text-gray-400">{index + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{row.name}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-sky-400">{row.dayKm}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-800">{row.dayTrips}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-800">{row.km}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-800">{row.trips}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{formatDate(row.lastDate)}</td>
                        <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            icon={<Download className="h-3.5 w-3.5" />}
                            onClick={() => handleExport(row.employeeId, row.name)}
                          >
                            Export
                          </Button>
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-gray-50">
                          <td colSpan={8} className="p-0">
                            {employeeTrips.length === 0 ? (
                              <p className="px-4 py-3 text-xs text-gray-500">No completed trips</p>
                            ) : (
                              <ul>
                                {employeeTrips.map((t) => (
                                  <EmployeeTripRow
                                    key={t.id}
                                    trip={t}
                                    busy={deletingId === t.id}
                                    onDelete={(trip) => void handleDelete(trip)}
                                    onSaveKm={handleSaveKm}
                                  />
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
