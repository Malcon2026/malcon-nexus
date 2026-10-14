/** Strip UI prefixes (e.g. "# 0143") and whitespace from employee codes. */
export function sanitizeEmployeeCodeInput(raw: string): string {
  return raw.trim().replace(/^#+\s*/, '').trim();
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

export async function hashLoginOtp(employeeId: string, otp: string, pepper: string): Promise<string> {
  const data = new TextEncoder().encode(`${employeeId}:${otp}:${pepper}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomSixDigitOtp(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, '0');
}
