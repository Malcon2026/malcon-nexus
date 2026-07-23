import React, { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, Plus, Pencil, Trash2, Fuel, X, IndianRupee, Check } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useStore } from '../store/useStore';
import type { Department, DailyExpense } from '../types';
import { formatCurrency, departmentColors } from '../utils/helpers';
import { getISTDateKey } from '../lib/attendance';

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 bg-white';
const labelClass = 'block text-xs font-medium text-gray-700 mb-1.5';

interface FormState {
  id?: string;
  employeeId: string;
  expenseDate: string;
  kmsDriven: string;
  petrolAmount: string;
  foodAmount: string;
  otherAmount: string;
  otherDescription: string;
  notes: string;
}

function emptyForm(): FormState {
  return {
    employeeId: '',
    expenseDate: getISTDateKey(),
    kmsDriven: '',
    petrolAmount: '',
    foodAmount: '',
    otherAmount: '',
    otherDescription: '',
    notes: '',
  };
}

function formatMonthLabel(monthValue: string): string {
  const [y, m] = monthValue.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export const Expenses: React.FC = () => {
  const viewMode = useStore((s) => s.viewMode);
  const employees = useStore((s) => s.employees);
  const dailyExpenses = useStore((s) => s.dailyExpenses);
  const dailyExpensesLoaded = useStore((s) => s.dailyExpensesLoaded);
  const loadDailyExpenses = useStore((s) => s.loadDailyExpenses);
  const saveDailyExpense = useStore((s) => s.saveDailyExpense);
  const deleteDailyExpense = useStore((s) => s.deleteDailyExpense);
  const appSettingsLoaded = useStore((s) => s.appSettingsLoaded);
  const loadAppSettings = useStore((s) => s.loadAppSettings);
  const incentiveRatePerKm = useStore((s) => s.getIncentiveRatePerKm());
  const setIncentiveRatePerKm = useStore((s) => s.setIncentiveRatePerKm);

  const isAdmin = viewMode === 'admin';

  const now = new Date();
  const [monthValue, setMonthValue] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  );
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState('');
  const [rateSaving, setRateSaving] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin && !dailyExpensesLoaded) {
      void loadDailyExpenses();
    }
  }, [isAdmin, dailyExpensesLoaded, loadDailyExpenses]);

  useEffect(() => {
    if (isAdmin && !appSettingsLoaded) {
      void loadAppSettings();
    }
  }, [isAdmin, appSettingsLoaded, loadAppSettings]);

  const openRateEditor = () => {
    setRateInput(String(incentiveRatePerKm));
    setRateError(null);
    setEditingRate(true);
  };

  const handleSaveRate = async () => {
    setRateError(null);
    const parsed = Number(rateInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setRateError('Enter a valid rate.');
      return;
    }
    setRateSaving(true);
    try {
      const result = await setIncentiveRatePerKm(parsed);
      if (result.error) {
        setRateError(result.error);
        return;
      }
      setEditingRate(false);
    } finally {
      setRateSaving(false);
    }
  };

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === 'Active').sort((a, b) => a.name.localeCompare(b.name)),
    [employees],
  );

  const monthRows = useMemo(
    () =>
      dailyExpenses
        .filter((e) => e.expenseDate.startsWith(monthValue))
        .filter((e) => filterEmployeeId === 'all' || e.employeeId === filterEmployeeId)
        .sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : -1)),
    [dailyExpenses, monthValue, filterEmployeeId],
  );

  const totals = useMemo(
    () =>
      monthRows.reduce(
        (acc, r) => ({
          kms: acc.kms + r.kmsDriven,
          petrol: acc.petrol + r.petrolAmount,
          food: acc.food + r.foodAmount,
          other: acc.other + r.otherAmount,
        }),
        { kms: 0, petrol: 0, food: 0, other: 0 },
      ),
    [monthRows],
  );
  const grandTotal = totals.petrol + totals.food + totals.other;
  const incentiveTotal = totals.kms * incentiveRatePerKm;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDailyExpenses();
    } finally {
      setRefreshing(false);
    }
  };

  const openNewForm = () => {
    setForm(emptyForm());
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (row: DailyExpense) => {
    setForm({
      id: row.id,
      employeeId: row.employeeId,
      expenseDate: row.expenseDate,
      kmsDriven: row.kmsDriven ? String(row.kmsDriven) : '',
      petrolAmount: row.petrolAmount ? String(row.petrolAmount) : '',
      foodAmount: row.foodAmount ? String(row.foodAmount) : '',
      otherAmount: row.otherAmount ? String(row.otherAmount) : '',
      otherDescription: row.otherDescription,
      notes: row.notes,
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    setFormError(null);
    if (!form.employeeId) {
      setFormError('Select an employee.');
      return;
    }
    if (!form.expenseDate) {
      setFormError('Select a date.');
      return;
    }
    setSaving(true);
    try {
      const result = await saveDailyExpense({
        id: form.id,
        employeeId: form.employeeId,
        expenseDate: form.expenseDate,
        kmsDriven: form.kmsDriven ? Number(form.kmsDriven) : 0,
        petrolAmount: form.petrolAmount ? Number(form.petrolAmount) : 0,
        foodAmount: form.foodAmount ? Number(form.foodAmount) : 0,
        otherAmount: form.otherAmount ? Number(form.otherAmount) : 0,
        otherDescription: form.otherDescription,
        notes: form.notes,
      });
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setShowForm(false);
      setForm(emptyForm());
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense entry?')) return;
    setDeletingId(id);
    try {
      await deleteDailyExpense(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-lg mx-auto mt-20">
        <Card className="p-8 text-center">
          <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900">Admin Access Required</h1>
          <p className="text-sm text-gray-500 mt-2">Expenses are only available to administrators.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-[1200px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Petrol, Food &amp; Other Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Daily kms driven, petrol, food, and other spend — entered manually by admins only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={openNewForm}>
            Add expense
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-3">
        {[
          { label: 'Total kms driven', value: totals.kms.toLocaleString('en-IN'), bg: 'bg-indigo-50', text: 'text-indigo-700', icon: <Fuel className="h-4 w-4 text-indigo-700" /> },
          { label: 'Petrol', value: formatCurrency(totals.petrol), bg: 'bg-orange-50', text: 'text-orange-700', icon: <Fuel className="h-4 w-4 text-orange-700" /> },
          { label: 'Food', value: formatCurrency(totals.food), bg: 'bg-emerald-50', text: 'text-emerald-700', icon: <Fuel className="h-4 w-4 text-emerald-700" /> },
          { label: 'Other', value: formatCurrency(totals.other), bg: 'bg-purple-50', text: 'text-purple-700', icon: <Fuel className="h-4 w-4 text-purple-700" /> },
          { label: `Km incentive (₹${incentiveRatePerKm}/km)`, value: formatCurrency(incentiveTotal), bg: 'bg-rose-50', text: 'text-rose-700', icon: <IndianRupee className="h-4 w-4 text-rose-700" /> },
        ].map(({ label, value, bg, icon }) => (
          <Card key={label} className="p-4">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${bg} mb-2`}>
              {icon}
            </div>
            <p className="text-lg font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <p className="text-xs text-gray-400">
          Grand total for {formatMonthLabel(monthValue)}: <span className="font-semibold text-gray-600">{formatCurrency(grandTotal)}</span> (petrol + food + other) · Incentive uses total kms across all employees shown — check the per-employee breakdown in Reports for individual payouts.
        </p>
        {!editingRate ? (
          <button
            type="button"
            onClick={openRateEditor}
            className="text-xs text-gray-500 hover:text-gray-800 underline shrink-0"
          >
            Change incentive rate (₹{incentiveRatePerKm}/km)
          </button>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-gray-500">₹</span>
            <input
              type="number"
              min="0"
              step="0.5"
              autoFocus
              className="w-20 px-2 py-1 text-xs border border-gray-200 rounded-lg"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
            />
            <span className="text-xs text-gray-500">/km</span>
            <button
              type="button"
              onClick={() => void handleSaveRate()}
              disabled={rateSaving}
              className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
              aria-label="Save rate"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setEditingRate(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {rateError && (
        <p className="text-xs text-red-600 -mt-4 mb-4">{rateError}</p>
      )}

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">{form.id ? 'Edit expense entry' : 'Add expense entry'}</h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Employee *</label>
                <select
                  className={inputClass}
                  value={form.employeeId}
                  onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                  disabled={!!form.id}
                >
                  <option value="">Select employee</option>
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name} — {emp.department}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Date *</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.expenseDate}
                  max={getISTDateKey()}
                  onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                  disabled={!!form.id}
                />
              </div>
              <div>
                <label className={labelClass}>Kms driven</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className={inputClass}
                  placeholder="0"
                  value={form.kmsDriven}
                  onChange={(e) => setForm((f) => ({ ...f, kmsDriven: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>Petrol (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  placeholder="0"
                  value={form.petrolAmount}
                  onChange={(e) => setForm((f) => ({ ...f, petrolAmount: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>Food (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  placeholder="0"
                  value={form.foodAmount}
                  onChange={(e) => setForm((f) => ({ ...f, foodAmount: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>Other (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  placeholder="0"
                  value={form.otherAmount}
                  onChange={(e) => setForm((f) => ({ ...f, otherAmount: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>Other — for what?</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Parking, Toll, Tea"
                  value={form.otherDescription}
                  onChange={(e) => setForm((f) => ({ ...f, otherDescription: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>Notes (optional)</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Optional notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            {form.id && (
              <p className="text-xs text-gray-400">
                Employee and date are fixed while editing an existing entry — delete and re-add if you need to change them.
              </p>
            )}

            {formError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-900">Daily entries</h3>
            <div className="flex items-center gap-2">
              <input
                type="month"
                className={`${inputClass} w-auto`}
                value={monthValue}
                onChange={(e) => setMonthValue(e.target.value)}
              />
              <select
                className={`${inputClass} w-auto`}
                value={filterEmployeeId}
                onChange={(e) => setFilterEmployeeId(e.target.value)}
              >
                <option value="all">All employees</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {monthRows.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">
              No expense entries for {formatMonthLabel(monthValue)}
              {filterEmployeeId !== 'all' ? ' for this employee' : ''}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Employee</th>
                    <th className="px-4 py-2.5 font-medium">Dept</th>
                    <th className="px-4 py-2.5 font-medium text-right">Kms</th>
                    <th className="px-4 py-2.5 font-medium text-right">Incentive</th>
                    <th className="px-4 py-2.5 font-medium text-right">Petrol</th>
                    <th className="px-4 py-2.5 font-medium text-right">Food</th>
                    <th className="px-4 py-2.5 font-medium text-right">Other</th>
                    <th className="px-4 py-2.5 font-medium">Notes</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map((row) => {
                    const employee = employees.find((e) => e.id === row.employeeId);
                    return (
                      <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{row.expenseDate}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{row.employeeName}</td>
                        <td className="px-4 py-2.5">
                          {employee && (
                            <Badge className={`${departmentColors[employee.department as Department] ?? 'bg-gray-100 text-gray-700'} text-[10px]`}>
                              {employee.department}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{row.kmsDriven || ''}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-rose-700">
                          {row.kmsDriven ? formatCurrency(row.kmsDriven * incentiveRatePerKm) : ''}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{row.petrolAmount ? formatCurrency(row.petrolAmount) : ''}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{row.foodAmount ? formatCurrency(row.foodAmount) : ''}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {row.otherAmount ? formatCurrency(row.otherAmount) : ''}
                          {row.otherDescription && (
                            <span className="text-gray-400 ml-1">({row.otherDescription})</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 max-w-[160px] truncate">{row.notes}</td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditForm(row)}
                            className="text-gray-400 hover:text-indigo-600 p-1"
                            aria-label="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(row.id)}
                            disabled={deletingId === row.id}
                            className="text-gray-400 hover:text-red-600 p-1 disabled:opacity-50"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/70 font-semibold text-gray-800">
                    <td className="px-4 py-2.5" colSpan={3}>Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{totals.kms.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-rose-700">{formatCurrency(incentiveTotal)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totals.petrol)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totals.food)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totals.other)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
