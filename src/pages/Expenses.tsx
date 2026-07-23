import React, { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, Plus, Pencil, Trash2, Fuel, X, IndianRupee, Check, Download, CalendarDays, CalendarRange } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useStore } from '../store/useStore';
import type { Department, DailyExpense } from '../types';
import { formatCurrency, departmentColors } from '../utils/helpers';
import { getISTDateKey } from '../lib/attendance';
import { exportExpenseDetailCsv } from '../utils/reportsExport';
import {
  buildExpenseRegister,
  exportExpenseRegisterCsv,
  metricValueForEntry,
  EXPENSE_METRICS,
  type ExpenseMetric,
  type ExpenseRegisterDayColumn,
  type ExpenseRegisterEmployeeRow,
} from '../lib/expenseRegister';

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 bg-white';
const labelClass = 'block text-xs font-medium text-gray-700 mb-1.5';

type EntriesView = 'day' | 'month';

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

function emptyForm(defaultDate: string): FormState {
  return {
    employeeId: '',
    expenseDate: defaultDate,
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

function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function monthBoundsFor(monthValue: string): { from: string; to: string } {
  const [y, m] = monthValue.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${monthValue}-01`, to: `${monthValue}-${String(lastDay).padStart(2, '0')}` };
}

/** Pure UTC-based date-key arithmetic — avoids local-timezone off-by-one bugs. */
function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
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

  const today = getISTDateKey();
  const now = new Date();
  const [entriesView, setEntriesView] = useState<EntriesView>('day');
  const [selectedDate, setSelectedDate] = useState(today);
  const [monthValue, setMonthValue] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  );
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(today));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState('');
  const [rateSaving, setRateSaving] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [registerMetric, setRegisterMetric] = useState<ExpenseMetric>('expense');
  const [registerDetail, setRegisterDetail] = useState<{
    row: ExpenseRegisterEmployeeRow;
    day: ExpenseRegisterDayColumn;
    entry: DailyExpense | null;
  } | null>(null);

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

  // Daily tracker: every expense entered for one specific date, across employees.
  const dayRows = useMemo(
    () =>
      dailyExpenses
        .filter((e) => e.expenseDate === selectedDate)
        .filter((e) => filterEmployeeId === 'all' || e.employeeId === filterEmployeeId)
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
    [dailyExpenses, selectedDate, filterEmployeeId],
  );

  // Whole-month view, for anyone who wants to eyeball everything at once.
  const monthRows = useMemo(
    () =>
      dailyExpenses
        .filter((e) => e.expenseDate.startsWith(monthValue))
        .filter((e) => filterEmployeeId === 'all' || e.employeeId === filterEmployeeId)
        .sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : -1)),
    [dailyExpenses, monthValue, filterEmployeeId],
  );

  const scopeRows = entriesView === 'day' ? dayRows : monthRows;
  const scopeLabel = entriesView === 'day' ? formatDayLabel(selectedDate) : formatMonthLabel(monthValue);

  const totals = useMemo(
    () =>
      scopeRows.reduce(
        (acc, r) => ({
          kms: acc.kms + r.kmsDriven,
          petrol: acc.petrol + r.petrolAmount,
          food: acc.food + r.foodAmount,
          other: acc.other + r.otherAmount,
        }),
        { kms: 0, petrol: 0, food: 0, other: 0 },
      ),
    [scopeRows],
  );
  const grandTotal = totals.petrol + totals.food + totals.other;
  const incentiveTotal = totals.kms * incentiveRatePerKm;

  // Month register: one row per employee, one column per day of the picked month.
  const register = useMemo(() => {
    const [regYear, regMonth] = monthValue.split('-').map(Number);
    return buildExpenseRegister(
      activeEmployees,
      dailyExpenses,
      regYear,
      regMonth,
      incentiveRatePerKm,
      filterEmployeeId !== 'all' ? { employeeId: filterEmployeeId } : undefined,
    );
  }, [activeEmployees, dailyExpenses, monthValue, incentiveRatePerKm, filterEmployeeId]);

  const registerWeekBands = useMemo(() => {
    const bands: { week: number; span: number }[] = [];
    let currentWeek = register.days[0]?.weekNumber ?? 1;
    let span = 0;
    for (const day of register.days) {
      if (day.weekNumber === currentWeek) {
        span++;
      } else {
        bands.push({ week: currentWeek, span });
        currentWeek = day.weekNumber;
        span = 1;
      }
    }
    if (span > 0) bands.push({ week: currentWeek, span });
    return bands;
  }, [register.days]);

  const handleExportRegisterCsv = () => {
    exportExpenseRegisterCsv(register, registerMetric);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDailyExpenses();
    } finally {
      setRefreshing(false);
    }
  };

  const openNewForm = (prefill?: { employeeId?: string; date?: string }) => {
    setForm({
      ...emptyForm(prefill?.date ?? (entriesView === 'day' ? selectedDate : `${monthValue}-01`)),
      employeeId: prefill?.employeeId ?? '',
    });
    setFormError(null);
    setShowForm(true);
    setRegisterDetail(null);
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
    setRegisterDetail(null);
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
      // Jump the daily tracker to whatever date was just saved, so it's visible immediately.
      if (entriesView === 'day') setSelectedDate(form.expenseDate);
      setShowForm(false);
      setForm(emptyForm(entriesView === 'day' ? selectedDate : today));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense entry?')) return;
    setDeletingId(id);
    try {
      await deleteDailyExpense(id);
      setRegisterDetail((d) => (d?.entry?.id === id ? null : d));
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportMonthCsv = () => {
    setExportError(null);
    setExportSuccess(null);
    setExporting(true);
    try {
      const bounds = monthBoundsFor(monthValue);
      const result = exportExpenseDetailCsv(
        dailyExpenses,
        { range: 'custom', customFrom: bounds.from, customTo: bounds.to },
        incentiveRatePerKm,
      );
      setExportSuccess(`Downloaded ${result.count} row(s) → ${result.filename}`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
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
    <div className="p-4 sm:p-6 w-full min-w-0 overflow-x-hidden">
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
          <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => openNewForm()}>
            Add expense
          </Button>
        </div>
      </div>

      {/* Summary cards — scoped to whichever day/month is currently selected below */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-3">
        {[
          { label: 'Total kms driven', value: totals.kms.toLocaleString('en-IN'), bg: 'bg-indigo-50', icon: <Fuel className="h-4 w-4 text-indigo-700" /> },
          { label: 'Petrol', value: formatCurrency(totals.petrol), bg: 'bg-orange-50', icon: <Fuel className="h-4 w-4 text-orange-700" /> },
          { label: 'Food', value: formatCurrency(totals.food), bg: 'bg-emerald-50', icon: <Fuel className="h-4 w-4 text-emerald-700" /> },
          { label: 'Other', value: formatCurrency(totals.other), bg: 'bg-purple-50', icon: <Fuel className="h-4 w-4 text-purple-700" /> },
          { label: `Km incentive (₹${incentiveRatePerKm}/km)`, value: formatCurrency(incentiveTotal), bg: 'bg-rose-50', icon: <IndianRupee className="h-4 w-4 text-rose-700" /> },
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
          Totals for <span className="font-semibold text-gray-600">{scopeLabel}</span>: {formatCurrency(grandTotal)} (petrol + food + other)
          {filterEmployeeId !== 'all' ? ' · filtered to one employee' : ''}
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
                  max={today}
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
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setEntriesView('day')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  entriesView === 'day' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" /> Daily tracker
              </button>
              <button
                type="button"
                onClick={() => setEntriesView('month')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  entriesView === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CalendarRange className="h-3.5 w-3.5" /> Month register
              </button>
            </div>
            <div className="flex items-center gap-2">
              {entriesView === 'day' ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedDate((d) => shiftDateKey(d, -1))}
                    className="px-2 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500"
                    aria-label="Previous day"
                  >
                    ‹
                  </button>
                  <input
                    type="date"
                    className={`${inputClass} w-auto`}
                    value={selectedDate}
                    max={today}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedDate((d) => shiftDateKey(d, 1))}
                    disabled={selectedDate >= today}
                    className="px-2 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 disabled:opacity-40"
                    aria-label="Next day"
                  >
                    ›
                  </button>
                  {selectedDate !== today && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate(today)}
                      className="text-xs text-gray-500 hover:text-gray-800 underline"
                    >
                      Today
                    </button>
                  )}
                </div>
              ) : (
                <input
                  type="month"
                  className={`${inputClass} w-auto`}
                  value={monthValue}
                  onChange={(e) => setMonthValue(e.target.value)}
                />
              )}
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
              {entriesView === 'month' && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Download className="h-3.5 w-3.5" />}
                  onClick={handleExportRegisterCsv}
                >
                  Export CSV
                </Button>
              )}
            </div>
          </div>
          {entriesView === 'month' && (
            <p className="text-xs text-gray-600 mt-3">
              <span className="font-medium text-gray-800">{register.cycleLabel}</span>
              <span className="text-gray-400 mx-1.5">·</span>
              {register.cycleDescription}
            </p>
          )}
          {entriesView === 'month' && (
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mt-2">
              {EXPENSE_METRICS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRegisterMetric(id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    registerMetric === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {entriesView === 'day' ? (
            dayRows.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">
                No expense entries for {scopeLabel}
                {filterEmployeeId !== 'all' ? ' for this employee' : ''}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
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
                    {dayRows.map((row) => {
                      const employee = employees.find((e) => e.id === row.employeeId);
                      return (
                        <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50">
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
                      <td className="px-4 py-2.5" colSpan={2}>Total</td>
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
            )
          ) : register.rows.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">
              No active employees to display{filterEmployeeId !== 'all' ? ' for this employee' : ''}.
            </p>
          ) : (
            <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
              <table
                className="border-collapse text-xs table-fixed"
                style={{ minWidth: `${140 + 110 + register.days.length * 34 + 3 * 74}px`, width: '100%' }}
              >
                <colgroup>
                  <col style={{ width: 140 }} />
                  <col style={{ width: 110 }} />
                  {register.days.map((day) => (
                    <col key={day.dateKey} />
                  ))}
                  <col style={{ width: 74 }} />
                  <col style={{ width: 74 }} />
                  <col style={{ width: 74 }} />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th rowSpan={2} className="sticky left-0 z-20 bg-gray-50 border-r border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                      Employee
                    </th>
                    <th rowSpan={2} className="sticky left-[140px] z-20 bg-gray-50 border-r border-gray-200 px-2 py-2 text-left font-semibold text-gray-600">
                      Dept
                    </th>
                    {registerWeekBands.map(({ week, span }) => (
                      <th key={`w${week}`} colSpan={span} className="border-r border-gray-200 px-1 py-1 text-center font-medium text-gray-500 bg-gray-100/80">
                        Week {week}
                      </th>
                    ))}
                    <th colSpan={3} className="border-l border-gray-200 px-1 py-1 text-center font-medium text-gray-500 bg-gray-100/80">
                      Totals
                    </th>
                  </tr>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {register.days.map((day) => (
                      <th
                        key={day.dateKey}
                        className={`border-r border-gray-100 px-0.5 py-1 text-center ${
                          day.isToday ? 'bg-indigo-50' : day.isWeeklyOff ? 'bg-gray-100/60' : ''
                        }`}
                        title={`${day.weekday} ${day.dateKey}`}
                      >
                        {day.monthShort && (
                          <div className="text-[8px] text-gray-400 font-medium leading-none mb-0.5">{day.monthShort}</div>
                        )}
                        <div className={`font-semibold ${day.isToday ? 'text-indigo-700' : 'text-gray-700'}`}>{day.day}</div>
                        <div className="text-[9px] text-gray-400 font-normal">{day.weekday.charAt(0)}</div>
                      </th>
                    ))}
                    <th className="border-l border-gray-100 px-1 py-1 text-center font-semibold text-sky-700 bg-sky-50">Total Kms</th>
                    <th className="px-1 py-1 text-center font-semibold text-rose-700 bg-rose-50">Incentive Total</th>
                    <th className="px-1 py-1 text-center font-semibold text-gray-800 bg-gray-50">Total Expense</th>
                  </tr>
                </thead>
                <tbody>
                  {register.rows.map((row) => (
                    <tr key={row.employeeId} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                        {row.employeeName}
                      </td>
                      <td className="sticky left-[140px] z-10 bg-white border-r border-gray-200 px-2 py-2">
                        <Badge className={`${departmentColors[row.department as Department] ?? 'bg-gray-100 text-gray-700'} text-[10px]`}>
                          {row.department}
                        </Badge>
                      </td>
                      {row.entries.map((entry, idx) => {
                        const day = register.days[idx];
                        const value = metricValueForEntry(entry, registerMetric);
                        return (
                          <td
                            key={day.dateKey}
                            className={`border-r border-gray-50 px-0.5 py-1 text-center ${day.isToday ? 'ring-1 ring-inset ring-indigo-200' : ''}`}
                          >
                            <button
                              type="button"
                              onClick={() => setRegisterDetail({ row, day, entry })}
                              className={`inline-flex h-6 w-full max-w-[42px] items-center justify-center rounded font-semibold text-[10px] border ${
                                entry
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'
                                  : 'bg-gray-50 text-gray-300 border-transparent hover:bg-gray-100'
                              }`}
                              title={day.dateKey}
                            >
                              {value == null ? '—' : registerMetric === 'kms' ? value : `₹${value.toLocaleString('en-IN')}`}
                            </button>
                          </td>
                        );
                      })}
                      <td className="border-l border-gray-100 px-1 py-2 text-center font-semibold text-sky-700 bg-sky-50/60">
                        {row.totalKms.toLocaleString('en-IN')}
                      </td>
                      <td className="px-1 py-2 text-center font-semibold text-rose-700 bg-rose-50/60">
                        {formatCurrency(row.incentiveTotal)}
                      </td>
                      <td className="px-1 py-2 text-center font-semibold text-gray-800 bg-gray-50">
                        {formatCurrency(row.totalExpense)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/70 font-semibold text-gray-800">
                    <td className="sticky left-0 z-10 bg-gray-50/70 border-r border-gray-200 px-3 py-2" colSpan={2}>
                      Column total
                    </td>
                    {register.days.map((day, idx) => {
                      const sum = register.rows.reduce(
                        (acc, row) => acc + (metricValueForEntry(row.entries[idx], registerMetric) ?? 0),
                        0,
                      );
                      return (
                        <td key={day.dateKey} className="border-r border-gray-50 px-0.5 py-2 text-center">
                          {sum ? (registerMetric === 'kms' ? sum : `₹${sum.toLocaleString('en-IN')}`) : '—'}
                        </td>
                      );
                    })}
                    <td className="border-l border-gray-100 px-1 py-2 text-center text-sky-700 bg-sky-50/60">
                      {register.grandKms.toLocaleString('en-IN')}
                    </td>
                    <td className="px-1 py-2 text-center text-rose-700 bg-rose-50/60">
                      {formatCurrency(register.grandIncentive)}
                    </td>
                    <td className="px-1 py-2 text-center bg-gray-50">
                      {formatCurrency(register.grandExpense)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Month-end mega export — every entry + incentive, for whichever month is picked here. */}
      <Card className="mt-6">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Month-end export</p>
            <p className="text-xs text-gray-500 mt-0.5">
              One CSV with every entry (date, employee, kms, incentive, petrol, food, other, notes) for the chosen month.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="month"
              className={`${inputClass} w-auto`}
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value)}
            />
            <Button
              variant="primary"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={handleExportMonthCsv}
              disabled={exporting}
            >
              {exporting ? 'Exporting…' : `Download ${formatMonthLabel(monthValue)} CSV`}
            </Button>
          </div>
        </CardBody>
        {(exportError || exportSuccess) && (
          <div className="px-5 pb-4 -mt-2">
            {exportError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{exportError}</p>
            )}
            {exportSuccess && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{exportSuccess}</p>
            )}
          </div>
        )}
      </Card>

      {registerDetail && (
        <Modal
          isOpen
          onClose={() => setRegisterDetail(null)}
          title={registerDetail.row.employeeName}
          subtitle={`${registerDetail.day.weekday}, ${registerDetail.day.dateKey}`}
          size="sm"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setRegisterDetail(null)}>Close</Button>
              {registerDetail.entry ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => void handleDelete(registerDetail.entry!.id)}
                    disabled={deletingId === registerDetail.entry.id}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => openEditForm(registerDetail.entry!)}
                  >
                    Edit
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() =>
                    openNewForm({ employeeId: registerDetail.row.employeeId, date: registerDetail.day.dateKey })
                  }
                  disabled={registerDetail.day.isFuture}
                >
                  Add expense
                </Button>
              )}
            </div>
          }
        >
          <div className="p-6 space-y-1 text-sm">
            {registerDetail.entry ? (
              <>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Kms driven</span>
                  <span className="font-medium text-gray-900">{registerDetail.entry.kmsDriven || 0}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Km incentive (₹{incentiveRatePerKm}/km)</span>
                  <span className="font-medium text-rose-700">
                    {formatCurrency((registerDetail.entry.kmsDriven || 0) * incentiveRatePerKm)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Petrol</span>
                  <span className="font-medium text-gray-900">{formatCurrency(registerDetail.entry.petrolAmount)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Food</span>
                  <span className="font-medium text-gray-900">{formatCurrency(registerDetail.entry.foodAmount)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">
                    Other{registerDetail.entry.otherDescription ? ` (${registerDetail.entry.otherDescription})` : ''}
                  </span>
                  <span className="font-medium text-gray-900">{formatCurrency(registerDetail.entry.otherAmount)}</span>
                </div>
                <div className="flex justify-between py-1.5 font-semibold">
                  <span className="text-gray-800">Day expense (petrol + food + other)</span>
                  <span className="text-gray-900">
                    {formatCurrency(
                      registerDetail.entry.petrolAmount + registerDetail.entry.foodAmount + registerDetail.entry.otherAmount,
                    )}
                  </span>
                </div>
                {registerDetail.entry.notes && (
                  <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-3 mt-2">
                    {registerDetail.entry.notes}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 py-4">
                {registerDetail.day.isFuture ? 'This date is in the future.' : 'No entry for this day.'}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
