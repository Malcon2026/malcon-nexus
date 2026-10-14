/** HS256 JWT verification for Supabase-issued access tokens (Web Crypto, no extra deps). */

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
  role?: string | null;
  exp?: number;
};

/**
 * Verify Supabase JWT (HS256). Role in JWT is the Supabase auth role (`authenticated`);
 * application role comes from D1 `employees.role`.
 */
export async function verifySupabaseAccessToken(
  token: string,
  secret: string,
  options?: { audience?: string },
): Promise<VerifiedSupabaseJwt> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtVerificationError('Invalid token format');

  const [headerB64, payloadB64, sigB64] = parts;
  let header: { alg?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64))) as { alg?: string };
  } catch {
    throw new JwtVerificationError('Invalid token header');
  }
  if (header.alg !== 'HS256') throw new JwtVerificationError('Unsupported JWT algorithm');

  const key = await importHmacKey(secret);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = base64UrlDecode(sigB64);
  const ok = await crypto.subtle.verify('HMAC', key, sig, data);
  if (!ok) throw new JwtVerificationError('Invalid token signature');

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as Record<string, unknown>;
  } catch {
    throw new JwtVerificationError('Invalid token payload');
  }

  const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
  if (exp !== undefined && exp * 1000 <= Date.now()) {
    throw new JwtVerificationError('Token expired');
  }

  const aud = options?.audience;
  if (aud) {
    const tokenAud = payload.aud;
    const audOk =
      tokenAud === aud ||
      (Array.isArray(tokenAud) && tokenAud.includes(aud));
    if (!audOk) throw new JwtVerificationError('Invalid token audience');
  }

  const sub = payload.sub;
  if (typeof sub !== 'string' || !sub) throw new JwtVerificationError('Missing subject');

  return {
    authUserId: sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    phone: typeof payload.phone === 'string' ? payload.phone : null,
    role: typeof payload.role === 'string' ? payload.role : null,
    exp,
  };
}

export function parseBearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization');
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m?.[1]?.trim() || null;
}
