import type { Employee } from '../types';

/** Super admins — only these accounts can view case stage photos (storage + UI). */
const DEFAULT_SUPER_ADMIN_EMAILS = [
  'jeevanakarsh@gmail.com',
  'jeevan.anishetti@malconnexus.com',
  'preetam.tailam@malconnexus.com',
] as const;

function parseEnvSuperAdminEmails(): string[] {
  const raw = (import.meta.env.VITE_SUPER_ADMIN_EMAILS as string | undefined)?.trim();
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

let cachedAllowlist: Set<string> | null = null;

export function getSuperAdminEmailAllowlist(): ReadonlySet<string> {
  if (!cachedAllowlist) {
    const fromEnv = parseEnvSuperAdminEmails();
    cachedAllowlist = new Set(
      [...DEFAULT_SUPER_ADMIN_EMAILS, ...fromEnv].map((e) => e.toLowerCase()),
    );
  }
  return cachedAllowlist;
}

export function isSuperAdmin(
  user: Pick<Employee, 'email' | 'role'> | null | undefined,
): boolean {
  if (!user?.email) return false;
  return getSuperAdminEmailAllowlist().has(user.email.trim().toLowerCase());
}

/** Stage completion photos (not attendance selfies or petrol receipts). */
export function canViewCaseStagePhotos(
  user: Pick<Employee, 'email' | 'role'> | null | undefined,
): boolean {
  return isSuperAdmin(user);
}
