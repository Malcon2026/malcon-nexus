import React, { useState, useEffect } from 'react';
import { Send, Loader2, Package, ShoppingCart } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { StagePhotoCapture, type CapturedPhoto } from './StagePhotoCapture';
import { useStore } from '../store/useStore';
import type { ImplantCase, RestockOutcome, WorkflowStage } from '../types';
import { normalizeWorkflowStage } from '../utils/helpers';

const STAGE_ACTIONS: Record<WorkflowStage, string> = {
  'Kit Preparation': 'Submit to Admin',
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
  const { submitStage, currentUser, cases } = useStore();
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
  const title = isRestock ? 'Restock' : STAGE_ACTIONS[stage] || 'Submit Work';
  const formReady = notes.trim().length > 0 && photos.length > 0 && !submitting;

  const notesPlaceholder = isRestock
    ? 'Restocked: what was refilled. Order: what was ordered, supplier, follow-up…'
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

  const handleSubmit = async (restockOutcome?: RestockOutcome) => {
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
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.');
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
          : 'Photo from camera or gallery + notes — admin will review before the next stage'
      }
      size={isRestock ? 'lg' : 'md'}
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
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={!formReady}
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

        {isRestock ? (
          <p className="text-xs text-gray-500">
            After photo + notes, use the <strong>Restocked</strong> or <strong>Order</strong> button below.
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
