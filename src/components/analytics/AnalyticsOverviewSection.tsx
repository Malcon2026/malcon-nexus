import React from 'react';
import {
  FolderOpen, Users, LogIn, CheckCircle2, LineChart,
} from 'lucide-react';
import { Card } from '../ui/Card';
import type { AnalyticsSection } from './types';

interface OverviewStats {
  totalCases: number;
  activeCases: number;
  completedCases: number;
  pendingApprovals: number;
  totalEmployees: number;
  punchedInToday: number;
}

interface Props {
  stats: OverviewStats;
  onNavigate: (section: AnalyticsSection) => void;
}

export const AnalyticsOverviewSection: React.FC<Props> = ({ stats, onNavigate }) => {
  const cards = [
    {
      section: 'cases' as const,
      label: 'Cases',
      value: stats.totalCases,
      sub: `${stats.activeCases} active · ${stats.completedCases} completed`,
      icon: <FolderOpen className="h-5 w-5 text-indigo-600" />,
      bg: 'bg-indigo-50',
    },
    {
      section: 'employees' as const,
      label: 'Team',
      value: stats.totalEmployees,
      sub: `${stats.punchedInToday} punched in today`,
      icon: <Users className="h-5 w-5 text-purple-600" />,
      bg: 'bg-purple-50',
    },
    {
      section: 'cases' as const,
      label: 'Pending Approvals',
      value: stats.pendingApprovals,
      sub: 'Cases awaiting stage review',
      icon: <CheckCircle2 className="h-5 w-5 text-amber-600" />,
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white border-0">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <LineChart className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Analytics Dashboard</h2>
            <p className="text-sm text-indigo-100 mt-1">
              Charts and KPIs for cases and team performance. Use Reports to download filtered data.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(({ section, label, value, sub, icon, bg }, idx) => (
          <button
            key={`${section}-${label}-${idx}`}
            type="button"
            onClick={() => onNavigate(section)}
            className="text-left rounded-xl border border-gray-100 bg-white p-5 hover:shadow-md hover:border-gray-200 transition-all"
          >
            <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>{icon}</div>
            <p className="font-bold text-gray-900 text-3xl">{value}</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
          </button>
        ))}

        <Card className="p-5 border-dashed">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
            <LogIn className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="text-3xl font-bold text-emerald-600">{stats.punchedInToday}</p>
          <p className="text-sm font-medium text-gray-900 mt-1">Punched In Today</p>
          <p className="text-xs text-gray-500 mt-0.5">Live attendance snapshot</p>
        </Card>
      </div>
    </div>
  );
};
