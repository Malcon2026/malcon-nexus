/** HS256 JWT verification for Supabase access tokens (Web Crypto). */

export class JwtVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtVerificationError';
  }
}

function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

export type VerifiedSupabaseJwt = {
  authUserId: string;
  email?: string | null;
  phone?: string | null;
};

export function parseBearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export async function verifySupabaseAccessToken(
  token: string,
  secret: string,
  options?: { audience?: string },
): Promise<VerifiedSupabaseJwt> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtVerificationError('Malformed token');

  const [headerB64, payloadB64, sigB64] = parts;
  const key = await importHmacKey(secret);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = base64UrlDecode(sigB64);
  const ok = await crypto.subtle.verify('HMAC', key, sig, data);
  if (!ok) throw new JwtVerificationError('Invalid token signature');

  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as {
    sub?: string;
    email?: string;
    phone?: string;
    aud?: string;
    exp?: number;
  };

  if (!payload.sub) throw new JwtVerificationError('Missing subject');
  const aud = options?.audience ?? 'authenticated';
  if (payload.aud && payload.aud !== aud) {
    throw new JwtVerificationError('Invalid token audience');
  }
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new JwtVerificationError('Token expired');
  }

  return {
    authUserId: payload.sub,
    email: payload.email ?? null,
    phone: payload.phone ?? null,
  };
}
