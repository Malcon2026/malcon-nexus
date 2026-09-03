export type CancelCaseReasonType = 'implants_not_used' | 'dummy_kit' | 'other';

export const CANCEL_CASE_REASONS: {
  id: CancelCaseReasonType;
  label: string;
  hint: string;
}[] = [
  {
    id: 'implants_not_used',
    label: 'Implants not used',
    hint: 'Surgery did not happen. Real kit must come back; billing is skipped.',
  },
  {
    id: 'dummy_kit',
    label: 'Dummy kit',
    hint: 'Demo/training kit only. Billing is skipped.',
  },
  {
    id: 'other',
    label: 'Other',
    hint: 'Any other reason — add details below.',
  },
];

export function cancelReasonLabel(type: CancelCaseReasonType): string {
  return CANCEL_CASE_REASONS.find((r) => r.id === type)?.label ?? type;
}

/** Stored on the case and shown in exports / detail views. */
export function formatCancelReason(type: CancelCaseReasonType, details?: string): string {
  const label = cancelReasonLabel(type);
  const trimmed = (details ?? '').trim();
  if (type === 'other') return trimmed ? `Other — ${trimmed}` : 'Other';
  return trimmed ? `${label} — ${trimmed}` : label;
}

export function cancelCaseRemark(type: CancelCaseReasonType): string {
  if (type === 'dummy_kit') return 'Dummy kit';
  return 'Implants unused';
}

export function withCancelCaseRemark(existing: string | undefined, type: CancelCaseReasonType): string {
  const remark = cancelCaseRemark(type);
  const t = (existing ?? '').trim();
  if (!t) return remark;
  if (new RegExp(remark.replace(/\s+/g, '\\s+'), 'i').test(t)) return t;
  return `${t}\n${remark}`;
}

export function cancelCaseLogPhrase(type: CancelCaseReasonType): string {
  if (type === 'dummy_kit') return 'Case cancelled — dummy kit.';
  if (type === 'other') return 'Case cancelled.';
  return 'Surgery cancelled — no implants used.';
}
