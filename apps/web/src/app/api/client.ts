export interface ApiErrorBody {
  error?: { code?: string; message?: string; fieldErrors?: string[] };
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code?: string, message = 'Yeu cau API khong thanh cong.', public readonly fieldErrors?: string[]) {
    super(message);
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(apiUrl(path), { credentials: 'include', headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => undefined) as unknown;
  if (!response.ok) {
    const error = body as ApiErrorBody | undefined;
    const fieldErrors = Array.isArray(error?.error?.fieldErrors) && error.error.fieldErrors.every((value) => typeof value === 'string') ? error.error.fieldErrors : undefined;
    throw new ApiError(response.status, typeof error?.error?.code === 'string' ? error.error.code : undefined, typeof error?.error?.message === 'string' ? error.error.message : undefined, fieldErrors);
  }
  if (body === undefined) throw new ApiError(response.status, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  return body as T;
}
