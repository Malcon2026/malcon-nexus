/** Supabase Admin API — magic link token for OTP verify → client `verifyOtp`. */
export async function generateMagicLinkTokenHash(
  email: string,
): Promise<{ tokenHash: string } | { error: string }> {
  const base = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) {
    return { error: 'Server credentials are not configured' };
  }

  const res = await fetch(`${base}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ type: 'magiclink', email: email.trim().toLowerCase() }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    hashed_token?: string;
    properties?: { hashed_token?: string };
    msg?: string;
    error_description?: string;
  };

  const tokenHash = body.hashed_token ?? body.properties?.hashed_token;
  if (!res.ok || !tokenHash) {
    const msg = body.msg ?? body.error_description ?? `HTTP ${res.status}`;
    console.error('[supabaseAuthAdmin] generate_link', msg);
    return { error: 'Could not start session. Contact admin.' };
  }
  return { tokenHash };
}
