import React, { useState, useEffect } from 'react';
import { Send, Loader2, Package, ShoppingCart } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { StagePhotoCapture, type CapturedPhoto } from './StagePhotoCapture';
import { useStore } from '../store/useStore';
import type { ImplantCase, RestockOutcome, WorkflowStage } from '../types';
import { RESTOCK_OUTCOMES } from '../lib/restock';

const STAGE_ACTIONS: Record<WorkflowStage, string> = {
  'Kit Preparation': 'Submit to Admin',
  'Delivery': 'Mark Delivery Completed',
  'Surgery': 'Mark Surgery Completed',
  'Pickup from Hospital': 'Mark Pickup Completed',
  'Cleaning & Audit': 'Mark Cleaning & Audit Completed',
  'Restock': 'Mark Restock Completed',
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
  implantCase: c,
}) => {
  const { submitStage, currentUser } = useStore();
  const [notes, setNotes] = useState('');
  const [restockOutcome, setRestockOutcome] = useState<RestockOutcome | null>(null);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNotes('');
      setRestockOutcome(null);
      setPhotos([]);
      setUploadProgress(null);
      setError(null);
    }
  }, [isOpen, c.id]);

  const isRestock = c.currentStage === 'Restock';
  const title = isRestock
    ? 'Restock — what happened?'
    : STAGE_ACTIONS[c.currentStage] || 'Submit Work';
  const needsRestockChoice = isRestock && restockOutcome === null;
  const canSubmit =
    notes.trim().length > 0 && photos.length > 0 && !submitting && !needsRestockChoice;

  const notesPlaceholder = isRestock
    ? restockOutcome === 'order'
      ? 'Order details — what was ordered, supplier, expected date…'
      : restockOutcome === 'restocked'
        ? 'What was refilled, kit condition, any empty slots left…'
        : 'Pick Restocked or Order first, then add details…'
    : 'Describe what was completed, any issues found, items used, observations...';

  const resetForm = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setNotes('');
    setRestockOutcome(null);
    setPhotos([]);
    setUploadProgress(null);
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (photos.length === 0) {
      setError('Please add at least one photo before submitting.');
      return;
    }
    if (!notes.trim()) {
      setError('Please add completion notes.');
      return;
    }

    if (isRestock && !restockOutcome) {
      setError('Please choose Restocked or Order.');
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
        isRestock ? restockOutcome ?? undefined : undefined,
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const submitLabel = (() => {
    if (!submitting) return 'Submit to Admin';
    if (uploadProgress && uploadProgress.total > 0 && uploadProgress.done < uploadProgress.total) {
      return `Uploading photo ${uploadProgress.done}/${uploadProgress.total}…`;
    }
    return 'Saving submission…';
  })();

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      subtitle={
        isRestock
          ? 'Choose Restocked or Order, then add photos and notes'
          : 'Photos + notes required — admin will review before the next stage'
      }
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          >
            {submitLabel}
          </Button>
        </div>
      }
    >
      <div className="p-6 space-y-5">
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
            <span className="font-medium text-gray-800">{c.currentStage}</span>
          </div>
        </div>

        {isRestock && (
          <div>
            <p className="block text-xs font-medium text-gray-700 mb-2">Stock status *</p>
            <div className="grid grid-cols-2 gap-3">
              {RESTOCK_OUTCOMES.map(({ id, title: optionTitle, hint }) => {
                const selected = restockOutcome === id;
                const Icon = id === 'restocked' ? Package : ShoppingCart;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setRestockOutcome(id);
                      setError(null);
                    }}
                    className={`rounded-xl border-2 px-3 py-3 text-left transition-colors ${
                      selected
                        ? id === 'restocked'
                          ? 'border-lime-500 bg-lime-50'
                          : 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 mb-1.5 ${selected ? (id === 'restocked' ? 'text-lime-700' : 'text-amber-700') : 'text-gray-400'}`}
                    />
                    <p className="text-sm font-semibold text-gray-900">{optionTitle}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{hint}</p>
                  </button>
                );
              })}
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
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
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

        <p className="text-xs text-gray-400">
          Your photos and notes will be visible to the admin in the Approval Queue.
        </p>
      </div>
    </Modal>
  );
};
