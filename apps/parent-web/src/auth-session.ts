export type Session = { audience: 'parent'; userIdentityId: string; email: string };
const apiUrl = typeof __API_URL__ === 'undefined' ? '' : __API_URL__;
const csrfCookieName = typeof __CSRF_COOKIE_NAME__ === 'undefined' ? 'parent_csrf' : __CSRF_COOKIE_NAME__;
export const googleLoginUrl = `${apiUrl}/api/parent/auth/google/start`;
function csrfToken(): string | undefined { return document.cookie.split('; ').find((entry) => entry.startsWith(`${csrfCookieName}=`))?.slice(csrfCookieName.length + 1); }
export async function bootstrapSession(clear: () => void, signal?: AbortSignal): Promise<Session | undefined> { try { const response = await fetch(`${apiUrl}/api/parent/auth/session`, { credentials: 'include', signal }); if (!response.ok) { clear(); return undefined; } return (await response.json() as { data: Session }).data; } catch { if (!signal?.aborted) clear(); return undefined; } }
export async function logout(clear: () => void): Promise<void> { clear(); const token = csrfToken(); await fetch(`${apiUrl}/api/parent/auth/logout`, { method: 'POST', credentials: 'include', headers: token ? { 'x-csrf-token': decodeURIComponent(token) } : {} }).catch(() => undefined); }
