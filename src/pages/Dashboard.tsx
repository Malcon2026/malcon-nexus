import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen, Stethoscope, Calendar, ArrowRight, AlertTriangle, Activity,
  LayoutGrid, Users, ClipboardCheck,
} from 'lucide-react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { useStore } from '../store/useStore';
import { formatDate, timeAgo, getStageStyle, getPriorityStyle, normalizeWorkflowStage } from '../utils/helpers';
import { mapCaseToVisibleStage, countFcfsPoolCases } from '../lib/caseWorkflow';
import { getTodaySurgeryDateKey } from '../components/SurgeryDateQuickPick';
import { getISTDateKey } from '../lib/attendance';
import { AdminOpsFeedCard } from '../components/AdminOpsFeedCard';
import { DashboardAttendanceSection } from '../components/DashboardAttendanceSection';
import { buildAdminDashboardMetrics } from '../lib/dashboardInsights';
import { buildDashboardAttendanceMetrics } from '../lib/dashboardAttendanceMetrics';
import { buildDashboardStaffSnapshot } from '../lib/dashboardStaffSnapshot';
import { NexusPage, NexusPageHeader } from '../components/layout/NexusPageHeader';

const WEEK_CHART = {
  cases: '#0071e3',
  completed: '#30b07a',
  axis: '#86868b',
  grid: '#ececf1',
} as const;

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

const ChartTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-separator)] bg-[var(--color-bg-elevated)] px-3 py-2.5 shadow-[var(--shadow-popover)]">
      <p className="text-[11px] font-medium text-[var(--color-label-secondary)] mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-[var(--color-label-secondary)]">{p.name}</span>
          <span className="font-semibold text-[var(--color-label)] tabular-nums ml-auto">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const weekChartActiveDot = (stroke: string) => ({
  r: 4,
  stroke,
  strokeWidth: 2,
  fill: '#ffffff',
});

function greetingForHour(h: number): string {
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export const Dashboard: React.FC = () => {
  const {
    cases,
    employees,
    activityLog,
    attendanceRecords,
    attendanceApprovalRequests,
    fieldTeamAttendanceApprovals,
    foodSelections,
    leaveRequests,
    setActiveTab,
    setSelectedCase,
    getDailyData,
    getStageDistribution,
  } = useStore();

  const dailyData = getDailyData();
  const weekCaseTotal = useMemo(() => dailyData.reduce((sum, row) => sum + row.cases, 0), [dailyData]);
  const weekCompletedTotal = useMemo(
    () => dailyData.reduce((sum, row) => sum + row.completed, 0),
    [dailyData],
  );

  const todaySurgeryDate = getTodaySurgeryDateKey();
  const stageDistribution = getStageDistribution(todaySurgeryDate);
  const stageDistributionTotal = stageDistribution.reduce((sum, item) => sum + item.count, 0);
  const stageMax = Math.max(...stageDistribution.map((s) => s.count), 1);

  const pendingApprovals = cases.filter((c) => c.status === 'Waiting For Approval');
  const surgeryCases = cases.filter((c) => c.currentStage === 'Surgery');
  const cleaningQueue = cases.filter((c) => normalizeWorkflowStage(c.currentStage) === 'Cleaning & Audit');
  const restockPending = cases.filter(
    (c) => mapCaseToVisibleStage(c.currentStage) === 'Restock' && c.status !== 'Completed' && c.status !== 'Cancelled',
  );
  const fcfsPoolTotal = countFcfsPoolCases(cases);
  const completedCases = cases.filter((c) => c.status === 'Completed');
  const todayAssignments = cases.filter((c) => c.currentDepartment !== null && c.status === 'Active');

  const recentLogs = activityLog.slice(0, 6);

  const upcomingCases = cases
    .filter((c) => c.status !== 'Completed' && c.status !== 'Cancelled')
    .sort((a, b) => new Date(a.surgeryDate).getTime() - new Date(b.surgeryDate).getTime())
    .slice(0, 5);

  const staffSnapshot = useMemo(
    () =>
      buildDashboardStaffSnapshot(
        employees,
        attendanceRecords,
        foodSelections,
        leaveRequests,
        getISTDateKey(),
        fieldTeamAttendanceApprovals,
      ),
    [employees, attendanceRecords, foodSelections, leaveRequests, fieldTeamAttendanceApprovals],
  );

  const attendanceMetrics = useMemo(
    () =>
      buildDashboardAttendanceMetrics(
        employees,
        attendanceRecords,
        leaveRequests,
        attendanceApprovalRequests,
        fieldTeamAttendanceApprovals,
      ),
    [employees, attendanceRecords, leaveRequests, attendanceApprovalRequests, fieldTeamAttendanceApprovals],
  );

  const insightMetrics = useMemo(
    () => buildAdminDashboardMetrics(cases, stageDistribution, todaySurgeryDate, staffSnapshot),
    [cases, stageDistribution, todaySurgeryDate, staffSnapshot],
  );

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const greeting = greetingForHour(now.getHours());

  const goCases = () => setActiveTab('cases');
  const goApprovals = () => setActiveTab('approvals');
  const goWorkflow = () => setActiveTab('workflow');
  const goAttendance = () => setActiveTab('attendance');

  return (
    <NexusPage maxWidthClass="max-w-[1280px]" className="dash-root space-y-8">
      <NexusPageHeader
        title={greeting}
        description={dateLabel}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<FolderOpen className="h-4 w-4" />}
            onClick={goCases}
            className="w-full sm:w-auto"
          >
            All cases
          </Button>
        }
      />

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="dash-hero"
        aria-label="Today at a glance"
      >
        <div className="dash-hero__inner">
          <div className="min-w-0">
            <p className="dash-hero__kicker">Today&apos;s surgery board</p>
            <p className="dash-hero__value">{insightMetrics.todayCasesCount}</p>
            <p className="dash-hero__meta">
              <strong>{insightMetrics.todayOngoingCount}</strong> ongoing ·{' '}
              <strong>{insightMetrics.todayCompletedCount}</strong> completed
              {insightMetrics.todayPendingApprovals > 0 && (
                <>
                  {' '}
                  · <strong>{insightMetrics.todayPendingApprovals}</strong> awaiting approval
                </>
              )}
              {fcfsPoolTotal > 0 && (
                <>
                  {' '}
                  · <strong>{fcfsPoolTotal}</strong> in FCFS pool
                </>
              )}
            </p>
          </div>

          <div className="dash-stat-grid w-full md:w-auto" role="group" aria-label="Live queue">
            <button type="button" className="dash-stat-cell" onClick={goApprovals}>
              <p className={`dash-stat-cell__value ${pendingApprovals.length ? 'dash-stat-cell__value--warn' : ''}`}>
                {pendingApprovals.length}
              </p>
              <p className="dash-stat-cell__label">Approvals</p>
            </button>
            <button type="button" className="dash-stat-cell" onClick={goWorkflow}>
              <p className="dash-stat-cell__value">{surgeryCases.length}</p>
              <p className="dash-stat-cell__label">In surgery</p>
            </button>
            <button type="button" className="dash-stat-cell" onClick={goWorkflow}>
              <p className="dash-stat-cell__value">{cleaningQueue.length}</p>
              <p className="dash-stat-cell__label">Cleaning</p>
            </button>
            <button type="button" className="dash-stat-cell" onClick={goWorkflow}>
              <p className="dash-stat-cell__value">{restockPending.length}</p>
              <p className="dash-stat-cell__label">Restock</p>
            </button>
          </div>
        </div>
      </motion.section>

      <div className="dash-quick">
        <button type="button" className="dash-quick__btn" onClick={goWorkflow}>
          <LayoutGrid className="h-4 w-4" aria-hidden />
          Workflow
        </button>
        <button type="button" className="dash-quick__btn" onClick={goApprovals}>
          <ClipboardCheck className="h-4 w-4" aria-hidden />
          Approval queue
        </button>
        <button type="button" className="dash-quick__btn" onClick={goAttendance}>
          <Users className="h-4 w-4" aria-hidden />
          Attendance
        </button>
        <button type="button" className="dash-quick__btn" onClick={() => setActiveTab('live-cases')}>
          <Stethoscope className="h-4 w-4" aria-hidden />
          Live cases
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-w-0 items-stretch">
        <motion.div
          className="lg:col-span-7 min-w-0"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35 }}
        >
          <div className="dash-panel h-full">
            <div className="dash-panel__head flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h2 className="dash-panel__title">This week</h2>
                <p className="dash-panel__sub">Surgeries per day · Mon–Sun · IST</p>
              </div>
              <div className="dash-legend shrink-0">
                <span>
                  <span className="dash-legend__dot" style={{ background: WEEK_CHART.cases }} aria-hidden />
                  Cases
                </span>
                <span>
                  <span className="dash-legend__dot" style={{ background: WEEK_CHART.completed }} aria-hidden />
                  Completed
                </span>
              </div>
            </div>
            <div className="dash-panel__body dash-panel__body--chart">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashWeekCasesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={WEEK_CHART.cases} stopOpacity={0.14} />
                      <stop offset="100%" stopColor={WEEK_CHART.cases} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={WEEK_CHART.grid} vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: WEEK_CHART.axis, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: WEEK_CHART.axis }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={32}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: WEEK_CHART.grid, strokeWidth: 1 }} />
                  <Area
                    type="monotone"
                    dataKey="cases"
                    name="Cases"
                    stroke={WEEK_CHART.cases}
                    strokeWidth={2}
                    fill="url(#dashWeekCasesFill)"
                    dot={false}
                    activeDot={weekChartActiveDot(WEEK_CHART.cases)}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    name="Completed"
                    stroke={WEEK_CHART.completed}
                    strokeWidth={2}
                    dot={false}
                    activeDot={weekChartActiveDot(WEEK_CHART.completed)}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="dash-week-footer">
                <span>
                  Week total: <strong>{weekCaseTotal}</strong> cases
                </span>
                <span>
                  Completed: <strong>{weekCompletedTotal}</strong>
                </span>
                <span>
                  Active tasks today: <strong>{todayAssignments.length}</strong>
                </span>
                <span>
                  All-time completed: <strong>{completedCases.length}</strong>
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="lg:col-span-5 min-w-0 min-h-[320px] lg:min-h-[360px]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          <AdminOpsFeedCard metrics={insightMetrics} className="h-full min-h-[320px]" />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 min-w-0">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35 }}
        >
          <div className="dash-panel h-full">
            <div className="dash-panel__head">
              <h2 className="dash-panel__title">Pipeline today</h2>
              <p className="dash-panel__sub">
                {stageDistributionTotal} case{stageDistributionTotal === 1 ? '' : 's'} on today&apos;s board
              </p>
            </div>
            <div className="dash-panel__body">
              {stageDistributionTotal === 0 ? (
                <p className="text-sm text-[var(--color-label-tertiary)] py-8 text-center">
                  No cases scheduled for today
                </p>
              ) : (
                <ul className="list-none m-0 p-0">
                  {stageDistribution.map((item) => (
                    <li key={item.stage} className="dash-pipeline-row">
                      <span className="dash-pipeline-row__label" title={item.stage}>
                        {item.stage}
                      </span>
                      <div className="dash-pipeline-row__track" aria-hidden>
                        <div
                          className="dash-pipeline-row__fill"
                          style={{
                            width: `${(item.count / stageMax) * 100}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                      <span className="dash-pipeline-row__count">{item.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.35 }}
        >
          <div className="dash-panel h-full flex flex-col">
            <div className="dash-panel__head flex items-center justify-between gap-2">
              <div>
                <h2 className="dash-panel__title">Up next</h2>
                <p className="dash-panel__sub">Nearest surgery dates</p>
              </div>
              <button type="button" onClick={goCases} className="text-xs nexus-link flex items-center gap-1 shrink-0">
                All <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <CardBody className="p-0 flex-1 min-h-0">
              {upcomingCases.length === 0 ? (
                <p className="text-sm text-[var(--color-label-tertiary)] py-8 text-center px-5">No open cases</p>
              ) : (
                upcomingCases.map((c) => {
                  const sc = getStageStyle(c.currentStage);
                  const pc = getPriorityStyle(c.priority);
                  const overdue = new Date(c.surgeryDate) < new Date() && c.status !== 'Completed';
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      className="dash-list-item dash-list-item--clickable"
                      onClick={() => {
                        setSelectedCase(c.id);
                        goCases();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedCase(c.id);
                          goCases();
                        }
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-[var(--color-label)]">{c.caseNumber}</span>
                          <Badge className={`${pc} text-[10px]`}>{c.priority}</Badge>
                        </div>
                        <p className="text-xs text-[var(--color-label-secondary)] truncate mt-0.5">
                          {c.hospital?.name ?? 'Unknown hospital'}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge className={`${sc.bg} ${sc.text} ${sc.border} text-[10px]`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                            {c.currentStage}
                          </Badge>
                          <span className="text-[11px] text-[var(--color-label-tertiary)] inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(c.surgeryDate)}
                          </span>
                        </div>
                        {overdue && (
                          <p className="flex items-center gap-1 mt-1.5 text-[11px] text-red-600">
                            <AlertTriangle className="h-3 w-3" />
                            Surgery date passed
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardBody>
          </div>
        </motion.div>
      </div>

      <motion.div
        className="dash-attendance-wrap"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, duration: 0.35 }}
      >
        <DashboardAttendanceSection
          metrics={attendanceMetrics}
          onOpenAttendance={goAttendance}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.35 }}
      >
        <div className="dash-panel">
          <div className="dash-panel__head flex items-center justify-between gap-2">
            <div>
              <h2 className="dash-panel__title">Recent activity</h2>
              <p className="dash-panel__sub">Latest updates across Nexus</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className="text-xs nexus-link flex items-center gap-1 shrink-0"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <CardBody className="p-0">
            {recentLogs.length === 0 ? (
              <p className="text-sm text-[var(--color-label-tertiary)] py-8 text-center">No activity yet</p>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="dash-list-item">
                  <div className="relative mt-0.5 shrink-0">
                    <Avatar name={log.performedBy} size="sm" />
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white flex items-center justify-center ${
                        log.performedByRole === 'admin' ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-label-secondary)]'
                      }`}
                    >
                      <Activity className="h-1.5 w-1.5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-semibold text-[var(--color-label)]">{log.performedBy}</span>
                      <span className="text-[var(--color-label-secondary)]">{log.action}</span>
                      {log.entityType === 'case' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCase(log.entityId);
                            goCases();
                          }}
                          className="nexus-link font-medium"
                        >
                          {log.entityLabel}
                        </button>
                      ) : (
                        <span className="text-[var(--color-label-secondary)] font-medium">{log.entityLabel}</span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-label-tertiary)] mt-0.5 truncate">{log.details}</p>
                  </div>
                  <span className="text-[10px] text-[var(--color-label-tertiary)] shrink-0">{timeAgo(log.timestamp)}</span>
                </div>
              ))
            )}
          </CardBody>
        </div>
      </motion.div>
    </NexusPage>
  );
};
