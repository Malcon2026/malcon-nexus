import { AuthError } from '../middleware/authorization';

/** Never expose Drizzle/SQLite query dumps to API clients. */
export function publicWriteErrorMessage(e: unknown): string {
  if (e instanceof AuthError) return e.message;
  const raw = e instanceof Error ? e.message : String(e);
  if (/failed query|insert into|update |delete from|params:/i.test(raw)) {
    if (/unique|constraint|SQLITE_CONSTRAINT/i.test(raw)) {
      return 'An employee with this email or employee ID already exists.';
    }
    return 'Could not save changes. Please try again.';
  }
  if (/missing|invalid|already has|already exists|required/i.test(raw)) {
    return raw;
  }
  return 'Could not save changes. Please try again.';
}
