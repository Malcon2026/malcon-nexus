import React, { useState, useEffect } from 'react';
import { Send, Loader2, Package, ShoppingCart, Ban, ParkingCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { StagePhotoCapture, type CapturedPhoto } from './StagePhotoCapture';
import { useStore } from '../store/useStore';
import type { ImplantCase, RestockOutcome, ReturnOutcome, WorkflowStage } from '../types';
import { RETURN_OUTCOMES } from '../lib/returnPickup';
import { normalizeWorkflowStage } from '../utils/helpers';
import { formatUnknownError } from '../utils/errors';

const STAGE_ACTIONS: Record<WorkflowStage, string> = {
  'Set Preparation': 'Submit to Admin',
  'Delivery': 'Mark Delivery Completed',
  'Surgery': 'Mark Surgery Completed',
  'Pickup from Hospital': 'Mark Pickup Completed',
  'Cleaning & Audit': 'Mark Cleaning & Audit Completed',
  'Restock': 'Restock',
  'Billing': 'Invoice Generated',
  'Bill Submission': 'Bill Submission Completed',
  'Completed': 'Close Case',
};

interface SubmitStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  implantCase: ImplantCase;
}

export const SubmitStageModal: React.FC<SubmitStageModalProps> = ({
  isOpen,
  onClose,
  implantCase: initialCase,
}) => {
  const { submitStage, currentUser, cases, viewMode } = useStore();
  const c = cases.find((x) => x.id === initialCase.id) ?? initialCase;

  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNotes('');
      setPhotos([]);
      setUploadProgress(null);
      setError(null);
    }
  }, [isOpen, c.id]);

  const stage = normalizeWorkflowStage(c.currentStage);
  const isRestock = stage === 'Restock';
  const isPickup = stage === 'Pickup from Hospital';
  const isStoreSetPrep =
    viewMode === 'store_manager' && stage === 'Set Preparation';
  const title = isRestock
    ? 'Restock'
    : isPickup
      ? 'Return (pickup)'
      : isStoreSetPrep
      ? 'Set preparation photos'
      : STAGE_ACTIONS[stage] || 'Submit Work';
  const submitLabel = isStoreSetPrep ? 'Complete set & go to Delivery' : 'Submit to Admin';
  const formReady = notes.trim().length > 0 && photos.length > 0 && !submitting;

  const notesPlaceholder = isRestock
    ? 'Restocked: what was refilled. Order: what was ordered, supplier, follow-up…'
    : isStoreSetPrep
      ? 'Brief note — kit complete, any missing items, special handling…'
      : 'Describe what was completed, any issues found, items used, observations...';

  const resetForm = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setNotes('');
    setPhotos([]);
    setUploadProgress(null);
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (
    restockOutcome?: RestockOutcome,
    returnOutcome?: ReturnOutcome,
  ) => {
    if (photos.length === 0) {
      setError('Please add at least one photo before submitting.');
      return;
    }
    if (!notes.trim()) {
      setError('Please add completion notes.');
      return;
    }
    if (isRestock && !restockOutcome) {
      setError('Tap Restocked or Order to submit.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setUploadProgress({ done: 0, total: photos.length });

    try {
      const result = await submitStage(
        c.id,
        notes.trim(),
        photos.map((p) => p.file),
        (done, total) => setUploadProgress({ done, total }),
        restockOutcome,
        returnOutcome,
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      resetForm();
      onClose();
    } catch (err) {
      setError(formatUnknownError(err, 'Failed to submit. Please try again.'));
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const busyLabel =
    submitting && uploadProgress && uploadProgress.total > 0 && uploadProgress.done < uploadProgress.total
      ? `Uploading ${uploadProgress.done}/${uploadProgress.total}…`
      : submitting
        ? 'Saving…'
        : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      subtitle={
        isRestock
          ? 'Add photo + notes, then tap Restocked or Order'
          : isPickup
            ? 'Add photo + notes, then choose return type or complete a normal pickup'
            : undefined
      }
      size={isRestock || isPickup ? 'lg' : 'md'}
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          {isRestock ? (
            <>
              <Button
                variant="success"
                size="sm"
                onClick={() => void handleSubmit('restocked')}
                disabled={!formReady}
                icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              >
                {busyLabel ?? 'Restocked'}
              </Button>
              <Button
                variant="warning"
                size="sm"
                onClick={() => void handleSubmit('order')}
                disabled={!formReady}
                icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              >
                {busyLabel ?? 'Order'}
              </Button>
            </>
          ) : isPickup ? (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleSubmit(undefined, undefined)}
                disabled={!formReady}
                icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              >
                {busyLabel ?? 'Pickup completed'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSubmit(undefined, 'used_no_return')}
                disabled={!formReady}
                icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              >
                {busyLabel ?? RETURN_OUTCOMES[0].title}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSubmit(undefined, 'parked')}
                disabled={!formReady}
                icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ParkingCircle className="h-4 w-4" />}
              >
                {busyLabel ?? RETURN_OUTCOMES[1].title}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={!formReady}
              icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            >
              {busyLabel ?? submitLabel}
            </Button>
          )}
        </div>
      }
    >
      <div className="p-4 sm:p-6 space-y-5">
        <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Case</span>
            <span className="font-semibold text-gray-900">{c.caseNumber}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Hospital</span>
            <span className="font-medium text-gray-800">{c.hospital.name}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Stage</span>
            <span className="font-medium text-gray-800">{stage}</span>
          </div>
        </div>

        {isPickup && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RETURN_OUTCOMES.map((opt) => (
              <div
                key={opt.id}
                className={`rounded-xl border-2 px-4 py-3 ${
                  opt.id === 'used_no_return'
                    ? 'border-violet-200 bg-violet-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div
                  className={`flex items-center gap-2 font-semibold text-sm ${
                    opt.id === 'used_no_return' ? 'text-violet-800' : 'text-slate-800'
                  }`}
                >
                  {opt.id === 'used_no_return' ? (
                    <Ban className="h-4 w-4 shrink-0" />
                  ) : (
                    <ParkingCircle className="h-4 w-4 shrink-0" />
                  )}
                  {opt.title}
                </div>
                <p
                  className={`text-xs mt-1 ${
                    opt.id === 'used_no_return' ? 'text-violet-700/90' : 'text-slate-700/90'
                  }`}
                >
                  {opt.hint}
                </p>
              </div>
            ))}
          </div>
        )}

        {isRestock && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border-2 border-lime-200 bg-lime-50 px-4 py-3">
              <div className="flex items-center gap-2 text-lime-800 font-semibold text-sm">
                <Package className="h-4 w-4 shrink-0" />
                Restocked
              </div>
              <p className="text-xs text-lime-700/90 mt-1">Empty slots refilled from stock</p>
            </div>
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                <ShoppingCart className="h-4 w-4 shrink-0" />
                Order
              </div>
              <p className="text-xs text-amber-700/90 mt-1">Stock not available — order placed</p>
            </div>
          </div>
        )}

        <StagePhotoCapture
          photos={photos}
          onPhotosChange={(next) => {
            setPhotos(next);
            setError(null);
          }}
          employeeName={currentUser.name}
          employeeId={currentUser.id}
          disabled={submitting}
        />

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Completion Notes *</label>
          <textarea
            className="nexus-field-input nexus-field-input--plain w-full min-h-[80px] py-2 text-sm resize-y"
            rows={4}
            placeholder={notesPlaceholder}
            value={notes}
            disabled={submitting}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        {isRestock ? (
          <p className="text-xs text-gray-500">
            After photo + notes, use the <strong>Restocked</strong> or <strong>Order</strong> button below.
          </p>
        ) : isStoreSetPrep ? (
          <p className="text-xs text-gray-500">
            Add at least one photo of the prepared set. The case moves to <strong>Delivery</strong> when you submit.
          </p>
        ) : (
          <p className="text-xs text-gray-400">
            Your photos and notes are saved and the case moves to the next stage automatically.
          </p>
        )}
      </div>
    </Modal>
  );
};
