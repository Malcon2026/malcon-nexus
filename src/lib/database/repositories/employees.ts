import { Database } from '../database';
import { USE_SUPABASE, setCache } from '../config';
import { USE_CLOUDFLARE_BACKEND } from '../../cloudflareConfig';
import { sbEmployeeRepo } from './supabaseRepositories';

/** Worker/Supabase-backed employee rows — not browser-only localStorage. */
const REMOTE_EMPLOYEES = USE_SUPABASE || USE_CLOUDFLARE_BACKEND;

function persistEmployeeList(list: Employee[]): void {
  if (USE_CLOUDFLARE_BACKEND) {
    Database.saveAll('employees', list);
  }
  setCache('employees', list);
}
import type { Employee } from '../../../types';
import { normalizeDepartment, getEmployeeDepartments } from '../../../constants/departments';

export const employeeRepository = {
  async getAll(): Promise<Employee[]> {
    const list = Database.getAll<Employee>('employees');
    return list.map((e) => ({
      ...e,
      department: normalizeDepartment(e.department) ?? e.department,
      departments: getEmployeeDepartments(e),
    }));
  },

  async getById(id: string): Promise<Employee | null> {
    const list = await this.getAll();
    return list.find(e => e.id === id) || null;
  },

  async create(item: Employee): Promise<Employee> {
    if (REMOTE_EMPLOYEES) {
      await sbEmployeeRepo.create(item);
      const list = await this.getAll();
      persistEmployeeList([...list.filter((e) => e.id !== item.id), item]);
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
    if (REMOTE_EMPLOYEES) {
      const updated = await sbEmployeeRepo.update(id, updates);
      const list = await this.getAll();
      persistEmployeeList(list.map((e) => (e.id === id ? updated : e)));
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
    if (REMOTE_EMPLOYEES) {
      await sbEmployeeRepo.delete(id);
      const list = await this.getAll();
      persistEmployeeList(list.filter((e) => e.id !== id));
      return;
    }

    const list = await this.getAll();
    Database.saveAll('employees', list.filter(item => item.id !== id));
  },
};
