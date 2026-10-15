import { AuthError } from '../middleware/authorization';

/** Never expose Drizzle/SQLite query dumps to API clients. */
export function publicWriteErrorMessage(e: unknown): string {
  if (e instanceof AuthError) return e.message;
  const raw = e instanceof Error ? e.message : String(e);
  if (/daily row write limit|free tier daily row write|exceeded D1'?s free tier/i.test(raw)) {
    return 'Server database write limit reached. Try again after midnight UTC or ask admin to upgrade Cloudflare D1.';
  }
  if (/failed query|insert into|update |delete from|params:/i.test(raw)) {
    if (/unique|constraint|SQLITE_CONSTRAINT/i.test(raw)) {
      return 'An employee with this email or employee ID already exists.';
    }
    return 'Could not complete this action (database busy). Please try again shortly.';
  }
  if (/missing|invalid|already has|already exists|required/i.test(raw)) {
    return raw;
  }
  return 'Could not save changes. Please try again.';
}
