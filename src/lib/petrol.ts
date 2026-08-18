import type { Employee, PetrolRequest, PetrolRequestStatus } from '../types';

export const PETROL_PRESET_AMOUNTS = [110, 220] as const;

export function getPendingPetrolRequest(
  requests: PetrolRequest[],
  employeeId: string,
): PetrolRequest | null {
  return requests.find((r) => r.employeeId === employeeId && r.status === 'pending') ?? null;
}

/** Token already issued — photos are attached on the *next* petrol request. */
export function getIssuedAwaitingEvidence(
  requests: PetrolRequest[],
  employeeId: string,
): PetrolRequest | null {
  return (
    requests.find(
      (r) =>
        r.employeeId === employeeId &&
        r.status === 'issued' &&
        !r.receiptUrl,
    ) ?? null
  );
}

export function lastVehicleNo(requests: PetrolRequest[], employeeId: string): string {
  const latest = requests
    .filter((r) => r.employeeId === employeeId && r.vehicleNo.trim())
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0];
  return latest?.vehicleNo ?? '';
}

/** Main admin and the dedicated petrol-desk login can issue tokens. */
export function canManagePetrol(role: Employee['role']): boolean {
  return role === 'admin' || role === 'petrol';
}

/** Unique email when petrol desk adds staff without a login. */
export function placeholderStaffEmail(name: string, phone: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'staff';
  const digits = phone.replace(/\D/g, '').slice(-10);
  return `${slug}.${digits || Date.now()}@staff.malconnexus.local`;
}

export const petrolStatusLabel: Record<PetrolRequestStatus, string> = {
  pending: 'Waiting for token',
  issued: 'Fill at pump',
  receipt_submitted: 'Bill received',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};
