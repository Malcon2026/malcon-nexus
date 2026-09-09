export type AlertEvent = 'assignment' | 'postpone';
export type AlertLevel = 1 | 2 | 3;

export type CaseAlertContext = {
  caseNumber: string;
  hospitalName: string;
  currentStage: string;
  surgeryDate: string;
  priority: string;
  postponeReason?: string;
};

function assignmentLines(ctx: CaseAlertContext): string[] {
  return [
    `<b>Case:</b> ${ctx.caseNumber}`,
    `<b>Hospital:</b> ${ctx.hospitalName}`,
    `<b>Stage:</b> ${ctx.currentStage}`,
    `<b>Surgery:</b> ${ctx.surgeryDate}`,
    `<b>Priority:</b> ${ctx.priority}`,
  ];
}

function postponeLines(ctx: CaseAlertContext): string[] {
  const lines = [
    `<b>Case:</b> ${ctx.caseNumber}`,
    `<b>Hospital:</b> ${ctx.hospitalName}`,
    `<b>New surgery date:</b> ${ctx.surgeryDate}`,
    `<b>Kit stays at:</b> ${ctx.currentStage}`,
  ];
  if (ctx.postponeReason?.trim()) {
    lines.push(`<b>Reason:</b> ${ctx.postponeReason.trim()}`);
  }
  return lines;
}

/** Telegram HTML (parse_mode HTML). */
export function buildTelegramAlertMessage(
  event: AlertEvent,
  level: AlertLevel,
  ctx: CaseAlertContext,
): string {
  const detailLines = event === 'assignment' ? assignmentLines(ctx) : postponeLines(ctx);

  if (level === 1) {
    const headline =
      event === 'assignment'
        ? '🚨🔔 <b>ALERT 1 — NEW CASE ASSIGNED</b>'
        : '🚨🔔 <b>ALERT 1 — CASE POSTPONED</b>';
    return [
      headline,
      '',
      ...detailLines,
      '',
      '<b>Action required:</b> Open Malcon Nexus now.',
    ].join('\n');
  }

  if (level === 3) {
    const headline =
      event === 'assignment'
        ? '🛑🚨 <b>ALERT 3 — FINAL REMINDER</b>'
        : '🛑🚨 <b>ALERT 3 — FINAL POSTPONE REMINDER</b>';
    return [
      headline,
      '',
      '<b>⏱ 30 minutes since first alert.</b>',
      '',
      ...detailLines,
      '',
      '<b>Please respond now.</b> No further alerts will be sent for this case.',
    ].join('\n');
  }

  return '';
}

/** Web Push title + body (plain text with emojis). */
export function buildPushAlertMessage(
  event: AlertEvent,
  level: AlertLevel,
  ctx: CaseAlertContext,
): { title: string; body: string } {
  if (level !== 2) {
    throw new Error('Push alerts are only used for Alert 2');
  }

  const title =
    event === 'assignment'
      ? '🚨⚠️ ALERT 2 — REMINDER'
      : '🚨⚠️ ALERT 2 — POSTPONE REMINDER';

  const body =
    event === 'assignment'
      ? `${ctx.caseNumber} · ${ctx.hospitalName} · ${ctx.currentStage} · Still waiting — open Malcon Nexus (15 min since Alert 1)`
      : `${ctx.caseNumber} → ${ctx.surgeryDate} · Postpone still pending — open Malcon Nexus (15 min since Alert 1)`;

  return { title, body };
}
