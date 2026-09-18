import type { ImplantCase } from '../types';
import { countFcfsPoolCases, mapCaseToVisibleStage } from './caseWorkflow';
import { normalizeWorkflowStage } from '../utils/helpers';
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
  source: 'gemini' | 'demo';
  generatedAt: string;
};

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

export async function fetchAdminDashboardInsight(metrics: AdminDashboardMetrics): Promise<DashboardInsightResult> {
  const generatedAt = new Date().toISOString();
  const { data, error } = await supabase.functions.invoke('dashboard-insights', {
    body: { metrics },
  });

  if (error) {
    return { summary: formatDemoAdminSummary(metrics), source: 'demo', generatedAt };
  }

  const summary = typeof data?.summary === 'string' ? data.summary.trim() : '';
  if (!summary) {
    return { summary: formatDemoAdminSummary(metrics), source: 'demo', generatedAt };
  }

  return {
    summary,
    source: data?.source === 'gemini' ? 'gemini' : 'demo',
    generatedAt: typeof data?.generatedAt === 'string' ? data.generatedAt : generatedAt,
  };
}
