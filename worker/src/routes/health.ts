import type { Env } from '../env';
import { apiData, jsonResponse } from '../lib/http';

export async function handleHealth(_request: Request, _env: Env): Promise<Response> {
  return jsonResponse({ ok: true, service: 'malcon-nexus-worker' });
}

export async function handleHealthDb(request: Request, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== 'development' && new URL(request.url).pathname === '/health/db') {
    return jsonResponse({ ok: false, error: 'Not available' }, 404);
  }
  try {
    const row = await env.DB.prepare('SELECT COUNT(*) AS c FROM employees').first<{ c: number }>();
    return jsonResponse({
      ok: true,
      database: true,
      employees: row?.c ?? 0,
    });
  } catch (e) {
    return jsonResponse(
      { ok: false, database: false, error: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
}
