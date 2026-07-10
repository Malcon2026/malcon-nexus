import { Database } from '../database';
import type { DepartmentInfo, Department } from '../../../types';

export const departmentRepository = {
  async getAll(): Promise<DepartmentInfo[]> {
    return Database.getAll<DepartmentInfo>('departments');
  },

  async getByName(name: Department): Promise<DepartmentInfo | null> {
    const list = await this.getAll();
    return list.find(d => d.name === name) || null;
  },

  async create(item: DepartmentInfo): Promise<DepartmentInfo> {
    const list = await this.getAll();
    const updated = [...list, item];
    Database.saveAll('departments', updated);
    return item;
  },

  async update(id: string, updates: Partial<DepartmentInfo>): Promise<DepartmentInfo> {
    const list = await this.getAll();
    let updatedItem: DepartmentInfo | null = null;
    const updatedList = list.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...updates };
        return updatedItem;
      }
      return item;
    });
    if (!updatedItem) {
      throw new Error(`Department with ID ${id} not found`);
    }
    Database.saveAll('departments', updatedList);
    return updatedItem;
  },

  async delete(id: string): Promise<void> {
    const list = await this.getAll();
    const filtered = list.filter(item => item.id !== id);
    Database.saveAll('departments', filtered);
  }
};
