import { USE_AWS_BACKEND } from './cloudflareConfig';

/**
 * Gate for admin force-advance.
 * - AWS production: admin JWT + role only (no client-side secret in the bundle).
 * - Other builds: optional VITE_FORCE_ADVANCE_PASSWORD at build time.
 */
export function assertForceAdvancePassword(password: string): void {
  if (import.meta.env.PROD && USE_AWS_BACKEND) {
    if (!password.trim()) {
      throw new Error('Enter your admin confirmation to force advance.');
    }
    return;
  }

  const expected = (import.meta.env.VITE_FORCE_ADVANCE_PASSWORD as string | undefined)?.trim() ?? '';
  if (!expected) {
    throw new Error('Force advance is not configured (missing VITE_FORCE_ADVANCE_PASSWORD).');
  }
  const given = password.trim();
  if (!given || given !== expected) {
    throw new Error('Incorrect force advance password.');
  }
}
