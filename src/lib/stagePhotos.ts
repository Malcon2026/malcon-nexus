import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';
import { formatUnknownError } from '../utils/errors';
import type { Document, WorkflowStage } from '../types';

const UPLOAD_TIMEOUT_MS = 90_000;
const MAX_PHOTOS_PER_SUBMISSION = 10;
/** Raw camera/library files from iPhones can be large — we compress before upload. */
export const MAX_RAW_PHOTO_BYTES = 25 * 1024 * 1024;
/** After compress, keep under storage limit. */
export const MAX_UPLOAD_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const TARGET_UPLOAD_BYTES = 550 * 1024;

export { MAX_PHOTOS_PER_SUBMISSION };

export interface PhotoStampInfo {
  employeeName: string;
  employeeId: string;
  capturedAt?: Date;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatStampDateTime(date: Date): string {
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read photo'));
    reader.readAsDataURL(file);
  });
}

type DecodedImage = { width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; close: () => void };

async function decodeImageFile(file: File): Promise<DecodedImage> {
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    } as ImageBitmapOptions);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      close: () => bitmap.close(),
    };
  } catch {
    // Fallback for HEIC / odd formats some browsers can't bitmap-decode.
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Could not read this photo. Try taking a new JPEG photo.'));
        el.src = objectUrl;
      });
      return {
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
        close: () => undefined,
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Failed to compress photo'));
        else resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

/** Resize + JPEG-compress for upload (iPhone HEIC/large photos). */
export async function compressImageForUpload(
  file: File,
  options?: { maxEdge?: number; targetBytes?: number },
): Promise<File> {
  const maxEdge = options?.maxEdge ?? MAX_IMAGE_EDGE;
  const targetBytes = options?.targetBytes ?? TARGET_UPLOAD_BYTES;

  const decoded = await decodeImageFile(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare photo');

    decoded.draw(ctx, width, height);

    let quality = 0.82;
    let blob = await canvasToJpegBlob(canvas, quality);

    // Step quality down until under target (or floor).
    while (blob.size > targetBytes && quality > 0.55) {
      quality = Math.round((quality - 0.08) * 100) / 100;
      blob = await canvasToJpegBlob(canvas, quality);
    }

    // Still huge → shrink dimensions once more.
    if (blob.size > MAX_UPLOAD_PHOTO_BYTES) {
      const shrink = 0.75;
      canvas.width = Math.max(1, Math.round(width * shrink));
      canvas.height = Math.max(1, Math.round(height * shrink));
      const ctx2 = canvas.getContext('2d');
      if (!ctx2) throw new Error('Could not prepare photo');
      decoded.draw(ctx2, canvas.width, canvas.height);
      blob = await canvasToJpegBlob(canvas, 0.7);
    }

    if (blob.size > MAX_UPLOAD_PHOTO_BYTES) {
      throw new Error('Photo is still too large after compression. Please take a simpler photo and try again.');
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } finally {
    decoded.close();
  }
}

function drawPhotoStamp(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stamp: PhotoStampInfo,
  capturedAt: Date,
) {
  const pad = Math.max(12, Math.round(width * 0.02));
  const nameSize = Math.max(15, Math.round(width * 0.034));
  const metaSize = Math.max(12, Math.round(nameSize * 0.78));
  const lineGap = Math.round(nameSize * 1.3);

  const lines: { text: string; size: number; bold: boolean }[] = [
    { text: stamp.employeeName, size: nameSize, bold: true },
    { text: `ID: ${stamp.employeeId}`, size: metaSize, bold: false },
    { text: formatStampDateTime(capturedAt), size: metaSize, bold: false },
  ];

  const blockHeight = pad * 2 + lines.length * lineGap;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  ctx.fillRect(0, height - blockHeight, width, blockHeight);

  ctx.textBaseline = 'top';
  let y = height - blockHeight + pad;

  for (const line of lines) {
    ctx.font = `${line.bold ? '600' : '500'} ${line.size}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.fillText(line.text, pad, y);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    y += lineGap;
  }
}

/** Compress (iPhone-friendly) then burn employee name, ID, date & time onto the photo. */
export async function stampPhotoForUpload(
  file: File,
  stamp: PhotoStampInfo,
): Promise<File> {
  const capturedAt = stamp.capturedAt ?? new Date();

  const decoded = await decodeImageFile(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare photo');

    decoded.draw(ctx, width, height);
    drawPhotoStamp(ctx, width, height, stamp, capturedAt);

    let quality = 0.82;
    let blob = await canvasToJpegBlob(canvas, quality);
    while (blob.size > TARGET_UPLOAD_BYTES && quality > 0.55) {
      quality = Math.round((quality - 0.08) * 100) / 100;
      blob = await canvasToJpegBlob(canvas, quality);
    }

    if (blob.size > MAX_UPLOAD_PHOTO_BYTES) {
      const shrink = 0.75;
      const sw = Math.max(1, Math.round(width * shrink));
      const sh = Math.max(1, Math.round(height * shrink));
      canvas.width = sw;
      canvas.height = sh;
      const ctx2 = canvas.getContext('2d');
      if (!ctx2) throw new Error('Could not prepare photo');
      decoded.draw(ctx2, sw, sh);
      drawPhotoStamp(ctx2, sw, sh, stamp, capturedAt);
      blob = await canvasToJpegBlob(canvas, 0.7);
    }

    if (blob.size > MAX_UPLOAD_PHOTO_BYTES) {
      throw new Error('Photo is still too large after compression. Please take a simpler photo and try again.');
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'stage-photo';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } finally {
    decoded.close();
  }
}

function sanitizeStage(stage: string): string {
  return stage.toLowerCase().replace(/\s+/g, '-');
}

async function ensureUploadSession() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be logged in to upload a photo');
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new Error('Session expired. Please sign in again.');
  }

  // Refresh if token expires within 2 minutes (common on mobile after camera opens).
  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (expiresAtMs > 0 && expiresAtMs - Date.now() < 120_000) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) {
      throw new Error('Session expired. Please sign in again.');
    }
    return refreshed.session;
  }

  return session;
}

function mapStorageUploadError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('bucket') || lower.includes('not found')) {
    return 'Stage photo storage is not set up yet. Ask admin to run add-stage-photos-storage.sql in Supabase.';
  }
  if (lower.includes('row-level security') || lower.includes('policy') || lower.includes('permission')) {
    return 'Photo upload blocked by storage permissions. Contact admin.';
  }
  if (lower.includes('payload too large') || lower.includes('file size')) {
    return 'Photo is too large (max 5 MB). Retake or use a simpler photo.';
  }
  return message || 'Photo upload failed';
}

/** Upload directly to Supabase Storage (same pattern as petrol receipts — reliable on mobile). */
async function uploadStagePhotoToStorage(
  caseId: string,
  stage: WorkflowStage,
  file: File,
  uploadedBy: string,
): Promise<Document> {
  if (file.size === 0) {
    throw new Error('Photo file is empty. Please retake the photo and try again.');
  }
  if (file.size > MAX_UPLOAD_PHOTO_BYTES) {
    throw new Error('Photo is too large (max 5 MB). Retake or use a simpler photo.');
  }

  await ensureUploadSession();

  const photoId = crypto.randomUUID();
  const path = `${caseId}/${sanitizeStage(stage)}/${Date.now()}-${photoId.slice(0, 8)}.jpg`;

  const { error } = await supabase.storage.from('stage-photos').upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });

  if (error) {
    throw new Error(mapStorageUploadError(error.message));
  }

  const { data } = supabase.storage.from('stage-photos').getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error('Photo uploaded but the URL could not be created.');
  }

  return {
    id: photoId,
    name: `${stage} photo`,
    type: file.type || 'image/jpeg',
    size: formatFileSize(file.size),
    uploadedBy,
    uploadedAt: new Date().toISOString(),
    url: data.publicUrl,
  };
}

/** Upload a stage completion photo and return a Document record for the case stage. */
export async function uploadStagePhoto(
  caseId: string,
  stage: WorkflowStage,
  file: File,
  uploadedBy: string,
): Promise<Document> {
  if (!USE_SUPABASE) {
    const dataUrl = await fileToDataUrl(file);
    return {
      id: crypto.randomUUID(),
      name: `${stage} photo`,
      type: file.type || 'image/jpeg',
      size: formatFileSize(file.size),
      uploadedBy,
      uploadedAt: new Date().toISOString(),
      url: dataUrl,
    };
  }

  try {
    return await uploadStagePhotoToStorage(caseId, stage, file, uploadedBy);
  } catch (err) {
    throw new Error(formatUnknownError(err, 'Photo upload failed. Check your connection and try again.'));
  }
}

/** Upload multiple stage photos sequentially (shows progress in UI). */
export async function uploadStagePhotos(
  caseId: string,
  stage: WorkflowStage,
  files: File[],
  uploadedBy: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<Document[]> {
  if (files.length === 0) {
    throw new Error('At least one photo is required');
  }
  if (files.length > MAX_PHOTOS_PER_SUBMISSION) {
    throw new Error(`You can upload up to ${MAX_PHOTOS_PER_SUBMISSION} photos per submission`);
  }

  const documents: Document[] = [];
  for (let i = 0; i < files.length; i++) {
    documents.push(await uploadStagePhoto(caseId, stage, files[i], uploadedBy));
    onProgress?.(i + 1, files.length);
  }
  return documents;
}

export function isImageDocument(doc: Document): boolean {
  return doc.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(doc.name);
}
