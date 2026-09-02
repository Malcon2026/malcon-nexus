/** Extract a user-facing message from any thrown/rejected value (Supabase, fetch, etc.). */
export function formatUnknownError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) return record.message;
    if (typeof record.error === 'string' && record.error.trim()) return record.error;
    if (typeof record.error_description === 'string' && record.error_description.trim()) {
      return record.error_description;
    }
  }
  return fallback;
}
