import { Database } from '../database';
import { USE_SUPABASE, setCache } from '../config';
import { sbNotificationRepo } from './supabaseRepositories';
import type { Notification } from '../../../types';

export const notificationRepository = {
  async getAll(): Promise<Notification[]> {
    return Database.getAll<Notification>('notifications');
  },

  async create(item: Notification): Promise<Notification> {
    if (USE_SUPABASE) {
      await sbNotificationRepo.create(item).catch((err) => console.error('[notifications] create failed:', err));
      const list = await this.getAll();
      setCache('notifications', [item, ...list.filter(n => n.id !== item.id)]);
      return item;
    }

    const list = await this.getAll();
    Database.saveAll('notifications', [item, ...list]);
    return item;
  },

  async update(id: string, updates: Partial<Notification>): Promise<Notification> {
    const list = await this.getAll();
    let updatedItem: Notification | null = null;
    const updatedList = list.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...updates };
        return updatedItem;
      }
      return item;
    });
    if (!updatedItem) throw new Error(`Notification with ID ${id} not found`);

    if (USE_SUPABASE && updates.read !== undefined) {
      if (updates.read) await sbNotificationRepo.markRead(id).catch(() => {});
    }

    setCache('notifications', updatedList);
    if (!USE_SUPABASE) Database.saveAll('notifications', updatedList);
    return updatedItem;
  },

  async delete(id: string): Promise<void> {
    const list = await this.getAll();
    setCache('notifications', list.filter(item => item.id !== id));
  },
};
