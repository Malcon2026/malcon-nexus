import type { Env } from '../env';
import { createDb } from '../db/client';
import { apiData, apiError, isUuidLike } from '../lib/http';
import { pageMeta, parsePagination } from '../lib/pagination';
import type { RequestContext } from '../middleware/auth';
import {
  countNotifications,
  countUnreadNotifications,
  listNotifications,
} from '../services/notifications';

function parseRecipientId(url: URL): string | null | undefined {
  const raw = url.searchParams.get('recipientId');
  if (raw == null || raw === '') return undefined;
  if (!isUuidLike(raw)) return null;
  return raw;
}

export async function handleListNotifications(
  request: Request,
  env: Env,
  _ctx: RequestContext,
): Promise<Response> {
  const url = new URL(request.url);
  const parsed = parsePagination(url);
  if ('error' in parsed) {
    return apiError('BAD_REQUEST', parsed.error, 400);
  }

  const recipientId = parseRecipientId(url);
  if (recipientId === null) {
    return apiError('BAD_REQUEST', 'Invalid recipientId', 400);
  }

  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';

  const db = createDb(env);
  const filters = { recipientId, unreadOnly };
  const total = await countNotifications(db, filters);
  const items = await listNotifications(db, filters, parsed.offset, parsed.limit);
  return apiData({
    items,
    pagination: pageMeta(parsed.page, parsed.pageSize, total),
  });
}

export async function handleNotificationSummary(
  request: Request,
  env: Env,
  _ctx: RequestContext,
): Promise<Response> {
  const url = new URL(request.url);
  const recipientId = parseRecipientId(url);
  if (recipientId === null) {
    return apiError('BAD_REQUEST', 'Invalid recipientId', 400);
  }

  const db = createDb(env);
  const total = await countNotifications(db, { recipientId });
  const unread = await countUnreadNotifications(db, recipientId);
  return apiData({ total, unread });
}
