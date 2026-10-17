/**
 * Admin dashboard — "Needs attention" and "Pipeline today" read model.
 * Pure functions only: no React, no store access. Everything is derived from existing case data.
 */
import type { ImplantCase, Priority, StageRecord, WorkflowStage } from '../types';
import { normalizeDateKey } from './attendance';
import {
  VISIBLE_WORKFLOW_STAGES,
  findStageRecord,
  getCurrentStageAssignee,
  getStageIndex,
  isPostponedCase,
  isSelfPerformedAtCurrentStage,
  mapCaseToVisibleStage,
} from './caseWorkflow';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type UrgencyTier = 'critical' | 'overdue' | 'today' | 'soon' | 'upcoming';
export type AttentionScope = 'all' | 'overdue' | 'today' | 'week';
export type AttentionSort = 'urgency' | 'date' | 'priority';
export type StatusTone = 'neutral' | 'active' | 'warn' | 'alert' | 'done';

export interface OpsCaseRow {
  id: string;
  caseNumber: string;
  hospitalName: string;
  hospitalBranch: string;
  city: string;
  doctorName: string;
  stage: WorkflowStage;
  priority: Priority;
  surgeryDateKey: string;
  /** Negative = days overdue. `null` when the case has no surgery date. */
  daysFromToday: number | null;
  tier: UrgencyTier;
  overdue: boolean;
  postponed: boolean;
  ownerName: string | null;
  ownerFirstName: string | null;
  ownerPhone: string;
  hospitalPhone: string;
  selfPerformed: boolean;
  nextAction: string;
  status: { label: string; tone: StatusTone };
}

export interface AttentionSummary {
  overdue: number;
  today: number;
  week: number;
  pending: number;
}

export interface AttentionFilters {
  scope: AttentionScope;
  stage: WorkflowStage | 'all';
  priority: Priority | 'all';
  query: string;
}

export interface PipelineDay {
  dateKey: string;
  rows: OpsCaseRow[];
  counts: Record<string, number>;
  /** Stages where at least one case has no owner or was sent back for changes. */
  flagged: Record<string, boolean>;
}

/* -------------------------------------------------------------------------- */
/* Dates (YYYY-MM-DD keys, IST calendar days)                                 */
/* -------------------------------------------------------------------------- */

function keyToDay(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
}

export function dayDiff(dateKey: string, fromKey: string): number {
  return keyToDay(dateKey) - keyToDay(fromKey);
}

export function shiftDateKey(key: string, days: number): string {
  return new Date((keyToDay(key) + days) * 86_400_000).toISOString().slice(0, 10);
}

function keyToDate(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

/** "15 Oct 2026" */
export function formatSurgeryDate(key: string): string {
  if (!key) return 'No date';
  return keyToDate(key).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Today · Tomorrow · Yesterday · "Tue, 20 Oct" */
export function formatDayLabel(key: string, todayKey: string): string {
  const diff = dayDiff(key, todayKey);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return keyToDate(key).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function formatOverdue(days: number): string {
  const n = Math.abs(days);
  if (n <= 60) return `${n} ${n === 1 ? 'day' : 'days'} overdue`;
  return `${Math.floor(n / 30)} months overdue`;
}

export function formatUrgency(row: OpsCaseRow): string {
  const d = row.daysFromToday;
  if (d === null) return 'No surgery date';
  if (d < 0) return formatOverdue(d);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return `In ${d} days`;
}

/* -------------------------------------------------------------------------- */
/* Stage vocabulary                                                           */
/* -------------------------------------------------------------------------- */

export const STAGE_SHORT_LABEL: Partial<Record<WorkflowStage, string>> = {
  'Set Preparation': 'Prep',
  Delivery: 'Delivery',
  Surgery: 'Surgery',
  'Pickup from Hospital': 'Pickup',
  'Checking & Audit': 'Checking',
  Restock: 'Restock',
  Completed: 'Done',
};

export function stageShortLabel(stage: WorkflowStage): string {
  return STAGE_SHORT_LABEL[stage] ?? stage;
}

/** Stages shown in the pipeline strip, in workflow order. */
export const PIPELINE_STAGES: WorkflowStage[] = VISIBLE_WORKFLOW_STAGES;

/** Stages a pending case can currently be filtered by (everything but Completed). */
export const ATTENTION_STAGES: WorkflowStage[] = VISIBLE_WORKFLOW_STAGES.filter((s) => s !== 'Completed');

const STAGE_ACTION: Partial<Record<WorkflowStage, string>> = {
  'Set Preparation': 'Prepare and photograph set',
  Delivery: 'Deliver set to hospital',
  Surgery: 'Support surgery and submit',
  'Pickup from Hospital': 'Collect set from hospital',
  'Checking & Audit': 'Check and audit returned set',
  Restock: 'Restock kit',
  Completed: 'Closed',
};

const PRIORITY_RANK: Record<Priority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const TIER_RANK: Record<UrgencyTier, number> = { critical: 0, overdue: 1, today: 2, soon: 3, upcoming: 4 };

/* -------------------------------------------------------------------------- */
/* Row model                                                                  */
/* -------------------------------------------------------------------------- */

function isInReview(c: ImplantCase, rec: StageRecord | undefined): boolean {
  return c.status === 'Waiting For Approval' || rec?.status === 'Submitted';
}

function isSentBack(c: ImplantCase, rec: StageRecord | undefined): boolean {
  return (
    c.status === 'Changes Requested' ||
    c.status === 'Rejected' ||
    rec?.status === 'Changes Requested' ||
    rec?.status === 'Rejected'
  );
}

function resolveStatus(
  c: ImplantCase,
  rec: StageRecord | undefined,
  hasOwner: boolean,
  selfPerformed: boolean,
): { label: string; tone: StatusTone } {
  if (c.status === 'Completed') return { label: 'Completed', tone: 'done' };
  if (isSentBack(c, rec)) return { label: 'Changes requested', tone: 'alert' };
  if (isInReview(c, rec)) return { label: 'Awaiting approval', tone: 'warn' };
  if (rec?.status === 'In Progress') return { label: 'In progress', tone: 'active' };
  if (rec?.status === 'Approved') return { label: 'Stage approved', tone: 'done' };
  if (!hasOwner && !selfPerformed) return { label: 'Unassigned', tone: 'warn' };
  return { label: 'Assigned', tone: 'neutral' };
}

function resolveNextAction(
  c: ImplantCase,
  stage: WorkflowStage,
  rec: StageRecord | undefined,
  hasOwner: boolean,
  selfPerformed: boolean,
): string {
  if (isInReview(c, rec)) return 'Review submission';
  if (isSentBack(c, rec)) return 'Rework and resubmit';
  if (!hasOwner && !selfPerformed && stage !== 'Completed') return 'Assign an owner';
  if (isPostponedCase(c) && stage === 'Surgery') return 'Awaiting rescheduled surgery';
  return STAGE_ACTION[stage] ?? stage;
}

export function isPendingCase(c: ImplantCase): boolean {
  if (c.status === 'Completed' || c.status === 'Cancelled' || c.status === 'Draft') return false;
  return mapCaseToVisibleStage(c.currentStage) !== 'Completed';
}

export function buildOpsRow(c: ImplantCase, todayKey: string): OpsCaseRow {
  const stage = mapCaseToVisibleStage(c.currentStage);
  const surgeryDateKey = normalizeDateKey(c.surgeryDate);
  const daysFromToday = surgeryDateKey ? dayDiff(surgeryDateKey, todayKey) : null;
  const priority: Priority = c.priority && c.priority in PRIORITY_RANK ? c.priority : 'Medium';

  const rec = findStageRecord(c.stages, c.currentStage);
  const owner = getCurrentStageAssignee(c);
  const selfPerformed = isSelfPerformedAtCurrentStage(c);
  const hasOwner = Boolean(owner);

  const overdue = daysFromToday !== null && daysFromToday < 0;
  const preSurgery = getStageIndex(stage) <= getStageIndex('Surgery');

  let tier: UrgencyTier;
  if (overdue) tier = priority === 'Critical' || preSurgery ? 'critical' : 'overdue';
  else if (daysFromToday === 0) tier = 'today';
  else if (daysFromToday !== null && daysFromToday <= 7) tier = 'soon';
  else tier = 'upcoming';

  const ownerName = selfPerformed ? 'Self-performed' : (owner?.name ?? null);

  return {
    id: c.id,
    caseNumber: c.caseNumber,
    hospitalName: c.hospital?.name ?? 'Unknown hospital',
    hospitalBranch: (c.hospital?.branch ?? '').trim(),
    city: (c.hospital?.city ?? '').trim(),
    doctorName: c.doctor?.name ?? '',
    stage,
    priority,
    surgeryDateKey,
    daysFromToday,
    tier,
    overdue,
    postponed: isPostponedCase(c),
    ownerName,
    ownerFirstName: ownerName ? ownerName.split(' ')[0] : null,
    ownerPhone: selfPerformed ? '' : (owner?.phone ?? ''),
    hospitalPhone: c.hospital?.phone ?? '',
    selfPerformed,
    nextAction: resolveNextAction(c, stage, rec, hasOwner, selfPerformed),
    status: resolveStatus(c, rec, hasOwner, selfPerformed),
  };
}

export function buildPendingRows(cases: ImplantCase[], todayKey: string): OpsCaseRow[] {
  return cases.filter(isPendingCase).map((c) => buildOpsRow(c, todayKey));
}

/* -------------------------------------------------------------------------- */
/* Needs attention                                                            */
/* -------------------------------------------------------------------------- */

export function summarizeAttention(rows: OpsCaseRow[]): AttentionSummary {
  let overdue = 0;
  let today = 0;
  let week = 0;
  for (const r of rows) {
    if (r.overdue) overdue += 1;
    else if (r.tier === 'today') today += 1;
    else if (r.tier === 'soon') week += 1;
  }
  return { overdue, today, week, pending: rows.length };
}

export function filterAttentionRows(rows: OpsCaseRow[], f: AttentionFilters): OpsCaseRow[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.scope === 'overdue' && !r.overdue) return false;
    if (f.scope === 'today' && r.tier !== 'today') return false;
    if (f.scope === 'week' && r.tier !== 'soon') return false;
    if (f.stage !== 'all' && r.stage !== f.stage) return false;
    if (f.priority !== 'all' && r.priority !== f.priority) return false;
    if (!q) return true;
    const hay = [
      r.caseNumber,
      r.hospitalName,
      r.hospitalBranch,
      r.city,
      r.doctorName,
      r.ownerName ?? '',
      r.stage,
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

function dateValue(r: OpsCaseRow): number {
  return r.daysFromToday ?? Number.MAX_SAFE_INTEGER;
}

export function sortAttentionRows(rows: OpsCaseRow[], sort: AttentionSort): OpsCaseRow[] {
  const byDate = (a: OpsCaseRow, b: OpsCaseRow) => dateValue(a) - dateValue(b);
  const byPriority = (a: OpsCaseRow, b: OpsCaseRow) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  const byTier = (a: OpsCaseRow, b: OpsCaseRow) => TIER_RANK[a.tier] - TIER_RANK[b.tier];
  const byNumber = (a: OpsCaseRow, b: OpsCaseRow) => a.caseNumber.localeCompare(b.caseNumber);

  const compare =
    sort === 'date'
      ? (a: OpsCaseRow, b: OpsCaseRow) => byDate(a, b) || byPriority(a, b) || byNumber(a, b)
      : sort === 'priority'
        ? (a: OpsCaseRow, b: OpsCaseRow) => byPriority(a, b) || byDate(a, b) || byNumber(a, b)
        : (a: OpsCaseRow, b: OpsCaseRow) => byTier(a, b) || byPriority(a, b) || byDate(a, b) || byNumber(a, b);

  return [...rows].sort(compare);
}

/* -------------------------------------------------------------------------- */
/* Pipeline                                                                   */
/* -------------------------------------------------------------------------- */

export function buildPipelineDay(cases: ImplantCase[], dateKey: string, todayKey: string): PipelineDay {
  const rows = cases
    .filter(
      (c) =>
        c.status !== 'Draft' &&
        c.status !== 'Cancelled' &&
        normalizeDateKey(c.surgeryDate) === dateKey,
    )
    .map((c) => buildOpsRow(c, todayKey))
    .sort(
      (a, b) =>
        getStageIndex(a.stage) - getStageIndex(b.stage) ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        a.caseNumber.localeCompare(b.caseNumber),
    );

  const counts: Record<string, number> = {};
  const flagged: Record<string, boolean> = {};
  for (const stage of PIPELINE_STAGES) {
    counts[stage] = 0;
    flagged[stage] = false;
  }
  for (const r of rows) {
    counts[r.stage] = (counts[r.stage] ?? 0) + 1;
    if (r.status.tone === 'alert' || r.status.label === 'Unassigned') flagged[r.stage] = true;
  }
  return { dateKey, rows, counts, flagged };
}

/** Earliest pending case scheduled after `afterKey`. */
export function findNextUpcoming(pendingRows: OpsCaseRow[], afterKey: string): OpsCaseRow | null {
  let best: OpsCaseRow | null = null;
  for (const r of pendingRows) {
    if (!r.surgeryDateKey || r.surgeryDateKey <= afterKey) continue;
    if (
      !best ||
      r.surgeryDateKey < best.surgeryDateKey ||
      (r.surgeryDateKey === best.surgeryDateKey && PRIORITY_RANK[r.priority] < PRIORITY_RANK[best.priority])
    ) {
      best = r;
    }
  }
  return best;
}

/* -------------------------------------------------------------------------- */
/* Contact helpers                                                            */
/* -------------------------------------------------------------------------- */

export function dialableNumber(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

/** wa.me wants digits only with country code; bare 10-digit numbers are Indian mobiles. */
export function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}
