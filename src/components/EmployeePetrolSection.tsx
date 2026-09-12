import React, { useMemo, useState } from 'react';
import { Fuel, Send, XCircle } from 'lucide-react';
import { Card, CardBody, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useStore } from '../store/useStore';
import type { PetrolRequest } from '../types';
import {
  PETROL_KM_THRESHOLD,
  PETROL_TOKEN_AMOUNT,
  canRequestPetrolToken,
  getIssuedAwaitingKms,
  getPendingPetrolRequests,
  lastVehicleNo,
  petrolStatusLabel,
  formatTripKms,
} from '../lib/petrol';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import { Te } from './BilingualText';

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white';
const labelClass = 'block text-xs font-medium text-gray-700 mb-1.5';

const statusBadge: Record<PetrolRequest['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  issued: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  receipt_submitted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const EmployeePetrolSection: React.FC<{ title?: string }> = ({ title = 'Petrol' }) => {
  const currentUser = useStore((s) => s.currentUser);
  const petrolRequests = useStore((s) => s.petrolRequests);
  const requestPetrol = useStore((s) => s.requestPetrol);
  const cancelPetrolRequest = useStore((s) => s.cancelPetrolRequest);

  const [vehicleNo, setVehicleNo] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mine = useMemo(
    () =>
      petrolRequests
        .filter((r) => r.employeeId === currentUser.id)
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()),
    [petrolRequests, currentUser.id],
  );

  const pendingList = getPendingPetrolRequests(petrolRequests, currentUser.id);
  const activeToken = getIssuedAwaitingKms(petrolRequests, currentUser.id);
  const rememberedVehicle = lastVehicleNo(petrolRequests, currentUser.id);
  const eligibility = canRequestPetrolToken(petrolRequests, currentUser.id);
  const canRequest = eligibility.ok && pendingList.length === 0;

  const handleRequest = async () => {
    setError(null);
    setSuccess(null);
    const vehicle = vehicleNo.trim() || rememberedVehicle;
    if (!vehicle) {
      setError('Enter the vehicle number.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestPetrol(vehicle, notes);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(`Token request sent (₹${PETROL_TOKEN_AMOUNT}). Admin will issue book & token.`);
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send petrol request. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const result = await cancelPetrolRequest(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess('Request cancelled.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <Fuel className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{title}</p>
              <Te className="text-gray-500 mb-0">Petrol token · ₹{PETROL_TOKEN_AMOUNT}</Te>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {success}
            </p>
          )}

          {pendingList.map((pending) => (
            <div key={pending.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3">
              <p className="text-sm font-semibold text-amber-900">Waiting for book &amp; token</p>
              <p className="text-sm text-amber-900">
                {formatCurrency(pending.amount)} · {pending.vehicleNo}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<XCircle className="h-4 w-4" />}
                disabled={submitting}
                onClick={() => void handleCancel(pending.id)}
              >
                Cancel request
              </Button>
            </div>
          ))}

          {activeToken && (
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/60 space-y-2">
              <p className="text-sm font-semibold text-indigo-900">Active token — fill at pump</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-white border border-indigo-100 px-3 py-2">
                  <p className="text-[11px] text-gray-500">Book no</p>
                  <p className="font-bold text-gray-900">{activeToken.bookNo}</p>
                </div>
                <div className="rounded-lg bg-white border border-indigo-100 px-3 py-2">
                  <p className="text-[11px] text-gray-500">Token no</p>
                  <p className="font-bold text-gray-900">{activeToken.tokenNo}</p>
                </div>
                <div className="rounded-lg bg-white border border-indigo-100 px-3 py-2">
                  <p className="text-[11px] text-gray-500">Amount</p>
                  <p className="font-bold text-gray-900">{formatCurrency(activeToken.amount)}</p>
                </div>
                <div className="rounded-lg bg-white border border-indigo-100 px-3 py-2">
                  <p className="text-[11px] text-gray-500">Vehicle</p>
                  <p className="font-bold text-gray-900">{activeToken.vehicleNo}</p>
                </div>
              </div>
              <p className="text-xs text-indigo-800">
                After use, tell admin your km reading. Next token after {PETROL_KM_THRESHOLD} km.
              </p>
            </div>
          )}

          {!canRequest && !pendingList.length && !activeToken && !eligibility.ok && (
            <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              {eligibility.reason}
            </p>
          )}

          {canRequest && (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void handleRequest();
              }}
              className="space-y-4 p-4 bg-orange-50/50 border border-orange-100 rounded-xl"
            >
              <p className="text-sm font-semibold text-gray-900">Request petrol token</p>
              <p className="text-xs text-gray-500">₹{PETROL_TOKEN_AMOUNT} per token · {PETROL_KM_THRESHOLD} km before next token</p>
              <div>
                <label className={labelClass}>Vehicle number *</label>
                <input
                  type="text"
                  className={inputClass}
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                  placeholder={rememberedVehicle || 'e.g. TS09AB1234'}
                />
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <input
                  type="text"
                  className={inputClass}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <Button type="submit" variant="primary" size="sm" icon={<Send className="h-4 w-4" />} disabled={submitting}>
                {submitting ? 'Sending…' : `Request ₹${PETROL_TOKEN_AMOUNT} token`}
              </Button>
            </form>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm font-bold text-gray-900">My petrol history</p>
        </CardHeader>
        <CardBody className="p-0">
          {mine.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">No petrol requests yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {mine.slice(0, 12).map((r) => (
                <div key={r.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(r.amount)} · {r.vehicleNo}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDateTime(r.requestedAt)}
                        {r.bookNo && r.tokenNo ? ` · Book ${r.bookNo} / Token ${r.tokenNo}` : ''}
                        {r.kms != null ? ` · ${formatTripKms(r)}` : ''}
                      </p>
                    </div>
                    <Badge className={statusBadge[r.status]}>{petrolStatusLabel[r.status]}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
