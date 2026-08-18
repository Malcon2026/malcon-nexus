import React, { useMemo, useState } from 'react';
import { Fuel, ShieldAlert, Ticket, XCircle, Camera, Search, Plus, UserPlus } from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useStore } from '../store/useStore';
import type { PetrolRequest, PetrolRequestStatus, Department } from '../types';
import { petrolStatusLabel, canManagePetrol, lastVehicleNo, PETROL_PRESET_AMOUNTS } from '../lib/petrol';
import { formatCurrency, formatDate } from '../utils/helpers';
import { DEFAULT_EMPLOYEE_PASSWORD } from '../lib/auth-sync';
import { EmployeePetrolSection } from '../components/EmployeePetrolSection';
import { getISTDateKey } from '../lib/attendance';
import { filterAttendanceStaff } from '../lib/staff';
import { ASSIGNABLE_DEPARTMENTS } from '../constants/departments';
import { PetrolOverview } from './PetrolOverview';

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 bg-white';
const labelClass = 'block text-xs font-medium text-gray-700 mb-1.5';

const statusBadge: Record<PetrolRequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  issued: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  receipt_submitted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
};

type FilterTab = 'pending' | 'issued' | 'receipt_submitted' | 'all';

const emptyStaffForm = {
  name: '',
  phone: '',
  employeeCode: '',
  department: 'Delivery' as Department,
  email: '',
};

export const PetrolDashboard: React.FC = () => {
  const currentUser = useStore((s) => s.currentUser);
  const employees = useStore((s) => s.employees);
  const petrolRequests = useStore((s) => s.petrolRequests);
  const issuePetrolToken = useStore((s) => s.issuePetrolToken);
  const rejectPetrolRequest = useStore((s) => s.rejectPetrolRequest);
  const addManualPetrolEntry = useStore((s) => s.addManualPetrolEntry);
  const createEmployee = useStore((s) => s.createEmployee);

  const [tab, setTab] = useState<FilterTab>('pending');
  const [query, setQuery] = useState('');
  const [issueFor, setIssueFor] = useState<PetrolRequest | null>(null);
  const [bookNo, setBookNo] = useState('');
  const [tokenNo, setTokenNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evidenceFor, setEvidenceFor] = useState<PetrolRequest | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualEmployeeId, setManualEmployeeId] = useState('');
  const [manualDate, setManualDate] = useState(getISTDateKey());
  const [manualVehicle, setManualVehicle] = useState('');
  const [manualAmountChoice, setManualAmountChoice] = useState<number | 'other'>(220);
  const [manualCustomAmount, setManualCustomAmount] = useState('');
  const [manualBook, setManualBook] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [manualKms, setManualKms] = useState('');
  const [manualBillReceived, setManualBillReceived] = useState(true);
  const [manualNotes, setManualNotes] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffPickerOpen, setStaffPickerOpen] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffForm, setStaffForm] = useState(emptyStaffForm);
  const [staffBusy, setStaffBusy] = useState(false);
  const [deskName, setDeskName] = useState('Petrol Desk');
  const [deskEmail, setDeskEmail] = useState('');
  const [deskPassword, setDeskPassword] = useState(DEFAULT_EMPLOYEE_PASSWORD);
  const [deskBusy, setDeskBusy] = useState(false);
  const [deskMsg, setDeskMsg] = useState<string | null>(null);
  const [deskView, setDeskView] = useState<'overview' | 'queue'>(
    currentUser.role === 'admin' ? 'overview' : 'queue',
  );

  const canManage = canManagePetrol(currentUser.role);
  const isMainAdmin = currentUser.role === 'admin';
  const petrolLogins = employees.filter((e) => e.role === 'petrol');
  const staffOptions = useMemo(
    () =>
      filterAttendanceStaff(employees).sort((a, b) => a.name.localeCompare(b.name)),
    [employees],
  );
  const filteredStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    if (!q) return staffOptions;
    return staffOptions.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.employeeCode || '').toLowerCase().includes(q) ||
        e.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')),
    );
  }, [staffOptions, staffSearch]);
  const selectedStaff = staffOptions.find((e) => e.id === manualEmployeeId) ?? null;
  const manualAmount =
    manualAmountChoice === 'other' ? Number(manualCustomAmount) : manualAmountChoice;

  const counts = useMemo(() => ({
    pending: petrolRequests.filter((r) => r.status === 'pending').length,
    issued: petrolRequests.filter((r) => r.status === 'issued').length,
    receipt_submitted: petrolRequests.filter((r) => r.status === 'receipt_submitted').length,
  }), [petrolRequests]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...petrolRequests]
      .filter((r) => (tab === 'all' ? true : r.status === tab))
      .filter((r) => {
        if (!q) return true;
        return (
          r.employeeName.toLowerCase().includes(q) ||
          r.vehicleNo.toLowerCase().includes(q) ||
          r.bookNo.toLowerCase().includes(q) ||
          r.tokenNo.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }, [petrolRequests, tab, query]);

  const handleCreateDeskLogin = async () => {
    setDeskMsg(null);
    const email = deskEmail.trim().toLowerCase();
    const name = deskName.trim() || 'Petrol Desk';
    const password = deskPassword.trim();
    if (!email) {
      setDeskMsg('Enter an email for the petrol login.');
      return;
    }
    if (password.length < 8) {
      setDeskMsg('Password must be at least 8 characters.');
      return;
    }
    setDeskBusy(true);
    try {
      await createEmployee(
        {
          name,
          email,
          phone: '',
          department: 'Office Staff',
          role: 'petrol',
        },
        { password },
      );
      setDeskMsg(`Petrol login created: ${email}`);
      setDeskEmail('');
    } catch (err) {
      setDeskMsg(err instanceof Error ? err.message : 'Could not create petrol login.');
    } finally {
      setDeskBusy(false);
    }
  };

  if (!canManage) {
    return (
      <div className="p-6 max-w-lg mx-auto mt-20">
        <Card className="p-8 text-center">
          <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900">Admin Access Required</h1>
          <p className="text-sm text-gray-500 mt-2">Petrol Dashboard is only available to administrators.</p>
        </Card>
      </div>
    );
  }

  if (isMainAdmin && deskView === 'overview') {
    return <PetrolOverview onOpenQueue={() => setDeskView('queue')} />;
  }

  const handleIssue = async () => {
    if (!issueFor) return;
    setError(null);
    setBusy(true);
    try {
      const result = await issuePetrolToken(issueFor.id, bookNo, tokenNo);
      if (result.error) {
        setError(result.error);
        return;
      }
      setIssueFor(null);
      setBookNo('');
      setTokenNo('');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      const result = await rejectPetrolRequest(id);
      if (result.error) setError(result.error);
    } finally {
      setBusy(false);
    }
  };

  const resetManualForm = () => {
    setManualEmployeeId('');
    setManualDate(getISTDateKey());
    setManualVehicle('');
    setManualAmountChoice(220);
    setManualCustomAmount('');
    setManualBook('');
    setManualToken('');
    setManualKms('');
    setManualBillReceived(true);
    setManualNotes('');
    setStaffSearch('');
    setStaffPickerOpen(false);
  };

  const openAddStaff = () => {
    setStaffForm(emptyStaffForm);
    setError(null);
    setShowAddStaff(true);
  };

  const handleAddStaff = async () => {
    setError(null);
    const name = staffForm.name.trim();
    const phone = staffForm.phone.trim();
    if (!name) {
      setError('Enter the employee name.');
      return;
    }
    if (!phone) {
      setError('Enter the employee phone number.');
      return;
    }
    setStaffBusy(true);
    try {
      const created = await createEmployee(
        {
          name,
          phone,
          employeeCode: staffForm.employeeCode.trim(),
          department: staffForm.department,
          email: staffForm.email.trim(),
          role: 'employee',
        },
        { skipLogin: currentUser.role !== 'admin' || !staffForm.email.trim() },
      );
      setManualEmployeeId(created.id);
      setStaffSearch('');
      const remembered = lastVehicleNo(petrolRequests, created.id);
      if (remembered) setManualVehicle(remembered);
      setShowAddStaff(false);
      setStaffForm(emptyStaffForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add employee.');
    } finally {
      setStaffBusy(false);
    }
  };

  const handleManualSave = async () => {
    setError(null);
    const kmsValue = manualKms.trim() === '' ? null : Number(manualKms);
    if (kmsValue != null && (!Number.isFinite(kmsValue) || kmsValue < 0)) {
      setError('Enter valid kms, or leave it blank.');
      return;
    }
    setBusy(true);
    try {
      const result = await addManualPetrolEntry({
        employeeId: manualEmployeeId,
        expenseDate: manualDate,
        vehicleNo: manualVehicle,
        amount: manualAmount,
        bookNo: manualBook,
        tokenNo: manualToken,
        kms: kmsValue,
        billReceived: manualBillReceived,
        notes: manualNotes,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setShowManual(false);
      resetManualForm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Petrol Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Request petrol yourself, issue tokens, or add a completed fill by hand.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isMainAdmin && (
            <Button type="button" variant="outline" size="sm" onClick={() => setDeskView('overview')}>
              Dashboard
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<UserPlus className="h-4 w-4" />}
            onClick={openAddStaff}
          >
            Add employee
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              resetManualForm();
              setError(null);
              setShowManual(true);
            }}
          >
            Manual entry
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <EmployeePetrolSection title="Request petrol" />
      </div>

      {isMainAdmin && (
        <Card className="p-4 mb-6">
          <p className="text-sm font-semibold text-gray-900">Petrol desk login</p>
          <p className="text-xs text-gray-500 mt-0.5 mb-3">
            Separate from the main admin. This login only opens Petrol Dashboard.
          </p>
          {petrolLogins.length > 0 && (
            <ul className="mb-3 space-y-1">
              {petrolLogins.map((e) => (
                <li key={e.id} className="text-sm text-gray-800">
                  {e.name} · <span className="font-mono text-xs">{e.email}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Name</label>
              <input className={inputClass} value={deskName} onChange={(e) => setDeskName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Email *</label>
              <input
                type="email"
                className={inputClass}
                value={deskEmail}
                onChange={(e) => setDeskEmail(e.target.value)}
                placeholder="petrol@company.com"
              />
            </div>
            <div>
              <label className={labelClass}>Password *</label>
              <input
                type="text"
                className={inputClass}
                value={deskPassword}
                onChange={(e) => setDeskPassword(e.target.value)}
              />
            </div>
          </div>
          {deskMsg && <p className="text-xs text-gray-600 mt-2">{deskMsg}</p>}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={deskBusy}
            onClick={() => void handleCreateDeskLogin()}
          >
            {deskBusy ? 'Creating…' : 'Create petrol login'}
          </Button>
        </Card>
      )}

      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        {[
          { label: 'Waiting for token', value: counts.pending, bg: 'bg-amber-50', icon: <Ticket className="h-4 w-4 text-amber-700" /> },
          { label: 'Awaiting receipt', value: counts.issued, bg: 'bg-indigo-50', icon: <Fuel className="h-4 w-4 text-indigo-700" /> },
          { label: 'Bill received', value: counts.receipt_submitted, bg: 'bg-emerald-50', icon: <Camera className="h-4 w-4 text-emerald-700" /> },
        ].map(({ label, value, bg, icon }) => (
          <Card key={label} className="p-4">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${bg} mb-2`}>{icon}</div>
            <p className="text-lg font-bold text-gray-900 tabular-nums">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {([
          { id: 'pending', label: `Need token (${counts.pending})` },
          { id: 'issued', label: `Awaiting bill (${counts.issued})` },
          { id: 'receipt_submitted', label: 'Bill received' },
          { id: 'all', label: 'All' },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              tab === item.id
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {item.label}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="search"
            className={`${inputClass} pl-8`}
            placeholder="Search name, vehicle, token…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardBody className="p-0 overflow-x-auto">
          {rows.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-gray-400">No petrol requests in this list</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Employee</th>
                  <th className="px-4 py-2.5">Vehicle</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5">Book no</th>
                  <th className="px-4 py-2.5">Token no</th>
                  <th className="px-4 py-2.5 text-right">Kms</th>
                  <th className="px-4 py-2.5">Evidence</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="bg-white">
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{formatDate(r.requestedAt)}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{r.employeeName}</td>
                    <td className="px-4 py-2.5 text-gray-700">{r.vehicleNo}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(r.amount)}</td>
                    <td className="px-4 py-2.5">{r.bookNo || '—'}</td>
                    <td className="px-4 py-2.5">{r.tokenNo || '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.kms ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {r.receiptUrl || r.kmsPhotoUrl ? (
                        <button
                          type="button"
                          className="text-indigo-600 hover:underline text-xs font-medium"
                          onClick={() => setEvidenceFor(r)}
                        >
                          View photos
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className={statusBadge[r.status]}>{petrolStatusLabel[r.status]}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {r.status === 'pending' && (
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="primary"
                            size="xs"
                            onClick={() => {
                              setIssueFor(r);
                              setBookNo('');
                              setTokenNo('');
                              setError(null);
                            }}
                          >
                            Issue token
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            icon={<XCircle className="h-3.5 w-3.5" />}
                            disabled={busy}
                            onClick={() => void handleReject(r.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Modal
        isOpen={showManual}
        onClose={() => setShowManual(false)}
        title="Manual petrol entry"
        subtitle="Log a fill that was already given — no employee request needed."
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowManual(false)}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void handleManualSave()}>
              {busy ? 'Saving…' : 'Save entry'}
            </Button>
          </div>
        }
      >
        <div className="p-4 space-y-4">
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-medium text-gray-700">Employee *</label>
              <Button
                type="button"
                variant="outline"
                size="xs"
                icon={<UserPlus className="h-3.5 w-3.5" />}
                onClick={openAddStaff}
              >
                Add employee
              </Button>
            </div>
            {selectedStaff ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{selectedStaff.name}</p>
                  <p className="text-xs text-gray-500">
                    {selectedStaff.employeeCode ? `ID ${selectedStaff.employeeCode}` : selectedStaff.department}
                    {selectedStaff.phone ? ` · ${selectedStaff.phone}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-gray-600 hover:text-gray-900 shrink-0"
                  onClick={() => {
                    setManualEmployeeId('');
                    setStaffSearch('');
                    setStaffPickerOpen(true);
                    setManualVehicle('');
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                <input
                  className={`${inputClass} pl-8`}
                  value={staffSearch}
                  onChange={(e) => {
                    setStaffSearch(e.target.value);
                    setStaffPickerOpen(true);
                  }}
                  onFocus={() => setStaffPickerOpen(true)}
                  onBlur={() => {
                    window.setTimeout(() => setStaffPickerOpen(false), 150);
                  }}
                  placeholder="Search name, ID or phone"
                  autoComplete="off"
                />
                {staffPickerOpen && (
                  <div className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {filteredStaff.length === 0 ? (
                      <p className="px-3 py-2.5 text-xs text-gray-400">No match. Use Add employee.</p>
                    ) : (
                      filteredStaff.slice(0, 8).map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => {
                            setManualEmployeeId(e.id);
                            setStaffSearch('');
                            setStaffPickerOpen(false);
                            const remembered = lastVehicleNo(petrolRequests, e.id);
                            if (remembered) setManualVehicle(remembered);
                          }}
                        >
                          <span className="text-sm text-gray-900">{e.name}</span>
                          <span className="block text-xs text-gray-500">
                            {e.employeeCode ? `ID ${e.employeeCode} · ` : ''}{e.department}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Date *</label>
              <input
                type="date"
                className={inputClass}
                value={manualDate}
                max={getISTDateKey()}
                onChange={(e) => setManualDate(e.target.value || getISTDateKey())}
              />
            </div>
            <div>
              <label className={labelClass}>Vehicle number *</label>
              <input
                className={inputClass}
                value={manualVehicle}
                onChange={(e) => setManualVehicle(e.target.value.toUpperCase())}
                placeholder="e.g. TS09AB1234"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Amount *</label>
            <div className="flex flex-wrap gap-2">
              {PETROL_PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setManualAmountChoice(amt)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
                    manualAmountChoice === amt
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-white text-gray-800 border-gray-200'
                  }`}
                >
                  {formatCurrency(amt)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setManualAmountChoice('other')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
                  manualAmountChoice === 'other'
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-white text-gray-800 border-gray-200'
                }`}
              >
                Other
              </button>
            </div>
            {manualAmountChoice === 'other' && (
              <input
                type="number"
                min={1}
                className={`${inputClass} mt-2`}
                value={manualCustomAmount}
                onChange={(e) => setManualCustomAmount(e.target.value)}
                placeholder="Amount in ₹"
              />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Book no *</label>
              <input
                className={inputClass}
                value={manualBook}
                onChange={(e) => setManualBook(e.target.value)}
                placeholder="e.g. 12"
              />
            </div>
            <div>
              <label className={labelClass}>Token no *</label>
              <input
                className={inputClass}
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="e.g. 45"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Kms (optional)</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={manualKms}
              onChange={(e) => setManualKms(e.target.value)}
              placeholder="Odometer after fill"
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={manualBillReceived}
              onChange={(e) => setManualBillReceived(e.target.checked)}
            />
            <span>
              Bill already received
              <span className="block text-xs text-gray-500 mt-0.5">
                Leave checked for past fills. Uncheck only if this token is still open at the pump.
              </span>
            </span>
          </label>
          <div>
            <label className={labelClass}>Notes</label>
            <input
              className={inputClass}
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAddStaff}
        onClose={() => setShowAddStaff(false)}
        title="Add employee"
        subtitle="Name and phone are enough. Email is only needed if they should log in."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddStaff(false)}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={staffBusy} onClick={() => void handleAddStaff()}>
              {staffBusy ? 'Saving…' : 'Save employee'}
            </Button>
          </div>
        }
      >
        <div className="p-4 space-y-4">
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
          <div>
            <label className={labelClass}>Full name *</label>
            <input
              className={inputClass}
              value={staffForm.name}
              onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
              placeholder="e.g. Surya"
            />
          </div>
          <div>
            <label className={labelClass}>Phone *</label>
            <input
              className={inputClass}
              value={staffForm.phone}
              onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
              placeholder="Mobile number"
            />
          </div>
          <div>
            <label className={labelClass}>Employee ID</label>
            <input
              className={inputClass}
              value={staffForm.employeeCode}
              onChange={(e) => setStaffForm({ ...staffForm, employeeCode: e.target.value })}
              placeholder="Optional attendance sheet ID"
            />
          </div>
          <div>
            <label className={labelClass}>Department *</label>
            <select
              className={inputClass}
              value={staffForm.department}
              onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value as Department })}
            >
              {ASSIGNABLE_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Email {isMainAdmin ? '(for app login)' : '(optional)'}</label>
            <input
              type="email"
              className={inputClass}
              value={staffForm.email}
              onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
              placeholder="Optional"
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!issueFor}
        onClose={() => setIssueFor(null)}
        title="Issue petrol token"
        subtitle={issueFor ? `${issueFor.employeeName} · ${formatCurrency(issueFor.amount)} · ${issueFor.vehicleNo}` : undefined}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIssueFor(null)}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void handleIssue()}>
              {busy ? 'Saving…' : 'Issue token'}
            </Button>
          </div>
        }
      >
        <div className="p-4 space-y-4">
          <div>
            <label className={labelClass}>Book no *</label>
            <input className={inputClass} value={bookNo} onChange={(e) => setBookNo(e.target.value)} placeholder="e.g. 12" />
          </div>
          <div>
            <label className={labelClass}>Token no *</label>
            <input className={inputClass} value={tokenNo} onChange={(e) => setTokenNo(e.target.value)} placeholder="e.g. 45" />
          </div>
          <p className="text-xs text-gray-500">
            From the second request, the boy uploads the last pump bill photo and kms photo.
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={!!evidenceFor}
        onClose={() => setEvidenceFor(null)}
        title="Petrol evidence"
        subtitle={
          evidenceFor
            ? `${evidenceFor.employeeName} · ${evidenceFor.vehicleNo}${evidenceFor.kms != null ? ` · ${evidenceFor.kms} km` : ''}`
            : undefined
        }
        size="lg"
      >
        <div className="space-y-4 p-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pump bill</p>
            {evidenceFor?.receiptUrl ? (
              <img src={evidenceFor.receiptUrl} alt="Pump receipt" className="w-full rounded-lg border border-gray-100" />
            ) : (
              <p className="text-sm text-gray-400">No bill photo</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Kms / odometer</p>
            {evidenceFor?.kmsPhotoUrl ? (
              <img src={evidenceFor.kmsPhotoUrl} alt="Kms meter" className="w-full rounded-lg border border-gray-100" />
            ) : (
              <p className="text-sm text-gray-400">No kms photo</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
