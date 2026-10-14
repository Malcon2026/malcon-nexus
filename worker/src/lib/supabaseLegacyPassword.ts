import bcrypt from 'bcryptjs';

/** Verify password against Supabase Auth / GoTrue bcrypt hash (`encrypted_password`). */
export async function verifySupabaseLegacyPassword(
  password: string,
  encryptedPassword: string | null | undefined,
): Promise<boolean> {
  const hash = encryptedPassword?.trim();
  if (!hash || !hash.startsWith('$2')) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
