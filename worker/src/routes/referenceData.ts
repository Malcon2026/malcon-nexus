import type { Env } from '../env';
import { createDb } from '../db/client';
import { apiData, apiError } from '../lib/http';
import { pageMeta, parsePagination } from '../lib/pagination';
import type { RequestContext } from '../middleware/auth';
import {
  countDoctors,
  countHospitals,
  listAppSettings,
  listDepartments,
  listDoctors,
  listHospitals,
  listSurgicalKits,
} from '../services/referenceData';

export async function handleListHospitals(request: Request, env: Env, _ctx: RequestContext): Promise<Response> {
  const url = new URL(request.url);
  const parsed = parsePagination(url);
  if ('error' in parsed) return apiError('BAD_REQUEST', parsed.error, 400);
  const db = createDb(env);
  const total = await countHospitals(db);
  const items = await listHospitals(db, parsed.offset, parsed.limit);
  return apiData({ items, pagination: pageMeta(parsed.page, parsed.pageSize, total) });
}

export async function handleListDoctors(request: Request, env: Env, _ctx: RequestContext): Promise<Response> {
  const url = new URL(request.url);
  const parsed = parsePagination(url);
  if ('error' in parsed) return apiError('BAD_REQUEST', parsed.error, 400);
  const db = createDb(env);
  const total = await countDoctors(db);
  const items = await listDoctors(db, parsed.offset, parsed.limit);
  return apiData({ items, pagination: pageMeta(parsed.page, parsed.pageSize, total) });
}

export async function handleListDepartments(_request: Request, env: Env, _ctx: RequestContext): Promise<Response> {
  const db = createDb(env);
  return apiData(await listDepartments(db));
}

export async function handleListSurgicalKits(_request: Request, env: Env, _ctx: RequestContext): Promise<Response> {
  const db = createDb(env);
  return apiData(await listSurgicalKits(db));
}

export async function handleListAppSettings(_request: Request, env: Env, _ctx: RequestContext): Promise<Response> {
  const db = createDb(env);
  return apiData(await listAppSettings(db));
}
