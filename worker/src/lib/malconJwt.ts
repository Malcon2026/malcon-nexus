import { verifySupabaseAccessToken, type VerifiedSupabaseJwt } from './jwt';

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeJson(obj: Record<string, unknown>): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}

async function importHmacSignKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

export type AccessTokenClaims = {
  sub: string;
  email?: string | null;
  /** Supabase-compatible role claim */
  role?: string;
};

/** Issue HS256 access token (same shape Supabase uses — existing Worker auth middleware accepts it). */
export async function signAccessToken(
  claims: AccessTokenClaims,
  secret: string,
  ttlSeconds = 60 * 60 * 8,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncodeJson({ alg: 'HS256', typ: 'JWT' });
  const payload = base64UrlEncodeJson({
    sub: claims.sub,
    email: claims.email ?? undefined,
    role: claims.role ?? 'authenticated',
    aud: 'authenticated',
    iat: now,
    exp: now + ttlSeconds,
  });
  const data = new TextEncoder().encode(`${header}.${payload}`);
  const key = await importHmacSignKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
  return `${header}.${payload}.${base64UrlEncode(sig)}`;
}

export async function verifyAccessToken(
  token: string,
  secret: string,
  options?: { audience?: string },
): Promise<VerifiedSupabaseJwt> {
  return verifySupabaseAccessToken(token, secret, options);
}
