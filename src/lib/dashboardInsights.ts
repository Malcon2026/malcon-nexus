import type {
  AttendanceRecord,
  Employee,
  EmployeeFoodSelection,
  ImplantCase,
  LeaveRequest,
  LocationTrip,
  PetrolRequest,
} from '../types';
import {
  canEmployeeSubmitCase,
  countFcfsPoolCases,
  isCaseVisibleToEmployee,
  mapCaseToVisibleStage,
} from './caseWorkflow';
import { normalizeWorkflowStage } from '../utils/helpers';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

/** Set true to call Gemini via dashboard-insights edge function on admin dashboard. */
export const ADMIN_DASHBOARD_AI_ENABLED = false;
import {
  formatTimeIST,
  getISTDateKey,
  summarizeDayAttendance,
  summarizeLiveAttendance,
} from './attendance';
import { getFoodSelectionForDay, isFoodSelectionSubmitted, shiftMealDateKey } from './food';
import { countPendingLeaveSubmissions } from './leave';
import { openLocationTrip } from './locationTrip';

export type AdminDashboardMetrics = {
  dateLabel: string;
  todaySurgeryDate: string;
  activeCases: number;
  totalCases: number;
  pendingApprovals: number;
  inSurgery: number;
  cleaningAudit: number;
  restockPending: number;
  completed: number;
  todayTasks: number;
  fcfsPool: number;
  todaySurgeriesCount: number;
  stageBreakdown: { stage: string; count: number }[];
};

export type EmployeeDashboardMetrics = {
  firstName: string;
  dateLabel: string;
  todayDateKey: string;
  yesterdayDateLabel: string;
  yesterdayWorkedLabel: string;
  yesterdayPunched: boolean;
  todayPunchedIn: boolean;
  todayPunchLabel: string | null;
  activeMyCases: number;
  waitingMyCases: number;
  casesNeedingSubmit: number;
  foodSubmittedToday: boolean;
  pendingLeaveCount: number;
  unreadAlerts: number;
  locationTripOpen: boolean;
  petrolPending: number;
};

export type DashboardInsightResult = {
  summary: string;
  source: 'gemini' | 'cached' | 'demo';
  generatedAt: string;
  /** Set when falling back to on-device bullets. */
  errorDetail?: string;
  notice?: string;
};

function shortenApiError(detail: string | undefined): string | undefined {
  if (!detail) return detail;
  if (/quota|rate limit|exceeded your current quota/i.test(detail)) {
    return 'Gemini free tier limit — wait ~1 minute, then click Refresh (avoid opening Dashboard many times).';
  }
  if (/no longer available|gemini-2\.0/i.test(detail)) {
    return 'Gemini model was updated on the server — refresh in a minute or click Refresh again.';
  }
  return detail.length > 220 ? `${detail.slice(0, 217)}…` : detail;
}

async function readInvokeError(error: unknown): Promise<string | undefined> {
  if (error instanceof FunctionsHttpError && error.context) {
    try {
      const body = (await error.context.json()) as { error?: string; code?: string };
      if (body?.code === 'GEMINI_NOT_CONFIGURED') {
        return 'GEMINI_API_KEY is missing in Supabase → Project Settings → Edge Functions → Secrets.';
      }
      if (body?.code === 'QUOTA_EXCEEDED') {
        return 'Gemini free tier limit — wait ~1 minute, then click Refresh.';
      }
      if (body?.error) return body.error;
    } catch {
      /* ignore parse errors */
    }
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: string }).message);
  }
  return undefined;
}

export function buildAdminDashboardMetrics(
  cases: ImplantCase[],
  stageDistribution: { stage: string; count: number }[],
  todaySurgeryDate: string,
): AdminDashboardMetrics {
  const activeCases = cases.filter((c) => c.status === 'Active' || c.status === 'Waiting For Approval');
  const pendingApprovals = cases.filter((c) => c.status === 'Waiting For Approval');
  const surgeryCases = cases.filter((c) => c.currentStage === 'Surgery');
  const cleaningQueue = cases.filter((c) => normalizeWorkflowStage(c.currentStage) === 'Cleaning & Audit');
  const restockPending = cases.filter(
    (c) => mapCaseToVisibleStage(c.currentStage) === 'Restock' && c.status !== 'Completed' && c.status !== 'Cancelled',
  );
  const completedCases = cases.filter((c) => c.status === 'Completed');
  const todayAssignments = cases.filter((c) => c.currentDepartment !== null && c.status === 'Active');
  const todaySurgeriesCount = stageDistribution.reduce((sum, item) => sum + item.count, 0);

  return {
    dateLabel: new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    todaySurgeryDate,
    activeCases: activeCases.length,
    totalCases: cases.length,
    pendingApprovals: pendingApprovals.length,
    inSurgery: surgeryCases.length,
    cleaningAudit: cleaningQueue.length,
    restockPending: restockPending.length,
    completed: completedCases.length,
    todayTasks: todayAssignments.length,
    fcfsPool: countFcfsPoolCases(cases),
    todaySurgeriesCount,
    stageBreakdown: stageDistribution.map(({ stage, count }) => ({ stage, count })),
  };
}

/** Local fallback when Gemini or the edge function is unavailable. */
export function formatDemoAdminSummary(m: AdminDashboardMetrics): string {
  const lines: string[] = [
    `• ${m.dateLabel}: ${m.activeCases} active case(s) of ${m.totalCases} total.`,
  ];

  if (m.todaySurgeriesCount > 0) {
    lines.push(`• Today's surgeries: ${m.todaySurgeriesCount} on the board.`);
  } else {
    lines.push('• No cases scheduled for today\'s surgery date on the stage chart.');
  }

  if (m.pendingApprovals > 0) {
    lines.push(`• ${m.pendingApprovals} case(s) waiting for approval — review Approvals when you can.`);
  }
  if (m.inSurgery > 0) lines.push(`• ${m.inSurgery} case(s) currently in Surgery.`);
  if (m.cleaningAudit > 0) lines.push(`• ${m.cleaningAudit} in Cleaning & Audit.`);
  if (m.restockPending > 0) lines.push(`• ${m.restockPending} awaiting Restock.`);
  if (m.fcfsPool > 0) lines.push(`• ${m.fcfsPool} case(s) in the FCFS pool.`);

  lines.push(`• ${m.completed} completed overall; ${m.todayTasks} active with a department assigned today.`);

  return lines.join('\n');
}

function formatWorkedLabel(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function buildEmployeeDashboardMetrics(
  employee: Pick<Employee, 'id' | 'email' | 'name' | 'department'>,
  attendanceRecords: AttendanceRecord[],
  cases: ImplantCase[],
  foodSelections: EmployeeFoodSelection[],
  leaveRequests: LeaveRequest[],
  locationTrips: LocationTrip[],
  petrolRequests: PetrolRequest[],
  unreadAlerts: number,
): EmployeeDashboardMetrics {
  const todayKey = getISTDateKey();
  const yesterdayKey = shiftMealDateKey(todayKey, -1);
  const yesterdaySummary = summarizeDayAttendance(attendanceRecords, employee.id, yesterdayKey);
  const todayLive = summarizeLiveAttendance(attendanceRecords, employee.id);

  const myCases = cases.filter((c) => isCaseVisibleToEmployee(c, employee));
  const activeMyCases = myCases.filter((c) => c.status === 'Active').length;
  const waitingMyCases = myCases.filter((c) => c.status === 'Waiting For Approval').length;
  const casesNeedingSubmit = myCases.filter((c) => canEmployeeSubmitCase(c, employee)).length;

  const todayFood = getFoodSelectionForDay(foodSelections, employee.id, todayKey);
  const myLeave = leaveRequests.filter((lr) => lr.employeeId === employee.id);
  const petrolPending = petrolRequests.filter(
    (r) => r.employeeId === employee.id && r.status === 'pending',
  ).length;

  let todayPunchLabel: string | null = null;
  if (todayLive.isPunchedIn && todayLive.punchIn) {
    todayPunchLabel = `In at ${formatTimeIST(todayLive.punchIn.punchedAt)}`;
  } else if (todayLive.punchOut) {
    todayPunchLabel = `Out at ${formatTimeIST(todayLive.punchOut.punchedAt)}`;
  }

  const yesterdayDateLabel = new Date(`${yesterdayKey}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return {
    firstName: employee.name.split(' ')[0] ?? employee.name,
    dateLabel: new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    }),
    todayDateKey: todayKey,
    yesterdayDateLabel,
    yesterdayWorkedLabel: formatWorkedLabel(yesterdaySummary.workedMs),
    yesterdayPunched: Boolean(yesterdaySummary.punchIn),
    todayPunchedIn: todayLive.isPunchedIn,
    todayPunchLabel,
    activeMyCases,
    waitingMyCases,
    casesNeedingSubmit,
    foodSubmittedToday: isFoodSelectionSubmitted(todayFood),
    pendingLeaveCount: countPendingLeaveSubmissions(myLeave),
    unreadAlerts,
    locationTripOpen: openLocationTrip(locationTrips, employee.id) !== null,
    petrolPending,
  };
}

/** Local fallback when Gemini or the edge function is unavailable. */
export function formatDemoEmployeeSummary(m: EmployeeDashboardMetrics): string {
  const lines: string[] = [];

  if (m.yesterdayPunched) {
    lines.push(`• Yesterday (${m.yesterdayDateLabel}) you logged ${m.yesterdayWorkedLabel} on the register.`);
  } else {
    lines.push(`• No punch recorded for yesterday (${m.yesterdayDateLabel}).`);
  }

  if (m.todayPunchedIn) {
    lines.push(`• You're punched in today${m.todayPunchLabel ? ` — ${m.todayPunchLabel}` : ''}.`);
  } else if (m.todayPunchLabel) {
    lines.push(`• Today: ${m.todayPunchLabel}.`);
  } else {
    lines.push('• You have not punched in yet today — open Attendance when you arrive.');
  }

  const caseParts: string[] = [];
  if (m.activeMyCases > 0) caseParts.push(`${m.activeMyCases} active`);
  if (m.waitingMyCases > 0) caseParts.push(`${m.waitingMyCases} waiting for approval`);
  if (caseParts.length) {
    lines.push(`• Your cases: ${caseParts.join(', ')}.`);
  } else {
    lines.push('• No active cases on your list right now.');
  }

  if (m.casesNeedingSubmit > 0) {
    lines.push(`• ${m.casesNeedingSubmit} case(s) need your stage submit — check Cases.`);
  }

  if (!m.foodSubmittedToday) {
    lines.push('• Today\'s meal choice is not submitted yet — open FOOD.');
  }

  if (m.pendingLeaveCount > 0) {
    lines.push(`• ${m.pendingLeaveCount} leave request(s) still pending approval.`);
  }

  if (m.unreadAlerts > 0) {
    lines.push(`• ${m.unreadAlerts} unread alert(s) in your inbox.`);
  }

  if (m.locationTripOpen) {
    lines.push('• You have an open location trip — mark Reached when you arrive.');
  }

  if (m.petrolPending > 0) {
    lines.push('• Petrol token request is waiting for admin issue.');
  }

  return lines.slice(0, 6).join('\n');
}

async function fetchDashboardInsight(
  scope: 'admin' | 'employee',
  metrics: AdminDashboardMetrics | EmployeeDashboardMetrics,
  formatDemo: (m: AdminDashboardMetrics | EmployeeDashboardMetrics) => string,
  options?: { refresh?: boolean },
): Promise<DashboardInsightResult> {
  const generatedAt = new Date().toISOString();
  const { data, error } = await supabase.functions.invoke('dashboard-insights', {
    body: { scope, metrics, refresh: options?.refresh === true },
  });

  if (error) {
    const errorDetail = shortenApiError(await readInvokeError(error));
    return {
      summary: formatDemo(metrics),
      source: 'demo',
      generatedAt,
      errorDetail,
    };
  }

  if (data && typeof data === 'object' && 'error' in data) {
    const apiError = String((data as { error: string }).error);
    const code = (data as { code?: string }).code;
    return {
      summary: formatDemo(metrics),
      source: 'demo',
      generatedAt,
      errorDetail: shortenApiError(
        code === 'GEMINI_NOT_CONFIGURED'
          ? 'GEMINI_API_KEY is missing in Supabase → Project Settings → Edge Functions → Secrets.'
          : code === 'QUOTA_EXCEEDED'
            ? 'Gemini free tier limit — wait ~1 minute, then click Refresh.'
            : apiError,
      ),
    };
  }

  const summary = typeof data?.summary === 'string' ? data.summary.trim() : '';
  if (!summary) {
    return {
      summary: formatDemo(metrics),
      source: 'demo',
      generatedAt,
      errorDetail: 'Empty response from dashboard-insights.',
    };
  }

  const source =
    data?.source === 'gemini' ? 'gemini' : data?.source === 'cached' ? 'cached' : 'demo';

  return {
    summary,
    source,
    generatedAt: typeof data?.generatedAt === 'string' ? data.generatedAt : generatedAt,
    notice: typeof data?.notice === 'string' ? data.notice : undefined,
  };
}

export async function fetchAdminDashboardInsight(
  metrics: AdminDashboardMetrics,
  options?: { refresh?: boolean },
): Promise<DashboardInsightResult> {
  return fetchDashboardInsight('admin', metrics, (m) => formatDemoAdminSummary(m as AdminDashboardMetrics), options);
}

export async function fetchEmployeeDashboardInsight(
  metrics: EmployeeDashboardMetrics,
  options?: { refresh?: boolean },
): Promise<DashboardInsightResult> {
  return fetchDashboardInsight(
    'employee',
    metrics,
    (m) => formatDemoEmployeeSummary(m as EmployeeDashboardMetrics),
    options,
  );
}
