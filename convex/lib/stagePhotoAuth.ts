import type { RequestContext } from './authContext';

const DEFAULT_SUPER_ADMIN_EMAILS = [
  'jeevanakarsh@gmail.com',
  'jeevan.anishetti@malconnexus.com',
  'preetam.tailam@malconnexus.com',
] as const;

function superAdminAllowlist(): Set<string> {
  const fromEnv = (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_SUPER_ADMIN_EMAILS, ...fromEnv].map((e) => e.toLowerCase()));
}

/** Matches SPA `canViewCaseStagePhotos` (super-admin email allowlist). */
export function canViewStagePhotosAuth(auth: RequestContext): boolean {
  const email = auth.identity?.email?.trim().toLowerCase();
  if (!email) return false;
  return superAdminAllowlist().has(email);
}
