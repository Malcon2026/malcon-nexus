import type { Employee, PetrolRequest, PetrolRequestStatus } from '../types';

/** Fixed petrol token amount (₹). */
export const PETROL_TOKEN_AMOUNT = 200;

/** Minimum km driven on last fill before a new token can be requested. */
export const PETROL_KM_THRESHOLD = 200;

export type PetrolTripReadings = {
  kmsStart: number;
  kmsEnd: number;
  kms: number;
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

/** Issued token waiting for admin to record km reading. */
export function getIssuedAwaitingKms(
  requests: PetrolRequest[],
  employeeId: string,
): PetrolRequest | null {
  const open = requests
    .filter((r) => r.employeeId === employeeId && r.status === 'issued' && r.kmsEnd == null)
    .sort(
      (a, b) =>
        new Date(a.issuedAt || a.requestedAt).getTime() -
        new Date(b.issuedAt || b.requestedAt).getTime(),
    );
  return open[0] ?? null;
}

/** Last odometer reading from a completed fill. */
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

export function lastCompletedFill(
  requests: PetrolRequest[],
  employeeId: string,
): PetrolRequest | null {
  const latest = requests
    .filter((r) => r.employeeId === employeeId && r.status === 'receipt_submitted' && r.kms != null)
    .sort((a, b) => {
      const aAt = new Date(a.receiptSubmittedAt || a.requestedAt).getTime();
      const bAt = new Date(b.receiptSubmittedAt || b.requestedAt).getTime();
      return bAt - aAt;
    })[0];
  return latest ?? null;
}

export function parseOdometerReading(
  kmsStart: number,
  kmsEndRaw: string,
): { readings: PetrolTripReadings } | { error: string } {
  const kmsEnd = Number(kmsEndRaw);
  if (!Number.isFinite(kmsEnd) || kmsEnd < 0) {
    return { error: 'Enter the current odometer reading.' };
  }
  if (kmsEnd < kmsStart) {
    return { error: 'Odometer reading must be the same as or higher than the last reading.' };
  }
  const kms = Math.round((kmsEnd - kmsStart) * 10) / 10;
  return { readings: { kmsStart, kmsEnd, kms } };
}

export function formatTripFormula(kmsStart: number, kmsEnd: number, kms: number): string {
  return `${kmsEnd} − ${kmsStart} = ${kms} km`;
}

export function formatTripKms(request: PetrolRequest): string {
  if (request.kms == null) return '';
  if (request.kmsStart != null && request.kmsEnd != null) {
    return formatTripFormula(request.kmsStart, request.kmsEnd, request.kms);
  }
  return `${request.kms} km`;
}

export function lastVehicleNo(requests: PetrolRequest[], employeeId: string): string {
  const latest = requests
    .filter((r) => r.employeeId === employeeId && r.vehicleNo.trim())
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0];
  return latest?.vehicleNo ?? '';
}

export function canRequestPetrolToken(
  requests: PetrolRequest[],
  employeeId: string,
): { ok: true } | { ok: false; reason: string } {
  if (getPendingPetrolRequests(requests, employeeId).length > 0) {
    return { ok: false, reason: 'You already have a token request waiting.' };
  }
  if (getIssuedAwaitingKms(requests, employeeId)) {
    return { ok: false, reason: 'Return with km reading before requesting again. Admin will record it.' };
  }
  const last = lastCompletedFill(requests, employeeId);
  if (last?.kms != null && last.kms < PETROL_KM_THRESHOLD) {
    return {
      ok: false,
      reason: `Need ${PETROL_KM_THRESHOLD} km on the last fill before the next token (${last.kms} km recorded).`,
    };
  }
  return { ok: true };
}

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
  issued: 'Token issued',
  receipt_submitted: 'Km recorded',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};
