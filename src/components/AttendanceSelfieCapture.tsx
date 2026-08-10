import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, RotateCcw, X } from 'lucide-react';
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

async function canvasToJpegFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.92);
  });
  if (!blob) throw new Error('Could not capture photo');
  return new File([blob], name, { type: 'image/jpeg' });
}

export const AttendanceSelfieCapture: React.FC<AttendanceSelfieCaptureProps> = ({
  selfie,
  onSelfieChange,
  employeeName,
  employeeId,
  disabled = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  useEffect(() => () => {
    stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (disabled && cameraActive) stopCamera();
  }, [disabled, cameraActive, stopCamera]);

  const startCamera = useCallback(async () => {
    if (disabled || processing || startingCamera) return;
    setError(null);
    setStartingCamera(true);
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported in this browser. Use Chrome or Safari on HTTPS.');
      setStartingCamera(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      });
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access and try again.'
          : err instanceof Error
            ? err.message
            : 'Could not open camera';
      setError(msg);
      stopCamera();
    } finally {
      setStartingCamera(false);
    }
  }, [disabled, processing, startingCamera, stopCamera]);

  const processCapturedFile = useCallback(
    async (file: File) => {
      setProcessing(true);
      setError(null);
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to prepare selfie. Please try again.');
      } finally {
        setProcessing(false);
      }
    },
    [employeeId, employeeName, onSelfieChange, selfie],
  );

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || processing) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Could not capture photo');
      return;
    }

    ctx.drawImage(video, 0, 0);
    stopCamera();
    try {
      const file = await canvasToJpegFile(canvas, `selfie-${Date.now()}.jpg`);
      await processCapturedFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture selfie');
    }
  }, [processCapturedFile, processing, stopCamera]);

  const removeSelfie = () => {
    if (selfie) URL.revokeObjectURL(selfie.previewUrl);
    onSelfieChange(null);
    setError(null);
    stopCamera();
  };

  const retake = () => {
    removeSelfie();
    void startCamera();
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-gray-900">
        Selfie *
      </label>
      <p className="text-[11px] text-gray-500 -mt-1">
        Live camera only — gallery upload is not allowed for punch-in.
      </p>

      {!selfie && !cameraActive && !processing && (
        <button
          type="button"
          disabled={disabled || startingCamera}
          onClick={() => void startCamera()}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-6 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-colors disabled:opacity-50"
        >
          {startingCamera ? (
            <Loader2 className="h-9 w-9 animate-spin" />
          ) : (
            <Camera className="h-9 w-9" />
          )}
          <span className="text-sm font-semibold">
            {startingCamera ? 'Opening camera…' : 'Take Selfie'}
          </span>
        </button>
      )}

      {cameraActive && !selfie && (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-h-64 object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled || processing}
              onClick={() => void capturePhoto()}
              className="flex-1 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Capture
            </button>
            <button
              type="button"
              disabled={disabled || processing}
              onClick={stopCamera}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {(processing || selfie) && (
        <div className="space-y-2">
          {processing && (
            <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              <span>Processing selfie…</span>
            </div>
          )}

          {selfie && !processing && (
            <>
              <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                <img
                  src={selfie.previewUrl}
                  alt="Selfie preview"
                  className="w-full max-h-56 object-contain bg-black/5"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={removeSelfie}
                  className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 border border-gray-200 text-gray-600 hover:text-red-600 disabled:opacity-50"
                  aria-label="Remove selfie"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void retake()}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retake
              </button>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};
