import { Database } from '../database';
import { USE_SUPABASE, setCache } from '../config';
import { USE_MANAGED_API_BACKEND } from '../../cloudflareConfig';
import {
  createEmployeeOnWorker,
  deleteEmployeeOnWorker,
  updateEmployeeOnWorker,
} from '../../workerWriteApiMedium';
import { sbEmployeeRepo } from './supabaseRepositories';
import type { Employee } from '../../../types';
import { normalizeDepartment, getEmployeeDepartments } from '../../../constants/departments';

/** Worker/Supabase-backed employee rows — not browser-only localStorage. */
const REMOTE_EMPLOYEES = USE_SUPABASE || USE_MANAGED_API_BACKEND;

function readEmployeeList(): Employee[] {
  const list = Database.getAll<Employee>('employees');
  return list.map((e) => ({
    ...e,
    department: normalizeDepartment(e.department) ?? e.department,
    departments: getEmployeeDepartments(e),
  }));
}

function persistEmployeeList(list: Employee[]): void {
  if (USE_MANAGED_API_BACKEND) {
    Database.saveAll('employees', list);
  }
  setCache('employees', list);
}

async function persistEmployeeCreate(item: Employee): Promise<Employee> {
  if (USE_MANAGED_API_BACKEND) {
    await createEmployeeOnWorker(item);
  } else {
    await sbEmployeeRepo.create(item);
  }
  const list = readEmployeeList();
  persistEmployeeList([...list.filter((e) => e.id !== item.id), item]);
  return item;
}

async function persistEmployeeUpdate(id: string, updates: Partial<Employee>): Promise<Employee> {
  if (USE_MANAGED_API_BACKEND) {
    await updateEmployeeOnWorker(id, updates);
    const list = readEmployeeList();
    const merged = list.find((e) => e.id === id);
    if (!merged) throw new Error('Employee not found after update');
    const updated = { ...merged, ...updates };
    persistEmployeeList(list.map((e) => (e.id === id ? updated : e)));
    return updated;
  }
  const updated = await sbEmployeeRepo.update(id, updates);
  const list = readEmployeeList();
  persistEmployeeList(list.map((e) => (e.id === id ? updated : e)));
  return updated;
}

async function persistEmployeeDelete(id: string): Promise<void> {
  if (USE_MANAGED_API_BACKEND) {
    await deleteEmployeeOnWorker(id);
  } else {
    await sbEmployeeRepo.delete(id);
  }
  const list = readEmployeeList();
  persistEmployeeList(list.filter((e) => e.id !== id));
}

export const employeeRepository = {
  async getAll(): Promise<Employee[]> {
    return readEmployeeList();
  },

  async getById(id: string): Promise<Employee | null> {
    const list = await this.getAll();
    return list.find(e => e.id === id) || null;
  },

  async create(item: Employee): Promise<Employee> {
    if (REMOTE_EMPLOYEES) {
      return persistEmployeeCreate(item);
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
      return persistEmployeeUpdate(id, updates);
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
      await persistEmployeeDelete(id);
      return;
    }

    const list = await this.getAll();
    Database.saveAll('employees', list.filter(item => item.id !== id));
  },
};
