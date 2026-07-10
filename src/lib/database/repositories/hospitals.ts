import { Database } from '../database';
import { USE_SUPABASE, setCache } from '../config';
import { sbHospitalRepo } from './supabaseRepositories';
import type { Hospital } from '../../../types';

export const hospitalRepository = {
  async getAll(): Promise<Hospital[]> {
    return Database.getAll<Hospital>('hospitals');
  },

  async create(item: Hospital): Promise<Hospital> {
    if (USE_SUPABASE) {
      await sbHospitalRepo.create(item);
      const list = await this.getAll();
      setCache('hospitals', [...list, item]);
      return item;
    }

    const list = await this.getAll();
    const updated = [...list, item];
    Database.saveAll('hospitals', updated);
    return item;
  },

  async update(id: string, updates: Partial<Hospital>): Promise<Hospital> {
    if (USE_SUPABASE) {
      const updated = await sbHospitalRepo.update(id, updates);
      const list = await this.getAll();
      setCache('hospitals', list.map(h => (h.id === id ? updated : h)));
      return updated;
    }

    const list = await this.getAll();
    let updatedItem: Hospital | null = null;
    const updatedList = list.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...updates };
        return updatedItem;
      }
      return item;
    });
    if (!updatedItem) {
      throw new Error(`Hospital with ID ${id} not found`);
    }
    Database.saveAll('hospitals', updatedList);
    return updatedItem;
  },

  async delete(id: string): Promise<void> {
    if (USE_SUPABASE) {
      await sbHospitalRepo.delete(id);
      const list = await this.getAll();
      setCache('hospitals', list.filter(item => item.id !== id));
      return;
    }

    const list = await this.getAll();
    Database.saveAll('hospitals', list.filter(item => item.id !== id));
  },
};
