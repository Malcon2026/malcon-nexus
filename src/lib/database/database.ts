import { storage } from './storage';
import { employees as seedEmployees, hospitals as seedHospitals, doctors as seedDoctors } from './seed';
import type { Employee, Hospital, Doctor, ImplantCase, Notification, SurgicalKit, Approval, DepartmentInfo, ActivityEvent, AttendanceRecord } from '../../types';

const DB_VERSION_KEY = 'db_initialized_v5';

const USE_SUPABASE =
  !!import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://your-project-id.supabase.co';

const isDbInitialized = (): boolean => !!localStorage.getItem(DB_VERSION_KEY);
const markDbInitialized = (): void => localStorage.setItem(DB_VERSION_KEY, 'true');

export const initDB = () => {
  if (isDbInitialized()) return;

  // Supabase: data is loaded async via bootstrapSupabaseData — never seed empty rows here
  if (USE_SUPABASE) {
    markDbInitialized();
    return;
  }

  // 1. Seed Employees (admin only, zero counters)
  const employees: Employee[] = seedEmployees.map(e => ({
    ...e,
    casesCompleted: 0,
    casesActive: 0,
  }));
  storage.setItem<Employee[]>('employees', employees);

  // 2. Seed Hospitals
  storage.setItem<Hospital[]>('hospitals', seedHospitals);

  // 3. Seed Doctors
  storage.setItem<Doctor[]>('doctors', seedDoctors);

  // 4. Cases — start empty
  storage.setItem<ImplantCase[]>('cases', []);

  // 5. Notifications — start empty
  storage.setItem<Notification[]>('notifications', []);

  // 6. Surgical Kits — seed catalog
  const initialKitsList = [
    { name: 'Total Knee Replacement System', type: 'Knee Implant' },
    { name: 'Hip Replacement System - Cementless', type: 'Hip Implant' },
    { name: 'Lumbar Fusion System - TLIF', type: 'Spine Implant' },
    { name: 'Proximal Femoral Nail - Long', type: 'Trauma Implant' },
    { name: 'Unicompartmental Knee System', type: 'Knee Implant' },
    { name: 'Tumor Mega Prosthesis - Distal Femur', type: 'Oncology Implant' },
    { name: 'Arthroscopic ACL Reconstruction Kit', type: 'Sports Medicine' },
    { name: 'Paediatric Tibial Nail System', type: 'Paediatric Implant' },
    { name: 'Cervical Disc Replacement System', type: 'Spine Implant' },
    { name: 'Dynamic Hip Screw System', type: 'Trauma Implant' },
    { name: 'Total Shoulder Replacement', type: 'Shoulder Implant' },
    { name: 'Locking Compression Plate - Radius', type: 'Trauma Implant' },
  ];
  const kits: SurgicalKit[] = initialKitsList.map((kit, index) => ({
    id: `kit-${index + 1}`,
    name: kit.name,
    type: kit.type,
    serialNumber: `SN-2025-${String(index + 1).padStart(3, '0')}`,
    status: 'Available',
  }));
  storage.setItem<SurgicalKit[]>('kits', kits);

  // 7. Departments
  const initialDepts: DepartmentInfo[] = [
    { id: 'dept-1', name: 'Stores', description: 'Implant kit storage, inventory and verification.', color: 'bg-violet-100 text-violet-800' },
    { id: 'dept-2', name: 'Delivery', description: 'Delivery of implant kits to hospitals.', color: 'bg-rose-100 text-rose-800' },
    { id: 'dept-2b', name: 'Scrub Person', description: 'Assisting surgeons during the implant operation.', color: 'bg-blue-100 text-blue-800' },
    { id: 'dept-3', name: 'Cleaning Department', description: 'Sterilization and cleaning of surgical kits.', color: 'bg-cyan-100 text-cyan-800' },
    { id: 'dept-4', name: 'Stores Audit', description: 'Audit of items, materials, and kit completeness.', color: 'bg-amber-100 text-amber-800' },
    { id: 'dept-5', name: 'Accounts', description: 'Billing and invoicing for surgical procedures.', color: 'bg-emerald-100 text-emerald-800' },
    { id: 'dept-6', name: 'Bill Submission', description: 'Bill submission to hospitals.', color: 'bg-orange-100 text-orange-800' },
  ];
  storage.setItem<DepartmentInfo[]>('departments', initialDepts);

  // 8. Approvals — start empty
  storage.setItem<Approval[]>('approvals', []);

  // 9. Activity Log — start empty
  storage.setItem<ActivityEvent[]>('activityLog', []);

  // 10. Attendance — start empty
  storage.setItem<AttendanceRecord[]>('attendanceRecords', []);

  markDbInitialized();
};

export const Database = {
  getAll<T>(collection: string): T[] {
    initDB();
    return storage.getItem<T[]>(collection) || [];
  },

  saveAll<T>(collection: string, data: T[]): void {
    initDB();
    storage.setItem<T[]>(collection, data);
  },

  clearAll(): void {
    // Clear transactional data only — preserve reference catalogs
    storage.removeItem('cases');
    storage.removeItem('notifications');
    storage.removeItem('approvals');
    storage.removeItem('activityLog');
    storage.removeItem('attendanceRecords');

    // Reset employee counters
    const employees = storage.getItem<Employee[]>('employees') || [];
    const resetEmployees = employees.map(e => ({
      ...e,
      casesCompleted: 0,
      casesActive: 0,
    }));
    storage.setItem('employees', resetEmployees);

    // Re-initialize empty collections
    storage.setItem('cases', []);
    storage.setItem('notifications', []);
    storage.setItem('approvals', []);
    storage.setItem('activityLog', []);
    storage.setItem('attendanceRecords', []);
  },
};
