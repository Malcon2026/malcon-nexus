import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';
import type { Document, WorkflowStage } from '../types';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-stage-photo`
  : '';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read photo'));
    reader.readAsDataURL(file);
  });
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

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be logged in to upload a photo');
  }

  const form = new FormData();
  form.append('caseId', caseId);
  form.append('stage', stage);
  form.append('uploadedBy', uploadedBy);
  form.append('photo', file, file.name || 'stage-photo.jpg');

  const res = await fetch(FUNCTIONS_URL, {
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

  const doc = payload.document as Document;
  return {
    ...doc,
    size: formatFileSize(Number(doc.size) || file.size),
  };
}

export function isImageDocument(doc: Document): boolean {
  return doc.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(doc.name);
}
