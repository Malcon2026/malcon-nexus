import { Database } from '../database';
import { USE_SUPABASE, setCache, newId } from '../config';
import { sbDoctorRepo } from './supabaseRepositories';
import type { Doctor } from '../../../types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuid(value?: string | null): string | null {
  return value && UUID_RE.test(value) ? value : null;
}

export const doctorRepository = {
  async getAll(): Promise<Doctor[]> {
    return Database.getAll<Doctor>('doctors');
  },

  async create(item: Doctor): Promise<Doctor> {
    const doctor: Doctor = {
      ...item,
      id: item.id && UUID_RE.test(item.id) ? item.id : newId(),
      hospitalId: asUuid(item.hospitalId) ?? '',
    };

    if (USE_SUPABASE) {
      await sbDoctorRepo.create(doctor);
      const list = await this.getAll();
      setCache('doctors', [...list, doctor]);
      return doctor;
    }

    const list = await this.getAll();
    Database.saveAll('doctors', [...list, doctor]);
    return doctor;
  },

  async update(id: string, updates: Partial<Doctor>): Promise<Doctor> {
    if (USE_SUPABASE) {
      const updated = await sbDoctorRepo.update(id, updates);
      const list = await this.getAll();
      setCache('doctors', list.map(d => (d.id === id ? updated : d)));
      return updated;
    }

    const list = await this.getAll();
    let updatedItem: Doctor | null = null;
    const updatedList = list.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...updates };
        return updatedItem;
      }
      return item;
    });
    if (!updatedItem) throw new Error(`Doctor with ID ${id} not found`);
    Database.saveAll('doctors', updatedList);
    return updatedItem;
  },

  async delete(id: string): Promise<void> {
    if (USE_SUPABASE) {
      await sbDoctorRepo.delete(id);
      const list = await this.getAll();
      setCache('doctors', list.filter(d => d.id !== id));
      return;
    }

    const list = await this.getAll();
    Database.saveAll('doctors', list.filter(item => item.id !== id));
  },
};
