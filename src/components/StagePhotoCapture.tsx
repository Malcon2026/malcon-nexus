import React, { useRef, useState } from 'react';
import { Camera, ImageIcon, Loader2, Plus, X } from 'lucide-react';
import { Button } from './ui/Button';
import { MAX_PHOTOS_PER_SUBMISSION, stampPhotoForUpload } from '../lib/stagePhotos';

export interface CapturedPhoto {
  id: string;
  file: File;
  previewUrl: string;
  capturedAt: string;
}

interface StagePhotoCaptureProps {
  label?: string;
  photos: CapturedPhoto[];
  onPhotosChange: (photos: CapturedPhoto[]) => void;
  employeeName: string;
  employeeId: string;
  disabled?: boolean;
  maxPhotos?: number;
}

export const StagePhotoCapture: React.FC<StagePhotoCaptureProps> = ({
  label = 'Stage Photos *',
  photos,
  onPhotosChange,
  employeeName,
  employeeId,
  disabled = false,
  maxPhotos = MAX_PHOTOS_PER_SUBMISSION,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const canAddMore = photos.length < maxPhotos && !processing;

  const handleFiles = async (fileList: FileList | null | undefined) => {
    if (!fileList?.length || processing) return;
    setError(null);

    const validFiles: File[] = [];
    for (const file of Array.from(fileList)) {
      if (photos.length + validFiles.length >= maxPhotos) break;

      const isImage =
        file.type.startsWith('image/') ||
        /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name);

      if (!isImage) {
        setError('Please capture or select image files only.');
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError('Each photo must be under 5 MB.');
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setProcessing(true);
    const stampedPhotos: CapturedPhoto[] = [];

    try {
      for (const file of validFiles) {
        const capturedAt = new Date();
        const stamped = await stampPhotoForUpload(file, {
          employeeName,
          employeeId,
          capturedAt,
        });

        stampedPhotos.push({
          id: crypto.randomUUID(),
          file: stamped,
          previewUrl: URL.createObjectURL(stamped),
          capturedAt: capturedAt.toISOString(),
        });
      }

      onPhotosChange([...photos, ...stampedPhotos]);
    } catch {
      setError('Failed to prepare photo. Please try again.');
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removePhoto = (id: string) => {
    const removed = photos.find((p) => p.id === id);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    onPhotosChange(photos.filter((p) => p.id !== id));
    setError(null);
  };

  const openPicker = () => {
    if (!disabled && canAddMore) inputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-gray-700">{label}</label>
      <p className="text-xs text-gray-500 -mt-1">
        Add at least one photo (up to {maxPhotos}). Your name, employee ID, date and time are stamped automatically on each photo.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={maxPhotos > 1}
        className="hidden"
        disabled={disabled || !canAddMore}
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {photos.length === 0 && !processing ? (
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-8 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-colors disabled:opacity-50"
        >
          <Camera className="h-10 w-10" />
          <span className="text-sm font-semibold">Take / Add Photo</span>
          <span className="text-xs text-indigo-500">Tap to open camera or gallery</span>
        </button>
      ) : (
        <div className="space-y-3">
          {processing && (
            <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              <span>Adding name, ID, date &amp; time to photo…</span>
            </div>
          )}

          {photos.length > 0 && (
            <div className={`grid gap-3 ${photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                >
                  <img
                    src={photo.previewUrl}
                    alt={`Stage photo ${index + 1}`}
                    className="w-full h-40 object-cover bg-black/5"
                  />
                  <button
                    type="button"
                    disabled={disabled || processing}
                    onClick={() => removePhoto(photo.id)}
                    className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 border border-gray-200 text-gray-600 hover:text-red-600 disabled:opacity-50"
                    aria-label={`Remove photo ${index + 1}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="px-2 py-1.5 bg-white border-t border-gray-100 text-[10px] text-gray-500 truncate">
                    Photo {index + 1} — stamped
                  </div>
                </div>
              ))}
            </div>
          )}

          {canAddMore && (
            <Button
              variant="outline"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={openPicker}
              disabled={disabled}
            >
              Add another photo ({photos.length}/{maxPhotos})
            </Button>
          )}

          {photos.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              <ImageIcon className="h-3.5 w-3.5 shrink-0" />
              <span>
                {photos.length} stamped photo{photos.length === 1 ? '' : 's'} ready — will upload when you submit
              </span>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};
