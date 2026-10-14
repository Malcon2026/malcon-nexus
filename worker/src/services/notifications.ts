import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { notifications } from '../db/schema';

export const NOTIFICATION_PUBLIC_COLUMNS = {
  id: notifications.id,
  title: notifications.title,
  message: notifications.message,
  type: notifications.type,
  isRead: notifications.isRead,
  caseId: notifications.caseId,
  recipientId: notifications.recipientId,
  createdAt: notifications.createdAt,
} as const;

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  caseId: string | null;
  recipientId: string | null;
  createdAt: string;
};

function mapNotification(row: NotificationRow) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    is_read: row.isRead,
    case_id: row.caseId,
    recipient_id: row.recipientId,
    created_at: row.createdAt,
  };
}

export type NotificationListFilters = {
  recipientId?: string | null;
  unreadOnly?: boolean;
};

function listWhere(filters: NotificationListFilters) {
  const parts = [];
  if (filters.recipientId) {
    parts.push(eq(notifications.recipientId, filters.recipientId));
  }
  if (filters.unreadOnly) {
    parts.push(eq(notifications.isRead, false));
  }
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return and(...parts);
}

export async function countNotifications(db: Db, filters: NotificationListFilters): Promise<number> {
  const where = listWhere(filters);
  const rows = where
    ? await db.select({ c: sql<number>`count(*)` }).from(notifications).where(where)
    : await db.select({ c: sql<number>`count(*)` }).from(notifications);
  return Number(rows[0]?.c ?? 0);
}

export async function countUnreadNotifications(db: Db, recipientId?: string | null): Promise<number> {
  return countNotifications(db, { recipientId, unreadOnly: true });
}

export async function listNotifications(
  db: Db,
  filters: NotificationListFilters,
  offset: number,
  limit: number,
) {
  const where = listWhere(filters);
  const rows = where
    ? await db
        .select(NOTIFICATION_PUBLIC_COLUMNS)
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .offset(offset)
        .limit(limit)
    : await db
        .select(NOTIFICATION_PUBLIC_COLUMNS)
        .from(notifications)
        .orderBy(desc(notifications.createdAt))
        .offset(offset)
        .limit(limit);
  return rows.map(mapNotification);
}
