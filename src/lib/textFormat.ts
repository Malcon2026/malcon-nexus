/** Collapse whitespace; empty stays empty. */
function collapseSpaces(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Names, places, procedures: each word → First letter upper, rest lower.
 * e.g. "DR SHARMA" → "Dr Sharma", "total knee" → "Total Knee"
 */
export function normalizeTitleCaseWords(value: string): string {
  const collapsed = collapseSpaces(value);
  if (!collapsed) return '';
  return collapsed
    .split(' ')
    .map((word) => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/** Notes: one leading capital, rest lowercase (single sentence style). */
export function normalizeSentenceText(value: string): string {
  const collapsed = collapseSpaces(value);
  if (!collapsed) return '';
  return collapsed.charAt(0).toUpperCase() + collapsed.slice(1).toLowerCase();
}

export function normalizeCaseTextFields(fields: {
  doctorName?: string;
  implantRequired?: string;
  implantType?: string;
  implantCompany?: string;
  remarks?: string;
}): typeof fields {
  const out = { ...fields };
  if (out.doctorName !== undefined) out.doctorName = normalizeTitleCaseWords(out.doctorName);
  if (out.implantRequired !== undefined) out.implantRequired = normalizeTitleCaseWords(out.implantRequired);
  if (out.implantType !== undefined) out.implantType = normalizeTitleCaseWords(out.implantType);
  if (out.implantCompany !== undefined) out.implantCompany = normalizeTitleCaseWords(out.implantCompany);
  if (out.remarks !== undefined) out.remarks = normalizeSentenceText(out.remarks);
  return out;
}
