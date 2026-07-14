import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';
import type { Document, WorkflowStage } from '../types';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-stage-photo`
  : '';

const UPLOAD_TIMEOUT_MS = 90_000;
const MAX_PHOTOS_PER_SUBMISSION = 5;

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

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = UPLOAD_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Upload timed out. Check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read photo'));
    reader.readAsDataURL(file);
  });
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

/** Burn employee name, ID, date & time onto the photo before upload. */
export async function stampPhotoForUpload(
  file: File,
  stamp: PhotoStampInfo,
): Promise<File> {
  const capturedAt = stamp.capturedAt ?? new Date();

  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 1920;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    drawPhotoStamp(ctx, width, height, stamp, capturedAt);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.88);
    });
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'stage-photo';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

async function getUploadSession() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be logged in to upload a photo');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Session expired. Please sign in again.');
  }

  return session;
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

  const session = await getUploadSession();

  const form = new FormData();
  form.append('caseId', caseId);
  form.append('stage', stage);
  form.append('uploadedBy', uploadedBy);
  form.append('photo', file, file.name || 'stage-photo.jpg');

  const res = await fetchWithTimeout(FUNCTIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: form,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Photo upload failed');
  }

  const doc = payload.document as Document | undefined;
  if (!doc?.url) {
    throw new Error('Photo upload failed — no image URL returned');
  }

  return {
    ...doc,
    size: formatFileSize(Number(doc.size) || file.size),
  };
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
