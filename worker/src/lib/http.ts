import type { Env } from '../env';

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL';

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function apiData<T>(data: T, status = 200): Response {
  return jsonResponse({ data }, status);
}

export function apiError(code: ApiErrorCode, message: string, status: number): Response {
  return jsonResponse({ error: { code, message } }, status);
}

export function withCors(response: Response, env: Env): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', env.API_CORS_ORIGIN);
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, X-Malcon-Dev-Identity',
  );
  return new Response(response.body, { status: response.status, headers });
}

export function isUuidLike(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** Primary keys from production UUIDs or local seed ids (e.g. surgical kit prefix). */
export function isEntityId(id: string): boolean {
  if (!id || id.length > 64) return false;
  if (isUuidLike(id)) return true;
  return /^[0-9a-z]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
