/** Gate for admin force-advance — set at build time via VITE_FORCE_ADVANCE_PASSWORD. */
export function assertForceAdvancePassword(password: string): void {
  const expected = (import.meta.env.VITE_FORCE_ADVANCE_PASSWORD as string | undefined)?.trim() ?? '';
  if (!expected) {
    throw new Error('Force advance is not configured (missing VITE_FORCE_ADVANCE_PASSWORD).');
  }
  const given = password.trim();
  if (!given || given !== expected) {
    throw new Error('Incorrect force advance password.');
  }
}
