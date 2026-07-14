import React, { useRef, useState } from 'react';
import { Camera, RotateCcw, ImageIcon } from 'lucide-react';
import { Button } from './ui/Button';

interface StagePhotoCaptureProps {
  label?: string;
  photo: File | null;
  previewUrl: string | null;
  onPhotoChange: (file: File | null, previewUrl: string | null) => void;
  disabled?: boolean;
}

export const StagePhotoCapture: React.FC<StagePhotoCaptureProps> = ({
  label = 'Stage Photo *',
  photo,
  previewUrl,
  onPhotoChange,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Please capture or select an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5 MB.');
      return;
    }

    const url = URL.createObjectURL(file);
    onPhotoChange(file, url);
  };

  const clearPhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onPhotoChange(null, null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-gray-700">{label}</label>
      <p className="text-xs text-gray-500 -mt-1">
        A photo is required for every stage submission. On mobile, your camera will open directly.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {!previewUrl ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-8 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-colors disabled:opacity-50"
        >
          <Camera className="h-10 w-10" />
          <span className="text-sm font-semibold">Take Photo</span>
          <span className="text-xs text-indigo-500">Tap to open camera</span>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            <img
              src={previewUrl}
              alt="Stage submission preview"
              className="w-full max-h-64 object-contain bg-black/5"
            />
            <div className="absolute top-2 right-2 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
              >
                Retake
              </Button>
              <Button variant="outline" size="sm" onClick={clearPhoto} disabled={disabled}>
                Remove
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            <ImageIcon className="h-3.5 w-3.5 shrink-0" />
            <span>{photo?.name || 'Photo ready'} — will upload when you submit</span>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};
