import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';
import { stampPhotoForUpload } from './stagePhotos';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-attendance-selfie`
  : '';

const UPLOAD_TIMEOUT_MS = 90_000;

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
      throw new Error('Selfie upload timed out. Check your connection and try again.');
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
    reader.onerror = () => reject(new Error('Failed to read selfie'));
    reader.readAsDataURL(file);
  });
}

/** Stamp name/ID/time onto selfie (same as case photos) and upload for an approval request. */
export async function uploadAttendanceSelfie(
  requestId: string,
  file: File,
  employeeName: string,
  employeeId: string,
): Promise<string> {
  const stamped = await stampPhotoForUpload(file, {
    employeeName,
    employeeId,
    capturedAt: new Date(),
  });

  if (!USE_SUPABASE) {
    return fileToDataUrl(stamped);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be logged in to upload a selfie');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Session expired. Please sign in again.');
  }

  const form = new FormData();
  form.append('requestId', requestId);
  form.append('photo', stamped, stamped.name || 'selfie.jpg');

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
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Selfie upload failed');
  }

  const url = payload.url as string | undefined;
  if (!url) {
    throw new Error('Selfie upload failed — no URL returned');
  }

  return url;
}

export async function prepareStampedSelfieFile(
  file: File,
  employeeName: string,
  employeeId: string,
): Promise<File> {
  return stampPhotoForUpload(file, {
    employeeName,
    employeeId,
    capturedAt: new Date(),
  });
}
