import { Database } from '../database';
import { REMOTE_DATA, setCache } from '../config';
import { USE_CLOUDFLARE_BACKEND } from '../../cloudflareConfig';
import { sbNotificationRepo } from './supabaseRepositories';
import type { Notification } from '../../../types';

function persistNotificationList(list: Notification[]): void {
  if (USE_CLOUDFLARE_BACKEND) {
    Database.saveAll('notifications', list);
  }
  setCache('notifications', list);
}

export const notificationRepository = {
  async getAll(): Promise<Notification[]> {
    return Database.getAll<Notification>('notifications');
  },

  async create(item: Notification): Promise<Notification> {
    if (REMOTE_DATA) {
      await sbNotificationRepo.create(item);
      const list = await this.getAll();
      persistNotificationList([item, ...list.filter((n) => n.id !== item.id)]);
      return item;
    }

    const list = await this.getAll();
    Database.saveAll('notifications', [item, ...list]);
    return item;
  },

  async update(id: string, updates: Partial<Notification>): Promise<Notification> {
    const list = await this.getAll();
    let updatedItem: Notification | null = null;
    const updatedList = list.map((item) => {
      if (item.id === id) {
        updatedItem = { ...item, ...updates };
        return updatedItem;
      }
      return item;
    });
    if (!updatedItem) throw new Error(`Notification with ID ${id} not found`);

    if (REMOTE_DATA && updates.read !== undefined) {
      if (updates.read) {
        await sbNotificationRepo.markRead(id);
      }
    }

    persistNotificationList(updatedList);
    if (!REMOTE_DATA) Database.saveAll('notifications', updatedList);
    return updatedItem;
  },

  async delete(id: string): Promise<void> {
    const list = await this.getAll();
    persistNotificationList(list.filter((item) => item.id !== id));
  },
};
