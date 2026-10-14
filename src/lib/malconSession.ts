const SESSION_KEY = 'malcon_nexus_access_token';

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  try {
    if (!token) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearAccessToken(): void {
  setAccessToken(null);
}

/** Read JWT `sub` for session restore (Worker still validates on API calls). */
export function getAccessTokenSubject(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const json = JSON.parse(atob(padded + pad)) as { sub?: string };
    return typeof json.sub === 'string' ? json.sub : null;
  } catch {
    return null;
  }
}
