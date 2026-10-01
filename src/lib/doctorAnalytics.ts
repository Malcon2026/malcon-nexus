import type { Doctor, ImplantCase } from '../types';

export type DoctorCaseStats = {
  doctorId: string;
  doctorCode?: string;
  name: string;
  total: number;
  active: number;
  completed: number;
  postponed: number;
  lastSurgeryDate: string | null;
};

const ACTIVE_STATUSES = new Set(['Active', 'Waiting For Approval']);

function compareDoctorCodes(a?: string, b?: string): number {
  const na = a ? parseInt(a.replace(/\D/g, ''), 10) : 9999;
  const nb = b ? parseInt(b.replace(/\D/g, ''), 10) : 9999;
  return na - nb;
}

export function buildDoctorCaseStats(cases: ImplantCase[], doctors: Doctor[]): DoctorCaseStats[] {
  const byId = new Map<string, DoctorCaseStats>();

  for (const d of doctors) {
    byId.set(d.id, {
      doctorId: d.id,
      doctorCode: d.doctorCode,
      name: d.name,
      total: 0,
      active: 0,
      completed: 0,
      postponed: 0,
      lastSurgeryDate: null,
    });
  }

  for (const c of cases) {
    const id = c.doctor?.id;
    if (!id) continue;
    let row = byId.get(id);
    if (!row) {
      row = {
        doctorId: id,
        doctorCode: c.doctor.doctorCode,
        name: c.doctor.name || 'Unknown',
        total: 0,
        active: 0,
        completed: 0,
        postponed: 0,
        lastSurgeryDate: null,
      };
      byId.set(id, row);
    }
    row.total += 1;
    if (c.status === 'Completed') row.completed += 1;
    else if (c.status === 'Postponed') row.postponed += 1;
    else if (ACTIVE_STATUSES.has(c.status)) row.active += 1;
    const sd = c.surgeryDate;
    if (sd && (!row.lastSurgeryDate || sd > row.lastSurgeryDate)) {
      row.lastSurgeryDate = sd;
    }
  }

  return [...byId.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return compareDoctorCodes(a.doctorCode, b.doctorCode);
  });
}

export function masterDoctorRows(doctors: Doctor[], stats: DoctorCaseStats[]): DoctorCaseStats[] {
  const statsById = new Map(stats.map((s) => [s.doctorId, s]));
  const rows = doctors.map((d) => {
    const s = statsById.get(d.id);
    return (
      s ?? {
        doctorId: d.id,
        doctorCode: d.doctorCode,
        name: d.name,
        total: 0,
        active: 0,
        completed: 0,
        postponed: 0,
        lastSurgeryDate: null,
      }
    );
  });
  return rows.sort((a, b) => compareDoctorCodes(a.doctorCode, b.doctorCode));
}
