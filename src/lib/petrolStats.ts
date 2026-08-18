import type { PetrolRequest } from '../types';
import { getISTDateKey } from './attendance';

const SPEND_STATUSES: PetrolRequest['status'][] = ['issued', 'receipt_submitted'];

export function petrolFillDate(request: PetrolRequest): string {
  return getISTDateKey(request.issuedAt || request.requestedAt);
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function summarizePetrol(requests: PetrolRequest[], now = new Date()) {
  const today = getISTDateKey(now);
  const month = today.slice(0, 7);
  const spendRows = requests.filter((r) => SPEND_STATUSES.includes(r.status));
  const todayRows = spendRows.filter((r) => petrolFillDate(r) === today);
  const monthRows = spendRows.filter((r) => petrolFillDate(r).startsWith(month));
  const pending = requests.filter((r) => r.status === 'pending');
  const awaitingBill = requests.filter((r) => r.status === 'issued');

  const dayKeys = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const daily = dayKeys.map((date) => {
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
    { employeeId: string; name: string; fills: number; amount: number; vehicleNo: string }
  >();
  for (const row of monthRows) {
    const current = byEmployeeMap.get(row.employeeId) ?? {
      employeeId: row.employeeId,
      name: row.employeeName,
      fills: 0,
      amount: 0,
      vehicleNo: row.vehicleNo,
    };
    current.fills += 1;
    current.amount += row.amount;
    current.vehicleNo = row.vehicleNo || current.vehicleNo;
    byEmployeeMap.set(row.employeeId, current);
  }
  const byEmployee = [...byEmployeeMap.values()].sort((a, b) => b.amount - a.amount);

  const recent = [...spendRows]
    .sort((a, b) => new Date(b.issuedAt || b.requestedAt).getTime() - new Date(a.issuedAt || a.requestedAt).getTime())
    .slice(0, 12);

  return {
    today,
    month,
    pending,
    awaitingBill,
    todayFills: todayRows.length,
    todayAmount: todayRows.reduce((sum, r) => sum + r.amount, 0),
    monthFills: monthRows.length,
    monthAmount: monthRows.reduce((sum, r) => sum + r.amount, 0),
    daily,
    byEmployee,
    recent,
  };
}
