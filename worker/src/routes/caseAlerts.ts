import type { Env } from '../env';
import { apiError, jsonResponse } from '../lib/http';
import type { RequestContext } from '../middleware/auth';
import { requireMappedEmployee } from '../middleware/api-auth';
import { AuthError } from '../middleware/authorization';
import {
  acknowledgeCaseAlertEscalation,
  processCaseAlertEscalations,
  startCaseAlertEscalation,
} from '../services/caseAlertEscalations';

type AlertEvent = 'assignment' | 'postpone';

function cronAuthorized(request: Request, env: Env): boolean {
  const secret = env.ALERT_CRON_SECRET?.trim();
  if (!secret) return env.ENVIRONMENT === 'development';
  return request.headers.get('x-cron-secret') === secret;
}

export async function handleCaseAlertsStart(
  request: Request,
  env: Env,
  auth: RequestContext,
): Promise<Response> {
  try {
    requireMappedEmployee(auth);
  } catch (e) {
    if (e instanceof AuthError) return apiError(e.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', e.message, e.status);
    throw e;
  }

  const body = (await request.json().catch(() => ({}))) as {
    event?: AlertEvent;
    caseId?: string;
    employeeId?: string;
  };
  if (!body.event || !body.caseId || !body.employeeId) {
    return apiError('BAD_REQUEST', 'event, caseId, and employeeId are required', 400);
  }
  if (body.event !== 'assignment' && body.event !== 'postpone') {
    return apiError('BAD_REQUEST', 'event must be assignment or postpone', 400);
  }

  const result = await startCaseAlertEscalation(env, body.event, body.caseId, body.employeeId);
  if (!result.ok) return apiError('INTERNAL', result.error ?? 'Failed to start alerts', 502);
  return jsonResponse({ ok: true, alertLevel: 1, telegram: result.skipped ? { skipped: true } : { sent: true } });
}

export async function handleCaseAlertsAcknowledge(
  request: Request,
  env: Env,
  auth: RequestContext,
): Promise<Response> {
  try {
    requireMappedEmployee(auth);
  } catch (e) {
    if (e instanceof AuthError) return apiError(e.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', e.message, e.status);
    throw e;
  }

  const body = (await request.json().catch(() => ({}))) as { caseId?: string; employeeId?: string };
  if (!body.caseId || !body.employeeId) {
    return apiError('BAD_REQUEST', 'caseId and employeeId are required', 400);
  }

  await acknowledgeCaseAlertEscalation(env, body.caseId, body.employeeId);
  return jsonResponse({ ok: true });
}

export async function handleCaseAlertsProcess(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return apiError('METHOD_NOT_ALLOWED', 'POST only', 405);
  }
  if (!cronAuthorized(request, env)) {
    return apiError('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const stats = await processCaseAlertEscalations(env);
  return jsonResponse({ ok: true, ...stats });
}
