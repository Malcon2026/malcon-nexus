import type { Env } from '../env';
import { apiError, jsonResponse } from '../lib/http';
import type { RequestContext } from '../middleware/auth';
import { requireMappedEmployee } from '../middleware/api-auth';
import { AuthError } from '../middleware/authorization';
import { isFullAdminRole } from '../lib/authRoles';
import { broadcastTelegram, handleTelegramWebhookUpdate, sendCaseTelegram } from '../services/telegram';

export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET ?? '';
  if (webhookSecret) {
    const header = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
    if (header !== webhookSecret) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return jsonResponse({ ok: true });
  }

  try {
    await handleTelegramWebhookUpdate(env, update);
  } catch (err) {
    console.error('[telegram-webhook]', err);
  }
  return jsonResponse({ ok: true });
}

export async function handleTelegramNotify(
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
    event?: string;
    caseId?: string;
    employeeId?: string;
  };
  if (!body.event || !body.caseId || !body.employeeId) {
    return apiError('BAD_REQUEST', 'event, caseId, and employeeId are required', 400);
  }
  if (body.event !== 'assignment' && body.event !== 'postpone') {
    return apiError('BAD_REQUEST', 'event must be assignment or postpone', 400);
  }

  const result = await sendCaseTelegram(env, body.event, body.caseId, body.employeeId);
  if ('error' in result) return apiError('INTERNAL', result.error, result.status);
  return jsonResponse({ ok: true, skipped: result.skipped ?? false });
}

export async function handleTelegramBroadcast(
  request: Request,
  env: Env,
  auth: RequestContext,
): Promise<Response> {
  try {
    requireMappedEmployee(auth);
    if (!auth.role || !isFullAdminRole(auth.role)) {
      return apiError('FORBIDDEN', 'Admin access required', 403);
    }
  } catch (e) {
    if (e instanceof AuthError) return apiError(e.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', e.message, e.status);
    throw e;
  }

  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    target?: 'all' | 'selected';
    employeeIds?: string[];
  };

  if (body.target !== 'all' && body.target !== 'selected') {
    return apiError('BAD_REQUEST', 'target must be all or selected', 400);
  }

  const result = await broadcastTelegram(env, body.message ?? '', body.target, body.employeeIds);
  if ('error' in result) {
    if (result.reason === 'no_connected_recipients') {
      return jsonResponse({ error: result.error, reason: result.reason }, 400);
    }
    return apiError('BAD_REQUEST', result.error, result.status);
  }

  return jsonResponse({
    sent: result.sent,
    failed: result.failed,
    total: result.total,
    failures: result.failures,
  });
}
