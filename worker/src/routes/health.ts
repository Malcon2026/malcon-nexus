import { sql } from 'drizzle-orm';
import type { Env } from '../env';
import { createDb, usesPostgres } from '../db/client';
import { employees as sqliteEmployees } from '../db/schema';
import { employees as pgEmployees } from '../db/schema.pg';
import { apiData, jsonResponse } from '../lib/http';

export async function handleHealth(_request: Request, env: Env): Promise<Response> {
  const service = usesPostgres(env) ? 'malcon-nexus-aws-api' : 'malcon-nexus-worker';
  return jsonResponse({ ok: true, service });
}

export async function handleHealthDb(request: Request, env: Env): Promise<Response> {
  const allowProdDbHealth = usesPostgres(env);
  if (env.ENVIRONMENT !== 'development' && !allowProdDbHealth && new URL(request.url).pathname === '/health/db') {
    return jsonResponse({ ok: false, error: 'Not available' }, 404);
  }
  try {
    const db = createDb(env);
    const employees = usesPostgres(env) ? pgEmployees : sqliteEmployees;
    const rows = await db.select({ c: sql<number>`cast(count(*) as integer)` }).from(employees);
    return jsonResponse({
      ok: true,
      database: true,
      employees: rows[0]?.c ?? 0,
    });
  } catch (e) {
    return jsonResponse(
      { ok: false, database: false, error: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
}
