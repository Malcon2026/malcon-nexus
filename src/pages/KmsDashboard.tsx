import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ChevronLeft, ChevronRight, Download, Flag, Gauge, MapPin, Navigation, Search, ShieldAlert, Users,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PlusCodeLink } from '../components/PlusCodeLink';
import { useStore } from '../store/useStore';
import { formatTimeIST } from '../lib/attendance';
import { googleBikeMapsUrl } from '../lib/bikeRoute';
import { exportLocationKmsCsv } from '../lib/kmsExport';
import {
  currentKmsMonth,
  kmsMonthLabel,
  shiftKmsMonth,
  summarizeLocationKms,
} from '../lib/kmsStats';
import {
  formatBikeCard,
  locationTripDateKey,
  tripEndPlusCode,
  tripKm,
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

function TripDetail({ trip }: { trip: LocationTrip }) {
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-gray-900">
          {trip.employeeName}
          <span className="ml-2 text-xs font-normal text-gray-500">Trip {trip.tripNo}</span>
        </p>
        <p className="text-xs font-semibold tabular-nums text-sky-700">
          {trip.status === 'completed' ? formatBikeCard(trip) ?? `${tripKm(trip)} km` : 'In progress'}
        </p>
      </div>
      <p className="text-xs text-gray-500 mt-0.5">
        {formatDate(locationTripDateKey(trip))} · {formatTimeIST(trip.startAt)}
        {trip.endAt ? ` → ${formatTimeIST(trip.endAt)}` : ''}
      </p>
      {trip.notes && (
        <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{trip.notes}</p>
      )}
      <div className="mt-1.5 flex flex-col gap-0.5">
        <PlusCodeLink
          label="Start"
          plusCode={tripStartPlusCode(trip)}
          lat={trip.startLat}
          lng={trip.startLng}
          accuracyM={trip.startAccuracyM}
        />
        {trip.status === 'completed' && (
          <PlusCodeLink
            label="Reached"
            plusCode={tripEndPlusCode(trip)}
            lat={trip.endLat}
            lng={trip.endLng}
            accuracyM={trip.endAccuracyM}
          />
        )}
        {trip.status === 'completed' && trip.endLat != null && trip.endLng != null && (
          <a
            href={googleBikeMapsUrl(trip.startLat, trip.startLng, trip.endLat, trip.endLng)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sky-700 hover:underline"
          >
            Bike route on Maps
          </a>
        )}
      </div>
    </li>
  );
}

export const KmsDashboard: React.FC = () => {
  const viewMode = useStore((s) => s.viewMode);
  const trips = useStore((s) => s.locationTrips);
  const employees = useStore((s) => s.employees);

  const [month, setMonth] = useState(currentKmsMonth);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | 'all'>('all');
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const stats = useMemo(() => summarizeLocationKms(trips, month), [trips, month]);
  const todayMonth = currentKmsMonth();

  const filteredStaff = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stats.byEmployee.filter((row) => {
      if (!q) return true;
      return row.name.toLowerCase().includes(q);
    });
  }, [stats.byEmployee, query]);

  const tripRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...stats.completedMonth]
      .filter((t) => (selectedId === 'all' ? true : t.employeeId === selectedId))
      .filter((t) => {
        if (!q) return true;
        return (
          t.employeeName.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }, [stats.completedMonth, selectedId, query]);

  const handleExport = (employeeId?: string, name?: string) => {
    setExportMsg(null);
    try {
      const result = exportLocationKmsCsv(trips, employees, {
        employeeId,
        month,
        label: name || 'all-staff',
      });
      setExportMsg(`Downloaded ${result.count} ${result.count === 1 ? 'trip' : 'trips'} → ${result.filename}`);
    } catch (err) {
      setExportMsg(err instanceof Error ? err.message : 'Export failed.');
    }
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
              onClick={() => setMonth((m) => shiftKmsMonth(m, -1))}
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
              onClick={() => setMonth((m) => shiftKmsMonth(m, 1))}
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
            <p className="text-xs text-gray-500 mt-0.5">Bike road km when Mappls answered, else stored trip km</p>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.daily} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<KmsChartTooltip />} cursor={{ fill: 'rgba(14,165,233,0.08)' }} />
                <Bar dataKey="km" name="Km" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={28} />
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
                    <p className="text-sm font-medium text-gray-900 truncate">{t.employeeName}</p>
                    <p className="text-xs text-gray-500">Trip {t.tripNo} · started {formatTimeIST(t.startAt)}</p>
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 mt-1">Waiting for Reached</Badge>
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
            <h2 className="text-sm font-semibold text-gray-900">By employee</h2>
            <p className="text-xs text-gray-500 mt-0.5">Tap a name to see that person’s trips</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or notes"
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-full sm:w-56"
            />
          </div>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          {filteredStaff.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-gray-400">No trips in {kmsMonthLabel(month)}</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2.5">Employee</th>
                  <th className="px-4 py-2.5 text-right">Trips</th>
                  <th className="px-4 py-2.5 text-right">Km</th>
                  <th className="px-4 py-2.5 text-right">Bike routes</th>
                  <th className="px-4 py-2.5">Last trip</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStaff.map((row) => (
                  <tr
                    key={row.employeeId}
                    className={`cursor-pointer hover:bg-sky-50/60 ${selectedId === row.employeeId ? 'bg-sky-50' : 'bg-white'}`}
                    onClick={() => setSelectedId((id) => (id === row.employeeId ? 'all' : row.employeeId))}
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.trips}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{row.km}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.bikeTrips}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{formatDate(row.lastDate)}</td>
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
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {selectedId === 'all' ? 'Trips this month' : `${tripRows[0]?.employeeName ?? 'Employee'} trips`}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Plus Codes to re-check Start and Reached</p>
          </div>
          {selectedId !== 'all' && (
            <Button type="button" variant="ghost" size="xs" onClick={() => setSelectedId('all')}>
              Show all
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {tripRows.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-gray-400">No completed trips to show</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {tripRows.map((t) => (
                <TripDetail key={t.id} trip={t} />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
