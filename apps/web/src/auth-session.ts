export type Audience = 'app' | 'teacher' | 'parent' | 'ops';
export type Session = { audience: Audience; userIdentityId: string; email: string };
const apiUrl = typeof __API_URL__ === 'undefined' ? '' : __API_URL__;
const csrfCookieName = typeof __CSRF_COOKIE_NAME__ === 'undefined' ? 'app_csrf' : __CSRF_COOKIE_NAME__;

export function googleLoginUrl(audience: Audience): string {
  return `${apiUrl}/api/${audience}/auth/google/start`;
}

function csrfToken(): string | undefined {
  return document.cookie.split('; ').find((entry) => entry.startsWith(`${csrfCookieName}=`))?.slice(csrfCookieName.length + 1);
}

export async function bootstrapSession(audience: Audience, clearProtectedState: () => void, signal?: AbortSignal): Promise<Session | undefined> {
  try {
    const response = await fetch(`${apiUrl}/api/${audience}/auth/session`, { credentials: 'include', signal });
    if (!response.ok) { clearProtectedState(); return undefined; }
    return (await response.json() as { data: Session }).data;
  } catch { if (!signal?.aborted) clearProtectedState(); return undefined; }
}

export async function logout(audience: Audience, clearProtectedState: () => void): Promise<void> {
  clearProtectedState();
  const token = csrfToken();
  await fetch(`${apiUrl}/api/${audience}/auth/logout`, { method: 'POST', credentials: 'include', headers: token ? { 'x-csrf-token': decodeURIComponent(token) } : {} }).catch(() => undefined);
}
