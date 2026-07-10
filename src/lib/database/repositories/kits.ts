import { Database } from '../database';
import type { SurgicalKit } from '../../../types';

export const kitRepository = {
  async getAll(): Promise<SurgicalKit[]> {
    return Database.getAll<SurgicalKit>('kits');
  },

  async getById(id: string): Promise<SurgicalKit | null> {
    const list = await this.getAll();
    return list.find(k => k.id === id) || null;
  },

  async create(item: SurgicalKit): Promise<SurgicalKit> {
    const list = await this.getAll();
    const updated = [...list, item];
    Database.saveAll('kits', updated);
    return item;
  },

  async update(id: string, updates: Partial<SurgicalKit>): Promise<SurgicalKit> {
    const list = await this.getAll();
    let updatedItem: SurgicalKit | null = null;
    const updatedList = list.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...updates };
        return updatedItem;
      }
      return item;
    });
    if (!updatedItem) {
      throw new Error(`Surgical kit with ID ${id} not found`);
    }
    Database.saveAll('kits', updatedList);
    return updatedItem;
  },

  async delete(id: string): Promise<void> {
    const list = await this.getAll();
    const filtered = list.filter(item => item.id !== id);
    Database.saveAll('kits', filtered);
  }
};
