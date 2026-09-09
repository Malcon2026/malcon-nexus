export type AlertEvent = 'assignment' | 'postpone';
export type AlertLevel = 1 | 2 | 3;

export type CaseDetails = {
  caseNumber: string;
  hospitalName: string;
  currentStage: string;
  surgeryDate: string;
  priority: string;
  postponeReason?: string;
};

export type CaseAlertContext = CaseDetails & {
  employeeName: string;
};

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

/** Telegram HTML (parse_mode HTML). */
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
      '<b>Action required:</b> Tap the button below to open the app.',
    ].join('\n');
  }

  if (level === 2) {
    const headline =
      event === 'assignment'
        ? '⚠️📢 <b>ALERT 2 — REMINDER</b>'
        : '⚠️📢 <b>ALERT 2 — POSTPONE REMINDER</b>';
    const intro =
      event === 'assignment'
        ? `Dear <b>${name}</b>, this is a reminder — your case is still waiting:`
        : `Dear <b>${name}</b>, this is a reminder — please note the postponed case:`;
    return [
      headline,
      '',
      intro,
      '',
      '<b>⏱ 15 minutes since Alert 1.</b>',
      '',
      ...detailLines,
      '',
      '<b>Still waiting for your response.</b> Tap the button below.',
    ].join('\n');
  }

  const headline =
    event === 'assignment'
      ? '🛑🚨 <b>ALERT 3 — FINAL REMINDER</b>'
      : '🛑🚨 <b>ALERT 3 — FINAL POSTPONE REMINDER</b>';
  const intro =
    event === 'assignment'
      ? `Dear <b>${name}</b>, final reminder — please respond to this case now:`
      : `Dear <b>${name}</b>, final reminder — please acknowledge this postponed case:`;
  return [
    headline,
    '',
    intro,
    '',
    '<b>⏱ 30 minutes since Alert 1.</b>',
    '',
    ...detailLines,
    '',
    '<b>Please respond now.</b> Tap the button below. No further alerts will be sent for this case.',
  ].join('\n');
}
