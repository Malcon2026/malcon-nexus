import React, { useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { stampPhotoForUpload } from '../lib/stagePhotos';

export interface CapturedSelfie {
  file: File;
  previewUrl: string;
  capturedAt: string;
}

interface AttendanceSelfieCaptureProps {
  selfie: CapturedSelfie | null;
  onSelfieChange: (selfie: CapturedSelfie | null) => void;
  employeeName: string;
  employeeId: string;
  disabled?: boolean;
}

export const AttendanceSelfieCapture: React.FC<AttendanceSelfieCaptureProps> = ({
  selfie,
  onSelfieChange,
  employeeName,
  employeeId,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleFiles = async (fileList: FileList | null | undefined) => {
    if (!fileList?.length || processing) return;
    setError(null);

    const file = fileList[0];
    const isImage =
      file.type.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name);

    if (!isImage) {
      setError('Please capture a photo with the camera.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Selfie must be under 5 MB.');
      return;
    }

    setProcessing(true);
    try {
      const capturedAt = new Date();
      const stamped = await stampPhotoForUpload(file, {
        employeeName,
        employeeId,
        capturedAt,
      });

      if (selfie) URL.revokeObjectURL(selfie.previewUrl);

      onSelfieChange({
        file: stamped,
        previewUrl: URL.createObjectURL(stamped),
        capturedAt: capturedAt.toISOString(),
      });
    } catch {
      setError('Failed to prepare selfie. Please try again.');
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeSelfie = () => {
    if (selfie) URL.revokeObjectURL(selfie.previewUrl);
    onSelfieChange(null);
    setError(null);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-gray-900">
        Selfie *
      </label>
      <p className="text-[11px] text-gray-500">
        Front camera required. Your name, employee ID, and time are stamped on the photo (same as case photos).
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        disabled={disabled || processing}
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {!selfie && !processing ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-6 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-colors disabled:opacity-50"
        >
          <Camera className="h-9 w-9" />
          <span className="text-sm font-semibold">Take Selfie</span>
          <span className="text-xs text-indigo-500">Tap to open front camera</span>
        </button>
      ) : (
        <div className="space-y-2">
          {processing && (
            <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              <span>Adding name, ID, date &amp; time to selfie…</span>
            </div>
          )}

          {selfie && (
            <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              <img
                src={selfie.previewUrl}
                alt="Selfie preview"
                className="w-full max-h-56 object-contain bg-black/5"
              />
              <button
                type="button"
                disabled={disabled || processing}
                onClick={removeSelfie}
                className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 border border-gray-200 text-gray-600 hover:text-red-600 disabled:opacity-50"
                aria-label="Remove selfie"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="px-2 py-1.5 bg-white border-t border-gray-100 text-[10px] text-emerald-700 font-medium">
                Selfie ready — stamped with name &amp; time
              </div>
            </div>
          )}

          {selfie && !processing && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              Retake selfie
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};
