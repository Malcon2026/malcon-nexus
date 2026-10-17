export type AlertEvent = 'assignment' | 'postpone';
export type AlertLevel = 1 | 2 | 3;

export type CaseAlertContext = {
  caseNumber: string;
  hospitalName: string;
  currentStage: string;
  surgeryDate: string;
  priority: string;
  postponeReason?: string;
  employeeName: string;
};

/** Time after Alert 1 before sending the task-completion reminder (Alert 2). */
export const ALERT_2_DELAY_MS = 3 * 60 * 60 * 1000;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function greetingFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return 'there';
  return escapeHtml(trimmed.split(/\s+/)[0] ?? trimmed);
}

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

export function buildTelegramAlertMessage(
  event: AlertEvent,
  level: AlertLevel,
  ctx: CaseAlertContext,
): string {
  const name = greetingFirstName(ctx.employeeName);
  const detailLines = event === 'assignment' ? assignmentLines(ctx) : postponeLines(ctx);

  if (level === 1) {
    const headline =
      event === 'assignment'
        ? '🚨🔔 <b>ALERT 1 — NEW CASE ASSIGNED</b>'
        : '🚨🔔 <b>ALERT 1 — CASE POSTPONED</b>';
    const intro =
      event === 'assignment'
        ? `Dear <b>${name}</b>, you have a new case assigned:`
        : `Dear <b>${name}</b>, a case assigned to you has been postponed:`;
    return [
      headline,
      '',
      intro,
      '',
      ...detailLines,
      '',
      '<b>Action required:</b> Open Malcon Nexus and complete your stage within 3 hours.',
    ].join('\n');
  }

  if (level === 2) {
    const headline =
      event === 'assignment'
        ? '⚠️📢 <b>REMINDER — TASK OVERDUE</b>'
        : '⚠️📢 <b>REMINDER — POSTPONED CASE</b>';
    const intro =
      event === 'assignment'
        ? `Dear <b>${name}</b>, you have not completed your assigned task yet:`
        : `Dear <b>${name}</b>, please follow up on this postponed case:`;
    return [
      headline,
      '',
      intro,
      '',
      '<b>⏱ 3 hours since assignment.</b>',
      '',
      ...detailLines,
      '',
      '<b>Please complete your stage in the app now.</b> No further reminders after this.',
    ].join('\n');
  }

  const headline =
    event === 'assignment'
      ? '🛑🚨 <b>FINAL REMINDER</b>'
      : '🛑🚨 <b>FINAL POSTPONE REMINDER</b>';
  return [
    headline,
    '',
    `Dear <b>${name}</b>, please respond now:`,
    '',
    ...detailLines,
  ].join('\n');
}
