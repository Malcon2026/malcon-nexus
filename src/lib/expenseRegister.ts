import type { DailyExpense } from '../types';
import {
  buildSalaryCycleDayColumns,
  getSalaryCycleLabel,
  getSalaryCycleDescription,
  getSalaryLabel,
  type RegisterDayColumn,
} from './attendanceRegister';

/** Which figure a register cell/column is currently showing. */
export type ExpenseMetric = 'expense' | 'kms' | 'petrol' | 'food' | 'other';

export const EXPENSE_METRICS: { id: ExpenseMetric; label: string }[] = [
  { id: 'expense', label: 'Expense ₹' },
  { id: 'kms', label: 'Kms' },
  { id: 'petrol', label: 'Petrol ₹' },
  { id: 'food', label: 'Food ₹' },
  { id: 'other', label: 'Other ₹' },
];

/** Same day-column shape used by the Attendance register — same salary-cycle date rule. */
export type ExpenseRegisterDayColumn = RegisterDayColumn;

export interface ExpenseRegisterEmployeeRow {
  employeeId: string;
  employeeName: string;
  department: string;
  /** Aligned 1:1 with ExpenseRegisterData.days — null where nothing was entered. */
  entries: (DailyExpense | null)[];
  /** Total kms driven across the visible days. */
  totalKms: number;
  /** Total petrol + food + other across the visible days (excludes incentive). */
  totalExpense: number;
  /** totalKms * incentiveRatePerKm. */
  incentiveTotal: number;
}

export interface ExpenseRegisterData {
  year: number;
  month: number;
  monthLabel: string;
  /** e.g. "28 Jun – 27 Jul 2026" — same salary-cycle window as Attendance. */
  cycleLabel: string;
  cycleDescription: string;
  incentiveRatePerKm: number;
  days: ExpenseRegisterDayColumn[];
  rows: ExpenseRegisterEmployeeRow[];
  grandKms: number;
  grandIncentive: number;
  grandExpense: number;
}

/** Reads the raw amount for one metric off a single entry — null when there's nothing to show. */
export function metricValueForEntry(entry: DailyExpense | null, metric: ExpenseMetric): number | null {
  if (!entry) return null;
  switch (metric) {
    case 'kms':
      return entry.kmsDriven || null;
    case 'petrol':
      return entry.petrolAmount || null;
    case 'food':
      return entry.foodAmount || null;
    case 'other':
      return entry.otherAmount || null;
    case 'expense': {
      const total = entry.petrolAmount + entry.foodAmount + entry.otherAmount;
      return total || null;
    }
    default:
      return null;
  }
}

export function buildExpenseRegister(
  employees: { id: string; name: string; department: string; status: string }[],
  expenses: DailyExpense[],
  year: number,
  month: number,
  incentiveRatePerKm: number,
  options?: { employeeId?: string },
): ExpenseRegisterData {
  // Same 28th(prev month)→27th salary-cycle window and week numbering as the
  // Attendance register, so the two grids line up date-for-date.
  const days = buildSalaryCycleDayColumns(year, month);
  const staff = employees
    .filter((e) => e.status === 'Active')
    .filter((e) => !options?.employeeId || e.id === options.employeeId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const byEmployeeDate = new Map<string, DailyExpense>();
  for (const exp of expenses) {
    byEmployeeDate.set(`${exp.employeeId}_${exp.expenseDate}`, exp);
  }

  let grandKms = 0;
  let grandIncentive = 0;
  let grandExpense = 0;

  const rows: ExpenseRegisterEmployeeRow[] = staff.map((employee) => {
    let totalKms = 0;
    let totalExpense = 0;
    const entries = days.map((col) => {
      const entry = byEmployeeDate.get(`${employee.id}_${col.dateKey}`) ?? null;
      if (entry) {
        totalKms += entry.kmsDriven;
        totalExpense += entry.petrolAmount + entry.foodAmount + entry.otherAmount;
      }
      return entry;
    });
    const incentiveTotal = totalKms * incentiveRatePerKm;
    grandKms += totalKms;
    grandIncentive += incentiveTotal;
    grandExpense += totalExpense;

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      department: employee.department,
      entries,
      totalKms,
      totalExpense,
      incentiveTotal,
    };
  });

  return {
    year,
    month,
    monthLabel: getSalaryLabel(year, month),
    cycleLabel: getSalaryCycleLabel(year, month),
    cycleDescription: getSalaryCycleDescription(month),
    incentiveRatePerKm,
    days,
    rows,
    grandKms,
    grandIncentive,
    grandExpense,
  };
}

function formatShortDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Exports the register exactly as displayed for one metric, plus the 3 grand-total columns. */
export function exportExpenseRegisterCsv(data: ExpenseRegisterData, metric: ExpenseMetric): void {
  const header = [
    'Employee',
    'Department',
    ...data.days.map((d) => formatShortDate(d.dateKey)),
    'Total Kms',
    `Incentive Total (₹${data.incentiveRatePerKm}/km)`,
    'Total Expense (₹)',
  ];
  const lines = [header.join(',')];

  for (const row of data.rows) {
    lines.push(
      [
        `"${row.employeeName.replace(/"/g, '""')}"`,
        `"${row.department.replace(/"/g, '""')}"`,
        ...row.entries.map((entry) => {
          const v = metricValueForEntry(entry, metric);
          return v == null ? '' : String(v);
        }),
        String(row.totalKms),
        row.incentiveTotal.toFixed(2),
        row.totalExpense.toFixed(2),
      ].join(','),
    );
  }

  lines.push(
    [
      'Column total',
      '',
      ...data.days.map((_, idx) => {
        const sum = data.rows.reduce((acc, row) => acc + (metricValueForEntry(row.entries[idx], metric) ?? 0), 0);
        return sum ? String(sum) : '';
      }),
      String(data.grandKms),
      data.grandIncentive.toFixed(2),
      data.grandExpense.toFixed(2),
    ].join(','),
  );

  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `expense-register-${metric}-${data.year}-${String(data.month).padStart(2, '0')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
