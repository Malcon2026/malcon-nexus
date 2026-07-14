import React, { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { StagePhotoCapture } from './StagePhotoCapture';
import { useStore } from '../store/useStore';
import type { ImplantCase, WorkflowStage } from '../types';

const STAGE_ACTIONS: Record<WorkflowStage, string> = {
  'Kit Preparation': 'Submit to Admin',
  'Surgery': 'Mark Surgery Completed',
  'Cleaning': 'Mark Cleaning Completed',
  'Audit': 'Mark Audit Completed',
  'Billing': 'Invoice Generated',
  'Collection': 'Collection Completed',
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
  const { submitStage } = useStore();
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = STAGE_ACTIONS[c.currentStage] || 'Submit Work';
  const canSubmit = notes.trim().length > 0 && photo && !submitting;

  const handleClose = () => {
    if (submitting) return;
    setNotes('');
    setPhoto(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
    onClose();
  };

  const handlePhotoChange = (file: File | null, url: string | null) => {
    if (previewUrl && previewUrl !== url) URL.revokeObjectURL(previewUrl);
    setPhoto(file);
    setPreviewUrl(url);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!photo) {
      setError('Please take a photo before submitting.');
      return;
    }
    if (!notes.trim()) {
      setError('Please add completion notes.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const result = await submitStage(c.id, notes.trim(), photo);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      subtitle="Photo + notes required — admin will review before the next stage"
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
            {submitting ? 'Uploading…' : 'Submit to Admin'}
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

        <StagePhotoCapture
          photo={photo}
          previewUrl={previewUrl}
          onPhotoChange={handlePhotoChange}
          disabled={submitting}
        />

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Completion Notes *</label>
          <textarea
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
            rows={4}
            placeholder="Describe what was completed, any issues found, items used, observations..."
            value={notes}
            disabled={submitting}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        <p className="text-xs text-gray-400">
          Your photo and notes will be visible to the admin in the Approval Queue.
        </p>
      </div>
    </Modal>
  );
};
