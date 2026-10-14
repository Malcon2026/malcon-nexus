import { apiError } from '../lib/http';
import { publicWriteErrorMessage } from '../lib/dbWriteErrors';
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
  const message = publicWriteErrorMessage(e);
  if (/already exists/i.test(message)) {
    return apiError('CONFLICT', message, 409);
  }
  if (/missing|invalid|already has|required/i.test(message)) {
    return apiError('BAD_REQUEST', message, 400);
  }
  return apiError('INTERNAL', message, 500);
}
