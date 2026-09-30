import React, { useState, useEffect } from 'react';
import { Send, Loader2, Package, ShoppingCart, Ban, ParkingCircle, CalendarClock } from 'lucide-react';
import { normalizeDateKey } from '../lib/attendance';
import { RESTOCK_SUBMIT_OPTIONS, type RestockOutcomeTone } from '../lib/restock';
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

function RestockOutcomeIconLarge({ id }: { id: RestockOutcome }) {
  if (id === 'restocked') return <Package className="h-4 w-4 shrink-0" />;
  return <ShoppingCart className="h-4 w-4 shrink-0" />;
}

const STAGE_ACTIONS: Record<WorkflowStage, string> = {
  'Set Preparation': 'Submit to Admin',
  'Delivery': 'Mark Delivery Completed',
  'Surgery': 'Mark Surgery Completed',
  'Pickup from Hospital': 'Mark Pickup Completed',
  'Checking & Audit': 'Mark Checking & Audit Completed',
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
  const { submitStage, postponeCase, cancelCase, currentUser, cases, viewMode } = useStore();
  const c = cases.find((x) => x.id === initialCase.id) ?? initialCase;

  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [postponeDate, setPostponeDate] = useState('');
  const [selectedRestock, setSelectedRestock] = useState<RestockOutcome | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNotes('');
      setPhotos([]);
      setUploadProgress(null);
      setError(null);
      setPostponeDate('');
      setSelectedRestock(null);
    }
  }, [isOpen, c.id]);

  const stage =
    getEmployeeSubmitStage(c, currentUser) ??
    (canStoreManagerSubmitSetPreparation(c, currentUser)
      ? 'Set Preparation'
      : normalizeWorkflowStage(c.currentStage));
  const isRestock = stage === 'Restock';
  const isPickup = stage === 'Pickup from Hospital';
  const isSurgery = stage === 'Surgery';
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
  const surgeryPostponeReady =
    isSurgery &&
    photos.length > 0 &&
    Boolean(normalizeDateKey(postponeDate)) &&
    normalizeDateKey(postponeDate) !== normalizeDateKey(c.surgeryDate) &&
    !submitting;
  const surgeryCancelReady = isSurgery && photos.length > 0 && !submitting;

  const notesPlaceholder = isRestock
    ? 'Restocked: what was refilled. No restock: why nothing needed. Ordered: items, supplier, ETA…'
    : isStoreSetPrep
      ? 'Brief note — kit complete, any missing items, special handling…'
      : isSurgery
        ? 'Surgery completed — implants used, patient details, any issues…'
        : 'Describe what was completed, any issues found, items used, observations...';

  const resetForm = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setNotes('');
    setPhotos([]);
    setUploadProgress(null);
    setError(null);
    setPostponeDate('');
    setSelectedRestock(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const handleSurgeryPostpone = async () => {
    const nextDate = normalizeDateKey(postponeDate);
    if (photos.length === 0) {
      setError('Please add at least one photo before postponing.');
      return;
    }
    if (!nextDate) {
      setError('Pick the new surgery date.');
      return;
    }
    if (nextDate === normalizeDateKey(c.surgeryDate)) {
      setError('Pick a different surgery date.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setUploadProgress({ done: 0, total: photos.length });

    try {
      await postponeCase(c.id, nextDate, '', {
        fieldSurgery: true,
        photos: photos.map((p) => p.file),
        onUploadProgress: (done, total) => setUploadProgress({ done, total }),
      });
      resetForm();
      onClose();
    } catch (err) {
      setError(formatUnknownError(err, 'Failed to postpone. Please try again.'));
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const handleSurgeryCancelUnused = async () => {
    if (photos.length === 0) {
      setError('Please add at least one photo before submitting.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setUploadProgress({ done: 0, total: photos.length });

    try {
      await cancelCase(c.id, 'implants_not_used', undefined, {
        fieldSurgery: true,
        photos: photos.map((p) => p.file),
        onUploadProgress: (done, total) => setUploadProgress({ done, total }),
      });
      resetForm();
      onClose();
    } catch (err) {
      setError(formatUnknownError(err, 'Failed to cancel case. Please try again.'));
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const handleRestockConfirm = async () => {
    if (!selectedRestock) {
      setError('Choose Restocked or Stock ordered.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await submitStage(c.id, '', [], undefined, selectedRestock, undefined);

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
          ? 'Choose how restock was handled, then confirm — case closes when done'
          : isPickup
            ? 'Add photo + notes, then choose return type or complete a normal pickup'
            : isSurgery
              ? 'Complete surgery, adjust the date, or cancel if implants were not used'
              : undefined
      }
      size={isRestock || isPickup || isSurgery ? 'lg' : 'md'}
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          {isRestock ? (
            <Button
              variant="primary"
              size="md"
              className="w-full sm:w-auto min-w-[140px]"
              onClick={() => void handleRestockConfirm()}
              disabled={!selectedRestock || submitting}
              icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            >
              {busyLabel ?? 'Confirm'}
            </Button>
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
          ) : isSurgery ? (
            <div className="flex flex-col gap-2 w-full sm:min-w-[280px]">
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={() => void handleSubmit()}
                disabled={!formReady}
                icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              >
                {busyLabel ?? 'Mark surgery completed'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => void handleSurgeryPostpone()}
                disabled={!surgeryPostponeReady}
                icon={
                  submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />
                }
              >
                {busyLabel ?? 'Adjust surgery date (postponed)'}
              </Button>
              <Button
                variant="danger"
                size="md"
                className="w-full py-3 text-sm font-semibold"
                onClick={() => void handleSurgeryCancelUnused()}
                disabled={!surgeryCancelReady}
                icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              >
                {busyLabel ?? 'Surgery not performed — implant not used'}
              </Button>
            </div>
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

        {isSurgery && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border-2 border-sky-200 bg-sky-50 px-4 py-3 sm:col-span-1">
              <div className="flex items-center gap-2 font-semibold text-sm text-sky-900">
                <CalendarClock className="h-4 w-4 shrink-0" />
                Adjust date (postponed)
              </div>
              <p className="text-xs mt-1 text-sky-800/90">
                Surgery delayed — kit stays at hospital. Add photos and pick the new date below.
              </p>
              <label className="block text-xs font-medium text-sky-900 mt-3 mb-1">New surgery date *</label>
              <input
                type="date"
                className="nexus-field-input nexus-field-input--plain w-full text-sm"
                value={postponeDate}
                min={c.surgeryDate || undefined}
                disabled={submitting}
                onChange={(e) => {
                  setPostponeDate(e.target.value);
                  setError(null);
                }}
              />
            </div>
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center gap-2 font-semibold text-sm text-amber-900">
                <Ban className="h-4 w-4 shrink-0" />
                Surgery cancelled — implant not used
              </div>
              <p className="text-xs mt-1 text-amber-800/90">
                No surgery today. Add photos and use the red button below — kit returns for pickup. No notes needed.
              </p>
            </div>
          </div>
        )}

        {isRestock && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RESTOCK_SUBMIT_OPTIONS.map((opt) => {
              const active = selectedRestock === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setSelectedRestock(opt.id);
                    setError(null);
                  }}
                  className={`rounded-xl border-2 px-4 py-4 text-left transition-colors ${RESTOCK_TONE_CARD[opt.tone]} ${
                    active ? 'ring-2 ring-offset-1 ring-gray-400' : 'opacity-90 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-base">
                    <RestockOutcomeIconLarge id={opt.id} />
                    {opt.title}
                  </div>
                  <p className={`text-xs mt-1.5 ${RESTOCK_TONE_HINT[opt.tone]}`}>{opt.hint}</p>
                </button>
              );
            })}
          </div>
        )}

        {!isRestock && (
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

        {!isSurgery && !isRestock && (
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
        )}

        {isSurgery && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Completion notes <span className="text-gray-400 font-normal">(only if surgery completed)</span>
            </label>
            <textarea
              className="nexus-field-input nexus-field-input--plain w-full min-h-[72px] py-2 text-sm resize-y"
              rows={3}
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
            Tap <strong>Restocked</strong> or <strong>Stock ordered</strong>, then <strong>Confirm</strong>. The
            case closes automatically.
          </p>
        ) : isStoreSetPrep ? (
          <p className="text-xs text-gray-500">
            Add at least one photo of the prepared set. The case moves to <strong>Delivery</strong> when you submit.
          </p>
        ) : isSurgery ? (
          <p className="text-xs text-gray-500">
            Photos are required for every option. Postpone and cancel do not need written notes.
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
