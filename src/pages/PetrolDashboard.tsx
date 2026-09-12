import React, { useMemo, useState } from 'react';
import { Fuel, ShieldAlert, Ticket, XCircle, Search, Trash2 } from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useStore } from '../store/useStore';
import type { PetrolRequest, PetrolRequestStatus } from '../types';
import {
  petrolStatusLabel,
  canManagePetrol,
  lastMeterReading,
  formatTripKms,
  PETROL_KM_THRESHOLD,
  PETROL_TOKEN_AMOUNT,
} from '../lib/petrol';
import { formatCurrency, formatDate } from '../utils/helpers';

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white';
const labelClass = 'block text-xs font-medium text-gray-700 mb-1.5';

const statusBadge: Record<PetrolRequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  issued: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  receipt_submitted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
};

type FilterTab = 'pending' | 'issued' | 'receipt_submitted' | 'all';

export const PetrolDashboard: React.FC = () => {
  const currentUser = useStore((s) => s.currentUser);
  const petrolRequests = useStore((s) => s.petrolRequests);
  const issuePetrolToken = useStore((s) => s.issuePetrolToken);
  const rejectPetrolRequest = useStore((s) => s.rejectPetrolRequest);
  const recordPetrolKms = useStore((s) => s.recordPetrolKms);
  const deletePetrolRequest = useStore((s) => s.deletePetrolRequest);

  const [tab, setTab] = useState<FilterTab>('pending');
  const [query, setQuery] = useState('');
  const [issueFor, setIssueFor] = useState<PetrolRequest | null>(null);
  const [bookNo, setBookNo] = useState('');
  const [tokenNo, setTokenNo] = useState('');
  const [kmsFor, setKmsFor] = useState<PetrolRequest | null>(null);
  const [kmsEnd, setKmsEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = canManagePetrol(currentUser.role);

  const counts = useMemo(
    () => ({
      pending: petrolRequests.filter((r) => r.status === 'pending').length,
      issued: petrolRequests.filter((r) => r.status === 'issued').length,
      receipt_submitted: petrolRequests.filter((r) => r.status === 'receipt_submitted').length,
    }),
    [petrolRequests],
  );

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

  if (!canManage) {
    return (
      <div className="p-6 max-w-lg mx-auto mt-20">
        <Card className="p-8 text-center">
          <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900">Admin Access Required</h1>
          <p className="text-sm text-gray-500 mt-2">Petrol tokens are managed by admin or petrol desk.</p>
        </Card>
      </div>
    );
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

  const handleRecordKms = async () => {
    if (!kmsFor) return;
    setError(null);
    setBusy(true);
    try {
      const result = await recordPetrolKms(kmsFor.id, Number(kmsEnd));
      if (result.error) {
        setError(result.error);
        return;
      }
      setKmsFor(null);
      setKmsEnd('');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (request: PetrolRequest) => {
    if (!window.confirm(`Reject token request from ${request.employeeName}?`)) return;
    setBusy(true);
    try {
      await rejectPetrolRequest(request.id);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (request: PetrolRequest) => {
    if (!window.confirm(`Delete petrol entry for ${request.employeeName}?`)) return;
    setBusy(true);
    try {
      await deletePetrolRequest(request.id);
    } finally {
      setBusy(false);
    }
  };

  const tabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'issued', label: 'Awaiting km', count: counts.issued },
    { id: 'receipt_submitted', label: 'Completed', count: counts.receipt_submitted },
    { id: 'all', label: 'All', count: petrolRequests.length },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto w-full min-w-0 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            <Fuel className="h-5 w-5 text-orange-600" />
            Petrol Tokens
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            ₹{PETROL_TOKEN_AMOUNT} per token · {PETROL_KM_THRESHOLD} km before next issue
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              tab === t.id
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t.label}
            {t.count > 0 ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="search"
          className={`${inputClass} pl-9`}
          placeholder="Search name, vehicle, book, token…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-gray-400">No entries in this list</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {rows.map((r) => {
                const startReading =
                  r.kmsStart ?? lastMeterReading(petrolRequests, r.employeeId);
                return (
                  <div key={r.id} className="px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{r.employeeName}</p>
                        <Badge className={statusBadge[r.status]}>{petrolStatusLabel[r.status]}</Badge>
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5">
                        {formatCurrency(r.amount)} · {r.vehicleNo}
                        {r.bookNo && r.tokenNo ? ` · Book ${r.bookNo} / Token ${r.tokenNo}` : ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(r.requestedAt)}
                        {r.kms != null ? ` · ${formatTripKms(r)}` : ''}
                        {r.status === 'issued' && startReading != null
                          ? ` · started at ${startReading} km`
                          : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {r.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            icon={<Ticket className="h-4 w-4" />}
                            disabled={busy}
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
                            size="sm"
                            variant="outline"
                            icon={<XCircle className="h-4 w-4" />}
                            disabled={busy}
                            onClick={() => void handleReject(r)}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {r.status === 'issued' && (
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={busy}
                          onClick={() => {
                            setKmsFor(r);
                            setKmsEnd('');
                            setError(null);
                          }}
                        >
                          Record km
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Trash2 className="h-4 w-4" />}
                        disabled={busy}
                        onClick={() => void handleDelete(r)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        isOpen={!!issueFor}
        onClose={() => setIssueFor(null)}
        title="Issue petrol token"
        subtitle={issueFor ? `${issueFor.employeeName} · ${formatCurrency(issueFor.amount)} · ${issueFor.vehicleNo}` : undefined}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIssueFor(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => void handleIssue()} disabled={busy}>
              Issue
            </Button>
          </div>
        }
      >
        <div className="p-4 space-y-3">
          <div>
            <label className={labelClass}>Book number *</label>
            <input className={inputClass} value={bookNo} onChange={(e) => setBookNo(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Token number *</label>
            <input className={inputClass} value={tokenNo} onChange={(e) => setTokenNo(e.target.value)} />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!kmsFor}
        onClose={() => setKmsFor(null)}
        title="Record km reading"
        subtitle={kmsFor ? `${kmsFor.employeeName} · Book ${kmsFor.bookNo} / Token ${kmsFor.tokenNo}` : undefined}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setKmsFor(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => void handleRecordKms()} disabled={busy}>
              Save
            </Button>
          </div>
        }
      >
        <div className="p-4 space-y-3">
          {kmsFor && (
            <p className="text-xs text-gray-500">
              Last reading:{' '}
              <span className="font-semibold text-gray-800 tabular-nums">
                {kmsFor.kmsStart ?? lastMeterReading(petrolRequests, kmsFor.employeeId) ?? '—'}
              </span>
            </p>
          )}
          <div>
            <label className={labelClass}>Current odometer (km) *</label>
            <input
              type="number"
              min={0}
              step="0.1"
              className={inputClass}
              value={kmsEnd}
              onChange={(e) => setKmsEnd(e.target.value)}
              placeholder="e.g. 45200"
            />
          </div>
          <p className="text-xs text-gray-500">
            Employee needs {PETROL_KM_THRESHOLD} km on this fill before the next ₹{PETROL_TOKEN_AMOUNT} token.
          </p>
        </div>
      </Modal>
    </div>
  );
};
