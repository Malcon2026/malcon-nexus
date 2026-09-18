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
  matchesSurgeryDateKey,
  summarizeDayAttendance,
  summarizeLiveAttendance,
} from './attendance';
import type { DashboardStaffSnapshot } from './dashboardStaffSnapshot';
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
  /** Cases on today's surgery date only (not all-time totals). */
  todayCasesCount: number;
  todayOngoingCount: number;
  todayCompletedCount: number;
  /** Billing + Bill Submission on today's board. */
  todayChargeableCount: number;
  todayPendingApprovals: number;
  staffTotal: number;
  staffPresentIn: number;
  staffPunchedOut: number;
  staffAbsent: number;
  staffOnLeave: number;
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
  staff?: Pick<
    DashboardStaffSnapshot,
    'totalStaff' | 'punchedIn' | 'punchedOut' | 'absent' | 'onLeaveToday'
  >,
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

  const todayCases = cases.filter(
    (c) => matchesSurgeryDateKey(c.surgeryDate, todaySurgeryDate) && c.status !== 'Cancelled',
  );
  const todayCompletedCount = todayCases.filter((c) => c.status === 'Completed').length;
  const todayOngoingCount = todayCases.filter(
    (c) => c.status !== 'Completed' && c.status !== 'Cancelled',
  ).length;
  const todayPendingApprovals = todayCases.filter((c) => c.status === 'Waiting For Approval').length;
  const todayChargeableCount = todayCases.filter((c) => {
    const stage = mapCaseToVisibleStage(c.currentStage);
    return stage === 'Billing' || stage === 'Bill Submission';
  }).length;

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
    todayCasesCount: todayCases.length,
    todayOngoingCount,
    todayCompletedCount,
    todayChargeableCount,
    todayPendingApprovals,
    staffTotal: staff?.totalStaff ?? 0,
    staffPresentIn: staff?.punchedIn ?? 0,
    staffPunchedOut: staff?.punchedOut ?? 0,
    staffAbsent: staff?.absent ?? 0,
    staffOnLeave: staff?.onLeaveToday ?? 0,
  };
}

export type AdminBriefFocus = 'all' | 'approvals' | 'surgery' | 'cleaning' | 'restock' | 'pool';

function greetingEn(): string {
  const h = Number(
    new Date().toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }),
  );
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function greetingTe(): string {
  const h = Number(
    new Date().toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }),
  );
  if (h < 12) return 'శుభోదయం';
  if (h < 17) return 'శుభ మధ్యాహ్నం';
  return 'శుభ సాయంత్రం';
}

/** Two lines: English then Telugu — human tone, numbers from metrics only. */
export function buildHumanAdminBrief(
  m: AdminDashboardMetrics,
  focus: AdminBriefFocus = 'all',
): { en: string; te: string } {
  const hi = greetingEn();
  const hiTe = greetingTe();

  switch (focus) {
    case 'approvals':
      return {
        en:
          m.pendingApprovals > 0
            ? `${hi} — ${m.pendingApprovals} case${m.pendingApprovals === 1 ? '' : 's'} need your approval when you get a minute.`
            : `${hi} — no cases waiting for approval right now.`,
        te:
          m.pendingApprovals > 0
            ? `${hiTe} — ${m.pendingApprovals} cases approval కోసం వేచి ఉన్నాయి, time ఉన్నప్పుడు చూడండి.`
            : `${hiTe} — approval కోసం వేచి ఉన్న cases ఏవీ లేవు.`,
      };
    case 'surgery':
      return {
        en: `${hi} — ${m.inSurgery} in surgery now; ${m.todaySurgeriesCount} on today’s board.`,
        te: `${hiTe} — ippudu surgery lo ${m.inSurgery}; eeroju board lo ${m.todaySurgeriesCount} surgeries.`,
      };
    case 'cleaning':
      return {
        en:
          m.cleaningAudit > 0
            ? `${hi} — ${m.cleaningAudit} case${m.cleaningAudit === 1 ? '' : 's'} in cleaning & audit.`
            : `${hi} — cleaning queue is clear.`,
        te:
          m.cleaningAudit > 0
            ? `${hiTe} — cleaning & audit lo ${m.cleaningAudit} cases unnayi.`
            : `${hiTe} — cleaning queue clear ga undi.`,
      };
    case 'restock':
      return {
        en:
          m.restockPending > 0
            ? `${hi} — ${m.restockPending} case${m.restockPending === 1 ? '' : 's'} waiting on restock.`
            : `${hi} — nothing stuck on restock.`,
        te:
          m.restockPending > 0
            ? `${hiTe} — restock kosam ${m.restockPending} cases wait avtunnayi.`
            : `${hiTe} — restock lo stuck cases levu.`,
      };
    case 'pool':
      return {
        en:
          m.fcfsPool > 0
            ? `${hi} — ${m.fcfsPool} in the FCFS pool for staff to pick up.`
            : `${hi} — FCFS pool is empty.`,
        te:
          m.fcfsPool > 0
            ? `${hiTe} — FCFS pool lo ${m.fcfsPool} cases unnayi.`
            : `${hiTe} — FCFS pool empty.`,
      };
    default: {
      const caseBit = `${m.todayCasesCount} today — ${m.todayOngoingCount} ongoing, ${m.todayCompletedCount} done${
        m.todayChargeableCount > 0 ? `, ${m.todayChargeableCount} in billing` : ''
      }${m.todayPendingApprovals > 0 ? `, ${m.todayPendingApprovals} need approval` : ''}.`;

      const staffBit =
        m.staffTotal > 0
          ? ` Staff: ${m.staffPresentIn} present (in), ${m.staffPunchedOut} out for the day, ${m.staffAbsent} absent${
              m.staffOnLeave > 0 ? `, ${m.staffOnLeave} on leave` : ''
            }.`
          : '';

      const en = `${hi} — Cases ${caseBit}${staffBit}`;
      const te = `${hiTe} — Eeroju ${m.todayCasesCount} cases — ${m.todayOngoingCount} ongoing, ${m.todayCompletedCount} complete${
        m.todayChargeableCount > 0 ? `, ${m.todayChargeableCount} billing lo` : ''
      }.${
        m.staffTotal > 0
          ? ` Staff: ${m.staffPresentIn} present, ${m.staffAbsent} absent${
              m.staffOnLeave > 0 ? `, ${m.staffOnLeave} leave` : ''
            }.`
          : ''
      }`;
      return { en, te };
    }
  }
}

export function formatHumanAdminBrief(m: AdminDashboardMetrics, focus: AdminBriefFocus = 'all'): string {
  const { en, te } = buildHumanAdminBrief(m, focus);
  return `• ${en}\n• ${te}`;
}

/** Keep export name for callers; always 2 bullets (EN + TE). */
export function formatDemoAdminSummary(m: AdminDashboardMetrics, focus: AdminBriefFocus = 'all'): string {
  return formatHumanAdminBrief(m, focus);
}

/** Gemini sometimes adds extra lines — keep first two bullets only. */
export function normalizeAdminSummaryTwoLines(raw: string): string {
  const bullets = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('•') || line.startsWith('-'))
    .slice(0, 2);
  if (bullets.length >= 2) {
    return bullets.map((line) => (line.startsWith('•') ? line : `• ${line.replace(/^-\s*/, '')}`)).join('\n');
  }
  const plain = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (plain.length === 0) return raw.trim();
  return plain.map((line) => (line.startsWith('•') ? line : `• ${line}`)).join('\n');
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
