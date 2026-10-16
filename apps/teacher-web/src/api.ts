// Every teacher workspace talks to the API through these helpers: cookie session, CSRF header, and
// UUID Idempotency-Key + X-Operation-Id on mutations with reconciliation before any retry.
export const apiUrl = typeof __API_URL__ === 'undefined' ? '' : __API_URL__;
const csrfCookieName = typeof __CSRF_COOKIE_NAME__ === 'undefined' ? 'teacher_csrf' : __CSRF_COOKIE_NAME__;
const csrf = () => decodeURIComponent(document.cookie.split('; ').find((entry) => entry.startsWith(`${csrfCookieName}=`))?.slice(csrfCookieName.length + 1) ?? '');

export type ApiFailure = { status: number; code?: string; message: string; fieldErrors?: Record<string, string> };
export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };
export type Operation<T = unknown> = { id: string; status: string; outcome: T };
export type PendingOperation = { id: string; key: string };
// Network failures and 5xx responses leave the Operation outcome unknown: the caller must reconcile, not retry.
export type MutationResult<T> = Result<Operation<T>> | { ok: 'unknown'; operation: PendingOperation };

const failure = async (response: Response, fallback: string): Promise<ApiFailure> => {
  const payload = await response.json().catch(() => ({}));
  const error = payload?.error ?? payload;
  return { status: response.status, code: error?.code, message: error?.message || fallback, fieldErrors: error?.fieldErrors };
};

export async function apiGet<T>(path: string, fallback: string, signal?: AbortSignal): Promise<Result<T>> {
  try {
    const response = await fetch(`${apiUrl}${path}`, { credentials: 'include', signal });
    if (!response.ok) return { ok: false, error: await failure(response, fallback) };
    const payload = await response.json();
    return { ok: true, data: payload.data as T };
  } catch (cause) {
    if (signal?.aborted) throw cause;
    return { ok: false, error: { status: 0, message: 'Không thể kết nối tới hệ thống. Kiểm tra mạng và thử lại.' } };
  }
}

export const newOperation = (): PendingOperation => ({ id: crypto.randomUUID(), key: crypto.randomUUID() });

export async function apiMutate<T>(path: string, operation: PendingOperation, body: unknown, fallback: string, contentType = 'application/json'): Promise<MutationResult<T>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      signal: controller.signal,
      headers: { 'content-type': contentType, 'x-csrf-token': csrf(), 'idempotency-key': operation.key, 'x-operation-id': operation.id },
      body: contentType === 'application/json' ? JSON.stringify(body) : (body as BodyInit),
    });
    if (response.status >= 500) return { ok: 'unknown', operation };
    if (!response.ok) return { ok: false, error: await failure(response, fallback) };
    const payload = await response.json();
    return { ok: true, data: payload.data as Operation<T> };
  } catch {
    return { ok: 'unknown', operation };
  } finally {
    window.clearTimeout(timeout);
  }
}

// Low-impact cookie mutations (mark as read) carry only the CSRF header.
export async function apiPost(path: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}${path}`, { method: 'POST', credentials: 'include', headers: { 'x-csrf-token': csrf() } });
    return response.ok;
  } catch {
    return false;
  }
}

// 'missing' means the server never recorded the Operation, so resending with the same key is safe.
export type Reconciled<T> = { state: 'completed'; operation: Operation<T> } | { state: 'failed' } | { state: 'missing' } | { state: 'unknown' };
export async function reconcile<T>(schoolId: string, operationId: string): Promise<Reconciled<T>> {
  try {
    const response = await fetch(`${apiUrl}/api/teacher/schools/${schoolId}/operations/${operationId}`, { credentials: 'include' });
    if (response.status === 404) return { state: 'missing' };
    if (!response.ok) return { state: 'unknown' };
    const payload = await response.json();
    const operation = payload.data as Operation<T>;
    if (operation?.status === 'COMPLETED') return { state: 'completed', operation };
    if (['QUEUED', 'RUNNING', 'PENDING'].includes(operation?.status)) return { state: 'unknown' };
    return { state: 'failed' };
  } catch {
    return { state: 'unknown' };
  }
}

export async function protectedObjectUrl(path: string, signal?: AbortSignal) {
  const response = await fetch(`${apiUrl}${path}`, { credentials: 'include', signal });
  if (!response.ok) throw new Error('media');
  return URL.createObjectURL(await response.blob());
}

export const acceptedImages = ['image/jpeg', 'image/png', 'image/webp'];
export const hcmToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
export const shiftDay = (day: string, delta: number) => {
  const value = new Date(`${day}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + delta);
  return value.toISOString().slice(0, 10);
};
export const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
export const longDay = (day: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${day}T00:00:00.000Z`));
export const fullDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
export const clock = (instant: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant));
export const hcmLocalMinute = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};
