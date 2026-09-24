import React, { useState, useEffect } from 'react';
import { Send, Loader2, Package, ShoppingCart, Ban, ParkingCircle, CircleCheck } from 'lucide-react';
import { RESTOCK_OUTCOMES, type RestockOutcomeTone } from '../lib/restock';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { StagePhotoCapture, type CapturedPhoto } from './StagePhotoCapture';
import { useStore } from '../store/useStore';
import type { ImplantCase, RestockOutcome, ReturnOutcome, WorkflowStage } from '../types';
import { RETURN_OUTCOMES } from '../lib/returnPickup';
import { normalizeWorkflowStage } from '../utils/helpers';
import { getEmployeeSubmitStage } from '../lib/caseWorkflow';
import { canStoreManagerSubmitSetPreparation } from '../lib/roles';
import { formatUnknownError } from '../utils/errors';

const RESTOCK_TONE_CARD: Record<RestockOutcomeTone, string> = {
  lime: 'border-lime-200 bg-lime-50 text-lime-800',
  sky: 'border-sky-200 bg-sky-50 text-sky-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
};

const RESTOCK_TONE_HINT: Record<RestockOutcomeTone, string> = {
  lime: 'text-lime-700/90',
  sky: 'text-sky-700/90',
  amber: 'text-amber-700/90',
};

function RestockOutcomeIconLarge({ id }: { id: (typeof RESTOCK_OUTCOMES)[number]['id'] }) {
  if (id === 'restocked') return <Package className="h-4 w-4 shrink-0" />;
  if (id === 'no_restock') return <CircleCheck className="h-4 w-4 shrink-0" />;
  return <ShoppingCart className="h-4 w-4 shrink-0" />;
}

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

  const stage =
    getEmployeeSubmitStage(c, currentUser) ??
    (canStoreManagerSubmitSetPreparation(c, currentUser)
      ? 'Set Preparation'
      : normalizeWorkflowStage(c.currentStage));
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
    ? 'Restocked: what was refilled. No restock: why nothing needed. Ordered: items, supplier, ETA…'
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
      setError('Choose Restocked, No restock needed, or Restock ordered.');
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
          ? 'Add photo + notes, then choose how restock was handled'
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
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:justify-end w-full sm:w-auto">
              {RESTOCK_OUTCOMES.map((opt) => (
                <Button
                  key={opt.id}
                  variant={opt.id === 'restocked' ? 'success' : opt.id === 'order' ? 'warning' : 'outline'}
                  size="sm"
                  onClick={() => void handleSubmit(opt.id)}
                  disabled={!formReady}
                  icon={
                    submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RestockOutcomeIconLarge id={opt.id} />
                    )
                  }
                >
                  {busyLabel ?? opt.title}
                </Button>
              ))}
            </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {RESTOCK_OUTCOMES.map((opt) => (
              <div
                key={opt.id}
                className={`rounded-xl border-2 px-4 py-3 ${RESTOCK_TONE_CARD[opt.tone]}`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <RestockOutcomeIconLarge id={opt.id} />
                  {opt.title}
                </div>
                <p className={`text-xs mt-1 ${RESTOCK_TONE_HINT[opt.tone]}`}>{opt.hint}</p>
              </div>
            ))}
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
            After photo + notes, tap <strong>Restocked</strong>, <strong>No restock needed</strong>, or{' '}
            <strong>Restock ordered</strong> below.
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
