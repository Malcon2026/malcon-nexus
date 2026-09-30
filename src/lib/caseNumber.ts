/** Malcon agency case id: MLS-MM-YY-NNN (surgery month/year + sequence). */

export const CASE_NUMBER_AGENCY = 'MLS';

/** Prefix for a case, e.g. MLS-09-26- */
export function caseNumberPrefixForDate(reference: Date | string): string {
  const d =
    typeof reference === 'string' && reference.trim()
      ? new Date(`${reference.trim().slice(0, 10)}T12:00:00`)
      : reference instanceof Date
        ? reference
        : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const mm = String(safe.getMonth() + 1).padStart(2, '0');
  const yy = String(safe.getFullYear()).slice(-2);
  return `${CASE_NUMBER_AGENCY}-${mm}-${yy}-`;
}

function sequenceFromCaseNumber(caseNumber: string, prefix: string): number | null {
  if (!caseNumber.startsWith(prefix)) return null;
  const tail = caseNumber.slice(prefix.length);
  if (!/^\d+$/.test(tail)) return null;
  const num = parseInt(tail, 10);
  return Number.isNaN(num) ? null : num;
}

/** Next id given existing case numbers sharing the same MLS-MM-YY- prefix. */
export function nextCaseNumberWithPrefix(
  cases: { caseNumber: string }[],
  prefix: string,
): string {
  let max = 0;
  for (const c of cases) {
    const num = sequenceFromCaseNumber(c.caseNumber, prefix);
    if (num != null) max = Math.max(max, num);
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export function nextCaseNumberFromCases(
  cases: { caseNumber: string }[],
  surgeryDate?: string,
): string {
  const prefix = caseNumberPrefixForDate(surgeryDate ?? new Date());
  return nextCaseNumberWithPrefix(cases, prefix);
}
