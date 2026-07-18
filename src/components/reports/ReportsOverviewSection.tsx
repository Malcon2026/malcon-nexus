import React from 'react';
import {
  FolderOpen, Users, LogIn, CheckCircle2, Building2, Receipt, ScrollText, ShieldAlert,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { formatCurrency } from '../../utils/helpers';
import type { ReportSection } from './types';

interface OverviewStats {
  totalCases: number;
  activeCases: number;
  completedCases: number;
  pendingApprovals: number;
  totalEmployees: number;
  punchedInToday: number;
  absentToday: number;
  pendingOffsiteApprovals: number;
  totalRevenue: number;
  collectedRevenue: number;
  hospitalCount: number;
  activityCount: number;
}

interface Props {
  stats: OverviewStats;
  onNavigate: (section: ReportSection) => void;
}

export const ReportsOverviewSection: React.FC<Props> = ({ stats, onNavigate }) => {
  const cards = [
    {
      section: 'cases' as const,
      label: 'Total Cases',
      value: stats.totalCases,
      sub: `${stats.activeCases} active · ${stats.completedCases} completed`,
      icon: <FolderOpen className="h-5 w-5 text-indigo-600" />,
      bg: 'bg-indigo-50',
    },
    {
      section: 'attendance' as const,
      label: 'Punched In Today',
      value: stats.punchedInToday,
      sub: `${stats.absentToday} absent · ${stats.totalEmployees} staff`,
      icon: <LogIn className="h-5 w-5 text-emerald-600" />,
      bg: 'bg-emerald-50',
    },
    {
      section: 'approvals' as const,
      label: 'Pending Approvals',
      value: stats.pendingApprovals + stats.pendingOffsiteApprovals,
      sub: `${stats.pendingApprovals} stages · ${stats.pendingOffsiteApprovals} off-site punch outs`,
      icon: <CheckCircle2 className="h-5 w-5 text-amber-600" />,
      bg: 'bg-amber-50',
    },
    {
      section: 'billing' as const,
      label: 'Revenue Pipeline',
      value: formatCurrency(stats.totalRevenue),
      sub: `${formatCurrency(stats.collectedRevenue)} collected`,
      icon: <Receipt className="h-5 w-5 text-blue-600" />,
      bg: 'bg-blue-50',
      isText: true,
    },
    {
      section: 'employees' as const,
      label: 'Employees',
      value: stats.totalEmployees,
      sub: 'Team directory & performance',
      icon: <Users className="h-5 w-5 text-purple-600" />,
      bg: 'bg-purple-50',
    },
    {
      section: 'hospitals' as const,
      label: 'Hospitals',
      value: stats.hospitalCount,
      sub: 'Partner hospitals & case volume',
      icon: <Building2 className="h-5 w-5 text-cyan-600" />,
      bg: 'bg-cyan-50',
    },
    {
      section: 'activity' as const,
      label: 'Activity Events',
      value: stats.activityCount,
      sub: 'Full audit trail',
      icon: <ScrollText className="h-5 w-5 text-gray-600" />,
      bg: 'bg-gray-50',
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white border-0">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Admin Reports Center</h2>
            <p className="text-sm text-indigo-100 mt-1">
              One place for cases, attendance, employees, billing, approvals, activity, and hospitals.
              Use the sections below or open any report card.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map(({ section, label, value, sub, icon, bg, isText }) => (
          <button
            key={section}
            type="button"
            onClick={() => onNavigate(section)}
            className="text-left rounded-xl border border-gray-100 bg-white p-5 hover:shadow-md hover:border-gray-200 transition-all"
          >
            <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>{icon}</div>
            <p className={`font-bold text-gray-900 ${isText ? 'text-xl' : 'text-3xl'}`}>{value}</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
};
