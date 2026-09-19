import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Users, LogIn, LogOut, UserX, TreePalm, MapPin, AlertTriangle, Clock,
  ArrowRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Card, CardHeader, CardBody } from './ui/Card';
import { Button } from './ui/Button';
import type { DashboardAttendanceMetrics } from '../lib/dashboardAttendanceMetrics';

type Props = {
  metrics: DashboardAttendanceMetrics;
  onOpenAttendance: () => void;
};

type StatCard = {
  key: string;
  label: string;
  value: number;
  hint?: string;
  icon: React.ReactNode;
  iconBg: string;
};

const ATTENDANCE_BAR = {
  present: '#30b07a',
  absent: '#aeaeb2',
  leave: '#ff9f0a',
  offSite: '#0071e3',
} as const;

export const DashboardAttendanceSection: React.FC<Props> = ({ metrics, onOpenAttendance }) => {
  const statCards: StatCard[] = useMemo(
    () => [
      {
        key: 'total',
        label: 'Total staff',
        value: metrics.totalStaff,
        icon: <Users className="h-4 w-4 text-[var(--color-label-secondary)]" />,
        iconBg: 'bg-[var(--color-bg)]',
      },
      {
        key: 'present',
        label: 'Present',
        value: metrics.present,
        hint: 'Punched in or out today',
        icon: <Users className="h-4 w-4 text-emerald-600" />,
        iconBg: 'bg-emerald-50',
      },
      {
        key: 'in',
        label: 'Punched in',
        value: metrics.punchedIn,
        icon: <LogIn className="h-4 w-4 text-emerald-600" />,
        iconBg: 'bg-emerald-50',
      },
      {
        key: 'out',
        label: 'Punched out',
        value: metrics.punchedOut,
        icon: <LogOut className="h-4 w-4 text-[var(--color-accent)]" />,
        iconBg: 'bg-[var(--color-accent-muted)]',
      },
      {
        key: 'absent',
        label: 'Absent',
        value: metrics.absent,
        hint: 'No punch · not on leave',
        icon: <UserX className="h-4 w-4 text-[var(--color-label-secondary)]" />,
        iconBg: 'bg-[var(--color-bg)]',
      },
      {
        key: 'leave',
        label: 'On leave',
        value: metrics.onLeave,
        icon: <TreePalm className="h-4 w-4 text-amber-600" />,
        iconBg: 'bg-amber-50',
      },
      {
        key: 'offsite',
        label: 'Off-site',
        value: metrics.offSite,
        hint: 'Field / outside geofence',
        icon: <MapPin className="h-4 w-4 text-[var(--color-accent)]" />,
        iconBg: 'bg-[var(--color-accent-muted)]',
      },
      {
        key: 'unclosed',
        label: 'Unclosed shift',
        value: metrics.unclosed,
        icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
        iconBg: 'bg-amber-50',
      },
    ],
    [metrics],
  );

  const compositionData = useMemo(
    () => [
      {
        name: 'Today',
        Present: metrics.present,
        Absent: metrics.absent,
        'On leave': metrics.onLeave,
        'Off-site': metrics.offSite,
      },
    ],
    [metrics],
  );

  const pendingLine =
    metrics.pendingOffsiteApprovals > 0 || metrics.pendingLeaveApprovals > 0
      ? [
          metrics.pendingOffsiteApprovals > 0
            ? `${metrics.pendingOffsiteApprovals} off-site approval${metrics.pendingOffsiteApprovals === 1 ? '' : 's'}`
            : null,
          metrics.pendingLeaveApprovals > 0
            ? `${metrics.pendingLeaveApprovals} leave request${metrics.pendingLeaveApprovals === 1 ? '' : 's'} pending`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Attendance · Today</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Live headcount (IST) · {metrics.totalStaff} on register
            </p>
            {pendingLine && (
              <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0" aria-hidden />
                {pendingLine}
              </p>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenAttendance}
            className="shrink-0 w-full sm:w-auto"
            iconRight={<ArrowRight className="h-3.5 w-3.5" />}
          >
            Open Attendance
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map((card, index) => (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * index }}
              className="rounded-[var(--radius-md)] border border-[var(--color-separator)] bg-[var(--color-bg-elevated)] p-3.5"
            >
              <div className={`h-8 w-8 rounded-lg ${card.iconBg} flex items-center justify-center mb-2`}>
                {card.icon}
              </div>
              <p className="text-2xl font-bold text-gray-900 tabular-nums tracking-tight">{card.value}</p>
              <p className="text-[11px] font-medium text-gray-500 mt-0.5 leading-snug">{card.label}</p>
              {card.hint && (
                <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{card.hint}</p>
              )}
            </motion.div>
          ))}
        </div>

        <div>
          <p className="text-xs font-medium text-[var(--color-label-secondary)] mb-3">Today&apos;s mix</p>
          <ResponsiveContainer width="100%" height={56}>
            <BarChart
              data={compositionData}
              layout="vertical"
              margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
              barSize={28}
            >
              <CartesianGrid stroke="#ececf1" horizontal={false} vertical={false} />
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="name" hide width={0} />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 10,
                  border: '1px solid var(--color-separator)',
                }}
              />
              <Bar dataKey="Present" stackId="mix" fill={ATTENDANCE_BAR.present} radius={[6, 0, 0, 6]} />
              <Bar dataKey="Off-site" stackId="mix" fill={ATTENDANCE_BAR.offSite} />
              <Bar dataKey="On leave" stackId="mix" fill={ATTENDANCE_BAR.leave} />
              <Bar dataKey="Absent" stackId="mix" fill={ATTENDANCE_BAR.absent} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[10px] text-[var(--color-label-secondary)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-[#30b07a]" aria-hidden /> Present
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-[#0071e3]" aria-hidden /> Off-site
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-[#ff9f0a]" aria-hidden /> On leave
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-[#aeaeb2]" aria-hidden /> Absent
            </span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
