import { and, eq, isNull } from 'drizzle-orm';
import type { Env } from '../env';
import type { Db } from '../db/client';
import { createDb } from '../db/client';
import { caseAlertEscalations, cases, employees } from '../db/schema';
import { ALERT_2_DELAY_MS, buildTelegramAlertMessage, type AlertEvent } from '../lib/alertMessages';
import { telegramSendMessage } from '../lib/telegramApi';

type StageRow = {
  stage?: string;
  status?: string;
  assignedEmployee?: { id?: string } | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function parseHospitalName(snapshot: string | null): string {
  if (!snapshot) return 'Hospital';
  try {
    const o = JSON.parse(snapshot) as { name?: string };
    return o.name?.trim() || 'Hospital';
  } catch {
    return 'Hospital';
  }
}

function employeeStillOwesStage(
  stagesJson: string | null,
  currentStage: string,
  employeeId: string,
  assignedEmployeeId: string | null,
): boolean {
  if (assignedEmployeeId && assignedEmployeeId !== employeeId) return false;

  let stages: StageRow[] = [];
  try {
    stages = JSON.parse(stagesJson ?? '[]') as StageRow[];
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

async function loadAlertContext(db: Db, caseId: string, employeeId: string) {
  const [caseRows, empRows] = await Promise.all([
    db
      .select({
        caseNumber: cases.caseNumber,
        currentStage: cases.currentStage,
        hospitalSnapshot: cases.hospitalSnapshot,
        surgeryDate: cases.surgeryDate,
        priority: cases.priority,
        postponeReason: cases.postponeReason,
        stagesJson: cases.stages,
        assignedEmployeeId: cases.assignedEmployeeId,
        status: cases.status,
      })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1),
    db
      .select({ name: employees.name, telegramChatId: employees.telegramChatId })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1),
  ]);

  const caseRow = caseRows[0];
  const employee = empRows[0];
  if (!caseRow || !employee) return null;

  return {
    caseRow,
    employee,
    hospitalName: parseHospitalName(caseRow.hospitalSnapshot),
  };
}

async function deliverAlert(
  env: Env,
  db: Db,
  caseId: string,
  employeeId: string,
  event: AlertEvent,
  level: 1 | 2 | 3,
): Promise<{ ok: boolean; skipped?: boolean; reason?: string; error?: string }> {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' };

  const ctx = await loadAlertContext(db, caseId, employeeId);
  if (!ctx) return { ok: false, error: 'Case or employee not found' };

  const chatId = ctx.employee.telegramChatId?.trim();
  if (!chatId) return { ok: true, skipped: true, reason: 'employee_not_linked' };

  const text = buildTelegramAlertMessage(event, level, {
    caseNumber: ctx.caseRow.caseNumber,
    hospitalName: ctx.hospitalName,
    currentStage: ctx.caseRow.currentStage,
    surgeryDate: ctx.caseRow.surgeryDate ?? 'TBD',
    priority: ctx.caseRow.priority,
    postponeReason: ctx.caseRow.postponeReason ?? undefined,
    employeeName: ctx.employee.name,
  });

  const sent = await telegramSendMessage(botToken, chatId, text, { parseMode: 'HTML' });
  if (!sent.ok) return { ok: false, error: sent.error ?? 'Telegram send failed' };
  return { ok: true };
}

export async function startCaseAlertEscalation(
  env: Env,
  event: AlertEvent,
  caseId: string,
  employeeId: string,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const db = createDb(env);
  const now = nowIso();
  const id = crypto.randomUUID();

  await db
    .insert(caseAlertEscalations)
    .values({
      id,
      caseId,
      employeeId,
      eventType: event,
      alert1SentAt: now,
      alert2SentAt: null,
      alert3SentAt: null,
      acknowledgedAt: null,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [caseAlertEscalations.caseId, caseAlertEscalations.employeeId, caseAlertEscalations.eventType],
      set: {
        alert1SentAt: now,
        alert2SentAt: null,
        alert3SentAt: null,
        acknowledgedAt: null,
      },
    });

  const sent = await deliverAlert(env, db, caseId, employeeId, event, 1);
  if (!sent.ok && !sent.skipped) {
    return { ok: false, error: sent.error ?? 'Alert 1 failed' };
  }
  return { ok: true, skipped: sent.skipped };
}

export async function acknowledgeCaseAlertEscalation(
  env: Env,
  caseId: string,
  employeeId: string,
): Promise<void> {
  const db = createDb(env);
  await db
    .update(caseAlertEscalations)
    .set({ acknowledgedAt: nowIso() })
    .where(
      and(
        eq(caseAlertEscalations.caseId, caseId),
        eq(caseAlertEscalations.employeeId, employeeId),
        isNull(caseAlertEscalations.acknowledgedAt),
      ),
    );
}

export async function processCaseAlertEscalations(env: Env): Promise<{
  checked: number;
  alert2Sent: number;
  autoAcknowledged: number;
}> {
  const db = createDb(env);
  const now = Date.now();

  const rows = await db
    .select()
    .from(caseAlertEscalations)
    .where(and(isNull(caseAlertEscalations.acknowledgedAt), isNull(caseAlertEscalations.alert2SentAt)));

  let alert2Sent = 0;
  let autoAcknowledged = 0;

  for (const row of rows) {
    const event = row.eventType as AlertEvent;
    if (event !== 'assignment' && event !== 'postpone') continue;

    const ctx = await loadAlertContext(db, row.caseId, row.employeeId);
    if (!ctx) {
      await db
        .update(caseAlertEscalations)
        .set({ acknowledgedAt: nowIso() })
        .where(eq(caseAlertEscalations.id, row.id));
      autoAcknowledged++;
      continue;
    }

    if (
      ctx.caseRow.status === 'Completed' ||
      ctx.caseRow.status === 'Cancelled' ||
      !employeeStillOwesStage(
        ctx.caseRow.stagesJson,
        ctx.caseRow.currentStage,
        row.employeeId,
        ctx.caseRow.assignedEmployeeId,
      )
    ) {
      await db
        .update(caseAlertEscalations)
        .set({ acknowledgedAt: nowIso() })
        .where(eq(caseAlertEscalations.id, row.id));
      autoAcknowledged++;
      continue;
    }

    const t1 = new Date(row.alert1SentAt).getTime();
    if (now - t1 < ALERT_2_DELAY_MS) continue;

    const tg2 = await deliverAlert(env, db, row.caseId, row.employeeId, event, 2);
    if (tg2.ok) {
      await db
        .update(caseAlertEscalations)
        .set({ alert2SentAt: nowIso(), alert3SentAt: nowIso() })
        .where(eq(caseAlertEscalations.id, row.id));
      alert2Sent++;
    }
  }

  return { checked: rows.length, alert2Sent, autoAcknowledged };
}
