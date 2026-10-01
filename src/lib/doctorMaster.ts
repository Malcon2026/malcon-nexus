import type { Doctor } from '../types';
import { normalizeDoctorCode } from './doctorCode';
import { normalizeTitleCaseWords } from './textFormat';

export function normDoctorName(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function findDoctorByName(doctors: Doctor[], rawName: string): Doctor | undefined {
  const n = normDoctorName(normalizeTitleCaseWords(rawName.trim()));
  if (!n) return undefined;
  return doctors.find((d) => normDoctorName(d.name) === n);
}

export function nextDoctorCode(doctors: Doctor[]): string {
  let max = 0;
  for (const d of doctors) {
    const code = d.doctorCode ?? normalizeDoctorCode(d.phone);
    if (!code) continue;
    const num = parseInt(code.replace(/\D/g, ''), 10);
    if (Number.isFinite(num) && num > max) max = num;
  }
  return `MLS-DOC-${String(max + 1).padStart(3, '0')}`;
}

export function compareDoctorCodes(a?: string, b?: string): number {
  const na = a ? parseInt(a.replace(/\D/g, ''), 10) : 99999;
  const nb = b ? parseInt(b.replace(/\D/g, ''), 10) : 99999;
  return na - nb;
}

export type DoctorMasterEntry = { code: string; name: string; id: string };

export function mergeDoctorMasterList(
  existingJson: string | undefined,
  entry: DoctorMasterEntry,
): string {
  let list: DoctorMasterEntry[] = [];
  if (existingJson) {
    try {
      list = JSON.parse(existingJson) as DoctorMasterEntry[];
    } catch {
      list = [];
    }
  }
  if (!list.some((r) => r.id === entry.id)) {
    list.push(entry);
    list.sort((x, y) => compareDoctorCodes(x.code, y.code));
  }
  return JSON.stringify(list);
}
