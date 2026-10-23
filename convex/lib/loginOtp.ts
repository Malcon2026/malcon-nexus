/** Strip UI prefixes (e.g. "# 0143") and whitespace from employee codes. */
export function sanitizeEmployeeCodeInput(raw: string): string {
  return raw.trim().replace(/^#+\s*/, '').trim();
}

/** Parse `/start CODE` including `/start@BotName CODE` from Telegram clients. */
export function parseTelegramStartArg(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+(.*))?$/i);
  if (!m) return '';
  return sanitizeEmployeeCodeInput(m[1] ?? '');
}

export function normalizeEmployeeCode(raw: string): string {
  const cleaned = sanitizeEmployeeCodeInput(raw);
  return cleaned.replace(/^0+/, '') || '0';
}

export function employeeCodeMatches(stored: string | null | undefined, input: string): boolean {
  const code = sanitizeEmployeeCodeInput(String(stored ?? ''));
  if (!code) return false;
  const arg = sanitizeEmployeeCodeInput(input);
  return normalizeEmployeeCode(code) === normalizeEmployeeCode(arg) || code === arg;
}
