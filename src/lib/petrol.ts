import type { Employee, PetrolRequest, PetrolRequestStatus } from '../types';

export const PETROL_PRESET_AMOUNTS = [110, 220] as const;

export type PetrolTripReadings = {
  kmsStart: number;
  kmsEnd: number;
  kms: number;
};

export type PetrolTripEvidence = PetrolTripReadings & {
  receiptPhoto: File;
  kmsPhoto: File;
};

export function getPendingPetrolRequest(
  requests: PetrolRequest[],
  employeeId: string,
): PetrolRequest | null {
  return requests.find((r) => r.employeeId === employeeId && r.status === 'pending') ?? null;
}

export function getPendingPetrolRequests(
  requests: PetrolRequest[],
  employeeId: string,
): PetrolRequest[] {
  return requests
    .filter((r) => r.employeeId === employeeId && r.status === 'pending')
    .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());
}

/** Oldest issued token that still needs last-fill meter readings + photos. */
export function getIssuedAwaitingEvidence(
  requests: PetrolRequest[],
  employeeId: string,
): PetrolRequest | null {
  const open = requests
    .filter((r) => r.employeeId === employeeId && r.status === 'issued' && !r.receiptUrl)
    .sort(
      (a, b) =>
        new Date(a.issuedAt || a.requestedAt).getTime() -
        new Date(b.issuedAt || b.requestedAt).getTime(),
    );
  return open[0] ?? null;
}

/** Last submitted meter reading — prefill as the next previous reading. */
export function lastMeterReading(requests: PetrolRequest[], employeeId: string): number | null {
  const latest = requests
    .filter((r) => r.employeeId === employeeId && r.kmsEnd != null)
    .sort((a, b) => {
      const aAt = new Date(a.receiptSubmittedAt || a.requestedAt).getTime();
      const bAt = new Date(b.receiptSubmittedAt || b.requestedAt).getTime();
      return bAt - aAt;
    })[0];
  return latest?.kmsEnd ?? null;
}

export function parseTripReadings(
  yesterdayRaw: string,
  todayRaw: string,
): { readings: PetrolTripReadings } | { error: string } {
  const kmsStart = Number(yesterdayRaw);
  const kmsEnd = Number(todayRaw);
  if (!Number.isFinite(kmsStart) || kmsStart < 0) {
    return { error: 'Enter yesterday kms (meter reading from last fill, e.g. 1234).' };
  }
  if (!Number.isFinite(kmsEnd) || kmsEnd < 0) {
    return { error: 'Enter today kms (meter reading on this bill, e.g. 1254).' };
  }
  if (kmsEnd < kmsStart) {
    return { error: 'Today kms must be the same as or higher than yesterday kms.' };
  }
  const kms = Math.round((kmsEnd - kmsStart) * 10) / 10;
  return { readings: { kmsStart, kmsEnd, kms } };
}

/** e.g. "1254 − 1234 = 20 km trip" */
export function formatTripFormula(kmsStart: number, kmsEnd: number, kms: number): string {
  return `${kmsEnd} − ${kmsStart} = ${kms} km trip`;
}

export function formatTripKms(request: PetrolRequest): string {
  if (request.kms == null) return '';
  if (request.kmsStart != null && request.kmsEnd != null) {
    return formatTripFormula(request.kmsStart, request.kmsEnd, request.kms);
  }
  return `${request.kms} km trip`;
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
