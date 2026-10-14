/**
 * Phase 10.1 — opt-in Worker + D1 writes (default off; Supabase remains default).
 */

export const USE_WORKER_WRITES_ACTIVITY =
  import.meta.env.VITE_USE_WORKER_WRITES_ACTIVITY === 'true';

export const USE_WORKER_WRITES_NOTIFICATIONS =
  import.meta.env.VITE_USE_WORKER_WRITES_NOTIFICATIONS === 'true';

export const USE_WORKER_WRITES_SETTINGS =
  import.meta.env.VITE_USE_WORKER_WRITES_SETTINGS === 'true';

export const USE_WORKER_WRITES_KITS = import.meta.env.VITE_USE_WORKER_WRITES_KITS === 'true';

export const USE_WORKER_WRITES_EXPENSES =
  import.meta.env.VITE_USE_WORKER_WRITES_EXPENSES === 'true';

export const USE_WORKER_WRITES_APPROVALS =
  import.meta.env.VITE_USE_WORKER_WRITES_APPROVALS === 'true';

export function useWorkerWritesActivity(): boolean {
  return USE_WORKER_WRITES_ACTIVITY;
}

export function useWorkerWritesNotifications(): boolean {
  return USE_WORKER_WRITES_NOTIFICATIONS;
}

export function useWorkerWritesSettings(): boolean {
  return USE_WORKER_WRITES_SETTINGS;
}

export function useWorkerWritesKits(): boolean {
  return USE_WORKER_WRITES_KITS;
}

export function useWorkerWritesExpenses(): boolean {
  return USE_WORKER_WRITES_EXPENSES;
}

export function useWorkerWritesApprovals(): boolean {
  return USE_WORKER_WRITES_APPROVALS;
}

export const USE_WORKER_WRITES_EMPLOYEES =
  import.meta.env.VITE_USE_WORKER_WRITES_EMPLOYEES === 'true';

export const USE_WORKER_WRITES_HOSPITALS =
  import.meta.env.VITE_USE_WORKER_WRITES_HOSPITALS === 'true';

export const USE_WORKER_WRITES_DOCTORS =
  import.meta.env.VITE_USE_WORKER_WRITES_DOCTORS === 'true';

export const USE_WORKER_WRITES_ATTENDANCE =
  import.meta.env.VITE_USE_WORKER_WRITES_ATTENDANCE === 'true';

export const USE_WORKER_WRITES_LEAVE = import.meta.env.VITE_USE_WORKER_WRITES_LEAVE === 'true';

export const USE_WORKER_WRITES_FOOD = import.meta.env.VITE_USE_WORKER_WRITES_FOOD === 'true';

export const USE_WORKER_WRITES_PETROL = import.meta.env.VITE_USE_WORKER_WRITES_PETROL === 'true';

export const USE_WORKER_WRITES_TRIPS = import.meta.env.VITE_USE_WORKER_WRITES_TRIPS === 'true';

export const USE_WORKER_WRITES_CASE_TASKS =
  import.meta.env.VITE_USE_WORKER_WRITES_CASE_TASKS === 'true';

export function useWorkerWritesEmployees(): boolean {
  return USE_WORKER_WRITES_EMPLOYEES;
}

export function useWorkerWritesHospitals(): boolean {
  return USE_WORKER_WRITES_HOSPITALS;
}

export function useWorkerWritesDoctors(): boolean {
  return USE_WORKER_WRITES_DOCTORS;
}

export function useWorkerWritesAttendance(): boolean {
  return USE_WORKER_WRITES_ATTENDANCE;
}

export function useWorkerWritesLeave(): boolean {
  return USE_WORKER_WRITES_LEAVE;
}

export function useWorkerWritesFood(): boolean {
  return USE_WORKER_WRITES_FOOD;
}

export function useWorkerWritesPetrol(): boolean {
  return USE_WORKER_WRITES_PETROL;
}

export function useWorkerWritesTrips(): boolean {
  return USE_WORKER_WRITES_TRIPS;
}

export function useWorkerWritesCaseTasks(): boolean {
  return USE_WORKER_WRITES_CASE_TASKS;
}

export const USE_WORKER_WRITES_CASES = import.meta.env.VITE_USE_WORKER_WRITES_CASES === 'true';

export const USE_WORKER_WRITES_CASE_CLAIM =
  import.meta.env.VITE_USE_WORKER_WRITES_CASE_CLAIM === 'true';

export function useWorkerWritesCases(): boolean {
  return USE_WORKER_WRITES_CASES;
}

export function useWorkerWritesCaseClaim(): boolean {
  return USE_WORKER_WRITES_CASE_CLAIM;
}
