import type { Env } from '../env';
import type { RequestContext } from '../middleware/auth';
import { apiError, jsonResponse } from '../lib/http';
import {
  loginWithPassword,
  requestLoginOtp,
  setEmployeePassword,
  verifyLoginOtp,
} from '../services/cloudflareAuth';
import { requireMappedEmployee } from '../middleware/api-auth';
import { AuthError } from '../middleware/authorization';
import { createDb } from '../db/client';
import { getEmployeeById } from '../services/employees';

export async function handleAuthMe(env: Env, auth: RequestContext): Promise<Response> {
  try {
    requireMappedEmployee(auth);
  } catch (e) {
    if (e instanceof AuthError) return apiError(e.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', e.message, e.status);
    throw e;
  }
  const db = createDb(env);
  const employee = await getEmployeeById(db, auth.employeeId!, true);
  if (!employee) return apiError('NOT_FOUND', 'Employee not found', 404);
  return jsonResponse({ employee });
}

export async function handleAuthLogin(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const result = await loginWithPassword(env, body.email ?? '', body.password ?? '');
  if ('error' in result) return apiError('UNAUTHORIZED', result.error, result.status);
  return jsonResponse({
    access_token: result.accessToken,
    token_type: 'bearer',
    expires_in: 60 * 60 * 8,
    employee: result.employee,
  });
}

export async function handleAuthRequestOtp(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { employeeCode?: string };
  const result = await requestLoginOtp(env, body.employeeCode ?? '');
  if ('error' in result) {
    const code = result.status === 429 ? 'BAD_REQUEST' : result.status >= 500 ? 'INTERNAL' : 'BAD_REQUEST';
    return apiError(code, result.error, result.status);
  }
  return jsonResponse({ ok: true, message: result.message });
}

export async function handleAuthVerifyOtp(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { employeeCode?: string; otp?: string };
  const result = await verifyLoginOtp(env, body.employeeCode ?? '', body.otp ?? '');
  if ('error' in result) {
    const code = result.status === 503 ? 'INTERNAL' : 'UNAUTHORIZED';
    return apiError(code, result.error, result.status);
  }
  return jsonResponse({
    access_token: result.accessToken,
    token_type: 'bearer',
    expires_in: 60 * 60 * 8,
    employee: result.employee,
  });
}

export async function handleAuthSetPassword(
  request: Request,
  env: Env,
  auth: RequestContext,
): Promise<Response> {
  try {
    requireMappedEmployee(auth);
    if (auth.role !== 'admin') {
      return apiError('FORBIDDEN', 'Admin only', 403);
    }
  } catch (e) {
    if (e instanceof AuthError) return apiError(e.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', e.message, e.status);
    throw e;
  }

  const body = (await request.json().catch(() => ({}))) as { employeeId?: string; password?: string };
  if (!body.employeeId) return apiError('BAD_REQUEST', 'employeeId is required', 400);
  const result = await setEmployeePassword(env, body.employeeId, body.password ?? '');
  if ('error' in result) return apiError('BAD_REQUEST', result.error, result.status);
  return jsonResponse({ ok: true });
}
