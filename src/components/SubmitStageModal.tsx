import React, { useState, useEffect } from 'react';
import { Send, Loader2, Package, ShoppingCart, CheckCircle, Ban, PauseCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { StagePhotoCapture, type CapturedPhoto } from './StagePhotoCapture';
import { useStore } from '../store/useStore';
import type { ImplantCase, RestockOutcome, SurgeryOutcome } from '../types';
import { normalizeWorkflowStage } from '../utils/helpers';
import { formatUnknownError } from '../utils/errors';
import { CANCEL_CASE_REASONS, type CancelCaseReasonType } from '../lib/cancelCase';
import { cn } from '../utils/cn';

const STAGE_ACTIONS: Record<string, string> = {
  'Kit Preparation': 'Submit to Admin',
  'Delivery': 'Mark Delivery Completed',
  'Surgery': 'Submit Surgery',
  'Pickup from Hospital': 'Mark Pickup Completed',
  'Cleaning & Audit': 'Mark Cleaning & Audit Completed',
  'Restock': 'Restock',
  'Billing': 'Invoice Generated',
  'Bill Submission': 'Bill Submission Completed',
  'Completed': 'Close Case',
};

type SurgerySubmitMode = 'completed' | SurgeryOutcome;

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
  const { submitStage, submitSurgeryOutcome, currentUser, cases } = useStore();
  const c = cases.find((x) => x.id === initialCase.id) ?? initialCase;

  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [surgeryMode, setSurgeryMode] = useState<SurgerySubmitMode | null>(null);
  const [cancelReasonType, setCancelReasonType] = useState<CancelCaseReasonType | null>(null);
  const [cancelDetails, setCancelDetails] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNotes('');
      setPhotos([]);
      setUploadProgress(null);
      setError(null);
      setSurgeryMode(null);
      setCancelReasonType(null);
      setCancelDetails('');
    }
  }, [isOpen, c.id]);

  const stage = normalizeWorkflowStage(c.currentStage);
  const isRestock = stage === 'Restock';
  const isSurgery = stage === 'Surgery';
  const title = isRestock ? 'Restock' : STAGE_ACTIONS[stage] || 'Submit Work';
  const completedReady = notes.trim().length > 0 && photos.length > 0 && !submitting;
  const cancelledReady =
    surgeryMode === 'cancelled' &&
    cancelReasonType !== null &&
    (cancelReasonType !== 'other' || cancelDetails.trim().length > 0) &&
    !submitting;
  const parkedReady = surgeryMode === 'parked' && !submitting;

  const notesPlaceholder = isRestock
    ? 'Restocked: what was refilled. Order: what was ordered, supplier, follow-up…'
    : isSurgery && surgeryMode === 'parked'
      ? 'Optional — why the case is parked, when to resume…'
      : isSurgery && surgeryMode === 'cancelled'
        ? 'Optional notes…'
        : 'Describe what was completed, any issues found, items used, observations...';

  const resetForm = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setNotes('');
    setPhotos([]);
    setUploadProgress(null);
    setError(null);
    setSurgeryMode(null);
    setCancelReasonType(null);
    setCancelDetails('');
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const handleCompletedSubmit = async (restockOutcome?: RestockOutcome) => {
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

  const handleSurgeryOutcomeSubmit = async (outcome: SurgeryOutcome) => {
    if (outcome === 'cancelled') {
      if (!cancelReasonType) {
        setError('Please select a cancel reason.');
        return;
      }
      if (cancelReasonType === 'other' && !cancelDetails.trim()) {
        setError('Please add details for Other.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await submitSurgeryOutcome(
        c.id,
        outcome,
        notes.trim(),
        outcome === 'cancelled' ? cancelReasonType ?? undefined : undefined,
        outcome === 'cancelled' ? cancelDetails : undefined,
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
    }
  };

  const busyLabel =
    submitting && uploadProgress && uploadProgress.total > 0 && uploadProgress.done < uploadProgress.total
      ? `Uploading ${uploadProgress.done}/${uploadProgress.total}…`
      : submitting
        ? 'Saving…'
        : null;

  const showPhotos = !isSurgery || surgeryMode === 'completed';
  const showNotes = !isSurgery || surgeryMode !== null;
  const notesRequired = !isSurgery || surgeryMode === 'completed';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      subtitle={
        isRestock
          ? 'Add photo + notes, then tap Restocked or Order'
          : isSurgery
            ? 'Choose outcome — completed advances to Pickup; cancelled or parked stay here for admin'
            : 'Photo from camera or gallery + notes — admin will review before the next stage'
      }
      size={isRestock || isSurgery ? 'lg' : 'md'}
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
                onClick={() => void handleCompletedSubmit('restocked')}
                disabled={!completedReady}
                icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              >
                {busyLabel ?? 'Restocked'}
              </Button>
              <Button
                variant="warning"
                size="sm"
                onClick={() => void handleCompletedSubmit('order')}
                disabled={!completedReady}
                icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              >
                {busyLabel ?? 'Order'}
              </Button>
            </>
          ) : isSurgery ? (
            <>
              {surgeryMode === 'completed' && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => void handleCompletedSubmit()}
                  disabled={!completedReady}
                  icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                >
                  {busyLabel ?? 'Surgery Completed'}
                </Button>
              )}
              {surgeryMode === 'cancelled' && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void handleSurgeryOutcomeSubmit('cancelled')}
                  disabled={!cancelledReady}
                  icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                >
                  {busyLabel ?? 'Submit Cancelled'}
                </Button>
              )}
              {surgeryMode === 'parked' && (
                <Button
                  variant="warning"
                  size="sm"
                  onClick={() => void handleSurgeryOutcomeSubmit('parked')}
                  disabled={!parkedReady}
                  icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4" />}
                >
                  {busyLabel ?? 'Submit Parked'}
                </Button>
              )}
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleCompletedSubmit()}
              disabled={!completedReady}
              icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            >
              {busyLabel ?? 'Submit to Admin'}
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

        {isSurgery && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { id: 'completed' as const, label: 'Surgery completed', hint: 'Photos + notes required. Advances to Pickup.', icon: CheckCircle, activeClass: 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200', textClass: 'text-emerald-800' },
              { id: 'cancelled' as const, label: 'Case cancelled', hint: 'Same reasons as admin cancel. Stays here — admin closes.', icon: Ban, activeClass: 'border-red-400 bg-red-50 ring-2 ring-red-200', textClass: 'text-red-800' },
              { id: 'parked' as const, label: 'Case parked', hint: 'Surgery on hold. Stays parked — admin closes.', icon: PauseCircle, activeClass: 'border-amber-400 bg-amber-50 ring-2 ring-amber-200', textClass: 'text-amber-800' },
            ]).map(({ id, label, hint, icon: Icon, activeClass, textClass }) => {
              const active = surgeryMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setSurgeryMode(id);
                    setError(null);
                    if (id !== 'cancelled') {
                      setCancelReasonType(null);
                      setCancelDetails('');
                    }
                  }}
                  className={cn(
                    'rounded-xl border-2 px-4 py-3 text-left transition-colors',
                    active ? activeClass : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
                  )}
                >
                  <div className={cn('flex items-center gap-2 font-semibold text-sm', active ? textClass : 'text-gray-900')}>
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{hint}</p>
                </button>
              );
            })}
          </div>
        )}

        {isSurgery && surgeryMode === 'cancelled' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Cancel reason (required)</label>
            <div className="space-y-2">
              {CANCEL_CASE_REASONS.map((option) => {
                const active = cancelReasonType === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={submitting}
                    onClick={() => setCancelReasonType(option.id)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
                      active
                        ? 'border-red-400 bg-red-50 ring-2 ring-red-200'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
                    )}
                  >
                    <span className="text-sm font-semibold text-gray-900">{option.label}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{option.hint}</p>
                  </button>
                );
              })}
            </div>
            {cancelReasonType === 'other' && (
              <textarea
                className="w-full mt-3 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
                rows={2}
                placeholder="Describe the reason…"
                value={cancelDetails}
                disabled={submitting}
                onChange={(e) => setCancelDetails(e.target.value)}
              />
            )}
          </div>
        )}

        {showPhotos && (
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
        )}

        {showNotes && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              {notesRequired ? 'Completion Notes *' : 'Notes (optional)'}
            </label>
            <textarea
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
              rows={4}
              placeholder={notesPlaceholder}
              value={notes}
              disabled={submitting}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        {isRestock ? (
          <p className="text-xs text-gray-500">
            After photo + notes, use the <strong>Restocked</strong> or <strong>Order</strong> button below.
          </p>
        ) : isSurgery ? (
          <p className="text-xs text-gray-500">
            {surgeryMode === null
              ? 'Select an outcome above to continue.'
              : surgeryMode === 'completed'
                ? 'Add photo + notes, then tap Surgery Completed.'
                : surgeryMode === 'cancelled'
                  ? 'Pick a reason, then tap Submit Cancelled. Case stays at Surgery until admin closes.'
                  : 'Optionally add notes, then tap Submit Parked. Admin will close when ready.'}
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
