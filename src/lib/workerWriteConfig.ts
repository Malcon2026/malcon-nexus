import { USE_CLOUDFLARE_BACKEND } from './cloudflareConfig';

/**
 * Phase 10.1 — opt-in Worker + D1 writes (default off; Supabase remains default).
 */

export const USE_WORKER_WRITES_ACTIVITY =
  USE_CLOUDFLARE_BACKEND || import.meta.env.VITE_USE_WORKER_WRITES_ACTIVITY === 'true';

export const USE_WORKER_WRITES_NOTIFICATIONS =
  USE_CLOUDFLARE_BACKEND || import.meta.env.VITE_USE_WORKER_WRITES_NOTIFICATIONS === 'true';

export const USE_WORKER_WRITES_SETTINGS =
  USE_CLOUDFLARE_BACKEND || import.meta.env.VITE_USE_WORKER_WRITES_SETTINGS === 'true';

export const USE_WORKER_WRITES_KITS =
  USE_CLOUDFLARE_BACKEND || import.meta.env.VITE_USE_WORKER_WRITES_KITS === 'true';

export const USE_WORKER_WRITES_EXPENSES =
  USE_CLOUDFLARE_BACKEND || import.meta.env.VITE_USE_WORKER_WRITES_EXPENSES === 'true';

export const USE_WORKER_WRITES_APPROVALS =
  USE_CLOUDFLARE_BACKEND || import.meta.env.VITE_USE_WORKER_WRITES_APPROVALS === 'true';

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
  USE_CLOUDFLARE_BACKEND || import.meta.env.VITE_USE_WORKER_WRITES_EMPLOYEES === 'true';

export const USE_WORKER_WRITES_HOSPITALS =
  USE_CLOUDFLARE_BACKEND || import.meta.env.VITE_USE_WORKER_WRITES_HOSPITALS === 'true';

export const USE_WORKER_WRITES_DOCTORS =
  USE_CLOUDFLARE_BACKEND || import.meta.env.VITE_USE_WORKER_WRITES_DOCTORS === 'true';

export const USE_WORKER_WRITES_ATTENDANCE =
  USE_CLOUDFLARE_BACKEND || import.meta.env.VITE_USE_WORKER_WRITES_ATTENDANCE === 'true';

export const USE_WORKER_WRITES_LEAVE =
  USE_CLOUDFLARE_BACKEND || import.meta.env.VITE_USE_WORKER_WRITES_LEAVE === 'true';

export const USE_WORKER_WRITES_FOOD =
  USE_CLOUDFLARE_BACKEND || import.meta.env.VITE_USE_WORKER_WRITES_FOOD === 'true';

export const USE_WORKER_WRITES_PETROL =
  USE_CLOUDFLARE_BACKEND || import.meta.env.VITE_USE_WORKER_WRITES_PETROL === 'true';

export const USE_WORKER_WRITES_TRIPS =
  USE_CLOUDFLARE_BACKEND || import.meta.env.VITE_USE_WORKER_WRITES_TRIPS === 'true';

export const USE_WORKER_WRITES_CASE_TASKS =
  USE_CLOUDFLARE_BACKEND || import.meta.env.VITE_USE_WORKER_WRITES_CASE_TASKS === 'true';

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

export const USE_WORKER_WRITES_CASES =
  USE_CLOUDFLARE_BACKEND || import.meta.env.VITE_USE_WORKER_WRITES_CASES === 'true';

export const USE_WORKER_WRITES_CASE_CLAIM =
  USE_CLOUDFLARE_BACKEND || import.meta.env.VITE_USE_WORKER_WRITES_CASE_CLAIM === 'true';

export function useWorkerWritesCases(): boolean {
  return USE_WORKER_WRITES_CASES;
}

export function useWorkerWritesCaseClaim(): boolean {
  return USE_WORKER_WRITES_CASE_CLAIM;
}
