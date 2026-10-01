import React, { useMemo, useState } from 'react';
import { Search, Stethoscope, BarChart3 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useStore } from '../store/useStore';
import { NexusPage, NexusPageHeader } from '../components/layout/NexusPageHeader';
import { buildDoctorCaseStats, masterDoctorRows } from '../lib/doctorAnalytics';

export const Doctors: React.FC = () => {
  const { doctors, cases } = useStore();
  const [search, setSearch] = useState('');

  const stats = useMemo(() => buildDoctorCaseStats(cases, doctors), [cases, doctors]);
  const rows = useMemo(() => masterDoctorRows(doctors, stats), [doctors, stats]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.doctorCode ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const withCases = rows.filter((r) => r.total > 0).length;
  const totalCaseLinks = rows.reduce((n, r) => n + r.total, 0);
  const activeCases = rows.reduce((n, r) => n + r.active, 0);
  const top = [...rows].sort((a, b) => b.total - a.total)[0];
  const maxCases = top?.total ?? 1;

  const topTen = useMemo(
    () => [...rows].filter((r) => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 10),
    [rows],
  );

  return (
    <NexusPage maxWidthClass="max-w-[1400px]">
      <NexusPageHeader
        title="Doctors"
        description={`Master surgeon list — ${doctors.length} doctors (MLS-DOC codes)`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="p-3">
          <p className="text-xs font-semibold text-gray-500">Master doctors</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{doctors.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold text-gray-500">With cases</p>
          <p className="text-2xl font-bold text-[var(--color-accent)] mt-1">{withCases}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold text-gray-500">Case links</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalCaseLinks}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold text-gray-500">Active cases</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCases}</p>
        </Card>
      </div>

      {top && top.total > 0 && (
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-[var(--color-accent)]" />
            <p className="text-sm font-semibold text-gray-900">Top surgeons by case volume</p>
          </div>
          <div className="space-y-2">
            {topTen.map((r) => (
              <div key={r.doctorId} className="flex items-center gap-3 text-xs">
                <span className="w-24 shrink-0 font-mono text-gray-500">{r.doctorCode ?? '—'}</span>
                <span className="w-32 sm:w-40 truncate text-gray-800" title={r.name}>
                  {r.name}
                </span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--color-accent)]"
                    style={{ width: `${Math.max(4, (r.total / maxCases) * 100)}%` }}
                  />
                </div>
                <span className="w-8 text-right font-semibold text-gray-900">{r.total}</span>
              </div>
            ))}
          </div>
          {top && (
            <p className="text-[11px] text-gray-400 mt-3">
              Most cases: <strong className="text-gray-600">{top.name}</strong> ({top.total})
            </p>
          )}
        </Card>
      )}

      <div className="relative w-full min-w-0 sm:max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search name or MLS-DOC code..."
          className="nexus-field-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3 text-center">Total</th>
                <th className="px-4 py-3 text-center">Active</th>
                <th className="px-4 py-3 text-center">Done</th>
                <th className="px-4 py-3 hidden sm:table-cell">Last surgery</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.doctorId} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-accent)]">
                    {r.doctorCode ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Stethoscope className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="font-medium text-gray-900 truncate">{r.name}</span>
                      {r.total === 0 && (
                        <Badge className="text-[10px] bg-gray-100 text-gray-500 border-gray-200">
                          No cases
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center font-semibold text-gray-900">{r.total}</td>
                  <td className="px-4 py-2.5 text-center text-[var(--color-accent)]">{r.active}</td>
                  <td className="px-4 py-2.5 text-center text-emerald-600">{r.completed}</td>
                  <td className="px-4 py-2.5 hidden sm:table-cell text-xs text-gray-500">
                    {r.lastSurgeryDate ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="p-8 text-center text-sm text-gray-500">No doctors match your search.</p>
        )}
      </Card>
    </NexusPage>
  );
};
