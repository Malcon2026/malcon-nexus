/** Google Drive API (service account JWT) for stage photo storage. */

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';

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

  const res = await fetch(`${DRIVE_API}/files?uploadType=multipart&supportsAllDrives=true`, {
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
  const folderId = requireDriveFolderId();
  const token = await getGoogleAccessToken();
  const casePrefix = `${options.caseId}/`;
  const qParts = [
    `'${folderId}' in parents`,
    'trashed = false',
    `name contains '${casePrefix.replace(/'/g, "\\'")}'`,
  ];
  if (options.stage) {
    const stageSeg = `${casePrefix}${options.stage.toLowerCase().replace(/\s+/g, '-')}/`;
    qParts.push(`name contains '${stageSeg.replace(/'/g, "\\'")}'`);
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
