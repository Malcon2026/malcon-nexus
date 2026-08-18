import type { Employee, PetrolRequest, PetrolRequestStatus } from '../types';

export const PETROL_PRESET_AMOUNTS = [110, 220] as const;

export const OPEN_PETROL_STATUSES: PetrolRequestStatus[] = ['pending', 'issued'];

export function isOpenPetrolStatus(status: PetrolRequestStatus): boolean {
  return status === 'pending' || status === 'issued';
}

/** An open request blocks the next petrol request until the pump receipt is submitted. */
export function getBlockingPetrolRequest(
  requests: PetrolRequest[],
  employeeId: string,
): PetrolRequest | null {
  return (
    requests.find((r) => r.employeeId === employeeId && isOpenPetrolStatus(r.status)) ?? null
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

export const petrolStatusLabel: Record<PetrolRequestStatus, string> = {
  pending: 'Waiting for token',
  issued: 'Fill at pump',
  receipt_submitted: 'Bill received',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};
