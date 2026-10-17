import React, { useMemo, useState } from 'react';
import {
  FolderOpen, Stethoscope, ArrowRight, AlertTriangle, Activity,
  LayoutGrid, Users, ClipboardCheck,
} from 'lucide-react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { CardBody } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { useStore } from '../store/useStore';
import { timeAgo, normalizeWorkflowStage } from '../utils/helpers';
import { mapCaseToVisibleStage, countFcfsPoolCases } from '../lib/caseWorkflow';
import { getTodaySurgeryDateKey } from '../components/SurgeryDateQuickPick';
import { getISTDateKey, matchesSurgeryDateKey } from '../lib/attendance';
import { AdminOpsFeedCard } from '../components/AdminOpsFeedCard';
import { DashboardAttendanceSection } from '../components/DashboardAttendanceSection';
import { buildAdminDashboardMetrics } from '../lib/dashboardInsights';
import { buildDashboardAttendanceMetrics } from '../lib/dashboardAttendanceMetrics';
import { buildDashboardStaffSnapshot } from '../lib/dashboardStaffSnapshot';
import { NexusPage, NexusPageHeader } from '../components/layout/NexusPageHeader';
import { NeedsAttention } from '../components/dashboard/NeedsAttention';
import { PipelineToday } from '../components/dashboard/PipelineToday';
import {
  buildPendingRows,
  summarizeAttention,
  type AttentionScope,
} from '../lib/dashboardOps';

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
    focusCaseListOnSurgeryDate,
    getDailyData,
    getStageDistribution,
  } = useStore();

  const [attentionScope, setAttentionScope] = useState<AttentionScope>('all');

  const dailyData = getDailyData();
  const weekCaseTotal = useMemo(() => dailyData.reduce((sum, row) => sum + row.cases, 0), [dailyData]);
  const weekCompletedTotal = useMemo(
    () => dailyData.reduce((sum, row) => sum + row.completed, 0),
    [dailyData],
  );

  const todaySurgeryDate = getTodaySurgeryDateKey();
  const stageDistribution = getStageDistribution(todaySurgeryDate);

  const opsTodayKey = getISTDateKey();
  const pendingRows = useMemo(() => buildPendingRows(cases, opsTodayKey), [cases, opsTodayKey]);
  const attentionSummary = useMemo(() => summarizeAttention(pendingRows), [pendingRows]);

  const pendingApprovals = cases.filter((c) => c.status === 'Waiting For Approval');

  const isTodayBoardCase = (c: (typeof cases)[number]) =>
    matchesSurgeryDateKey(c.surgeryDate, todaySurgeryDate);
  const isNonTerminalCase = (c: (typeof cases)[number]) =>
    c.status !== 'Completed' && c.status !== 'Cancelled';

  const surgeryCases = cases.filter(
    (c) =>
      isTodayBoardCase(c) &&
      isNonTerminalCase(c) &&
      c.currentStage === 'Surgery',
  );
  const deliveryQueue = cases.filter(
    (c) =>
      isTodayBoardCase(c) &&
      isNonTerminalCase(c) &&
      mapCaseToVisibleStage(c.currentStage) === 'Delivery',
  );
  const pickupQueue = cases.filter(
    (c) =>
      isTodayBoardCase(c) &&
      isNonTerminalCase(c) &&
      normalizeWorkflowStage(c.currentStage) === 'Pickup from Hospital',
  );
  const cleaningQueue = cases.filter(
    (c) =>
      isTodayBoardCase(c) &&
      isNonTerminalCase(c) &&
      normalizeWorkflowStage(c.currentStage) === 'Checking & Audit',
  );
  const fcfsPoolTotal = countFcfsPoolCases(cases);
  const todayAssignments = cases.filter((c) => c.currentDepartment !== null && c.status === 'Active');

  const recentLogs = activityLog.slice(0, 6);

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
  const openCase = (caseId: string) => {
    setSelectedCase(caseId);
    goCases();
  };
  const openCalendarOn = (dateKey: string) => {
    focusCaseListOnSurgeryDate(dateKey);
    goCases();
  };

  return (
    <NexusPage maxWidthClass="max-w-[1280px]" className="dash-root space-y-8">
      <NexusPageHeader
        title="Operations dashboard"
        description={`${greeting} · ${dateLabel}`}
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

      <section className="dash-hero" aria-label="Today at a glance">
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

          <div
            className="dash-stat-grid w-full md:w-auto"
            role="group"
            aria-label="Approvals all pending; other counts are today's surgery board by stage"
          >
            <button
              type="button"
              className="dash-stat-cell"
              onClick={goApprovals}
              aria-label={`${pendingApprovals.length} submissions awaiting approval, all dates`}
            >
              <p className={`dash-stat-cell__value ${pendingApprovals.length ? 'dash-stat-cell__value--warn' : ''}`}>
                {pendingApprovals.length}
              </p>
              <p className="dash-stat-cell__label">Approvals</p>
              <p className="dash-stat-cell__scope">All pending</p>
            </button>
            <button
              type="button"
              className="dash-stat-cell"
              onClick={goWorkflow}
              aria-label={`${deliveryQueue.length} cases in delivery on today's surgery board`}
            >
              <p className="dash-stat-cell__value">{deliveryQueue.length}</p>
              <p className="dash-stat-cell__label">Delivery</p>
            </button>
            <button
              type="button"
              className="dash-stat-cell"
              onClick={goWorkflow}
              aria-label={`${surgeryCases.length} cases in surgery on today's surgery board`}
            >
              <p className="dash-stat-cell__value">{surgeryCases.length}</p>
              <p className="dash-stat-cell__label">Surgery</p>
            </button>
            <button
              type="button"
              className="dash-stat-cell"
              onClick={goWorkflow}
              aria-label={`${pickupQueue.length} cases in pickup from hospital on today's surgery board`}
            >
              <p className="dash-stat-cell__value">{pickupQueue.length}</p>
              <p className="dash-stat-cell__label">Pickup</p>
            </button>
            <button
              type="button"
              className="dash-stat-cell"
              onClick={goWorkflow}
              aria-label={`${cleaningQueue.length} cases in checking and audit on today's surgery board`}
            >
              <p className="dash-stat-cell__value">{cleaningQueue.length}</p>
              <p className="dash-stat-cell__label">Checking</p>
            </button>
          </div>
        </div>
      </section>

      {pendingApprovals.length > 0 && (
        <section className="dash-attention" aria-labelledby="dash-attention-heading">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="dash-attention-heading" className="text-sm font-semibold text-amber-950">
              {pendingApprovals.length} submission{pendingApprovals.length === 1 ? '' : 's'} need approval
            </h2>
            <p className="text-xs text-amber-900/80 mt-0.5">
              Employees have submitted stage work — review photos and notes in the approval queue.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={goApprovals} className="shrink-0 w-full sm:w-auto">
            Open queue
          </Button>
        </section>
      )}

      <div className="ops-grid">
        <NeedsAttention
          rows={pendingRows}
          summary={attentionSummary}
          scope={attentionScope}
          onScopeChange={setAttentionScope}
          onOpenCase={openCase}
          onOpenAllCases={goCases}
          onOpenWorkflow={goWorkflow}
        />
        <PipelineToday
          cases={cases}
          todayKey={opsTodayKey}
          pendingRows={pendingRows}
          summary={attentionSummary}
          onOpenCase={openCase}
          onViewCalendar={openCalendarOn}
          onJumpToAttention={setAttentionScope}
        />
      </div>

      <div className="dash-quick hidden lg:flex">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-w-0 items-stretch dash-secondary-row">
        <div className="lg:col-span-7 min-w-0">
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
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 min-w-0 min-h-[320px] lg:min-h-[360px]">
          <AdminOpsFeedCard metrics={insightMetrics} className="h-full min-h-[320px]" />
        </div>
      </div>

      <div className="dash-attendance-wrap">
        <DashboardAttendanceSection
          metrics={attendanceMetrics}
          onOpenAttendance={goAttendance}
        />
      </div>

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
    </NexusPage>
  );
};
