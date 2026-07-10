import { Database } from '../database';
import { USE_SUPABASE, setCache } from '../config';
import { sbApprovalRepo } from './supabaseRepositories';
import type { Approval } from '../../../types';

export const approvalRepository = {
  async getAll(): Promise<Approval[]> {
    return Database.getAll<Approval>('approvals');
  },

  async getById(id: string): Promise<Approval | null> {
    const list = await this.getAll();
    return list.find(a => a.id === id) || null;
  },

  async findByCaseAndStage(caseId: string, stage: Approval['stage']): Promise<Approval | null> {
    const list = await this.getAll();
    return list.find(a => a.caseId === caseId && a.stage === stage) || null;
  },

  async create(item: Approval): Promise<Approval> {
    if (USE_SUPABASE) {
      await sbApprovalRepo.upsert(item);
      const list = await this.getAll();
      setCache('approvals', [item, ...list.filter(a => a.id !== item.id)]);
      return item;
    }

    const list = await this.getAll();
    Database.saveAll('approvals', [item, ...list]);
    return item;
  },

  async update(id: string, updates: Partial<Approval>): Promise<Approval> {
    if (USE_SUPABASE) {
      const existing = await this.getById(id);
      if (!existing) throw new Error(`Approval with ID ${id} not found`);
      const merged = { ...existing, ...updates };
      await sbApprovalRepo.upsert(merged);
      const list = await this.getAll();
      const updatedList = list.map(a => (a.id === id ? merged : a));
      setCache('approvals', updatedList);
      return merged;
    }

    const list = await this.getAll();
    let updatedItem: Approval | null = null;
    const updatedList = list.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...updates };
        return updatedItem;
      }
      return item;
    });
    if (!updatedItem) {
      throw new Error(`Approval with ID ${id} not found`);
    }
    Database.saveAll('approvals', updatedList);
    return updatedItem;
  },

  async delete(id: string): Promise<void> {
    const list = await this.getAll();
    setCache('approvals', list.filter(item => item.id !== id));
  },
};
