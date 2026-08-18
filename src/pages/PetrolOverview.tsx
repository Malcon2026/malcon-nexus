import React, { useMemo, useState } from 'react';
import { Camera, Fuel, Ticket, Users, Wallet, AlertTriangle, Trash2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useStore } from '../store/useStore';
import { summarizePetrol } from '../lib/petrolStats';
import { petrolStatusLabel } from '../lib/petrol';
import { formatCurrency, formatDate } from '../utils/helpers';

const statusBadge: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  issued: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  receipt_submitted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const PetrolOverview: React.FC<{ onOpenQueue?: () => void }> = ({ onOpenQueue }) => {
  const petrolRequests = useStore((s) => s.petrolRequests);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const clearAllPetrolEntries = useStore((s) => s.clearAllPetrolEntries);
  const [busy, setBusy] = useState(false);
  const stats = useMemo(() => summarizePetrol(petrolRequests), [petrolRequests]);

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

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Monitor tokens, bills, and petrol spend across the team.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {petrolRequests.length > 0 && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              icon={<Trash2 className="h-4 w-4" />}
              disabled={busy}
              onClick={() => void handleClearAll()}
            >
              Delete all
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={openQueue}>
            Open token queue
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            label: 'Waiting for token',
            value: stats.pending.length,
            sub: 'Issue book & token',
            icon: <Ticket className="h-4 w-4 text-amber-700" />,
            bg: 'bg-amber-50',
          },
          {
            label: 'Awaiting bill',
            value: stats.awaitingBill.length,
            sub: 'Filled, photo pending',
            icon: <Camera className="h-4 w-4 text-indigo-700" />,
            bg: 'bg-indigo-50',
          },
          {
            label: 'Today',
            value: formatCurrency(stats.todayAmount),
            sub: `${stats.todayFills} fill${stats.todayFills === 1 ? '' : 's'}`,
            icon: <Fuel className="h-4 w-4 text-orange-700" />,
            bg: 'bg-orange-50',
          },
          {
            label: 'This month',
            value: formatCurrency(stats.monthAmount),
            sub: `${stats.monthFills} fill${stats.monthFills === 1 ? '' : 's'}`,
            icon: <Wallet className="h-4 w-4 text-emerald-700" />,
            bg: 'bg-emerald-50',
          },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${item.bg} mb-2`}>
              {item.icon}
            </div>
            <p className="text-lg font-bold text-gray-900 tabular-nums">{item.value}</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">{item.label}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{item.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-900">Last 14 days</h2>
            <p className="text-xs text-gray-500 mt-0.5">Petrol amount issued / billed each day</p>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.daily} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
                />
                <Bar dataKey="amount" name="Amount" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">This month by staff</h2>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {stats.byEmployee.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No fills this month</p>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {stats.byEmployee.map((row) => (
                  <li key={row.employeeId} className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{row.name}</p>
                      <p className="text-xs text-gray-500">
                        {row.fills} fill{row.fills === 1 ? '' : 's'}
                        {row.vehicleNo ? ` · ${row.vehicleNo}` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-gray-900 shrink-0">
                      {formatCurrency(row.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-gray-900">Needs action</h2>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {stats.pending.length === 0 && stats.awaitingBill.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Nothing waiting</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {stats.pending.map((r) => (
                  <li key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.employeeName}</p>
                      <p className="text-xs text-gray-500">{r.vehicleNo} · {formatCurrency(r.amount)}</p>
                    </div>
                    <Badge className={statusBadge.pending}>{petrolStatusLabel.pending}</Badge>
                  </li>
                ))}
                {stats.awaitingBill.map((r) => (
                  <li key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.employeeName}</p>
                      <p className="text-xs text-gray-500">
                        Book {r.bookNo || '—'} token {r.tokenNo || '—'}
                      </p>
                    </div>
                    <Badge className={statusBadge.issued}>{petrolStatusLabel.issued}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-900">Recent fills</h2>
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            {stats.recent.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No petrol logged yet</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Employee</th>
                    <th className="px-4 py-2">Vehicle</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.recent.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                        {formatDate(r.issuedAt || r.requestedAt)}
                      </td>
                      <td className="px-4 py-2 font-medium text-gray-900">{r.employeeName}</td>
                      <td className="px-4 py-2 text-gray-700">{r.vehicleNo || '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.amount)}</td>
                      <td className="px-4 py-2">
                        <Badge className={statusBadge[r.status] ?? ''}>
                          {petrolStatusLabel[r.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
