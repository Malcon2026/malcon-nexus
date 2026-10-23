import type { ActionCtx } from '../_generated/server';
import { authenticateRequest } from './authContext';
import {
  acknowledgeCaseAlertEscalation,
  processCaseAlertEscalations,
  startCaseAlertEscalation,
} from './caseAlertEscalations';
import { requireAdminOrStoreManager, requireMappedEmployee } from './httpAuthHelpers';
import { apiError, isUuidLike, jsonResponse } from './httpUtil';

type AlertEvent = 'assignment' | 'postpone';

function cronAuthorized(request: Request): boolean {
  const secret = process.env.ALERT_CRON_SECRET?.trim();
  if (!secret) return process.env.ALLOW_INSECURE_ALERT_CRON === '1';
  return request.headers.get('x-cron-secret') === secret;
}

export async function handleCaseAlertsStart(ctx: ActionCtx, request: Request): Promise<Response> {
  const auth = await authenticateRequest(ctx, request);
  let denied = requireMappedEmployee(auth);
  if (denied) return denied;
  denied = requireAdminOrStoreManager(auth);
  if (denied) return denied;

  let body: { event?: AlertEvent; caseId?: string; employeeId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON body', 400);
  }

  if (!body.event || !body.caseId || !body.employeeId) {
    return apiError('BAD_REQUEST', 'event, caseId, and employeeId are required', 400);
  }
  if (body.event !== 'assignment' && body.event !== 'postpone') {
    return apiError('BAD_REQUEST', 'event must be assignment or postpone', 400);
  }
  if (!isUuidLike(body.caseId) || !isUuidLike(body.employeeId)) {
    return apiError('BAD_REQUEST', 'Invalid caseId or employeeId', 400);
  }

  const result = await startCaseAlertEscalation(ctx, body.event, body.caseId, body.employeeId);
  if (!result.ok) return apiError('INTERNAL', result.error ?? 'Failed to start alerts', 502);
  return jsonResponse({
    ok: true,
    alertLevel: 1,
    telegram: result.skipped ? { skipped: true } : { sent: true },
  });
}

export async function handleCaseAlertsAcknowledge(
  ctx: ActionCtx,
  request: Request,
): Promise<Response> {
  const auth = await authenticateRequest(ctx, request);
  const denied = requireMappedEmployee(auth);
  if (denied) return denied;

  let body: { caseId?: string; employeeId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON body', 400);
  }

  if (!body.caseId || !body.employeeId) {
    return apiError('BAD_REQUEST', 'caseId and employeeId are required', 400);
  }
  if (!isUuidLike(body.caseId) || !isUuidLike(body.employeeId)) {
    return apiError('BAD_REQUEST', 'Invalid caseId or employeeId', 400);
  }

  if (auth.role !== 'admin') {
    if (!auth.employeeId || body.employeeId !== auth.employeeId) {
      return apiError('FORBIDDEN', 'Forbidden', 403);
    }
  }

  await acknowledgeCaseAlertEscalation(ctx, body.caseId, body.employeeId);
  return jsonResponse({ ok: true });
}

export async function handleCaseAlertsProcess(ctx: ActionCtx, request: Request): Promise<Response> {
  if (!cronAuthorized(request)) {
    return apiError('UNAUTHORIZED', 'Invalid cron secret', 401);
  }
  const stats = await processCaseAlertEscalations(ctx);
  return jsonResponse({ ok: true, ...stats });
}
