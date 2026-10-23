import type { ActionCtx } from '../_generated/server';
import { authenticateRequest } from './authContext';
import {
  isFullAdminRole,
  requireAdminOrStoreManager,
  requireMappedEmployee,
} from './httpAuthHelpers';
import { apiError, isUuidLike, jsonResponse } from './httpUtil';
import { broadcastTelegram, handleTelegramWebhookUpdate, sendCaseTelegram } from './telegramService';

function webhookAuthorized(request: Request): boolean {
  const webhookSecret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim();
  const header = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!webhookSecret) {
    return process.env.ALLOW_INSECURE_TELEGRAM_WEBHOOK === '1';
  }
  return header === webhookSecret;
}

export async function handleTelegramWebhook(ctx: ActionCtx, request: Request): Promise<Response> {
  if (!webhookAuthorized(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return jsonResponse({ ok: true });
  }

  try {
    await handleTelegramWebhookUpdate(ctx, update);
  } catch (err) {
    console.error('[telegram-webhook]', err);
  }
  return jsonResponse({ ok: true });
}

export async function handleTelegramNotify(ctx: ActionCtx, request: Request): Promise<Response> {
  const auth = await authenticateRequest(ctx, request);
  let denied = requireMappedEmployee(auth);
  if (denied) return denied;
  denied = requireAdminOrStoreManager(auth);
  if (denied) return denied;

  let body: { event?: string; caseId?: string; employeeId?: string };
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

  const result = await sendCaseTelegram(ctx, body.event, body.caseId, body.employeeId);
  if ('error' in result) return apiError('INTERNAL', result.error, result.status);
  return jsonResponse({ ok: true, skipped: result.skipped ?? false });
}

export async function handleTelegramBroadcast(ctx: ActionCtx, request: Request): Promise<Response> {
  const auth = await authenticateRequest(ctx, request);
  let denied = requireMappedEmployee(auth);
  if (denied) return denied;
  if (!auth.role || !isFullAdminRole(auth.role)) {
    return apiError('FORBIDDEN', 'Admin access required', 403);
  }

  let body: { message?: string; target?: 'all' | 'selected'; employeeIds?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON body', 400);
  }

  if (body.target !== 'all' && body.target !== 'selected') {
    return apiError('BAD_REQUEST', 'target must be all or selected', 400);
  }

  const result = await broadcastTelegram(ctx, body.message ?? '', body.target, body.employeeIds);
  if ('error' in result && 'status' in result) {
    if (result.reason === 'no_connected_recipients') {
      return jsonResponse({ error: result.error, reason: result.reason }, 400);
    }
    return apiError('BAD_REQUEST', result.error, result.status);
  }

  return jsonResponse(result);
}
