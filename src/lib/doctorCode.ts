/** Master list doctor IDs (MLS-DOC-001 …). */
export const DOCTOR_CODE_PATTERN = /^MLS-DOC-\d{3}$/i;

export function normalizeDoctorCode(value: string | null | undefined): string | undefined {
  const v = (value ?? '').trim();
  if (!v) return undefined;
  const upper = v.toUpperCase();
  return DOCTOR_CODE_PATTERN.test(upper) ? upper : undefined;
}

/** Reads code from `doctor_code` column or legacy `phone` slot used before migration. */
export function doctorCodeFromRow(row: {
  doctor_code?: string | null;
  phone?: string | null;
}): string | undefined {
  return normalizeDoctorCode(row.doctor_code) ?? normalizeDoctorCode(row.phone);
}
