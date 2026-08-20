export interface ApiErrorBody {
  error?: { code?: string; message?: string; fieldErrors?: string[]; metadata?: Record<string, number> };
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code?: string, message = 'Yeu cau API khong thanh cong.', public readonly fieldErrors?: string[], public readonly metadata?: Record<string, number>) {
    super(message);
  }
}

export class ApiTimeoutError extends ApiError {
  constructor() { super(0, 'REQUEST_TIMEOUT', 'Yêu cầu lưu đã quá thời gian chờ. Hãy làm mới danh sách để đối soát trước khi gửi lại.'); }
}

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const writeTimeoutMs = 10_000;

export function apiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

export async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: 'GET' });
}

export async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  return sendJson<T>(path, init);
}

export function createOperationId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function sendJson<T>(path: string, init: RequestInit): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers as Record<string, string> | undefined) };
  const isWrite = Boolean(init.method && init.method !== 'GET');
  const controller = isWrite ? new AbortController() : undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const deadline = isWrite ? new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => { timedOut = true; controller?.abort(); reject(new ApiTimeoutError()); }, writeTimeoutMs); }) : undefined;
  try {
  if (isWrite) {
    headers['Content-Type'] = 'application/json';
    const csrfToken = await Promise.race([getCsrfToken(), deadline!]);
    headers['X-CSRF-Token'] = csrfToken;
  }
  const { method, ...rest } = init;
  let response: Response;
  try {
    const request = fetch(apiUrl(path), { ...rest, credentials: 'include', headers, signal: controller?.signal, ...(method && method !== 'GET' ? { method } : {}) });
    response = isWrite ? await Promise.race([request, deadline!]) : await request;
  } catch (error) {
    if (timedOut || controller?.signal.aborted) throw new ApiTimeoutError();
    throw error;
  }
  const body = await response.json().catch(() => undefined) as unknown;
  if (!response.ok) {
    const error = body as ApiErrorBody | undefined;
    const fieldErrors = Array.isArray(error?.error?.fieldErrors) && error.error.fieldErrors.every((value) => typeof value === 'string') ? error.error.fieldErrors : undefined;
    const metadata = error?.error?.metadata && Object.values(error.error.metadata).every((value) => typeof value === 'number' && Number.isSafeInteger(value)) ? error.error.metadata : undefined;
    throw new ApiError(response.status, typeof error?.error?.code === 'string' ? error.error.code : undefined, typeof error?.error?.message === 'string' ? error.error.message : undefined, fieldErrors, metadata);
  }
  if (body === undefined) throw new ApiError(response.status, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  return body as T;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
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
