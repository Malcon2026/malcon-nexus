import { Database } from '../database';
import { USE_SUPABASE, setCache } from '../config';
import { sbEmployeeRepo } from './supabaseRepositories';
import type { Employee } from '../../../types';

export const employeeRepository = {
  async getAll(): Promise<Employee[]> {
    return Database.getAll<Employee>('employees');
  },

  async getById(id: string): Promise<Employee | null> {
    const list = await this.getAll();
    return list.find(e => e.id === id) || null;
  },

  async create(item: Employee): Promise<Employee> {
    if (USE_SUPABASE) {
      await sbEmployeeRepo.create(item);
      const list = await this.getAll();
      setCache('employees', [...list.filter(e => e.id !== item.id), item]);
      return item;
    }

    const list = await this.getAll();
    if (list.some(e => e.id === item.id)) {
      throw new Error(`Employee with ID ${item.id} already exists`);
    }
    Database.saveAll('employees', [...list, item]);
    return item;
  },

  async update(id: string, updates: Partial<Employee>): Promise<Employee> {
    if (USE_SUPABASE) {
      const updated = await sbEmployeeRepo.update(id, updates);
      const list = await this.getAll();
      setCache('employees', list.map(e => (e.id === id ? updated : e)));
      return updated;
    }

    const list = await this.getAll();
    let updatedItem: Employee | null = null;
    const updatedList = list.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...updates };
        return updatedItem;
      }
      return item;
    });
    if (!updatedItem) throw new Error(`Employee with ID ${id} not found`);
    Database.saveAll('employees', updatedList);
    return updatedItem;
  },

  async delete(id: string): Promise<void> {
    if (USE_SUPABASE) {
      await sbEmployeeRepo.delete(id);
      const list = await this.getAll();
      setCache('employees', list.filter(e => e.id !== id));
      return;
    }

    const list = await this.getAll();
    Database.saveAll('employees', list.filter(item => item.id !== id));
  },
};
