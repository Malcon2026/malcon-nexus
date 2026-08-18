import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';
import { stampPhotoForUpload } from './stagePhotos';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read receipt photo'));
    reader.readAsDataURL(file);
  });
}

/** Stamp name/ID/time onto the pump receipt and upload. Returns a public URL (or data URL in local mode). */
export async function uploadPetrolReceipt(
  requestId: string,
  employeeId: string,
  employeeName: string,
  file: File,
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
    throw new Error('You must be logged in to upload a receipt');
  }

  const path = `${employeeId}/${requestId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('petrol-receipts').upload(path, stamped, {
    contentType: 'image/jpeg',
    upsert: false,
  });

  if (error) {
    const message = error.message || 'Failed to upload receipt photo';
    if (message.toLowerCase().includes('bucket') || message.toLowerCase().includes('not found')) {
      throw new Error(
        'Petrol receipt storage is not set up yet. Please run the petrol_requests migration in Supabase.',
      );
    }
    throw new Error(message);
  }

  const { data } = supabase.storage.from('petrol-receipts').getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error('Receipt uploaded but the photo URL could not be created.');
  }
  return data.publicUrl;
}
