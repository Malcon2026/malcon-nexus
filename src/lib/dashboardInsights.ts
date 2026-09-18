import type { ImplantCase } from '../types';
import { countFcfsPoolCases, mapCaseToVisibleStage } from './caseWorkflow';
import { normalizeWorkflowStage } from '../utils/helpers';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

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

export async function fetchAdminDashboardInsight(
  metrics: AdminDashboardMetrics,
  options?: { refresh?: boolean },
): Promise<DashboardInsightResult> {
  const generatedAt = new Date().toISOString();
  const { data, error } = await supabase.functions.invoke('dashboard-insights', {
    body: { metrics, refresh: options?.refresh === true },
  });

  if (error) {
    const errorDetail = shortenApiError(await readInvokeError(error));
    return {
      summary: formatDemoAdminSummary(metrics),
      source: 'demo',
      generatedAt,
      errorDetail,
    };
  }

  if (data && typeof data === 'object' && 'error' in data) {
    const apiError = String((data as { error: string }).error);
    const code = (data as { code?: string }).code;
    return {
      summary: formatDemoAdminSummary(metrics),
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
      summary: formatDemoAdminSummary(metrics),
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
