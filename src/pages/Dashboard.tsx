import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen, Clock, Stethoscope, Sparkles, Receipt,
  CheckCircle2, Calendar, ArrowUpRight, ArrowRight,
  AlertTriangle, Activity
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { useStore } from '../store/useStore';
import { priorityColors, stageColors, formatDate, timeAgo, getStageStyle, getPriorityStyle, normalizeWorkflowStage } from '../utils/helpers';
import { filterAttendanceStaff } from '../lib/staff';
import { mapCaseToVisibleStage, countFcfsPoolCases } from '../lib/caseWorkflow';
import { getTodaySurgeryDateKey } from '../components/SurgeryDateQuickPick';
import { AdminOpsFeedCard } from '../components/AdminOpsFeedCard';
import { buildAdminDashboardMetrics } from '../lib/dashboardInsights';
import { buildDashboardStaffSnapshot } from '../lib/dashboardStaffSnapshot';
import { NexusPage, NexusPageHeader } from '../components/layout/NexusPageHeader';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.07 } },
};

interface KPICardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg: string;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
}

const KPICard: React.FC<KPICardProps> = ({ label, value, icon, iconBg, subtitle }) => (
  <motion.div variants={fadeUp} className="h-full">
    <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-separator)] p-4 h-full flex flex-col gap-3 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-popover)] hover:border-[var(--color-separator-opaque)] transition-all duration-200 cursor-default group">
      <div className="flex items-center gap-2.5">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconBg} transition-transform duration-200 group-hover:scale-110`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-gray-500 leading-tight">{label}</span>
      </div>
      <div className="flex-1 flex flex-col justify-end">
        <span className="text-2xl font-bold text-gray-900 tracking-tight">{value}</span>
        {subtitle && <span className="text-[11px] text-gray-400 mt-0.5">{subtitle}</span>}
      </div>
    </div>
  </motion.div>
);

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3">
        <p className="text-xs font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2 text-xs">
            <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-500">{p.name}:</span>
            <span className="font-semibold text-gray-800">{p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const Dashboard: React.FC = () => {
  const {
    cases,
    employees,
    activityLog,
    attendanceRecords,
    foodSelections,
    leaveRequests,
    setActiveTab,
    setSelectedCase,
    getDailyData,
    getDepartmentPerformance,
    getStageDistribution,
  } = useStore();

  const dailyData = getDailyData();
  const weekCaseTotal = useMemo(() => dailyData.reduce((sum, row) => sum + row.cases, 0), [dailyData]);
  const weekCompletedTotal = useMemo(
    () => dailyData.reduce((sum, row) => sum + row.completed, 0),
    [dailyData],
  );
  const departmentPerformance = getDepartmentPerformance();
  const todaySurgeryDate = getTodaySurgeryDateKey();
  const stageDistribution = getStageDistribution(todaySurgeryDate);
  const stageDistributionTotal = stageDistribution.reduce((sum, item) => sum + item.count, 0);

  const activeCases = cases.filter(c => c.status === 'Active' || c.status === 'Waiting For Approval');
  const pendingApprovals = cases.filter(c => c.status === 'Waiting For Approval');
  const surgeryCases = cases.filter(c => c.currentStage === 'Surgery');
  const cleaningQueue = cases.filter(c => normalizeWorkflowStage(c.currentStage) === 'Cleaning & Audit');
  const restockPending = cases.filter(
    (c) => mapCaseToVisibleStage(c.currentStage) === 'Restock' && c.status !== 'Completed' && c.status !== 'Cancelled',
  );
  const fcfsPoolTotal = countFcfsPoolCases(cases);
  const completedCases = cases.filter(c => c.status === 'Completed');
  const todayAssignments = cases.filter(c => c.currentDepartment !== null && c.status === 'Active');

  const allLogs = activityLog.slice(0, 8);

  const upcomingCases = cases
    .filter(c => c.status !== 'Completed' && c.status !== 'Cancelled')
    .sort((a, b) => new Date(a.surgeryDate).getTime() - new Date(b.surgeryDate).getTime())
    .slice(0, 4);

  const staffSnapshot = useMemo(
    () => buildDashboardStaffSnapshot(employees, attendanceRecords, foodSelections, leaveRequests),
    [employees, attendanceRecords, foodSelections, leaveRequests],
  );

  const insightMetrics = useMemo(
    () => buildAdminDashboardMetrics(cases, stageDistribution, todaySurgeryDate, staffSnapshot),
    [cases, stageDistribution, todaySurgeryDate, staffSnapshot],
  );

  const todayBoardTotal = insightMetrics.todayCasesCount;

  const dateLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <NexusPage maxWidthClass="max-w-[1600px]" className="space-y-6">
      <NexusPageHeader
        title="Overview"
        description={dateLabel}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<FolderOpen className="h-4 w-4" />}
            onClick={() => setActiveTab('cases')}
            className="w-full sm:w-auto"
          >
            View All Cases
          </Button>
        }
      />

      {/* KPI Grid */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 items-stretch"
      >
        <KPICard
          label="Today's board"
          value={todayBoardTotal}
          icon={<FolderOpen className="h-4 w-4 text-[var(--color-accent)]" />}
          iconBg="bg-[var(--color-accent-muted)]"
          subtitle={`${insightMetrics.todayOngoingCount} ongoing · ${insightMetrics.todayCompletedCount} done`}
        />
        <KPICard label="Pending Approvals" value={pendingApprovals.length} icon={<Clock className="h-4 w-4 text-amber-600" />} iconBg="bg-amber-50" />
        <KPICard label="In Surgery" value={surgeryCases.length} icon={<Stethoscope className="h-4 w-4 text-blue-600" />} iconBg="bg-blue-50" />
        <KPICard label="Cleaning & Audit" value={cleaningQueue.length} icon={<Sparkles className="h-4 w-4 text-cyan-600" />} iconBg="bg-cyan-50" />
        <KPICard label="Restock Pending" value={restockPending.length} icon={<Receipt className="h-4 w-4 text-emerald-600" />} iconBg="bg-emerald-50" />
        <KPICard label="Completed" value={completedCases.length} icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} iconBg="bg-green-50" />
        <KPICard label="Today's Tasks" value={todayAssignments.length} icon={<Calendar className="h-4 w-4 text-purple-600" />} iconBg="bg-purple-50" subtitle={fcfsPoolTotal > 0 ? `${fcfsPoolTotal} in pool` : undefined} />
        <KPICard
          label="This week"
          value={weekCaseTotal}
          icon={<Activity className="h-4 w-4 text-sky-600" />}
          iconBg="bg-sky-50"
          subtitle={`Mon–Sun · ${weekCompletedTotal} completed`}
        />
      </motion.div>

      {/* Ops feed + week chart + stage pie — three equal tiles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0 items-stretch">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="min-h-[360px] lg:min-h-[400px] h-full"
        >
          <AdminOpsFeedCard metrics={insightMetrics} className="h-full" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="min-h-[360px] lg:min-h-[400px] h-full"
        >
          <Card className="h-full flex flex-col">
            <CardHeader className="shrink-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">This week · Mon–Sun</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Surgeries per day (IST)</p>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-500 shrink-0">
                  <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-sm bg-[var(--color-accent)]" /><span>Cases</span></div>
                  <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-sm bg-emerald-500" /><span>Done</span></div>
                </div>
              </div>
            </CardHeader>
            <CardBody className="flex-1 min-h-0 pb-4">
              <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                <BarChart
                  data={dailyData}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  barGap={2}
                  barCategoryGap="22%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8b97ab' }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: '#8b97ab' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 113, 227, 0.06)' }} />
                  <Bar dataKey="cases" name="Cases" fill="#0071e3" radius={[5, 5, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="completed" name="Completed" fill="#34d399" radius={[5, 5, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="min-h-[360px] lg:min-h-[400px] h-full"
        >
          <Card className="h-full flex flex-col">
            <CardHeader className="shrink-0">
              <h3 className="text-sm font-semibold text-gray-900">Cases by Stage</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Today ({stageDistributionTotal} case{stageDistributionTotal === 1 ? '' : 's'})
              </p>
            </CardHeader>
            <CardBody className="flex-1 flex flex-col min-h-0">
              {stageDistributionTotal === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
                  No cases scheduled for today
                </div>
              ) : (
                <>
                  <div className="flex-1 min-h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stageDistribution} cx="50%" cy="50%" innerRadius={36} outerRadius={58} paddingAngle={2} dataKey="count">
                          {stageDistribution.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [value, 'Cases']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 mt-2 shrink-0 max-h-[120px] overflow-y-auto">
                    {stageDistribution.map((item) => (
                      <div key={item.stage} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-2 w-2 rounded-full shrink-0" style={{ background: item.color }} />
                          <span className="text-xs text-gray-600 truncate">{item.stage}</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-900 tabular-nums">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </motion.div>
      </div>

      {/* Department Performance */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Department Performance</h3>
              </div>
              <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Avg 93.3%
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={departmentPerformance} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" vertical={false} />
                <XAxis dataKey="department" tick={{ fontSize: 10, fill: '#8b97ab' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8b97ab' }} axisLine={false} tickLine={false} domain={[80, 100]} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 113, 227, 0.06)' }} />
                <Bar dataKey="onTime" name="On Time %" fill="#0071e3" radius={[5, 5, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </motion.div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
                </div>
                <button onClick={() => setActiveTab('activity')} className="text-xs nexus-link flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-gray-50">
                {allLogs.map((log) => {
                  return (
                    <div key={log.id} className="flex items-start gap-3 px-6 py-3 hover:bg-gray-50/50 transition-colors">
                      <div className="relative mt-0.5">
                        <Avatar name={log.performedBy} size="sm" />
                        <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white flex items-center justify-center ${log.performedByRole === 'admin' ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-label-secondary)]'}`}>
                          <Activity className="h-1.5 w-1.5 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-gray-900">{log.performedBy}</span>
                          <span className="text-xs text-gray-500">{log.action}</span>
                          {log.entityType === 'case' && (
                            <button
                              onClick={() => { setSelectedCase(log.entityId); setActiveTab('cases'); }}
                              className="text-xs nexus-link"
                            >
                              {log.entityLabel}
                            </button>
                          )}
                          {log.entityType !== 'case' && (
                            <span className="text-xs text-gray-500 font-medium">{log.entityLabel}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{log.details}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(log.timestamp)}</span>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </motion.div>

        {/* Upcoming Surgeries */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Upcoming Surgeries</h3>
                <button onClick={() => setActiveTab('cases')} className="text-xs nexus-link flex items-center gap-1">
                  All <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-gray-50">
                {upcomingCases.map((c) => {
                  const sc = getStageStyle(c.currentStage);
                  const pc = getPriorityStyle(c.priority);
                  return (
                    <div
                      key={c.id}
                      className="px-5 py-3.5 hover:bg-gray-50/50 cursor-pointer transition-colors"
                      onClick={() => { setSelectedCase(c.id); setActiveTab('cases'); }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-xs font-semibold text-gray-900">{c.caseNumber}</p>
                          <p className="text-xs text-gray-500 truncate">{c.hospital?.name ?? 'Unknown Hospital'}</p>
                        </div>
                        <Badge className={`${pc} text-[10px]`}>{c.priority}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge className={`${sc.bg} ${sc.text} ${sc.border} text-[10px]`}>
                          <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                          {c.currentStage}
                        </Badge>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {formatDate(c.surgeryDate)}
                        </div>
                      </div>
                      {new Date(c.surgeryDate) < new Date() && c.status !== 'Completed' && (
                        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          Surgery date passed
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </div>
    </NexusPage>
  );
};
