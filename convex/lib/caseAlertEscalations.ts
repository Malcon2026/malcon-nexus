import type { ActionCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import {
  ALERT_2_DELAY_MS,
  buildTelegramAlertMessage,
  type AlertEvent,
} from './alertMessages';
import { telegramSendMessage } from './telegramApi';

type StageRow = {
  stage?: string;
  status?: string;
  assignedEmployee?: { id?: string } | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function parseHospitalName(snapshot: unknown): string {
  if (!snapshot) return 'Hospital';
  const raw = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot);
  try {
    const o = JSON.parse(raw) as { name?: string };
    return o.name?.trim() || 'Hospital';
  } catch {
    return 'Hospital';
  }
}

function employeeStillOwesStage(
  stagesJson: unknown,
  currentStage: string,
  employeeId: string,
  assignedEmployeeId: string | null,
): boolean {
  if (assignedEmployeeId && assignedEmployeeId !== employeeId) return false;

  let stages: StageRow[] = [];
  try {
    const raw =
      typeof stagesJson === 'string' ? stagesJson : stagesJson ? JSON.stringify(stagesJson) : '[]';
    stages = JSON.parse(raw) as StageRow[];
  } catch {
    return true;
  }

  const rec = stages.find((s) => s.stage === currentStage);
  if (!rec) return assignedEmployeeId === employeeId;

  const assigneeId = rec.assignedEmployee?.id ?? assignedEmployeeId;
  if (assigneeId && assigneeId !== employeeId) return false;

  const status = (rec.status ?? '').toLowerCase();
  if (status === 'submitted' || status === 'approved') return false;
  return true;
}

async function loadAlertContext(ctx: ActionCtx, caseId: string, employeeId: string) {
  const [caseRow, employee] = await Promise.all([
    ctx.runQuery(internal.dataQueries.getRow, { table: 'cases', legacyId: caseId }),
    ctx.runQuery(internal.dataQueries.getRow, { table: 'employees', legacyId: employeeId }),
  ]);
  if (!caseRow || !employee) return null;
  return {
    caseRow,
    employee,
    hospitalName: parseHospitalName(caseRow.hospital_snapshot),
  };
}

async function deliverAlert(
  ctx: ActionCtx,
  caseId: string,
  employeeId: string,
  event: AlertEvent,
  level: 1 | 2 | 3,
): Promise<{ ok: boolean; skipped?: boolean; reason?: string; error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) return { ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' };

  const alertCtx = await loadAlertContext(ctx, caseId, employeeId);
  if (!alertCtx) return { ok: false, error: 'Case or employee not found' };

  const chatId = String(alertCtx.employee.telegram_chat_id ?? '').trim();
  if (!chatId) return { ok: true, skipped: true, reason: 'employee_not_linked' };

  const text = buildTelegramAlertMessage(event, level, {
    caseNumber: String(alertCtx.caseRow.case_number ?? ''),
    hospitalName: alertCtx.hospitalName,
    currentStage: String(alertCtx.caseRow.current_stage ?? ''),
    surgeryDate: String(alertCtx.caseRow.surgery_date ?? 'TBD'),
    priority: String(alertCtx.caseRow.priority ?? ''),
    postponeReason: alertCtx.caseRow.postpone_reason
      ? String(alertCtx.caseRow.postpone_reason)
      : undefined,
    employeeName: String(alertCtx.employee.name ?? ''),
  });

  const sent = await telegramSendMessage(botToken, chatId, text, { parseMode: 'HTML' });
  if (!sent.ok) return { ok: false, error: sent.error ?? 'Telegram send failed' };
  return { ok: true };
}

function findEscalationRow(
  items: Record<string, unknown>[],
  caseId: string,
  employeeId: string,
  eventType: string,
): Record<string, unknown> | undefined {
  return items.find(
    (r) =>
      r.case_id === caseId && r.employee_id === employeeId && r.event_type === eventType,
  );
}

async function upsertEscalationStart(
  ctx: ActionCtx,
  event: AlertEvent,
  caseId: string,
  employeeId: string,
  now: string,
): Promise<void> {
  const { items } = await ctx.runQuery(internal.dataQueries.listRows, {
    table: 'case_alert_escalations',
  });
  const existing = findEscalationRow(items, caseId, employeeId, event);
  const patch = {
    case_id: caseId,
    employee_id: employeeId,
    event_type: event,
    alert_1_sent_at: now,
    alert_2_sent_at: null,
    alert_3_sent_at: null,
    acknowledged_at: null,
  };
  if (existing?.id) {
    await ctx.runMutation(internal.dataMutations.mergeTableRow, {
      table: 'case_alert_escalations',
      legacyId: String(existing.id),
      patch,
    });
    return;
  }
  await ctx.runMutation(internal.dataMutations.upsertTableRow, {
    table: 'case_alert_escalations',
    row: {
      id: crypto.randomUUID(),
      ...patch,
      created_at: now,
    },
  });
}

export async function startCaseAlertEscalation(
  ctx: ActionCtx,
  event: AlertEvent,
  caseId: string,
  employeeId: string,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const now = nowIso();
  await upsertEscalationStart(ctx, event, caseId, employeeId, now);

  const sent = await deliverAlert(ctx, caseId, employeeId, event, 1);
  if (!sent.ok && !sent.skipped) {
    return { ok: false, error: sent.error ?? 'Alert 1 failed' };
  }
  return { ok: true, skipped: sent.skipped };
}

export async function acknowledgeCaseAlertEscalation(
  ctx: ActionCtx,
  caseId: string,
  employeeId: string,
): Promise<void> {
  const { items } = await ctx.runQuery(internal.dataQueries.listRows, {
    table: 'case_alert_escalations',
  });
  const now = nowIso();
  for (const row of items) {
    if (
      row.case_id === caseId &&
      row.employee_id === employeeId &&
      !row.acknowledged_at
    ) {
      await ctx.runMutation(internal.dataMutations.mergeTableRow, {
        table: 'case_alert_escalations',
        legacyId: String(row.id),
        patch: { acknowledged_at: now },
      });
    }
  }
}

export async function processCaseAlertEscalations(ctx: ActionCtx): Promise<{
  checked: number;
  alert2Sent: number;
  autoAcknowledged: number;
}> {
  const { items } = await ctx.runQuery(internal.dataQueries.listRows, {
    table: 'case_alert_escalations',
  });
  const now = Date.now();

  const rows = items.filter((r) => !r.acknowledged_at && !r.alert_2_sent_at);

  let alert2Sent = 0;
  let autoAcknowledged = 0;

  for (const row of rows) {
    const event = row.event_type as AlertEvent;
    if (event !== 'assignment' && event !== 'postpone') continue;

    const caseId = String(row.case_id ?? '');
    const employeeId = String(row.employee_id ?? '');
    const rowId = String(row.id ?? '');

    const alertCtx = await loadAlertContext(ctx, caseId, employeeId);
    if (!alertCtx) {
      await ctx.runMutation(internal.dataMutations.mergeTableRow, {
        table: 'case_alert_escalations',
        legacyId: rowId,
        patch: { acknowledged_at: nowIso() },
      });
      autoAcknowledged++;
      continue;
    }

    const assignedId = alertCtx.caseRow.assigned_employee_id
      ? String(alertCtx.caseRow.assigned_employee_id)
      : null;

    if (
      alertCtx.caseRow.status === 'Completed' ||
      alertCtx.caseRow.status === 'Cancelled' ||
      !employeeStillOwesStage(
        alertCtx.caseRow.stages,
        String(alertCtx.caseRow.current_stage ?? ''),
        employeeId,
        assignedId,
      )
    ) {
      await ctx.runMutation(internal.dataMutations.mergeTableRow, {
        table: 'case_alert_escalations',
        legacyId: rowId,
        patch: { acknowledged_at: nowIso() },
      });
      autoAcknowledged++;
      continue;
    }

    const t1 = new Date(String(row.alert_1_sent_at)).getTime();
    if (now - t1 < ALERT_2_DELAY_MS) continue;

    const tg2 = await deliverAlert(ctx, caseId, employeeId, event, 2);
    if (tg2.ok) {
      const ts = nowIso();
      await ctx.runMutation(internal.dataMutations.mergeTableRow, {
        table: 'case_alert_escalations',
        legacyId: rowId,
        patch: { alert_2_sent_at: ts, alert_3_sent_at: ts },
      });
      alert2Sent++;
    }
  }

  return { checked: rows.length, alert2Sent, autoAcknowledged };
}
