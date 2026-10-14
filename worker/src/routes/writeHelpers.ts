import { apiError } from '../lib/http';
import { AuthError } from '../middleware/authorization';

export async function readJson<T>(request: Request): Promise<T | Response> {
  try {
    return (await request.json()) as T;
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON body', 400);
  }
}

export function mapWriteError(e: unknown): Response {
  if (e instanceof AuthError) {
    const code =
      e.status === 401
        ? 'UNAUTHORIZED'
        : e.status === 404
          ? 'NOT_FOUND'
          : e.status === 409
            ? 'CONFLICT'
            : e.status === 400
              ? 'BAD_REQUEST'
              : 'FORBIDDEN';
    return apiError(code, e.message, e.status);
  }
  const message = e instanceof Error ? e.message : String(e);
  if (/missing|invalid|already has|already exists|required/i.test(message)) {
    return apiError('BAD_REQUEST', message, 400);
  }
  return apiError('INTERNAL', message, 500);
}
