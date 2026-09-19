export function normalizeEmployeeCode(raw: string): string {
  return raw.trim().replace(/^0+/, '') || '0';
}

export function employeeCodeMatches(stored: string | null | undefined, input: string): boolean {
  const code = String(stored ?? '').trim();
  if (!code) return false;
  const arg = input.trim();
  return normalizeEmployeeCode(code) === normalizeEmployeeCode(arg) || code === arg;
}

export async function hashLoginOtp(
  employeeId: string,
  otp: string,
  pepper: string,
): Promise<string> {
  const data = new TextEncoder().encode(`${employeeId}:${otp}:${pepper}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomSixDigitOtp(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, '0');
}
