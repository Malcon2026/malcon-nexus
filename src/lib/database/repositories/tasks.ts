import { Database } from '../database';
import { USE_SUPABASE, setCache } from '../config';
import { sbCaseRepo } from './supabaseRepositories';
import { nextCaseNumberFromCases } from '../../../utils/helpers';
import type { ImplantCase } from '../../../types';

export const taskRepository = {
  async getNextCaseNumber(): Promise<string> {
    if (USE_SUPABASE) return sbCaseRepo.getNextCaseNumber();
    const list = await this.getAll();
    return nextCaseNumberFromCases(list);
  },

  async getAll(): Promise<ImplantCase[]> {
    return Database.getAll<ImplantCase>('cases');
  },

  async getById(id: string): Promise<ImplantCase | null> {
    const list = await this.getAll();
    return list.find(c => c.id === id) || null;
  },

  async create(item: ImplantCase): Promise<ImplantCase> {
    if (USE_SUPABASE) {
      await sbCaseRepo.create(item);
      const list = await this.getAll();
      setCache('cases', [item, ...list.filter(c => c.id !== item.id)]);
      return item;
    }

    const list = await this.getAll();
    const updated = [item, ...list];
    Database.saveAll('cases', updated);
    return item;
  },

  async update(id: string, updates: Partial<ImplantCase>): Promise<ImplantCase> {
    if (USE_SUPABASE) {
      const updated = await sbCaseRepo.update(id, updates);
      const list = await this.getAll();
      setCache('cases', list.map(c => (c.id === id ? updated : c)));
      return updated;
    }

    const list = await this.getAll();
    let updatedItem: ImplantCase | null = null;
    const updatedList = list.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...updates, updatedAt: new Date().toISOString() };
        return updatedItem;
      }
      return item;
    });
    if (!updatedItem) {
      throw new Error(`Case with ID ${id} not found`);
    }
    Database.saveAll('cases', updatedList);
    return updatedItem;
  },

  async delete(id: string): Promise<void> {
    if (USE_SUPABASE) {
      await sbCaseRepo.delete(id);
      const list = await this.getAll();
      setCache('cases', list.filter(c => c.id !== id));
      return;
    }

    const list = await this.getAll();
    Database.saveAll('cases', list.filter(item => item.id !== id));
  },
};
