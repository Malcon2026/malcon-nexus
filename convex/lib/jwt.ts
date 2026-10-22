/** Supabase access token verification (HS256 legacy + ES256 via JWKS). */

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

type JwtPayload = {
  sub?: string;
  email?: string;
  phone?: string;
  aud?: string | string[];
  exp?: number;
};

function parsePayload(payloadB64: string): JwtPayload {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as JwtPayload;
  } catch {
    throw new JwtVerificationError('Invalid token payload');
  }
}

function assertPayloadClaims(payload: JwtPayload, options?: { audience?: string }): VerifiedSupabaseJwt {
  if (!payload.sub) throw new JwtVerificationError('Missing subject');
  const aud = options?.audience ?? 'authenticated';
  if (aud) {
    const tokenAud = payload.aud;
    const audOk = tokenAud === aud || (Array.isArray(tokenAud) && tokenAud.includes(aud));
    if (tokenAud != null && !audOk) {
      throw new JwtVerificationError('Invalid token audience');
    }
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

type Jwk = { kid?: string; kty?: string; alg?: string; crv?: string; x?: string; y?: string };

let jwksCache: { fetchedAt: number; keys: Jwk[] } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000;

async function fetchSupabaseJwks(supabaseUrl: string): Promise<Jwk[]> {
  const now = Date.now();
  if (jwksCache && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const base = supabaseUrl.replace(/\/+$/, '');
  const res = await fetch(`${base}/auth/v1/.well-known/jwks.json`);
  if (!res.ok) throw new JwtVerificationError('Failed to fetch JWKS');
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = body.keys ?? [];
  jwksCache = { fetchedAt: now, keys };
  return keys;
}

async function verifyEs256Signature(
  headerB64: string,
  payloadB64: string,
  sigB64: string,
  header: { kid?: string; alg?: string },
  supabaseUrl: string,
): Promise<void> {
  const keys = await fetchSupabaseJwks(supabaseUrl);
  const jwk =
    (header.kid ? keys.find((k) => k.kid === header.kid) : undefined) ??
    keys.find((k) => k.alg === 'ES256' && k.kty === 'EC') ??
    keys[0];
  if (!jwk?.x || !jwk?.y) throw new JwtVerificationError('No matching JWK');

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = base64UrlDecode(sigB64);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, sig, data);
  if (!ok) throw new JwtVerificationError('Invalid token signature');
}

async function verifyHs256Signature(
  headerB64: string,
  payloadB64: string,
  sigB64: string,
  secret: string,
): Promise<void> {
  const key = await importHmacKey(secret);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = base64UrlDecode(sigB64);
  const ok = await crypto.subtle.verify('HMAC', key, sig, data);
  if (!ok) throw new JwtVerificationError('Invalid token signature');
}

export type VerifySupabaseJwtOptions = {
  audience?: string;
  /** HS256 JWT secrets (legacy anon/service_role tokens). */
  secrets?: string[];
  /** Project URL, e.g. https://xxx.supabase.co — required for ES256 user sessions. */
  supabaseUrl?: string;
};

/** Verify Supabase access token (ES256 via JWKS and/or HS256 via secrets). */
export async function verifySupabaseJwt(
  token: string,
  options?: VerifySupabaseJwtOptions,
): Promise<VerifiedSupabaseJwt> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtVerificationError('Malformed token');

  const [headerB64, payloadB64, sigB64] = parts;
  let header: { alg?: string; kid?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64))) as {
      alg?: string;
      kid?: string;
    };
  } catch {
    throw new JwtVerificationError('Invalid token header');
  }

  const alg = header.alg ?? 'HS256';
  const payload = parsePayload(payloadB64);

  if (alg === 'ES256') {
    const supabaseUrl = options?.supabaseUrl?.trim() || process.env.SUPABASE_URL?.trim();
    if (!supabaseUrl) throw new JwtVerificationError('SUPABASE_URL not configured for ES256');
    await verifyEs256Signature(headerB64, payloadB64, sigB64, header, supabaseUrl);
    return assertPayloadClaims(payload, options);
  }

  if (alg === 'HS256') {
    const secrets = options?.secrets?.filter(Boolean) ?? [];
    if (!secrets.length) throw new JwtVerificationError('JWT verification is not configured');
    let lastError: JwtVerificationError | undefined;
    for (const secret of secrets) {
      try {
        await verifyHs256Signature(headerB64, payloadB64, sigB64, secret);
        return assertPayloadClaims(payload, options);
      } catch (e) {
        if (e instanceof JwtVerificationError) {
          lastError = e;
          if (e.message === 'Token expired' || e.message === 'Invalid token audience') throw e;
        } else {
          throw e;
        }
      }
    }
    throw lastError ?? new JwtVerificationError('Invalid token signature');
  }

  throw new JwtVerificationError('Unsupported JWT algorithm');
}

/** @deprecated Use verifySupabaseJwt */
export async function verifySupabaseAccessToken(
  token: string,
  secret: string,
  options?: { audience?: string },
): Promise<VerifiedSupabaseJwt> {
  return verifySupabaseJwt(token, { ...options, secrets: [secret] });
}
