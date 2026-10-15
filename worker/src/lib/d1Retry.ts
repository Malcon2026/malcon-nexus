import { DrizzleQueryError } from 'drizzle-orm/errors';

function errorText(e: unknown): string {
  if (e instanceof DrizzleQueryError) {
    const cause = e.cause instanceof Error ? e.cause.message : String(e.cause ?? '');
    return `${e.message}\n${cause}`;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Transient Cloudflare D1 / SQLite failures (busy, limits, timeouts). */
export function isRetriableD1Error(e: unknown): boolean {
  const msg = errorText(e);
  return /busy|locked|timeout|D1_ERROR|too many|rate|limit|overloaded|temporarily unavailable/i.test(msg);
}

export async function withD1Retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i === attempts - 1 || !isRetriableD1Error(e)) throw e;
      await new Promise((r) => setTimeout(r, 40 * (i + 1)));
    }
  }
  throw last;
}
