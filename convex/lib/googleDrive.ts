/** Google Drive API (service account JWT) for stage photo storage. */

import type { ActionCtx } from '../_generated/server';
import { internal } from '../_generated/api';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const IST = 'Asia/Kolkata';
const CASES_ROOT_FOLDER = 'Cases';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
/** Multipart / resumable uploads must use the upload host, not drive/v3. */
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
/** Persisted under malconRows.table — maps parent folder + name → Drive folder id. */
const DRIVE_FOLDER_CACHE_TABLE = 'drive_folder_cache';

export class GoogleDriveConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleDriveConfigError';
  }
}

type ServiceAccountJson = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

let cachedAccessToken: { token: string; expiresAtMs: number } | null = null;
const memoryFolderCache = new Map<string, string>();

export type DriveFolderCacheCtx = Pick<ActionCtx, 'runQuery' | 'runMutation'>;

function driveFolderCacheKey(parentId: string, name: string): string {
  return `${parentId}::${sanitizeDriveFolderSegment(name)}`;
}

async function readPersistedFolderId(
  ctx: DriveFolderCacheCtx,
  parentId: string,
  name: string,
): Promise<string | null> {
  const legacyId = driveFolderCacheKey(parentId, name);
  const row = await ctx.runQuery(internal.dataQueries.getRow, {
    table: DRIVE_FOLDER_CACHE_TABLE,
    legacyId,
  });
  const folderId = row?.folder_id;
  return typeof folderId === 'string' && folderId.trim() ? folderId.trim() : null;
}

async function writePersistedFolderId(
  ctx: DriveFolderCacheCtx,
  parentId: string,
  name: string,
  folderId: string,
): Promise<void> {
  const safeName = sanitizeDriveFolderSegment(name);
  const legacyId = driveFolderCacheKey(parentId, safeName);
  await ctx.runMutation(internal.dataMutations.mergeTableRow, {
    table: DRIVE_FOLDER_CACHE_TABLE,
    legacyId,
    patch: {
      id: legacyId,
      parent_id: parentId,
      name: safeName,
      folder_id: folderId,
      updated_at: new Date().toISOString(),
    },
  });
}

function rememberFolderId(parentId: string, name: string, folderId: string): void {
  memoryFolderCache.set(driveFolderCacheKey(parentId, name), folderId);
}

async function cachedFolderId(
  parentId: string,
  name: string,
  ctx?: DriveFolderCacheCtx,
): Promise<string | null> {
  const key = driveFolderCacheKey(parentId, name);
  const mem = memoryFolderCache.get(key);
  if (mem) return mem;
  if (!ctx) return null;
  const persisted = await readPersistedFolderId(ctx, parentId, name);
  if (persisted) rememberFolderId(parentId, name, persisted);
  return persisted;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeString(input: string): string {
  return base64UrlEncode(new TextEncoder().encode(input));
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function parseServiceAccountJson(): ServiceAccountJson {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new GoogleDriveConfigError(
      'GOOGLE_SERVICE_ACCOUNT_JSON is not set on the Convex deployment.',
    );
  }
  let parsed: ServiceAccountJson;
  try {
    parsed = JSON.parse(raw) as ServiceAccountJson;
  } catch {
    throw new GoogleDriveConfigError('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new GoogleDriveConfigError('GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key.');
  }
  return parsed;
}

export function requireDriveFolderId(): string {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!folderId) {
    throw new GoogleDriveConfigError(
      'GOOGLE_DRIVE_FOLDER_ID is not set. Share a Drive folder with the service account as Editor, then set the folder id in Convex env.',
    );
  }
  return folderId;
}

async function signJwt(sa: ServiceAccountJson): Promise<string> {
  const header = base64UrlEncodeString(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncodeString(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: sa.token_uri ?? TOKEN_URL,
      scope: DRIVE_SCOPE,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)),
  );
  return `${unsigned}.${base64UrlEncode(sig)}`;
}

export async function getGoogleAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAtMs - Date.now() > 60_000) {
    return cachedAccessToken.token;
  }
  const sa = parseServiceAccountJson();
  const assertion = await signJwt(sa);
  const res = await fetch(sa.token_uri ?? TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) {
    throw new GoogleDriveConfigError(
      body.error ?? `Google token exchange failed (${res.status})`,
    );
  }
  const ttlSec = typeof body.expires_in === 'number' ? body.expires_in : 3600;
  cachedAccessToken = {
    token: body.access_token,
    expiresAtMs: Date.now() + ttlSec * 1000,
  };
  return body.access_token;
}

export type DriveFileMeta = {
  id: string;
  name: string;
  mimeType?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: string;
};

export function driveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

export async function getDriveFileMeta(fileId: string): Promise<DriveFileMeta> {
  const token = await getGoogleAccessToken();
  const url = new URL(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set(
    'fields',
    'id,name,mimeType,thumbnailLink,webViewLink,webContentLink,size',
  );
  url.searchParams.set('supportsAllDrives', 'true');
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as DriveFileMeta & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Drive metadata failed (${res.status})`);
  }
  return data;
}

function escapeDriveQueryLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Folder names safe for Drive (no path separators). */
export function sanitizeDriveFolderSegment(name: string): string {
  return name
    .replace(/[/\\]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/** Match app WorkflowStage naming for folder labels. */
export function normalizeWorkflowStageForDrive(stage: string | null | undefined): string {
  if (!stage) return 'Set Preparation';
  if (stage === 'Kit Preparation') return 'Set Preparation';
  if (stage === 'Collection' || stage === 'Bill Submission') return 'Bill Submission';
  if (stage === 'Billing') return 'Billing';
  if (
    stage === 'Cleaning' ||
    stage === 'Audit' ||
    stage === 'Cleaning & Audit' ||
    stage === 'Checking & Audit' ||
    stage === 'Checking and Audit'
  ) {
    return 'Checking & Audit';
  }
  const known = [
    'Set Preparation',
    'Delivery',
    'Surgery',
    'Pickup from Hospital',
    'Checking & Audit',
    'Restock',
    'Completed',
    'Billing',
    'Bill Submission',
  ];
  if (known.includes(stage)) return stage;
  return 'Set Preparation';
}

function istDatePartsFromMs(ms: number): { year: string; month: string; dateKey: string } {
  const dateKey = new Date(ms).toLocaleDateString('en-CA', { timeZone: IST });
  const [year, month] = dateKey.split('-');
  return { year: year!, month: month!, dateKey };
}

function resolveCaseDateParts(
  caseRow: Record<string, unknown> | null,
  capturedAtMs: number,
): { year: string; month: string; dateKey: string } {
  const surgery =
    typeof caseRow?.surgery_date === 'string' ? caseRow.surgery_date.trim().slice(0, 10) : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(surgery)) {
    const [year, month] = surgery.split('-');
    return { year: year!, month: month!, dateKey: surgery };
  }
  const created =
    typeof caseRow?.created_at === 'string' ? Date.parse(caseRow.created_at) : Number.NaN;
  const ms = Number.isFinite(created) ? created : capturedAtMs;
  return istDatePartsFromMs(ms);
}

export function caseFolderSegment(caseRow: Record<string, unknown> | null, caseId: string): string {
  const raw = caseRow?.case_number;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return sanitizeDriveFolderSegment(`CASE-${raw}`);
  }
  if (typeof raw === 'string' && raw.trim()) {
    const trimmed = raw.trim();
    const withPrefix = /^case-/i.test(trimmed) ? trimmed : `CASE-${trimmed}`;
    return sanitizeDriveFolderSegment(withPrefix);
  }
  return sanitizeDriveFolderSegment(caseId.slice(0, 8));
}

async function findFolderByName(parentId: string, name: string): Promise<string | null> {
  const token = await getGoogleAccessToken();
  const url = new URL(`${DRIVE_API}/files`);
  url.searchParams.set(
    'q',
    [
      `'${escapeDriveQueryLiteral(parentId)}' in parents`,
      "mimeType = 'application/vnd.google-apps.folder'",
      'trashed = false',
      `name = '${escapeDriveQueryLiteral(name)}'`,
    ].join(' and '),
  );
  url.searchParams.set('pageSize', '1');
  url.searchParams.set('fields', 'files(id,name)');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as { files?: { id: string }[]; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Drive folder lookup failed (${res.status})`);
  }
  return data.files?.[0]?.id ?? null;
}

export async function getOrCreateFolder(
  parentId: string,
  name: string,
  ctx?: DriveFolderCacheCtx,
): Promise<string> {
  const safeName = sanitizeDriveFolderSegment(name);
  const cached = await cachedFolderId(parentId, safeName, ctx);
  if (cached) return cached;

  const existing = await findFolderByName(parentId, safeName);
  if (existing) {
    rememberFolderId(parentId, safeName, existing);
    if (ctx) {
      await writePersistedFolderId(ctx, parentId, safeName, existing);
    }
    return existing;
  }

  const token = await getGoogleAccessToken();
  const res = await fetch(`${DRIVE_API}/files?supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: safeName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  const data = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    // Another upload may have created the folder between list and create.
    const raced = await findFolderByName(parentId, safeName);
    if (raced) {
      rememberFolderId(parentId, safeName, raced);
      if (ctx) await writePersistedFolderId(ctx, parentId, safeName, raced);
      return raced;
    }
    throw new Error(data.error?.message ?? `Drive folder create failed (${res.status})`);
  }
  rememberFolderId(parentId, safeName, data.id);
  if (ctx) await writePersistedFolderId(ctx, parentId, safeName, data.id);
  return data.id;
}

async function ensureCasePhotoFolderChain(
  ctx: DriveFolderCacheCtx,
  options: {
    rootFolderId: string;
    year: string;
    month: string;
    dateKey: string;
    caseFolder: string;
    stageFolder: string;
  },
): Promise<string> {
  const casesRoot = await getOrCreateFolder(options.rootFolderId, CASES_ROOT_FOLDER, ctx);
  const yearFolder = await getOrCreateFolder(casesRoot, options.year, ctx);
  const monthFolder = await getOrCreateFolder(yearFolder, options.month, ctx);
  const dayFolder = await getOrCreateFolder(monthFolder, options.dateKey, ctx);
  const caseIdFolder = await getOrCreateFolder(dayFolder, options.caseFolder, ctx);
  return getOrCreateFolder(caseIdFolder, options.stageFolder, ctx);
}

export type CasePhotoPath = {
  folderId: string;
  fileName: string;
  photoId: string;
  /** Relative path under shared root (for logging / docs). */
  logicalPath: string;
  stage: string;
};

export async function buildCasePhotoPath(
  ctx: DriveFolderCacheCtx,
  caseId: string,
  stage: string,
  capturedAt?: number,
): Promise<CasePhotoPath> {
  const rootFolderId = requireDriveFolderId();
  const capturedAtMs = capturedAt ?? Date.now();
  const [caseRow] = await Promise.all([
    ctx.runQuery(internal.dataQueries.getRow, {
      table: 'cases',
      legacyId: caseId,
    }),
    getGoogleAccessToken(),
  ]);
  const { year, month, dateKey } = resolveCaseDateParts(caseRow, capturedAtMs);
  const caseFolder = caseFolderSegment(caseRow, caseId);
  const stageLabel = sanitizeDriveFolderSegment(normalizeWorkflowStageForDrive(stage));
  const folderStarted = Date.now();
  const folderId = await ensureCasePhotoFolderChain(ctx, {
    rootFolderId,
    year,
    month,
    dateKey,
    caseFolder,
    stageFolder: stageLabel,
  });
  const folderMs = Date.now() - folderStarted;
  if (folderMs > 2_000) {
    console.log(
      `[stage-photo] drive folder chain ${folderMs}ms case=${caseId.slice(0, 8)} stage=${stageLabel}`,
    );
  }
  const photoId = crypto.randomUUID();
  const fileName = `${capturedAtMs}-${photoId}.jpg`;
  const logicalPath = `${CASES_ROOT_FOLDER}/${year}/${month}/${dateKey}/${caseFolder}/${stageLabel}/${fileName}`;
  return {
    folderId,
    fileName,
    photoId,
    logicalPath,
    stage: normalizeWorkflowStageForDrive(stage),
  };
}

export async function uploadDriveFile(options: {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
  folderId: string;
  appProperties?: Record<string, string>;
}): Promise<DriveFileMeta> {
  const token = await getGoogleAccessToken();
  const metadata: Record<string, unknown> = {
    name: options.name,
    mimeType: options.mimeType,
    parents: [options.folderId],
  };
  if (options.appProperties && Object.keys(options.appProperties).length > 0) {
    metadata.appProperties = options.appProperties;
  }

  const boundary = `malcon_${crypto.randomUUID()}`;
  const metaPart = JSON.stringify(metadata);
  const preamble =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${metaPart}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${options.mimeType}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  const preBytes = new TextEncoder().encode(preamble);
  const closeBytes = new TextEncoder().encode(closing);
  const body = new Uint8Array(preBytes.length + options.bytes.length + closeBytes.length);
  body.set(preBytes, 0);
  body.set(options.bytes, preBytes.length);
  body.set(closeBytes, preBytes.length + options.bytes.length);

  const res = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const data = (await res.json()) as DriveFileMeta & { error?: { message?: string } };
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message ?? `Drive upload failed (${res.status})`);
  }
  return data;
}

export async function listDriveFilesByCase(options: {
  caseId: string;
  stage?: string;
  pageSize?: number;
}): Promise<DriveFileMeta[]> {
  const token = await getGoogleAccessToken();
  const qParts = [
    'trashed = false',
    `appProperties has { key='caseId' and value='${escapeDriveQueryLiteral(options.caseId)}' }`,
  ];
  if (options.stage) {
    const stageVal = normalizeWorkflowStageForDrive(options.stage);
    qParts.push(
      `appProperties has { key='stage' and value='${escapeDriveQueryLiteral(stageVal)}' }`,
    );
  }
  const url = new URL(`${DRIVE_API}/files`);
  url.searchParams.set('q', qParts.join(' and '));
  url.searchParams.set('pageSize', String(options.pageSize ?? 50));
  url.searchParams.set(
    'fields',
    'files(id,name,mimeType,thumbnailLink,webViewLink,webContentLink,size)',
  );
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as { files?: DriveFileMeta[]; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Drive list failed (${res.status})`);
  }
  return data.files ?? [];
}

export function thumbnailUrlForMeta(meta: DriveFileMeta, size = 400): string | null {
  if (meta.thumbnailLink) {
    try {
      const u = new URL(meta.thumbnailLink);
      u.searchParams.set('sz', `w${size}-h${size}`);
      return u.toString();
    } catch {
      return meta.thumbnailLink;
    }
  }
  return null;
}

export function viewUrlForMeta(meta: DriveFileMeta, fileId: string): string {
  return meta.webViewLink ?? driveViewUrl(fileId);
}
