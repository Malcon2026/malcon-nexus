import type { PetrolRequest } from '../types';
import { getISTDateKey } from './attendance';

const SPEND_STATUSES: PetrolRequest['status'][] = ['issued', 'receipt_submitted'];

export function petrolFillDate(request: PetrolRequest): string {
  return getISTDateKey(request.issuedAt || request.requestedAt);
}

export function currentPetrolMonth(now = new Date()): string {
  return getISTDateKey(now).slice(0, 7);
}

export function shiftPetrolMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

export function petrolMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function daysInMonth(yearMonth: string): string[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const last = new Date(year, month, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${yearMonth}-${String(i + 1).padStart(2, '0')}`);
}

export function summarizePetrol(requests: PetrolRequest[], month = currentPetrolMonth(), now = new Date()) {
  const today = getISTDateKey(now);
  const spendRows = requests.filter((r) => SPEND_STATUSES.includes(r.status));
  const todayRows = spendRows.filter((r) => petrolFillDate(r) === today);
  const monthRows = spendRows.filter((r) => petrolFillDate(r).startsWith(month));
  const pending = requests.filter((r) => r.status === 'pending');
  const awaitingBill = requests.filter((r) => r.status === 'issued');

  const daily = daysInMonth(month).map((date) => {
    const rows = spendRows.filter((r) => petrolFillDate(r) === date);
    return {
      date,
      label: date.slice(8),
      fills: rows.length,
      amount: rows.reduce((sum, r) => sum + r.amount, 0),
    };
  });

  const byEmployeeMap = new Map<
    string,
    {
      employeeId: string;
      name: string;
      fills: number;
      amount: number;
      kms: number;
      vehicleNo: string;
      lastDate: string;
    }
  >();
  for (const row of monthRows) {
    const current = byEmployeeMap.get(row.employeeId) ?? {
      employeeId: row.employeeId,
      name: row.employeeName,
      fills: 0,
      amount: 0,
      kms: 0,
      vehicleNo: row.vehicleNo,
      lastDate: petrolFillDate(row),
    };
    current.fills += 1;
    current.amount += row.amount;
    current.kms += row.kms ?? 0;
    current.vehicleNo = row.vehicleNo || current.vehicleNo;
    const fillDate = petrolFillDate(row);
    if (fillDate > current.lastDate) current.lastDate = fillDate;
    byEmployeeMap.set(row.employeeId, current);
  }
  const byEmployee = [...byEmployeeMap.values()].sort((a, b) => b.amount - a.amount);

  const vehicles = new Set(monthRows.map((r) => r.vehicleNo.trim()).filter(Boolean));
  const monthAmount = monthRows.reduce((sum, r) => sum + r.amount, 0);
  const monthKms = monthRows.reduce((sum, r) => sum + (r.kms ?? 0), 0);

  const recent = [...spendRows]
    .sort((a, b) => new Date(b.issuedAt || b.requestedAt).getTime() - new Date(a.issuedAt || a.requestedAt).getTime())
    .slice(0, 10);

  return {
    today,
    month,
    pending,
    awaitingBill,
    todayFills: todayRows.length,
    todayAmount: todayRows.reduce((sum, r) => sum + r.amount, 0),
    monthFills: monthRows.length,
    monthAmount,
    monthKms,
    avgFill: monthRows.length ? Math.round(monthAmount / monthRows.length) : 0,
    uniqueStaff: byEmployee.length,
    uniqueVehicles: vehicles.size,
    daily,
    byEmployee,
    recent,
  };
}
