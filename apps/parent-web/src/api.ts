export class ApiError extends Error { constructor(readonly status: number) { super('Yêu cầu không thành công.'); } }
const base = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');
let csrfToken: string | undefined;

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== 'GET') {
    if (!csrfToken) csrfToken = (await request<{ data: { csrfToken: string } }>('/parent/auth/csrf')).data.csrfToken;
    headers.set('X-CSRF-Token', csrfToken);
  }
  const response = await fetch(`${base}${path}`, { ...init, headers, credentials: 'include' });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}

export function clearClientSession(): void { csrfToken = undefined; }
