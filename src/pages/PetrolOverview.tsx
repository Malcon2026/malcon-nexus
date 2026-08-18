import React, { useMemo, useState } from 'react';
import {
  Camera, Fuel, Ticket, Users, Wallet, AlertTriangle, Trash2, Download,
  ChevronLeft, ChevronRight, Gauge, Car,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useStore } from '../store/useStore';
import {
  summarizePetrol,
  currentPetrolMonth,
  shiftPetrolMonth,
  petrolMonthLabel,
} from '../lib/petrolStats';
import { petrolStatusLabel } from '../lib/petrol';
import { exportPetrolCsv } from '../lib/petrolExport';
import { formatCurrency, formatDate } from '../utils/helpers';

const statusBadge: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  issued: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  receipt_submitted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const PetrolChartTooltip: React.FC<{
  active?: boolean;
  payload?: { value?: number; payload?: { date?: string; fills?: number } }[];
}> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  const date = point.payload?.date;
  const fills = point.payload?.fills ?? 0;
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-gray-900">{date ? formatDate(date) : ''}</p>
      <p className="text-sm font-bold text-orange-600 tabular-nums mt-0.5">
        {formatCurrency(Number(point.value ?? 0))}
      </p>
      <p className="text-[11px] text-gray-500 mt-0.5">
        {fills} fill{fills === 1 ? '' : 's'}
      </p>
    </div>
  );
};

export const PetrolOverview: React.FC<{ onOpenQueue?: () => void }> = ({ onOpenQueue }) => {
  const petrolRequests = useStore((s) => s.petrolRequests);
  const employees = useStore((s) => s.employees);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const clearAllPetrolEntries = useStore((s) => s.clearAllPetrolEntries);
  const [busy, setBusy] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [month, setMonth] = useState(currentPetrolMonth);

  const stats = useMemo(() => summarizePetrol(petrolRequests, month), [petrolRequests, month]);
  const todayMonth = currentPetrolMonth();

  const openQueue = () => {
    if (onOpenQueue) onOpenQueue();
    else setActiveTab('petrol-dashboard');
  };

  const handleClearAll = async () => {
    if (petrolRequests.length === 0) return;
    if (!window.confirm(`Delete all ${petrolRequests.length} petrol entries? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await clearAllPetrolEntries();
    } finally {
      setBusy(false);
    }
  };

  const handleExport = (employeeId?: string, name?: string) => {
    setExportMsg(null);
    try {
      const result = exportPetrolCsv(petrolRequests, employees, {
        employeeId,
        month,
        label: name || 'all-staff',
      });
      setExportMsg(`Downloaded ${result.count} ${result.count === 1 ? 'row' : 'rows'} → ${result.filename}`);
    } catch (err) {
      setExportMsg(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto w-full min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">Petrol</p>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'Asia/Kolkata',
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
            <button
              type="button"
              className="p-2 rounded-md hover:bg-gray-100 text-gray-500"
              onClick={() => setMonth((m) => shiftPetrolMonth(m, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm font-semibold text-gray-900 min-w-[9.5rem] text-center">
              {petrolMonthLabel(month)}
            </span>
            <button
              type="button"
              className="p-2 rounded-md hover:bg-gray-100 text-gray-500 disabled:opacity-30"
              onClick={() => setMonth((m) => shiftPetrolMonth(m, 1))}
              disabled={month >= todayMonth}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={() => handleExport()}>
            Export month
          </Button>
          <Button variant="primary" size="sm" onClick={openQueue}>
            Token queue
          </Button>
        </div>
      </div>

      {exportMsg && (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">{exportMsg}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Need token', value: stats.pending.length, sub: 'Waiting now', icon: <Ticket className="h-4 w-4 text-amber-600" />, bg: 'bg-amber-50' },
          { label: 'Awaiting bill', value: stats.awaitingBill.length, sub: 'At pump / photo due', icon: <Camera className="h-4 w-4 text-indigo-600" />, bg: 'bg-indigo-50' },
          { label: 'Today', value: formatCurrency(stats.todayAmount), sub: `${stats.todayFills} fill${stats.todayFills === 1 ? '' : 's'}`, icon: <Fuel className="h-4 w-4 text-orange-600" />, bg: 'bg-orange-50' },
          { label: 'Month spend', value: formatCurrency(stats.monthAmount), sub: `${stats.monthFills} fills · avg ${formatCurrency(stats.avgFill)}`, icon: <Wallet className="h-4 w-4 text-emerald-600" />, bg: 'bg-emerald-50' },
          { label: 'Staff this month', value: stats.uniqueStaff, sub: `${stats.uniqueVehicles} vehicle${stats.uniqueVehicles === 1 ? '' : 's'}`, icon: <Users className="h-4 w-4 text-violet-600" />, bg: 'bg-violet-50' },
          { label: 'Km driven', value: stats.monthKms ? stats.monthKms.toLocaleString('en-IN') : '—', sub: 'Trip km from bills', icon: <Gauge className="h-4 w-4 text-cyan-600" />, bg: 'bg-cyan-50' },
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
            <h2 className="text-sm font-semibold text-gray-900">Daily spend · {petrolMonthLabel(month)}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Issued and billed petrol by day</p>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={stats.daily} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="petrolSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<PetrolChartTooltip />} cursor={{ stroke: '#f97316', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="amount" name="Amount" stroke="#f97316" fill="url(#petrolSpend)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-gray-900">Needs action</h2>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {stats.pending.length === 0 && stats.awaitingBill.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-400">All clear</p>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {stats.pending.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="w-full text-left px-4 py-2.5 hover:bg-gray-50" onClick={openQueue}>
                      <p className="text-sm font-medium text-gray-900 truncate">{r.employeeName}</p>
                      <p className="text-xs text-gray-500">{r.vehicleNo} · {formatCurrency(r.amount)}</p>
                      <Badge className={`${statusBadge.pending} mt-1`}>{petrolStatusLabel.pending}</Badge>
                    </button>
                  </li>
                ))}
                {stats.awaitingBill.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="w-full text-left px-4 py-2.5 hover:bg-gray-50" onClick={openQueue}>
                      <p className="text-sm font-medium text-gray-900 truncate">{r.employeeName}</p>
                      <p className="text-xs text-gray-500">Book {r.bookNo || '—'} · token {r.tokenNo || '—'}</p>
                      <Badge className={`${statusBadge.issued} mt-1`}>{petrolStatusLabel.issued}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Employee reports</h2>
            <p className="text-xs text-gray-500 mt-0.5">Export one boy’s fills, or the whole month</p>
          </div>
          <Button variant="outline" size="xs" icon={<Download className="h-3.5 w-3.5" />} onClick={() => handleExport()}>
            Export all staff
          </Button>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          {stats.byEmployee.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-gray-400">No petrol in {petrolMonthLabel(month)}</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2.5">Employee</th>
                  <th className="px-4 py-2.5 text-right">Fills</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5 text-right">Km driven</th>
                  <th className="px-4 py-2.5">Vehicle</th>
                  <th className="px-4 py-2.5">Last fill</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.byEmployee.map((row) => (
                  <tr key={row.employeeId} className="bg-white">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.fills}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.kms || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">
                      <span className="inline-flex items-center gap-1">
                        <Car className="h-3.5 w-3.5 text-gray-400" />
                        {row.vehicleNo || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{formatDate(row.lastDate)}</td>
                    <td className="px-4 py-2.5 text-right">
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

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-400">CSV includes date, vehicle, amount, book, token, meter readings, km driven, and bill status.</p>
        {petrolRequests.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            icon={<Trash2 className="h-3.5 w-3.5" />}
            disabled={busy}
            onClick={() => void handleClearAll()}
          >
            Delete all entries
          </Button>
        )}
      </div>
    </div>
  );
};
