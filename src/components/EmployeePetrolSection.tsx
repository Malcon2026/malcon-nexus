import React, { useMemo, useState } from 'react';
import { Fuel, Send, XCircle, Camera } from 'lucide-react';
import { Card, CardBody, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useStore } from '../store/useStore';
import type { PetrolRequest } from '../types';
import {
  PETROL_PRESET_AMOUNTS,
  getBlockingPetrolRequest,
  lastVehicleNo,
  petrolStatusLabel,
} from '../lib/petrol';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import { MAX_RAW_PHOTO_BYTES } from '../lib/stagePhotos';
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

export const EmployeePetrolSection: React.FC = () => {
  const currentUser = useStore((s) => s.currentUser);
  const petrolRequests = useStore((s) => s.petrolRequests);
  const requestPetrol = useStore((s) => s.requestPetrol);
  const cancelPetrolRequest = useStore((s) => s.cancelPetrolRequest);
  const submitPetrolReceipt = useStore((s) => s.submitPetrolReceipt);

  const [amountChoice, setAmountChoice] = useState<number | 'other'>(220);
  const [customAmount, setCustomAmount] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [notes, setNotes] = useState('');
  const [kms, setKms] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
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

  const blocking = getBlockingPetrolRequest(petrolRequests, currentUser.id);
  const rememberedVehicle = lastVehicleNo(petrolRequests, currentUser.id);

  const resolvedAmount =
    amountChoice === 'other' ? Number(customAmount) : amountChoice;

  const handleRequest = async () => {
    setError(null);
    setSuccess(null);
    const vehicle = vehicleNo.trim() || rememberedVehicle;
    if (!vehicle) {
      setError('Enter the vehicle number.');
      return;
    }
    if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) {
      setError('Enter a valid amount (usually ₹110 or ₹220).');
      return;
    }
    setSubmitting(true);
    try {
      const result = await requestPetrol(resolvedAmount, vehicle, notes);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess('Request sent. Wait for admin to issue book and token number.');
      setNotes('');
      setCustomAmount('');
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
      setSuccess('Request cancelled. You can request petrol again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceipt = async () => {
    if (!blocking) return;
    setError(null);
    setSuccess(null);
    const kmValue = Number(kms);
    if (!Number.isFinite(kmValue) || kmValue < 0) {
      setError('Enter the kms after filling petrol.');
      return;
    }
    if (!photo) {
      setError('Take a photo of the pump receipt.');
      return;
    }
    if (photo.size > MAX_RAW_PHOTO_BYTES) {
      setError('Photo is too large. Please take a clearer, smaller photo.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitPetrolReceipt(blocking.id, kmValue, photo);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess('Receipt submitted. You can request the next token now.');
      setKms('');
      setPhoto(null);
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
              <p className="text-sm font-bold text-gray-900">Petrol</p>
              <Te className="text-gray-500 mb-0">Petrol token</Te>
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

          {blocking?.status === 'pending' && (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3">
              <p className="text-sm font-semibold text-amber-900">Waiting for book &amp; token</p>
              <Te className="text-amber-800 mb-0">Admin token istharu — wait cheyandi</Te>
              <p className="text-sm text-amber-900">
                {formatCurrency(blocking.amount)} · {blocking.vehicleNo}
              </p>
              <p className="text-xs text-amber-700">Next request opens only after you submit the pump receipt.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<XCircle className="h-4 w-4" />}
                disabled={submitting}
                onClick={() => void handleCancel(blocking.id)}
              >
                Cancel request
              </Button>
            </div>
          )}

          {blocking?.status === 'issued' && (
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/60 space-y-4">
              <div>
                <p className="text-sm font-semibold text-indigo-900">Fill at the pump, then submit the bill</p>
                <Te className="text-indigo-800 mb-0">Petrol vesukoni bill photo pettandi</Te>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-white border border-indigo-100 px-3 py-2">
                    <p className="text-[11px] text-gray-500">Book no</p>
                    <p className="font-bold text-gray-900">{blocking.bookNo}</p>
                  </div>
                  <div className="rounded-lg bg-white border border-indigo-100 px-3 py-2">
                    <p className="text-[11px] text-gray-500">Token no</p>
                    <p className="font-bold text-gray-900">{blocking.tokenNo}</p>
                  </div>
                  <div className="rounded-lg bg-white border border-indigo-100 px-3 py-2">
                    <p className="text-[11px] text-gray-500">Amount</p>
                    <p className="font-bold text-gray-900">{formatCurrency(blocking.amount)}</p>
                  </div>
                  <div className="rounded-lg bg-white border border-indigo-100 px-3 py-2">
                    <p className="text-[11px] text-gray-500">Vehicle</p>
                    <p className="font-bold text-gray-900">{blocking.vehicleNo}</p>
                  </div>
                </div>
              </div>
              <div>
                <label className={labelClass}>Kms after fill *</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className={inputClass}
                  value={kms}
                  onChange={(e) => setKms(e.target.value)}
                  placeholder="e.g. 45210"
                />
              </div>
              <div>
                <label className={labelClass}>Pump receipt photo *</label>
                <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-indigo-200 rounded-lg bg-white cursor-pointer text-sm text-gray-700">
                  <Camera className="h-4 w-4 text-indigo-600" />
                  {photo ? photo.name : 'Take or choose photo'}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={<Send className="h-4 w-4" />}
                disabled={submitting}
                onClick={() => void handleReceipt()}
              >
                {submitting ? 'Submitting…' : 'Submit receipt'}
              </Button>
            </div>
          )}

          {!blocking && (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void handleRequest();
              }}
              className="space-y-4 p-4 bg-orange-50/50 border border-orange-100 rounded-xl"
            >
              <p className="text-sm font-semibold text-gray-900">Request petrol token</p>
              <Te className="text-gray-500 mb-0">Amount + vehicle number</Te>
              <div>
                <label className={labelClass}>Amount *</label>
                <div className="flex flex-wrap gap-2">
                  {PETROL_PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmountChoice(amt)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
                        amountChoice === amt
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-white text-gray-800 border-gray-200'
                      }`}
                    >
                      {formatCurrency(amt)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAmountChoice('other')}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
                      amountChoice === 'other'
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white text-gray-800 border-gray-200'
                    }`}
                  >
                    Other
                  </button>
                </div>
                {amountChoice === 'other' && (
                  <input
                    type="number"
                    min={1}
                    className={`${inputClass} mt-2`}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Amount in ₹"
                  />
                )}
              </div>
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
                {submitting ? 'Sending…' : 'Request petrol'}
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
                        {r.kms != null ? ` · ${r.kms} km` : ''}
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
