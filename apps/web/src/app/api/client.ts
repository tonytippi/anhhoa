export interface ApiErrorBody {
  error?: { code?: string; message?: string; fieldErrors?: string[]; metadata?: Record<string, number> };
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code?: string, message = 'Yeu cau API khong thanh cong.', public readonly fieldErrors?: string[], public readonly metadata?: Record<string, number>) {
    super(message);
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

export async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: 'GET' });
}

export async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  return sendJson<T>(path, init);
}

async function sendJson<T>(path: string, init: RequestInit): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers as Record<string, string> | undefined) };
  if (init.method && init.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    const csrfToken = await getCsrfToken();
    headers['X-CSRF-Token'] = csrfToken;
  }
  const { method, ...rest } = init;
  const response = await fetch(apiUrl(path), { ...rest, credentials: 'include', headers, ...(method && method !== 'GET' ? { method } : {}) });
  const body = await response.json().catch(() => undefined) as unknown;
  if (!response.ok) {
    const error = body as ApiErrorBody | undefined;
    const fieldErrors = Array.isArray(error?.error?.fieldErrors) && error.error.fieldErrors.every((value) => typeof value === 'string') ? error.error.fieldErrors : undefined;
    const metadata = error?.error?.metadata && Object.values(error.error.metadata).every((value) => typeof value === 'number' && Number.isSafeInteger(value)) ? error.error.metadata : undefined;
    throw new ApiError(response.status, typeof error?.error?.code === 'string' ? error.error.code : undefined, typeof error?.error?.message === 'string' ? error.error.message : undefined, fieldErrors, metadata);
  }
  if (body === undefined) throw new ApiError(response.status, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  return body as T;
}

let csrfToken: string | undefined;
let csrfTokenRequest: Promise<string> | undefined;
async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfTokenRequest) {
    csrfTokenRequest = fetch(apiUrl('/auth/csrf'), { credentials: 'include', headers: { Accept: 'application/json' } }).then(async (response) => {
      const body = await response.json().catch(() => undefined) as { data?: { csrfToken?: unknown } } | undefined;
      if (!response.ok || typeof body?.data?.csrfToken !== 'string') throw new ApiError(response.status, 'CSRF_UNAVAILABLE', 'Không thể chuẩn bị phiên an toàn.');
      csrfToken = body.data.csrfToken;
      return csrfToken;
    }).finally(() => { csrfTokenRequest = undefined; });
  }
  return csrfTokenRequest;
}

export function resetApiClientForTests(): void {
  csrfToken = undefined;
  csrfTokenRequest = undefined;
}
