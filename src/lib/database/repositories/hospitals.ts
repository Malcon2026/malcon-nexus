import { Database } from '../database';
import { REMOTE_DATA, setCache } from '../config';
import { USE_MANAGED_API_BACKEND } from '../../cloudflareConfig';
import { sbHospitalRepo } from './supabaseRepositories';
import type { Hospital } from '../../../types';

function persistHospitalList(list: Hospital[]): void {
  if (USE_MANAGED_API_BACKEND) {
    Database.saveAll('hospitals', list);
  }
  setCache('hospitals', list);
}

export const hospitalRepository = {
  async getAll(): Promise<Hospital[]> {
    return Database.getAll<Hospital>('hospitals');
  },

  async create(item: Hospital): Promise<Hospital> {
    if (REMOTE_DATA) {
      await sbHospitalRepo.create(item);
      const list = await this.getAll();
      persistHospitalList([...list.filter((h) => h.id !== item.id), item]);
      return item;
    }

    const list = await this.getAll();
    const updated = [...list, item];
    Database.saveAll('hospitals', updated);
    return item;
  },

  async update(id: string, updates: Partial<Hospital>): Promise<Hospital> {
    if (REMOTE_DATA) {
      const updated = await sbHospitalRepo.update(id, updates);
      const list = await this.getAll();
      persistHospitalList(list.map((h) => (h.id === id ? updated : h)));
      return updated;
    }

    const list = await this.getAll();
    let updatedItem: Hospital | null = null;
    const updatedList = list.map((item) => {
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
    if (REMOTE_DATA) {
      await sbHospitalRepo.delete(id);
      const list = await this.getAll();
      persistHospitalList(list.filter((item) => item.id !== id));
      return;
    }

    const list = await this.getAll();
    Database.saveAll('hospitals', list.filter((item) => item.id !== id));
  },
};
