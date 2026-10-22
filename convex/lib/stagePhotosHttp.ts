import type { ActionCtx } from '../_generated/server';
import { authenticateRequest, requireIdentity } from './authContext';
import { apiData, apiError, isUuidLike } from './httpUtil';
import {
  GoogleDriveConfigError,
  buildCasePhotoPath,
  getDriveFileMeta,
  listDriveFilesByCase,
  requireDriveFolderId,
  thumbnailUrlForMeta,
  uploadDriveFile,
  viewUrlForMeta,
} from './googleDrive';
import { canViewStagePhotosAuth } from './stagePhotoAuth';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function mapDriveConfigError(err: unknown): Response {
  if (err instanceof GoogleDriveConfigError) {
    return apiError('NOT_CONFIGURED', err.message, 501);
  }
  const message = err instanceof Error ? err.message : 'Google Drive request failed';
  if (/storage quota|storageQuotaExceeded|Service Accounts do not have storage/i.test(message)) {
    return apiError(
      'DRIVE_STORAGE_POLICY',
      'Google blocked service-account uploads to this folder (personal My Drive). Move photos to a Google Workspace Shared drive and add the service account as Content manager, then update GOOGLE_DRIVE_FOLDER_ID.',
      503,
    );
  }
  return apiError('INTERNAL', message, 500);
}

export async function handleStagePhotoUpload(
  ctx: ActionCtx,
  request: Request,
): Promise<Response> {
  const auth = await authenticateRequest(ctx, request);
  const denied = requireIdentity(auth);
  if (denied) return denied;
  if (!auth.employeeId) {
    return apiError('FORBIDDEN', 'Employee profile required to upload photos', 403);
  }

  try {
    requireDriveFolderId();
  } catch (e) {
    return mapDriveConfigError(e);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError('BAD_REQUEST', 'Expected multipart form data', 400);
  }

  const caseId = String(form.get('caseId') ?? '').trim();
  const stage = String(form.get('stage') ?? '').trim();
  const file = form.get('file');
  if (!isUuidLike(caseId)) return apiError('BAD_REQUEST', 'Invalid caseId', 400);
  if (!stage) return apiError('BAD_REQUEST', 'stage is required', 400);
  if (!(file instanceof Blob) || file.size === 0) {
    return apiError('BAD_REQUEST', 'file is required', 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return apiError('BAD_REQUEST', 'Photo is too large (max 5 MB)', 400);
  }

  const mimeType = file.type || 'image/jpeg';
  const bytes = new Uint8Array(await file.arrayBuffer());
  const capturedAt = Date.now();

  try {
    const path = await buildCasePhotoPath(ctx, caseId, stage, capturedAt);
    const uploaded = await uploadDriveFile({
      name: path.fileName,
      mimeType,
      bytes,
      folderId: path.folderId,
      appProperties: { caseId, stage: path.stage },
    });
    return apiData(
      {
        id: path.photoId,
        driveFileId: uploaded.id,
        type: mimeType,
        sizeBytes: file.size,
        drivePath: path.logicalPath,
      },
      201,
    );
  } catch (e) {
    return mapDriveConfigError(e);
  }
}

export async function handleStagePhotoThumbnail(
  ctx: ActionCtx,
  request: Request,
): Promise<Response> {
  const auth = await authenticateRequest(ctx, request);
  const denied = requireIdentity(auth);
  if (denied) return denied;
  if (!canViewStagePhotosAuth(auth)) {
    return apiError('FORBIDDEN', 'Stage photo preview is restricted', 403);
  }

  const fileId = new URL(request.url).searchParams.get('fileId')?.trim();
  if (!fileId) return apiError('BAD_REQUEST', 'fileId is required', 400);

  try {
    requireDriveFolderId();
    const meta = await getDriveFileMeta(fileId);
    const thumbnailUrl = thumbnailUrlForMeta(meta);
    if (!thumbnailUrl) {
      return apiError('NOT_FOUND', 'Thumbnail not available yet for this file', 404);
    }
    return apiData({ fileId, thumbnailUrl });
  } catch (e) {
    return mapDriveConfigError(e);
  }
}

export async function handleStagePhotoView(
  ctx: ActionCtx,
  request: Request,
): Promise<Response> {
  const auth = await authenticateRequest(ctx, request);
  const denied = requireIdentity(auth);
  if (denied) return denied;
  if (!canViewStagePhotosAuth(auth)) {
    return apiError('FORBIDDEN', 'Stage photo view is restricted', 403);
  }

  const fileId = new URL(request.url).searchParams.get('fileId')?.trim();
  if (!fileId) return apiError('BAD_REQUEST', 'fileId is required', 400);

  try {
    requireDriveFolderId();
    const meta = await getDriveFileMeta(fileId);
    return apiData({ fileId, viewUrl: viewUrlForMeta(meta, fileId) });
  } catch (e) {
    return mapDriveConfigError(e);
  }
}

export async function handleStagePhotoList(
  ctx: ActionCtx,
  request: Request,
): Promise<Response> {
  const auth = await authenticateRequest(ctx, request);
  const denied = requireIdentity(auth);
  if (denied) return denied;
  if (!canViewStagePhotosAuth(auth)) {
    return apiError('FORBIDDEN', 'Stage photo list is restricted', 403);
  }

  const url = new URL(request.url);
  const caseId = url.searchParams.get('caseId')?.trim();
  const stage = url.searchParams.get('stage')?.trim();
  if (!caseId || !isUuidLike(caseId)) {
    return apiError('BAD_REQUEST', 'Valid caseId is required', 400);
  }

  try {
    const files = await listDriveFilesByCase({ caseId, stage: stage || undefined });
    return apiData({
      items: files.map((f) => ({
        driveFileId: f.id,
        name: f.name,
        thumbnailUrl: thumbnailUrlForMeta(f),
        viewUrl: viewUrlForMeta(f, f.id),
      })),
    });
  } catch (e) {
    return mapDriveConfigError(e);
  }
}
